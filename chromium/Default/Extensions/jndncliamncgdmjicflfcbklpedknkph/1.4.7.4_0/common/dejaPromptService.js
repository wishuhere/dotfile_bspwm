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

'use strict';

/*global DejaClick*/


/**
 * PromptService is responsible for displaying dialogs to the user for
 * short messages and interactions.
 * @constructor
 * @param {function(string):string} aGetMessage Function to get the
 *    localized text corresponding to a message name.
 * @param {!Window} aWindow Object with prompt, confirm and alert methods.
 * @param {!DejaClick.Logger} aLogger Means of logging messages.
 * @param {!DejaClick.PreferenceService} aPrefService Repository of
 *    configuration information.
 * @param {function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       Function)} ADialogWindow Constructor for a dialog window.
 */
DejaClick.PromptService = function (aGetMessage, aWindow, aLogger,
      aPrefService, ADialogWindow) {
   this.m_getMessage = aGetMessage;
   this.m_window = aWindow;
   this.m_logger = aLogger;
   this.m_prefService = aPrefService;
   this.m_DialogWindow = ADialogWindow;

   this.m_numPrompts = 0;
   /** @type {!Array.<?DejaClick.DialogWindow>} */
   this.m_dialogs = [];
};

DejaClick.PromptService.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PromptService,

   /**
    * Shut down the PromptService, releasing all references to
    * external objects.  The PromptService will no longer be usable.
    * @this {!DejaClick.PromptService}
    */
   close: function () {
      if (this.hasOwnProperty('m_dialogs')) {
         this.closeDialogs();
      }
      delete this.m_dialogs;
      delete this.m_numPrompts;
      delete this.m_DialogWindow;
      delete this.m_prefService;
      delete this.m_logger;
      delete this.m_window;
      delete this.m_getMessage;
   },

   /**
    * Close all notification dialogs opened by the prompt service.
    * @this {!DejaClick.PromptService}
    */
   closeDialogs: function () {
      var index = this.m_dialogs.length;
      while (index !== 0) {
         --index;
         if (this.m_dialogs[index] !== null) {
            this.m_dialogs[index].close();
         }
      }
      this.m_dialogs.length = 0;
   },

   setWindow: function (aWindow) {
      try {
         this.m_window = aWindow;
      }
      catch (ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Reset the prompt count to 0.
    * @this {!DejaClick.PromptService}
    */
   clearPromptCount: function () {
      this.m_numPrompts = 0;
   },

   /**
    * Increment the prompt count by 1.
    * @this {!DejaClick.PromptService}
    */
   countPrompt: function () {
      ++this.m_numPrompts;
   },

   /**
    * Get the current prompt count.
    * @this {!DejaClick.PromptService}
    */
   getNumPrompts: function () {
      return this.m_numPrompts;
   },

   /**
    * Display a notification message to the user via a popup dialog.
    * @this {!DejaClick.PromptService}
    * @param {string} aMessage The contents of the message to display.
    * @param {boolean=} opt_localize If true, then aMessage is the name of
    *    a localizable message. Otherwise, it is the text to display.
    */
   notifyUser: function (aMessage, opt_localize) {
      var message;
      try {
         if (this.m_prefService.getPrefOption('DC_OPTID_RUNINTERACTIVE')) {
            this.countPrompt();
            message = opt_localize ? this.m_getMessage(aMessage) : aMessage;
            this.m_window.alert(message);
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Display a prompt to the user via a popup dialog.
    * @this {!DejaClick.PromptService}
    * @param {string} aMessage The contents of the prompt to display.
    * @param {boolean=} opt_localize If true, then aMessage is the name of
    *    a localizable message. Otherwise, it is the text to display.
    * @return {boolean} True if the user clicked ok, false for cancel.
    */
   promptUser: function (aMessage, opt_localize) {
      var result, message;
      try {
         result = true;
         if (this.m_prefService.getPrefOption('DC_OPTID_RUNINTERACTIVE')) {
            this.countPrompt();
            message = opt_localize ? this.m_getMessage(aMessage) : aMessage;
            result = this.m_window.confirm(message);
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
         result = false;
      }
      return result;
   },
   
   /**
    * Display an alert to the user via a popup dialog.
    * @this {!DejaClick.PromptService}
    * @param {string} aMessage The contents of the alert.
    * @param {boolean=} opt_localize If true, then aMessage is the name of
    *    a localizable message. Otherwise, it is the text to display.
    * @param {Window=} opt_window Window over which to display the alert.
    */
   authUser: function (aMessage, opt_localize, opt_window, aArgs) {
      var message;
      try {
         this.countPrompt();
         message = opt_localize ? this.m_getMessage(aMessage) : aMessage;
         this.m_dialogs.push(new this.m_DialogWindow(
            'ui/content/dejaAuthLogin.html',
            {
               message: message,
               args: aArgs
            },
            this.centerDialog.bind(this,
               (opt_window == null) ? null : opt_window),
            this.closeDialog.bind(this, this.m_dialogs.length)));
            
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },
   
   /**
    * Display an alert to the user via a popup dialog.
    * @this {!DejaClick.PromptService}
    * @param {string} aMessage The contents of the alert.
    * @param {boolean=} opt_localize If true, then aMessage is the name of
    *    a localizable message. Otherwise, it is the text to display.
    * @param {string=} opt_extra Optional additional details to include
    *    in the alert.
    * @param {Window=} opt_window Window over which to display the alert.
    */
   alertUser: function (aMessage, opt_localize, opt_extra, opt_window) {
      var message;
      try {
         if (this.m_prefService.getPrefOption('DC_OPTID_RUNINTERACTIVE')) {
            this.countPrompt();
            message = opt_localize ? this.m_getMessage(aMessage) : aMessage;
            opt_extra =  ((opt_extra == null) || (opt_extra === '')) ? "   " : opt_extra; 
            if ((opt_extra == null) || (opt_extra === '')) {
               ((opt_window == null) ? this.m_window : opt_window).
                  alert(message);
            } else {
               this.m_dialogs.push(new this.m_DialogWindow(
                  'ui/content/dejaNotify.html',
                  {
                     message: message,
                     extraInfo: opt_extra
                  },
                  this.centerDialog.bind(this,
                     (opt_window == null) ? null : opt_window),
                  this.closeDialog.bind(this, this.m_dialogs.length)));
            }
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Create a customizable user query dialog. The dialog consists of
    * a question that a user answers by pressing one of several
    * buttons. The number and text of these buttons is fully
    * configurable. An extra yes/no question may also be asked of the
    * user by specifying the text and a default response. The dialog
    * will be centered on the screen (or over a window if one is
    * specified). The answers to the questions are returned asynchronously
    * to a callback function.
    * @this {!DejaClick.PromptService}
    * @param {!{
    *    title: (string|undefined),
    *    question: string,
    *    extraText: (string|undefined),
    *    extraValue: (boolean|undefined),
    *    buttons: Array.<string>,
    *    window: (Window|undefined)
    * }} aDetails Characteristics of the dialog to be opened. The
    *    strings are message names.
    * @param {function(integer, boolean)} aCallback Function called when
    *    the dialog is closed. The arguments are the (zero-based) index of
    *    the button that was pressed and the response of the extra question.
    */
   confirmUser: function (aDetails, aCallback) {
      var details, index;

      details = {
         title: this.m_getMessage((aDetails.title == null) ?
                                  'deja_confirm_title' : aDetails.title),
         question: this.m_getMessage(aDetails.question),
         buttons: []
      };
      for (index = 0; index !== aDetails.buttons.length; ++index) {
         details.buttons.push(this.m_getMessage(aDetails.buttons[index]));
      }
      if ((aDetails.extraText !== null) && (aDetails.extraText !== undefined)) {
         details.extraText = this.m_getMessage(aDetails.extraText);
         details.extraValue = Boolean(aDetails.extraValue);
      }
      this.countPrompt();
      this.m_dialogs.push(new this.m_DialogWindow(
         'ui/content/dejaConfirm.html',
         details,
         this.centerDialog.bind(this,
            (aDetails.window == null) ? null : aDetails.window),
         this.closeConfirmDialog.bind(this, this.m_dialogs.length, aCallback)));
   },

   /**
    * Center a notification dialog window over an existing window
    * (or on the screen).
    * @private
    * @this {!DejaClick.PromptService}
    * @param {?Window} aWindow Optional window over which to position
    *    the dialog.
    * @param {!DejaClick.DialogWindow} aDialog The dialog window to be
    *    repositioned.
    */
   centerDialog: function (aWindow, aDialog) {
      try {
         aDialog.centerOn(aWindow ? aWindow : this.m_window);
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Mark the associated confirm dialog as having been closed.
    * Pass the reply to the callback.
    * @private
    * @this {!DejaClick.PromptService}
    * @param {integer} aIndex The index of the closed dialog in the
    *    m_dialogs array.
    * @param {function(integer, boolean)} aCallback Function to inform
    *    the client of the response to the dialog.
    * @param {!{button:integer, check:boolean}} aReply Reply returned
    *    from the dialog.
    */
   closeConfirmDialog: function (aIndex, aCallback, aReply) {
      try {
         this.closeDialog(aIndex);
         aCallback(aReply.button, aReply.check);
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Mark the associated dialog as having been closed.
    * @private
    * @this {!DejaClick.PromptService}
    * @param {integer} aIndex The index of the closed dialog in the
    *    m_dialogs array.
    */
   closeDialog: function (aIndex) {
      var index;
      try {
         this.m_dialogs[aIndex] = null;
         index = this.m_dialogs.length;
         while (index !== 0) {
            --index;
            if (this.m_dialogs[index] !== null) {
               break;
            }
            this.m_dialogs.pop();
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   }
};
