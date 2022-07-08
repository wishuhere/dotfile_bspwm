/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
 * DejaClick by SmartBear Software.
 * Copyright (C) 2006-2022 SmartBear Software.  All Rights Reserved.
 *
 * The contents of this file are subject to the End User License Agreement.
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 */

'use strict'; 

/**
 * Preferred width of the add/edit content view dialog.
 * @const
 */
var preferredWidth = 400;

/**
 * Preferred height of the add/edit content view dialog.
 * @const
 */
var preferredHeight = 550;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of adding/editing content view.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{
 *    context: !Element,
 *    item: ?Element
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!DejaClick.DejaService} aService The DejaClick record/replay service.
 * @param {!DejaClick.Script} aScript The script to which the edited
 *    content view applies.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 */
DejaClickUi.ContentView = function (aOptions, aRootElement, aWindow,
                                    aConstants, aUtils, aService, aScript,
                                    ADialogWindow) {
   var root;
   aWindow.returnValue = null;
   this.contentViewCloseCallback = aOptions.callback ? aOptions.callback : null; 
   this.context = aOptions.context;
   this.item = aOptions.item;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.service = aService;
   this.script = aScript;
   this.DialogWindow = ADialogWindow;
   this.contentViewName = this.item && this.getParam('cvname') || null;
   this.scopeTreeInstance = null;

   /**
    * The "modal" dialog window opened by this page.
    * @type {?DejaClick.DialogWindow}
    */
   this.dialog = null;

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),
      description: root.find('#contentviewDescription'),

      contentViewName: root.find('#contentViewName'),

      addComponent: root.find('#addComponent'),
      editComponent: root.find('#editComponent'),
      cloneComponent: root.find('#cloneComponent'),
      removeComponent: root.find('#removeComponent'),
      moveUpComponent: root.find('#moveUpComponent'),
      moveDownComponent: root.find('#moveDownComponent'),
      componentList: root.find('#componentList'),

      filterOnContentType: root.find('#filterOnContentType'),
      addType: root.find('#addType'),
      editType: root.find('#editType'),
      removeType: root.find('#removeType'),
      typeList: root.find('#typeList'),

      minimumSize: root.find('#minimumSize'),
      maximumSize: root.find('#maximumSize'),

      scopeTreeContainer: root.find('#scopeTreeContainer'),

      continueOnError: root.find('#continueOnError'),

      applyContentView : root.find('#dejaContentViewApply'),
      cancelContentView : root.find('#dejaContentViewCancel'),

      allButtons: root.find('button'),
      allInputs: root.find('input, select, option'),
      changeInputs: root.find(
         '#contentViewName,' +
         '#componentList,' +
         '#filterOnContentType,' +
         '#typeList,' +
         '#minimumSize,' +
         '#maximumSize'),
      allPropertyTitles: root.find('.property-title')
   };

   // Initialize buttons.
   this.elements.allButtons.button();
   this.elements.applyContentView.button();
   this.elements.cancelContentView.button();

   // Initialize event handlers.
   let that = this;
   console.log('clicked! init contentview');
   this.elements.addComponent.off('click');

   this.elements.addComponent.on('click',this.addComponent.bind(this)); 
   this.elements.editComponent.on('click', this.editComponent.bind(this));
   this.elements.cloneComponent.on('click', this.cloneComponent.bind(this));
   this.elements.removeComponent.on('click', this.removeComponent.bind(this));
   this.elements.moveUpComponent.on('click', this.moveUpComponent.bind(this));
   this.elements.moveDownComponent.on('click', this.moveDownComponent.bind(this));

   this.elements.addType.on('click', this.addType.bind(this));
   this.elements.editType.on('click', this.editType.bind(this));
   this.elements.removeType.on('click', this.removeType.bind(this));

   this.elements.applyContentView.on('click', this.contentViewApply.bind(this));
   this.elements.cancelContentView.on('click', this.contentViewCancel.bind(this));

   this.elements.changeInputs.on('change input', this.enableControls.bind(this));
   this.elements.allPropertyTitles.on('click', this.toggleProperty.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();
};

