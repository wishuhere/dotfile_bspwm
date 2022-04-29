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
 * Preferred width of the add/edit content view hints dialog.
 * @const
 */
var preferredWidth = 625;

/**
 * Preferred height of the add/edit content view hints dialog.
 * @const
 */
var preferredHeight = 350;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of easy adding/editing content view
 *    components from prepared suggestions.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    cvManager: !Object
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.DejaService} aService The DejaClick record/replay service.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 */
DejaClickUi.CVHints = function (aOptions, aRootElement, aWindow, aConstants,
                                aUtils, aService, ADialogWindow) {
   var root;

   aWindow.returnValue = null;

   this.cvManager = aOptions.cvManager;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.service = aService;
   this.DialogWindow = ADialogWindow;
   this.componentsTreeInstance = null;

   /**
    * The "modal" dialog window opened by this page.
    * @type {?DejaClick.DialogWindow}
    */
   this.dialog = null;

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),

      componentsTreeContainer: root.find('#componentsTreeContainer'),
      includedItemList: root.find('#includedItemList'),

      add: root.find('#add'),
      edit: root.find('#edit'),
      clone: root.find('#clone'),
      remove: root.find('#remove'),
      moveUp: root.find('#moveUp'),
      moveDown: root.find('#moveDown'),

      includeComponent: root.find('#includeComponent'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      changeInputs: root.find('#includedItemList'),
      allInputs: root.find('select'),
      allButtons: root.find('button')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.add.on('click', this.addComponent.bind(this));
   this.elements.edit.on('click', this.editComponent.bind(this));
   this.elements.clone.on('click', this.cloneComponent.bind(this));
   this.elements.remove.on('click', this.removeComponent.bind(this));
   this.elements.moveUp.on('click', this.moveUpComponent.bind(this));
   this.elements.moveDown.on('click', this.moveDownComponent.bind(this));

   this.elements.includeComponent.on('click', this.includeComponent.bind(this));

   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.cancel.on('click', this.cancel.bind(this));

   this.elements.changeInputs.on('change input', this.enableControls.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.CVHints.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.CVHints,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.CVHints}
    */
   init: function () {
      try {
         this.elements.title.text(this.utils.getMessage(
            'deja_contentViewHints_title'));

         this.initAvailableComponents();
         this.enableControls();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Initialize the available components UI
    * @this {!DejaClickUi.CVHints}
    */
   initAvailableComponents: function () {
      var componentsTreeContainer;

      try {
         componentsTreeContainer = this.elements.componentsTreeContainer;

         componentsTreeContainer
            .jstree({
               plugins: [ 'themes', 'json_data', 'ui', 'types' ],
               json_data: {
                  data: this.getCVHintsTreeViewData()
               },
               core: {
                  animation: 0
               },
               themes: {
                  icons: false
               },
               types: {
                  type_attr: 'category',
                  types: {
                     root: {
                        select_node: false
                     }
                  }
               }
            })
            .on({
               'loaded.jstree': function () {
                  // Delete href attributes to disable link default events
                  componentsTreeContainer.find('a').removeAttr('href');
               },
               'select_node.jstree': function() {
                  this.enableControls();
               }.bind(this)
            });

         this.componentsTreeInstance = $.jstree._reference(componentsTreeContainer);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.CVHints}
    */
   close: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.allButtons.off('click').button('destroy');
            this.elements.changeInputs.off('change input');

            this.elements.includedItemList.children('option').off('dblclick');
         }

         if (this.hasOwnProperty('dialog') && (this.dialog !== null)) {
            this.dialog.close();
            this.dialog = null;
         }

         delete this.elements;
         delete this.dialog;

         delete this.componentsTreeInstance;
         delete this.DialogWindow;
         delete this.service;
         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.cvManager;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new component.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the add component button.
    */
   addComponent: function (aEvent) {
      try {
         this.openDialog('ui/content/dejaContentViewComponent.html',
            {
               item: null,
               cvManager: this.cvManager
            },
            this.completeUpdateComponent.bind(this, true));
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected component.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the edit component button.
    */
   editComponent: function (aEvent) {
      var selectedComponent;

      try {
         if (this.elements.includedItemList[0].selectedIndex !== -1) {

            selectedComponent = this.elements.includedItemList
               .children('option:selected')
               .val()
               .split(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

            if (selectedComponent && selectedComponent.length && selectedComponent.length >= 3) {
               this.openDialog('ui/content/dejaContentViewComponent.html',
                  {
                     item: selectedComponent,
                     cvManager: this.cvManager
                  },
                  this.completeUpdateComponent.bind(this, false));
            }
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Create new component or update the selected one.
    * Is called after component dialog close.
    * @this {!DejaClickUi.CVHints}
    * @param {?boolean} aIsNew Component status.
    * @param {?Array} aComponent Component data.
    *    (or null if the add component dialog was canceled).
    */
   completeUpdateComponent: function (aIsNew, aComponent) {
      var strComponent, componentDescription, isComponentExcluded,
         componentTypeName, componentElem;

      try {
         if (aComponent && aComponent.length && aComponent.length >= 3) {
            strComponent = aComponent
               .join(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

            componentDescription = aComponent[1];

            isComponentExcluded = aComponent[aComponent.length - 1] ===
            this.constants.CONTENTVIEW_DEFINITION_EXCLUDE;

            switch (aComponent[0]) {
               case this.constants.CONTENTVIEW_DEFINITION_CONTAINS:
                  componentTypeName = 'url-type';
                  break;

               case this.constants.CONTENTVIEW_DEFINITION_REFERENCES:
                  componentTypeName = 'content-view-type';
                  break;

               case this.constants.CONTENTVIEW_DEFINITION_PREDEFINED:
                  componentTypeName = 'pre-defined-list-type';
                  break;

               default:
                  break;
            }

            componentElem = aIsNew && $('<option>') ||
            this.elements.includedItemList.children('option:selected');

            componentElem
               .val(strComponent)
               .text(componentDescription)
               .removeClass()
               .addClass(componentTypeName)
               .addClass(isComponentExcluded && 'excluded' || 'included');
            aIsNew && componentElem
               .on('dblclick', this.editComponent.bind(this));

            componentElem && aIsNew &&
            this.elements.includedItemList.append(componentElem);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Clone the currently selected component.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the clone component button.
    */
   cloneComponent: function (aEvent) {
      var selectedComponent, clonedComponent;

      try {
         if (this.elements.includedItemList[0].selectedIndex !== -1) {
            selectedComponent = this.elements.includedItemList
               .children('option:selected');
            clonedComponent = selectedComponent.clone(true);

            clonedComponent.insertAfter(selectedComponent);
            clonedComponent.prop('selected', true);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Remove the currently selected component.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the remove component button.
    */
   removeComponent: function (aEvent) {
      try {
         if (this.elements.includedItemList[0].selectedIndex !== -1) {
            this.elements.includedItemList.children('option:selected').remove();
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Move up the currently selected component in the list of components.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the move up component button.
    */
   moveUpComponent: function (aEvent) {
      var selectedComponent, previousComponent;

      try {
         if (this.elements.includedItemList[0].selectedIndex > 0) {
            selectedComponent = this.elements.includedItemList
               .children('option:selected');
            previousComponent = selectedComponent.prev();

            selectedComponent.insertBefore(previousComponent);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Move down the currently selected component in the list of components.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the move down component button.
    */
   moveDownComponent: function (aEvent) {
      var selectedComponent, nextComponent;

      try {
         if (this.elements.includedItemList[0].selectedIndex !==
            this.elements.includedItemList.children('option').length - 1) {

            selectedComponent = this.elements.includedItemList
               .children('option:selected');
            nextComponent = selectedComponent.next();

            selectedComponent.insertAfter(nextComponent);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Include the currently selected component from available components to included.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the include component button.
    */
   includeComponent: function (aEvent) {
      var selectedElements, selectedComponentParams, i, l;

      try {
         if (this.componentsTreeInstance) {
            selectedElements = this.componentsTreeInstance.get_selected();

            if (selectedElements) {
               for (i = 0, l = selectedElements.length; i < l; i++) {
                  selectedComponentParams = selectedElements[i]
                     .getAttribute('value')
                     .split(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

                  if (selectedComponentParams) {
                     this.completeUpdateComponent(true, selectedComponentParams);
                  }
               }

               this.componentsTreeInstance.delete_node(selectedElements);
            }
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this content view component. Close the window.
    * @this {!DejaClickUi.CVHints}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var components = [], componentElements, win, i, l;

      try {
         componentElements = this.elements.includedItemList
            .children('option');

         for (i = 0, l = componentElements.length; i < l; i++) {
            components[i] = componentElements[i].getAttribute('value');
         }

         this.window.returnValue = components.length && components || null;

         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.CVHints}
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
    * @this {!DejaClickUi.CVHints}
    */
   enableControls: function () {
      var isAvailableUnselected, componentCount, isComponentListEmpty,
         selectedComponentIndex, isComponentUnselected, selectedElements;

      try {
         if (this.dialog == null) {
            if (this.componentsTreeInstance) {
               selectedElements = this.componentsTreeInstance.get_selected() || [];
               isAvailableUnselected = selectedElements.length === 0;
            }

            componentCount = this.elements.includedItemList
               .children('option').length;

            isComponentListEmpty = componentCount === 0;

            selectedComponentIndex = this.elements.includedItemList[0]
               .selectedIndex;

            isComponentUnselected = selectedComponentIndex === -1;

            //Global
            this.elements.apply.button('option', 'disabled',
               isComponentListEmpty);
            this.elements.cancel.button('option', 'disabled', false);
            this.elements.allInputs.prop('disabled', false);
            this.elements.includeComponent.button('option', 'disabled',
               isAvailableUnselected);
            this.elements.componentsTreeContainer
               .removeClass('pseudo-disabled-element');

            // Components
            this.elements.add.button('option', 'disabled', false);
            this.elements.edit.button('option', 'disabled',
               isComponentUnselected);
            this.elements.clone.button('option', 'disabled',
               isComponentUnselected);
            this.elements.remove.button('option', 'disabled',
               isComponentUnselected);

            this.elements.moveUp.button('option', 'disabled',
               selectedComponentIndex < 1);
            this.elements.moveDown.button('option', 'disabled',
               isComponentUnselected ||
               selectedComponentIndex === componentCount - 1);
         } else {
            // A "modal" dialog is open. Disable everything.
            this.elements.allInputs.prop('disabled', true);
            this.elements.allButtons.button('option', 'disabled', true);
            this.elements.componentsTreeContainer
               .addClass('pseudo-disabled-element');
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window and disable all the controls in this window.
    * @this {!DejaClickUi.CVHints}
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
    * @this {!DejaClickUi.CVHints}
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
    * @this {!DejaClickUi.CVHints}
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
   },

   /**
    * Generate a tree data structure for CV Hints dialog
    *    (in the format required by JSTree)
    * @this {!DejaClickUi.CVHints}
    * @returns {Array}
    */
   getCVHintsTreeViewData: function () {
      var predefinedList = {}, tree = [], subtree = {}, rawUrls, urls = [],
         domains = [], contentViews = [], entity = {}, value = '', i, key;

      try {
         rawUrls = Object.keys(this.service && this.service.encounteredUrls && this.service.encounteredUrls() || {});

         /**
          * Prepare domain and url lists for building tree objects later
          */
         for (i = 0; i < rawUrls.length; i++) {
            // fill urls list
            value = (rawUrls[i].split('/')).splice(0, 3).join('/') + '/';
            if (urls.indexOf(value) === -1) {
               urls.push(value);
            }

            // fill domains list
            value = rawUrls[i].match(/:\/\/(www\.)?(.[^/:]+)/)[2];
            if (domains.indexOf(value) === -1) {
               domains.push(value);
            }
         }


         /**
          * Prepare domains tree
          */

         subtree = {
            data: 'Domains',
            attr: {
               category: 'root'
            },
            children: [],
            state: 'open'
         };

         for (i = 0; i < urls.length; i++) {
            value = [
               this.constants.CONTENTVIEW_DEFINITION_CONTAINS,
               domains[i],
               this.constants.CONTENTVIEW_DEFINITION_PLAINTEXT,
               this.constants.CONTENTVIEW_DEFINITION_INCLUDE
            ].join(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

            entity = {
               data: domains[i],
               attr: {
                  value: value,
                  title: domains[i]
               }
            };

            subtree.children.push(entity);
         }

         tree.push(subtree);


         /**
          * Prepare urls tree
          */

         subtree = {
            data: 'URLs',
            attr: {
               category: 'root'
            },
            children: [],
            state: 'close'
         };

         for (i = 0; i < urls.length; i++) {
            value = [
               this.constants.CONTENTVIEW_DEFINITION_CONTAINS,
               urls[i],
               this.constants.CONTENTVIEW_DEFINITION_PLAINTEXT,
               this.constants.CONTENTVIEW_DEFINITION_INCLUDE
            ].join(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

            entity = {
               data: urls[i],
               attr: {
                  value: value,
                  title: urls[i]
               }
            };

            subtree.children.push(entity);
         }

         tree.push(subtree);

         /**
          * Prepare content views tree
          */

         subtree = {
            data: 'Content Views',
            attr: {
               category: 'root'
            },
            children: [],
            state: 'close'
         };

         contentViews = this.cvManager && this.cvManager.getContentViewsList() || [];

         for (i = 0; i < contentViews.length; i++) {
            value = [
               this.constants.CONTENTVIEW_DEFINITION_REFERENCES,
               contentViews[i],
               this.constants.CONTENTVIEW_DEFINITION_INCLUDE
            ].join(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

            entity = {
               data: contentViews[i],
               attr: {
                  value: value,
                  title: contentViews[i]
               }
            };

            subtree.children.push(entity);
         }

         tree.push(subtree);


         /**
          * Prepare predefined lists tree
          */

         subtree = {
            data: 'Predefined Lists',
            attr: {
               category: 'root'
            },
            children: [],
            state: 'close'
         };

         predefinedList = this.utils.prefService.getPrefOption('DC_OPTID_CV_PREDEFINEDLIST');

         for (key in predefinedList) {
            if (predefinedList.hasOwnProperty(key)) {
               value = [
                  this.constants.CONTENTVIEW_DEFINITION_PREDEFINED,
                  predefinedList[key].name,
                  predefinedList[key].description,
                  predefinedList[key].value,
                  this.constants.CONTENTVIEW_DEFINITION_INCLUDE
               ].join(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

               entity = {
                  data: predefinedList[key].name,
                  attr: {
                     value: value,
                     title: predefinedList[key].name
                  }
               };

               subtree.children.push(entity);
            }
         }

         tree.push(subtree);

         return tree;
      }
      catch(ex) {
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
         if (DejaClickUi.hasOwnProperty('cvHints')) {
            DejaClickUi.cvHints.close();
            delete DejaClickUi.cvHints;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the CVHints instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.cvHints = new DejaClickUi.CVHints(
            window.dialogArguments,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.service,
            DejaClick.DialogWindow);
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