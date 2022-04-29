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
 * Preferred width of the add/edit script variable dialog.
 * @const
 */
var preferredWidth = 400;

/**
 * Preferred height of the add/edit script variable dialog.
 * @const
 */
var preferredHeight = 550;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of editing script variables.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    item: ?Element,
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.DejaService} aService The DejaClick record/replay service.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    javascript validation applies.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 * @param {function(function(*)=, number=, number=)} AVariable
 *    The script variable common utils constructor.
 */
DejaClickUi.Variable = function (aOptions, aRootElement, aWindow, aConstants,
                                 aUtils, aService, aScript, ADialogWindow,
                                 AVariable) {

   var root, replayCount, location;

   aWindow.returnValue = null;

   this.item = aOptions.item;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.service = aService;
   this.script = aScript;
   this.DialogWindow = ADialogWindow;

   replayCount = 0;
   location = aUtils.prefService.getPrefOption('DC_OPTID_LOCATIONID');

   if (this.service && this.service.getReplayCount && this.service.getLocationId) {
      replayCount = this.service.getReplayCount();
      location = this.service.getLocationId();
   }

   this.variableUtils = new AVariable(this.utils.logger, replayCount, location);

   /**
    * The "modal" dialog window opened by this page.
    * @type {?DejaClick.DialogWindow}
    */
   this.dialog = null;

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),

      varName: root.find('#varName'),

      tokensList: root.find('#tokensList'),

      add: root.find('#add'),
      edit: root.find('#edit'),
      clone: root.find('#clone'),
      remove: root.find('#remove'),
      moveUp: root.find('#moveUp'),
      moveDown: root.find('#moveDown'),

      sticky: root.find('#sticky'),

      preview: root.find('#preview'),
      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allInputs: root.find('input,select'),
      changeInputs: root.find('#varName,#tokensList'),
      allButtons: root.find('button')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.add.on('click', this.addToken.bind(this));
   this.elements.edit.on('click', this.editToken.bind(this));
   this.elements.clone.on('click', this.cloneToken.bind(this));
   this.elements.remove.on('click', this.removeToken.bind(this));
   this.elements.moveUp.on('click', this.moveUpToken.bind(this));
   this.elements.moveDown.on('click', this.moveDownToken.bind(this));

   this.elements.preview.on('click', this.preview.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));

   this.elements.changeInputs.on('change input', this.enableControls.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init(aOptions);
};

