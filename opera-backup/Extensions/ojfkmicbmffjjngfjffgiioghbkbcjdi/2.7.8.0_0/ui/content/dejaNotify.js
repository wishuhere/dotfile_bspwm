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
 * Notification dialog that presents an alert to the user along with
 * some additional information that may be revealed.
 * Input: {{
 *    message: string,
 *    extraInfo: string,
 *    extraInfoLabel: ?string
 * }}
 * Output: none
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the notification dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the notification dialog.
 * @const
 */
var preferredHeight = 200;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}


/**
 * Manage the DejaClick Notification dialog window.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    message: string,
 *    extraInfo: string,
 *    extraInfoLabel: ?string
 * }} aArgs The arguments passed to the dialog window. This is the text
 *    to be displayed.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */
DejaClickUi.Notify = function (aArgs, aRootElement, aWindow, aUtils) {
   var root;

   this.window = aWindow;
   this.logger = aUtils.logger;

   root = $(aRootElement);
   this.elements = {
      root: root,
      icon: root.find('#alertImage'),
      messageText: root.find('#messageText'),
      details: root.find('details'),
      okButton: root.find('button')
   };

   aUtils.localizeTree(aRootElement, 'deja_');

   this.elements.messageText.html(aArgs.message.replace(/\n/g, '<br>'));
   root.find('#extraText').html(aArgs.extraInfo.replace(/\n/g, '<br>'));
   if (aArgs.extraInfoLabel != null) {
      root.find('summary').text(aArgs.extraInfoLabel);
   }
   if (aArgs.extraInfo === "   ") {
      root.find('details').hide();
   }

   this.elements.okButton.button().on('click', this.confirm.bind(this));
   this.elements.details.on('click', this.triggerResizeWindow.bind(this));
   $(this.window).on('resize', this.resizeMessageText.bind(this));

   this.resizeMessageText();
};

DejaClickUi.Notify.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Notify,

   /**
    * Shut down the dialog, releasing all references to external objects
    * and unregistering all event handlers.
    * @this {!DejaClickUi.Notify}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.okButton.off('click').button('destroy');
         this.elements.details.off('click');
      }
      if (this.hasOwnProperty('window')) {
         $(this.window).off('resize');
      }
      delete this.elements;
      delete this.logger;
      delete this.window;
   },

   /**
    * Close the dialog window in response to a click on the OK button.
    * @this {!DejaClickUi.Notify}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   confirm: function (aEvent) {
      try {
            DejaClick.service.__modal.close();
            DejaClickUi.notify.close();
            delete DejaClickUi.notify;
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Adjust the width of the message text element in response to a
    * change in the width of the window.
    * @this {!DejaClickUi.Notify}
    * @param {Event=} opt_event A jQuery resize event on the window.
    */
   resizeMessageText: function (opt_event) {
      var available;
      try {
         available = this.elements.icon.parent().innerWidth() -
            this.elements.icon.outerWidth(true) -
            (this.elements.messageText.outerWidth(true) -
               this.elements.messageText.innerWidth());
         if (available < 100) {
            available = 100;
         }
         this.elements.messageText.width(available);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Trigger a change in the size of the window in response to the
    * details element being opened or closed. This is done
    * asynchronously because the details element has not yet been
    * changed.
    * @this {!DejaClickUi.Notify}
    * @param {!Event} aEvent A jQuery click event on the details element
    */
   triggerResizeWindow: function (aEvent) {
      try {
         this.window.setTimeout(this.resizeWindow.bind(this), 0);
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
    * Create and initialize the Notify instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.notify = new DejaClickUi.Notify(
            DejaClick.service.__modal.arguments,
            document.documentElement,
            window,
            DejaClick.utils);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);

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
