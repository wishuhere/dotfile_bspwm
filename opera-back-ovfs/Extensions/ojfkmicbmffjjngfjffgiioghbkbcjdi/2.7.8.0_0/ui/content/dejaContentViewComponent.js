/*
 * Add/edit content view component dialog.
 * Input: {{
 *    item:?Element
 * }}
 * - The component to be edited (or null to add a new component).
 *
 * Output: {?Element} The successfully changed or created component or null if
 *    the operation was canceled.
 */

/*global window,DejaClickUi,$,DejaClick,document,chrome*/

'use strict';

/**
 * Preferred width of the add/edit content view component dialog.
 * @const
 */
var preferredWidth = 300;
/**
 * Preferred height of the add/edit content view component dialog.
 * @const
 */
var preferredHeight = 350;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of editing content view component.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    item: ?Element,
 *    cvManager: !Object
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
 *    javascript validation applies.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.CVComponent = function (aOptions, aRootElement, aWindow,
                                    aWindowsApi, aConstants, aUtils, aService,
                                    aScript, AEventRegistration) {
   var root;

   aWindow.returnValue = null;

   this.item = aOptions.item;
   this.cvManager = aOptions.cvManager;
   this.window = aWindow;
   this.windowsApi = aWindowsApi;
   this.constants = aConstants;
   this.utils = aUtils;
   this.service = aService;
   this.script = aScript;

   this.events = new AEventRegistration().
      enable(false).
      addChromeListener(aWindowsApi.onRemoved, this.removeRegularExpressionHelpWindow, this);

   /**
    * Identity of the window containing regular expression help.
    * @type {integer|null}
    */
   this.helpWindowId = null;

   this.predefined = {};

   this.typesIds = {};
   this.typesIds[this.constants.CONTENTVIEW_DEFINITION_CONTAINS] = 'typeUrl';
   this.typesIds[this.constants.CONTENTVIEW_DEFINITION_REFERENCES] = 'typeContentView';
   this.typesIds[this.constants.CONTENTVIEW_DEFINITION_PREDEFINED] = 'typeList';

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#description'),

      typeSelect: root.find('#type'),
      typeUrl: root.find('#typeUrl'),
      typeContentView: root.find('#typeContentView'),
      typeList: root.find('#typeList'),
      typesAll: root.find('#params > div'),

      url: root.find('#url'),
      urlError: root.find('#urlError'),
      matchType: root.find('input:radio[name=matchType]'),
      regExpHelp: root.find('#regExpHelp'),

      contentViews: root.find('#contentViews'),

      list: root.find('#list'),

      exclude: root.find('#exclude'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allInputs: root.find('input, select, option'),
      allButtons: root.find('button')
   };

   // Initialize event handlers.
   this.elements.typeSelect.on('change', this.changeType.bind(this));
   this.elements.allInputs.on('change input', this.enableControls.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.regExpHelp.on('click',
      this.showRegularExpressionHelp.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.CVComponent.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.CVComponent,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.CVComponent}
    */
   init: function () {
      var cvList = [],
         i, key, option;

      try {
         cvList = this.cvManager && this.cvManager.getContentViewsList() || [];

         this.elements.allButtons.button();

         // fill content views
         for (i = 0; i < cvList.length; i++) {
            option = $(document.createElement('option'))
               .attr('value', cvList[i])
               .text(cvList[i]);

            this.elements.contentViews.append(option);
         }
         if (!this.elements.contentViews.children().length) {
            this.elements.contentViews.attr('disabled', true);
         }

         // fill predefined list
         this.preparePredefinedLists();
         for (key in this.predefined) {
            if (this.predefined.hasOwnProperty(key)) {
               option = $(document.createElement('option'))
                  .attr('value', key)
                  .text(this.predefined[key].name);

               this.elements.list.append(option);
            }
         }

         // Add a component
         if (this.item == null) {
            this.elements.title.text(this.utils.getMessage('deja_contentViewComponent_title_add'));
            DejaClick.service.__modal.setTitle('deja_contentViewComponent_title_add');

            this.elements.description.text(this.utils.getMessage('deja_contentViewComponent_description_add'));

            this.elements.typeSelect.val(this.constants.CONTENTVIEW_DEFINITION_CONTAINS).change();
            this.elements.matchType.val([this.constants.CONTENTVIEW_DEFINITION_PLAINTEXT]);
         }
         // Edit a component
         else {
            this.elements.title.text(this.utils.getMessage('deja_contentViewComponent_title_edit'));
            DejaClick.service.__modal.setTitle('deja_contentViewComponent_title_edit');

            this.elements.description.text(this.utils.getMessage('deja_contentViewComponent_description_edit'));

            switch (this.item[0]) {

               case this.constants.CONTENTVIEW_DEFINITION_CONTAINS:

                  this.elements.typeSelect.val(this.constants.CONTENTVIEW_DEFINITION_CONTAINS).change();
                  this.elements.url.val(this.item[1]);
                  this.elements.matchType.val([this.item[2]]).change();

                  if (this.item[3] == this.constants.CONTENTVIEW_DEFINITION_EXCLUDE) {
                     this.elements.exclude.prop('checked', true);
                  }

                  break;

               case this.constants.CONTENTVIEW_DEFINITION_REFERENCES:

                  this.elements.typeSelect.val(this.constants.CONTENTVIEW_DEFINITION_REFERENCES).change();
                  this.elements.contentViews.val(this.item[1]);

                  if (this.item[2] == this.constants.CONTENTVIEW_DEFINITION_EXCLUDE) {
                     this.elements.exclude.prop('checked', true);
                  }

                  break;

               case this.constants.CONTENTVIEW_DEFINITION_PREDEFINED:

                  this.elements.typeSelect.val(this.constants.CONTENTVIEW_DEFINITION_PREDEFINED).change();
                  this.elements.list.val(this.getIdByName(this.item[1]));

                  if (this.item[4] == this.constants.CONTENTVIEW_DEFINITION_EXCLUDE) {
                     this.elements.exclude.prop('checked', true);
                  }

                  break;

               default:
                  break;
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
    * @this {!DejaClickUi.CVComponent}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click');
         this.elements.regExpHelp.off('click');
         this.elements.allInputs.off('change input');
      }
      if (this.hasOwnProperty('helpWindowId') &&
         (this.helpWindowId !== null) &&
         this.hasOwnProperty('windowsApi')) {
         this.windowsApi.remove(this.helpWindowId);
      }
      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.typesIds;
      delete this.helpWindowId;
      delete this.events;
      delete this.elements;
      delete this.utils;
      delete this.constants;
      delete this.service;
      delete this.script;
      delete this.windowsApi;
      delete this.window;
      delete this.cvManager;
      delete this.predefined;
      delete this.item;
   },

   /**
    * Apply the changes to this component. Close the window.
    * @this {!DejaClickUi.CVComponent}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var component = [], exclude, value, win;

      try {
         exclude = this.elements.exclude.prop('checked') ?
            this.constants.CONTENTVIEW_DEFINITION_EXCLUDE :
            this.constants.CONTENTVIEW_DEFINITION_INCLUDE;

         // what are we going to save?
         switch(this.elements.typeSelect.val()) {

            case this.constants.CONTENTVIEW_DEFINITION_CONTAINS:
               if (this.elements.url.val()) {
                  component.push(this.constants.CONTENTVIEW_DEFINITION_CONTAINS);
                  component.push(this.elements.url.val());
                  component.push(this.elements.matchType.filter(':checked').val());
                  component.push(exclude);
               }
               break;

            case this.constants.CONTENTVIEW_DEFINITION_REFERENCES:
               if (this.elements.contentViews.val()) {
                  component.push(this.constants.CONTENTVIEW_DEFINITION_REFERENCES);
                  component.push(this.elements.contentViews.val());
                  component.push(exclude);
               }
               break;

            case this.constants.CONTENTVIEW_DEFINITION_PREDEFINED:
               if (this.elements.list.val()) {
                  value = this.elements.list.val();
                  component.push(this.constants.CONTENTVIEW_DEFINITION_PREDEFINED);
                  component.push(this.predefined[value].name);
                  component.push(this.predefined[value].description);
                  component.push(this.predefined[value].value);
                  component.push(exclude);
               }
               break;

            default:
               break;
         }

         this.close();
         DejaClick.service.__modal.close(component.length ? component : null);

      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.CVComponent}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;
      try {
         // Close the object first to ensure that the help window is closed.
         this.close();
         DejaClick.service.__modal.close();

      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /* This conflicts with dialog positioning. @todo: investigate and use */
/*   adjustWindowHeight: function () {
      var newHeight;
      try {
         newHeight = document.body.clientHeight
            + parseInt($('body').css('margin-top'))
            + parseInt($('body').css('margin-bottom'));

         window.resizeTo(preferredWidth, newHeight);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },*/

   /**
    * Fill the list of the predefined items based on localStorage and loaded
    *    script if any.
    * @this {!DejaClickUi.CVComponent}
    */

   preparePredefinedLists: function () {
      var list = {},
         option, i, key;

      try {
         // add predefined items to the select
         list = this.utils.prefService.getPrefOption('DC_OPTID_CV_PREDEFINEDLIST');

         for (key in list) {
            if (list.hasOwnProperty(key)) {
               this.predefined[key] = list[key];
            }
         }

         // add items from a script if loaded
         if (this.script.getFilename()) {
            list = this.getScriptPredefinedList();

            for (key in list) {
               if (list.hasOwnProperty(key) && !this.predefined[key]) {
                  this.predefined[key] = list[key];
               }
            }
         }

      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Return an object contains all predefined list items from content views
    * of the current script
    * @returns {Object}
    */
   getScriptPredefinedList : function () {
      var i, j, views, nodeList, definition, components, component, items = {}, itemID;

      try {
         // get all content views
         views = this.script.getScriptElement().getElementsByTagName('contentview');

         // go through definitions
         for (i = 0; i < views.length; i++) {
            definition = this.script.domTreeGetContentViewParam(views[i], "definition");

            // does definition contain predefined item?
            if (definition && definition.indexOf(this.constants.CONTENTVIEW_DEFINITION_PREDEFINED + this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER) > -1) {
               components = definition.split(this.constants.CONTENTVIEW_DEFINITION_DELIMITER);

               for (j = 0; j < components.length; j++) {

                  // is definition item predefined?
                  if (components[j].indexOf(this.constants.CONTENTVIEW_DEFINITION_PREDEFINED + this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER) > -1) {

                     component = components[j].split(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);
                     itemID = this.getIdByName(component[1]);
                     items[itemID] = {
                        name: component[1],
                        description: component[2],
                        value: component[3]
                     }
                  }
               }
            }
         }

         return items;
      }
      catch ( ex ) {
         this.utils.logger.logException( ex, gDC.DCMODULE + "getScriptPredefinedList" );
      }
   },

   /**
    * Transforms the name provided to id
    * @this {!DejaClickUi.CVComponent}
    * @param {string} aItemName - The item name
    * @returns {string} - The item ID
    */
   getIdByName: function(aItemName) {
      try {
         if (aItemName) {
            return aItemName.replace(/\s/g, '-').toLowerCase();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open (or focus) a window containing help on writing regular expressions.
    * @this {!DejaClickUi.CVComponent}
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
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Store a reference to the window that was opened to display
    * help on writing regular expressions.
    * @this {!DejaClickUi.CVComponent}
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
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Detect when the regular expression help window is closed.
    * @this {!DejaClickUi.CVComponent}
    * @param {integer} aId The id of the window that has been closed.
    */
   removeRegularExpressionHelpWindow: function (aId) {
      try {
         if (aId === this.helpWindowId) {
            this.helpWindowId = null;
            this.events.enable(false);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Update the UI based on selected component type
    * @this {!DejaClickUi.CVComponent}
    * @param {!Event} aEvent A jQuery click event on the type select element
    */
   changeType: function (aEvent) {
      var type = this.typesIds[this.elements.typeSelect.val()];

      try {
         this.elements.typesAll.hide();
         this.elements[type].show();
         //this.adjustWindowHeight();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.CVComponent}
    */
   enableControls: function () {
      var isDisabled = false,
         test;
      try {
         switch (this.elements.typeSelect.val()) {
            case this.constants.CONTENTVIEW_DEFINITION_CONTAINS:
               // if empty url field
               if (!this.elements.url.val()) {
                  isDisabled = true;
                  this.elements.urlError.text('');
               }
               else {
                  // :: and ||  are dividers in a script params
                  // so they shouldn't be entered. never. never ever.
                  if (this.elements.url.val().search(/\:\:|\|\|/) !== -1) {
                     this.elements.urlError.text(this.utils.getMessage('deja_contentViewComponent_invalidURL'));
                     isDisabled = true;
                  }
                  // regexp should be valid
                  else if (this.elements.typeUrl.find('input[name=matchType]:checked').val() == this.constants.CONTENTVIEW_DEFINITION_REGEXP) {
                     try {
                        test = new RegExp(this.elements.url.val());
                     }
                     catch ( ex ) {
                        this.elements.urlError.text(this.utils.getMessage('deja_contentViewComponent_invalidRegexp'));
                        isDisabled = true;
                     }
                  }
               }
               if (!isDisabled) {
                  this.elements.urlError.text('');
               }
               break;

            case this.constants.CONTENTVIEW_DEFINITION_REFERENCES:
               isDisabled = !this.elements.contentViews.val();
               break;

            case this.constants.CONTENTVIEW_DEFINITION_PREDEFINED:
               isDisabled = !this.elements.list.val();
               break;

            default:
               break;
         }

         this.elements.apply.button('option', 'disabled', isDisabled);
      }
      catch (ex) {
         this.utils.logger.logException(ex);
      }
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('cvComponent')) {
            DejaClickUi.cvComponent.close();
            delete DejaClickUi.cvComponent;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the JsValidation instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.cvComponent = new DejaClickUi.CVComponent(
            DejaClick.service.__modal.arguments,
            document.documentElement,
            window,
            chrome.windows,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.service,
            DejaClick.script,
            DejaClick.EventRegistration);
         DejaClick.service.__modal.resizeModal($('body').outerHeight() + 80);
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