DejaClickUi.Variable.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Variable,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.Variable}
    */
   init: function (aOptions) {
      var arrTokens, arrTokenParams, i, l;

      try {
         if (this.item == null) {
            this.elements.title.text(this.utils.getMessage('deja_variables_title_add'));
            this.elements.description.text(this.utils.getMessage(
               'deja_variables_description_add'));

            this.elements.varName.val(aOptions.varName || '');
            this.elements.sticky.prop('checked', aOptions.sticky === true);
         } else {
            this.elements.title.text(this.utils.getMessage('deja_variables_title_edit'));
            this.elements.description.text(this.utils.getMessage(
               'deja_variables_description_edit'));

            this.elements.varName.val(this.getParam('varname'));
            this.elements.sticky.prop('checked', this.getParam('sticky') ===
               'true');

            arrTokens = this.getParam('vartext')
               .split(this.constants.DC_SEPARATOR_TOKENS);

            for (i = 0, l = arrTokens.length; i < l; i++) {
               arrTokenParams = arrTokens[i]
                  .split(this.constants.DC_SEPARATOR_TOKENPARAMS);

               this.completeUpdateToken(true, arrTokenParams);
            }
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
    * @this {!DejaClickUi.Variable}
    */
   close: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.changeInputs.off('change input');
            this.elements.allButtons.off('click').button('destroy');
            this.elements.tokensList.children('option').off('dblclick');
         }

         if (this.hasOwnProperty('dialog') && (this.dialog !== null)) {
            this.dialog.close();
            this.dialog = null;
         }

         delete this.elements;
         delete this.dialog;

         delete this.variableUtils;
         delete this.DialogWindow;
         delete this.script;
         delete this.service;
         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.item;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new token.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the add variable button.
    */
   addToken: function (aEvent) {
      try {
         this.openDialog('ui/content/dejaVariableToken.html',
            {
               item: null
            },
            this.completeUpdateToken.bind(this, true));
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected token.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the edit variable button.
    */
   editToken: function (aEvent) {
      var selectedToken;

      try {
         if (this.elements.tokensList[0].selectedIndex !== -1) {

            selectedToken =
               this.elements.tokensList.children('option:selected')
                  .val()
                  .split(this.constants.DC_SEPARATOR_TOKENPARAMS);

            this.openDialog('ui/content/dejaVariableToken.html',
               {
                  item: selectedToken
               },
               this.completeUpdateToken.bind(this, false));
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Create new token or update the selected one.
    * Is called after token dialog close.
    * @this {!DejaClickUi.Variable}
    * @param {?boolean} aIsNew Token status.
    * @param {?Array} aToken Token data.
    *    (or null if the add token dialog was canceled).
    */
   completeUpdateToken: function (aIsNew, aToken) {
      var strToken, tokenDescription, tokenElem;

      try {
         if (aToken && aToken.length) {
            strToken = aToken.join(this.constants.DC_SEPARATOR_TOKENPARAMS);
            tokenDescription = this.variableUtils.getTokenDescription(strToken);
            tokenElem = aIsNew && $('<option>') ||
               this.elements.tokensList.children('option:selected');

            if (tokenDescription) {
               tokenElem.val(strToken);
               tokenElem.text(tokenDescription);
               tokenElem
                  .removeClass()
                  .addClass(aToken[1] && 'location' || 'anywhere');
               aIsNew && tokenElem.on('dblclick', this.editToken.bind(this));
            }

            tokenElem && aIsNew && this.elements.tokensList.append(tokenElem);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Clone the currently selected token.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the clone variable button.
    */
   cloneToken: function (aEvent) {
      var selectedToken, clonedToken;

      try {
         if (this.elements.tokensList[0].selectedIndex !== -1) {
            selectedToken = this.elements.tokensList.children('option:selected');
            clonedToken = selectedToken.clone(true);

            clonedToken.insertAfter(selectedToken);
            clonedToken.prop('selected', true);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Remove the currently selected token.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the remove variable button.
    */
   removeToken: function (aEvent) {
      try {
         if (this.elements.tokensList[0].selectedIndex !== -1) {
            this.elements.tokensList.children('option:selected').remove();
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Move up the currently selected token in the list of tokens.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the move up variable button.
    */
   moveUpToken: function (aEvent) {
      var selectedToken, previousToken;

      try {
         if (this.elements.tokensList[0].selectedIndex > 0) {
            selectedToken = this.elements.tokensList.children('option:selected');
            previousToken = selectedToken.prev();

            selectedToken.insertBefore(previousToken);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Move down the currently selected token in the list of tokens.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the move down variable button.
    */
   moveDownToken: function (aEvent) {
      var selectedToken, nextToken;

      try {
         if (this.elements.tokensList[0].selectedIndex !==
            this.elements.tokensList.children('option').length - 1) {

            selectedToken = this.elements.tokensList.children('option:selected');
            nextToken = selectedToken.next();

            selectedToken.insertAfter(nextToken);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this script variable. Close the window.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var arrTokens = [], parent, win, tokensElements, strVariable,
         variableName, i, l;

      try {
         variableName = this.elements.varName.val();

         if (this.isNameExist(variableName) == false) {
            tokensElements = this.elements.tokensList.children('option');

            for (i = 0, l = tokensElements.length; i < l; i++) {
               arrTokens[i] = tokensElements[i].getAttribute('value');
            }

            strVariable = arrTokens.join(this.constants.DC_SEPARATOR_TOKENS);
            if (this.item == null) {

                  parent = this.script.getChildWithTag(
                  this.script.getScriptElement(), 'variables');

               if (parent == null) {
                  parent = this.script.domTreeInsertNode(
                     this.script.getScriptElement(), 'variables');
               }

               this.item = this.script.domTreeInsertNode(parent, 'variable');
               this.item.setAttribute('type', this.constants.VARIABLE_TYPE);
            }
            this.script.renumberElements('variable');

            this.setParam('varname', variableName);
            this.setParam('vartext', strVariable);
            this.setParam('sticky', '' + this.elements.sticky.prop('checked'));

            this.window.returnValue = this.item;

            win = this.window;
            this.close();
            win.close();
         } else {
            this.utils.promptService.notifyUser(
               'deja_variables_errDoubleName', true);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Display all tokens as string in alert.
    * @this {!DejaClickUi.Variable}
    * @param {!Event} aEvent A jQuery click event on the preview button.
    */
   preview: function (aEvent) {
      var tokens = [],
         tabId = null,
         tokensElements, i, l;

      /**
       * Show a computed variable that calculated asynchronously.
       * Used as a callback function.
       * @param {string} computedVariable
       */
      function showComputedVariable(computedVariable) {
         if (computedVariable === null || computedVariable === undefined) {
            computedVariable = this.utils.getMessage('deja_variables_errInvalidValue');
         }

         this.utils.promptService.notifyUser(
            this.utils.getMessage('deja_variables_previewVariable') + computedVariable);
      }

      try {
         tokensElements = this.elements.tokensList.children('option');

         for (i = 0, l = tokensElements.length; i < l; i++) {
            tokens.push(tokensElements[i].getAttribute('value'));
         }

         if (this.service.lastFocusedBrowserObj) {
            tabId = this.service.lastFocusedBrowserObj.id;
         }

         this.variableUtils.computeScriptVariableAsync(
            tokens,
            showComputedVariable.bind(this),
            tabId);

      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.Variable}
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
    * @this {!DejaClickUi.Variable}
    */
   enableControls: function () {
      var tokensCount, selectedTokenIndex, isNameEmpty, isTokensListEmpty,
         isTokenUnselected;

      try {
         if (this.dialog == null) {
            tokensCount = this.elements.tokensList.children('option').length;
            selectedTokenIndex = this.elements.tokensList[0].selectedIndex;
            isNameEmpty = this.elements.varName.val().length === 0;
            isTokensListEmpty = tokensCount === 0;
            isTokenUnselected = selectedTokenIndex === -1;

            this.elements.add.button('option', 'disabled', false);
            this.elements.cancel.button('option', 'disabled', false);
            this.elements.allInputs.prop('disabled', false);

            this.item && this.getParam('varname') && this.elements.varName
               .prop('disabled', true);

            this.elements.apply.button('option', 'disabled', isNameEmpty ||
               isTokensListEmpty);

            this.elements.preview.button('option', 'disabled', isTokensListEmpty);

            this.elements.edit.button('option', 'disabled', isTokenUnselected);
            this.elements.clone.button('option', 'disabled', isTokenUnselected);
            this.elements.remove.button('option', 'disabled', isTokenUnselected);

            this.elements.moveUp.button('option', 'disabled',
                  selectedTokenIndex < 1);
            this.elements.moveDown.button('option', 'disabled',
                  isTokenUnselected || selectedTokenIndex === tokensCount - 1);
         } else {
            // A "modal" dialog is open. Disable everything.
            this.elements.allInputs.prop('disabled', true);
            this.elements.allButtons.button('option', 'disabled', true);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Get an array of the variables available
    * @this {!DejaClickUi.Variable}
    * @returns {Array}
    */
   getVariablesList: function () {
      var variableNames = [], variableName, variables, currentVariableName, i;

      try {
         currentVariableName = this.item && this.getParam('varname') || null;
         variables = this.script.getScriptElement()
            .getElementsByTagName('variable');

         for (i = 0; i < variables.length; i++) {
            variableName = this.script.domTreeGetVariableParam(variables[i], "varname");

            // don't add current variable to the list
            if (variableName != currentVariableName) {
               variableNames.push(variableName);
            }
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }

      return variableNames;
   },

   /**
    * Check whether provided variable name is in use
    * @this {!DejaClickUi.Variable}
    * @param {string} aName - The variable name
    * @returns {boolean} - true if variable with such name exists
    */
   isNameExist: function (aName) {
      var variableNames;

      try {
         variableNames = this.getVariablesList();

         if (aName) {
            return variableNames.indexOf(aName) !== -1;
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }

      return null;
   },

   /**
    * Get a parameter of the variable being edited.
    * @this {!DejaClickUi.Variable}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getParam: function (aName) {
      return this.script.domTreeGetVariableParam(this.item, aName);
   },

   /**
    * Set or change the value of a parameter of the variable.
    * @this {!DejaClickUi.Variable}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setParam: function (aName, aValue) {
      this.script.domTreeChangeVariableParam(this.item, aName, aValue);
   },

   /**
    * Open a dialog window and disable all the controls in this window.
    * @this {!DejaClickUi.Variable}
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
               this.utils.logger);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Center the dialog over the window.
    * @this {!DejaClickUi.Variable}
    * @param {DejaClick.DialogWindow} aDialog The dialog window to be centered.
    */
   centerDialog: function (aDialog) {
      try {
         aDialog.centerOn(this.window);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Clean up after a dialog window has been closed. Enable the
    * controls in this window. Handle the dialog result.
    * @this {!DejaClickUi.Variable}
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
         this.utils.logger.logException(ex);
      }
   }
}

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('variable')) {
            DejaClickUi.variable.close();
            delete DejaClickUi.variable;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the Variable instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.variable = new DejaClickUi.Variable(
            window.dialogArguments,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.service,
            DejaClick.script,
            DejaClick.DialogWindow,
            DejaClick.Variable);
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