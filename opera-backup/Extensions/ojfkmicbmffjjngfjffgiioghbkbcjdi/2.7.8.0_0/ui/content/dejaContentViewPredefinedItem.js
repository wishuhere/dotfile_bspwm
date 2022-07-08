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

'use strict';

/**
 * Preferred width of the add/edit CV predefined item dialog.
 * @const
 */
var preferredWidth = 370;

/**
 * Preferred height of the add/edit CV predefined item dialog.
 * @const
 */
var preferredHeight = 250;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of adding/editing CV
 *    predefined item
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{ item: !Object,
 *    itemManager: {isNameExist: Function}
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!chrome.WindowsApi} aWindowsApi The chrome.windows API.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.CVPredefinedItem = function (aOptions, aRootElement, aWindow,
                                         aWindowsApi, aConstants, aUtils,
                                         AEventRegistration) {
   var root;

   aWindow.returnValue = null;

   this.item = aOptions.item;
   this.itemManager = aOptions.itemManager;
   this.window = aWindow;
   this.windowsApi = aWindowsApi;
   this.constants = aConstants;
   this.utils = aUtils;

   this.events = new AEventRegistration().
      enable(false).
      addChromeListener(aWindowsApi.onRemoved, this.removeRegularExpressionHelpWindow, this);

   /**
    * Identity of the window containing regular expression help.
    * @type {integer|null}
    */
   this.helpWindowId = null;

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),

      itemName: root.find('#predefinedItemName'),
      itemDescription: root.find('#predefinedItemDescription'),
      itemValue: root.find('#predefinedItemValue'),

      regExpHelp: root.find('#regExpHelp'),

      itemErrorMsg: root.find('#predefinedItemErrorMsg'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allInputs: root.find('input'),
      allButtons: root.find('button')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));

   this.elements.allInputs.on('change input', this.enableControls.bind(this));

   this.elements.regExpHelp.on('click', this.showRegularExpressionHelp.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.CVPredefinedItem.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.CVPredefinedItem,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.CVPredefinedItem}
    */
   init: function() {
      var item = this.item;

      try {
         // Display initial values in UI.
         this.elements.title.text(this.utils.getMessage('deja_contentViewPredefinedItem_title'));

         this.elements.itemName.val(item && item.name || '');
         this.elements.itemDescription.val(item && item.description || '');
         this.elements.itemValue.val(item && item.value || '');

         this.enableControls();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.CVPredefinedItem}
    */
   close: function () { // @TODO review when finished
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.allInputs.off('change input');
            this.elements.allButtons.off('click').button('destroy');
            this.elements.regExpHelp.off('click');
         }

         if (this.hasOwnProperty('helpWindowId') &&
               (this.helpWindowId !== null) &&
               this.hasOwnProperty('windowsApi')) {
            this.windowsApi.remove(this.helpWindowId);
         }

         if (this.hasOwnProperty('events')) {
            this.events.close();
         }

         delete this.elements;
         delete this.helpWindowId;
         delete this.events;
         delete this.utils;
         delete this.constants;
         delete this.windowsApi;
         delete this.window;
         delete this.itemManager;
         delete this.item;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this CV predefined item. Close the window.
    * @this {!DejaClickUi.CVPredefinedItem}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var item = {}, itemName, win;

      try {
         itemName = this.elements.itemName.val();

         if (this.itemManager.isNameExist(itemName) == false || this.item && this.item.name === itemName) {
            item = {
               name: itemName,
               description: this.elements.itemDescription.val(),
               value: this.elements.itemValue.val()
            };

            this.window.returnValue = Object.keys(item).length && item || null;

            // Close the object first to ensure that the help window is closed.
            win = this.window;
            this.close();
            win.close();
         } else {
            this.utils.promptService.notifyUser("deja_contentViewPredefinedItem_itemNameExists", true);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.CVPredefinedItem}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;

      try {
         // Close the object first to ensure that the help window is closed.
         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open (or focus) a window containing help on writing regular expressions.
    * @this {!DejaClickUi.CVPredefinedItem}
    * @param {!Event} aEvent A jQuery click event on the regular expression
    *    help link.
    */
   showRegularExpressionHelp: function (aEvent) {
      try {
         if (this.helpWindowId == null) {
            this.windowsApi.create({
               url: this.constants.REGEXP_HELP_URL,
               focused: true,
               incognito: false,
               type: 'popup'
            }, this.rememberRegularExpressionHelpWindow.bind(this));
         } else {
            this.windowsApi.update(this.helpWindowId,
               { focused: true, state: 'normal' });
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Store a reference to the window that was opened to display
    * help on writing regular expressions.
    * @this {!DejaClickUi.CVPredefinedItem}
    * @param {chrome.Window=} opt_window The window that was opened.
    */
   rememberRegularExpressionHelpWindow: function (opt_window) {
      try {
         if (this.hasOwnProperty('windowsApi') &&
            (opt_window !== null) &&
            (opt_window !== undefined)) {
            this.helpWindowId = opt_window.id;
            this.events.enable(true);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Detect when the regular expression help window is closed.
    * @this {!DejaClickUi.CVPredefinedItem}
    * @param {integer} aId The id of the window that has been closed.
    */
   removeRegularExpressionHelpWindow: function (aId) {
      try {
         if (aId === this.helpWindowId) {
            this.helpWindowId = null;
            this.events.enable(false);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.CVPredefinedItem}
    */
   enableControls: function () {
      var isInvalid = false, data = {}, i, l, keys, testRegExp,
         isNameEmpty, isValueEmpty;

      try {
         data = {
            name: this.elements.itemName.val(),
            description: this.elements.itemDescription.val(),
            value: this.elements.itemValue.val()
         };

         keys = Object.keys(data);

         isNameEmpty = data.name.length === 0;
         isValueEmpty = data.value.length === 0;

         for (i = 0, l = keys.length; i < l; i++) {
            // :: and ||  are dividers in a script params
            // so they shouldn't be entered. never. never ever.
            if (data[keys[i]].search(/\:\:|\|\|/) !== -1) {
               this.elements.itemErrorMsg
                  .text(this.utils.getMessage('deja_contentViewPredefinedItem_invalidURL'));
               isInvalid = true;

               break;
            }
            // regexp should be valid
            else if (keys[i] == 'value') {
               try {
                  testRegExp = new RegExp(data.value);
               } catch ( ex ) {
                  this.elements.itemErrorMsg
                     .text(this.utils.getMessage('deja_contentViewPredefinedItem_invalidRegexp'));
                  isInvalid = true;

                  break;
               }
            }
         }

         if (!isInvalid) {
            this.elements.itemErrorMsg.text('');
         }

         this.elements.apply.button('option', 'disabled',
            isNameEmpty ||
            isValueEmpty ||
            isInvalid);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('cvPredefinedItem')) {
            DejaClickUi.cvPredefinedItem.close();
            delete DejaClickUi.cvPredefinedItem;
         }

         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the CVPredefinedItem instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.cvPredefinedItem = new DejaClickUi.CVPredefinedItem(
            window.dialogArguments,
            document.documentElement,
            window,
            chrome.windows,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.EventRegistration);
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