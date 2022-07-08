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

/*
 * Dialog to upload a script to an AlertSite monitoring account.
 * Input: {?DejaClick.Encryption} Optional object used to encrypt
 *    the script before upload.
 * Output: {string} The URL to which the browser should navigate,
 *    or an empty string if upload was canceled.
 */

/*global window,DejaClickUi,$,document,DejaClick*/

'use strict';

/**
 * Preferred width of the upload dialog.
 * @const
 */
var preferredWidth = 450;
/**
 * Preferred height of the upload dialog.
 * @const
 */
var preferredHeight = 440;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = '';

/**
 * Class to encapsulate the functionality of the script upload dialog.
 * @constructor
 * @param {!DejaClick.Script} aScript The script to be uploaded.
 * @param {?DejaClick.Encryption} aEncryption Optional object to
 *    encrypt the script before uploading.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 */
DejaClickUi.Upload = function (aScript, aEncryption, aUtils, AEventRegistration,
      ADialogWindow) {
   var secure, timeouts, index, value;

   // Get references to frequently used background objects.
   this.script = aScript;
   this.encryption = aEncryption;
   this.logger = aUtils.logger;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;
   this.DialogWindow = ADialogWindow;
   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:restapi',
         this.restActivity, this);

   this.state = {
      freeAccount: false,
      submitting: false,
      dialog: null,
      browser: 'CH',
      browserVersion: '',
      browserVersionOptions: {}
   };

   // Initialize UI.
   this.elements = {
      customerIdLabel: $('#customerIdLabel'),
      customerIdValue: $('#customerIdValue'),
      customerNameLabel: $('#customerNameLabel'),
      customerNameValue: $('#customerNameValue'),
      transactionTypeSelect: $('#transactionTypeSelect'),

      monitorSection: $('#monitorSection'),
      createReplaceMonitorDiv: $('#createReplaceMonitorDiv'),
      replaceMonitorCheckbox: $('#replaceMonitorCheckbox'),
      replaceMonitorDiv: $('#replaceMonitorDiv'),
      transactionMonitorSelect: $('#transactionMonitorSelect'),
      addMonitorDiv: $('#addMonitorDiv'),
      transactionNameMonitorInput: $('#transactionNameMonitorInput'),
      planMonitorSelect: $('#planMonitorSelect'),
      intervalMonitorSelect: $('#intervalMonitorSelect'),
      timeoutMonitorSelect: $('#timeoutMonitorSelect'),
      browserVersionDiv: $('#browserVersionDiv'),
      browserMonitorSelect: $('#browserMonitorSelect'),
      browserVersionSelect: $('#browserVersionSelect'), //UXM-12145

      repositorySection: $('#repositorySection'),
      createReplaceRepositoryDiv: $('#createReplaceRepositoryDiv'),
      replaceRepositoryCheckbox: $('#replaceRepositoryCheckbox'),
      replaceRepositoryDiv: $('#replaceRepositoryDiv'),
      transactionRepositorySelect: $('#transactionRepositorySelect'),
      addRepositoryDiv: $('#addRepositoryDiv'),
      nameRepositoryInput: $('#nameRepositoryInput'),
      descriptionRepositoryInput: $('#descriptionRepositoryInput'),

      changeUserButton: $('#changeUserButton'),
      userIdValue: $('#userIdValue'),
      connectionButton: $('#connectionButton'),
      okButton: $('#okButton'),
      cancelButton: $('#cancelButton'),
      allInputs: $('input'),
      allSelects: $('select'),
      allButtons: $('button')
   };
   this.elements.transactionTypeSelect.parent().hide();

   aUtils.localizeTree(document.documentElement, 'deja_');

   // Optionally enable the change user button.
   if (aUtils.prefService.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
      this.elements.changeUserButton.on('click', this.changeUser.bind(this)).
         text(this.getMessage('deja_upload_changeUser'));
   } else {
      this.elements.changeUserButton.off('click');
   }
   this.elements.changeUserButton.button({
      text: false,
      icons: { primary: 'changeuser-icon  icon-user' }
   });

   // Display whether the AlertSite session is secured.
   secure = /https:\/\//.test(this.restApi.getEndpoint());
   this.elements.connectionButton.
      addClass(secure ? 'secure' : 'insecure').
      text(this.getMessage(secure ? 'deja_upload_secureConnection' :
         'deja_upload_insecureConnection')).
      button({
         text: false,
         icons: { primary: 'lock-icon' }
      }).
      off('click');

   // Populate the timeouts options.
   timeouts = [ 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30,
      45, 60, 75, 90, 120, 150, 180, 240, 300 ];
   for (index = 0; index < timeouts.length; ++index) {
      value = String(timeouts[index]);
      this.elements.timeoutMonitorSelect.
         append($(document.createElement('option')).
            attr('value', value).
            text(this.getMessage('deja_upload_timeoutValue', value)));
   }
   this.elements.timeoutMonitorSelect.val('30');

   // Register other event handlers.
   this.elements.okButton.button().on('click', this.uploadScript.bind(this));
   this.elements.cancelButton.button().
      on('click', this.cancelDialog.bind(this));
   this.elements.transactionTypeSelect.on('change',
      this.changeTransactionType.bind(this));
   this.elements.planMonitorSelect.on('change',
      this.displayMonitorIntervals.bind(this));
   this.elements.replaceRepositoryCheckbox.on('change',
      this.displayScriptDescription.bind(this));
   this.elements.transactionRepositorySelect.on('change',
      this.displayScriptDescription.bind(this));
   this.elements.allSelects.on('change', this.changeInput.bind(this));
   this.elements.allInputs.on('change input', this.changeInput.bind(this));
   this.elements.browserMonitorSelect.on('change', this.updateBrowserVersionOptions.bind(this)); //UXM-12145
   this.elements.transactionMonitorSelect.on('change', this.updateTransactionBrowserOptions.bind(this)); //UXM-12145
   this.elements.replaceMonitorCheckbox.on('change', this.updateTransactionBrowserOptions.bind(this)); //UXM-12145

   this.displayUserInfo();
   this.enableControls();
};

