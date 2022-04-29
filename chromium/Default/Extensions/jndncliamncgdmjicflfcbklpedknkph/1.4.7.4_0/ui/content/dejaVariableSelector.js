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

/*global DejaClickUi,$*/

'use strict';

/**
 * VariableSelector inserts a UI into an element that allows users to
 * optionally select (and add or edit) a script variable.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {string} aNamespace Prefix to allow the ids of contained
 *    elements to be unique.
 * @param {!Element} aParent The DOM element into which the script
 *    variable selection UI will be placed.
 * @param {!function()} aOnChangeCb Function to be called whenever
 *    the user changes the selected script variable or whether
 *    a script variable is to be used. This function should call
 *    this.enableControls.
 * @param {!function(string, *, function(*))} aOpenDialog Function to
 *    open a "modal" dialog window and disable all controls on the page.
 *    This should also call this.enableControls.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */
DejaClickUi.VariableSelector = function (aNamespace, aParent,
      aOnChangeCb, aOpenDialog, aUtils) {
   var useVarId;

   this.document = aParent.ownerDocument;
   this.onChange = aOnChangeCb;
   this.openDialog = aOpenDialog;
   this.logger = aUtils.logger;
   this.variableUtils = new DejaClick.Variable(this.logger);

   /**
    * The script from which a variable is to be selected.
    * @type {?DejaClick.Script}
    */
   this.script = null;

   /**
    * Array of the defined script variables.
    * @type {!Array.<!Element>}
    */
   this.variables = [];

   // Create user interface.
   useVarId = aNamespace + '.useVariable';
   this.elements = {
      parent: $(aParent).
         addClass('variable-selector'),
      useVarDiv: $(this.document.createElement('div')).
         addClass('use-variable'),
      checkbox: $(this.document.createElement('input')).
         attr('id', useVarId).
         attr('type', 'checkbox').
         prop('checked', false),
      label: $(this.document.createElement('label')).
         attr('for', useVarId).
         text(aUtils.getMessage('deja_variableSelector_useVariable')),
      inUseDiv: $(this.document.createElement('div')).
         addClass('variable-details'),
      selectDiv: $(this.document.createElement('div')).
         addClass('variable-actions'),
      select: $(this.document.createElement('select')).
         addClass('select-variable'),
      addVariable: $(this.document.createElement('button')).
         attr('id', 'addVariableButton').
         addClass('add-variable').
         text(aUtils.getMessage('deja_variableSelector_addVariable')),
      editVariable: $(this.document.createElement('button')).
         attr('id', 'editVariableButton').
         addClass('edit-variable').
         text(aUtils.getMessage('deja_variableSelector_editVariable')),
      descriptionDiv: $(this.document.createElement('div')).
         addClass('variable-description'),
      description: $(this.document.createElement('textarea')).
         addClass('fullWidth').
         attr('size', '3').
         attr('readonly', 'true').
         attr('title', aUtils.getMessage('deja_variableSelector_description'))
   };
   this.elements.parent.append([
      this.elements.useVarDiv.append([
         this.elements.checkbox,
         this.elements.label
      ]),
      this.elements.inUseDiv.append([
         this.elements.selectDiv.append([
            this.elements.select,
            this.elements.addVariable,
            this.elements.editVariable
         ]),
         this.elements.descriptionDiv.append([
            this.elements.description
         ])
      ])
   ]);

   this.elements.parent.hide();

   // Register event handlers.
   this.elements.checkbox.on('change', this.changeUseVariable.bind(this));
   this.elements.select.on('change', this.changeVariableSelection.bind(this));
   this.elements.select.on('dblclick', this.editVariable.bind(this));
   this.elements.addVariable.button({
      text: false,
      icons: {
         primary: 'addVariable-icon'
      }
   }).on('click', this.addVariable.bind(this));
   this.elements.editVariable.button({
      text: false,
      icons: {
         primary: 'editVariable-icon'
      }
   }).on('click', this.editVariable.bind(this));
};

