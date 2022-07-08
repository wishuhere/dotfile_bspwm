/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick by SmartBear Software.
* Copyright (C) 2006-2022 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

'use strict';

/*global DejaClick,XMLHttpRequest,setTimeout,clearTimeout*/


/**
 * RestApi manages the session established with the REST service.  A
 * RestApi supports a single established session with the service.
 *
 * The 'dejaclick:restapi' topic will be triggered when any
 * asynchronous operation begins or ends. Observers will receive a
 * data argument conforming to:
 * {
 *    active: boolean,
 *    connected: boolean
 * }
 * where active indicates whether an asynchronous operation is currently
 * being handled by the REST API and connected indicates whether a user
 * session has been established with AlertSite.
 *
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.Logger} aLogger Means of logging messages.
 * @param {!DejaClick.PreferenceService} aPrefService Supplier of
 *    configuration data.
 * @param {!DejaClick.ObserverService} aObserverService Service through which
 *    the RestApi can notify observers of changed session information.
 * @param {!DejaClick.VersionInfo} aVersion Version information for
 *    the extension and browser.
 * @param {function(string):string} aGetMessage Function to retrieve
 *    localized messages.
 * @param {!Window} aGlobalObj The background window object.
 */
DejaClick.RestApi = function (aLogger, aPrefService, aObserverService, aVersion,
      aGetMessage, aGlobalObj) {
   this.m_logger = aLogger;
   this.m_prefService = aPrefService;
   this.m_observerService = aObserverService;
   this.m_version = aVersion;
   this.encodeInvalidChar = this.encodeInvalidChar.bind(this);
   this.m_sourceString = '<TxnSource>' +
      this.encodeXml(aVersion.extension.name) + ',' +
      this.encodeXml(aVersion.extension.version) + '</TxnSource>';
   this.m_getMessage = aGetMessage;
   this.m_window = aGlobalObj;

   /**
    * Details of the current session.
    * @type {?{
    *    login: string,
    *    realLogin: string,
    *    endpoint: string,
    *
    *    sessionId: string,
    *    customerId: string,
    *    objCust: string,
    *    accountId: string,
    *    availablePlans: string,
    *    company: string
    * }}
    */
   this.m_session = null;
   /**
    * The XMLHttpRequest currently being processed.
    * @type {?XMLHttpRequest}
    */
   this.m_xhr = null;
   /**
    * Timer to limit XMLHttpRequests.
    * @type {?integer}
    */
   this.m_timer = null;
};

