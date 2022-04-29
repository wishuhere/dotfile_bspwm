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
 * Add/edit custom header dialog.
 * Input: {{context:!Element,item:?Element}} Element of the script
 *    whose properties are being edited (assumed to be the "script"
 *    element) and the header script element to be edited (or null to
 *    add a new header).
 * Output: {?Element} The successfully changed header element or null if
 *    operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the add/edit custom header dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the add/edit custom header dialog.
 * @const
 */
var preferredHeight = 200;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of custom HTTP header editing.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {?Element} aItem The header element to be edited, or null to
 *    add a new custom header.
 * @param {!Element} aRootElement The root element of the UI for custom
 *    header editing (i.e., the documentElement).
 * @param {!Window} aWindow The global window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    header applies.
 */
DejaClickUi.Header = function (aItem, aRootElement, aWindow,
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
      name: root.find('#headerName'),
      value: root.find('#headerValue'),
      merge: root.find('#merge'),
      replace: root.find('#replace'),
      apply: root.find('#apply'),
      cancel: root.find('#cancel'),
      remove: root.find('#remove'),
      allButtons: root.find('button')
   };

   aUtils.localizeTree(aRootElement, 'deja_');

   // Display initial values in UI.
   if (this.item == null) {
      // Add a new custom header.
      this.elements.title.text(aUtils.getMessage('deja_header_addTitle'));
      this.elements.description.
         text(aUtils.getMessage('deja_header_addDescription'));
      this.elements.name.val('');
      this.elements.value.val('');
      this.elements.merge.prop('checked', true);
      this.elements.remove.hide();

   } else {
      // Edit an existing custom header.
      this.elements.title.text(aUtils.getMessage('deja_header_editTitle'));
      this.elements.description.
         text(aUtils.getMessage('deja_header_editDescription'));
      this.elements.name.
         val(aScript.domTreeGetHeaderParam(this.item, 'headername'));
      this.elements.value.
         val(aScript.domTreeGetHeaderParam(this.item, 'headertext'));
      if (aScript.domTreeGetHeaderParam(this.item, 'mergetype') ===
            aConstants.HEADER_REPLACE) {
         this.elements.replace.prop('checked', true);
      } else {
         this.elements.merge.prop('checked', true);
      }
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

DejaClickUi.Header.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Header,

   /**
    * Shut down the dialog in response to the window being closed.
    * Release all references to objects external to this page.
    * @this {!DejaClickUi.Header}
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
    * Enable or disable the apply button based upon the new header name.
    * @this {!DejaClickUi.Header}
    * @param {!Event} aEvent A jQuery input event on the header name element.
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
    * Close the dialog, applying changes from UI to the header element.
    * @this {!DejaClickUi.Header}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   apply: function (aEvent) {
      var scriptElt, headersElt;
      try {
         if (this.item == null) {
            scriptElt = this.script.getScriptElement();
            headersElt = this.script.getChildWithTag(scriptElt, 'headers');
            if (headersElt == null) {
               headersElt = this.script.domTreeInsertNode(scriptElt, 'headers');
            }
            this.item = this.script.domTreeInsertNode(headersElt, 'header');
            this.item.setAttribute('type', this.constants.HEADERTYPE_REQUEST);
         }

         this.script.domTreeChangeHeaderParam(this.item, 'headername',
            this.elements.name.val());
         this.script.domTreeChangeHeaderParam(this.item, 'headertext',
            this.elements.value.val());
         this.script.domTreeChangeHeaderParam(this.item, 'mergetype',
            (this.elements.replace.prop('checked') ?
               this.constants.HEADER_REPLACE :
               this.constants.HEADER_MERGE));
         this.script.renumberElements('header');

         this.window.returnValue = this.item;
         this.window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.Header}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      try {
         this.window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Remove the header being edited. Then close the dialog window.
    * @this {!DejaClickUi.Header}
    * @param {!Event} aEvent A jQuery click event on the remove button.
    */
   remove: function (aEvent) {
      var headersElt;
      try {
         this.window.returnValue = this.item;

         headersElt = this.item.parentNode;
         this.script.domTreeRemoveNode(this.item);
         if (headersElt.firstElementChild == null) {
            this.script.domTreeRemoveNode(headersElt);
         } else {
            this.script.renumberElements('header');
         }
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
         if (DejaClickUi.hasOwnProperty('header')) {
            DejaClickUi.header.close();
            delete DejaClickUi.header;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the header instance once the page is
    * loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.header = new DejaClickUi.Header(
            window.dialogArguments.item,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.script);
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
