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

/**
 * Preferred width of the add/edit content type dialog.
 * @const
 */
var preferredWidth = 300;

/**
 * Preferred height of the add/edit content type dialog.
 * @const
 */
var preferredHeight = 175;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of adding/editing content types.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    item: ?Element
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */
DejaClickUi.ContentTypeMember = function (aOptions, aRootElement, aWindow,
                                          aConstants, aUtils) {

   var root;

   aWindow.returnValue = null;

   this.item = aOptions.item;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),

      contentType: root.find('#contentType'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allButtons: root.find('button'),
      allInputs: root.find('input')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));

   this.elements.allInputs.on('change input', this.enableControls.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.ContentTypeMember.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ContentTypeMember,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.ContentTypeMember}
    */
   init: function () {
      try {
         if (this.item == null) {
            this.elements.title.text(this.utils.getMessage(
               'deja_contentTypeMember_title_add'));
            this.elements.description.text(this.utils.getMessage(
                  'deja_contentTypeMember_description_add'));
         } else {
            this.elements.title.text(this.utils.getMessage(
               'deja_contentTypeMember_title_edit'));
            this.elements.description.text(this.utils.getMessage(
                  'deja_contentTypeMember_description_edit'));

            this.elements.contentType.val(this.item || '');
         }

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
    * @this {!DejaClickUi.ContentTypeMember}
    */
   close: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.allButtons.off('click').button('destroy');
            this.elements.allInputs.off('change input');
         }

         delete this.elements;

         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.item;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this content type. Close the window.
    * @this {!DejaClickUi.ContentTypeMember}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var win;

      try {
         this.window.returnValue = this.elements.contentType.val() || null;

         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.ContentTypeMember}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      try {
         var win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.ContentTypeMember}
    */
   enableControls: function () {
      var isTypeEmpty;

      try {
         isTypeEmpty = this.elements.contentType.val().length === 0;

         this.elements.apply.button('option', 'disabled', isTypeEmpty);
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
         if (DejaClickUi.hasOwnProperty('contentTypeMember')) {
            DejaClickUi.contentTypeMember.close();
            delete DejaClickUi.contentTypeMember;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the ContentTypeMember instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.contentTypeMember = new DejaClickUi.ContentTypeMember(
            window.dialogArguments,
            document.documentElement,
            window,
            DejaClick.constants,
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