DejaClickUi.ContentView.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ContentView,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.ContentView}
    */ 
   init: function () {
      var arrComponents = [], mimes = [], types = [], strComponents, i, l;

      try {
         if (this.item == null) {
            // Global

            if($('body').is('#dejaContentView')){
                  DejaClick.service.__modal.setTitle('deja_contentView_title_add');
            }

            this.elements.description.text(this.utils.getMessage(
               'deja_contentView_description_add_' + this.context.tagName));

            // Types
            mimes = Object.keys(this.service && this.service.encounteredMimes && this.service.encounteredMimes() || {}).sort();

            for (i = 0, l = mimes.length; i < l; i++) {
               mimes[i] = mimes[i].split(';')[0];
               types.indexOf(mimes[i]) === -1 && types.push(mimes[i]);
            }

            for (i = 0, l = types.length; i < l; i++) {
               this.completeUpdateType(true, types[i]);
            }
         } else {
            // Global
            if($('body').is('#dejaContentView')){
                  DejaClick.service.__modal.setTitle('deja_contentView_title_edit');
            }
            this.elements.description.text(this.utils.getMessage(
                  'deja_contentView_description_edit_' + this.context.tagName));

            // Name
            this.elements.contentViewName.val(this.contentViewName);

            // Components
            strComponents = this.getParam('definition');
            strComponents && (arrComponents = strComponents
               .split(this.constants.CONTENTVIEW_DEFINITION_DELIMITER));

            this.completeUpdateComponentList(arrComponents);

            // Types
            this.getParam('type') && (types = this.getParam('type')
               .split(this.constants.CONTENTVIEW_DEFINITION_DELIMITER));
            this.elements.filterOnContentType.prop('checked', types.length);

            for (i = 0, l = types.length; i < l; i++) {
               this.completeUpdateType(true, types[i]);
            }

            // Length
            this.elements.minimumSize.val(this.getParam('gtsize') || '');
            this.elements.maximumSize.val(this.getParam('ltsize') || '');

            // Continue on error property
            this.elements.continueOnError
               .prop('checked', this.getParam('skip') === 'true');
         }

         this.initScope();
         this.enableControls();
      } catch (ex) {
            console.log(222);
            console.log(ex);
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Initialize the scope UI
    * @this {!DejaClickUi.ContentView}
    */
   initScope: function () {
      var contextActions = [], contextEvents = [],
         contextActionElements = [], contextEventElements = [],
         contextType, contextSeq, contextElement, scopeTreeContainer, i, l;

      try {
         contextType = this.context.tagName;
         scopeTreeContainer = this.elements.scopeTreeContainer;

         scopeTreeContainer
            .jstree({
               plugins: [ 'themes', 'json_data', 'checkbox' ],
               json_data: {
                  data: DejaClickUi.treeViewHelpers && DejaClickUi.treeViewHelpers.getScopeTreeViewData() || []
               },
               core: {
                  animation: 0
               },
               checkbox: {
                  two_state: true
               },
               themes: {
                  icons: false
               }
            })
            .on('loaded.jstree', function () {
               // Delete href attributes to disable link default events
               scopeTreeContainer.find('a').removeAttr('href');

               // Check needed context
               if (this.item == null) {
                  if (contextType == 'script') {
                     this.scopeTreeInstance.check_all();
                  } else {
                     contextSeq = this.context.getAttribute('seq');
                     contextElement = scopeTreeContainer
                        .find('li[type=' + contextType + ']' +
                        '[seq=' + contextSeq + ']');

                     this.scopeTreeInstance.check_node(contextElement);
                  }
               } else {
                  this.getParam('actionscope') &&
                     (contextActions = this.getParam('actionscope')
                        .split(this.constants.CONTENTVIEW_SCOPE_DELIMITER));

                  this.getParam('eventscope') &&
                     (contextEvents = this.getParam('eventscope')
                        .split(this.constants.CONTENTVIEW_SCOPE_DELIMITER));

                  for (i = 0, l = contextActions.length; i < l; i++) {
                     contextActionElements.push(scopeTreeContainer
                        .find('li[type=action]' + '[seq=' + contextActions[i] + ']'));

                     this.scopeTreeInstance.check_node(contextActionElements[i]);
                  }

                  for (i = 0, l = contextEvents.length; i < l; i++) {
                     contextEventElements.push(scopeTreeContainer
                        .find('li[type=event]' + '[seq=' + contextEvents[i] + ']'));

                     this.scopeTreeInstance.check_node(contextEventElements[i]);
                  }
               }
            }.bind(this));

         this.scopeTreeInstance = $.jstree._reference(scopeTreeContainer);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.ContentView}
    */
   contentViewClose: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.allButtons.off('click').button('destroy');
            this.elements.changeInputs.off('change input');
            this.elements.allPropertyTitles.off('click');

            this.elements.componentList.children('option').off('dblclick');
            this.elements.typeList.children('option').off('dblclick');
         }

         if (this.hasOwnProperty('dialog') && (this.dialog !== null)) {
            this.dialog.close();
            this.dialog = null;
         }

         delete this.elements;
         delete this.dialog;

         delete this.scopeTreeInstance;
         delete this.contentViewName;
         delete this.DialogWindow;
         delete this.script;
         delete this.service;
         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.item;
         delete this.context;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new component.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the add component button.
    */
   addComponent: function (aEvent) {
      var urls;
      aEvent.preventDefault();
      aEvent.stopPropagation();
      try {
         urls = Object.keys(this.service && this.service.encounteredUrls && this.service.encounteredUrls() || {});

         if (urls && urls.length) {
               this.openDialog('ui/content/dejaContentViewHints.html',
               {
                  cvManager: {
                     getContentViewsList: this.getContentViewsList.bind(this)
                  }
               },
               this.completeUpdateComponentList.bind(this));
         } else {
            this.openDialog('ui/content/dejaContentViewComponent.html',
               {
                  item: null,
                  cvManager: {
                     getContentViewsList: this.getContentViewsList.bind(this)
                  }
               },
               this.completeUpdateComponent.bind(this, true));
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected component.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the edit component button.
    */
   editComponent: function (aEvent) {
      var selectedComponent;

      try {
         if (this.elements.componentList[0].selectedIndex !== -1) {

            selectedComponent = this.elements.componentList
               .children('option:selected')
               .val()
               .split(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

            if (selectedComponent && selectedComponent.length && selectedComponent.length >= 3) {
               this.openDialog('ui/content/dejaContentViewComponent.html',
                  {
                     item: selectedComponent,
                     cvManager: {
                        getContentViewsList: this.getContentViewsList.bind(this)
                     }
                  },
                  this.completeUpdateComponent.bind(this, false));
            }
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   completeUpdateComponentList: function (aComponents) {
      var componentParams, i, l;

      try {
         if (aComponents && aComponents.length) {
            for (i = 0, l = aComponents.length; i < l; i++) {
               componentParams = aComponents[i]
                  .split(this.constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER);

               this.completeUpdateComponent(true, componentParams);
            }
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Create new component or update the selected one.
    * Is called after component dialog close.
    * @this {!DejaClickUi.ContentView}
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
               this.elements.componentList.children('option:selected');

            componentElem
               .val(strComponent)
               .text(componentDescription)
               .removeClass()
               .addClass(componentTypeName)
               .addClass(isComponentExcluded && 'excluded' || 'included');
            aIsNew && componentElem
               .on('dblclick', this.editComponent.bind(this));

            componentElem && aIsNew &&
               this.elements.componentList.append(componentElem);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Clone the currently selected component.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the clone component button.
    */
   cloneComponent: function (aEvent) {
      var selectedComponent, clonedComponent;

      try {
         if (this.elements.componentList[0].selectedIndex !== -1) {
            selectedComponent = this.elements.componentList
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
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the remove component button.
    */
   removeComponent: function (aEvent) {
      try {
         if (this.elements.componentList[0].selectedIndex !== -1) {
            this.elements.componentList.children('option:selected').remove();
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Move up the currently selected component in the list of components.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the move up component button.
    */
   moveUpComponent: function (aEvent) {
      var selectedComponent, previousComponent;

      try {
         if (this.elements.componentList[0].selectedIndex > 0) {
            selectedComponent = this.elements.componentList
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
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the move down component button.
    */
   moveDownComponent: function (aEvent) {
      var selectedComponent, nextComponent;

      try {
         if (this.elements.componentList[0].selectedIndex !==
            this.elements.componentList.children('option').length - 1) {

            selectedComponent = this.elements.componentList
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
    * Open a dialog window to define a new type.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the add type button.
    */
   addType: function (aEvent) {
      try {
         this.openDialog('ui/content/dejaContentTypeMember.html',
            {
               item: null
            },
            this.completeUpdateType.bind(this, true));
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected type.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the edit type button.
    */
   editType: function (aEvent) {
      var selectedType;

      try {
         if (this.elements.typeList[0].selectedIndex !== -1) {
            selectedType = this.elements.typeList
               .children('option:selected')
               .val();

            if (selectedType) {
               this.openDialog('ui/content/dejaContentTypeMember.html',
                  {
                     item: selectedType
                  },
                  this.completeUpdateType.bind(this, false));
            }
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Create new type or update the selected one.
    * Is called after type dialog close.
    * @this {!DejaClickUi.ContentView}
    * @param {?boolean} aIsNew Type status.
    * @param {?string} aType Type data.
    *    (or null if the add type dialog was canceled).
    */
   completeUpdateType: function (aIsNew, aType) {
      var typeElem;

      try {
         if (aType) {
            typeElem = aIsNew && $('<option>') ||
               this.elements.typeList.children('option:selected');

            typeElem.val(aType).text(aType);
            aIsNew && typeElem.on('dblclick', this.editType.bind(this));

            typeElem && aIsNew && this.elements.typeList.append(typeElem);
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Remove the currently selected type.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the remove type button.
    */
   removeType: function (aEvent) {
      try {
         if (this.elements.typeList[0].selectedIndex !== -1) {
            this.elements.typeList.children('option:selected').remove();
            this.enableControls();
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Add class to clicked property title to expand property content.
    * @this {!DejaClickUi.ContentView}
    * @param aEvent A jQuery click event on the property title.
    */
   toggleProperty: function (aEvent) {
      var element;

      try {
         element = aEvent && aEvent.currentTarget;

         if (element) {
            $(element).toggleClass('expanded');
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this content view. Close the window.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   contentViewApply: function (aEvent) {
      var arrComponents = [], arrTypes = [], arrActionIds = [], arrEventIds = [],
         deviceName, strComponents, strTypes, componentElements, typeElements,
         minSize, maxSize, checkedScopeElements, checkedActionElements,
         checkedEventElements, strActionIds, strEventIds, parent, win, i, l;

      try {
         deviceName = this.elements.contentViewName.val();

         if (this.isNameExist(deviceName) == false) {
            // Components
            componentElements = this.elements.componentList.children('option');

            for (i = 0, l = componentElements.length; i < l; i++) {
               arrComponents[i] = componentElements[i].getAttribute('value');
            }

            arrComponents.length && (strComponents = arrComponents
               .join(this.constants.CONTENTVIEW_DEFINITION_DELIMITER));

            // Types
            if (this.elements.filterOnContentType.prop('checked')) {
               typeElements = this.elements.typeList.children('option');

               for (i = 0, l = typeElements.length; i < l; i++) {
                  arrTypes[i] = typeElements[i].getAttribute('value');
               }

               arrTypes.length && (strTypes = arrTypes
                  .join(this.constants.CONTENTVIEW_DEFINITION_DELIMITER));
            }

            // Length
            minSize = this.elements.minimumSize.val();
            maxSize = this.elements.maximumSize.val();

            // Scope
            if (this.scopeTreeInstance) {
               checkedScopeElements = this.scopeTreeInstance.get_checked();

               if (checkedScopeElements) {
                  // Scope: actions
                  checkedActionElements = checkedScopeElements.filter('[type=action]');

                  for (i = 0, l = checkedActionElements.length; i < l; i++) {
                     arrActionIds[i] = checkedActionElements[i].getAttribute('seq');
                  }

                  arrActionIds.length && (strActionIds = arrActionIds
                     .join(this.constants.CONTENTVIEW_SCOPE_DELIMITER));

                  // Scope: events
                  checkedEventElements = checkedScopeElements.filter('[type=event]');

                  for (i = 0, l = checkedEventElements.length; i < l; i++) {
                     arrEventIds[i] = checkedEventElements[i].getAttribute('seq');
                  }

                  arrEventIds.length && (strEventIds = arrEventIds
                     .join(this.constants.CONTENTVIEW_SCOPE_DELIMITER));
               }
            }

            // Save to script
            if (this.item == null) {
               parent = this.script.getChildWithTag(
                  this.script.getScriptElement(), 'contentviews');

               if (parent == null) {
                  parent = this.script.domTreeInsertNode(
                     this.script.getScriptElement(), 'contentviews');
               }

               this.item = this.script.domTreeInsertNode(parent, 'contentview');
               this.item.setAttribute('type', this.constants.CONTENTVIEW_TYPE);
            }

            this.script.renumberElements('contentview');

            // Mandatory params
            this.setParam('cvname', deviceName);
            this.setParam('definition', strComponents);
            this.setParam('skip', '' + this.elements.continueOnError.prop('checked'));

            // Optional params
            strTypes ? this.setParam('type', strTypes) :
               this.deleteParam('type');

            minSize ? this.setParam('gtsize', minSize) :
               this.deleteParam('gtsize');

            maxSize ? this.setParam('ltsize', maxSize) :
               this.deleteParam('ltsize');

            strActionIds ? this.setParam('actionscope', strActionIds) :
               this.deleteParam('actionscope');

            strEventIds ? this.setParam('eventscope', strEventIds) :
               this.deleteParam('eventscope');

            this.window.returnValue = this.item;

            var win = this.window;
            this.contentViewClose();
            if(this.contentViewCloseCallback){
                  this.contentViewCloseCallback();
            }
            if($('body').is('#dejaContentView')){
                  this.contentViewClose();
                  win.close();
            }
             DejaClick.service.__modal.close();

         } else {
            this.utils.promptService.notifyUser('deja_contentView_nameExist', true);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.ContentView}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   contentViewCancel: function (aEvent) {
      try {
            var win = this.window;
            this.contentViewClose();
            if(this.contentViewCloseCallback){
                  this.contentViewCloseCallback();
            }
            if($('body').is('#dejaContentView')){
                  this.contentViewClose();
                  win.close();
            }
             DejaClick.service.__modal.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.ContentView}
    */
   enableControls: function () {
      /**
       * Check whether provided length is invalid
       * @param aLength
       * @returns {*|boolean}
       */
      function isLengthInvalid (aLength) {
         return aLength && (isNaN(aLength) || !isFinite(aLength) || aLength < 0) || false;
      }

      var isNameEmpty, componentCount, isComponentListEmpty,
         selectedComponentIndex, isComponentUnselected,
         isTypeListEmpty, isTypesDisabled, isTypeUnselected,
         minSize, maxSize, isMinSizeEmpty, isMaxSizeEmpty,
         isMinSizeInvalid, isMaxSizeInvalid;

      try {
         if (this.dialog == null) {
            isNameEmpty = this.elements.contentViewName.val().length === 0;

            componentCount = this.elements.componentList
               .children('option').length;
            isComponentListEmpty = componentCount === 0;
            selectedComponentIndex = this.elements.componentList[0]
               .selectedIndex;
            isComponentUnselected = selectedComponentIndex === -1;

            isTypesDisabled = !this.elements.filterOnContentType.prop('checked');
            isTypeListEmpty = this.elements.typeList
               .children('option').length === 0;
            isTypeUnselected = this.elements.typeList[0].selectedIndex === -1;

            minSize = this.elements.minimumSize.val();
            maxSize = this.elements.maximumSize.val();

            isMinSizeEmpty = minSize.length === 0;
            isMaxSizeEmpty = maxSize.length === 0;

            isMinSizeInvalid = isLengthInvalid(minSize);
            isMaxSizeInvalid = isLengthInvalid(maxSize) || (maxSize && +maxSize < +minSize) || false;

            // Global
            this.elements.applyContentView.button('option', 'disabled',
               isNameEmpty ||
               (isComponentListEmpty && (isTypesDisabled || isTypeListEmpty) && isMinSizeEmpty && isMaxSizeEmpty) ||
               isMinSizeInvalid || isMaxSizeInvalid);
            this.elements.cancelContentView.button('option', 'disabled', false);
            this.elements.allInputs.prop('disabled', false);

            this.item && this.contentViewName && this.elements.contentViewName
               .prop('disabled', true);
            this.elements.scopeTreeContainer
               .removeClass('pseudo-disabled-element');

            // Components
            this.elements.addComponent.button('option', 'disabled', false);
            this.elements.editComponent.button('option', 'disabled',
               isComponentUnselected);
            this.elements.cloneComponent.button('option', 'disabled',
               isComponentUnselected);
            this.elements.removeComponent.button('option', 'disabled',
               isComponentUnselected);

            this.elements.moveUpComponent.button('option', 'disabled',
               selectedComponentIndex < 1);
            this.elements.moveDownComponent.button('option', 'disabled',
               isComponentUnselected ||
               selectedComponentIndex === componentCount - 1);

            // Content types
            this.elements.addType.button('option', 'disabled', isTypesDisabled);
            this.elements.editType.button('option', 'disabled',
               isTypesDisabled || isTypeUnselected);
            this.elements.removeType.button('option', 'disabled',
               isTypesDisabled || isTypeUnselected);
            this.elements.typeList.prop('disabled', isTypesDisabled);
            this.elements.typeList.children('option')
               .prop('disabled', isTypesDisabled);
         } else {
            // A "modal" dialog is open. Disable everything.
            this.elements.allInputs.prop('disabled', true);
            this.elements.allButtons.button('option', 'disabled', true);
            this.elements.scopeTreeContainer
               .addClass('pseudo-disabled-element');
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Get an array of the content views available
    * @this {!DejaClickUi.ContentView}
    * @returns {Array}
    */
   getContentViewsList: function () {
      var viewNames = [], viewName, views, i;

      try {
         views = this.script.getScriptElement().getElementsByTagName('contentview');

         for (i = 0; i < views.length; i++) {
            viewName = this.script.domTreeGetContentViewParam(views[i], "cvname");

            // don't add current content view to the list
            if (viewName != this.contentViewName) {
               viewNames.push(viewName);
            }
         }
      } catch (ex) {
            console.log('cv ' + ex);
            DejaClick.utils.logger.logException(ex);
      }

      return viewNames;
   },

   /**
    * Check whether provided content view name is in use
    * @this {!DejaClickUi.ContentView}
    * @param {string} aName - The content view name
    * @returns {boolean} - true if content view with such name exists
    */
   isNameExist: function (aName) {
      var viewNames;

      try {
         viewNames = this.getContentViewsList();

         if (aName) {
            return viewNames.indexOf(aName) !== -1;
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }

      return null;
   },

   /**
    * Get a parameter of the content view being edited.
    * @this {!DejaClickUi.ContentView}
    * @param {string} aName The name of the parameter to retrieve.
    * @return {?string} The value of the parameter, or null if no such
    *    parameter exists.
    */
   getParam: function (aName) {
      return this.script.domTreeGetContentViewParam(this.item, aName);
   },

   /**
    * Set or change the value of a parameter of the content view.
    * @this {!DejaClickUi.ContentView}
    * @param {string} aName The name of the parameter to set.
    * @param {string} aValue The value of the parameter.
    */
   setParam: function (aName, aValue) {
      this.script.domTreeChangeContentViewParam(this.item, aName, aValue);
   },

   /**
    * Delete a parameter of the content view.
    * @this {!DejaClickUi.ContentView}
    * @param {string} aName The name of the parameter to delete.
    */
   deleteParam: function (aName) {
      DejaClick.script.domTreeDelContentViewParam(this.item, aName);
   },

   /**
    * Open a dialog window and disable all the controls in this window.
    * @this {!DejaClickUi.ContentView}
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
               null,
               this.closeDialog.bind(this,
                  ((opt_callback == null) ? null : opt_callback)),
               this.utils.logger);
            this.enableControls();
         }
      } catch (ex) {
            DejaClick.utils.logger.logException(ex);
      }
   },

   /**
    * Center the dialog over the window.
    * @this {!DejaClickUi.ContentView}
    * @param {DejaClick.DialogWindow} aDialog The dialog window to be centered.
    */
   centerDialog: function (aDialog) {
      try {
         aDialog.centerOn(this.window);
      } catch (ex) {
            DejaClick.utils.logger.logException(ex);
      }
   },

   /**
    * Clean up after a dialog window has been closed. Enable the
    * controls in this window. Handle the dialog result.
    * @this {!DejaClickUi.ContentView}
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
            DejaClick.utils.logger.logException(ex);
      }
   }
};

/**
 * Clean up when the page is unloaded.
 * @param {!Event} aEvent A jQuery unload event on the window.
 */
function contentViewUnload(aEvent) {
      try {
            if (DejaClickUi.hasOwnProperty('contentView')) {
            DejaClickUi.contentView.contentViewClose();
            delete DejaClickUi.contentView;
            }
            $(window).off('unload');
      } catch (ex) {
            DejaClick.utils.logger.logException(ex);
      }
}

/**
 * Create and initialize the ContentView instance once the
 * page is loaded and the dialog arguments are available.
 */
function contentViewInitialize(args) {
       // rootelement is validationcontainer if called from sidebar
       var rootElement = args ? $('#contentViewContainer') : document.documentElement;
       var args = args ? args : DejaClick.service.__modal.arguments;
       
      try {
            DejaClickUi.contentView = new DejaClickUi.ContentView(
                  args,
                  rootElement,
                  window,
                  DejaClick.constants,
                  DejaClick.utils,
                  DejaClick.service,
                  DejaClick.script,
                  DejaClick.DialogWindow);
                  if($('body').is('#dejaContentView')){
                        DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
                  }
            $(window).on('unload', contentViewUnload);
            return DejaClickUi.contentView;

      } catch (ex) {
            DejaClick.utils.logger.logException(ex);
      }
}

$(function () {

   try {
         if($('body').is('#dejaContentView')){
            if (DejaClick.service.__modal.arguments) {
                  contentViewInitialize();
            } else {
               window.onDialogArguments = contentViewInitialize;
            }
         }
     
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});