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
 * Add/edit keyword validation dialog.
 * Input: {{
 *    context:!Element,
 *    item:?Element,
 *    matchText:(string|undefined),
 *    matchCase:(boolean|undefined),
 *    matchWord:(boolean|undefined),
 *    allowWrap:(boolean|undefined),
 *    fixSpaces:(boolean|undefined),
 *    document:(?Element|undefined)
 * }}
 * - Element of the script whose properties are being edited (either
 *   an action or event)
 * - The validation script element to be edited (or null to add a new
 *   validation).
 * - The text for which to search.
 * - Whether to consider case-insensitive matches (*).
 * - Whether whole word matches are required.
 * - Whether to allow matches across line breaks (*).
 * - Whether spaces should be fixed.
 * - The document element identifying the document in which to search
 *   for the text, or null to search all documents.
 *
 * When the item property specifies an element to be edited, all
 * subsequent properties (i.e., matchText, matchWord, fixSpaces,
 * document) are ignored.
 *
 * Output: {?Element} The successfully changed validation element or null if
 *    the operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit keyword validation dialog.
 * @const
 */
var preferredWidth = 400;
/**
 * Preferred height of the add/edit keyword validation dialog.
 * @const
 */
var preferredHeight = 550;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of editing keyword validations.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    context: !Element,
 *    item: ?Element,
 *    matchText: (string|undefined),
 *    matchCase:(boolean|undefined),
 *    matchWord:(boolean|undefined),
 *    allowWrap:(boolean|undefined),
 *    fixSpaces:(boolean|undefined),
 *    document:(?Element|undefined)
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!chrome.WindowsApi} aWindowsApi The chrome.windows API.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.DejaService} aService The DejaClick record/replay service.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    keyword validation applies.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 * @param {function(
 *    new:DejaClickUi.DisplayLevelSelector,
 *    string,
 *    !Element,
 *    ?function(integer),
 *    {!Object.<string,*>},
 *    !DejaClick.Utils,
 *    !function(new:DejaClick.EventRegistration))
 * } ADisplayLevelSelector The DisplayLevelSelector constructor.
 * @param {
 *    function(new:DejaClickUi.VariableSelector,
 *       string,
 *       !Element,
 *       !function(),
 *       !function(string,*,function(*)),
 *       !DejaClick.Utils)
 * } AVariableSelector The VariableSelector constructor.
 */
