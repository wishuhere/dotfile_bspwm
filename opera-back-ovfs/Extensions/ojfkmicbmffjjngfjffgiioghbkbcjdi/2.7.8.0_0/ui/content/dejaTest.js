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
 * Test-on-demand configuration dialog.
 * Configures options for Test-on-Demand.
 * Input: {} None
 * Output: {boolean} true if the configuration is successful, false if canceled.
 */

/*global window,DejaClickUi,$,document,DejaClick*/

'use strict';

/**
 * Preferred width of the test on demand dialog.
 * @const
 */
var preferredWidth = 500;
/**
 * Preferred height of the test on demand dialog.
 * @const
 */
var preferredHeight = 440;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = false;

/**
 * Class to encapsulate the functionality of the Test on Demand
 * configuration dialog.
 * @constructor
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
DejaClickUi.TestOnDemand = function (aUtils, AEventRegistration,
      ADialogWindow) {
   var secure, timeouts, index, value;

   // Get references to frequently used background objects.
   this.logger = aUtils.logger;
   this.prefService = aUtils.prefService;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;
   this.DialogWindow = ADialogWindow;
   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:restapi',
         this.restActivity, this);

   this.state = {
      browser: 'CH',
      browserVersion: '',
      location: '',
      userId: '',
      submitting: false,
      dialog: null,
      freeAccount: false,
      browserVersionOptions: {}
   };

   // Initialize the UI.
   this.elements = {
      customerIdLabel: $('#customerIdLabel'),
      customerIdValue: $('#customerIdValue'),
      customerNameLabel: $('#customerNameLabel'),
      customerNameValue: $('#customerNameValue'),
      browserSelect: $('#browserSelect'),
      browserVersionSelect: $('#browserVersionSelect'), //UXM-12145
      locationSelect: $('#locationSelect'),
      skipDialogCheckbox: $('#skipDialogCheckbox'),
      timeoutSelect: $('#timeoutSelect'),
      fullpageCheckbox: $('#fullpageCheckbox'),
      captureLevelSelect: $('#captureLevelSelect'),
      captureImagesCheckbox: $('#captureImagesCheckbox'),
      captureSourceCheckbox: $('#captureSourceCheckbox'),
      captureHeadersCheckbox: $('#captureHeadersCheckbox'),
      captureFormatJpeg: $('#captureFormatJpeg'),
      captureFormatPng: $('#captureFormatPng'),
      captureFormatAll: $('input[name="captureFormatRadio"]'),
      changeUserButton: $('#changeUserButton'),
      userIdValue: $('#userIdValue'),
      connectionButton: $('#connectionButton'),
      okButton: $('#okButton'),
      cancelButton: $('#cancelButton'),
      allButtons: $('button'),
      allSelects: $('select'),
      allInputs: $('input')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   // Allow change of effective user in diagnostic mode.
   if (this.prefService.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
      this.elements.changeUserButton.on('click', this.changeUser.bind(this)).
         text(this.getMessage('deja_test_changeUserHint'));
   } else {
      this.elements.changeUserButton.off('click');
   }
   this.elements.changeUserButton.button({
      text: false,
         icons: { primary: 'changeuser-icon icon-user-tod' }
   });

   // Indicate whether the AlertSite session is secure.
   secure = /https:\/\//.test(this.restApi.getEndpoint());
   this.elements.connectionButton.
      addClass(secure ? 'secure' : 'insecure').
      text(this.getMessage(secure ? 'deja_test_secureConnection'
         : 'deja_test_insecureConnection')).
      button({
         text: false,
         icons: { primary: 'lock-icon' }
      });

   // Populate the timeouts options.
   timeouts = [ 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300 ];
   for (index = 0; index < timeouts.length; ++index) {
      value = String(timeouts[index]);
      this.elements.timeoutSelect.append($(document.createElement('option')).
         attr('value', value).
         text(this.getMessage('deja_test_timeoutValue', value)));
   }

   // Define event handlers for the UI.
   this.elements.browserSelect.on('change', this.selectBrowser.bind(this));
   this.elements.locationSelect.on('change', this.selectLocation.bind(this));
   this.elements.captureLevelSelect.on('change',
      this.selectCaptureLevel.bind(this));
   this.elements.captureImagesCheckbox.on('change',
      this.enableImageCapture.bind(this));
   this.elements.okButton.button().
      on('click', this.commitDialog.bind(this));
   this.elements.cancelButton.button().
      on('click', this.cancelDialog.bind(this));

   this.loadTestOptions();
   this.displayUserInfo();
   this.enableControls();
};

DejaClickUi.TestOnDemand.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.TestOnDemand,

   /**
    * Default timeout period in seconds.
    * @const
    */
   DEFAULT_TIMEOUT: '60',

   /**
    * Value indicating that images/headers/source should be captured
    * only on errors.
    * @const
    */
   CAPTURE_ERROR_ONLY: '1',

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by
    * this window and release all references to objects external
    * to this page.
    * @this {!DejaClickUi.TestOnDemand}
    */
   close: function () {
      if (this.hasOwnProperty('state')) {
         if (this.state.submitting && this.hasOwnProperty('restApi')) {
            this.state.submitting = false;
            this.restApi.abortRequest();
         }
         if (this.state.dialog !== null) {
            this.state.dialog.close();
         }
      }

      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allSelects.off('change');
         this.elements.allInputs.off('change');
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
      delete this.prefService;
      delete this.logger;
   },

   /**
    * Select values in the UI based upon the saved values from an
    * earlier visit to this dialog.
    * @this {!DejaClickUi.TestOnDemand}
    */
   loadTestOptions: function () {
      var options = this.prefService.getPrefOption('DC_OPTID_INSTANTTESTOPTS');

      if (this.hasOwnProperty.call(options, 'browser')) {
         // Save value until we have populated the browser list.
         this.state.browser = options.browser;
      }

      if (this.hasOwnProperty.call(options, 'browserVersion')) {
         // Save value until we have populated the browser list.
         this.state.browserVersion = options.browserVersion;
      }

      if (this.hasOwnProperty.call(options, 'location')) {
         // Save value until we have populated the location list.
         this.state.location = options.location;
      }

      this.elements.timeoutSelect.val(this.DEFAULT_TIMEOUT);
      if (this.hasOwnProperty.call(options, 'timeout')) {
         this.elements.timeoutSelect.val(options.timeout);
         if (this.elements.timeoutSelect.val() !== options.timeout) {
            this.elements.timeoutSelect.val(this.DEFAULT_TIMEOUT);
         }
      }

      this.elements.fullpageCheckbox.prop('checked',
         !this.hasOwnProperty.call(options, 'fullpage') ||
            (options.fullpage === 'true'));

      this.elements.captureLevelSelect.val(this.CAPTURE_ERROR_ONLY);
      if (this.hasOwnProperty.call(options, 'captureLevel')) {
         this.elements.captureLevelSelect.val(options.captureLevel);
      }

      if (this.hasOwnProperty.call(options, 'captureGroup')) {
         this.elements.captureImagesCheckbox.prop('checked',
            options.captureGroup.indexOf('img') !== -1);
         this.elements.captureSourceCheckbox.prop('checked',
            options.captureGroup.indexOf('src') !== -1);
         this.elements.captureHeadersCheckbox.prop('checked',
            options.captureGroup.indexOf('hdr') !== -1);
      } else {
         this.elements.captureImagesCheckbox.prop('checked', true);
         this.elements.captureSourceCheckbox.prop('checked', true);
         this.elements.captureHeadersCheckbox.prop('checked', true);
      }

      if (!this.hasOwnProperty.call(options, 'captureType') ||
            (options.captureType === 'image/jpeg')) {
         this.elements.captureFormatJpeg.prop('checked', true);
      } else {
         this.elements.captureFormatPng.prop('checked', true);
      }
   },

   /**
    * Update the UI based due to communication with the REST endpoint.
    * Called when the dejaclick:restapi event is triggered.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!{active:boolean, connected:boolean}} aData Whether the
    *    REST API is active and connected.
    */
   restActivity: function (aData) {
      try {
         if (!aData.connected) {
            window.close();
         } else {
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the selection of a new browser type. Populate the list
    * of locations for this type.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!Event} aEvent A jQuery change event on the browser
    *    select element.
    */
   selectBrowser: function (aEvent) {
      var value, error;
      try {
         value = this.elements.browserSelect.val();
         if (value !== null) {
            this.state.browser = value;
            if (!this.restApi.isActive()) {
               error = this.restApi.listLocations(value,
                  this.displayLocations.bind(this));
               if (error.length !== 0) {
                  window.alert(error);
                  window.close();
               } else {
                  this.state.submitting = true;
               }
            }
         }
         this.updateBrowserVersionOptions();
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the selection of a location.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!Event} aEvent A jQuery change event on the location
    *    select element.
    */
   selectLocation: function (aEvent) {
      var selected;
      try {
         selected = this.elements.locationSelect.prop('selectedOptions');
         if (selected.length === 0) {
            this.elements.locationSelect.removeAttr('title');
         } else {
            this.state.location = selected[0].getAttribute('value');
            this.elements.locationSelect.attr('title', selected[0].textContent);
         }
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the selection of a capture level.
    * Enable or disable UI controls.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!Event} aEvent A jQuery change event on the capture
    *    level select element.
    */
   selectCaptureLevel: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the enabling or disabling of image capture.
    * Enable or disable UI controls.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!Event} aEvent A jQuery change event on the capture
    *    images checkbox.
    */
   enableImageCapture: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to request a different effective user identity.
    * @this {!DejaClickUi.TestOnDemand}
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
    * Center the dialog over the test-on-demand window.
    * @this {!DejaClickUi.TestOnDemand}
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
    * of the current AlertSite sesson.
    * @this {!DejaClickUi.TestOnDemand}
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
    * Save the current options with the preference service and close
    * the dialog.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!Event} aEvent A jQuery click event on the Test button.
    */
   commitDialog: function (aEvent) {
      var group;

      try {
         group = [];
         if (this.elements.captureImagesCheckbox.prop('checked')) {
            group.push('img');
         }
         if (this.elements.captureSourceCheckbox.prop('checked')) {
            group.push('src');
         }
         if (this.elements.captureHeadersCheckbox.prop('checked')) {
            group.push('hdr');
         }

         this.prefService.setPrefOption('DC_OPTID_INSTANTTESTOPTS', {
            browser: this.elements.browserSelect.val(),
            browserVersion: this.elements.browserVersionSelect.val(),
            location: this.elements.locationSelect.val(),
            timeout: this.elements.timeoutSelect.val(),
            fullpage: String(this.elements.fullpageCheckbox.prop('checked')),
            captureLevel: this.elements.captureLevelSelect.val(),
            captureGroup: ((group.length === 0) ? 'none' : group.join(',')),
            captureType: this.elements.captureFormatAll.filter(':checked').val(),
            highlight: 'true'
         });

         this.prefService.setPrefOption('DC_OPTID_SKIPTESTOPTSDLG',
            this.elements.skipDialogCheckbox.prop('checked'));

         window.returnValue = true;
         DejaClick.service.__modal.close(true);
         window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window and cancel the Test-on-Demand.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {!Event} aEvent A jQuery click event on the Cancel button.
    */
   cancelDialog: function (aEvent) {
      try {
         window.close();
         DejaClick.service.__modal.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable controls based upon the current state.
    * @this {!DejaClickUi.TestOnDemand}
    */
   enableControls: function () {
      if (!this.restApi.isLoggedIn()) {
         window.close();

      } else if (this.state.dialog !== null) {
         this.elements.allButtons.button('option', 'disabled', true);
         this.elements.allSelects.attr('disabled', 'true');
         this.elements.allInputs.attr('disabled', 'true');

      } else {
         if (this.restApi.isActive()) {
            this.elements.browserSelect.attr('disabled', 'true');
            this.elements.browserVersionSelect.attr('disabled', 'true');
            this.elements.locationSelect.attr('disabled', 'true');
         } else {
            this.elements.browserSelect.removeAttr('disabled');
            this.elements.browserVersionSelect.removeAttr('disabled');
            this.elements.locationSelect.removeAttr('disabled');
         }
         this.elements.skipDialogCheckbox.removeAttr('disabled');
         this.elements.timeoutSelect.removeAttr('disabled');
         this.elements.fullpageCheckbox.removeAttr('disabled');
         this.elements.captureLevelSelect.removeAttr('disabled');
         if (this.elements.captureLevelSelect.val() === this.CAPTURE_ERROR_ONLY) {
            this.elements.captureImagesCheckbox.removeAttr('disabled');
            this.elements.captureSourceCheckbox.removeAttr('disabled');
            this.elements.captureHeadersCheckbox.removeAttr('disabled');
            if (this.elements.captureImagesCheckbox.prop('checked')) {
               this.elements.captureFormatAll.removeAttr('disabled');
            } else {
               this.elements.captureFormatAll.attr('disabled', 'true');
            }
         } else {
            this.elements.captureImagesCheckbox.attr('disabled', 'true');
            this.elements.captureSourceCheckbox.attr('disabled', 'true');
            this.elements.captureHeadersCheckbox.attr('disabled', 'true');
            this.elements.captureFormatAll.attr('disabled', 'true');
         }

         this.elements.changeUserButton.button('option', 'disabled', false);
         this.elements.connectionButton.button('option', 'disabled', false);
         this.elements.okButton.button('option', 'disabled',
            this.restApi.isActive() ||
            (this.elements.browserSelect.val() == null) ||
            (this.elements.browserVersionSelect.val() == null) ||
            (this.elements.locationSelect.val() == null) ||
            (this.elements.timeoutSelect.val() == null) ||
            (this.elements.captureLevelSelect.val() == null) ||
            (this.elements.captureFormatAll.filter(':checked').length === 0));
         this.elements.cancelButton.button('option', 'disabled', false);
      }
   },

   /**
    * Display the current effective user information.
    * Also request the browser list if the user has changed.
    * @this {!DejaClickUi.TestOnDemand}
    */
   displayUserInfo: function () {
      var userId, userIdElement, accountId, realUserId;

      userId = this.restApi.getLogin();
      if (this.elements.userIdValue.text() !== userId) {
         // The user has changed. Update the display.
         accountId = this.restApi.getAccountId();
         if (accountId.length !== 0) {
            this.elements.customerIdLabel.
               text(this.getMessage('deja_test_accountIdLabel'));
            this.elements.customerIdValue.text(accountId);
            this.elements.customerNameLabel.
               text(this.getMessage('deja_test_accountTypeLabel'));
            this.elements.customerNameValue.
               text(this.getMessage('deja_test_accountTypeFree'));
            this.state.freeAccount = true;

         } else {
            this.elements.customerIdLabel.
               text(this.getMessage('deja_test_customerIdLabel'));
            this.elements.customerIdValue.text(this.restApi.getCustomerId());
            this.elements.customerNameLabel.
               text(this.getMessage('deja_test_customerNameLabel'));
            this.elements.customerNameValue.text(this.restApi.getCompany());
            this.state.freeAccount = false;
         }
         this.elements.userIdValue.text(userId);
         realUserId = this.restApi.getRealLogin();
         if (userId === realUserId) {
            this.elements.userIdValue.removeAttr('title');
         } else {
            this.elements.userIdValue.attr('title',
               this.getMessage('deja_test_realuser') + realUserId);
         }

         this.getBrowsers();
      }
   },

   /**
    * Asynchronously request a list of the available browsers from the
    * REST endpoint.
    * @this {!DejaClickUi.TestOnDemand}
    */
   getBrowsers: function () {
      var loadingMessage, loadingOption, error;

      loadingMessage = this.getMessage('deja_test_loadingMessage');
      loadingOption = $(document.createElement('option')).
         text(loadingMessage);
      this.elements.browserSelect.empty().
         removeAttr('title').
         append(loadingOption);
      this.elements.browserVersionSelect.empty().
         removeAttr('title').
         append(loadingOption);
      loadingOption = $(document.createElement('option')).
         text(loadingMessage);
      this.elements.locationSelect.empty().
         removeAttr('title').
         append(loadingOption);

      error = this.restApi.listTransactions(this.restApi.TYPE_INSTANTTEST,
         this.displayBrowsers.bind(this));
      if (error.length !== 0) {
         window.alert(error);
         window.close();
      } else {
         this.state.submitting = true;
      }
   },

   /**
    * Populate the list of browsers in the UI. Select the previously
    * selected browser if available.
    * @this {!DejaClickUi.TestOnDemand}
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
   displayBrowsers: function (aError, aBrowsers, aTransactions) {
      var selectElt, index, optionElt;
      try {
         this.state.submitting = false;
         if (aError.length !== 0) {
            window.alert(aError);
            window.close();
            return;
         }

         selectElt = this.elements.browserSelect;
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

         selectElt.val(this.state.browser);

         var browser = typeof InstallTrigger !== 'undefined' ? 'FF':'CH';

         selectElt.val(browser);


         if (selectElt.val() == null) {
            selectElt.prop('selectedIndex', 0);
         }

         //Update the browser version list.
         this.updateBrowserVersionOptions();

         //Call to load the locations
         this.selectBrowser(); 

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
         var browserVal = this.elements.browserSelect.val();
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
    * Populate the list of locations in the UI. Select the previously selected
    * browser type.
    * @this {!DejaClickUi.TestOnDemand}
    * @param {string} aError The empty string on success, an error message
    *    if the request failed.
    * @param {!Array.<!{name:string, code:string}>} aLocations List
    *    of location records for the selected browser type.
    */
   displayLocations: function (aError, aLocations) {
      var selectElt, index, optionElt;

      try {
         this.state.submitting = false;
         if (aError.length !== 0) {
            window.alert(aError);
            window.close();
            return;
         }

         selectElt = this.elements.locationSelect;
         selectElt.empty();
         for (index = 0; index < aLocations.length; ++index) {
            optionElt = $(document.createElement('option')).
               attr('value', aLocations[index].code).
               text(aLocations[index].name);
            selectElt.append(optionElt);
         }

         selectElt.val(this.state.location);
         if (selectElt.val() == null) {
            selectElt.prop('selectedIndex', 0);
         }
         this.selectLocation();

      } catch (ex) {
         this.logger.logException(ex);
      }
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('testOnDemand')) {
            DejaClickUi.testOnDemand.close();
            delete DejaClickUi.testOnDemand;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      DejaClickUi.testOnDemand = new DejaClickUi.TestOnDemand(DejaClick.utils,
         DejaClick.EventRegistration,
         DejaClick.DialogWindow);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
         DejaClick.service.__modal.setTitle('deja_test_title');

      $(window).on('unload', unload);
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
