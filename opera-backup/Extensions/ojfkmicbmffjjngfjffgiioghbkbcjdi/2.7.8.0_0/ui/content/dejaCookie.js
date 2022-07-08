/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick for Chrome by SmartBear Software.
* Copyright (C) 2006-2022 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

/*
 * Add/edit custom cookie dialog.
 * Input: {{context:!Element,item:?Element}} Element of the script
 *    whose properties are being edited (assumed to be the "script"
 *    element) and the cookie script element to be edited (or null to
 *    add a new cookie).
 * Output: {?Element} The successfully changed cookie element or null if
 *    operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the add/edit custom cookie dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the add/edit custom cookie dialog.
 * @const
 */
var preferredHeight = 200;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of custom cookie editing.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {?Element} aItem The cookie element to be edited, or null to
 *    add a new custom cookie.
 * @param {!Element} aRootElement The root element of the UI for custom
 *    cookie editing (i.e., the documentElement).
 * @param {!Window} aWindow The global window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    cookie applies.
 */
DejaClickUi.Cookie = function (aItem, aRootElement, aWindow,
      aConstants, aUtils, aScript) {
   var root;

   aWindow.returnValue = null;

   this.item = (aItem == null) ? null : aItem;
   this.window = aWindow;
   this.constants = aConstants;
   this.logger = aUtils.logger;
   this.script = aScript;

   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),
      url: root.find('#cookieUrl'),
      name: root.find('#cookieName'),
      value: root.find('#cookieValue'),
      apply: root.find('#apply'),
      cancel: root.find('#cancel'),
      remove: root.find('#remove'),
      allButtons: root.find('button')
   };

   aUtils.localizeTree(aRootElement, 'deja_'); 

   // Display initial values in UI.
   if (this.item == null) {
      // Add a new custom cookie.
      DejaClick.service.__modal.setTitle('deja_cookie_addTitle');
      this.elements.description.
         text(aUtils.getMessage('deja_cookie_addDescription'));
      this.elements.url.val('');
      this.elements.name.val('');
      this.elements.value.val('');
      this.elements.remove.hide();

   } else {
      // Edit an existing custom cookie.
      DejaClick.service.__modal.setTitle('deja_cookie_editTitle');
      this.elements.description.
         text(aUtils.getMessage('deja_cookie_editDescription'));
      this.elements.url.
         val(aScript.domTreeGetHeaderParam(this.item, 'url'));
      this.elements.name.
         val(aScript.domTreeGetHeaderParam(this.item, 'name'));
      this.elements.value.
         val(aScript.domTreeGetHeaderParam(this.item, 'value'));
   }

   // Initialize event handlers.
   this.elements.allButtons.button();
   this.elements.apply.button('option', 'disabled',
      (this.elements.name.val().length === 0));

   this.elements.name.on('input', this.changeValue.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.remove.on('click', this.remove.bind(this));
};

DejaClickUi.Cookie.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Cookie,

   /**
    * Shut down the dialog in response to the window being closed.
    * Release all references to objects external to this page.
    * @this {!DejaClickUi.Cookie}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.name.off('input');
      }

      delete this.elements;
      delete this.script;
      delete this.logger;
      delete this.constants;
      delete this.window;
      delete this.item;
   },

   /**
    * Enable or disable the apply button based upon the new cookie name.
    * @this {!DejaClickUi.Cookie}
    * @param {!Event} aEvent A jQuery input event on the cookie name element.
    */
   changeValue: function (aEvent) {
      try {
         this.elements.apply.button('option', 'disabled',
            (this.elements.name.val().length === 0));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, applying changes from UI to the cookie element.
    * @this {!DejaClickUi.Cookie}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   apply: function (aEvent) {
      var scriptElt, cookiesElt;
      try {
         if (this.item == null) {
            scriptElt = this.script.getScriptElement();
            cookiesElt = this.script.getChildWithTag(scriptElt, 'cookies');
            if (cookiesElt == null) {
               cookiesElt = this.script.domTreeInsertNode(scriptElt, 'cookies');
            }
            this.item = this.script.domTreeInsertNode(cookiesElt, 'cookie');
         }

         this.script.domTreeChangeHeaderParam(this.item, 'url',
            this.elements.url.val());
         this.script.domTreeChangeHeaderParam(this.item, 'name',
            this.elements.name.val());
         this.script.domTreeChangeHeaderParam(this.item, 'value',
            this.elements.value.val());
         this.script.renumberElements('cookie');

         this.window.returnValue = this.item;
         this.window.close();
         DejaClick.service.__modal.close();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.Cookie}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      try {
         this.window.close();
         DejaClick.service.__modal.close();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Remove the cookie being edited. Then close the dialog window.
    * @this {!DejaClickUi.Cookie}
    * @param {!Event} aEvent A jQuery click event on the remove button.
    */
   remove: function (aEvent) {
      var cookiesElt;
      try {
         this.window.returnValue = this.item;

         cookiesElt = this.item.parentNode;
         this.script.domTreeRemoveNode(this.item);
         if (cookiesElt.firstElementChild == null) {
            this.script.domTreeRemoveNode(cookiesElt);
         } else {
            this.script.renumberElements('cookie');
         }
         this.window.close();
         DejaClick.service.__modal.close();

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
         if (DejaClickUi.hasOwnProperty('cookie')) {
            DejaClickUi.cookie.close();
            delete DejaClickUi.cookie;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the cookie instance once the page is
    * loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.cookie = new DejaClickUi.Cookie(
            DejaClick.service.__modal.arguments.item,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.script);
            DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);

         $(window).on('unload', unload);
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
