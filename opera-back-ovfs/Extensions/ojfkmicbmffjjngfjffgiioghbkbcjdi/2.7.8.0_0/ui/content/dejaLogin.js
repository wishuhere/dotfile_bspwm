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
 * Dialog to log in to AlertSite monitoring account.
 * Input: {{silent:boolean}} true if no prompt should be displayed
 *    informing the user of a successful login.
 * Output: {boolean} true if log in was successful, false if not.
 */

/*global window,DejaClickUi,$,document,DejaClick*/

'use strict';

/**
 * Preferred width of the login dialog.
 * @const
 */
var preferredWidth = 450;
/**
 * Preferred height of the login dialog.
 * @const
 */
var preferredHeight = 250;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = false;

/**
 * Class to encapsulate the functionality of the AlertSite login dialog.
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
DejaClickUi.Login = function (aUtils, AEventRegistration, ADialogWindow) {
   // Get references to frequently used background objects.
   this.logger = aUtils.logger;
   this.prefService = aUtils.prefService;
   this.promptService = aUtils.promptService;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;
   this.DialogWindow = ADialogWindow;
   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:restapi',
         this.restActivity, this);

   this.state = {
      submitting: false,
      dialog: null
   };

   // Initialize UI.
   this.elements = {
      connectionButton: $('#connectionButton'),
      connectionLabel: $('#connectionLabel'),
      userIdInput: $('#userIdInput'),
      passwordInput: $('#passwordInput'),
      signupLink: $('#signupLink'),
      okButton: $('#okButton'),
      cancelButton: $('#cancelButton'),
      allButtons: $('button'),
      allAnchors: $('a')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   this.elements.connectionButton.button({
      text: false,
      icons: { primary: 'lock-icon' }
   });
   this.elements.userIdInput.on('input', this.changeLogin.bind(this));
   this.elements.okButton.button().
      on('click', this.login.bind(this));
   this.elements.cancelButton.button().
      on('click', this.cancelDialog.bind(this));
   this.elements.signupLink.on('click', this.freeTrialSignup.bind(this));

   this.elements.userIdInput.focus();

   this.displayConnectionIcon();
   this.enableControls();
};

DejaClickUi.Login.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Login,

   /**
    * Maximum displayed length of the REST endpoint's URL.
    * @const
    */
   MAX_URL_LEN: 44,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.Login}
    */
   close: function () {
      if (this.hasOwnProperty('state')) {
         if (this.state.submitting && this.hasOwnProperty('restApi')) {
            this.state.submitting = false;
            this.restApi.logoff();
         }

         if (this.state.dialog !== null) {
            this.state.dialog.close();
            this.state.dialog = null;
         }
      }

      if (this.hasOwnProperty('elements')) {
         this.elements.allAnchors.off('click');
         this.elements.allButtons.off('click').button('destroy');
         this.elements.userIdInput.off('input');
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
      delete this.promptService;
      delete this.prefService;
      delete this.logger;
   },

   /**
    * Enable or disable the OK button based upon current REST API activity.
    * Called when the dejaclick:restapi event is triggered.
    * @this {!DejaClickUi.Login}
    * @param {!{active:boolean, connected:boolean}} aData Whether the
    *    REST API is active and connected.
    */
   restActivity: function (aData) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously ask the user for a new REST endpoint.
    * @this {!DejaClickUi.Login}
    * @param {!Event} event A jQuery click event on the change connection icon.
    */
   changeEndpoint: function (aEvent) {
      try {
         this.state.dialog = new this.DialogWindow(
            'ui/content/dejaConnect.html',
            null,
            this.centerDialog.bind(this),
            this.completeChangeEndpoint.bind(this),
            this.logger);
         this.enableControls();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Center the dialog over the login window.
    * @this {!DejaClickUi.Login}
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
    * Update the UI in response to closing the change connection dialog.
    * @this {!DejaClickUi.Login}
    * @param {string} aEndpoint The REST endpoint to be used.
    */
   completeChangeEndpoint: function (aEndpoint) {
      try {
         this.state.dialog = null;
         this.displayConnectionIcon();
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open the DejaClick account signup page and close this window.
    * @this {!DejaClickUi.Login}
    * @param {!Event} aEvent A jQuery click event on the free signup link.
    */
   freeTrialSignup: function(aEvent) {
      try {
         if (this.state.dialog == null) {
            window.open('https://scripts.alertsite.com/signup/', '_blank');
            window.close();
         }
         aEvent.preventDefault();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously log in to an AlertSite monitoring account.
    * @this {!DejaClickUi.Login}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   login: function (aEvent) {
      var error;
      try {
         error = this.restApi.login(this.elements.userIdInput.val(),
            this.elements.passwordInput.val(),
            this.completeLogin.bind(this));
         if (error.length !== 0) {
            this.promptService.alertUser('deja_login_failure', true, error,
               window);
         } else {
            this.state.submitting = true;
         }

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Handle the completion of an asynchronous login attempt.
    * @this {!DejaClickUi.Login}
    * @param {string} aError An empty string if the login was successful.
    *    An error message if not successful.
    */
   completeLogin: function (aError) {
      try {
         this.state.submitting = false;
         if (aError.length !== 0) {
            this.promptService.alertUser('deja_login_failure', true, aError,
               window);

         } else {
            if ((window.dialogArguments == null) ||
                  !window.dialogArguments.silent) {
               window.alert(this.getMessage('deja_login_success'));
            }
            window.returnValue = true;
            window.close();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window.
    * @this {!DejaClickUi.Login}
    * @param {!Event} aEvent A jQuery click event on the Cancel button.
    */
   cancelDialog: function (aEvent) {
      try {
         window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the UI based upon the currently selected REST endpoint.
    * Changes the connection icon and the endpoint label.
    * @this {!DejaClickUi.Login}
    */
   displayConnectionIcon: function () {
      var connButton, secureMessage, insecureMessage, endpoint;

      connButton = this.elements.connectionButton.off('click');
      secureMessage = 'deja_login_secureConnection';
      insecureMessage = 'deja_login_insecureConnection';
      if (this.prefService.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
         connButton.on('click', this.changeEndpoint.bind(this));
         secureMessage += 'Change';
         insecureMessage += 'Change';
      }

      endpoint = this.restApi.getEndpoint();
      if (/https:\/\//.test(endpoint)) {
         connButton.addClass('secure').
            removeClass('insecure').
            button('option', 'label', this.getMessage(secureMessage));
      } else {
         connButton.removeClass('secure').
            addClass('insecure').
            button('option', 'label', this.getMessage(insecureMessage));
      }

      if (endpoint === this.prefService.getDefault('DC_OPTID_RESTENDPOINT')) {
         this.elements.connectionLabel.empty();
      } else {
         this.elements.connectionLabel.attr('title', endpoint).
            text((endpoint.length > this.MAX_URL_LEN) ?
               (endpoint.substring(0, this.MAX_URL_LEN) + '...') : endpoint);
      }
   },

   /**
    * Enable or disable the OK button based upon the value of the user id.
    * @this {!DejaClick.Login}
    * @param {!Event} aEvent A jQuery input event on the user id input element.
    */
   changeLogin: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls based upon the current state of
    * the dialog.
    * @param {!DejaClick.Login}
    */
   enableControls: function () {
      if (this.state.dialog !== null) {
         this.elements.allButtons.button('option', 'disabled', true);

      } else {
         this.elements.connectionButton.button('option', 'disabled', false);
         this.elements.cancelButton.button('option', 'disabled', false);
         this.elements.okButton.button('option', 'disabled',
            this.restApi.isActive() ||
               (this.elements.userIdInput.val().length === 0));
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
         if (DejaClickUi.hasOwnProperty('login')) {
            DejaClickUi.login.close();
            delete DejaClickUi.login;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      DejaClickUi.login = new DejaClickUi.Login(DejaClick.utils,
         DejaClick.EventRegistration,
         DejaClick.DialogWindow);
      $(window).on('unload', unload);
      DejaClick.service.__modal.setTitle('deja_login_title');
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