DejaClickUi.KeywordValidation = function (aOptions, aRootElement,
      aWindow, aWindowsApi, aConstants, aUtils, aService, aScript,
      AEventRegistration, ADialogWindow,
      ADisplayLevelSelector, AVariableSelector) {
   var root;

   aWindow.returnValue = null;

   this.context = aOptions.context;
   this.item = aOptions.item;
   this.window = aWindow;
   this.windowsApi = aWindowsApi;
   this.constants = aConstants;
   this.logger = aUtils.logger;
   this.service = aService;
   this.script = aScript;
   this.DialogWindow = ADialogWindow;

   this.events = new AEventRegistration().
      enable(false).
      addChromeListener(aWindowsApi.onRemoved, this.removeWindow, this);

   /**
    * Navigation tree document element identifying the document in
    * which to search for the keyword.
    * @type {?Element}
    */
   this.targetDocument = null;
   /**
    * Identity of the window containing regular expression help.
    * @type {?integer}
    */
   this.helpWindowId = null;

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

      matchDiv: root.find('#matchTextDiv'),
      matchText: root.find('#matchText'),

      plainText: root.find('#plainText'),
      regExp: root.find('#regExp'),
      regExpHelp: root.find('#regExpHelp'),

      matchCase: root.find('#matchCase'),
      matchWord: root.find('#matchWord'),
      allowWrap: root.find('#allowWrap'),
      fixSpaces: root.find('#fixSpaces'),

      actionType: root.find('#actionType'),
      requireMatch: root.find('#require'),
      forbidMatch: root.find('#forbid'),

      searchSet: root.find('#searchSet'),
      searchAll: root.find('#searchAll'),
      searchOne: root.find('#searchOne'),
      selectDocument: root.find('#selectDocument'),

      apply: root.find('#apply'),
      remove: root.find('#remove'),
      cancel: root.find('#cancel'),

      allInputs: root.find('textarea,input,select,a'),
      changeInputs: root.find('#matchText,#plainText,#regExp,#searchAll,#searchOne'),
      allButtons: root.find('button'),
      advancedOnly: root.find('.advancedOnly')
   };
   aUtils.localizeTree(aRootElement, 'deja_');

   this.variableSelector = new AVariableSelector(
      'x',
      root.find('#variableDiv')[0],
      this.changeVariable.bind(this),
      this.openDialog.bind(this),
      aUtils);
   this.variableSelector.setScript(aScript);

   this.displayLevel = new ADisplayLevelSelector(
      'x',
      root.find('#displayLevel')[0],
      this.displayDisplayLevel.bind(this),
      aConstants,
      aUtils,
      AEventRegistration);

   if (!this.hasOpenDocuments()) {
      // No documents are available. Hide the select document button.
      this.elements.selectDocument.hide();
      if ((this.item == null) ? (aOptions.document == null) :
            (this.script.getChildWithTag(this.item, 'targets') == null)) {
         // And we have no document to begin with.
         // Hide the entire search document section.
         this.elements.advancedOnly =
            this.elements.advancedOnly.not(this.elements.searchSet);
         this.elements.searchSet.hide();
      }
   }

   // Display initial values in UI.
   if (this.item == null) {
      // Adding a new keyword validation.
      this.elements.title.text(aUtils.getMessage('deja_keyword_addTitle'));
      this.elements.description.text(aUtils.getMessage(
         'deja_keyword_description_add_' + this.context.tagName));

      this.elements.matchText.val((aOptions.matchText == null) ? '' :
         aOptions.matchText);
      this.variableSelector.useVariable(false);

      this.elements.plainText.prop('checked', true);
      this.elements.matchCase.prop('checked',
         ((aOptions.matchCase == null) ? true : aOptions.matchCase));
      this.elements.matchWord.prop('checked',
         ((aOptions.matchWord == null) ? true : aOptions.matchWord));
      this.elements.allowWrap.prop('checked',
         ((aOptions.allowWrap == null) ? true : aOptions.allowWrap));
      this.elements.fixSpaces.prop('checked',
         ((aOptions.fixSpaces == null) ? true : aOptions.fixSpaces));
      this.elements.actionType.
         val(this.constants.VALIDATION_KEYWORD_ACTION_ERROR);
      this.elements.requireMatch.prop('checked', true);
      if (aOptions.document == null) {
         this.elements.searchAll.prop('checked', true);
      } else {
         this.elements.searchOne.prop('checked', true);
         this.targetDocument = aOptions.document;
      }
      this.elements.remove.hide();

   } else {
      this.elements.title.text(aUtils.getMessage('deja_keyword_editTitle'));
      this.elements.description.text(aUtils.getMessage(
         'deja_keyword_description_edit_' + this.context.tagName));

      if (this.script.domTreeHasValidateParam(this.item, 'varreference')) {
         this.variableSelector.useVariable(true);
         this.variableSelector.selectVariable(this.getParam('varreference'));
      } else {
         this.variableSelector.useVariable(false);
         this.elements.matchText.val(this.getParam('matchtext'));
      }
      if (this.getParam('matchtype') ===
            this.constants.VALIDATION_KEYWORDMATCH_REGEXP) {
         this.elements.regExp.prop('checked', true);
      } else {
         this.elements.plainText.prop('checked', true);
      }
      this.elements.matchCase.prop('checked',
         (this.getParam('matchcase') === 'true'));
      this.elements.matchWord.prop('checked',
         (this.getParam('matchword') === 'true'));
      this.elements.allowWrap.prop('checked',
         (this.getParam('allowwrap') === 'true'));
      this.elements.fixSpaces.prop('checked',
         (this.getParam('fixspaces') === 'true'));
      this.elements.actionType.val(this.getParam('actiontype'));
      if (this.getParam('errortype') ===
            this.constants.VALIDATION_KEYWORD_FORBIDMATCH) {
         this.elements.forbidMatch.prop('checked', true);
      } else {
         this.elements.requireMatch.prop('checked', true);
      }
      if (this.getParam('searchtype') ===
            this.constants.VALIDATION_KEYWORD_SEARCHONE) {
         this.elements.searchOne.prop('checked', true);
      } else {
         this.elements.searchAll.prop('checked', true);
      }
   }

   // Initialize event handlers.
   this.elements.changeInputs.on('change input', this.changeValue.bind(this));
   this.elements.regExpHelp.on('click',
      this.showRegularExpressionHelp.bind(this));
   this.elements.allButtons.button();
   this.elements.selectDocument.on('click', this.selectDocument.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.remove.on('click', this.remove.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.enableControls();
};

DejaClickUi.KeywordValidation.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.KeywordValidation,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.KeywordValidation}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.changeInputs.off('change input');
         this.elements.regExpHelp.off('click');
         this.elements.allButtons.off('click').button('destroy');
      }
      if (this.hasOwnProperty('dialog') && (this.dialog !== null)) {
         this.dialog.close();
         this.dialog = null;
      }
      if (this.hasOwnProperty('displayLevel')) {
         this.displayLevel.close();
      }
      if (this.hasOwnProperty('variableSelector')) {
         this.variableSelector.close();
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
      delete this.displayLevel;
      delete this.variableSelector;
      delete this.dialog;
      delete this.helpWindowId;
      delete this.targetDocument;
      delete this.events;
      delete this.DialogWindow;
      delete this.script;
      delete this.service;
      delete this.logger;
      delete this.constants;
      delete this.windowsApi;
      delete this.window;
      delete this.item;
      delete this.context;
   },

   /**
    * Determine whether the script has a navigation tree containing
    * any available documents that apply to the context of the
    * validation.
    * @return {boolean} true if any applicable documents can be found,
    *    false otherwise.
    */
   hasOpenDocuments: function () {
      var navTree, child, attrName, seqNum;

      /**
       * Determine whether a document is applicable to the current context.
       * @param {!Element} aDocument A document element in the navigation tree.
       * @return {boolean} true if the document was encountered before the
       *    validation's context was completed and it has not been unloaded.
       */
      function appliesToContext(aDocument) {
         return (Number(aDocument.getAttribute(attrName)) <= seqNum) &&
            !aDocument.hasAttribute('docunloaded');
      }

      // Find the navigation tree root. Prefer a replay tree to a record tree.
      navTree = null;
      child = this.script.getScriptElement().firstElementChild;
      while (child !== null) {
         if (child.tagName === 'navigation') {
            if (child.getAttribute('type') === 'replay') {
               navTree = child;
               break;
            } else {
               navTree = child;
            }
         }
         child = child.nextElementSibling;
      }

      // Search for applicable document elements.
      attrName = this.context.tagName;
      seqNum = Number(this.context.getAttribute('seq'));
      return (navTree !== null) &&
         Array.prototype.some.call(navTree.getElementsByTagName('document'),
            appliesToContext);
   },

   /**
    * Change the value of some setting that affects whether another
    * setting is available.
    * @this {!DejaClickUi.KeywordValidation}
    * @param {!Event} aEvent A jQuery change or input event on some control.
    */
   changeValue: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open (or focus) a window containing help on writing regular expressions.
    * @this {!DejaClickUi.KeywordValidation}
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
         this.logger.logException(ex);
      }
   },

   /**
    * Store a reference to the window that was opened to display
    * help on writing regular expressions.
    * @this {!DejaClickUi.KeywordValidation}
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
    * @this {!DejaClickUi.KeywordValidation}
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
   },

   /**
    * Open a dialog to select the document in which to search for a
    * keyword match.
    * @this {!DejaClick.KeywordValidation}
    * @param {!Event} aEvent A jQuery click event on the select
    *    document button.
    */
   selectDocument: function (aEvent) {
      var target;
      try {
         target = this.targetDocument;
         if ((target == null) &&
               (this.item !== null) &&
               (this.script.getChildWithTag(this.item, 'targets') !== null)) {
            target = this.service.findTargetDocument(this.item, 0);
         }
         this.openDialog('ui/content/dejaDocument.html',
            {
               context: this.context,
               targetDocument: target
            },
            this.completeSelectDocument.bind(this));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Record the result of the document selection dialog box to use
    * as the target for the validation.
    * @this {!DejaClick.KeywordValidation}
    * @param {?Element} aDocument A document element in the script's
    *    navigation tree that identifies the document in which to
    *    search for the text.
    */
   completeSelectDocument: function (aDocument) {
      try {
         if (aDocument !== null) {
            this.targetDocument = aDocument;
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this keyword validation. Close the window.
    * @this {!DejaClick.KeywordValidation}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var parent, targets, win;
      try {
         if (this.item == null) {
            parent = this.script.getChildWithTag(this.context, 'validations');
            if (parent == null) {
               parent = this.script.domTreeInsertNode(this.context,
                  'validations');
            }
            this.item = this.script.domTreeInsertNode(parent, 'validation');
            this.item.setAttribute('type',
               this.constants.VALIDATION_TYPE_KEYWORD);
         }
         this.script.renumberElements('validation');

         if (this.variableSelector.isVariableUsed()) {
            this.script.domTreeDelValidateParam(this.item, 'matchtext');
            this.setParam('varreference',
               this.variableSelector.getVariableName());
         } else {
            this.script.domTreeDelValidateParam(this.item, 'varreference');
            this.setParam('matchtext', this.elements.matchText.val());
         }
         this.setParam('matchtype', (this.elements.plainText.prop('checked') ?
            this.constants.VALIDATION_KEYWORDMATCH_PLAIN :
            this.constants.VALIDATION_KEYWORDMATCH_REGEXP));
         this.setParam('matchcase',
            String(this.elements.matchCase.prop('checked')));
         this.setParam('matchword',
            String(this.elements.matchWord.prop('checked')));
         this.setParam('allowwrap',
            String(this.elements.allowWrap.prop('checked')));
         this.setParam('fixspaces',
            String(this.elements.fixSpaces.prop('checked')));
         this.setParam('actiontype', this.elements.actionType.val());
         this.setParam('errortype',
            (this.elements.requireMatch.prop('checked') ?
               this.constants.VALIDATION_KEYWORD_REQUIREMATCH :
               this.constants.VALIDATION_KEYWORD_FORBIDMATCH));

         targets = this.script.getChildWithTag(this.item, 'targets');
         if (this.elements.searchAll.prop('checked')) {
            this.setParam('searchtype',
               this.constants.VALIDATION_KEYWORD_SEARCHALL);
            if (targets !== null) {
               this.script.domTreeRemoveNode(targets);
            }

         } else if (this.targetDocument == null) {
            this.setParam('searchtype', (targets == null) ?
               this.constants.VALIDATION_KEYWORD_SEARCHALL :
               this.constants.VALIDATION_KEYWORD_SEARCHONE);

         } else {
            this.setParam('searchtype',
               this.constants.VALIDATION_KEYWORD_SEARCHONE);
            if (targets !== null) {
               this.script.domTreeRemoveNode(targets);
            }
            this.service.addSearchTargets(this.item, this.targetDocument, null);
         }

         this.window.returnValue = this.item;

         // Close the KeywordValidation object first to ensure that
         // the help window is closed.
         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Remove the validation being edited. Close the window.
    * @this {!DejaClick.KeywordValidation}
    * @param {!Event} aEvent A jQuery click event on the remove button.
    */
   remove: function (aEvent) {
      var parent, win;
      try {
         this.window.returnValue = this.item;

         parent = this.item.parentNode;
         this.script.domTreeRemoveNode(this.item);
         if (parent.firstElementChild == null) {
            this.script.domTreeRemoveNode(parent);
         }
         this.script.renumberElements('validation');

         // Close the KeywordValidation object first to ensure that
         // the help window is closed.
         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.KeywordValidation}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;
      try {
         // Close the KeywordValidation object first to ensure that
         // the help window is closed.
         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the display based upon the new display level.
    * This is called from the DisplayLevelSelector member (displayLevel).
    * @this {!DejaClickUi.KeywordValidation}
    * @param {integer} aLevel The new display level.
    */
   displayDisplayLevel: function (aLevel) {
      try {
         this.elements.advancedOnly.
            toggle(aLevel >= this.constants.DISPLAYLEVEL_ADVANCED);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the page to reflect the current script variable selections.
    * This is called from the VariableSelector member (variableSelector).
    * @this {!DejaClickUi.KeywordValidation}
    */
   changeVariable: function () {
      try {
         this.elements.matchDiv.toggle(!this.variableSelector.isVariableUsed());
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window and disable all the controls in this window.
    * @this {!DejaClickUi.KeywordValidation}
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
    * @this {!DejaClickUi.KeywordValidation}
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
    * @this {!DejaClickUi.KeywordValidation}
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
    * @this {!DejaClickUi.KeywordValidation}
    */
   enableControls: function () {
      if (this.dialog == null) {
         this.variableSelector.enableControls(true);
         this.displayLevel.enableControls(true);
         this.elements.allInputs.removeAttr('disabled');
         this.elements.allButtons.button('option', 'disabled', false);
         if (!this.elements.plainText.prop('checked')) {
            this.elements.matchWord.attr('disabled', 'true');
         }
         if (this.elements.searchAll.prop('checked')) {
            this.elements.selectDocument.button('option', 'disabled', true);
         }
         if (this.variableSelector.isVariableUsed() ?
               !this.variableSelector.isValid() :
               (this.elements.matchText.val().length === 0)) {
            this.elements.apply.button('option', 'disabled', true);
         }

      } else {
         // A "modal" dialog is open. Disable everything.
         this.variableSelector.enableControls(false);
         this.displayLevel.enableControls(false);
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      }
   },

   /**
    * Get a parameter of the validation being edited.
    * @this {!DejaClickUi.KeywordValidation}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getParam: function (aName) {
      return this.script.domTreeGetValidateParam(this.item, aName);
   },

   /**
    * Set or change the value of a parameter of the validation.
    * @this {!DejaClickUi.KeywordValidation}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setParam: function (aName, aValue) {
      this.script.domTreeChangeValidateParam(this.item, aName, aValue);
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('keywordValidation')) {
            DejaClickUi.keywordValidation.close();
            delete DejaClickUi.keywordValidation;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the KeywordValidation instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.keywordValidation = new DejaClickUi.KeywordValidation(
            window.dialogArguments,
            document.documentElement,
            window,
            chrome.windows,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.service,
            DejaClick.script,
            DejaClick.EventRegistration,
            DejaClick.DialogWindow,
            DejaClickUi.DisplayLevelSelector,
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