DejaClickUi.VariableSelector.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.VariableSelector,

   /**
    * Relative path to dialog for adding or editing script variables.
    * @const
    */
   ADD_EDIT_VARIABLE_URL: 'ui/content/dejaVariable.html',

   /**
    * Clean up the JavaScript objects used by the selector.
    * @this {!DejaClickUi.VariableSelector}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.editVariable.off('click').button('destroy');
         this.elements.addVariable.off('click').button('destroy');
         this.elements.select.off('change dblclick');
         this.elements.checkbox.off('change');
      }

      delete this.elements;
      delete this.variables;
      delete this.script;
      delete this.variableUtils;
      delete this.logger;
      delete this.openDialog;
      delete this.onChange;
      delete this.document;
   },

   /**
    * Set the script whose variables are to be listed. Display the variables.
    * Disable the use of script variables.
    * If the supplied script is null, hide the UI.
    * @this {!DejaClickUi.VariableSelector}
    * @param {?DejaClick.Script} aScript The script whose variables are
    *    to be displayed (or null).
    */
   setScript: function (aScript) {
      var select, variables, index, varElt, name, description;

      this.elements.checkbox.prop('checked', false);
      select = this.elements.select;
      select.empty();
      this.variables = [];

      if (aScript == null) {
         this.script = null;
         this.elements.parent.hide();
         return;
      }

      this.script = aScript;
      variables = aScript.getScriptElement().getElementsByTagName('variable');
      for (index = 0; index < variables.length; ++index) {
         varElt = variables[index];
         name = aScript.domTreeGetVariableParam(varElt, 'varname');
         description = this.getDescription(varElt);

         if ((varElt.getAttribute('type') === '1') &&
               (name !== null) && (name.length !== 0) &&
               (description !== null) && (description.length !== 0)) {
            select.append($(this.document.createElement('option')).
               text(name).
               attr('title', description).
               attr('value', String(this.variables.length)));
            this.variables.push(varElt);
         }
      }
      select.prop('selectedIndex', -1);
      this.elements.description.val('');

      this.elements.parent.show();
      this.elements.inUseDiv.hide();
   },

   /**
    * Enable or disable the use of a script variable. Clear the selection
    * of any script variable.
    * Does nothing if no script has been set.
    * @this {!DejaClickUi.VariableSelector}
    * @param {boolean} aUsed If true, enable the use of a script variable.
    *    If false, disable it.
    */
   useVariable: function (aUsed) {
      if (this.script !== null) {
         this.elements.checkbox.prop('checked', aUsed);
         this.elements.inUseDiv.toggle(aUsed);
         this.elements.descriptionDiv.hide();
         this.elements.select.prop('selectedIndex', -1);
      }
   },

   /**
    * Select the variable to be used. Display its description in a textbox.
    * Does nothing is no script has been set or if script variable use
    * is not enabled.
    * @this {!DejaClickUi.VariableSelector}
    * @param {string} aVarName The name of the variable to be selected.
    *   If the name is not recognized, the selection will be cleared.
    */
   selectVariable: function (aVarName) {
      var options, index;
      if ((this.script !== null) && this.elements.checkbox.prop('checked')) {
         options = this.elements.select.prop('options');
         index = options.length;
         while (index !== 0) {
            --index;
            if (options[index].textContent === aVarName) {
               this.elements.select.prop('selectedIndex', index);
               this.elements.descriptionDiv.show();
               this.elements.description.
                  val(options[index].getAttribute('title'));
               return;
            }
         }

         // No matching name. Clear the selection.
         this.elements.select.prop('selectedIndex', -1);
         this.elements.descriptionDiv.hide();
      }
   },

   /**
    * Determine whether the selection of a variable is in a valid state.
    * @this {!DejaClickUi.VariableSelector}
    * @return {boolean} true if the state of the UI represents a committable
    *    state. It is committable if script variable use is disabled or
    *    if a script variable is selected.
    */
   isValid: function () {
      return !this.elements.checkbox.prop('checked') ||
         (this.elements.select.prop('selectedIndex') !== -1);
   },

   /**
    * Determine whether script variable usage is enabled.
    * @this {!DejaClickUi.VariableSelector}
    * @return {boolean} true if script variable usage is enabled.
    */
   isVariableUsed: function () {
      return this.elements.checkbox.prop('checked');
   },

   /**
    * Get the name of the selected script variable.
    * @this {!DejaClickUi.VariableSelector}
    * @return {?string} The name of the selected variable (or null if none).
    */
   getVariableName: function () {
      return (this.elements.select.prop('selectedIndex') === -1) ? null :
         this.elements.select.prop('selectedOptions')[0].textContent;
   },

   /**
    * Get a description of the selected script variable.
    * @this {!DejaClickUi.VariableSelector}
    * @return {?string} The description of the selected variable
    *    (or null if none).
    */
   getVariableDescription: function () {
      return (this.elements.select.prop('selectedIndex') === -1) ? null :
         this.elements.select.prop('selectedOptions')[0].getAttribute('title');
   },

   /**
    * Enable or disable the controls based on the current state of the UI.
    * @this {!DejaClickUi.VariableSelector}
    * @param {boolean} aEnable If true, enable the appropriate controls
    *    for the current UI state. If false, disable everything.
    */
   enableControls: function (aEnable) {
      if ((this.script == null) || !aEnable) {
         this.elements.checkbox.attr('disabled', 'true');
         this.elements.select.attr('disabled', 'true');
         this.elements.addVariable.attr('disabled', 'true');
         this.elements.editVariable.attr('disabled', 'true');
         this.elements.description.attr('disabled', 'true');
      } else {
         this.elements.checkbox.removeAttr('disabled');
         this.elements.select.removeAttr('disabled');
         this.elements.addVariable.removeAttr('disabled');
         this.elements.description.removeAttr('disabled');
         if (this.elements.select.prop('selectedIndex') === -1) {
         this.elements.editVariable.attr('disabled', 'true');
         } else {
            this.elements.editVariable.removeAttr('disabled');
         }
      }
   },

   /**
    * React to a change in the use variable checkbox.
    * Display the select variable UI. Open the add variable dialog
    * if no variables are defined. Notify the client of the change.
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {!Event} aEvent A jQuery change event on the use variable
    *    checkbox.
    */
   changeUseVariable: function (aEvent) {
      try {
         if (!this.elements.checkbox.prop('checked')) {
            this.elements.inUseDiv.hide();
            this.onChange();
         } else if (this.elements.select.prop('options').length !== 0) {
            this.elements.inUseDiv.show();
            this.onChange();
         } else {
            this.openDialog(this.ADD_EDIT_VARIABLE_URL,
               {
                  context: this.script.getScriptElement(),
                  item: null
               },
               this.completeChangeVariableUse.bind(this));
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Complete the addition of a variable to be used after the
    * use variable checkbox was checked. Select the new variable
    * and notify the client.
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {?Element} The new script variable element (or null if the
    *    addition was canceled).
    */
   completeChangeVariableUse: function (aVariable) {
      try {
         if (aVariable == null) {
            this.elements.checkbox.prop('checked', false);
         } else {
            this.setScript(this.script);
            this.useVariable(true);
            this.elements.select.prop('selectedIndex', 0);
            this.elements.descriptionDiv.show();
            this.elements.description.
               val(this.elements.select.prop('options')[0].
                  getAttribute('title'));
            this.onChange();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * React to the selection of a new variable. Display the variable's
    * description and notify the client of the change.
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {!Event} aEvent A jQuery change event on the variable selection
    *    element.
    */
   changeVariableSelection: function (aEvent) {
      var options;
      try {
         options = this.elements.select.prop('selectedOptions');
         if (options.length !== 0) {
            this.elements.descriptionDiv.show();
            this.elements.description.
               val(options[0].getAttribute('title'));
         } else {
            this.elements.descriptionDiv.hide();
         }
         this.onChange();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to add a new variable.
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {!Event} aEvent A jQuery click event on the add button.
    */
   addVariable: function (aEvent) {
      try {
         this.openDialog(this.ADD_EDIT_VARIABLE_URL,
            {
               context: this.script.getScriptElement(),
               item: null
            },
            this.completeAddEditVariable.bind(this));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the selected variable.
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {!Event} aEvent} A jQuery click event on the edit button
    *    or a double-click event on the selected variable.
    */
   editVariable: function (aEvent) {
      var index;
      try {
         index = Number(this.elements.select.val());
         if ((this.elements.select.prop('selectedIndex') !== -1) &&
               (index < this.variables.length)) {
            this.openDialog(this.ADD_EDIT_VARIABLE_URL,
               {
                  context: this.script.getScriptElement(),
                  item: this.variables[index]
               },
               this.completeAddEditVariable.bind(this));
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Select the added or edited variable and notify the client.
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {?Element} aVariable The added or edited variable element
    *    (or null if the operation was canceled).
    */
   completeAddEditVariable: function (aVariable) {
      try {
         if (aVariable !== null) {
            this.setScript(this.script);
            this.useVariable(true);
            this.selectVariable(this.script.domTreeGetVariableParam(aVariable,
               'varname'));
            this.onChange();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Get a description of a script variable.
    * @todo Implement a real version of this. Possibly in dejaScript.js
    * @private
    * @this {!DejaClickUi.VariableSelector}
    * @param {!Element} aVariable The variable element to be described.
    * @return {string} A description of the variable.
    */
   getDescription: function (aVariable) {
      return this.variableUtils.getVariableDescription(
         this.script.domTreeGetVariableParam(aVariable, 'vartext'));
   }
};
