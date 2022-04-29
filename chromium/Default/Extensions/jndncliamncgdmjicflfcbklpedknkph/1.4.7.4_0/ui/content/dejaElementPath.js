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
 * Edit element path dialog.
 * Input: {{context:!Element}} The event element containing
 *    a target with an elementpath to be edited.
 * Output: {?Element} The event that was edited, or null if the
 *    operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the edit elementpath dialog.
 * @const
 */
var preferredWidth = 325;
/**
 * Preferred height of the edit elementpath dialog.
 * @const
 */
var preferredHeight = 200;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * ElementPath is responsible for allowing the configuration of the
 * elementpath of an event target.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!Element} aEvent The event element whose elementpath
 *    is to be edited.
 * @param {!Element} aRootElement The parent element of the UI.
 *    Typically the documentElement of the page.
 * @param {!Window} aWindow The window object.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    event applies.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 * @param {
 *    function(new:DejaClickUi.VariableSelector,
 *       string,
 *       !Element,
 *       !function(),
 *       !function(string,*,function(*)),
 *       !DejaClick.Utils)
 * } AVariableSelector The VariableSelector constructor.
 */
DejaClickUi.ElementPath = function (aEvent, aRootElement, aWindow, aUtils,
      aScript, ADialogWindow, AVariableSelector) {
   var targetElts, index, path, root;

   aWindow.returnValue = null;

   this.window = aWindow;
   this.logger = aUtils.logger;
   this.DialogWindow = ADialogWindow;

   /**
    * Refers to any "modal" dialog window opened by this page.
    * @type {?DejaClick.DialogWindow}
    */
   this.dialog = null;

   // Find the elementpath node.
   targetElts = aScript.getChildWithTag(aEvent, 'targets').
      getElementsByTagName('target');
   for (index = 0; index < targetElts.length; ++index) {
      if (targetElts[index].getAttribute('type') === 'element') {
         path = aScript.getChildWithTag(targetElts[index], 'elementpath');
         if (path !== null) {
            this.elementPath = path;
            break;
         }
      }
   }

   // Initialize the UI.
   aUtils.localizeTree(aRootElement, 'deja_');

   root = $(aRootElement);
   this.selector = new AVariableSelector(
      'x',
      root.find('#variableDiv')[0],
      this.enableControls.bind(this),
      this.openDialog.bind(this),
      aUtils);

   this.elements = {
      literalDiv: root.find('#literalDiv'),
      elementPath: root.find('#elementPath'),
      ok: root.find('#ok'),
      cancel: root.find('#cancel')
   };

   // Set up event handlers.
   this.elements.ok.button().on('click', this.apply.bind(this));
   this.elements.cancel.button().on('click', this.cancel.bind(this));

   // Display the current elementpath.
   this.selector.setScript(aScript);
   if (this.elementPath.hasAttribute('varreference')) {
      this.selector.useVariable(true);
      this.selector.selectVariable(this.elementPath.textContent);
   } else {
      this.selector.useVariable(false);
      this.elements.elementPath.val(this.elementPath.textContent);
   }
   this.enableControls();
};

DejaClickUi.ElementPath.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ElementPath,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.ElementPath}
    */
   close: function () {
      if (this.hasOwnProperty('dialog') && (this.dialog !== null)) {
         this.dialog.close();
         this.dialog = null;
      }
      if (this.hasOwnProperty('elements')) {
         this.elements.ok.off('click').button('destroy');
         this.elements.cancel.off('click').button('destroy');
      }
      if (this.hasOwnProperty('selector')) {
         this.selector.close();
      }
      delete this.elements;
      delete this.selector;
      delete this.elementPath;
      delete this.dialog;
      delete this.DialogWindow;
      delete this.logger;
      delete this.window;
   },

   /**
    * Apply the edited changes to the event's elementpath. Close the window.
    * @this {!DejaClickUi.ElementPath}
    * @param {!Event} A jQuery click event on the OK button.
    */
   apply: function (aEvent) {
      try {
         this.window.returnValue = this.elementPath;
         if (this.selector.isVariableUsed()) {
            this.elementPath.setAttribute('varreference', 'true');
            this.elementPath.textContent = this.selector.getVariableName();
         } else {
            this.elementPath.removeAttribute('varreference');
            this.elementPath.textContent = this.elements.elementPath.val();
         }
         this.window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Discard any changes made by this dialog. Close the window.
    * @this {!DejaClickUi.ElementPath}
    * @param {!Event} A jQuery click event on the Cancel button.
    */
   cancel: function (aEvent) {
      try {
         this.window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window and disable all the controls in this window.
    * @this {!DejaClickUi.ElementPath}
    * @param {string} aUrl Relative URL of the dialog page to be opened.
    * @param {*=} opt_args Arguments to pass to the dialog window.
    * @param {function(*)=} opt_callback Optional callback to invoke
    *    to process the result of the dialog window.
    */
   openDialog: function (aUrl, opt_args, opt_callback) {
      try {
         if (this.dialog == null) {
            this.dialog = new this.DialogWindow(aUrl,
               ((opt_args == null) ? null : opt_args),
               this.centerDialog.bind(this),
               this.closeDialog.bind(this,
                  ((opt_callback == null) ? null : opt_callback)),
               this.logger);
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Center the dialog over the window.
    * @this {!DejaClickUi.ElementPath}
    * @param {!DejaClick.DialogWindow} aDialog The dialog window to be centered.
    */
   centerDialog: function (aDialog) {
      try {
         aDialog.centerOn(this.window);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Clean up after a dialog window has been closed. Enable the
    * controls in this window. Handle the dialog result.
    * @this {!DejaClickUi.ElementPath}
    * @param {?function(*)} aCallback Function to handle the result
    *    of the dialog.
    * @param {*} aResult Value returned from the dialog.
    */
   closeDialog: function (aCallback, aResult) {
      try {
         this.dialog = null;
         if (aCallback !== null) {
            aCallback(aResult);
         }
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.ElementPath}
    */
   enableControls: function () {
      var isVarUsed;
      if (this.dialog == null) {
         isVarUsed = this.selector.isVariableUsed();
         this.elements.literalDiv.toggle(!isVarUsed);
         this.elements.elementPath.removeAttr('disabled');
         this.selector.enableControls(true);
         this.elements.ok.button('option', 'disabled',
            !this.selector.isValid());
         this.elements.cancel.button('option', 'disabled', false);
      } else {
         this.elements.elementPath.attr('disabled');
         this.selector.enableControls(false);
         this.elements.ok.button('option', 'disabled', true);
         this.elements.cancel.button('option', 'disabled', true);
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
         if (DejaClickUi.hasOwnProperty('elementPath')) {
            DejaClickUi.elementPath.close();
            delete DejaClickUi.elementPath;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the ElementPath instance once the page is
    * loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.elementPath = new DejaClickUi.ElementPath(
            window.dialogArguments.context,
            document.documentElement,
            window,
            DejaClick.utils,
            DejaClick.script,
            DejaClick.DialogWindow,
            DejaClickUi.VariableSelector);
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
