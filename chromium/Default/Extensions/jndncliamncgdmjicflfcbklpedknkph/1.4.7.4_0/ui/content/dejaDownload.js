/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick for Chrome by SmartBear Software.
* Copyright (C) 2006-2013 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

/*
 * Dialog to download a script from an AlertSite monitoring account.
 * Input: {} None
 * Output: {boolean} true if a script was successfully downloaded.
 */

/*global window,DejaClickUi,$,document,DejaClick*/

'use strict';

/**
 * Preferred width of the download dialog.
 * @const
 */
var preferredWidth = 450;
/**
 * Preferred height of the download dialog.
 * @const
 */
var preferredHeight = 470;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = false;

/**
 * Class to encapsulate the functionality of the script download dialog.
 * @constructor
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {function(!DejaClick.Script)} aSetScript Method to change
 *    the script currently being processed by the extension.
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
DejaClickUi.Download = function (aUtils, aSetScript, AEventRegistration,
      ADialogWindow) {
   var secure;

   // Get references to frequently used background objects.
   this.logger = aUtils.logger;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;
   this.setScript = aSetScript;
   this.DialogWindow = ADialogWindow;
   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:restapi',
         this.restActivity, this);

   this.state = {
      freeAccount: false,
      submitting: false,
      dialog: null
   };

   // Initialize UI.
   this.elements = {
      customerIdLabel: $('#customerIdLabel'),
      customerIdValue: $('#customerIdValue'),
      customerNameLabel: $('#customerNameLabel'),
      customerNameValue: $('#customerNameValue'),
      transactionTypeSelect: $('#transactionTypeSelect'),
      transactionSelect: $('#transactionSelect'),
      descriptionSection: $('#descriptionSection'),
      descriptionValue: $('#descriptionValue'),
      changeUserButton: $('#changeUserButton'),
      userIdValue: $('#userIdValue'),
      connectionButton: $('#connectionButton'),
      okButton: $('#okButton'),
      cancelButton: $('#cancelButton'),
      allSelects: $('select'),
      allButtons: $('button')
   };
   this.elements.transactionTypeSelect.parent().hide();

   aUtils.localizeTree(document.documentElement, 'deja_');

   // Optionally enable the change user button.
   if (aUtils.prefService.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
      this.elements.changeUserButton.on('click', this.changeUser.bind(this)).
         text(this.getMessage('deja_download_changeUser'));
   } else {
      this.elements.changeUserButton.off('click');
   }
   this.elements.changeUserButton.button({
      text: false,
      icons: { primary: 'changeuser-icon' }
   });

   // Display whether the AlertSite session is secured.
   secure = /https:\/\//.test(this.restApi.getEndpoint());
   this.elements.connectionButton.
      addClass(secure ? 'secure' : 'insecure').
      text(this.getMessage(secure ? 'deja_download_secureConnection' :
         'deja_download_insecureConnection')).
      button({
         text: false,
         icons: { primary: 'lock-icon' }
      }).
      off('click');

   // Register other event handlers.
   this.elements.okButton.button().on('click', this.downloadScript.bind(this));
   this.elements.cancelButton.button().
      on('click', this.cancelDialog.bind(this));
   this.elements.transactionTypeSelect.on('change',
      this.selectTransactionType.bind(this));
   this.elements.transactionSelect.on('change',
      this.selectTransaction.bind(this));

   this.displayUserInfo();
   this.enableControls();
};

DejaClickUi.Download.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Download,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * dialog.
    * @this {!DejaClickUi.Download}
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
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.elements;
      delete this.state;
      delete this.events;
      delete this.DialogWindow;
      delete this.setScript;
      delete this.getMessage;
      delete this.restApi;
      delete this.logger;
   },

   /**
    * Detect and respond to REST API activity.
    * Called in response to the dejaclick:restapi event.
    * @this {!DejaClickUi.Download}
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
    * Open a dialog to request a different user identity.
    * @this {!DejaClickUi.Download}
    * @param {!Event} aEvent A jQuery click event on the change user icon.
    */
   changeUser: function (aEvent) {
      try {
         if (this.state.dialog == null) {
            this.state.dialog = new this.DialogWindow(
               'ui/content/dejaChangeUser.html',
               null,
               this.centerDialog.bind(this),
               this.completeChangeUser.bind(this),
               this.logger);
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Center the dialog over the download window.
    * @this {!DejaClickUi.Download}
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
    * @this {!DejaClickUi.Download}
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
    * Display the current effective user information.
    * Also request the transaction list if the user has changed.
    * @this {!DejaClickUi.Download}
    */
   displayUserInfo: function () {
      var userId, userIdElement, accountId, realUserId;

      userId = this.restApi.getLogin();
      userIdElement = this.elements.userIdValue;
      if (userIdElement.text() !== userId) {
         // The user has changed. Update the display.
         accountId = this.restApi.getAccountId();
         if (accountId.length !== 0) {
            this.elements.customerIdLabel.
               text(this.getMessage('deja_download_accountIdLabel'));
            this.elements.customerIdValue.text(accountId);
            this.elements.customerNameLabel.
               text(this.getMessage('deja_download_accountTypeLabel'));
            this.elements.customerNameValue.
               text(this.getMessage('deja_download_accountTypeFree'));
            this.state.freeAccount = true;

         } else {
            this.elements.customerIdLabel.
               text(this.getMessage('deja_download_customerIdLabel'));
            this.elements.customerIdValue.text(this.restApi.getCustomerId());
            this.elements.customerNameLabel.
               text(this.getMessage('deja_download_customerNameLabel'));
            this.elements.customerNameValue.text(this.restApi.getCompany());
            this.state.freeAccount = false;
         }
         userIdElement.text(userId);
         realUserId = this.restApi.getRealLogin();
         if (userId === realUserId) {
            userIdElement.removeAttr('title');
         } else {
            userIdElement.attr('title',
               this.getMessage('deja_download_realuser') + realUserId);
         }

         if (this.elements.transactionTypeSelect.val() !== null) {
            this.getTransactions();
         }
      }
   },

   /**
    * Process the selection of a transaction type. Request a new
    * transaction list.
    * @this {!DejaClickUi.Download}
    * @param {!Event} aEvent A jQuery change event on the transaction type
    *    select element.
    */
   selectTransactionType: function (aEvent) {
      try {
         this.enableControls();
         if (this.elements.transactionTypeSelect.val() !== null) {
            this.getTransactions();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the selection of a transaction.
    * Display the script description and enable the appropriate UI controls.
    * @this {!DejaClickUi.Download}
    * @param {!Event} aEvent A change event on the transaction select element.
    */
   selectTransaction: function (aEvent) {
      var selected, description;
      try {
         selected = this.elements.transactionSelect.prop('selectedOptions');
         description = '';
         if (selected.length !== 0) {
            description = selected[0].getAttribute('dctxndesc');
         }
         this.elements.descriptionValue.text(description);

         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Begin to asynchronously download a script from AlertSite.
    * @this {!DejaClickUi.Download}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   downloadScript: function (aEvent) {
      var error;
      try {
         error = this.restApi.downloadScript(
            this.elements.transactionSelect.val(),
            this.restApi[this.elements.transactionTypeSelect.val()],
            this.completeDownloadScript.bind(this));
         if (error.length !== 0) {
            window.alert(error);
            window.close();
         } else {
            this.state.submitting = true;
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Handle the completion of a download of a script from AlertSite.
    * Start using the script or alert the user of any error.
    * @this {!DejaClickUi.Download}
    * @param {string} aError The empty string if successful. An error
    *    message if not.
    * @param {?(DejaClick.Script|string)} aScriptOrUrl The downloaded script.
    */
   completeDownloadScript: function (aError, aScriptOrUrl) {
      var digest;
      try {
         this.state.submitting = false;
         if (aError) {
            window.alert(aError);
            window.close();

         } else if (typeof aScriptOrUrl === 'string') {
            window.open(aScriptOrUrl, '_blank');
            window.returnValue = true;
            window.close();

         } else {
            digest = aScriptOrUrl.getRemotePasswordDigest();
            if (digest == null) {
               this.normalizeScript(aScriptOrUrl);
            } else {
               this.state.dialog = new this.DialogWindow(
                  'ui/content/dejaPassword.html',
                  {
                     question: 'deja_password_loadPrompt',
                     digest: digest
                  },
                  this.centerDialog.bind(this),
                  this.processPassword.bind(this, aScriptOrUrl),
                  this.logger);
               this.enableControls();
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the result of selecting a password to decrypt the script.
    * @this {!DejaClickUi.Sidebar}
    * @param {!DejaClick.Script} aScript The script that was downloaded.
    * @param {?DejaClick.Encryption} aEncryption Encryption object
    *    initialized by the password selected by the user. May be null
    *    if the user canceled the download or if the correct password
    *    was not supplied.
    */
   processPassword: function (aScript, aEncryption) {
      try {
         this.state.dialog = null;
         this.enableControls();
         if (aEncryption == null) {
            window.alert(this.getMessage('deja_sidebar_scriptPassword'));
            window.close();
         } else {
            this.normalizeScript(aScript,
               aEncryption.decrypt.bind(aEncryption));
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Normalize the downloaded script, prepare it for use, and close
    * the dialog.
    * @this {!DejaClickUi.Sidebar}
    * @param {!DejaClick.Script} aScript The script that was downloaded.
    * @param {function(string):string=} opt_decrypt Optional function
    *    to decrypt the script being loaded.
    */
   normalizeScript: function (aScript, opt_decrypt) {
      aScript.normalize(false, opt_decrypt);
      aScript.updateMissingDescription(
         this.elements.transactionSelect.
            prop('selectedOptions')[0].textContent);
      this.setScript(aScript);
      window.alert(this.getMessage('deja_download_downloadComplete',
         String(aScript.getTotalEventCount())));
      window.returnValue = true;
      window.close();
   },

   /**
    * Close the window without downloading a script.
    * @this {!DejaClickUi.Download}
    * @param {!Event} aEvent A click event on the Cancel button.
    */
   cancelDialog: function (aEvent) {
      try {
         window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously request a list of transactions of the selected type.
    * @this {!DejaClickUi.Download}
    */
   getTransactions: function () {
      var type, error;

      this.elements.transactionSelect.empty().append(
         $(document.createElement('option')).
            text(this.getMessage('deja_download_loadingTransactions')));

      if (this.restApi.isActive()) {
         this.restApi.abortRequest();
         this.state.submitting = false;
      }
      type = this.restApi[this.elements.transactionTypeSelect.val()];
      error = this.restApi.listTransactions(type,
         this.displayTransactions.bind(this));
      if (error.length !== 0) {
         window.alert(error);
         window.close();
      } else {
         this.state.submitting = true;
      }
   },

   /**
    * Populate the list of transactions with the results of the
    * asynchronous REST request.
    * @this {!DejaClickUi.Download}
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
      var selectElt, index, transaction;
      try {
         this.state.submitting = false;
         if (aError.length !== 0) {
            window.alert(aError);
            window.close();
            return;
         }
         selectElt = this.elements.transactionSelect.empty();
         for (index = 0; index < aTransactions.length; ++index) {
            transaction = aTransactions[index];
            if (transaction.objDevice.length !== 0) {
               selectElt.append($(document.createElement('option')).
                  attr('value', transaction.objDevice).
                  attr('title', transaction.name).
                  attr('dctxndesc', transaction.description).
                  text(transaction.name));
            }
         }

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the UI controls based upon the current state.
    * @this {!DejaClickUi.Download}
    */
   enableControls: function () {
      if (!this.restApi.isLoggedIn()) {
         window.close();

      } else if (this.state.dialog !== null) {
         this.elements.allButtons.button('option', 'disabled', true);
         this.elements.allSelects.attr('disabled', 'true');

      } else {
         if (this.state.freeAccount) {
            this.elements.transactionTypeSelect.val('TYPE_REPOSITORY').
               attr('disabled', 'true');
         } else {
            this.elements.transactionTypeSelect.removeAttr('disabled');
         }

         if (this.restApi.isActive()) {
            this.elements.transactionSelect.attr('disabled', 'true');
         } else {
            this.elements.transactionSelect.removeAttr('disabled');
         }

         if (this.elements.transactionTypeSelect.val() === 'TYPE_REPOSITORY') {
            this.elements.descriptionSection.show();
         } else {
            this.elements.descriptionSection.hide();
         }

         this.elements.changeUserButton.button('option', 'disabled', false);
         this.elements.connectionButton.button('option', 'disabled', false);
         this.elements.okButton.button('option', 'disabled',
            this.restApi.isActive() ||
            (this.elements.transactionTypeSelect.val() == null) ||
            (this.elements.transactionSelect.val() == null));
         this.elements.cancelButton.button('option', 'disabled', false);
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
         if (DejaClickUi.hasOwnProperty('download')) {
            DejaClickUi.download.close();
            delete DejaClickUi.download;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      DejaClickUi.download = new DejaClickUi.Download(DejaClick.utils,
         DejaClick.setScript.bind(DejaClick),
         DejaClick.EventRegistration,
         DejaClick.DialogWindow);
      $(window).on('unload', unload);
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
