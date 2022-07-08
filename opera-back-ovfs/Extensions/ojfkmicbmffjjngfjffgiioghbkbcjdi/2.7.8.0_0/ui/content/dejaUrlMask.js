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
 * Add/edit URL exclusion dialog.
 * Input: {{context:!Element,item:?Element}} Element of the script
 *    whose properties are being edited (assumed to be the "script"
 *    element) and the urlmask script element to be edited (or null to
 *    add a new URL mask).
 * Output: {?Element} The successfully changed (or removed) urlmask
 *    element or null if operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit URL mask dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the add/edit URL mask dialog.
 * @const
 */
var preferredHeight = 250;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of URL mask editing.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {?Element} aItem The urlmask element to be edited, or null to
 *    add a new URL mask.
 * @param {!Element} aRootElement The root element of the UI for URL
 *    mask editing (i.e., the documentElement).
 * @param {!Window} aWindow The window object.
 * @param {!chrome.WindowsApi} aWindowsApi The chrome.windows API.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    URL mask applies.
 */
DejaClickUi.UrlMask = function (aItem, aRootElement, aWindow, aWindowsApi,
      aConstants, AEventRegistration, aUtils, aScript) {
   var root;

   aWindow.returnValue = null;
   this.item = (aItem == null) ? null : aItem;
   this.window = aWindow;
   this.windowsApi = aWindowsApi;
   this.constants = aConstants;
   this.logger = aUtils.logger;
   this.script = aScript;

   this.events = new AEventRegistration().
      enable(false).
      addChromeListener(aWindowsApi.onRemoved, this.removeWindow, this);

   /**
    * Identity of the window containing regular expression help.
    * @type {?integer}
    */
   this.helpWindowId = null;

   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),
      matchText: root.find('#matchText'),
      plainText: root.find('#plainText'),
      regexp: root.find('#regexp'),
      ignore: root.find('#ignore'),
      regexpHelp: root.find('#regexpHelp'),
      block: root.find('#block'),
      apply: root.find('#apply'),
      remove: root.find('#remove'),
      cancel: root.find('#cancel'),
      allButtons: root.find('button')
   };

   aUtils.localizeTree(aRootElement, 'deja_');

   // Display initial values in UI.
   if (this.item == null) {
      // Add a new URL mask.
      DejaClick.service.__modal.setTitle('deja_urlmask_addTitle');
      this.elements.description.
         text(aUtils.getMessage('deja_urlmask_addDescription'));

      this.elements.matchText.val('');
      this.elements.plainText.prop('checked', true);
      this.elements.ignore.prop('checked', true);

      this.elements.remove.hide();

   } else {
      // Edit an existing URL mask.
      DejaClick.service.__modal.setTitle('deja_urlmask_editTitle');
      this.elements.description.
         text(aUtils.getMessage('deja_urlmask_editDescription'));

      this.elements.matchText.val(aScript.domTreeGetUrlMaskParam(this.item,
         'matchtext'));
      if (aScript.domTreeGetUrlMaskParam(this.item, 'matchtype') ===
            aConstants.URLMASK_STYLE_REGEXP) {
         this.elements.regexp.prop('checked', true);
      } else {
         this.elements.plainText.prop('checked', true);
      }
      if (this.item.getAttribute('type') === aConstants.URLMASK_TYPE_BLOCK) {
         this.elements.block.prop('checked', true);
      } else {
         this.elements.ignore.prop('checked', true);
      }
   }

   // Initialize event handlers.
   this.elements.allButtons.button();
   this.elements.apply.button('option', 'disabled',
      (this.elements.matchText.val().length === 0));

   this.elements.matchText.on('input', this.changeValue.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.remove.on('click', this.remove.bind(this));
   this.elements.regexpHelp.on('click',
      this.showRegularExpressionHelp.bind(this));
};

