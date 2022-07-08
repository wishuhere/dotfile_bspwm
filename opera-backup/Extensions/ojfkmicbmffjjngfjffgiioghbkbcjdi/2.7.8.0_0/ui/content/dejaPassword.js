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
 * Dialog that prompts the user for a password to encrypt or decrypt a
 * script.
 * Input: {{
 *    question: string,
 *    digest: ?string
 * }}
 * Output: {?DejaClick.Encryption}
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the DejaClick password dialog.
 * @const
 */
var preferredWidth = 325;
/**
 * Preferred height of the DejaClick password dialog.
 * @const
 */
var preferredHeight = 190;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;


/**
 * Manage the DejaClick Password dialog window.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    question: string,
 *    digest: ?string
 * }} aArgs Input arguments to the dialog: name of the prompt to
 *    display to the user and the digest to be matched by the password
 *    (if any).
 * @param {!Element} aRootElement The parent element of the page's UI.
 * @param {!Window} aWindow The window object.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {function(new:DejaClick.Encryption, string)} AEncryption
 *    Constructor for Encryption objects.
 */
DejaClickUi.Password = function (aArgs, aRootElement, aWindow, aUtils,
                                 AEncryption) {
   var root;
   this.m_digest = aArgs?aArgs.digest:undefined;
   this.m_window = aWindow;
   this.m_logger = aUtils.logger;
   this.m_promptService = aUtils.promptService;
   this.m_Encryption = AEncryption;
   this.m_count = 3;

   aWindow.returnValue = null;
   root = $(aRootElement);

   this.m_elements = {
      root: root,
      input: root.find('#passwordInput'),
      cancel: root.find('#cancelButton'),
      ok: root.find('#okButton')
   };

   if ( aArgs && aArgs.question ) {
      root.find('#question').text(aArgs.question);
   } 
   
   // Initialize the UI.
   aUtils.localizeTree(aRootElement, 'deja_');

   this.m_elements.cancel.button().on('click', this.cancel.bind(this));
   this.m_elements.ok.button().on('click', this.apply.bind(this));
   this.m_elements.input.on('keydown', this.processKeypress.bind(this)).
      focus();
};

DejaClickUi.Password.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Password,

   /**
    * Shut down the dialog, releasing all references to external objects
    * and unregistering all event handlers.
    * @this {!DejaClickUi.Password}
    */
   close: function() {
      if (this.hasOwnProperty('m_elements')) {
         this.m_elements.input.off('keydown');
         this.m_elements.ok.off('click').button('destroy');
         this.m_elements.cancel.off('click').button('destroy');
      }
      delete this.m_elements;
      delete this.m_count;
      delete this.m_Encryption;
      delete this.m_promptService;
      delete this.m_logger;
      delete this.m_window;
      delete this.m_digest;
   },

   /**
    * Cancel selection of a password and the operation that initiated
    * the selection.
    * @this {!DejaClickUi.Password}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function(aEvent) {
      try {
         this.m_window.returnValue = null;
         this.m_window.close();
         DejaClick.service.__modal.close();
      } catch (ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Compare the entered password to the supplied password digest (if
    * any). If it matches, return the associated encryption object to
    * the client.
    * @this {!DejaClickUi.Password}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   apply: function(aEvent) {
      var password, encryption;
      try {
         password = this.m_elements.input.prop('value');
         encryption = new this.m_Encryption(password);
         if (password.length === 0) {
            this.m_promptService.alertUser('deja_password_missingPassword',
                                           true, null, this.m_window);
         } else if ((this.m_digest == null) ||
               (this.m_digest === encryption.getPasswordDigest())) {
            var win = this.m_window;
            win.returnValue = new this.m_Encryption(password);
            DejaClick.service.__modal.returnValue = win.returnValue;
            this.close();
            win.close();
            DejaClick.service.__modal.close();
         } else {
            this.m_promptService.alertUser('deja_password_incorrectPassword',
                                           true, null, this.m_window);
            --this.m_count;
            if (this.m_count === 0) {
               this.cancel(aEvent);
            }
         }
      } catch (ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Treat keypresses of Enter and Escape like clicks on the OK and
    * Cancel buttons.
    * @this {!DejaClickUi.Password}
    * @param {!Event} aEvent A jQuery keydown event on the input element.
    */
   processKeypress: function(aEvent) {
      try {
         if (aEvent.which === 13) {
            this.apply(aEvent);
         } else if (aEvent.which === 27) {
            this.cancel(aEvent);
         }
      } catch (ex) {
         this.m_logger.logException(ex);
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
         if (DejaClickUi.hasOwnProperty('password')) {
            DejaClickUi.password.close();
            delete DejaClickUi.password;
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
   function initialize(args) {
      try {
         DejaClickUi.password = new DejaClickUi.Password(
            args,
            document.documentElement,
            window,
            DejaClick.utils,
            DejaClick.Encryption);
         $(window).on('unload', unload);
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      /*
      if (window.hasOwnProperty('dialogArguments')) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }*/
      if($('body').is('#dejaPassword')){
         if (DejaClick.service.__modal.arguments) {
            initialize(DejaClick.service.__modal.arguments);
         } else {
            window.onDialogArguments = initialize;
         }
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
