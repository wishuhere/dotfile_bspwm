/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit javascript validation dialog.
 * @const
 */
var preferredWidth = 250;
/**
 * Preferred height of the add/edit javascript validation dialog.
 * @const
 */
var preferredHeight = 150;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of replacing location IDs.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    context: !Element,
 *    item: ?Array
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    javascript validation applies.
 */

DejaClickUi.ReplaceLocationID = function(aOptions, aRootElement,
                                     aWindow, aConstants, aUtils, aScript) {

   var root = $(aRootElement);

   this.locationIDs = aOptions.locationIDs;
   this.window = aWindow;
   this.constants = aConstants;
   this.logger = aUtils.logger;
   this.script = aScript;

   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),
      selectLocationID: root.find('#selectLocationID'),
      newLocationID: root.find('#newLocationID'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allInputs: root.find('input,select'),
      changeInputs: root.find('select'),
      allButtons: root.find('button')
   };

   this.elements.allInputs.on('change input', this.enableControls.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));

   aUtils.localizeTree(aRootElement, 'deja_');

   this.elements.allButtons.button();

   this.init();
   this.enableControls();
};

DejaClickUi.ReplaceLocationID.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ReplaceLocationID,

   /**
    * Initialize the dialog
    * @this {!DejaClickUi.ReplaceLocationID}
    */
   init: function() {
      var select = this.elements.selectLocationID,
         i, l, option;

      for (i = 0, l = this.locationIDs.length; i < l; i++) {
         option = $(document.createElement('option'))
            .attr('value', this.locationIDs[i])
            .text(this.locationIDs[i]);
         select.append(option);
      }

   },

   /**
    * Get a parameter of the variable specified.
    * @this {!DejaClickUi.ReplaceLocationID}
    * @param {string} aVariable The variable to get the parameter from.
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getParam: function (aVariable, aName) {
      return this.script.domTreeGetVariableParam(aVariable, aName);
   },

   /**
    * Set or change the value of a parameter of the variable specified.
    * @this {!DejaClickUi.ReplaceLocationID}
    * @param {string} aVariable The variable where to set the parameter.
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setParam: function (aVariable, aName, aValue) {
      this.script.domTreeChangeVariableParam(aVariable, aName, aValue);
   },

   /**
    * Manage controls state based on the form filling
    * @this {!DejaClickUi.ReplaceLocationID}
    * @returns {boolean}
    */
   enableControls: function() {
      if (this.elements.selectLocationID.val()
            && this.elements.newLocationID.val()) {
         this.elements.apply.button('option', 'disabled', false);
      }
      else {
         this.elements.apply.button('option', 'disabled', true);
      }
   },

   /**
    * Determine whether an element represents a variable
    * @this {!DejaClickUi.ReplaceLocationID}
    * @param {!Element} aVariable The variable element from the script.
    * @return {boolean} true if aValidation represents a script variable.
    */
   isVariable: function (aVariable) {
      return aVariable.getAttribute('type') ===
         this.constants.VARIABLE_TYPE;
   },

   /**
    * Apply the changes made in the UI. Close the window
    * @this {!DejaClickUi.ReplaceLocationID}
    */
   apply: function() {
      var oldID = this.elements.selectLocationID.val(),
         newID = this.elements.newLocationID.val(),
         variablesElt, variables, strTokens, arrTokens, strTokensNew, i, j, k, l;

      variablesElt = this.script.getChildWithTag(
         this.script.getScriptElement(), 'variables');

      if (variablesElt != null) {
         variables = Array.prototype.filter.call(
            variablesElt.getElementsByTagName('variable'),
            this.isVariable,
            this);

         for (i = 0, l = variables.length; i < l; i++) {
            strTokens = this.getParam(variables[i], 'vartext');
            if (strTokens.indexOf(this.constants.DC_SEPARATOR_TOKENPARAMS + oldID + this.constants.DC_SEPARATOR_TOKENPARAMS) != -1) {
               arrTokens = strTokens.split(this.constants.DC_SEPARATOR_TOKENS);

               for (j = 0, k = arrTokens.length; j < k; j++) {

                  var params = arrTokens[j].split(this.constants.DC_SEPARATOR_TOKENPARAMS);
                  if (params[1] == oldID) {
                     params[1] = newID;
                     arrTokens[j] = params.join(this.constants.DC_SEPARATOR_TOKENPARAMS);
                  }
               }

               strTokensNew = arrTokens.join(this.constants.DC_SEPARATOR_TOKENS);
               if (strTokens != strTokensNew) {
                  this.setParam(variables[i], 'vartext', strTokensNew)
               }
            }
         }
      }

      this.cancel();
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.ReplaceLocationID}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function(aEvent) {
      var win;
      try {
         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.ReplaceLocationID}
    */
   close: function() {
      if (this.hasOwnProperty('elements')) {
         this.elements.changeInputs.off('change input');
         this.elements.allButtons.off('click');
      }
      delete this.elements;
      delete this.script;
      delete this.logger;
      delete this.constants;
      delete this.window;
      delete this.locationIDs;
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('replaceLocationID')) {
            DejaClickUi.replaceLocationID.close();
            delete DejaClickUi.replaceLocationID;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the ReplaceLocationID instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.replaceLocationID = new DejaClickUi.ReplaceLocationID(
            window.dialogArguments,
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