DejaClickUi.Upload.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Upload,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * dialog.
    * @this {!DejaClickUi.Upload}
    */
   close: function () {
      if (this.hasOwnProperty('state')) {
         if (this.state.submitting && this.hasOwnProperty('restApi')) {
            this.state.submitting = false;
            this.restApi.abortRequest();
         }

         if (this.state.dialog !== null) {
            this.state.dialog.close();
            this.state.dialog = null;
         }
      }

      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allSelects.off('change');
         this.elements.allInputs.off('change input');
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.elements;
      delete this.state;
      delete this.events;
      delete this.DialogWindow;
      delete this.getMessage;
      delete this.restApi;
      delete this.logger;
      delete this.script;
   },

   /**
    * Detect and respond to REST API activity.
    * Called in response to the dejaclick:restapi event.
    * @this {!DejaClickUi.Upload}
    * @param {!{active:boolean, connected:boolean}} aData Whether the
    *    REST API is active and connected.
    */
   restActivity: function (aData) {
      try {
         if (!aData.connected) {
            DejaClick.service.__modal.close();
         } else {
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Respond to a change in the selected transaction type. Download the
    * list of transactions for that type.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} A jQuery change event on the transaction type
    *    select element.
    */
   changeTransactionType: function (aEvent) {
      try {
         this.getTransactions();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * List of allowed monitoring intervals (in seconds).
    * @const
    */
   PLAN_INTERVALS: [ 5, 10, 15, 20, 30, 60, 120 ],

   /**
    * Populate the UI with the intervals at which the transaction
    * may be monitored.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} A jQuery change event on the plan select element.
    */
   displayMonitorIntervals: function (aEvent) {
      var intervals, planOptions, minInterval, index, interval;

      try {
         intervals = this.elements.intervalMonitorSelect.empty();
         planOptions = this.elements.planMonitorSelect.prop('selectedOptions');
         if (planOptions.length !== 0) {
            minInterval = Number(planOptions[0].getAttribute('dcmininterval'));
            if (planOptions[0].value === 'TXNDEMO') {
               if (minInterval <= 120) {
                  intervals.append($(document.createElement('option')).
                     attr('value', '120').
                     text(this.getMessage('deja_upload_intervalValue', '120')));
               }
            } else {
               for (index = 0; index < this.PLAN_INTERVALS.length; ++index) {
                  interval = this.PLAN_INTERVALS[index];
                  if (interval >= minInterval) {
                     intervals.append($(document.createElement('option')).
                        attr('value', String(interval)).
                        text(this.getMessage('deja_upload_intervalValue',
                           String(interval))));
                  }
               }
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display the description for the selected script from the script
    * repository.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} A jQuery change event on the replace script checkbox
    *    or the change script description select element.
    */
   displayScriptDescription: function (aEvent) {
      var options;

      try {
         options = this.elements.transactionRepositorySelect.
            prop('selectedOptions');
         if (!this.elements.replaceRepositoryCheckbox.prop('checked') ||
               (options.length === 0)) {
            this.elements.descriptionRepositoryInput.val('');
         } else {
            this.elements.descriptionRepositoryInput.val(
               options[0].getAttribute('dctxndesc'));
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable UI widgets based upon new input.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} A jQuery change or input event on any select or
    *    input element.
    */
   changeInput: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to request a different user identity.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} aEvent A jQuery click event on the change user icon.
    */
   changeUser: function (aEvent) {
      try {
         if (this.state.dialog == null) {
            this.state.dialog = new this.DialogWindow(
               'ui/content/dejaChangeUser.html',
               null,
               null,
               this.completeChangeUser.bind(this),
               this.logger);
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Center the dialog over the upload window.
    * @this {!DejaClickUi.Upload}
    * @param {!DejaClick.DialogWindow} aDialog The dialog window to be centered.
    */
   centerDialog: function (aDialog) {
      try {
         aDialog.centerOn(window);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Complete an asynchronous operation to change the effective user
    * of the current AlertSite session.
    * @this {!DejaClickUi.Upload}
    */
   completeChangeUser: function () {
      try {
         this.state.dialog = null;
         this.displayUserInfo();
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously upload the transaction to the AlertSite
    * monitoring account.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   uploadScript: function (aEvent) {
      var type, details, error, message;

      try {
         type = this.restApi[this.elements.transactionTypeSelect.val()];

         switch (type) {
         case this.restApi.TYPE_MONITOR:
            details = this.getMonitorUploadDetails();
            break;

         case this.restApi.TYPE_REPOSITORY:
            details = this.getRepositoryUploadDetails();
            break;

         default:
            this.logger.logFailure('Invalid transaction type ' +
               this.elements.transactionTypeSelect.val() +
               ' in uploadScript');
            details = null;
            break;
         }
         if (details == null) {
            return;
         }

         error = this.script.isUploadable();
         if(error && error.length !== 0) {
            message = this.getMessage(error);
            if (error === "dcMessage_unverifiedScript") {
               window.alert(message);
               DejaClick.service.__modal.close();
               return;
            }
            else {
               if (!window.confirm(message)) {
                  return;
               }
            }
         }

         error = this.restApi.uploadScript(this.script, type, details,
            this.encryption,
            this.completeUploadScript.bind(this));
         if (error.length !== 0) {
            window.alert(error);
            DejaClick.service.__modal.close();
         } else {
            this.state.submitting = true;
         }

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Get the details needed to upload a transaction to be monitored.
    * @this {!DejaClickUi.Upload}
    * @return {?Object} The details to pass to restApi.uploadScript
    *    or null if the upload should be aborted.
    */
   getMonitorUploadDetails: function () {
      var details, selected, maxSteps;

      details = null;
      if (this.elements.replaceMonitorCheckbox.prop('checked')) {
         selected = this.elements.transactionMonitorSelect.
            prop('selectedOptions');
         if (selected.length === 0) {
            window.alert(this.getMessage(
               'deja_upload_selectTransactionToReplace'));

         } else if (this.elements.browserMonitorSelect.val() == null || this.elements.browserVersionSelect.val() == null) {
            window.alert(this.getMessage('deja_upload_selectMonitoringBrowser'));
         } else {
            maxSteps = Number(selected[0].getAttribute('dcmaxsteps'));
            details = {
               name: selected[0].textContent,
               device: selected[0].getAttribute('value'),
               
            };
            if ( selected[0].hasAttribute('browser') ) {
               //Update the browser version just if the option is available.
               details.browser = this.elements.browserMonitorSelect.val();
               details.browserVersion = this.elements.browserVersionSelect.val();
            }
         }

      } else if (this.elements.transactionNameMonitorInput.val().length === 0) {
         window.alert(this.getMessage('deja_upload_enterTransactionName'));

      } else if (this.elements.planMonitorSelect.val() == null) {
         window.alert(this.getMessage('deja_upload_selectPlanCode'));

      } else if (this.elements.intervalMonitorSelect.val() == null) {
         window.alert(this.getMessage('deja_upload_selectMonitoringInterval'));

      } else if (this.elements.timeoutMonitorSelect.val() == null) {
         window.alert(this.getMessage('deja_upload_selectMonitoringTimeout'));

      } else if (this.elements.browserMonitorSelect.val() == null || this.elements.browserVersionSelect.val() == null) {
         window.alert(this.getMessage('deja_upload_selectMonitoringBrowser'));

      } else {
         maxSteps = Number(this.elements.planMonitorSelect.
            prop('selectedOptions')[0].getAttribute('dcmaxsteps'));
         details = {
            name: this.elements.transactionNameMonitorInput.val(),
            plan: this.elements.planMonitorSelect.val(),
            monitor: 'y',
            interval: this.elements.intervalMonitorSelect.val(),
            timeout: this.elements.timeoutMonitorSelect.val(),
            browser: this.elements.browserMonitorSelect.val(),
            browserVersion: this.elements.browserVersionSelect.val()
         };
      }
      if ((details !== null) &&
            (maxSteps !== 0) &&
            (this.script.getTotalActionCount() > maxSteps) &&
            !window.confirm(this.getMessage(
               'deja_upload_warnMaxStepsUpload'))) {
         details = null;
      }
      return details;
   },

   /**
    * Get the details needed to upload a transaction to the script repository.
    * @this {!DejaClickUi.Upload}
    * @return {?Object} The details to pass to restApi.uploadScript
    *    or null if the upload should be aborted.
    */
   getRepositoryUploadDetails: function () {
      var selected, details;

      if (this.elements.replaceRepositoryCheckbox.prop('checked')) {
         selected = this.elements.transactionRepositorySelect.
            prop('selectedOptions');
         if (selected.length === 0) {
            window.alert(this.getMessage('deja_upload_selectScriptReplace'));
            return null;
         }
         details = {
            name: selected[0].textContent,
            device: selected[0].getAttribute('value'),
            browser: this.elements.browserMonitorSelect.val(),
            browserVersion: this.elements.browserVersionSelect.val()
         };

      } else if (this.elements.nameRepositoryInput.val().length === 0) {
         window.alert(this.getMessage('deja_upload_enterScriptName'));
         return null;

      } else {
         details = {
            name: this.elements.nameRepositoryInput.val(),
            device: ''
         };
      }
      details.description = this.elements.descriptionRepositoryInput.val();
      return details;
   },

   /**
    * Handle the completion of uploading a script to AlertSite.
    * @this {!DejaClickUi.Upload}
    * @param {string} aError The empty string if successful. An error
    *    message if not.
    * @param {string} aUrl A URL for the upload result or an empty string.
    */
   completeUploadScript: function (aError, aUrl) {
      try {
         if (aError.length !== 0) {
            window.alert(aError);
         } else {
            window.returnValue = aUrl;
            if (aUrl.length === 0) {
               window.alert(this.getMessage('deja_upload_uploadComplete',
                  String(this.script.getTotalEventCount())));
            }
            DejaClick.service.__modal.close(window.returnValue);
         }
         
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window and cancel the Test-on-Demand.
    * @this {!DejaClickUi.Upload}
    * @param {!Event} aEvent A jQuery click event on the Cancel button.
    */
   cancelDialog: function (aEvent) {
      try {
         DejaClick.service.__modal.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display the current effective user information.
    * Also request the transaction list if the user has changed.
    * @this {!DejaClickUi.Upload}
    */
   displayUserInfo: function () {
      var userId, userIdElement, accountId, realUserId, plans, index, plan;

      userId = this.restApi.getLogin();
      userIdElement = this.elements.userIdValue;
      if (userIdElement.text() !== userId) {
         // The user has changed. Update the display.
         accountId = this.restApi.getAccountId();
         if (accountId.length !== 0) {
            this.elements.customerIdLabel.
               text(this.getMessage('deja_upload_accountIdLabel'));
            this.elements.customerIdValue.text(accountId);
            this.elements.customerNameLabel.
               text(this.getMessage('deja_upload_accountTypeLabel'));
            this.elements.customerNameValue.
               text(this.getMessage('deja_upload_accountTypeFree'));
            this.state.freeAccount = true;

         } else {
            this.elements.customerIdLabel.
               text(this.getMessage('deja_upload_customerIdLabel'));
            this.elements.customerIdValue.text(this.restApi.getCustomerId());
            this.elements.customerNameLabel.
               text(this.getMessage('deja_upload_customerNameLabel'));
            this.elements.customerNameValue.text(this.restApi.getCompany());
            this.state.freeAccount = false;
         }
         userIdElement.text(userId);
         realUserId = this.restApi.getRealLogin();
         if (userId === realUserId) {
            userIdElement.removeAttr('title');
         } else {
            userIdElement.attr('title',
               this.getMessage('deja_upload_realuser') + realUserId);
         }

         plans = this.restApi.getAvailablePlans();
         this.elements.planMonitorSelect.empty();
         for (index = 0; index < plans.length; ++index) {
            plan = plans[index];
            this.elements.planMonitorSelect.
               append($(document.createElement('option')).
                  attr('value', plan.name).
                  attr('dcmininterval', String(plan.minInterval)).
                  attr('dcmaxsteps', String(plan.maxSteps)).
                  text(plan.name));
         }
         this.displayMonitorIntervals();

         this.getTransactions();
      }
   },

   /**
    * Asynchronously request a list of transactions of the selected type.
    * @this {!DejaClickUi.Upload}
    */
   getTransactions: function () {
      var type, txnList, error;

      if (this.restApi.isActive()) {
         this.restApi.abortRequest();
         this.state.submitting = false;
      }
      type = this.restApi[this.elements.transactionTypeSelect.val()];
      switch (type) {
      case this.restApi.TYPE_MONITOR:
         txnList = this.elements.transactionMonitorSelect;
         this.elements.browserMonitorSelect.empty().
            append($(document.createElement('option')).
               text(this.getMessage('deja_upload_loading')));
         break;

      case this.restApi.TYPE_REPOSITORY:
         txnList = this.elements.transactionRepositorySelect;
         break;

      default:
         this.logger.logFailure('Invalid transaction type ' + type +
            ' in getTransactions');
         return;
      }

      txnList.empty().append($(document.createElement('option')).
         text(this.getMessage('deja_upload_loadingTransactions')));
      error = this.restApi.listTransactions(type,
         this.displayTransactions.bind(this));
      if (error.length !== 0) {
         window.alert(error);
         DejaClick.service.__modal.close();
      } else {
         this.state.submitting = true;
      }
   },

   /**
    * Populate the current list of transactions with the results of the
    * asynchronous REST request.
    * @this {!DejaClickUi.Upload}
    * @param {string} aError An empty string if the list request was
    *    successful. An error message if not.
    * @param {!Array.<!{type:string, description:string}>} aBrowsers
    *    A list of browser types available to the current user.
    * @param {!Array.<!{
    *    name:string,
    *    description:string,
    *    objDevice:string,
    *    maxSteps:integer
    * }>)} aTransactions The list of transactions of the given type.
    */
   displayTransactions: function (aError, aBrowsers, aTransactions) {
      var selectElt, optionElt, index, transaction;
      try {
         this.state.submitting = false;
         if (aError.length !== 0) {
            window.alert(aError);
            DejaClick.service.__modal.close();
            return;
         }
         switch (this.elements.transactionTypeSelect.val()) {
         case 'TYPE_MONITOR':
            // Display browser information.
            selectElt = this.elements.browserMonitorSelect;
            selectElt.empty();
            this.state.browserVersionOptions = {};
            for (index = 0; index < aBrowsers.length; ++index) {
               if (aBrowsers[index].type.length !== 0 
                  && aBrowsers[index].description 
                  && ! aBrowsers[index].description.toLowerCase().includes("internet explorer")) //UXM-11952 - Temporary workaround to exclude IE monitor creation/TOD
               {
                  optionElt = $(document.createElement('option')).
                     attr('value', aBrowsers[index].type).
                     text(aBrowsers[index].description);
                  selectElt.append(optionElt);

                  if ( aBrowsers[index].versions ) {
                     this.state.browserVersionOptions[aBrowsers[index].type] = aBrowsers[index].versions;
                  } else {
                     //If versions are not available. Let's include the "Default" option
                     this.state.browserVersionOptions[aBrowsers[index].type] = [
                        {
                           value: '',
                           label: 'Default'
                        }];
                  }
               } else if ( aBrowsers[index].description && aBrowsers[index].description.toLowerCase().includes("internet explorer") ) {
                  this.logger.logDebug("UXM-11952 [Temporary fix] Just allow Chrome & Firefox replay engines. Discarded: ["+aBrowsers[index].type+"] "+aBrowsers[index].description);
               } else{
                  this.logger.logWarning("Empty browser info received!!");
               }
            }

            var browser = 'CH';

            if(typeof InstallTrigger !== 'undefined'){
               browser = 'FF';
            }
            selectElt.val(browser);

            if (selectElt.val() == null) {
               selectElt.prop('selectedIndex', 0);
            }

            //Update the browser version list.
            this.updateBrowserVersionOptions();


            selectElt = this.elements.transactionMonitorSelect;
            break;

         case 'TYPE_REPOSITORY':
            selectElt = this.elements.transactionRepositorySelect;
            break;

         default:
            this.logger.logFailure('Invalid transaction type ' +
               this.elements.transactionTypeSelect.val() +
               ' in displayTransactions');
            return;
         }

         selectElt.empty();
         for (index = 0; index < aTransactions.length; ++index) {
            transaction = aTransactions[index];
            if (transaction.objDevice.length !== 0) {
               selectElt.append($(document.createElement('option')).
                  attr('value', transaction.objDevice).
                  attr('title', transaction.name).
                  attr('dctxndesc', transaction.description).
                  attr('dcmaxsteps', String(transaction.maxSteps)).
                  attr('browser', String(transaction.browser)).
                  attr('browserVersion', String(transaction.browserVersion)).
                  text(transaction.name));
            }
         }

         selectElt.val(this.script.getMonitorId());
         if (selectElt.val() == null) {
            selectElt.prop('selectedIndex', 0);
         }
         this.updateTransactionBrowserOptions();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Updates the dropdown with the list of versions per browser.
    * 
    * If possible keep the previously selected value, if it is not possible
    * changes the selection to the first option in the list.
    * 
    * Function introduced at UXM-12145
    */
   updateBrowserVersionOptions: function() {
      try {

         var browserVal = this.elements.browserMonitorSelect.val();
         var selectVersionElt = this.elements.browserVersionSelect;
         selectVersionElt.empty();
         
         if ( this.state.browserVersionOptions[browserVal] ) {
            let options = this.state.browserVersionOptions[browserVal];
            for (let index = 0; index < options.length; ++index) {
               if ( browserVal != 'FF' ||
                  ( options[index].value != '' && options[index].value != 'Firefox 52' ) ) 
               {
                  let optionElt = $(document.createElement('option')).
                        attr('value', options[index].value).
                        text(options[index].label);
                  selectVersionElt.append(optionElt);
               } else {
                  this.logger.logDebug("UXM-11952 [Temporary fix] Firefox 52 is not allowed for replaying new recordings. Discarded option '"+options[index].label+"' ");
               }
            }
         } else {
            let optionElt = $(document.createElement('option')).
                     attr('value', '').
                     text('Default');
               selectVersionElt.append(optionElt);
         }

         selectVersionElt.val(this.state.browserVersion);
         if (selectVersionElt.val() == null) {
            selectVersionElt.prop('selectedIndex', 0);
         }
         
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Updates the selected value of browser and version to the current
    * value for that monitor in the platform.
    * 
    * Function introduced at UXM-12145
    */
   updateTransactionBrowserOptions: function() {
      try {
         if (this.elements.replaceMonitorCheckbox.prop('checked')) {
            var browser = $('option:selected', this.elements.transactionMonitorSelect).attr('browser');
            if ( browser ) {
               this.elements.browserVersionDiv.show();
               this.elements.browserMonitorSelect.attr('disabled', 'true');
               this.elements.browserVersionSelect.removeAttr('disabled');

               this.elements.browserMonitorSelect.val(browser);
               this.updateBrowserVersionOptions(); 
               var version = $('option:selected', this.elements.transactionMonitorSelect).attr('browserVersion');
               this.elements.browserVersionSelect.val(version);
               if (this.elements.browserVersionSelect.val() == null) {
                  this.elements.browserVersionSelect.prop('selectedIndex', 0);
               }
            } else {
               this.elements.browserVersionDiv.hide();
            }
         }
      } catch( ex ) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the UI controls based upon the current state.
    * @this {!DejaClickUi.Upload}
    */
   enableControls: function () {
      var enableOk;

      if (!this.restApi.isLoggedIn()) {
         DejaClick.service.__modal.close();
      } else if (this.state.dialog !== null) {
         this.elements.allButtons.button('option', 'disabled', true);
         this.elements.allSelects.attr('disabled', 'true');
         this.elements.allInputs.attr('disabled', 'true');

      } else {
         if (this.state.freeAccount) {
            this.elements.transactionTypeSelect.val('TYPE_REPOSITORY').
               attr('disabled', 'true');
         } else {
            this.elements.transactionTypeSelect.removeAttr('disabled');
         }

         this.elements.transactionTypeSelect.removeAttr('disabled');
         switch (this.elements.transactionTypeSelect.val()) {
         case 'TYPE_MONITOR':
            enableOk = this.enableMonitorControls();
            break;

         case 'TYPE_REPOSITORY':
            enableOk = this.enableRepositoryControls();
            break;

         default:
            this.logger.logFailure('Invalid transaction type ' +
               this.elements.transactionTypeSelect.val() +
               ' in enableControls');
            this.elements.monitorSection.hide();
            this.elements.repositorySection.hide();
            enableOk = false;
            break;
         }

         this.elements.changeUserButton.button('option', 'disabled', false);
         this.elements.connectionButton.button('option', 'disabled', false);
         this.elements.okButton.button('option', 'disabled',
            this.restApi.isActive() || !enableOk);
         this.elements.cancelButton.button('option', 'disabled', false);
      }
   },

   /**
    * Pattern matching names of INSITE plans.
    * @const
    */
   INSITE_PAT: /INSITE/i,

   /**
    * Enable or disable the monitoring upload UI controls based upon the
    * current dialog state.
    * @this {!DejaClickUi.Upload}
    * @return {boolean} true if the upload details have been fully
    *    specified.
    */
   enableMonitorControls: function () {
      var complete, planName;

      this.elements.monitorSection.show();
      this.elements.repositorySection.hide();

      this.elements.replaceMonitorCheckbox.removeAttr('disabled');
      if (this.elements.transactionMonitorSelect.prop('childElementCount') ===
            0) {
         this.elements.replaceMonitorCheckbox.prop('checked', false);
         this.elements.createReplaceMonitorDiv.hide();
      } else {
         this.elements.createReplaceMonitorDiv.show();
      }

      if (this.elements.replaceMonitorCheckbox.prop('checked')) {
         // Replacing a monitoring transaction.
         this.elements.replaceMonitorDiv.show();
         this.elements.addMonitorDiv.hide();
         //Hide browser version options if the browser into is not available.
         if ( ! $('option:selected', this.elements.transactionMonitorSelect).attr('browser') ) {
            this.elements.browserVersionDiv.hide();
         }
         this.elements.browserMonitorSelect.attr('disabled', 'true');
         if (this.restApi.isActive()) {
            complete = false;
            this.elements.transactionMonitorSelect.attr('disabled', 'true');
         } else {
            complete = (this.elements.transactionMonitorSelect.
               removeAttr('disabled').
               val() !== null);
         }

      } else {
         // Adding a new monitoring transaction.
         this.elements.replaceMonitorDiv.hide();
         this.elements.addMonitorDiv.show();
         this.elements.browserVersionDiv.show();
         this.elements.browserMonitorSelect.removeAttr('disabled');
         this.elements.transactionNameMonitorInput.removeAttr('disabled');
         this.elements.planMonitorSelect.removeAttr('disabled');
         this.elements.intervalMonitorSelect.removeAttr('disabled');
         this.elements.timeoutMonitorSelect.removeAttr('disabled');

         if (this.restApi.isActive()) {
            this.elements.browserMonitorSelect.attr('disabled', 'true');
            this.elements.browserVersionSelect.attr('disabled', 'true');
            complete = false;

         } else {

            this.elements.browserMonitorSelect.removeAttr('disabled');
            this.elements.browserVersionSelect.removeAttr('disabled');
            
            complete = (this.elements.planMonitorSelect.val() !== null) &&
               (this.elements.transactionNameMonitorInput.val().length !== 0) &&
               (this.elements.intervalMonitorSelect.val() !== null) &&
               (this.elements.timeoutMonitorSelect.val() !== null) &&
               (this.elements.browserMonitorSelect.val() !== null) &&
               (this.elements.browserVersionSelect.val() !== null);
         }
      }
      return complete;
   },

   /**
    * Enable or disable the script repository upload UI controls based
    * upon the current dialog state.
    * @this {!DejaClickUi.Upload}
    * @return {boolean} true if the upload details have been fully
    *    specified.
    */
   enableRepositoryControls: function () {
      var complete;

      this.elements.monitorSection.hide();
      this.elements.repositorySection.show();

      this.elements.replaceRepositoryCheckbox.removeAttr('disabled');
      if (this.elements.transactionRepositorySelect.prop('childElementCount') === 0) {
         this.elements.replaceRepositoryCheckbox.prop('checked', false);
         this.elements.createReplaceRepositoryDiv.hide();
      } else {
         this.elements.createReplaceRepositoryDiv.show();
      }

      if (this.elements.replaceRepositoryCheckbox.prop('checked')) {
         // Replacing a script repository transaction.
         this.elements.replaceRepositoryDiv.show();
         this.elements.addRepositoryDiv.hide();

         if (this.restApi.isActive()) {
            this.elements.transactionRepositorySelect.attr('disabled', 'true');
            complete = false;
         } else {
            complete = this.elements.transactionRepositorySelect.
               removeAttr('disabled').
               val() !== null;
         }

      } else {
         // Adding a new transaction to the script repository.
         this.elements.replaceRepositoryDiv.hide();
         this.elements.addRepositoryDiv.show();
         this.elements.nameRepositoryInput.removeAttr('disabled');
         complete = this.elements.nameRepositoryInput.val().length !== 0;
      }
      this.elements.descriptionRepositoryInput.removeAttr('disabled');
      return complete;
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('upload')) {
            DejaClickUi.upload.close();
            delete DejaClickUi.upload;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }


   /**
    * Create and initialize the Password instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.upload = new DejaClickUi.Upload(
            DejaClick.getScript(),
            DejaClick.service.__modal.arguments,
            DejaClick.utils,
            DejaClick.EventRegistration,
            DejaClick.DialogWindow);
         $(window).on('unload', unload);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
         DejaClick.service.__modal.setTitle('deja_sidebar_uploadItem');


      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (DejaClick.service.__modal) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
