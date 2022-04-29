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
 * Dialog to ask the user whether to save the current script before
 * performing an action that may discard it. This could be done with
 * PromptService.confirmUser, except that a file load can only be
 * triggered from within a user event handler (as far as I can tell).
 * Input: {{
 *    save: function(),
 *    action: ?function(),
 *    script: !DejaClick.Script
 * }}
 * Output: {boolean} true if the original action should be taken.
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the DejaClick confirm dialog.
 * @const
 */
var preferredWidth = 385;
/**
 * Preferred height of the DejaClick confirm dialog.
 * @const
 */
var preferredHeight = 125;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = false;


/**
 * Manage the DejaClick PromptSave dialog window.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    save: function(),
 *    action: ?function(),
 *    script: !DejaClick.Script
 * }} aArgs The arguments passed to the dialog window. These are the
 *    functions to invoke based upon which button is clicked.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */
DejaClickUi.PromptSave = function (aArgs, aRootElement, aWindow, aUtils) {
   var root, buttons, index;

   this.window = aWindow;
   this.logger = aUtils.logger;
   this.save = aArgs.save;
   this.action = aArgs.action;
   this.script = aArgs.script;

   aUtils.localizeTree(aRootElement, 'deja_');

   this.buttons = $(aRootElement).find('button');

   this.buttons.button().on('click', this.processClick.bind(this));
};

DejaClickUi.PromptSave.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.PromptSave,

   /**
    * Shut down the dialog, releasing all references to external objects
    * and unregistering all event handlers.
    * @this {!DejaClickUi.PromptSave}
    */
   close: function () {
      if (this.hasOwnProperty('buttons')) {
         this.buttons.off('click').button('destroy');
      }
      delete this.buttons;
      delete this.script;
      delete this.action;
      delete this.save;
      delete this.logger;
      delete this.window;
   },

   /**
    * Close the dialog window in response to a click on a button.
    * @this {!DejaClickUi.PromptSave}
    * @param {!Event} aEvent A jQuery click event on a button.
    */
   processClick: function (aEvent) {
      var choice, script;
      try {
         choice = Number(aEvent.currentTarget.value);
         if (choice === 0) {
            this.save();
         } else if (choice === 2) {
            this.script.clearChangesPending();
            if (this.action !== null) {
               this.action();
            }
            window.returnValue = true;
         } // else do nothing (cancel)
         this.window.close();
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
         if (DejaClickUi.hasOwnProperty('promptSave')) {
            DejaClickUi.promptSave.close();
            delete DejaClickUi.promptSave;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the PromptSave instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.promptSave = new DejaClickUi.PromptSave(
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
