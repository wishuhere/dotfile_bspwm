/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit dialog prompt dialog.
 * @const
 */
var preferredWidth = 450;

/**
 * Preferred height of the add/edit dialog prompt dialog.
 * @const
 */
var preferredHeight = 400;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of editing dialog prompt instructions.
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
 *    dialog prompt applies.
 */
DejaClickUi.DialogPrompt = function(aOptions, aRootElement, aWindow,
                                    aConstants, aUtils, aScript) {

   var root = $(aRootElement);

   this.item = aOptions.item;
   this.context = aOptions.context;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.script = aScript;

   this.window.returnValue = null;

   // Find/create UI elements.
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),

      typeSelect: root.find('#typeSelect'),

      input1Container: root.find('#input1Container'),
      input2Container: root.find('#input2Container'),
      input3Container: root.find('#input3Container'),

      input1: root.find('#input1'),
      input2: root.find('#input2'),
      input3: root.find('#input3'),

      input1Label: root.find('#input1Container > label'),
      input2Label: root.find('#input2Container > label'),
      input3Label: root.find('#input3Container > label'),

      optionsContainer: root.find('#optionsContainer'),
      option1: root.find('#option1'),
      option2: root.find('#option2'),
      option3: root.find('#option3'),

      check1Container: root.find('#check1Container'),
      check1: root.find('#check1'),
      check1Label: root.find('#check1Container  label'),

      actionsContainer: root.find('#actionsContainer'),
      action1: root.find('#action1'),
      extraActionsContainer: root.find('#actionExtra1Container, #actionExtra2Container'),

      dialogOrdinal: root.find('#dialogOrdinal'),
      repeatCount: root.find('#repeatCount'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allButtons: root.find('button'),
      allInputs: root.find('input')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.typeSelect.on('change', this.updateType.bind(this));
   this.elements.allInputs.on('change input', this.enableControls.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.DialogPrompt.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.DialogPrompt,

   /******************************************
    *       UI initialization
    ******************************************/
   /**
    * Initialize the dialog
    * @this {!DejaClickUi.DialogPrompt}
    */
   init: function () {
      var type, input1, input2, input3;

      try {
         this.initDialogOrder();

         // Create new
         if (this.item === null) {
            DejaClick.service.__modal.setTitle('deja_dialogPrompt_title_add');
            this.elements.description.text(this.utils.getMessage('deja_dialogPrompt_description_add'));

            this.elements.typeSelect.trigger('change');

            this.elements.repeatCount.val(this.constants.DIALOGREPEAT_MIN);
         }
         // Edit
         else {
            DejaClick.service.__modal.setTitle('deja_dialogPrompt_title_edit');
            this.elements.description.text(this.utils.getMessage('deja_dialogPrompt_description_edit'));

            type   = this.item.getAttribute('type');
            input1 = this.getParam('input1');
            input2 = this.getParam('input2');
            input3 = this.getParam('input3');

            // Type
            this.elements.typeSelect
               .val(type)
               .prop('disabled', true)
               .trigger('change');

            // Inputs
            switch (type) {
               case this.constants.DIALOGTYPE_LOGINPROMPT:
                  this.elements.input1.val(input1);
                  this.elements.input2.val(input2);

                  break;
               case this.constants.DIALOGTYPE_INPUTPROMPT:
                  this.elements.input1.val(input1);

                  break;
               case this.constants.DIALOGTYPE_GENERICPROMPT:
                  this.elements.input1.val(input1);
                  this.elements.input2.val(input2);
                  this.elements.input3.val(input3);

                  break;
               case this.constants.DIALOGTYPE_CERTUNKNOWN:
                  this.elements.optionsContainer
                     .find('input#option' + this.getParam('option1'))
                     .prop('checked', true);

                  break;
               case this.constants.DIALOGTYPE_CERTINVALID:
               case this.constants.DIALOGTYPE_CERTCLIENT:
                  this.elements.check1.prop('checked', this.getParam('check1') === 'true');

                  break;
               case this.constants.DIALOGTYPE_CONFIRMPROMPT:
               case this.constants.DIALOGTYPE_CERTMISMATCH:
               case this.constants.DIALOGTYPE_CERTEXPIRED:
               default:
                  break;
            }

            // Action
            this.elements.actionsContainer
               .find('input#action' + this.getParam('action'))
               .prop('checked', true);

            // Ordinal
            this.elements.dialogOrdinal.val(this.item.getAttribute('ordinal'));

            // Repeat count
            this.elements.repeatCount.val(this.getParam('repeat'));
         }

         this.enableControls();
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Set the ordinal value for the added/edited dialog
    * @this {!DejaClickUi.DialogPrompt}
    */
   initDialogOrder: function () {
      var count;

      try {
         count = this.getDialogCount();

         this.elements.dialogOrdinal
            .attr('max', this.item && count || count + 1)
            .val(this.item && this.item.getAttribute('ordinal') || count + 1);

         this.elements.dialogOrdinal.prop('disabled', this.item && count == 1 || !count);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /******************************************
    *    Dialog common actions
    ******************************************/
   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.DialogPrompt}
    */
   close: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.typeSelect.off('change');
            this.elements.allInputs.off('change input');
            this.elements.allButtons.off('click').button('destroy');
         }

         delete this.elements;
         delete this.script;
         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.context;
         delete this.item;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this dialog prompt. Close the window.
    * @this {!DejaClickUi.DialogPrompt}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var parent, type, action, input1, input2, input3, option, win;

      try {
         type   = this.item && this.item.getAttribute('type') || this.elements.typeSelect.val();
         action = this.elements.actionsContainer.find('input[name=actionRadio]:checked').val();
         input1 = this.elements.input1.val();
         input2 = this.elements.input2.val();
         input3 = this.elements.input3.val();
         option = this.elements.optionsContainer.find('input[name=optionRadio]:checked').val();

         // Save to script
         if (this.item == null) {
            parent = this.script.getChildWithTag(this.context, 'dialogs');

            if (parent == null) {
               parent = this.script.domTreeInsertNode(this.context, 'dialogs');
            }

            this.item = this.script.domTreeInsertNode(parent, 'dialog');
            this.item.setAttribute('type', type);
            this.item.setAttribute('ordinal', this.getDialogCount());
         }

         if (this.item.getAttribute('ordinal') != this.elements.dialogOrdinal.val()) {
            this.reorderDialog();
         }

         this.script.renumberElements('dialog');

         // Mandatory params
         this.setParam('action', action || this.constants.DIALOGBUTTON_ACCEPT);
         this.setParam('repeat', this.elements.repeatCount.val());

         // Optional params
         switch (type) {
            case this.constants.DIALOGTYPE_LOGINPROMPT:
               input1 ? this.setParam('input1', input1) : this.deleteParam('input1');
               input2 ? this.setParam('input2', input2) : this.deleteParam('input2');

               break;
            case this.constants.DIALOGTYPE_INPUTPROMPT:
               input1 ? this.setParam('input1', input1) : this.deleteParam('input1');

               break;
            case this.constants.DIALOGTYPE_GENERICPROMPT:
               input1 ? this.setParam('input1', input1) : this.deleteParam('input1');
               input2 ? this.setParam('input2', input2) : this.deleteParam('input2');
               input3 ? this.setParam('input3', input3) : this.deleteParam('input3');

               break;
            case this.constants.DIALOGTYPE_CERTUNKNOWN:
               this.setParam('option1', option || this.elements.DIALOGOPTION_DEFAULT);

               break;
            case this.constants.DIALOGTYPE_CERTINVALID:
            case this.constants.DIALOGTYPE_CERTCLIENT:
               this.setParam('check1', '' + this.elements.check1.prop('checked'));

               break;
            case this.constants.DIALOGTYPE_CONFIRMPROMPT:
            case this.constants.DIALOGTYPE_CERTMISMATCH:
            case this.constants.DIALOGTYPE_CERTEXPIRED:
            default:
               break;
         }

      //    this.window.returnValue = this.item;

         win = this.window;
         this.close();
         win.close();
         DejaClick.service.__modal.close(this.item);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.DialogPrompt}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;

      try {
         win = this.window;
         this.close();
         win.close();
         DejaClick.service.__modal.close();

      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /******************************************
    *       Handlers
    ******************************************/
   /**
    * Update the form based on selected dialog type.
    * @this {!DejaClickUi.DialogPrompt}
    * @param aEvent
    */
   updateType: function (aEvent) {
      var type;

      try {
         type = this.elements.typeSelect.val();

         this.elements.input1Container.hide();
         this.elements.input2Container.hide();
         this.elements.input3Container.hide();
         this.elements.check1Container.hide();
         this.elements.optionsContainer.hide();
         this.elements.extraActionsContainer.hide();

         this.elements.input1.val('');
         this.elements.input2.val('');
         this.elements.input3.val('');
         this.elements.option1.prop('checked', true);
         this.elements.check1.prop('checked', false);
         this.elements.action1.prop('checked', true);

         switch (type) {
            case this.constants.DIALOGTYPE_LOGINPROMPT:
               this.elements.input1Container.show();
               this.elements.input2Container.show();

               this.elements.input1Label.text(this.utils.getMessage('deja_dialogPrompt_username'));
               this.elements.input2Label.text(this.utils.getMessage('deja_dialogPrompt_password'));

               this.elements.input2.attr('type', 'password');

               break;
            case this.constants.DIALOGTYPE_INPUTPROMPT:
               this.elements.input1Container.show();

               this.elements.input1Label.text(this.utils.getMessage('deja_dialogPrompt_input1'));

               break;
            case this.constants.DIALOGTYPE_GENERICPROMPT:
               this.elements.input1Container.show();
               this.elements.input2Container.show();
               this.elements.input3Container.show();

               this.elements.extraActionsContainer.show();

               this.elements.input1Label.text(this.utils.getMessage('deja_dialogPrompt_input1'));
               this.elements.input2Label.text(this.utils.getMessage('deja_dialogPrompt_input2'));
               this.elements.input3Label.text(this.utils.getMessage('deja_dialogPrompt_input3'));

               this.elements.input2.attr('type', 'text');

               break;
            case this.constants.DIALOGTYPE_CERTUNKNOWN:
               this.elements.optionsContainer.show();

               break;
            case this.constants.DIALOGTYPE_CERTINVALID:
               this.elements.check1Container.show();

               this.elements.check1Label.text(this.utils.getMessage('deja_dialogPrompt_permanentlyStore'));

               break;
            case this.constants.DIALOGTYPE_CERTCLIENT:
               this.elements.check1Container.show();

               this.elements.check1Label.text(this.utils.getMessage('deja_dialogPrompt_rememberDecision'));

               break;
            case this.constants.DIALOGTYPE_CONFIRMPROMPT:
            case this.constants.DIALOGTYPE_CERTMISMATCH:
            case this.constants.DIALOGTYPE_CERTEXPIRED:
            default:
               break;
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Manage controls state based on the form filling
    * @this {!DejaClickUi.DialogPrompt}
    */
   enableControls: function () {
      var ordinal, dialogCount, isOrdinalInvalid,
         repeatCount, isRepeatCountInvalid;

      try {
         // Ordinal
         ordinal = this.elements.dialogOrdinal.val();
         dialogCount = this.getDialogCount();

         isOrdinalInvalid = !($.isNumeric(ordinal)) ||
            +ordinal < 1 ||
            +ordinal > (this.item == null && dialogCount + 1 || dialogCount);

         // Repeat count
         repeatCount = this.elements.repeatCount.val();

         isRepeatCountInvalid = !($.isNumeric(repeatCount)) ||
            +repeatCount < this.constants.DIALOGREPEAT_MIN ||
            +repeatCount > this.constants.DIALOGREPEAT_MAX;

         this.elements.apply.button(
            'option',
            'disabled',
            isOrdinalInvalid || isRepeatCountInvalid);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /******************************************
    *       Helpers
    ******************************************/
   /**
    * Get number of dialog elements inside current context
    * @this {!DejaClickUi.DialogPrompt}
    * @returns {number}
    */
   getDialogCount: function () {
      try {
         return this.context.getElementsByTagName('dialog').length;
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Update ordinal attribute for all dialogs inside current context
    * @this {!DejaClickUi.DialogPrompt}
    */
   updateOrdinals: function () {
      var dialogs, i, l;

      try {
         dialogs = this.context.getElementsByTagName('dialog');
         for (i = 0, l = dialogs.length; i < l; i++) {
            dialogs[i].setAttribute('ordinal', i + 1);
         }
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Reorder dialogs based on ordinal input field value
    * @this {!DejaClickUi.DialogPrompt}
    */
   reorderDialog: function () {
      var dialog, dialogs, dialogsElt, newPosition;

      try {
         dialog = this.item;
         dialogsElt = dialog.parentNode;
         dialogs = dialogsElt.getElementsByTagName('dialog');
         newPosition = +this.elements.dialogOrdinal.val();

         if (dialogs[newPosition - 1]) {
            dialogsElt.removeChild(dialog);
            dialogsElt.insertBefore(dialog, dialogs[newPosition - 1]);
         }

         this.updateOrdinals();
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Get a parameter of the dialog being edited.
    * @this {!DejaClickUi.DialogPrompt}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getParam: function (aName) {
      return this.script.domTreeGetDialogParam(this.item, aName);
   },

   /**
    * Set or change the value of a parameter of the dialog.
    * @this {!DejaClickUi.DialogPrompt}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setParam: function (aName, aValue) {
      this.script.domTreeChangeDialogParam(this.item, aName, aValue);
   },

   /**
    * Delete a parameter of the dialog.
    * @this {!DejaClickUi.DialogPrompt}
    * @param {string} aName The name of the parameter to delete.
    */
   deleteParam: function (aName) {
      this.script.domTreeDelDialogParam(this.item, aName);
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('dialogPrompt')) {
            DejaClickUi.dialogPrompt.close();
            delete DejaClickUi.dialogPrompt;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the DialogPrompts instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.dialogPrompt = new DejaClickUi.DialogPrompt(
            DejaClick.service.__modal.arguments,
            document.documentElement,
            window,
            DejaClick.constants,
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