DejaClickUi.UrlMask.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.UrlMask,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.UrlMask}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.matchText.off('input');
         this.elements.allButtons.off('click').button('destroy');
         this.elements.regexpHelp.off('click');
         delete this.elements;
      }

      if (this.hasOwnProperty('helpWindowId') &&
            (this.helpWindowId !== null) &&
            this.hasOwnProperty('windowsApi')) {
         this.windowsApi.remove(this.helpWindowId);
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.helpWindowId;
      delete this.events;
      delete this.script;
      delete this.logger;
      delete this.constants;
      delete this.windowsApi;
      delete this.window;
      delete this.item;
   },

   /**
    * Enable or disable the apply button based upon the new value
    * of the pattern to be matched.
    * @this {!DejaClickUi.UrlMask}
    * @param {!Event} aEvent A jQuery input event on the matchText element.
    */
   changeValue: function (aEvent) {
      try {
         this.elements.apply.button('option', 'disabled',
            (this.elements.matchText.val().length === 0));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.UrlMask}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;
      try {
         // Close the UrlMask object first to ensure that the help
         // window is closed.
         this.close();
         DejaClick.service.__modal.close();        
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, applying changes from UI to the urlmask element.
    * @this {!DejaClickUi.UrlMask}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   apply: function (aEvent) {
      var scriptElt, parent, win;
      try {
         // @todo Warn if block URL is selected.

         if (this.item == null) {
            // Create new urlmask element in add mode.
            scriptElt = this.script.getScriptElement();
            parent = this.script.getChildWithTag(scriptElt, 'urlmasks');
            if (parent == null) {
               parent = this.script.domTreeInsertNode(scriptElt, 'urlmasks');
            }
            this.item = this.script.domTreeInsertNode(parent, 'urlmask');
         }

         this.script.renumberElements('urlmask');
         this.script.domTreeChangeUrlMaskParam(this.item, 'matchtext',
            this.elements.matchText.val());
         this.script.domTreeChangeUrlMaskParam(this.item, 'matchtype',
            (this.elements.regexp.prop('checked') ?
               this.constants.URLMASK_STYLE_REGEXP :
               this.constants.URLMASK_STYLE_PLAINTEXT));
         this.item.setAttribute('type',
            (this.elements.block.prop('checked') ?
               this.constants.URLMASK_TYPE_BLOCK :
               this.constants.URLMASK_TYPE_IGNORE));

         this.window.returnValue = this.item;
         // Close the UrlMask object first to ensure that the help
         // window is closed.
         this.close();
         DejaClick.service.__modal.close(this.item);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Remove the URL mask being edited. Then close the dialog window.
    * @this {!DejaClickUi.UrlMask}
    * @param {!Event} aEvent A jQuery click event on the remove button.
    */
   remove: function (aEvent) {
      var urlmasks, win;
      try {
         this.window.returnValue = this.item;

         urlmasks = this.item.parentNode;
         this.script.domTreeRemoveNode(this.item);
         if (urlmasks.firstElementChild == null) {
            this.script.domTreeRemoveNode(urlmasks);
         } else {
            this.script.renumberElements('urlmask');
         }
         // Close the UrlMask object first to ensure that the help
         // window is closed.
         this.close();
         DejaClick.service.__modal.close(this.window.returnValue);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * URL providing help on writing regular expressions.
    * @const
    */
   REGEXP_HELP_URL: 'https://www.alertsite.com/cgi-bin/helpme.cgi?page=RegexMatching.html',

   /**
    * Open (or focus) a window containing help on writing regular expressions.
    * @this {!DejaClickUi.UrlMask}
    * @param {!Event} aEvent A jQuery click event on the regular expression
    *    help link.
    */
   showRegularExpressionHelp: function (aEvent) {
      try {
         if (this.helpWindowId == null) {
            this.windowsApi.create({
               url: this.REGEXP_HELP_URL,
               focused: true,
               incognito: false,
               type: 'popup'
            }, this.rememberRegularExpressionHelpWindow.bind(this));
         } else {
            this.windowsApi.update(this.helpWindowId,
               { focused: true, state: 'normal' });
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Store a reference to the window that was opened to display
    * help on writing regular expressions.
    * @this {!DejaClickUi.UrlMask}
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
         this.logger.logException(ex);
      }
   },

   /**
    * Detect when the regular expression help window is closed.
    * @this {!DejaClickUi.UrlMask}
    * @param {integer} aId The id of the window that has been closed.
    */
   removeWindow: function (aId) {
      try {
         if (aId === this.helpWindowId) {
            this.helpWindowId = null;
            this.events.enable(false);
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
         if (DejaClickUi.hasOwnProperty('urlMask')) {
            DejaClickUi.urlMask.close();
            delete DejaClickUi.urlMask;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the UrlMask instance once the page is
    * loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.urlMask = new DejaClickUi.UrlMask(
            DejaClick.service.__modal.arguments.item,
            document.documentElement,
            window,
            chrome.windows,
            DejaClick.constants,
            DejaClick.EventRegistration,
            DejaClick.utils,
            DejaClick.script);
         $(window).on('unload', unload);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);

      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (DejaClick.service.__modal) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
