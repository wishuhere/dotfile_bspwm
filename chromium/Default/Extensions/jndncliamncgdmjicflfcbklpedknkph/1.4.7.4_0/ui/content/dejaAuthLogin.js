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
 * Dialog to log in to the website after 401 (Authorization Required) is received.
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
DejaClickUi.AuthLogin = function (aArgs, aRootElement, aWindow, aUtils) {
   var root;

   this.window = aWindow;
   this.logger = aUtils.logger;

   root = $(aRootElement);
   // Initialize UI.
   this.elements = {
      root: root,
      messageText: root.find('#messageText'),
      userIdInput: root.find('#userIdInput'),
      passwordInput: root.find('#passwordInput'),
      okButton: root.find('#okButton'),
      cancelButton: root.find('#cancelButton'),
      allButtons: root.find('button')
   };
console.dir(this.elements);
   aUtils.localizeTree(aRootElement, 'deja_');
   this.elements.messageText.html(aArgs.message.replace(/\n/g, '<br>'));

   this.elements.okButton.button().
      on('click', this.login.bind(this));
   this.elements.cancelButton.button().
      on('click', this.cancelDialog.bind(this));

   this.elements.userIdInput.focus();

};

DejaClickUi.AuthLogin.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.AuthLogin,

   /**
    * Shut down the dialog, releasing all references to external objects
    * and unregistering all event handlers.
    * @this {!DejaClickUi.AuthLogin}
    */
   close: function () {

      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.userIdInput.off('input');
      }
      if (this.hasOwnProperty('window')) {
         $(this.window).off('resize');
      }

      delete this.elements;
      delete this.logger;
      delete this.window;
   },

   /**
    * Asynchronously log in to an AlertSite monitoring account.
    * @this {!DejaClickUi.AuthLogin}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   login: function (aEvent) {
      var error;
      try {
         var response = {
            authCredentials: {
               username: this.elements.userIdInput.val(),
               password: this.elements.passwordInput.val()
            }
         };

         DejaClick.service.addAuthCredentials (this.elements.userIdInput.val(), this.elements.passwordInput.val());
         window.args = window.dialogArguments.args;
         window.args.callback(response);
         window.returnValue = true;            
         window.close();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window.
    * @this {!DejaClickUi.AuthLogin}
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
    * Change the height of the window to display all visible contents.
    * @this {!DejaClickUi.Notify}
    */
   resizeWindow: function () {
      try {
         if (this.hasOwnProperty('window')) {
            this.window.resizeTo(this.window.outerWidth,
               this.window.outerHeight - this.window.innerHeight +
                  this.elements.root.outerHeight());
         }
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
         if (DejaClickUi.hasOwnProperty('authLogin')) {
            DejaClickUi.authLogin.close();
            delete DejaClickUi.authLogin;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }
   
   /**
    * Create and initialize the Notify instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.authLogin = new DejaClickUi.AuthLogin(
            window.dialogArguments,
            document.documentElement,
            window,
            DejaClick.utils);
         $(window).on('unload', unload);
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (window.hasOwnProperty('dialogArguments')) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }

});