DejaClick.RestApi.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.RestApi,

   /**
    * Type code for a transaction to be monitored.
    * @const
    */
   TYPE_MONITOR: 1,
   /**
    * Type code for a transaction to be stored in a script repository.
    * @const
    */
   TYPE_REPOSITORY: 2,
   /**
    * Type code for a transaction to be shared.
    * @const
    */
   TYPE_REPOSITORY_NO_INFO: 3,
   /**
    * Type code for a test-on-demand transaction.
    * @const
    */
   TYPE_INSTANTTEST: 4,


   /**
    * Shut down the RestApi, terminating the current session and releasing
    * all references to external objects. The RestApi is no longer usable.
    * @this {!DejaClick.RestApi}
    */
   close: function () {
      if (this.hasOwnProperty('m_window')) {
         this.m_window.clearTimeout(this.m_timer);
      }
      delete this.m_timer;
      if (this.hasOwnProperty('m_xhr') && (this.m_xhr !== null)) {
         this.m_xhr.abort();
      }
      delete this.m_xhr;
      delete this.m_session;
      delete this.m_window;
      delete this.m_getMessage;
      delete this.m_sourceString;
      delete this.m_version;
      delete this.m_observerService;
      delete this.m_prefService;
      delete this.m_logger;
   },

   /**
    * Determine whether a valid session has been established with the
    * REST service.
    * @this {!DejaClick.RestApi}
    * @return {boolean} true if a session has been established.
    */
   isLoggedIn: function () {
      return this.m_session !== null;
   },

   /**
    * Determine whether an asynchronous operation is currently in progress.
    * @this {!DejaClick.RestApi}
    * @return {boolean} true if an operation is in progress.
    */
   isActive: function () {
      return this.m_xhr !== null;
   },

   /**
    * Retrieve the current user ID for the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The current user ID (or empty string if none).
    */
   getLogin: function () {
      return (this.m_session == null) ? '' : this.m_session.login;
   },

   /**
    * Retrieve the real user ID for the session. This is the user id
    * which was originally used to establish the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The real user ID (or empty string if none).
    */
   getRealLogin: function () {
      return (this.m_session == null) ? '' : this.m_session.realLogin;
   },

   /**
    * Retrieve the REST URL with which the current session is established.
    * @this {!DejaClick.RestApi}
    * @return {string} The REST URL (or empty string if none).
    */
   getEndpoint: function () {
      return (this.m_session == null) ?
         String(this.m_prefService.getPrefOption('DC_OPTID_RESTENDPOINT')) :
         this.m_session.endpoint;
   },

   /**
    * Retrieve the customer ID for the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The customer ID (or empty string if none).
    */
   getCustomerId: function () {
      return (this.m_session == null) ? '' : this.m_session.customerId;
   },

   /**
    * Retrieve the ID for the current session.
    * @this {!DejaClick.RestApi}
    * @return {string} The session ID (or empty string if none).
    */
   getSessionId: function () {
      return (this.m_session == null) ? '' : this.m_session.sessionId;
   },

   /**
    * Retrieve the account ID for the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The account ID (or empty string if none).
    */
   getAccountId: function () {
      return (this.m_session == null) ? '' : this.m_session.accountId;
   },

   /**
    * Retrieve the company name for the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The company name (or empty string if none).
    */
   getCompany: function () {
      return (this.m_session == null) ? '' : this.m_session.company;
   },

   /**
    * Retrieve the dashboard URL for the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The company name (or empty string if none).
    */
   getDashboardURL: function () {
      return (this.m_session == null) ? '' : this.m_session.dashboardURL;
   },


   /**
    * Retrieve the report URL for the session.
    * @this {!DejaClick.RestApi}
    * @return {string} The company name (or empty string if none).
    */
   getReportURL: function () {
      return (this.m_session == null) ? '' : this.m_session.reportURL;
   },
      
   /**
    * Get the details of the plans available to the current user.
    * @this {!DejaClick.RestApi}
    * @return {!Array.<{
    *    name: string,
    *    minInterval: integer,
    *    maxSteps: integer
    * }>} The plan details.
    */
   getAvailablePlans: function () {
      var result, plans, index, parts;
      result = [];
      if ((this.m_session !== null) &&
            (this.m_session.availablePlans.length !== 0)) {
         plans = this.m_session.availablePlans.split(/\s*,\s*/);
         for (index = 0; index !== plans.length; ++index) {
            parts = plans[index].split(':');
            result.push({
               name: parts[0],
               minInterval: (parts.length > 0) ? Number(parts[1]) : 0,
               maxSteps: (parts.length > 1) ? Number(parts[2]) : 0
            });
         }
      }
      return result;
   },

   /**
    * Terminate the current session with the REST service and abort any
    * active asynchronous operation. The dejaclick:restapi event is
    * triggered if anything changes.
    * @this {!DejaClick.RestApi}
    */
   logoff: function () {
      var notify, xhr;

      notify = false;
      this.m_window.clearTimeout(this.m_timer);
      this.m_timer = null;

      xhr = this.m_xhr;
      this.m_xhr = null;
      if (xhr !== null) {
         notify = true;
         xhr.abort();
      }
      if (this.m_session !== null) {
         notify = true;
         this.m_logger.logInfo('Logged off (Session ID: ' +
            this.m_session.sessionId +
            ', Customer ID: ' + this.m_session.customerId +
            ', Account ID: ' + this.m_session.accountId + ')');
         this.m_session = null;
      }
      if (notify) {
         this.notify(false);
      }
   },

   /**
    * Asynchronously establish a session with the REST service.
    * @this {!DejaClick.RestApi}
    * @param {string} aLogin The user id to log in as.
    * @param {string} aPassword The user's password.
    * @param {function(string)} aCallback Callback to invoke when the
    *    login operation has completed. On success, the empty string
    *    is passed. On failure, an error message that can be displayed
    *    to the user is passed. Any session will be terminated.
    * @return {string} An empty string if the operation was
    *    successfully initiated. Otherwise, an error string describing
    *    the problem. The effective user id will be unchanged.
    */
   login: function (aLogin, aPassword, aCallback) {
      var result, body;

      if ((aLogin.length === 0) || (aPassword.length === 0)) {
         this.m_logger.logFailure('login called without credentials');
         result = this.m_getMessage('deja_restapi_badloginparams');

      } else if (this.m_xhr !== null) {
         this.m_logger.logFailure('login called during another request');
         result = this.m_getMessage('deja_restapi_restapimultiple');

      } else {
         body = '<Login><Login>' + aLogin +
            '</Login><CustID>null</CustID><Password>' +
            aPassword + '</Password>';
         if (this.m_prefService.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
            body += '<KeepAlive>1</KeepAlive>';
         }
         body += '</Login>';

         result = this.sendRequest('/user/login', body,
            this.handleLoginResponse.bind(this, aCallback));
      }
      return result;
   },

   /**
    * Process a response to an asynchronous login request.
    * @this {!DejaClick.RestApi}
    * @param {function(string)} aCallback Callback to pass the result
    *    of the login operation.
    * @param {string} aError The result of the login operation. An
    *    empty string if successful. An error message if not.
    * @param {Element=} opt_response The Response element of the reply.
    */
   handleLoginResponse: function (aCallback, aError, opt_response) {
      var result;
      if (opt_response == null) {
         result = (aError.length === 0) ? 'Login failed' : aError;
      } else {
         result = this.getResponseErrorMessage(opt_response,
            'deja_restapi_remoteconnecterror', false);
         if (result.length === 0) {
            this.m_session = {
               login: '',
               realLogin: '',
               endpoint: String(this.m_prefService.
                  getPrefOption('DC_OPTID_RESTENDPOINT')),
               sessionId: '',
               customerId: '',
               objCust: '',
               accountId: '',
               availablePlans: '',
               company: '',
			   dashboardURL: '',
			   reportURL: ''
            };
            this.updateResponseData(opt_response);
            this.m_session.realLogin = this.m_session.login;
            this.m_logger.logInfo('Login successful (Session ID: ' +
               this.m_session.sessionId + ', Customer ID: ' +
               this.m_session.customerId + ', Account ID: ' +
               this.m_session.accountId + ')');
         }
      }

      if(aCallback) {
         aCallback(result);
      }
   },

   /**
    * Asynchronously change the effective user id for the current
    * session. This requires a valid session to be in effect.
    * @this {!DejaClick.RestApi}
    * @param {string} aLogin The new user id (or an empty string if a
    *    customer id is specified).
    * @param {string} aCustomerId The new customer (or an empty string
    *    if the user id is specified).
    * @param {function(string)} aCallback Callback to invoke when the
    *    change user operation has completed. On success, the empty
    *    string is passed. On failure, an error message that can be
    *    displayed to the user is passed. The effective user id will
    *    not have changed.
    * @return {string} An empty string if the operation was
    *    successfully initiated. Otherwise, an error string describing
    *    the problem. The effective user id will be unchanged.
    */
   changeUser: function (aLogin, aCustomerId, aCallback) {
      var result, body;

      if ((aLogin.length === 0) && (aCustomerId.length === 0)) {
         this.m_logger.logFailure('changeUser called without credentials');
         result = this.m_getMessage('deja_restapi_badloginparams');

      } else if ((result = this.checkValidState('changeUser')).length === 0) {
         body = '<List><APIVersion>1.2</APIVersion><TxnHeader><Request>';
         if (aLogin.length !== 0) {
            body += '<Login>' + this.encodeXml(aLogin) + '</Login>';
         }
         if (aCustomerId.length !== 0) {
            body += '<CustID>' + this.encodeXml(aCustomerId) + '</CustID>';
         }
         body += '<DeviceFilter>TXN_DEJA</DeviceFilter><SessionID>' +
            this.encodeXml(this.m_session.sessionId) +
            '</SessionID></Request></TxnHeader>' +
            this.m_sourceString + '</List>';

         result = this.sendRequest('/devices/list', body,
            this.handleChangeUserResponse.bind(this, aCallback));
      }
      return result;
   },

   /**
    * Process a response to an asynchronous change user request.
    * @private
    * @param {function(string)} aCallback Callback to pass the result
    *    of the change user operation.
    * @param {string} aError The result of the change user
    *    operation. An empty string if successful. An error message if
    *    not.
    * @param {Element=} opt_response The Response element of the reply.
    */
   handleChangeUserResponse: function (aCallback, aError, opt_response) {
      var result, origSession;
      if (opt_response == null) {
         result = (aError.length === 0) ? 'Change user failed' : aError;
      } else {
         result = this.getResponseErrorMessage(opt_response,
            'deja_restapi_changeusererror', true);

         if (result.length === 0) {
            // Clear out previous account information.
            origSession = this.m_session;
            this.m_session = {
               login: '',
               realLogin: origSession.realLogin,
               endpoint: origSession.endpoint,
               sessionId: origSession.sessionId,
               customerId: '',
               objCust: '',
               accountId: '',
               availablePlans: '',
               company: '',
			   dashboardURL: '',
			   reportURL: ''
            };

            this.updateResponseData(opt_response);

            if ((this.m_session.login === '') ||
                  ((this.m_session.customerId === '') &&
                     (this.m_session.accountId === ''))) {
               this.m_logger.logFailure('Change user failed: ' +
                  'Invalid user account.');
               result = 'Missing or invalid user account.';
               this.m_session = origSession;
            } else {
               this.m_logger.logInfo('Changed user (Session ID: ' +
                  this.m_session.sessionId + ', Customer ID: ' +
                  this.m_session.customerId + ', Account ID: ' +
                  this.m_session.accountId + ')');
            }
         }
      }
      aCallback(result);
   },

   /**
    * Asynchronously request a list of monitoring locations at which
    * Test on Demand can be run.
    * @this {!DejaClick.RestApi}
    * @param {?string=} aFilter Optional browser filter string. An empty
    *    string is ignored. Valid strings are 'FF', 'CH' or 'IE'.
    * @param {function(string, !Array.<!{name:string, code:string}>)} aCallback
    *    Function to which the resulting list is passed. On success,
    *    an empty string and a list of location records are passed.
    *    On failure, a description of the error is passed.
    * @return {string} An empty string if the request was successfully
    *    initiated. An error string otherwise.
    */
   listLocations: function (aFilter, aCallback) {
      var result, body;

      result = this.checkValidState('listLocations');
      if (result.length === 0) {
         body = '<List><APIVersion>1.1</APIVersion><TxnHeader><Request>';
         body += '<Login>' + this.encodeXml(this.m_session.login) + '</Login>';
         if (this.m_session.customerId.length !== 0) {
            body += '<CustID>' + this.encodeXml(this.m_session.customerId) +
               '</CustID>';
         }
         body += '<SessionID>' + this.encodeXml(this.m_session.sessionId) +
            '</SessionID>';
         if (aFilter.length !== 0) {
            body += '<BrowserFilter>' + this.encodeXml(aFilter) +
               '</BrowserFilter>';
         }
         body += '</Request></TxnHeader><TxnSource></TxnSource></List>';

         if (this.m_session.customerId.length !== 0) {
            result = this.sendRequest('/devices/list/locations', body,
               this.handleListLocationsResponse.bind(this, aCallback));
         } else {
            result = this.sendRequest('/devices/list/locations', body,
               this.handleListLocationsResponse.bind(this, aCallback),
               String(this.m_prefService.getPrefOption(
                  'DC_OPTID_INSTANTTEST_RESTENDPOINT')));
         }
      }
      return result;
   },

   /**
    * Process a response to an asynchronous list locations request.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {function(string, !Array.<!{name:string, code:string}>)} aCallback
    *    Function to which the resulting list is passed. On success,
    *    an empty string and a list of location records are passed.
    *    On failure, a description of the error is passed.
    * @param {string} aError The result of the list locations
    *    operation. An empty string if successful. An error message if
    *    not.
    * @param {Element=} opt_response The Response element returned in
    *    reply to a list locations request.
    */
   handleListLocationsResponse: function (aCallback, aError, opt_response) {
      var locations, result, locationElts, index, location, child;

      locations = [];
      if (opt_response == null) {
         result = (aError.length === 0) ? 'List locations failed' : aError;

      } else {
         result = this.getResponseErrorMessage(opt_response,
            'deja_restapi_remotelistlocationserror', false);

         if (result.length === 0) {
            this.updateResponseData(opt_response);

            this.m_logger.logInfo('List locations request successful ' +
               '(Session ID: ' + this.m_session.sessionId +
               ', Customer ID: ' + this.m_session.customerId +
               ', Account ID: ' + this.m_session.accountId + ')');

            locationElts = opt_response.getElementsByTagName('Location');
            for (index = 0; index !== locationElts.length; ++index) {
               location = {};
               for (child = /** @type {!Element} */ (locationElts[index]).
                        firstElementChild;
                     child !== null;
                     child = child.nextElementSibling) {
                  switch (child.tagName) {
                  case 'LocCode':
                     location.code = child.textContent;
                     break;
                  case 'LocName':
                     location.name = decodeURIComponent(child.textContent);
                     break;
                  }
               }
               locations.push(location);
            }
         }
      }
      aCallback(result, locations);
   },

   /**
    * Asynchronously request a list of transactions for the current user.
    * @this {!DejaClick.RestApi}
    * @param {integer} aType The type of transactions to be listed.
    *    One of the TYPE_* constants above.
    * @param {function(string,
    *       !Array.<!{type:string, description:string}>,
    *       !Array.<!{name:string, description:string,
    *          objDevice:string, maxSteps:integer}>)} aCallback
    *    Function to which the resulting lists are passed. On success,
    *    an empty string, a list of browser records, and list of
    *    transaction records are passed.  On failure, a description of
    *    the error is passed.
    * @return {string} An empty string if the request was successfully
    *    initiated. An error string otherwise.
    */
   listTransactions: function (aType, aCallback) {
      var result, method, version, extra, status, body;

      result = this.checkValidState('listTransactions');
      if (result.length === 0) {
         method = '/devices/list';
         version = '';
         extra = '';

         if (aType === this.TYPE_REPOSITORY) {
            method += '/scriptsharing';
         } else {
            version = '<APIVersion>1.2</APIVersion>';
            extra = '<DeviceFilter>TXN_DEJA</DeviceFilter>';
         }

         body = '<List>' + version + '<TxnHeader><Request><Login>' +
            this.encodeXml(this.m_session.login) + '</Login>';
         if (this.m_session.customerId.length !== 0) {
            body += '<CustID>' + this.encodeXml(this.m_session.customerId) +
               '</CustID>';
         }
         body += extra +
            '<SessionID>' + this.encodeXml(this.m_session.sessionId) +
            '</SessionID></Request></TxnHeader>' + this.m_sourceString +
            '</List>';

         if (aType === this.TYPE_REPOSITORY) {
            result = this.sendRequest(method, body,
               this.handleListTransactionsResponse.bind(this, aCallback),
               String(this.m_prefService.getPrefOption(
                  'DC_OPTID_SCRIPTSHARE_RESTENDPOINT')));
         } else {
            result = this.sendRequest(method, body,
               this.handleListTransactionsResponse.bind(this, aCallback));
         }
      }
      return result;
   },

   /**
    * Collection of tags of elements within a Browser element of a
    * response to a list transactions request.
    * @private
    * @const
    */
   BROWSER_TAGS: {
      Type: 'type',
      Description: 'description'
   },

   /**
    * Process a response to an asynchronous list transactions request.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {function(string,
    *       !Array.<!{type:string, description:string}>,
    *       !Array.<!{name:string, description:string,
    *          objDevice:string, maxSteps:integer}>)} aCallback
    *    Function to which the resulting lists are passed. On success,
    *    an empty string, a list of browser records, and list of
    *    transaction records are passed.  On failure, a description of
    *    the error is passed.
    * @param {string} aError The result of the list transactions
    *    operation. An empty string if successful. An error message if
    *    not.
    * @param {Element=} opt_response The Response element returned in
    *    reply to a list transactions request.
    */
   handleListTransactionsResponse: function (aCallback, aError, opt_response) {
      var browsers, txns, result, eltList, index, txn, child;

      browsers = [];
      txns = [];
      if (opt_response == null) {
         result = (aError.length === 0) ? 'List transactions failed' : aError;

      } else {
         result = this.getResponseErrorMessage(opt_response,
            'deja_restapi_remotelisttransactionserror', false);

         if (result.length === 0) {
            this.updateResponseData(opt_response);

            this.m_logger.logInfo('List transactions request successful ' +
               '(Session ID: ' + this.m_session.sessionId +
               ', Customer ID: ' + this.m_session.customerId +
               ', Account ID: ' + this.m_session.accountId + ')');

            eltList = opt_response.getElementsByTagName('Browser');
            for (index = 0; index !== eltList.length; ++index) {
               browsers.push(this.getBrowserInfo(eltList[index],
                  { type: '', description: '', versions: [] }));
            }

            eltList = opt_response.getElementsByTagName('Txn');
            for (index = 0; index !== eltList.length; ++index) {
               txn = {};
               for (child = /** @type {!Element} */ (eltList[index]).
                        firstElementChild;
                     child !== null;
                     child = child.nextElementSibling) {
                  switch (child.tagName) {
                  case 'TxnName':
                     txn.name = decodeURIComponent(child.textContent);
                     break;
                  case 'TxnDesc':
                     txn.description = decodeURIComponent(child.textContent);
                     break;
                  case 'TxnDetail':
                     txn.objDevice = child.getAttribute('ObjDevice');
                     txn.maxSteps = Number(child.getAttribute('MaxSteps'));
                     txn.browser = child.hasAttribute('BrowserType')?child.getAttribute('BrowserType'):null;
                     txn.browserVersion = child.hasAttribute('MonitorAgent')?child.getAttribute('MonitorAgent'):null;
                     break;
                  }
               }
               txns.push(txn);
            }
         }
      }
      aCallback(result, browsers, txns);
   },

   /**
    * Asynchronously begin downloading a script from AlertSite.
    * @this {!DejaClick.RestApi}
    * @param {string} aDevice The device ID to be downloaded.
    * @param {integer} aType The type of transaction to be downloaded.
    *    One of the TYPE_* constants above.
    * @param {function(string, ?(DejaClick.Script|string))} aCallback
    *    Function to which the result of the download is passed. On
    *    success, an empty string and the script (or a URL to redirect
    *    to) are passed. On failure, a description of the error is passed.
    * @return {string} An empty string if the request was successfully
    *    initiated. An error string otherwise.
    */
   downloadScript: function (aDevice, aType, aCallback) {
      var result, method, body;

      result = this.checkValidState('downloadScript');
      if (result.length === 0) {
         method = '/devices/download/';
         body = '<Download><TxnHeader><Request><Login>' +
            this.encodeXml(this.m_session.login) + '</Login><SessionID>' +
            this.encodeXml(this.m_session.sessionId) + '</SessionID><ObjCust>' +
            this.encodeXml(this.m_session.objCust) + '</ObjCust>';

         if (aType === this.TYPE_REPOSITORY) {
            method += 'scriptsharing';
            body += '<ObjDevice>' + this.encodeXml(aDevice) + '</ObjDevice>';
         } else {
            method += 'monitor';
            body += '<ObjDevice>' + this.encodeXml(aDevice) + '</ObjDevice>';
         }

         body += '</Request></TxnHeader>' + this.m_sourceString +
            '</Download>';

         if (aType === this.TYPE_REPOSITORY) {
            result = this.sendRequest(method, body,
               this.handleDownloadResponse.bind(this, aCallback),
               String(this.m_prefService.getPrefOption(
                  'DC_OPTID_SCRIPTSHARE_RESTENDPOINT')));
         } else {
            result = this.sendRequest(method, body,
               this.handleDownloadResponse.bind(this, aCallback));
         }
      }
      return result;
   },

   /**
    * Process a response to an asynchronous download script request.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {function(string, ?(DejaClick.Script|string))} aCallback
    *    Function to which the result of the download is passed. On
    *    success, an empty string and the script (or a URL to redirect
    *    to) are passed. On failure, a description of the error is passed.
    * @param {string} aError The result of the download script
    *    operation. An empty string if successful. An error message if
    *    not.
    * @param {Element=} opt_response The Response element returned in
    *    reply to a download script request.
    */
   handleDownloadResponse: function (aCallback, aError, opt_response) {
      var /** @type {?(DejaClick.Script|string)} */ script,
         result, eltList, url, error;

      script = null;
      if (opt_response == null) {
         result = (aError.length === 0) ? 'Script download failed' : aError;

      } else {
         result = this.getResponseErrorMessage(opt_response,
            'deja_restapi_remoteloaderror', false);

         if (result.length === 0) {
            this.updateResponseData(opt_response);

            this.m_logger.logInfo('Script download successful ' +
               '(Session ID: ' + this.m_session.sessionId +
               ', Customer ID: ' + this.m_session.customerId +
               ', Account ID: ' + this.m_session.accountId + ')');

            // Check for shared script that needs to navigate to a URL.
            eltList = opt_response.getElementsByTagName('RedirectURL');
            if (eltList.length !== 0) {
               script = /** @type {!Element} */ (eltList[0]).textContent;
               if (script.length === 0) {
                  this.m_logger.logFailure('Downloaded empty URL');
                  result = 'Invalid URL downloaded';
               }

            } else {
               eltList = opt_response.getElementsByTagName('script');
               if (eltList.length === 0) {
                  this.m_logger.logFailure('No script in download response');
                  result = this.m_getMessage('deja_restapi_remoteloaderror');

               } else {
                  script = new DejaClick.Script();
                  
                  //UXM-12145 - Storing monitor ID at the sript object, so we can use it 
                  // at the script upload functionality.
                  let objDeviceInfo = opt_response.getElementsByTagName('ObjDevice');
                  if ( objDeviceInfo && objDeviceInfo.length > 0 && ! isNaN(objDeviceInfo[0].innerHTML) ) {
                     script.setMonitorId(objDeviceInfo[0].innerHTML);
                  }

                  result = script.cloneFromDomSubtree(
                     /** @type {!Element} */ (eltList[0]));
                  if (result.length !== 0) {
                     this.m_logger.logFailure('Error in downloaded script: ' +
                        result);
                     result = this.m_getMessage('deja_restapi_remoteloaderror') +
                        '\n\n' + result;
                  }
               }
            }
         }
      }
      aCallback(result, script);
   },

   /**
    * Map of details provided when uploading a transaction to be monitored
    * by AlertSite. Monitor uploads should also provide name, plan,
    * and optionally a device properties.
    * @private
    * @const
    * @type {Object.<string,string>}
    */
   MONITOR_OPTIONS: {
      monitor: 'Monitor',
      interval: 'Interval',
      timeout: 'TimeOut',
      browser: 'BrowserType',
      browserVersion: 'MonitorAgent' //UXM-12145
   },

   /**
    * Map of details provided when uploading a transaction for test-on-demand.
    * @private
    * @const
    * @type {Object.<string,string>}
    */
   TOD_OPTIONS: {
      browser: 'BrowserType',
      browserVersion: 'MonitorAgent', //UXM-12145
      location: 'TestLocation',
      timeout: 'TimeOut',
      fullpage: 'Fullpage',
      captureLevel: 'CaptureLevel',
      captureGroup: 'CaptureGroup',
      captureType: 'CaptureMimeType',
      highlight: 'HighlightActive'
   },

   /**
    * Initiate the asynchronous upload of a script to AlertSite.
    * @this {!DejaClick.RestApi}
    * @param {!DejaClick.Script} aScript The script to be uploaded.
    * @param {integer} aType The type of transaction to be uploaded.
    *    One of the TYPE_* constants above.
    * @param {{
    *    name:?string,
    *    description:?string,
    *    device:?string,
    *    plan:?string,
    *    monitor:?string,
    *    interval:?string,
    *    timeout:?string,
    *    browser:?string,
    *    location:?string,
    *    fullpage:?string,
    *    highlight:?string,
    *    captureLevel:?string,
    *    captureGroup:?string,
    *    captureType:?string
    * }} aDetails Details of the uploaded script. Different transaction
    *    types use different details.
    * @param {?DejaClick.Encryption} aEncryption Optional object
    *    used to encrypt the script before uploading.
    * @param {function(string, string)} aCallback Function to which
    *    the result of the upload is passed. On success, an empty
    *    string and a URL to display are passed. On failure, a
    *    description of the error is passed.
    * @return {string} An empty string if the request was successfully
    *    initiated. An error string otherwise.
    */
   uploadScript: function (aScript, aType, aDetails, aEncryption, aCallback) {
      var result, scriptString, password, method, body,
         /** @type {string} */ key;

      result = this.checkValidState('uploadScript');
      if (result.length !== 0) {
         return result;
      }

      password = (aEncryption == null) ? '' : aEncryption.getPassword();
      scriptString = aScript.serializeScript({
         writeActions: true,
         writeNavigation: false,
         writeResults: Boolean(
            this.m_prefService.getPrefOption('DC_OPTID_WRITERESTREES')),
         writeFingerprints: false,
         uriEncode: true,
         pretty: false,
         encrypt: (aEncryption == null) ? null : aEncryption,
         local: false,
         cleanup : false,
         encryptAllInput: Boolean(
            this.m_prefService.getPrefOption('DC_OPTID_ENCRYPTINPUT'))
      }, this.m_version);

      if (scriptString.length > DejaClick.constants.MAX_UPLOAD_SCRIPT_SIZE) {
         this.m_logger.logFailure('uploadScript rejected a script of size ' +
            scriptString.length);
         return this.m_getMessage('deja_restapi_toolargeupload');
      }

      method = '/devices/upload/';
      body = '<Upload>';
      if ((aType === this.TYPE_INSTANTTEST) || (aType === this.TYPE_MONITOR)) {
         body += '<APIVersion>1.1</APIVersion>';
      }
      body += '<TxnHeader><Request><Login>' +
         this.encodeXml(this.m_session.login) +
         '</Login><SessionID>' + this.encodeXml(this.m_session.sessionId) +
         '</SessionID><TxnHeader>';

      switch (aType) {
      case this.TYPE_MONITOR:
         if ((aDetails == null) ||
               (aDetails.name == null) ||
               (aDetails.name.length === 0)) {
            this.m_logger.logFailure('uploadScript monitor called without a transaction name');
            return this.m_getMessage('deja_restapi_badsaveparams');
         }

         method += 'monitor';
         body += '<ObjDevice>';
         if (this.hasOwnProperty.call(aDetails, 'device') &&
               (aDetails.device !== null)) {
            body += this.encodeXml(aDetails.device);
         }
         body += '</ObjDevice>';
         if (this.hasOwnProperty.call(aDetails, 'plan') &&
               (aDetails.plan !== null)) {
            body += '<TxnPlan>' + this.encodeXml(aDetails.plan) + '</TxnPlan>';
         }
         body += '<TxnDetail';
         for (key in this.MONITOR_OPTIONS) {
            if (this.MONITOR_OPTIONS.hasOwnProperty(key) &&
                  this.hasOwnProperty.call(aDetails, key)) {
               body += ' ' + this.MONITOR_OPTIONS[key] + '="' +
                  this.encodeXml(aDetails[key]) + '"';
            }
         }
         body += '></TxnDetail><TxnPassword>' +
            this.encodeXml(encodeURIComponent(password)) + '</TxnPassword>';
         break;

      case this.TYPE_REPOSITORY:
         if ((aDetails == null) ||
               (aDetails.name == null) ||
               (aDetails.name.length === 0)) {
            this.m_logger.logFailure('uploadScript shared script called without a transaction name');
            return this.m_getMessage('deja_restapi_badsaveparams');
         }

         method += 'scriptsharing';
         body += '<ObjDevice>' +
            ((aDetails.device == null) ? '' : aDetails.device) +
            '</ObjDevice>';
         if (aDetails.hasOwnProperty('description') &&
               (aDetails.description !== null)) {
            body += '<TxnDesc>' +
               this.encodeXml(encodeURIComponent(aDetails.description)) +
               '</TxnDesc>';
         }
         body += '<TxnPassword>' +
            this.encodeXml(encodeURIComponent(password)) + '</TxnPassword>';
         break;

      case this.TYPE_REPOSITORY_NO_INFO:
         method += 'scriptsharing';
         body += '<ObjDevice></ObjDevice><TxnPassword>' +
            this.encodeXml(encodeURIComponent(password)) + '</TxnPassword>';
         break;

      case this.TYPE_INSTANTTEST:
         if (aDetails == null) {
            this.m_logger.logFailure('uploadScript instant test called without details');
            return this.m_getMessage('deja_restapi_badsaveparams');
         }
         method += 'instanttest';
         body += '<ObjDevice></ObjDevice>';
         for (key in this.TOD_OPTIONS) {
            if (this.TOD_OPTIONS.hasOwnProperty(key) &&
                this.hasOwnProperty.call(aDetails, key)) {
               body += '<' + this.TOD_OPTIONS[key] + '>' +
                  this.encodeXml(aDetails[key]) +
                  '</' + this.TOD_OPTIONS[key] + '>';
            }
         }
         break;

      default:
         this.m_logger.logFailure('uploadScript called with bad transaction type');
         return this.m_getMessage('deja_restapi_badsaveparams');
      }

      if ((aDetails == null) || (aDetails.name == null)) {
         body += '<TxnName></TxnName>';
      } else {
         body += '<TxnName>' + this.encodeXml(encodeURIComponent(aDetails.name)) + '</TxnName>';
      }
      body += '</TxnHeader></Request></TxnHeader><TxnXML>' + scriptString +
         '</TxnXML>' + this.m_sourceString + '</Upload>';

      if ((aType === this.TYPE_REPOSITORY) ||
            (aType === this.TYPE_REPOSITORY_NO_INFO)) {
         result = this.sendRequest(method, body,
            this.handleUploadResponse.bind(this, aCallback),
            String(this.m_prefService.getPrefOption(
               'DC_OPTID_SCRIPTSHARE_RESTENDPOINT')));

      } else if ((aType === this.TYPE_INSTANTTEST) &&
            (this.m_session.customerId.length === 0)) {
         result = this.sendRequest(method, body,
            this.handleUploadResponse.bind(this, aCallback),
            String(this.m_prefService.getPrefOption(
               'DC_OPTID_INSTANTTEST_RESTENDPOINT')));

      } else {
         result = this.sendRequest(method, body,
            this.handleUploadResponse.bind(this, aCallback));
      }
      return result;
   },

   /**
    * Process a response to an asynchronous upload script request.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {function(string, string)} aCallback Function to which
    *    the result of the upload is passed. On success, an empty
    *    string and a URL to display are passed. On failure, a
    *    description of the error is passed.
    * @param {string} aError The result of the upload script
    *    operation. An empty string if successful. An error message if
    *    not.
    * @param {Element=} opt_response The Response element returned in
    *    reply to a upload script request.
    */
   handleUploadResponse: function (aCallback, aError, opt_response) {
      var url, result, eltList;

      url = '';
      if (opt_response == null) {
         result = (aError.length === 0) ? 'Script upload failed' : aError;

      } else {
         result = this.getResponseErrorMessage(opt_response,
            'deja_restapi_remotesaveerror', false);

         if (result.length === 0) {
            this.updateResponseData(opt_response);

            this.m_logger.logInfo('Script upload successful ' +
               '(Session ID: ' + this.m_session.sessionId +
               ', Customer ID: ' + this.m_session.customerId +
               ', Account ID: ' + this.m_session.accountId + ')');

            eltList = opt_response.getElementsByTagName('RedirectURL');
            url = (eltList.length === 0) ? '' :
               /** @type {!Element} */ (eltList[0]).textContent;
         }
      }
      aCallback(result, url);
   },

   /**
    * Cancel the current asynchronous operation, if any.
    * No callbacks will occur, although the dejaclick:restapi event
    * will be triggered
    * @this {!DejaClick.RestApi}
    */
   abortRequest: function () {
      var xhr = this.m_xhr;
      this.m_window.clearTimeout(this.m_timer);
      this.m_timer = null;
      this.m_xhr = null;
      if (xhr !== null) {
         xhr.abort();
         this.notify(false);
      }
   },

   /**
    * Check that the RestApi is in a valid state to issue a new request.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {string} aRequest Name of the request to be issued.
    * @return {string} The empty string if the state is valid.
    *    An error string if not.
    */
   checkValidState: function (aRequest) {
      var result;

      if (this.m_session == null) {
         this.m_logger.logFailure(aRequest + ' called without active session.');
         result = this.m_getMessage('deja_restapi_invalidsession');

      } else if (this.m_xhr !== null) {
         this.m_logger.logFailure(aRequest + ' called during another request.');
         result = this.m_getMessage('deja_restapi_restapimultiple');

      } else if (this.m_session.sessionId.length === 0) {
         this.m_logger.logFailure(aRequest + ' called without session id.');
         result = this.m_getMessage('deja_restapi_invalidsession');

      } else if (this.m_session.login.length === 0) {
         this.m_logger.logFailure(aRequest + ' called without login.');
         result = this.m_getMessage('deja_restapi_invalidsession');

      } else if ((this.m_session.customerId.length === 0) &&
            (this.m_session.accountId.length === 0)) {
         this.m_logger.logFailure(aRequest + ' called without customer ID.');
         result = this.m_getMessage('deja_restapi_invalidsession');

      } else {
         result = '';
      }
      return result;
   },

   /**
    * Regular expression to extract important pieces of a URL.
    * @private
    * @const
    */
   URL_REGEXP: /^(\w+:\/*)?([\w+\.]+)(?::\d+)?\/([^\?#]*)(?:\?[^#]+)?(?:#.+)?/,

   /**
    * Asynchronously send a request to the REST service.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {string} aMethod The REST method to invoke. This is
    *    appended to the URL.
    * @param {string} aBody The body of the message to send.
    * @param {function(string, Element=)} aCallback Function to handle
    *    the response. If successful, an empty string and the Response
    *    element of the reply will be passed to the callback. If an
    *    invalid response is received, only a description of the error
    *    will be passed.
    * @param {string=} opt_url URL of the request. If not specified,
    *    the DC_OPTID_RESTENDPOINT preference will be used for the URL.
    * @return {string} Empty string if successful. Otherwise, text
    *    describing the error.
    */
   sendRequest: function (aMethod, aBody, aCallback, opt_url) {
      var url, match;

      if (opt_url == null) {
         match = this.URL_REGEXP.exec(this.m_prefService.getPrefOption(
            'DC_OPTID_RESTENDPOINT'));
         if (match !== null) {
            url = (match[1] || 'http://') + match[2] + '/' + match[3];
         } else {
            return this.m_logger.logFailure('Error parsing REST URL: ' + url);
         }

      } else {
         url = opt_url;
      }
      url += aMethod;

      this.m_xhr = new this.m_window.XMLHttpRequest();
      try {
         this.m_xhr.open('POST', url, true);
         this.m_xhr.onreadystatechange = this.handleResponse.bind(this,
            this.m_xhr, url, aCallback);
         this.m_xhr.setRequestHeader('Content-Type', 'text/xml; charset=UTF-8');
         this.m_xhr.send(aBody);
         this.m_timer = this.m_window.setTimeout(this.timeoutResponse.bind(this,
            this.m_xhr, url, aCallback),
            Number(this.m_prefService.
               getPrefOption('DC_OPTID_RESTAPITIMEOUT')));
         this.notify(true);

      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
         this.m_xhr.abort();
      }
      return '';
   },
   
   
   /**
    * Checks if the domain of 2 urls matches or not
    * @this {!DejaClick.RestApi}
    * @param {string} First URL to compare
    * @param {string} Second URL to compare
    * @return {bool} true if it matches. Otherwise, false
    */   
   isMatchingDomain: function(aUrl1, aUrl2) {
       var match1 = this.URL_REGEXP.exec(aUrl1);	
       var match2 = this.URL_REGEXP.exec(aUrl2);
       if (match1 !== null && match2 !== null) {
		   var domain1 = match1[1] + match1[2];
		   var domain2 = match2[1] + match2[2];
		   if (domain1 === domain2) {
			   return true;
		   }
	   }
	   return false;
   },

   /**
    * Process a response to an asynchronous request and dispatch it
    * to the correct message handler.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {!XMLHttpRequest} aXhr The request object.
    * @param {string} aUrl The URL for the request.
    * @param {function(string, Element=)} aCallback Function to handle
    *    the response. If successful, an empty string and the Response
    *    element of the reply will be passed to the callback. If an
    *    invalid response is received, only a description of the error
    *    will be passed.
    */
   handleResponse: function (aXhr, aUrl, aCallback) {
      var error, response;
      if ((aXhr === this.m_xhr) && (aXhr.readyState === 4)) {
         // XMLHttpRequest.DONE == 4
         try {
            this.m_xhr = null;
            this.m_window.clearTimeout(this.m_timer);
            this.m_timer = null;

            error = '';
            if (aXhr.status !== 200) {
               error = this.getFailureMessage(aXhr, aUrl, aXhr.responseText);

            } else if (aXhr.responseXML == null) {
               error = this.getFailureMessage(aXhr, aUrl,
                  'No XML response received.');

            } else {
               response = aXhr.responseXML.documentElement;
               if ((response == null) || (response.tagName !== 'Response')) {
                  error = this.getFailureMessage(aXhr, aUrl,
                     'No Response element found.');
                  response = null;
               }
            }
         } catch (/** @type {!Error} */ ex) {
            error = this.m_logger.logException(ex);
            response = null;
         }
         if (response == null) {
            this.m_session = null;
            aCallback(error);
         } else {
            aCallback('', response);
         }
         this.notify(false);
      }
   },

   /**
    * Abort an asynchronous operation that has taken too long.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {!XMLHttpRequest} aXhr The request to be aborted.
    * @param {string} aUrl The URL for the request.
    * @param {function(string, Element=)} aCallback Function to handle
    *    the result of the operation. It is passed a message stating
    *    that the request took too long.
    */
   timeoutResponse: function (aXhr, aUrl, aCallback) {
      var error;
      this.m_timer = null;
      if (aXhr === this.m_xhr) {
         try {
            this.m_xhr = null;
            aXhr.abort();
            error = this.getFailureMessage(aXhr, aUrl,
               'REST service took too long to respond.');
         } catch (/** @type {!Error} */ ex) {
            error = this.m_logger.logException(ex);
         }
         this.m_session = null;
         aCallback(error);
         this.notify(false);
      }
   },

   /**
    * Get a message describing an invalid response from the REST service.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {!XMLHttpRequest} aXhr The request object.
    * @param {string} aUrl The URL for the request.
    * @param {string} aMessage Description of the error.
    * @return {string} Message describing the communication error.
    */
   getFailureMessage: function (aXhr, aUrl, aMessage) {
      var failure, status, url;

      failure = (aMessage.length !== 0) ? aMessage :
         'Unable to communicate with remote server.';
      status = (aXhr.statusText.length !== 0) ? aXhr.statusText :
         '(response status unavailable)';
      url = (aUrl.length !== 0) ? aUrl : '(target URL unavailable)';
      return this.m_logger.logFailure('REST Service Failure (logging off):' +
         '\n   Failure Message:  ' + failure +
         '\n   Response Status:  ' + aXhr.status + ' ' + status +
         '\n        Target URL:  ' + url);
   },

   /**
    * Collection of status related elements within the Response
    * element of a REST reply.
    * @private
    * @const
    */
   RESPONSE_STATUS_TAGS: {
      Status: 'status',
      Message: 'message'
   },

   /**
    * Collection of REST response status codes that indicate a non-fatal error.
    * @private
    * @const
    */
   NON_FATAL_STATUS_CODES: {
      2: true,
      4: true,
      48: true,
      50: true,
      51: true,
      53: true,
      54: true,
      55: true
   },

   /**
    * Get a text message describing an error returned by the REST
    * service. Also terminate session for fatal errors.
    * @private
    * @this {!DejaClick.RestApi}
    * @param {!Element} aResponse The Response element returned by the
    *    REST service.
    * @param {string} aMessage Name of localizable message describing
    *    the request.
    * @param {boolean} aIgnoreErrors If true, do not terminate the
    *    session for fatal errors.
    * @return {string} Empty string aResponse is successful. A message
    *    describing the error if not.
    */
   getResponseErrorMessage: function (aResponse, aMessage, aIgnoreErrors) {
      var result, details, statusNum, fatal, message;

      result = '';
      details = /** @type {!{status:string,message:string}} */
         (this.getChildTextValues(aResponse, this.RESPONSE_STATUS_TAGS,
            { status: '-1', message: '' }));
      statusNum = Number(details.status);
      if ((details.status === '') || (statusNum !== 0)) {
         fatal = !aIgnoreErrors && !this.hasOwnProperty.call(
            this.NON_FATAL_STATUS_CODES,
            details.status);

         if (fatal) {
            this.m_session = null;
         }

         message = 'Remote REST request failed (Code: ' +
            details.status + ', Reason: ' +
            details.message;
         this.m_logger.logFailure(message + ', Request: ' + aMessage + ')');
         if (statusNum > 0) {
            result = this.m_getMessage('deja_restapi_error' +
               details.status);
            if (result.length === 0) {
               if (fatal) {
                  result = this.m_getMessage('deja_restapi_errorFatal');
               } else {
                  result = this.m_getMessage('deja_restapi_errorSkip');
               }
            }

         } else {
            result = this.m_getMessage(aMessage);
         }
         result += '\n\n' + message + ')';
      }
      return result;
   },

   /**
    * Map from useful element tags in REST API response to property names
    * of this.m_session.
    * @private
    * @const
    */
   RESPONSE_TAGS: {
      SessionID: 'sessionId',
      // ObjDevice
      AccountID: 'accountId',
      ObjCust: 'objCust',
      // ObjParent
      Login: 'login',
      Custid: 'customerId',
      Company: 'company',
      // CurrPlan
      // CurrInterval
      AvailablePlans: 'availablePlans',
	  
      DashboardURL: 'dashboardURL',
	  ReportURL: 'reportURL'
      // BrowserList
      // TxnList
      // TxnOut
      // LocationList
   },

   /**
    * Copy the important data returned with the response into the
    * session record.
    * @this {!DejaClick.RestApi}
    * @param {!Element} aResponse The Response element of a REST reply.
    */
   updateResponseData: function (aResponse) {
      if (this.m_session !== null) {
         this.getChildTextValues(aResponse, this.RESPONSE_TAGS, this.m_session);
      }
   },

   /**
    * Extract the text content of several specific child elements of a
    * DOM Element.
    * @private
    * @param {!Element} aElement The element whose child are to be examined.
    * @param {!Object.<string,string>} aTags A collection of names of
    *    tags to be extracted mapped to the name of the property of
    *    aContainer to which the child's text content should be
    *    assigned.
    * @param {!Object.<string,string>} aContainer Map from name to
    *    child element value. This will be updated with the values
    *    found in the children of aElement.
    * @return {!Object.<string,string>} aContainer.
    */
   getChildTextValues: function (aElement, aTags, aContainer) {
      var child;
      for (child = aElement.firstElementChild;
            child !== null;
            child = child.nextElementSibling) {
         if ((child.textContent.length !== 0) &&
               this.hasOwnProperty.call(aTags, child.tagName)) {
            aContainer[aTags[child.tagName]] = child.textContent;
         }
      }
      return aContainer;
   },

   /**
    * Builds an object with all the browser information from the XML element returned by the API.
    * 
    * Also including the list of possible versions of browsers (if available)
    * 
    * Function introduced with UXM-12145
    * 
    * @param {*} aElement 
    * @param {*} aContainer 
    */
   getBrowserInfo: function (aElement, aContainer) {
      var result = this.getChildTextValues(aElement, this.BROWSER_TAGS, aContainer);


      let eltList = aElement.getElementsByTagName('MonitorAgent');
      if ( eltList && eltList.length > 0 ) {
         result.versions = [];
         for (let index = 0; index !== eltList.length; ++index) {
            result.versions.push({
                  value: eltList[index].getAttribute('Value'),
                  label: eltList[index].getAttribute('Label')
               }
               );
         }
      } else {
         result.versions = null;
      }
      
      return result;
   },

   /**
    * Notify observers of the current REST state.
    * @param {boolean} aActive True if an asynchronous operation is being
    *    processed.
    * @this {!DejaClick.RestApi}
    */
   notify: function (aActive) {
      this.m_observerService.notifyLocalObservers('dejaclick:restapi', {
         active: aActive,
         connected: (this.m_session !== null)
      });
   },

   /**
    * Regular expression to match characters that need to be encoded
    * in the REST API.
    * @const
    */
   TO_ESCAPE_REGEXP: /[&<>\u00e0\u00e9]/g,

   /**
    * Encoding for characters in the REST API XML.
    * @const
    * @type {!Object.<string,string>}
    */
   ENCODE_MAP: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\u00e0': 'a',
      '\u00e9': 'e'
   },

   /**
    * Replace a character with an encoded version of the character.
    * @param {string} plain The unencoded character
    * @return {string} The encoded version of the character.
    */
   encodeInvalidChar: function(plain) {
      return this.ENCODE_MAP.hasOwnProperty(plain) ? this.ENCODE_MAP[plain] :
         plain;
   },

   /**
    * Encode all characters within a string to meet restrictions for
    * XML text values.
    * @this {!DejaClick.RestApi}
    * @param {string} plain The string to be encoded.
    * @return {string} The encoded string.
    */
   encodeXml: function (plain) {
      return plain.replace(this.TO_ESCAPE_REGEXP, this.encodeInvalidChar);
   }
};
