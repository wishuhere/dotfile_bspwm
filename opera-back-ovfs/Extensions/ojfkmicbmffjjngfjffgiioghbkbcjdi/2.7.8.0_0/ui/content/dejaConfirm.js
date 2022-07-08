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
 * Notification dialog that presents a prompt to the user and
 * a configurable number of buttons with which to reply. An optional
 * checkbox may also be displayed for a secondary question.
 * Input: {{
 *    title: string,
 *    question: string,
 *    buttons: !Array.<string>,
 *    extraText: (string|undefined),
 *    extraValue: (boolean|undefined)
 * }}
 * Output: {{
 *    button: integer,
 *    check: boolean
 * }}
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the DejaClick confirm dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the DejaClick confirm dialog.
 * @const
 */
var preferredHeight = 250;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = {
   button: -1,
   check: false
};


/**
 * Manage the DejaClick Confirm dialog window.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    title: string,
 *    question: string,
 *    buttons: !Array.<string>,
 *    extraText: (string|undefined),
 *    extraValue: (boolean|undefined)
 * }} aArgs The arguments passed to the dialog window. This is the text
 *    to be displayed.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */
DejaClickUi.Confirm = function (aArgs, aRootElement, aWindow, aUtils) {
   var root, buttons, index;

   this.window = aWindow;
   this.logger = aUtils.logger;

   root = $(aRootElement);

   root.find('title').text(aArgs.title);
   root.find('#question').html(aArgs.question.replace(/\n/g, '<br>'));
   buttons = root.find('#buttons');
   for (index = 0; index < aArgs.buttons.length; ++index) {
      buttons.append($('<button>').
                     text(aArgs.buttons[index]).
                     prop('value', index));
   }
   this.elements = {
      buttons: root.find('button'),
      extraBox: root.find('#extraBox')
   };
   this.elements.buttons.button().on('click', this.processClick.bind(this));
   this.elements.buttons[0].focus();

   if (aArgs.extraText == null) {
      root.find('#extraDiv').hide();
   } else {
      root.find('#extraText').html(aArgs.extraText.replace(/\n/g, '<br>'));
      this.elements.extraBox.on('change', this.recordCheck.bind(this));
      this.elements.extraBox.prop('checked', aArgs.extraValue === true);
   }

   aWindow.returnValue = {
      button: aArgs.buttons.length - 1,
      check: aArgs.extraValue === true
   };
};

DejaClickUi.Confirm.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Confirm,

   /**
    * Shut down the dialog, releasing all references to external objects
    * and unregistering all event handlers.
    * @this {!DejaClickUi.Confirm}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.buttons.off('click').button('destroy');
         this.elements.extraBox.off('change');
      }
      delete this.elements;
      delete this.logger;
      delete this.window;
   },

   /**
    * Close the dialog window in response to a click on a button.
    * @this {!DejaClickUi.Confirm}
    * @param {!Event} aEvent A jQuery click event on a button.
    */
   processClick: function (aEvent) {
      try {
         this.window.returnValue.button = Number(aEvent.currentTarget.value);
         DejaClick.service.__modal.close(this.window.returnValue);

         this.window.close();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the return value with the current setting of the check box.
    * @this {!DejaClickUi.Confirm}
    * @param {!Event} aEvent A jQuery change event on the checkbox.
    */
   recordCheck: function (aEvent) {
      try {
         this.window.returnValue.check = this.elements.extraBox.prop('checked');
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
         if (DejaClickUi.hasOwnProperty('confirm')) {
            DejaClickUi.confirm.close();
            delete DejaClickUi.confirm;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the Confirm instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.confirm = new DejaClickUi.Confirm(
            DejaClick.service.__modal.arguments,
            document.documentElement,
            window,
            DejaClick.utils);
         $(window).on('unload', unload);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
         DejaClick.service.__modal.setTitle(DejaClick.service.__modal.arguments.title);

      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (DejaClick.service.__modal.arguments) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
