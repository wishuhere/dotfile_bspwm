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
 * Frame used to display and configure properties of the system,
 * script, subscript, action, or event. The containing window must
 * create a DejaClick.Properties object when it is loaded and close it
 * when it is closed.
 * Input: {} None
 * Output: {} None
 */

/*global DejaClickUi,$,document,window*/

'use strict';

/**
 * Class to encapsulate the functionality of the DejaClick properties
 * frame.  The properties pane is used to configure the properties of
 * scripts, subscripts (or branches), actions, events, system record
 * properties, and system replay properties.
 *
 * Properties accepts the following events from external sources:
 * - setContext() - update the context of the properties displayed.
 * - dejaclick:runmode - change the run mode, enabling or disabling the UI.
 * - dejaclick:preferences('DC_OPTID_DISPLAY_LEVEL') - change the display
 *    level, affecting which properties are displayed.
 * - dejaclick:propertyupdated - Refresh the UI for a property based upon
 *    new data.
 * - openParentDialog() - Disable the UI.
 * - closeParentDialog() - Enable the UI.
 * - broadcastActive('apply') - Apply all active properties.
 * - broadcastActive('reset') - Reset all active properties to their
 *    default state.
 *
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function():?DejaClick.Script} aGetScript Function to retrieve the
 *    script being processed by the extension.
 * @param {function(string, *=, function(*)=)} aOpenDialog Function to
 *    open a "modal" dialog window and disable all controls on the page.
 *    This includes calling this.openParentDialog.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 * @param {function(function(*)=, number=, number=)} AVariable
 *    The script variable common utils constructor.
 */
DejaClickUi.Properties = function (aDejaClick, aUtils, aConstants, aGetScript, aOpenDialog,
      AEventRegistration, AVariable) {
   var observerService;

   DejaClick = aDejaClick;
   // Get references to background objects, especially the logger.
   this.logger = aUtils.logger;
   this.constants = aConstants;
   observerService = aUtils.observerService;
   this.events = new AEventRegistration().
      addDejaListener(observerService, 'dejaclick:preferences',
         this.dispatchPreferenceChange, this).
      addDejaListener(observerService, 'dejaclick:runmode',
         this.updateRunMode, this).
      addDejaListener(observerService, 'dejaclick:propertyupdated',
         this.refreshProperty, this);

   this.state = {
      running: false, // whether record/replay is active
      dialogOpen: false // whether a "modal" dialog is open
   };

   this.context = new DejaClickUi.PropertyContext(aUtils, aConstants,
      aGetScript, aOpenDialog, AVariable);

   this.properties = {
      description: new DejaClickUi.DescriptionProperty(this.context),
      eventInput: new DejaClickUi.EventInputProperty(this.context),
      //notes: new DejaClickUi.NotesProperty(this.context),
      kwValidations: new DejaClickUi.KeywordValidationsProperty(this.context),
      //imgValidations: new DejaClickUi.ImageValidationsProperty(this.context),
      jsValidations: new DejaClickUi.JsValidationsProperty(this.context),
      replayAdvisor: new DejaClickUi.ReplayAdvisorProperty(this.context),
      eventTimeout: new DejaClickUi.EventTimeoutProperty(this.context),
      pauseIntervals: new DejaClickUi.PauseIntervalsProperty(this.context),
      maxSkipped: new DejaClickUi.SkippedEventsProperty(this.context),
      dialogPrompts: new DejaClickUi.DialogPromptsProperty(this.context),
      matchOptions: new DejaClickUi.MatchOptionsProperty(this.context),
      replayTimings: new DejaClickUi.ReplayTimingsProperty(this.context),
      variableOptions: new DejaClickUi.VariableOptionsProperty(this.context),
      variables: new DejaClickUi.VariablesProperty(this.context),
      //datasets: new DejaClickUi.DatasetsProperty(this.context),
      browserPrefs: new DejaClickUi.BrowserPrefsProperty(this.context),
      headers: new DejaClickUi.HeadersProperty(this.context),
      urlMasks: new DejaClickUi.UrlExclusionsProperty(this.context),
      contentViews: new DejaClickUi.ContentViewsProperty(this.context),
      //userExperience: new DejaClickUi.UserExperienceProperty(this.context),
      branches: new DejaClickUi.BranchesProperty(this.context),
      newVisitor: new DejaClickUi.NewVisitorProperty(this.context),
      //screenEvents: new DejaClickUi.TrueScreenEventsProperty(this.context),
      blockOptions: new DejaClickUi.BlockOptionsProperty(this.context),
      //browserOptions: new DejaClickUi.BrowserOptionsProperty(this.context),
      inputOptions: new DejaClickUi.InputOptionsProperty(this.context),
      //flashOptions: new DejaClickUi.FlashOptionsProperty(this.context),
      locationChanges: new DejaClickUi.LocationChangesProperty(this.context),
      contentChanges: new DejaClickUi.ContentChangesProperty(this.context),
      networkActivity: new DejaClickUi.NetworkActivityProperty(this.context),
      captureData: new DejaClickUi.CaptureDataProperty(this.context),
      mobileOptions: new DejaClickUi.MobileOptionsProperty(this.context),
      security: new DejaClickUi.SecurityProperty(this.context),
      logOptions: new DejaClickUi.LogOptionsProperty(this.context),
      contentViewOptions: new DejaClickUi.ContentViewOptionsProperty(this.context)
   };
   /** @type {!Array.<string>} */
   this.activeProperties = [];

   // Initialize the window.
   this.elements = {
      accordion: $('#accordion'),
      folds: $('h3')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   // Create jQuery UI widgets and set up event handlers.
   this.elements.accordion.accordion({
      active: false,
      collapsible: true,
      heightStyle: 'content'
   });

   this.setContext('');
};

DejaClickUi.Properties.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Properties,

   /**
    * Shut down the properties pane in response to the containing
    * page being unloaded.  Abort any asynchronous activities and
    * dialogs started by this window and release all references to
    * objects external to this page. The containing window should
    * call this when it is unloaded.
    * @this {DejaClickUi.Properties}
    */
   close: function () {
      try {
         this.broadcastAll('close');
         if (this.hasOwnProperty('elements')) {
            this.elements.accordion.accordion('destroy');
         }
         if (this.hasOwnProperty('events')) {
            this.events.close();
         }
         if (this.hasOwnProperty('context')) {
            this.context.close();
         }

         delete this.elements;
         delete this.activeProperties;
         delete this.properties;
         delete this.context;
         delete this.state;
         delete this.events;
         delete this.constants;
         delete this.logger;
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * List of properties relevant to each category.
    * @const
    */
   CATEGORY_PROPERTIES: {
      play: [
         'replayAdvisor',
         'eventInput',
         'eventTimeout',
         'pauseIntervals',
         'maxSkipped',
         'matchOptions',
         'replayTimings',
         'variableOptions',
         'flashOptions',
         'locationChanges',
         'contentChanges',
         'networkActivity',
         'captureData',
         'userExperience',
         'security',
         'logOptions'
      ],

      record: [
         'newVisitor',
         'screenEvents',
         'blockOptions',
         'browserOptions',
         'logOptions',
         'inputOptions',
         'flashOptions',
         'mobileOptions'
      ],

      script: [
         'description',
         'variables',
         'datasets',
         'notes',
         'eventInput',
         'eventTimeout',
         'pauseIntervals',
         'urlMasks',
         'maxSkipped',
         'matchOptions',
         'replayTimings',
         'browserPrefs',
         'headers',
         'flashOptions',
         'locationChanges',
         'contentChanges',
         'networkActivity',
         'contentViews',
         'branches',
         'captureData',
         'logOptions',
         'userExperience'
      ],

      subscript: [
         'description'
      ],

      action: [
         'description',
         'notes',
         'kwValidations',
         'imgValidations',
         'jsValidations',
         'contentViews',
         'branches'
      ],

      event: [
         'description',
         'notes',
         'kwValidations',
         'imgValidations',
         'jsValidations',
         'eventInput',
         'eventTimeout',
         'pauseIntervals',
         'dialogPrompts',
         'matchOptions',
         'replayTimings',
         'flashOptions',
         'locationChanges',
         'contentChanges',
         'networkActivity',
         'contentViews',
         'branches',
         'captureData',
         'logOptions',
         'userExperience'
      ],

      none: []
   },

   /**
    * Change the object whose properties are being displayed.  This is
    * called when the context of the properties window is
    * changed. This is usually either at initialization time or when a
    * row in the tree view is selected.
    * @this {DejaClickUi.Properties}
    * @param {string} aContext The hashkey of an element in the
    *    current script or 'play' or 'record'. Any other value will
    *    hide all properties.
    */
   setContext: function (aContext) {
      this.context.setContext(aContext);
      this.activeProperties = this.CATEGORY_PROPERTIES[this.context.category];
      this.displayFolds();
   },

   /**
    * React to a modified preference value. Update the UI if appropriate.
    * This is called when the display level preference is changed.
    * Called in response to the dejaclick:preferences event.
    * @this {DejaClickUi.Properties}
    * @param {!{key:string,newValue:*,oldValue:*}} aData Details of the
    *    changed preference.
    */
   dispatchPreferenceChange: function (aData) {
      try {
         if (aData.key === 'DC_OPTID_DISPLAYLEVEL') {
            this.context.setDisplayLevel(aData.newValue);
            this.displayFolds();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update which folds are displayed based upon the current context
    * and display level.
    * @this {DejaClickUi.Properties}
    */
   displayFolds: function () {
      var category, level, onFolds, offFolds, active;
      category = this.context.category;
      level = this.context.displayLevel;
      onFolds = this.elements.folds.filter('.' + category);
      offFolds = this.elements.folds.filter(':not(.' + category + ')');

      switch (level) {
      case this.constants.DISPLAYLEVEL_DIAGNOSTIC:
         // Display all folds relevant to this category.
         break;

      case this.constants.DISPLAYLEVEL_ADVANCED:
         // Display only basic and advanced folds.
         offFolds = offFolds.add(onFolds.filter(':not(.basic,.advanced)'));
         onFolds = onFolds.filter('.basic,.advanced');
         break;

      default:
         // Display only basic folds.
         offFolds = offFolds.add(onFolds.filter(':not(.basic)'));
         onFolds = onFolds.filter('.basic');
         break;
      }
      onFolds.show();
      offFolds.hide();
      this.broadcastActive('refresh');

      // If currently active fold is no longer visible, close it.
      active = this.elements.accordion.accordion('option', 'active');
      if ((active !== false) &&
            !$(this.elements.accordion.find('h3')[active]).is(':visible')) {
         this.elements.accordion.accordion('option', 'active', false);
      }
   },

   /**
    * Enable or disable widgets based upon the current run mode.
    * Called in response to the dejaclick:runmode event.
    * @this {DejaClickUi.Properties}
    * @param {!{runMode:integer}} aData The new runmode.
    */
   updateRunMode: function (aData) {
      var runmode;
      try {
         runmode = aData.runMode;
         if ((runmode === this.constants.RUNMODE_INACTIVE) ||
             (runmode === this.constants.RUNMODE_STOPPED)) {
            if (this.state.running) {
               this.state.running = false;
               this.enableControls();
            }
         } else if (!this.state.running) {
            this.state.running = true;
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Refresh the UI for the named property if the specified category
    * would affect the current category.
    * Called in response to the dejaclick:propertyupdated event.
    * @this {DejaClickUi.Properties}
    * @param {!{property:string, category:string}} aData Details of the
    *    property and category that has been changed. If the property
    *    value is the empty string, all properties in that category
    *    have been updated.
    */
   refreshProperty: function (aData) {
      var apply;
      try {
         switch (aData.category) {
         case 'play':
         case 'record':
            apply = true;
            break;
         case 'script':
            apply = (this.context.category === 'script') ||
               (this.context.category === 'event');
            break;
         case 'subscript':
         case 'action':
         case 'event':
            apply = this.context.category === aData.category;
            break;
         default:
            // @todo Allow empty string to affect all categories?
            apply = false;
            break;
         }

         if (apply) {
            if (aData.property === '') {
               this.broadcastActive('refresh');
            } else if ((this.activeProperties.indexOf(aData.property) !== -1) &&
                  this.properties.hasOwnProperty(aData.property)) {
               this.properties[aData.property].refresh();
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Mark that a "modal" dialog is open in the parent window.
    * Disable all UI elements.
    * @this {DejaClickUi.Properties}
    */
   openParentDialog: function () {
      this.state.dialogOpen = true;
      this.enableControls();
   },

   /**
    * Mark that all "modal" dialogs have been closed.
    * Enable the UI elements.
    * @this {DejaClickUi.Properties}
    */
   closeParentDialog: function () {
      this.state.dialogOpen = false;
      this.enableControls();
   },

   /**
    * Enable or disable all of the controls on this page (including
    * the individual properties) depending on the current run mode and
    * whether a "modal" dialog is open.
    * @this {DejaClickUi.Properties}
    */
   enableControls: function () {
      var disabled = this.state.running || this.state.dialogOpen;
      this.elements.accordion.accordion('option', 'disabled', disabled);
      this.context.enableControls(!disabled);
      this.broadcastActive('enableControls');
   },

   /**
    * Invoke a method on each of the active properties.
    * @this {DejaClickUi.Properties}
    * @param {string} aFuncName The name of the Property method to be invoked.
    */
   broadcastActive: function (aFuncName) {
      var index, propName;
      index = this.activeProperties.length;
      while (index !== 0) {
         --index;
         propName = this.activeProperties[index];
         if (this.properties.hasOwnProperty(propName)) {
            try {
               this.properties[propName][aFuncName]();
            } catch (ex) {
               this.logger.logException(ex);
            }
         }
      }
   },

   /**
    * Invoke a method on all of the properties.
    * @this {DejaClickUi.Properties}
    * @param {string} aFuncName The name of the Property method to be invoked.
    */
   broadcastAll: function (aFuncName) {
      var propName;
      for (propName in this.properties) {
         if (this.properties.hasOwnProperty(propName)) {
            try {
               this.properties[propName][aFuncName]();
            } catch (ex) {
               this.logger.logException(ex);
            }
         }
      }
   }
};


/**
 * The context in which a property is being modified.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function():?DejaClick.Script} aGetScript Function to retrieve the
 *    script being processed by the extension.
 * @param {function(string, *=, function(*)=)} aOpenDialog Function to
 *    open a "modal" dialog window and disable all controls on the page.
 * @param {function(function(*)=, number=, number=)} AVariable
 *    The script variable common utils constructor.
 */
DejaClickUi.PropertyContext = function (aUtils, aConstants, aGetScript,
      aOpenDialog, AVariable) {

   var replayCount = 0,
      location = aUtils.prefService.getPrefOption('DC_OPTID_LOCATIONID');

   if (DejaClick.service) {
      replayCount = DejaClick.service.getReplayCount();
      location = DejaClick.service.getLocationId();
   }

   this.logger = aUtils.logger;
   this.observerService = aUtils.observerService;
   this.prefService = aUtils.prefService;
   this.getMessage = aUtils.getMessage;
   this.constants = aConstants;
   this.getScript = aGetScript;
   this.openDialog = aOpenDialog;
   this.variableUtils = new AVariable(this.logger, replayCount, location);

   /**
    * The current display level.
    * @type {integer}
    */
   this.displayLevel = this.prefService.getPrefOption('DC_OPTID_DISPLAYLEVEL');
   /**
    * If true, active controls should be enabled. If false, all controls
    * should be disabled.
    * @type {boolean}
    */
   this.controlsEnabled = true;

   this.context = '';
   this.category = 'none';
   /** @type {?DejaClick.Script} */
   this.script = null;
   /** @type {?Element} */
   this.element = null;
   /** @type {?Element} */
   this.event = null;
};

DejaClickUi.PropertyContext.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.PropertyContext,

   /**
    * Close the context and release references to external objects.
    * @this {DejaClickUi.PropertyContext}
    */
   close: function () {
      delete this.event;
      delete this.element;
      delete this.script;
      delete this.category;
      delete this.context;
      delete this.openDialog;
      delete this.getScript;
      delete this.constants;
      delete this.getMessage;
      delete this.prefService;
      delete this.observerService;
      delete this.logger;
   },

   /**
    * Record the current display level.
    * @this {DejaClickUi.PropertyContext}
    * @param {integer} aLevel The new display level.
    */
   setDisplayLevel: function (aLevel) {
      this.displayLevel = aLevel;
   },

   /**
    * Change the object whose properties are being displayed.  This is
    * called when the context of the properties window is
    * changed. This is usually either at initialization time or when a
    * row in the tree view is selected.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aContext The hashkey of an element in the
    *    current script or 'play' or 'record'. Any other value will
    *    hide all properties.
    */
   setContext: function (aContext) {
      var script = this.getScript();
      this.context = aContext;
      this.element = (script == null) ? null : script.getHashkeyNode(aContext);
      this.event = null;
      if (this.element == null) {
         this.script = null;
         if (aContext === 'play') {
            this.category = 'play';

         } else if (aContext === 'record') {
            this.category = 'record';

         } else {
            this.category = 'none';
            this.context = '';
         }
      } else {
         this.script = script;
         switch (this.element.tagName) {
         case 'script':
            this.category = 'script';
            break;

         case 'subscript':
            this.category = 'subscript';
            break;

         case 'action':
            this.category = 'action';
            break;

         case 'event':
            this.category = 'event';
            this.event = this.element;
            break;

         default:
            this.category = 'none';
            this.context = '';
            this.script = null;
            this.element = null;
            break;
         }
      }
   },

   /**
    * Set flag indicating whether the controls in each property should be
    * disabled.
    * @this {DejaClickUi.PropertyContext}
    * @param {boolean} aEnabled If true, active controls should be enabled.
    *    If false, all controls should be disabled.
    */
   enableControls: function (aEnabled) {
      this.controlsEnabled = aEnabled;
   },

   /**
    * Display whether a property has been modified (or modified by a user)
    * for the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {!jQuery} aPropertyElement The section element for the property.
    * @param {!Array.<string>} aPreferences The preferences that compose
    *    the property.
    * @return {boolean} true if the property has been modified in the
    *    current context.
    */
   updatePropertyModified: function (aPropertyElement, aPreferences) {
      var modified, byuser, index, elts;

      modified = false;
      byuser = false;
      index = aPreferences.length;
      while (index !== 0) {
         --index;
         if (this.hasPreference(aPreferences[index])) {
            modified = true;
            if (this.hasPreference(aPreferences[index], 'modifiedbyuser')) {
               byuser = true;
               break;
            }
         }
      }

      elts = aPropertyElement.add(aPropertyElement.prev());
      if (!modified) {
         elts.removeClass('modified modifiedbyuser');
      } else if (byuser) {
         elts.addClass('modifiedbyuser');
         elts.removeClass('modified');
      } else {
         elts.addClass('modified');
         elts.removeClass('modifiedbyuser');
      }
      return modified;
   },

   /**
    * Populate a select element with options for each script variable
    * defined in the current script.
    * @this {DejaClickUi.PropertyContext}
    * @param {!jQuery} aSelectElt The select element to contain the
    *    script variable options.
    * @param {boolean} aIncludeDesc If true, show both the name and
    *    the description in the option.
    * @return {!Array.<!Element>} List of the script variable elements
    *    indexed by the value of each defined option.
    */
   defineVariableOptions: function (aSelectElt, aIncludeDesc) {
      var result, variables, index, varElt, name, value, description;

      result = [];
      variables = this.script.getScriptElement().getElementsByTagName('variable');
      aSelectElt.empty();

      for (index = 0; index < variables.length; ++index) {
         varElt = variables[index];
         name = this.script.domTreeGetVariableParam(varElt, 'varname');
         value = this.script.domTreeGetVariableParam(varElt, 'vartext');

         if ((varElt.getAttribute('type') === this.constants.VARIABLE_TYPE) &&
               (name !== null) && (name.length !== 0) &&
               (value !== null) && (value.length !== 0)) {

            description = this.variableUtils.getVariableDescription(value);

            if (aIncludeDesc) {
               name += ': ' + description;
               description = name;
            }

            aSelectElt.append($(document.createElement('option')).
               text(name).
               attr('value', String(result.length)).
               attr('title', description));
            result.push(varElt);
         }
      }

      aSelectElt.prop('selectedIndex', -1);

      return result;
   },

   /**
    * Trigger the dejaclick:propertyupdated event for the current
    * property and category.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aProperty The name of the updated property.
    */
   syncPropertyChange: function (aProperty) {
      this.observerService.notifyLocalObservers('dejaclick:propertyupdated',
         { property: aProperty, category: this.category,
           hashkey: this.context });
   },

   /**
    * Trigger the dejaclick:propertyupdated event for all validations
    * properties. This is useful because they are all stored in the
    * same section of the script.
    * @this {DejaClickUi.PropertyContext}
    */
   syncValidationsChange: function (aProperty) {
      this.syncPropertyChange('kwValidations');
      this.syncPropertyChange('imgValidations');
      this.syncPropertyChange('jsValidations');
   },

   /**
    * Trigger the dejaclick:mobileoptionschange event.
    * This is needed to rebuild active devices.
    * @this {DejaClickUi.PropertyContext}
    */
   syncMobileOptionsChange: function () {
      this.observerService.notifyLocalObservers('dejaclick:mobileoptionschange',
         { category: this.category, hashkey: this.context });
   },

   /**
    * Get the value of an event parameter of the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the parameter.
    * @return {?string} The value of the parameter or null if it does
    *    not exist.
    */
   getEventParam: function (aName) {
      return this.script.domTreeGetEventParam(this.element, aName);
   },

   /**
    * Add or change the value of an event parameter in the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the parameter.
    * @param {string} aValue The new value of the parameter.
    */
   setEventParam: function (aName, aValue) {
      this.script.domTreeChangeEventParam(this.element, aName, aValue);
   },

   /**
    * Delete an existing event parameter from the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the parameter to be deleted.
    */
   removeEventParam: function (aName) {
      this.script.domTreeDelEventParam(this.element, aName);
   },

   /**
    * Get the value of a replay hint for the current context
    * (presumably an event).
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the hint.
    * @return {?string} The value of the hint or null if it does not exist.
    */
   getReplayHint: function (aName) {
      return this.script.domTreeGetReplayHint(this.element, aName);
   },

   /**
    * Add or change the value of a replay hint in the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the hint.
    * @param {string} aValue The new value of the hint.
    */
   setReplayHint: function (aName, aValue) {
      this.script.domTreeChangeReplayHint(this.element, aName, aValue);
   },

   /**
    * Get the value of a script attribute element for the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the attribute element.
    * @return {?string} The value of the attribute or null if it does
    *    not exist.
    */
   getAttribute: function (aName) {
      return this.script.domTreeGetAttribute(this.element, aName);
   },

   /**
    * Set or change the value of a script attribute element for the
    * current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the attribute element.
    * @param {string} aValue The new value for the attribute.
    */
   setAttribute: function (aName, aValue) {
      this.script.domTreeChangeAttribute(this.element, aName, aValue);
   },

   /**
    * Determine whether a value is set for a preference in the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the preference.
    * @param {string} opt_modTag If defined, the setting at either
    *    the script or event level must include an attribute with this
    *    name for hasPrefOption to return true.
    * @return {boolean} true if the value is set in the current context.
    */
   hasPreference: function (aName, opt_modTag) {
      return this.prefService.hasPrefOption(aName, this.script, this.event,
         opt_modTag);
   },

   /**
    * Get the value of a preference in the current context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the preference.
    * @return {*} The value of the preference.
    */
   getPreference: function (aName) {
      return this.prefService.getPrefOption(aName, this.script, this.event);
   },

   /**
    * Set the value of a preference in the current context.
    * Mark the preference setting as user modified.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the preference.
    * @param {*} aValue The new value of the preference.
    */
   setPreference: function (aName, aValue) {
      this.prefService.setPrefOption(aName, aValue, this.script, this.event,
         'modifiedbyuser');
   },

   /**
    * Remove the setting for a preference in the current context. The
    * setting from the enclosing context (or the default value) will
    * be used in this context.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the preference.
    */
   resetPreference: function (aName) {
      this.prefService.resetPrefOption(aName, this.script, this.event);
   },

   /**
    * Determine whether a value is allowed for a given preference item.
    * @this {DejaClickUi.PropertyContext}
    * @param {string} aName The name of the preference item.
    * @param {*} aValue The possible value of the preference item.
    * @return {boolean} true if the value is acceptable.
    */
   validate: function (aName, aValue) {
      return this.prefService.getType(aName).validate(aValue);
   }
};


/**
 * Interface for a generic Property.
 * @interface
 * @implements {DejaClick.Closable}
 */
DejaClickUi.Property = function () {};

DejaClickUi.Property.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Property,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.Property}
    */
   close: function () {},

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.Property}
    */
   refresh: function () {},

   /**
    * Revert the settings for this property to the default values for
    * the context. For some properties this may be a noop.
    * @this {DejaClickUi.Property}
    */
   reset: function () {},

   /**
    * Apply the changes made in the UI to the context.
    * @this {DejaClickUi.Property}
    */
   apply: function () {},

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.Property}
    */
   enableControls: function () {}
};


/**
 * Property to set the description of a script, subscript, action, or event.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the description applies.
 */
DejaClickUi.DescriptionProperty = function (aContext) {
   this.context = aContext;
   this.changed = false;

   this.elements = {
      label: $('#descriptionLabel'),
      input: $('#descriptionInput'),
      clear: $('#descriptionClearButton'),
      apply: $('#descriptionApplyButton')
   };

   this.elements.input.on('input', this.enterData.bind(this));
   this.elements.clear.button({ disabled: true }).
      on('click', this.clear.bind(this));
   this.elements.apply.button({ disabled: true }).
      on('click', this.apply.bind(this));
};

DejaClickUi.DescriptionProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.DescriptionProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.DescriptionProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.apply.off('click').button('destroy');
         this.elements.clear.off('click').button('destroy');
         this.elements.input.off('input');
      }
      delete this.elements;
      delete this.changed;
      delete this.context;
   },

   /**
    * Update the UI for the current context.
    * @this {DejaClickUi.DescriptionProperty}
    */
   refresh: function () {
      var description = this.context.getAttribute('description');
      if (description == null) {
         description = '';
      }
      this.changed = false;
      this.elements.label.text(this.context.getMessage(
         'deja_properties_descriptionLabel_' + this.context.category));
      this.elements.input.val(description);
      this.enableControls();
   },

   /**
    * React to the description information being changed by the user.
    * @this {DejaClickUi.DescriptionProperty}
    * @param {!Event} aEvent A jQuery input event on the description
    *    input element.
    */
   enterData: function (aEvent) {
      try {
         this.changed = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Clear the description and commit the change.
    * Called when the Clear button is clicked.
    * @this {DejaClickUi.DescriptionProperty}
    * @param {!Event} aEvent A jQuery click event on the clear button.
    */
   clear: function (aEvent) {
      try {
         this.elements.input.val('');
         this.context.setAttribute('description', '');
         this.context.syncPropertyChange('description');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Reset the description to the default value. Does nothing.
    * @this {DejaClickUi.DescriptionProperty}
    */
   reset: function () {
   },

   /**
    * Commit the new description.
    * Called when the Apply button is clicked.
    * @this {DejaClickUi.DescriptionProperty}
    * @param {!Event=} opt_event A jQuery click event on the Apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setAttribute('description',
            this.elements.input.val().replace(/\n/g, ' '));
         this.context.syncPropertyChange('description');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state and context.
    * @this {DejaClickUi.DescriptionProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.input.attr('disabled', 'true');
         this.elements.clear.button('option', 'disabled', true);
         this.elements.apply.button('option', 'disabled', true);
      } else {
         this.elements.input.removeAttr('disabled');
         this.elements.clear.button('option', 'disabled',
            (this.elements.input.val().length === 0));
         this.elements.apply.button('option', 'disabled', !this.changed);
      }
   }
}; // End of DejaClickUi.DescriptionProperty.prototype


/**
 * Property containing the text input of an event or script or system
 * parameters affecting how the input is to be replayed.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.EventInputProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false, // true if the context has a non-default value.
      hasNewValue: false, // true if the user has modified the value in the UI.
      textField: null, // jQuery element in which the event input is shown.
      textValue: '', // Value of the event input.
      variables: [], // List of variable elements in current script.
      disableTextField: false, // true if the text input field should be
         // disabled. This is true for contenteditable events that
         // use keystrokes.
      crumb: null, // First crumb of the event's element target.
      inputTag: '', // Tag of element to which input is applied.
                    // (e.g. input, textarea, embed, object, body, select)
      inputType: '' // type attribute of the input element
                    // (e.g., password, radio, select-one, select-multiple)
   };

   this.elements = {
      fold: $('#eventInputFold'),
      section: $('#eventInputSection'),

      urlDiv: $('#eventInputUrlDiv'),
      urlInput: $('#eventInputUrl'),

      textDiv: $('#eventInputTextDiv'),
      textScriptLabel: $('#eventInputTextScriptLabel'),
      textAreaDiv: $('#eventInputTextAreaDiv'),
      textAreaLabel: $('#eventInputTextAreaLabel'),
      textArea: $('#eventInputTextArea'),
      passwordDiv: $('#eventInputPasswordDiv'),
      password: $('#eventInputPassword'),
      useKeystrokesDiv: $('#eventInputUseKeystrokesDiv'),
      useKeystrokes: $('#eventInputUseKeystrokes'),
      showPasswordDiv: $('#eventInputShowPasswordDiv'),
      showPassword: $('#eventInputShowPassword'),

      scriptVarDiv: $('#eventInputScriptVarDiv'),
      useScriptVar: $('#eventInputUseVariable'),
      scriptVarSelectionDiv: $('#eventInputScriptVarSelectionDiv'),
      selectVariable: $('#eventInputScriptVar'),
      addVariable: $('#eventInputAddVariable'),
      editVariable: $('#eventInputEditVariable'),

      optionDiv: $('#eventInputOptionDiv'),
      options: $('input:radio[name="eventInputOptions"]'),
      position: $('#eventInputPosition'),
      name: $('#eventInputName'),
      value: $('#eventInputValue'),

      selectDiv: $('#eventInputSelectDiv'),
      selectLabel: $('#eventInputSelectLabel'),
      select: $('#eventInputSelect'),

      multipleDiv: $('#eventInputAllowMultipleDiv'),
      multiple: $('#eventInputAllowMultiple'),

      reset: $('#eventInputReset'),
      apply: $('#eventInputApply')
   };
   this.elements.allTextAreas = this.elements.section.find('textarea');
   this.elements.allSelects = this.elements.section.find('select');
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.urlInput.on('input', this.changeValue.bind(this));
   this.elements.textArea.on('input', this.changeValue.bind(this));
   this.elements.password.on('input', this.changeValue.bind(this));
   this.elements.useKeystrokes.on('change', this.changeValue.bind(this));
   this.elements.showPassword.on('change', this.showPassword.bind(this));

   this.elements.useScriptVar.on('change', this.useScriptVariable.bind(this));
   this.elements.selectVariable.on('change',
      this.selectScriptVariable.bind(this));
   this.elements.addVariable.button({
      text: false,
      icons: {
         primary: 'addVariable-icon'
      }
   }).on('click', this.addScriptVariable.bind(this));
   this.elements.editVariable.button({
      text: false,
      icons: {
         primary: 'editVariable-icon'
      }
   }).on('click', this.editScriptVariable.bind(this));

   this.elements.optionDiv.on('change', this.changeSelectionMode.bind(this));
   this.elements.select.on('change', this.changeValue.bind(this));
   this.elements.multiple.on('change', this.allowMultipleSelections.bind(this));

   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.EventInputProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.EventInputProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.EventInputProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.apply.off('click').button('destroy');
         this.elements.reset.off('click').button('destroy');
         this.elements.multiple.off('change');
         this.elements.select.off('change');
         this.elements.optionDiv.off('change');
         this.elements.editVariable.off('click').button('destroy');
         this.elements.addVariable.off('click').button('destroy');
         this.elements.selectVariable.off('change');
         this.elements.useScriptVar.off('change');
         this.elements.showPassword.off('change');
         this.elements.useKeystrokes.off('change');
         this.elements.password.off('input');
         this.elements.textArea.off('input');
         this.elements.urlInput.off('input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI for the current context.
    * @this {DejaClickUi.EventInputProperty}
    */
   refresh: function () {
      var crumbs, tag, type;

      this.state.hasValue = false;
      this.state.hasNewValue = false;
      this.state.textField = null;
      this.state.textValue = '';
      this.state.disableTextField = false;
      this.state.crumb = null;
      this.state.inputTag = '';
      this.state.inputType = '';

      switch (this.context.category) {
      case 'play':
      case 'script':
         this.refreshGlobal();
         break;
      case 'event':
         switch (this.context.event.getAttribute('type')) {
         case 'navigate':
            this.refreshNavigateEvent();
            break;
         case 'change':
            crumbs = $(this.context.event).find('target[type="element"] crumb');
            if (crumbs.length !== 0) {
               this.state.crumb = crumbs[0];

               tag = this.state.crumb.getAttribute('tag');
               if (tag == null) {
                  tag = '';
               }
               this.state.inputTag = tag.toLowerCase();

               type = this.context.script.domTreeGetAttribute(
                  this.state.crumb, 'type');
               if (type == null) {
                  type = '';
               }
               this.state.inputType = type.toLowerCase();
            }

            switch (this.state.inputTag) {
            case 'input':
            case 'textarea':
            case 'embed':
            case 'object':
            case 'body':
               this.refreshTextChangeEvent();
               break;
            case 'select':
               this.refreshSelectChangeEvent();
               break;
            default:
               this.refreshContentEditableChangeEvent();
               break;
            }
            break;
         default:
            this.elements.fold.hide();
            break;
         }
         break;
      default:
         this.elements.fold.hide();
         break;
      }
   },

   /**
    * Update the UI for a script or global context.
    * @this {DejaClickUi.EventInputProperty}
    */
   refreshGlobal: function () {
      var selectType;

      this.elements.useKeystrokes.prop('checked',
         this.context.getPreference('DC_OPTID_USEKEYSTROKES'));
      selectType = this.context.getPreference('DC_OPTID_OPTIONSELECT');
      switch (selectType) {
      case 'itemname':
         this.elements.name.prop('checked', true);
         break;
      case 'itemval':
         this.elements.value.prop('checked', true);
         break;
      default:
         this.elements.position.prop('checked', true);
         break;
      }

      this.elements.textDiv.show();
      this.elements.textScriptLabel.show();
      this.elements.useKeystrokesDiv.show();
      this.elements.optionDiv.show();

      this.elements.urlDiv.hide();
      this.elements.textAreaDiv.hide();
      this.elements.passwordDiv.hide();
      this.elements.showPasswordDiv.hide();
      this.elements.scriptVarDiv.hide();
      this.elements.selectDiv.hide();

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [ 'DC_OPTID_USEKEYSTROKES', 'DC_OPTID_OPTIONSELECT' ]);

      this.enableControls();
   },

   /**
    * Update the UI for a navigate event.
    * @this {DejaClickUi.EventInputProperty}
    */
   refreshNavigateEvent: function () {
      var value, isScriptVar;

      value = this.context.getEventParam('varreference');
      if (value == null) {
         isScriptVar = false;
         value = this.context.getEventParam('urlrequested');
         if (value == null) {
            value = '';
         }
      } else {
         isScriptVar = true;
      }

      // Display URL or variable value.
      this.state.textValue = '';
      this.state.textField = this.elements.urlInput;
      this.state.textField.attr('rows', (value.length > 30) ? '3' : '1');

      this.setInitialTextValue(value, isScriptVar);

      // Show/hide the appropriate UI elements.
      this.elements.urlDiv.show();
      this.elements.scriptVarDiv.show();

      this.elements.textDiv.hide();
      this.elements.optionDiv.hide();
      this.elements.selectDiv.hide();

      // Enable the correct controls.
      this.elements.section.removeClass('modified modifiedbyuser');
      this.state.hasValue = false;
      this.enableControls();
   },

   /**
    * Update the UI for a change event to a text element.
    * @this {DejaClickUi.EventInputProperty}
    */
   refreshTextChangeEvent: function () {
      var value, isScriptVar;

      value = this.context.getEventParam('varreference');
      if (value == null) {
         isScriptVar = false;
         value = this.context.getEventParam('value');
         if (value == null) {
            value = '';
         }
      } else {
         isScriptVar = true;
      }

      if (this.state.inputType === 'password') {
         this.elements.textAreaDiv.hide();
         this.elements.passwordDiv.show();
         this.elements.password.attr('type', 'password');
         this.state.textField = this.elements.password;

         this.elements.useKeystrokes.prop('checked',
            this.context.getPreference('DC_OPTID_USEKEYSTROKES'));
         this.elements.useKeystrokesDiv.show();

         this.elements.showPasswordDiv.toggle(this.context.displayLevel ===
            this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);
         this.elements.showPassword.prop('checked', false);

      } else if (this.state.inputType === 'radio') {

         // Hide this entire property if radio button event type.
         this.elements.fold.hide();
         return;

      } else {
         this.elements.textAreaDiv.show();
         this.elements.textAreaLabel.text(this.context.getMessage(
            'deja_properties_textInput'));
         this.elements.passwordDiv.hide();
         this.elements.showPasswordDiv.hide();
         this.state.textField = this.elements.textArea;

         this.state.textField.attr('rows',
            ((value.length > 30) || (value.indexOf('\n') !== -1)) ? '3' : '1');

         if (this.context.event.getAttribute('screen') === 'true') {
            // Hide the usekeystrokes option for screen input events.
            // It is implied.
            this.elements.useKeystrokesDiv.hide();

         } else {
            this.elements.useKeystrokesDiv.show();
            this.elements.useKeystrokes.prop('checked',
               this.context.getPreference('DC_OPTID_USEKEYSTROKES'));
         }
      }

      // Display input value.
      this.state.textValue = '';

      if ((this.context.inputTag === 'input') ||
            (this.context.inputTag === 'body')) {
         value = value.replace(/\n/g, ' ');
      }
      this.setInitialTextValue(value, isScriptVar);

      // Show/hide the appropriate UI elements.
      this.elements.textDiv.show();
      this.elements.scriptVarDiv.show();

      this.elements.urlDiv.hide();
      this.elements.textScriptLabel.hide();
      this.elements.optionDiv.hide();
      this.elements.selectDiv.hide();

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section, [ 'DC_OPTID_USEKEYSTROKES' ]);
      this.enableControls();
   },

   /**
    * Update the UI for a change event to a select element.
    * @this {DejaClickUi.EventInputProperty}
    */
   refreshSelectChangeEvent: function () {
      var params, allowMultiple, selectType;

      // Determine whether multiple selections are allowed.
      params = $(this.context.event).find('eventparams param');
      if (this.state.inputType === 'select-one') {
         allowMultiple = false;
      } else if (this.state.inputType === 'select-multiple') {
         allowMultiple = true;
      } else {
         // Allow multiple only if there are multiple selected items.
         allowMultiple = params.filter(':contains("true")').length > 1;
      }
      this.elements.multiple.prop('checked', allowMultiple);

      // Determine whether selection mode can be changed.
      if ((params.length === 0) || params[0].hasAttribute('itemname')) {
         selectType = this.context.getPreference('DC_OPTID_OPTIONSELECT');
         switch (selectType) {
         case 'itemname':
            this.elements.name.prop('checked', true);
            break;

         case 'itemval':
            this.elements.value.prop('checked', true);
            break;

         default:
            this.elements.position.prop('checked', true);
            break;
         }
         this.elements.optionDiv.show();

      } else {
         // Feature not supported. Hide the options and default to
         // type=position.
         this.elements.position.prop('checked', true);
         this.elements.optionDiv.hide();
      }

      // Add selection choices.
      this.updateSelectList();

      // Show/hide the appropriate UI elements.
      this.elements.selectDiv.show();
      this.elements.multipleDiv.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      this.elements.urlDiv.hide();
      this.elements.textDiv.hide();
      this.elements.scriptVarDiv.hide();

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section, [ 'DC_OPTID_OPTIONSELECT' ]);
      this.enableControls();
   },

   /**
    * Update the UI for a change event to a contenteditable element.
    * @this {DejaClickUi.EventInputProperty}
    */
   refreshContentEditableChangeEvent: function () {
      var value, isScriptVar, useKeystrokes;

      value = this.context.getEventParam('varreference');
      if (value == null) {
         isScriptVar = false;
         value = this.context.getEventParam('innerHTML');
         if (value == null) {
            value = '';
         }
      } else {
         isScriptVar = true;
      }

      // Display the HTML or variable value.
      this.state.textValue = '';
      this.elements.textAreaLabel.text(this.context.getMessage(
         'deja_properties_htmlContent'));
      this.state.textField = this.elements.textArea;
      this.state.textField.attr('rows', '3');

      this.setInitialTextValue(value, isScriptVar);

      useKeystrokes = this.context.getPreference('DC_OPTID_USEKEYSTROKES');
      this.elements.useKeystrokes.prop('checked', useKeystrokes);
      // If the 'Use keystrokes' option is enabled, disable the input
      // field to prevent the user from changing the HTML content that
      // was recorded because we have no way to update the keystrokes
      // with the changed content.
      this.state.disableTextField = useKeystrokes;

      // Show/hide the appropriate UI elements.
      this.elements.textDiv.show();
      this.elements.textAreaDiv.show();
      // Display the 'Use keystrokes' option only if there are
      // keystrokes to replay.
      this.elements.useKeystrokesDiv.toggle(
         this.context.getEventParam('keycodes') !== null);
      this.elements.scriptVarDiv.show();

      this.elements.urlDiv.hide();
      this.elements.textScriptLabel.hide();
      this.elements.passwordDiv.hide();
      this.elements.showPasswordDiv.hide();
      this.elements.optionDiv.hide();
      this.elements.selectDiv.hide();

      // Enable the correct controls.
      this.state.changed = this.context.updatePropertyModified(
         this.elements.section, [ 'DC_OPTID_USEKEYSTROKES' ]);
      this.enableControls();
   },

   /**
    * Set the value of the displayed text input element. Select the
    * configured variable in the list if using a script variable.
    * @this {DejaClickUi.EventInputProperty}
    * @param {string} aText The text value (or the name of the script variable).
    * @param {boolean} aUseVar If true, aText is the name of the
    *    script variable used to define the text input.
    */
   setInitialTextValue: function (aText, aUseVar) {
      var value, options, index;

      this.state.textField.val('');
      this.state.variables = this.context.defineVariableOptions(
         this.elements.selectVariable,
         false);
      if (aUseVar) {
         this.state.textField.attr('readonly', 'true');
         this.elements.scriptVarSelectionDiv.show();
         value = '';
         options = this.elements.selectVariable.prop('options');
         index = options.length;
         while (index !== 0) {
            --index;
            if (options[index].textContent === aText) {
               this.elements.selectVariable.prop('selectedIndex', index);
               value = options[index].getAttribute('title');
               break;
            }
         }
      } else {
         this.state.textField.removeAttr('readonly');
         this.elements.scriptVarSelectionDiv.hide();
         value = aText;
      }
      this.elements.useScriptVar.prop('checked', aUseVar);
      this.state.textField.val(value);
   },

   /**
    * Toggle whether a password value should be displayed or hidden.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery click event on the show password checkbox.
    */
   showPassword: function (aEvent) {
      try {
         if (this.elements.showPassword.prop('checked')) {
            this.elements.password.attr('type', 'text');
         } else {
            this.elements.password.attr('type', 'password');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Toggle whether a script variable is used to generate the input.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery click event on the use variable checkbox.
    */
   useScriptVariable: function (aEvent) {
      var selected;
      try {
         if (this.elements.useScriptVar.prop('checked')) {
            this.state.textValue = this.state.textField.val();
            this.state.textField.attr('readonly', 'true');
            selected = this.elements.selectVariable.prop('selectedOptions');
            if (selected.length !== 0) {
               this.state.textField.val(selected[0].getAttribute('title'));
            } else {
               this.state.textField.val('');
            }
            this.elements.scriptVarSelectionDiv.show();
         } else {
            this.state.textField.val(this.state.textValue);
            this.state.textField.removeAttr('readonly');
            this.elements.scriptVarSelectionDiv.hide();
         }
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Update the UI after the script variable selection has changed.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery change event on the script variable
    *    selection element.
    */
   selectScriptVariable: function (aEvent) {
      var selected;
      try {
         selected = this.elements.selectVariable.prop('selectedOptions');
         if (selected.length !== 0) {
            this.state.textField.val(selected[0].getAttribute('title'));
         } else {
            this.state.textField.val('');
         }
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new script variable.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery click event on the add variable icon.
    */
   addScriptVariable: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaVariable.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeAddScriptVariable.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Display and select a newly defined script variable.
    * @this {DejaClickUi.EventInputProperty}
    * @param {?Element} aVariable The newly defined variable element
    *    (or null if the add variable dialog was canceled).
    */
   completeAddScriptVariable: function (aVariable) {
      var index, select, option;
      try {
         if (aVariable !== null) {
            this.state.variables = this.context.defineVariableOptions(
               this.elements.selectVariable,
               false);
            this.completeEditScriptVariable(aVariable);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected script variable.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery click event on the edit variable icon.
    */
   editScriptVariable: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.selectVariable.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.state.variables.length)) {
               this.context.openDialog('ui/content/dejaVariable.html',
                  {
                     context: this.context.element,
                     item: this.state.variables[index]
                  },
                  this.completeEditScriptVariable.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Select the edited script variable.
    * @this {DejaClickUi.EventInputProperty}
    * @param {?Element} aVariable The newly defined variable element
    *    (or null if the add variable dialog was canceled).
    */
   completeEditScriptVariable: function (aVariable) {
      var index, select, option;
      try {
         if (aVariable !== null) {
            index = this.state.variables.indexOf(aVariable);
            select = this.elements.selectVariable;
            select.prop('selectedIndex', index);
            if (index === -1) {
               this.state.textField.val('');
            } else {
               option = select.prop('options')[index];
               this.state.textField.val(option.getAttribute('title'));
            }
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Change how options are selected from a select element.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery change event on one of the
    *    selection mode radio buttons.
    */
   changeSelectionMode: function (aEvent) {
      var selectElt, selectedIndices, options, index;
      try {
         if (this.context.category === 'event') {
            // Cache indices of selected options.
            selectElt = this.elements.select;
            selectedIndices = [];
            options = selectElt.prop('options');
            index = options.length;
            while (index !== 0) {
               --index;
               if (options[index].selected) {
                  selectedIndices.push(index);
               }
            }

            // Repopulate selection list.
            this.updateSelectList();

            // Reselect original elements.
            selectElt.prop('selectedIndex', -1);
            options = selectElt.prop('options');
            index = selectedIndices.length;
            while (index !== 0) {
               --index;
               options[selectedIndices[index]].selected = true;
            }
         }

         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Toggle whether multiple options may be selected in a select element.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery change event on the select list.
    */
   allowMultipleSelections: function (aEvent) {
      var selectElt, selected;
      try {
         selectElt = this.elements.select;
         selected = selectElt.prop('selectedIndex');
         if (this.elements.multiple.prop('checked')) {
            selectElt.attr('multiple', 'true');
         } else {
            selectElt.removeAttr('multiple');
         }
         selectElt.prop('selectedIndex', selected);
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Repopulate the list of possible options in an HTML select element.
    * Select the configured elements.
    * @this {DejaClickUi.EventInputProperty}
    */
   updateSelectList: function () {
      var select, allowMultiple, selectType, params, index,
         param, value, label, item;

      select = this.elements.select;
      allowMultiple = this.elements.multiple.prop('checked');
      if (allowMultiple) {
         select.attr('multiple', 'true').attr('size', '4');
         this.elements.selectLabel.text(this.context.getMessage(
            'deja_properties_selectMultiple'));

      } else {
         select.removeAttr('multiple').attr('size', '1');
         this.elements.selectLabel.text(this.context.getMessage(
            'deja_properties_selectOne'));
      }
      select.empty();

      selectType = this.elements.section.find('input:radio:checked').val();
      if (selectType == null) {
         selectType = 'position';
      }
      params = $(this.context.event).find('eventparams param');
      for (index = 0; index < params.length; ++index) {
         param = $(params[index]);
         value = param.attr('name');

         if (selectType === 'position') {
            // Trim off leading "option" string and add one to the index.
            label = this.context.getMessage('deja_properties_optionPosition',
               String(Number(value.substring(6)) + 1));
         } else {
            label = param.attr(selectType);
         }

         item = $(document.createElement('option')).
            attr('value', value).
            text(label);
         select.append(item);

         if (param.text() === 'true') {
            item.prop('selected', true);
         }
      }
   },

   /**
    * Mark the property as having a new value. Enable the apply button.
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event} aEvent A jQuery input, change, or click event
    *    on one of the elements in the event input section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue &&
               !aEvent.target.hasAttribute('readonly')) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Reset how input values are replayed for this context.  Called
    * when the Reset button is clicked (or reset is broadcast to the
    * property).
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event=} opt_event A jQuery click event on the clear button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USEKEYSTROKES');
         this.context.resetPreference('DC_OPTID_OPTIONSELECT');
         this.context.syncPropertyChange('eventInput');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Commit the new event input details.  Called when the Apply
    * button is clicked (or apply is broadcast to the property).
    * @this {DejaClickUi.EventInputProperty}
    * @param {!Event=} opt_event A jQuery click event on the Apply button.
    */
   apply: function (opt_event) {
      var applied;
      try {
         applied = false;
         switch (this.context.category) {
         case 'play':
         case 'script':
            applied = this.applyGlobal();
            break;
         case 'event':
            switch (this.context.event.getAttribute('type')) {
            case 'navigate':
               applied = this.applyNavigateEvent();
               break;
            case 'change':
               switch (this.state.inputTag) {
               case 'input':
               case 'textarea':
               case 'embed':
               case 'object':
               case 'body':
                  applied = this.applyTextChangeEvent('value');
                  break;
               case 'select':
                  applied = this.applySelectChangeEvent();
                  break;
               default:
                  applied = this.applyTextChangeEvent('innerHTML');
                  break;
               }
            }
            break;
         }
         if (applied) {
            this.context.syncPropertyChange('eventInput');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Commit the changes to a script.
    * @this {DejaClickUi.EventInputProperty}
    * @return {boolean} true if the change was applied.
    */
   applyGlobal: function () {
      this.context.setPreference('DC_OPTID_USEKEYSTROKES',
         this.elements.useKeystrokes.prop('checked'));
      this.context.setPreference('DC_OPTID_OPTIONSELECT',
         this.elements.options.filter(':checked').val());
      return true;
   },

   /**
    * Commit the changes to a navigate event.
    * @this {DejaClickUi.EventInputProperty}
    * @return {boolean} true if the change was applied.
    */
   applyNavigateEvent: function () {
      var selected, url, action;

      if (this.elements.useScriptVar.prop('checked')) {
         selected = this.elements.selectVariable.prop('selectedOptions');
         if (selected.length === 0) {
            window.alert(this.context.getMessage(
               'deja_properties_selectScriptVar'));
            return false;
         }

         this.context.setEventParam('varreference', selected[0].textContent);
         url = selected[0].getAttribute('title');

      } else if (this.elements.urlInput.val().length === 0) {
         window.alert(this.context.getMessage('deja_properties_enterValidUrl'));
         return false;

      } else {
         this.context.removeEventParam('varreference');
         url = this.elements.urlInput.val().replace(/\n/g, '');
      }

      this.context.setEventParam('urlrequested', url);
      this.context.removeEventParam('urlfinalized');

      action = this.context.event.parentNode;
      this.context.script.domTreeSetAttribute(action, 'urlrequested', url);
      this.context.script.domTreeDelAttribute(action, 'urlfinalized');
      this.context.script.domTreeDelAttribute(action, 'description');
      return true;
   },

   /**
    * Commit the changes to a change event on a text input or
    * contenteditable element.
    * @this {DejaClickUi.EventInputProperty}
    * @param {string} aParam Name of event parameter containing the
    *    input value.
    * @return {boolean} true if the change was applied.
    */
   applyTextChangeEvent: function (aParam) {
      var selected;

      if (this.elements.useScriptVar.prop('checked')) {
         selected = this.elements.selectVariable.prop('selectedOptions');
         if (selected.length === 0) {
            window.alert(this.context.getMessage(
               'deja_properties_selectScriptVar'));
            return false;
         }

         this.context.setEventParam('varreference', selected[0].textContent);
         this.context.removeEventParam(aParam);

      } else {
         this.context.setEventParam(aParam, this.state.textField.val());
         this.context.removeEventParam('varreference');
      }
      this.context.removeEventParam('keycodes');
      this.context.setPreference('DC_OPTID_USEKEYSTROKES',
         this.elements.useKeystrokes.prop('checked'));
      return true;
   },

   /**
    * Commit the changes to a change event on a select element.
    * @this {DejaClickUi.EventInputProperty}
    * @return {boolean} true if the change was applied.
    */
   applySelectChangeEvent: function () {
      var message, options, index;

      if (this.elements.select.prop('selectedOptions').length === 0) {
         if (this.elements.multiple.prop('checked')) {
            message = 'deja_properties_selectOptionItems';
         } else {
            message = 'deja_properties_selectOptionItem';
         }
         window.alert(this.context.getMessage(message));
         return false;
      }

      // Update option selection type.
      this.context.setPreference('DC_OPTID_OPTIONSELECT',
         this.elements.options.filter(':checked').val());

      // Update option selections.
      options = this.elements.select.prop('options');
      index = options.length;
      while (index !== 0) {
         --index;
         this.context.setEventParam(options[index].getAttribute('value'),
            String(options[index].selected));
      }

      // Update multiple attribute.
      this.context.script.domTreeChangeAttribute(this.state.crumb, 'type',
         (this.elements.multiple.prop('checked') ?
            'select-multiple' :
            'select-one'));
      return true;
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state and context.
    * @this {DejaClickUi.EventInputProperty}
    */
   enableControls: function () {
      var varSelected;

      if (!this.context.controlsEnabled) {
         this.elements.allTextAreas.attr('disabled', 'true');
         this.elements.allSelects.attr('disabled', 'true');
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allTextAreas.removeAttr('disabled');
         this.elements.allSelects.removeAttr('disabled');
         this.elements.allInputs.removeAttr('disabled');

         if (this.state.disableTextField) {
            this.state.textField.attr('disabled', 'true');
         }

         this.elements.selectVariable.prop('disabled',
            !this.elements.selectVariable.children('option').length);

         // Enable/disable buttons.
         varSelected =
            (this.elements.selectVariable.prop('selectedIndex') !== -1);

         this.elements.addVariable.button('option', 'disabled', false);
         this.elements.editVariable.button('option', 'disabled', !varSelected);

         // Enable reset if there is something to reset.
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);

         // Enable apply if something has changed
         // (and a variable is selected if we are using variables).
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue ||
            (this.elements.selectVariable.is(':visible') && !varSelected));
      }
   }
}; // End of DejaClickUi.EventInputProperty.prototype


/**
 * Property allowing configuration of keyword validations.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.KeywordValidationsProperty = function (aContext) {
   this.context = aContext;

   this.validations = [];

   this.elements = {
      description: $('#keywordValidationDescription'),
      select: $('#keywordValidationList'),
      add: $('#keywordValidationAdd'),
      edit: $('#keywordValidationEdit'),
      remove: $('#keywordValidationRemove'),
      allButtons: $('#keywordValidationSection').find('button')
   };

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.KeywordValidationsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.KeywordValidationsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.KeywordValidationsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.validations;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.KeywordValidationsProperty}
    */
   refresh: function () {
      var select, validationsElt, index, summary;

      this.elements.description.text(this.context.getMessage(
         'deja_properties_keywordDescription_' + this.context.category));

      // Remove any previously added validations.
      select = this.elements.select;
      select.empty();

      // Find the validation script elements.
      validationsElt = this.context.script.getChildWithTag(this.context.element,
         'validations');
      if (validationsElt == null) {
         this.validations = [];
      } else {
         this.validations = Array.prototype.filter.call(
            validationsElt.getElementsByTagName('validation'),
            this.isKeywordValidation,
            this);
         index = this.validations.length;
         while (index !== 0) {
            --index;
            summary = this.getValidationDescription(this.validations[index]);
            select.prepend($(document.createElement('option')).
               text(summary).
               attr('title', summary).
               attr('value', String(index)));
         }
      }
      this.enableControls();
   },

   /**
    * Determine whether a validation element represents a keyword validation.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {!Element} aValidation The validation element from the script.
    * @return {boolean} true if aValidation represents a keyword validation.
    */
   isKeywordValidation: function (aValidation) {
      return aValidation.getAttribute('type') ===
         this.context.constants.VALIDATION_TYPE_KEYWORD;
   },

   /**
    * Get a user-oriented one-line description of the keyword validation.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {!Element} aValidation The validation element from the script.
    * @return {string} The description.
    */
   getValidationDescription: function (aValidation) {
      var script, constants, getMessage, separator, text, options;

      script = this.context.script;
      constants = this.context.constants;
      getMessage = this.context.getMessage;
      separator = ',';

      text = script.domTreeGetValidateParam(aValidation, 'varreference');
      if (text == null) {
         text = script.domTreeGetValidateParam(aValidation, 'matchtext');
         if (text == null) {
            text = '';
         } else {
            text = '"' + text + '"';
         }
         options = '';
      } else {
         options = getMessage('deja_properties_keywordVariable') + separator;
      }

      if (script.domTreeGetValidateParam(aValidation, 'matchtype') ===
            constants.VALIDATION_KEYWORDMATCH_PLAIN) {
         options += getMessage('deja_properties_keywordPlain');
         if (script.domTreeGetValidateParam(aValidation, 'matchword') ===
               'true') {
            options += separator + getMessage('deja_properties_keywordWord');
         }
      } else {
         options += getMessage('deja_properties_keywordRegExp');
      }
      if (script.domTreeGetValidateParam(aValidation, 'matchcase') === 'true') {
         options += separator + getMessage('deja_properties_keywordMatchCase');
      }
      if (script.domTreeGetValidateParam(aValidation, 'allowwrap') === 'true') {
         options += separator + getMessage('deja_properties_keywordAllowWrap');
      }
      if (script.domTreeGetValidateParam(aValidation, 'fixspaces') === 'true') {
         options += separator + getMessage('deja_properties_keywordFixSpaces');
      }
      if (script.domTreeGetValidateParam(aValidation, 'errortype') ===
            constants.VALIDATION_KEYWORD_REQUIREMATCH) {
         options += separator + getMessage('deja_properties_keywordRequire');
      } else {
         options += separator + getMessage('deja_properties_keywordForbid');
      }
      if (script.domTreeGetValidateParam(aValidation, 'searchtype') ===
            constants.VALIDATION_KEYWORD_SEARCHALL) {
         options += separator + getMessage('deja_properties_keywordSearchAll');
      } else {
         options += separator + getMessage('deja_properties_keywordSearchOne');
      }

      return getMessage("deja_properties_keywordSummary", [ text, options ]);
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new keyword validation.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {!Event} aEvent A jQuery click event on the add validation button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaKeyword.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected keyword validation.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {!Event} aEvent A jQuery click event on the edit validation button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.validations.length)) {
               this.context.openDialog('ui/content/dejaKeyword.html',
                  {
                     context: this.context.element,
                     item: this.validations[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a validation has been added or edited.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {?Element} aValidation The added or edited validation element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aValidation) {
      try {
         if (aValidation !== null) {
            this.context.syncValidationsChange();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected keyword validation.
    * @this {DejaClickUi.KeywordValidationsProperty}
    * @param {!Event} aEvent A jQuery click event on the remove
    *    validation button.
    */
   remove: function (aEvent) {
      var selected, index, validation, validationsElt, script;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.validations.length)) {
               validation = this.validations[index];
               validationsElt = validation.parentNode;
               script = this.context.script;
               script.domTreeRemoveNode(validation);
               if (validationsElt.firstElementChild == null) {
                  script.domTreeRemoveNode(validationsElt);
               } else {
                  script.renumberElements('validation');
               }
            }
            this.context.syncValidationsChange();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.KeywordValidationsProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.KeywordValidationsProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.KeywordValidationsProperty}
    */
   enableControls: function () {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);
      }
   }
};


/**
 * Property allowing configuration of javascript validations.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.JsValidationsProperty = function (aContext) {
   this.context = aContext;

   this.validations = [];

   this.elements = {
      description: $('#javascriptValidationDescription'),
      select: $('#javascriptValidationList'),
      add: $('#javascriptValidationAdd'),
      edit: $('#javascriptValidationEdit'),
      remove: $('#javascriptValidationRemove'),
      allButtons: $('#javascriptValidationSection').find('button')
   };

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.JsValidationsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.JsValidationsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.JsValidationsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.validations;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.JsValidationsProperty}
    */
   refresh: function () {
      var select, validationsElt, index, summary;

      this.elements.description.text(this.context.getMessage(
            'deja_properties_javascriptDescription_' + this.context.category));

      // Remove any previously added validations.
      select = this.elements.select;
      select.empty();

      // Find the validation script elements.
      validationsElt = this.context.script.getChildWithTag(this.context.element,
         'validations');
      if (validationsElt == null) {
         this.validations = [];
      } else {
         this.validations = Array.prototype.filter.call(
            validationsElt.getElementsByTagName('validation'),
            this.isJsValidation,
            this);
         index = this.validations.length;
         while (index !== 0) {
            --index;
            summary = this.getValidationDescription(this.validations[index]);
            select.prepend($(document.createElement('option')).
               text(summary).
               attr('title', summary).
               attr('value', String(index)));
         }
      }
      this.enableControls();
   },

   /**
    * Determine whether a validation element represents a javascript validation.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {!Element} aValidation The validation element from the script.
    * @return {boolean} true if aValidation represents a javascript validation.
    */
   isJsValidation: function (aValidation) {
      return aValidation.getAttribute('type') ===
         this.context.constants.VALIDATION_TYPE_JAVASCRIPT;
   },

   /**
    * Get a user-oriented one-line description of the javascript validation.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {!Element} aValidation The validation element from the script.
    * @return {string} The description.
    */
   getValidationDescription: function (aValidation) {
      var script, constants, getMessage, separator, text, options;

      script = this.context.script;
      constants = this.context.constants;
      getMessage = this.context.getMessage;
      separator = ',';
      text = script.domTreeGetValidateParam(aValidation, 'varreference');

      if (text == null) {
         text = script.domTreeGetValidateParam(aValidation, 'jstext');
         if (text == null) {
            text = '';
         } else {
            text = '"' + text + '"';
         }
         options = '';
      } else {
         options = getMessage('deja_properties_javascriptVariable') + separator;
      }

      if (script.domTreeGetValidateParam(aValidation, 'errortype') ===
         constants.VALIDATION_JAVASCRIPT_ISFALSE) {
         options += getMessage('deja_properties_javascriptAssertTrue');
      } else {
         options += getMessage('deja_properties_javascriptAssertFalse');
      }

      if (script.domTreeGetValidateParam(aValidation, 'evaltype') ===
         constants.VALIDATION_JAVASCRIPT_EVALDEFAULT) {
         options += separator + getMessage('deja_properties_javascriptEvalDefault');
      } else {
         options += separator + getMessage('deja_properties_javascriptEvalOne');
      }

      return getMessage("deja_properties_javascriptSummary", [ text, options ]);
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new javascript validation.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {!Event} aEvent A jQuery click event on the add validation button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaJavascript.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected javascript validation.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {!Event} aEvent A jQuery click event on the edit validation button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.validations.length)) {
               this.context.openDialog('ui/content/dejaJavascript.html',
                  {
                     context: this.context.element,
                     item: this.validations[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a validation has been added or edited.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {?Element} aValidation The added or edited validation element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aValidation) {
      try {
         if (aValidation !== null) {
            this.context.syncValidationsChange();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected javascript validation.
    * @this {DejaClickUi.JsValidationsProperty}
    * @param {!Event} aEvent A jQuery click event on the remove
    *    validation button.
    */
   remove: function (aEvent) {
      var selected, index, validation, validationsElt;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.validations.length)) {
               validation = this.validations[index];
               validationsElt = validation.parentNode;
               this.context.script.domTreeRemoveNode(validation);
               if (validationsElt.firstElementChild == null) {
                  this.context.script.domTreeRemoveNode(validationsElt);
               } else {
                  this.context.script.renumberElements('validation');
               }
            }
            this.context.syncValidationsChange();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.JsValidationsProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.JsValidationsProperty}
    */
   apply: function () {

   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.JsValidationsProperty}
    */
   enableControls: function () {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);
      }
   }
};


/**
 * Property controlling what the Replay Advisor can do.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.ReplayAdvisorProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#replayAdvisorSection'),
      prompt: $('#replayAdvisorPrompt'),
      repair: $('#replayAdvisorRepair'),
      promptWhen: $('#replayAdvisorPromptDiv'),
      eventTimeout: $('#replayAdvisorEventTimeout'),
      responseTimeout: $('#replayAdvisorResponseTimeout'),
      locationTimeout: $('#replayAdvisorLocationTimeout'),
      networkTimeout: $('#replayAdvisorNetworkTimeout'),
      navigationTimeout: $('#replayAdvisorNavigationTimeout'),
      contentStart: $('#replayAdvisorContentStartTimeout'),
      contentStop: $('#replayAdvisorContentStopTimeout'),
      startUrl: $('#replayAdvisorStartUrl'),
      embeddedObject: $('#replayAdvisorEmbeddedObject'),
      browserResize: $('#replayAdvisorBrowserResize'),
      fileUpload: $('#replayAdvisorFileUpload'),
      reset: $('#replayAdvisorReset'),
      apply: $('#replayAdvisorApply')
   };
   this.elements.allPromptReasons = this.elements.promptWhen.find('input');
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.prompt.on('change', this.togglePrompts.bind(this));
   this.elements.repair.on('change', this.toggleRepairs.bind(this));
   this.elements.allPromptReasons.on('change', this.selectReason.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.ReplayAdvisorProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ReplayAdvisorProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    */
   refresh: function () {
      // Display settings in UI.
      this.elements.eventTimeout.prop('checked',
         this.context.getPreference('DC_OPTID_WARNEVTTIMEOUTPROMPT'));
      this.elements.responseTimeout.prop('checked',
         this.context.getPreference('DC_OPTID_WARNRSPTIMEOUTPROMPT'));
      this.elements.locationTimeout.prop('checked',
         this.context.getPreference('DC_OPTID_WARNLOCTIMEOUTPROMPT'));
      this.elements.networkTimeout.prop('checked',
         this.context.getPreference('DC_OPTID_WARNNETTIMEOUTPROMPT'));
      this.elements.navigationTimeout.prop('checked',
         this.context.getPreference('DC_OPTID_WARNNAVTIMEOUTPROMPT'));
      this.elements.contentStart.prop('checked',
         this.context.getPreference('DC_OPTID_WARNMUTBTIMEOUTPROMPT'));
      this.elements.contentStop.prop('checked',
         this.context.getPreference('DC_OPTID_WARNMUTETIMEOUTPROMPT'));
      this.elements.startUrl.prop('checked',
         this.context.getPreference('DC_OPTID_WARNFIRSTEVENTPROMPT') &&
         this.context.getPreference('DC_OPTID_WARNURLMISMATCHPROMPT'));
      this.elements.embeddedObject.prop('checked',
         this.context.getPreference('DC_OPTID_WARNEMBEDEDOBJPROMPT'));
      this.elements.browserResize.prop('checked',
         this.context.getPreference('DC_OPTID_WARNSCREENRESIZEPROMPT'));
      this.elements.fileUpload.prop('checked',
         this.context.getPreference('DC_OPTID_WARNFILEINPUTPROMPT'));

      this.elements.repair.prop('checked',
         this.context.getPreference('DC_OPTID_REPLAYADVISORREPAIR'));
      this.elements.prompt.prop('checked',
         this.elements.eventTimeout.prop('checked') ||
         this.elements.responseTimeout.prop('checked') ||
         this.elements.locationTimeout.prop('checked') ||
         this.elements.networkTimeout.prop('checked') ||
         this.elements.navigationTimeout.prop('checked') ||
         this.elements.contentStart.prop('checked') ||
         this.elements.contentStop.prop('checked') ||
         this.elements.startUrl.prop('checked') ||
         this.elements.embeddedObject.prop('checked') ||
         this.elements.browserResize.prop('checked') ||
         this.elements.fileUpload.prop('checked'));

      this.elements.promptWhen.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_WARNEVTTIMEOUTPROMPT',
            'DC_OPTID_WARNRSPTIMEOUTPROMPT',
            'DC_OPTID_WARNLOCTIMEOUTPROMPT',
            'DC_OPTID_WARNNETTIMEOUTPROMPT',
            'DC_OPTID_WARNNAVTIMEOUTPROMPT',
            'DC_OPTID_WARNMUTBTIMEOUTPROMPT',
            'DC_OPTID_WARNMUTETIMEOUTPROMPT',
            'DC_OPTID_WARNFIRSTEVENTPROMPT',
            'DC_OPTID_WARNURLMISMATCHPROMPT',
            'DC_OPTID_WARNEMBEDEDOBJPROMPT',
            'DC_OPTID_WARNSCREENRESIZEPROMPT',
            'DC_OPTID_WARNFILEINPUTPROMPT',
            'DC_OPTID_REPLAYADVISORREPAIR'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Enable or disable Replay Advisor prompting. Enable or disable all
    * reasons for prompting.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    * @param {!Event} aEvent A jQuery change event on the enable Replay
    *    Advisor prompting checkbox.
    */
   togglePrompts: function (aEvent) {
      try {
         this.elements.allPromptReasons.prop('checked',
            this.elements.prompt.prop('checked'));
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   toggleRepairs: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable a reason for the Replay Advisor to display a prompt.
    * Ensure that Replay Advisor prompting is enabled.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   selectReason: function (aEvent) {
      try {
         this.elements.prompt.prop('checked', true);
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_WARNEVTTIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNRSPTIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNLOCTIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNNETTIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNNAVTIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNMUTBTIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNMUTETIMEOUTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNFIRSTEVENTPROMPT');
         this.context.resetPreference('DC_OPTID_WARNURLMISMATCHPROMPT');
         this.context.resetPreference('DC_OPTID_WARNEMBEDEDOBJPROMPT');
         this.context.resetPreference('DC_OPTID_WARNSCREENRESIZEPROMPT');
         this.context.resetPreference('DC_OPTID_WARNFILEINPUTPROMPT');
         this.context.resetPreference('DC_OPTID_REPLAYADVISORREPAIR');
         this.context.syncPropertyChange('replayAdvisor');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var timeout;
      try {
         // The settings that have been commented out are not yet supported.
         this.context.setPreference('DC_OPTID_WARNEVTTIMEOUTPROMPT',
            this.elements.eventTimeout.prop('checked'));
         //this.context.setPreference('DC_OPTID_WARNRSPTIMEOUTPROMPT',
         //   this.elements.responseTimeout.prop('checked'));
         this.context.setPreference('DC_OPTID_WARNLOCTIMEOUTPROMPT',
            this.elements.locationTimeout.prop('checked'));
         this.context.setPreference('DC_OPTID_WARNNETTIMEOUTPROMPT',
            this.elements.networkTimeout.prop('checked'));
         //this.context.setPreference('DC_OPTID_WARNNAVTIMEOUTPROMPT',
         //   this.elements.navigationTimeout.prop('checked'));
         this.context.setPreference('DC_OPTID_WARNMUTBTIMEOUTPROMPT',
            this.elements.contentStart.prop('checked'));
         this.context.setPreference('DC_OPTID_WARNMUTETIMEOUTPROMPT',
            this.elements.contentStop.prop('checked'));
         this.context.setPreference('DC_OPTID_WARNFIRSTEVENTPROMPT',
            this.elements.startUrl.prop('checked'));
         //this.context.setPreference('DC_OPTID_WARNURLMISMATCHPROMPT',
         //   this.elements.startUrl.prop('checked'));
         this.context.setPreference('DC_OPTID_WARNEMBEDEDOBJPROMPT',
            this.elements.embeddedObject.prop('checked'));
         //this.context.setPreference('DC_OPTID_WARNSCREENRESIZEPROMPT',
         //   this.elements.browserResize.prop('checked'));
         //this.context.setPreference('DC_OPTID_WARNFILEINPUTPROMPT',
         //   this.elements.fileUpload.prop('checked'));
         this.context.setPreference('DC_OPTID_REPLAYADVISORREPAIR',
            this.elements.repair.prop('checked'));

         this.context.syncPropertyChange('replayAdvisor');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.ReplayAdvisorProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling how long to wait while replaying an event.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.EventTimeoutProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#eventTimeoutSection'),
      description: $('#eventTimeoutDescription'),
      timeout: $('#eventTimeoutSeconds'),
      userPauseDiv: $('#eventTimeoutUserPauseDiv'),
      userPause: $('#eventTimeoutUserPause'),
      skip: $('#eventTimeoutSkip'),
      error: $('#eventTimeoutError'),
      reset: $('#eventTimeoutReset'),
      apply: $('#eventTimeoutApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.allInputs.on('change input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.EventTimeoutProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.EventTimeoutProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.EventTimeoutProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.EventTimeoutProperty}
    */
   refresh: function () {
      var isEvent = (this.context.category === 'event');

      // Display settings in UI.
      this.elements.description.text(this.context.getMessage(isEvent ?
         'deja_properties_eventTimeoutDescriptionEvent' :
         'deja_properties_eventTimeoutDescriptionGeneral'));
      this.elements.timeout.val(String(
         this.context.getPreference('DC_OPTID_EVENTTIMEOUT') / 1000));
      this.elements.userPause.prop('checked',
         isEvent && this.context.getPreference('DC_OPTID_USEPAUSETIMEOUT'));

      if (this.context.getPreference('DC_OPTID_FAILONTIMEOUT')) {
         this.elements.error.prop('checked', true);
      } else {
         this.elements.skip.prop('checked', true);
      }

      // Enable user pause option only available for events.
      this.elements.userPauseDiv.toggle(isEvent);

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_EVENTTIMEOUT',
            'DC_OPTID_USEPAUSETIMEOUT',
            'DC_OPTID_FAILONTIMEOUT'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.EventTimeoutProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue ||
               (aEvent.target.id === 'eventTimeoutUserPause')) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.EventTimeoutProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_EVENTTIMEOUT');
         this.context.resetPreference('DC_OPTID_USEPAUSETIMEOUT');
         this.context.resetPreference('DC_OPTID_FAILONTIMEOUT');
         this.context.syncPropertyChange('eventTimeout');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.EventTimeoutProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var timeout;
      try {
         timeout = 1000 * this.elements.timeout.val();
         if (!this.context.validate('DC_OPTID_EVENTTIMEOUT', timeout)) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }
         this.context.setPreference('DC_OPTID_EVENTTIMEOUT', timeout);
         this.context.setPreference('DC_OPTID_FAILONTIMEOUT',
            this.elements.error.prop('checked'));
         if (this.context.category === 'event') {
            this.context.setPreference('DC_OPTID_USEPAUSETIMEOUT',
               this.elements.userPause.prop('checked'));
         }

         this.context.syncPropertyChange('eventTimeout');

      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.EventTimeoutProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         var isEvent = (this.context.category === 'event');
         if (isEvent) { 
            if (this.context.event.getAttribute('type') == 'navigate') {
               this.elements.skip[0].disabled = true;
            } 
         } 

         if (this.elements.userPause.prop('checked')) {
            this.elements.timeout.attr('disabled', 'true');
         }
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling how long to wait while replaying an event.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.PauseIntervalsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#pauseIntervalsSection'),
      enable: $('#pauseIntervalsEnable'),
      durationDiv: $('#pauseIntervalsDurationDiv'),
      duration: $('#pauseIntervalsDuration'),
      screenDiv: $('#pauseIntervalsScreenDiv'),
      enableScreen: $('#pauseIntervalsEnableScreen'),
      speedDiv: $('#pauseIntervalsSpeedDiv'),
      speed: $('#pauseIntervalsSpeed'),
      reset: $('#pauseIntervalsReset'),
      apply: $('#pauseIntervalsApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.enable.on('change', this.toggle.bind(this));
   this.elements.enableScreen.on('change', this.toggle.bind(this));
   this.elements.duration.on('input', this.changeValue.bind(this));
   this.elements.speed.on('input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.PauseIntervalsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.PauseIntervalsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.PauseIntervalsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.PauseIntervalsProperty}
    */
   refresh: function () {
      var thinktime;

      // Display settings in UI.
      this.elements.enable.prop('checked',
         this.context.getPreference('DC_OPTID_USETHINKTIMEHINTS'));
      this.elements.enableScreen.prop('checked',
         this.context.getPreference('DC_OPTID_USEEVENTSPEED'));
      this.elements.speed.val(String(Math.floor(
         this.context.getPreference('DC_OPTID_EVENTSPEED') * 100)));

      // Pause interval editing is only available for events.
      if (this.context.category === 'event') {
         this.elements.durationDiv.toggle(this.elements.enable.prop('checked'));
         thinktime = this.context.getReplayHint('thinktime');
         if (thinktime == null) {
            thinktime = '0';
         }
         this.elements.duration.val(thinktime);

         // Only show the screen event timing options for screen events.
         if (this.context.event.getAttribute('screen') === 'true') {
            this.elements.screenDiv.show();
         } else {
            this.elements.screenDiv.hide();
            this.elements.enableScreen.prop('checked', false);
         }
      } else {
         this.elements.durationDiv.hide();
         this.elements.screenDiv.show();
      }

      this.elements.speedDiv.toggle(this.elements.enableScreen.prop('checked'));

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_USETHINKTIMEHINTS',
            'DC_OPTID_USEEVENTSPEED',
            'DC_OPTID_EVENTSPEED'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Show or hide elements that have been enabled or disabled by
    * changing one of the checkboxes.
    * @this {DejaClickUi.PauseIntervalsProperty}
    * @param {!Event} aEvent A jQuery change event on a checkbox in the section.
    */
   toggle: function (aEvent) {
      try {
         this.elements.durationDiv.toggle(
            this.elements.enable.prop('checked') &&
               (this.context.category === 'event'));
         this.elements.speedDiv.toggle(
            this.elements.enableScreen.prop('checked'));
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.PauseIntervalsProperty}
    * @param {!Event} aEvent A jQuery input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.PauseIntervalsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USETHINKTIMEHINTS');
         this.context.resetPreference('DC_OPTID_USEEVENTSPEED');
         this.context.resetPreference('DC_OPTID_EVENTSPEED');
         this.context.syncPropertyChange('pauseIntervals');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.PauseIntervalsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var isEvent, thinktime, speed;
      try {
         isEvent = this.context.category === 'event';
         thinktime = isEvent ? this.elements.duration.val() : 0;
         speed = this.elements.speed.val() / 100;

         if (!((0 <= thinktime) && (thinktime <= 99999)) ||
               !this.context.validate('DC_OPTID_EVENTSPEED', speed)) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }
         this.context.setPreference('DC_OPTID_USETHINKTIMEHINTS',
            this.elements.enable.prop('checked'));
         this.context.setPreference('DC_OPTID_USEEVENTSPEED',
            this.elements.enableScreen.prop('checked'));
         this.context.setPreference('DC_OPTID_EVENTSPEED', speed);
         if (isEvent) {
            this.context.setReplayHint('thinktime', String(thinktime));
         }

         this.context.syncPropertyChange('pauseIntervals');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.PauseIntervalsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property specifying the maximum number of skipped events that may
 * occur before replay is aborted.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.SkippedEventsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#skippedEventsSection'),
      enable: $('#skippedEventsEnable'),
      count: $('#skippedEventsCount'),
      reset: $('#skippedEventsReset'),
      apply: $('#skippedEventsApply'),
      allInputs: $('#skippedEventsEnable,#skippedEventsCount'),
      allButtons: $('#skippedEventsReset,#skippedEventsApply')
   };

   this.elements.allInputs.on('change input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.SkippedEventsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.SkippedEventsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.SkippedEventsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.SkippedEventsProperty}
    */
   refresh: function () {
      this.elements.enable.prop('checked',
         this.context.getPreference('DC_OPTID_USEMAXSKIPPED'));
      this.elements.count.val(String(
         this.context.getPreference('DC_OPTID_MAXSKIPPED')));

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [ 'DC_OPTID_USEMAXSKIPPED', 'DC_OPTID_MAXSKIPPED' ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.SkippedEventsProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue ||
               (aEvent.target.id === 'skippedEventsEnable')) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.SkippedEventsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USEMAXSKIPPED');
         this.context.resetPreference('DC_OPTID_MAXSKIPPED');
         this.context.syncPropertyChange('maxSkipped');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.SkippedEventsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var maxSkipped;
      try {
         maxSkipped = Number(this.elements.count.val());
         if (!this.context.validate('DC_OPTID_MAXSKIPPED', maxSkipped)) {
            window.alert(this.context.getMessage(
               'deja_properties_skippedEventsInvalidCount'));
            return;
         }
         this.context.setPreference('DC_OPTID_USEMAXSKIPPED',
            this.elements.enable.prop('checked'));
         this.context.syncPropertyChange('maxSkipped');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.SkippedEventsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.enable.removeAttr('disabled');
         if (this.elements.enable.prop('checked')) {
            this.elements.count.removeAttr('disabled');
         } else {
            this.elements.count.attr('disabled', 'true');
         }
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property allowing configuration of how to respond to dialog prompts
 * during replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.DialogPromptsProperty = function (aContext) {
   var constants;
   this.context = aContext;

   this.dialogs = [];

   this.elements = {
      description: $('#dialogPromptsDescription'),
      select: $('#dialogPromptsList'),
      add: $('#dialogPromptsAdd'),
      edit: $('#dialogPromptsEdit'),
      remove: $('#dialogPromptsRemove'),
      allButtons: $('#dialogPromptsSection').find('button')
   };

   constants = this.context.constants;
   this.dialogTypes = {};
   this.dialogTypes[constants.DIALOGTYPE_LOGINPROMPT] =
      'deja_properties_dialogLogin';
   this.dialogTypes[constants.DIALOGTYPE_INPUTPROMPT] =
      'deja_properties_dialogInput';
   this.dialogTypes[constants.DIALOGTYPE_CONFIRMPROMPT] =
      'deja_properties_dialogConfirm';
   this.dialogTypes[constants.DIALOGTYPE_GENERICPROMPT] =
      'deja_properties_dialogGeneric';
   this.dialogTypes[constants.DIALOGTYPE_CERTMISMATCH] =
      'deja_properties_dialogCertMismatch';
   this.dialogTypes[constants.DIALOGTYPE_CERTUNKNOWN] =
      'deja_properties_dialogCertUnknown';
   this.dialogTypes[constants.DIALOGTYPE_CERTEXPIRED] =
      'deja_properties_dialogCertExpired';
   this.dialogTypes[constants.DIALOGTYPE_CERTINVALID] =
      'deja_properties_dialogCertInvalid';
   this.dialogTypes[constants.DIALOGTYPE_CERTCLIENT] =
      'deja_properties_dialogCertClient';

   this.dialogActions = {};
   this.dialogActions[constants.DIALOGBUTTON_ACCEPT] =
      'deja_properties_dialogAccept';
   this.dialogActions[constants.DIALOGBUTTON_CANCEL] =
      'deja_properties_dialogCancel';
   this.dialogActions[constants.DIALOGBUTTON_EXTRA1] =
      'deja_properties_dialogExtra1';
   this.dialogActions[constants.DIALOGBUTTON_EXTRA2] =
      'deja_properties_dialogExtra2';

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.DialogPromptsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.DialogPromptsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.DialogPromptsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.dialogs;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.DialogPromptsProperty}
    */
   refresh: function () {
      var select, dialogsElt, index, summary;

      // Remove any previously added dialogs.
      select = this.elements.select;
      select.empty();

      // Find the header script elements.
      dialogsElt = this.context.script.getChildWithTag(this.context.element,
         'dialogs');
      if (dialogsElt == null) {
         this.dialogs = [];
      } else {
         this.dialogs = Array.prototype.slice.call(
            dialogsElt.getElementsByTagName('dialog'), 0);
         index = this.dialogs.length;
         while (index !== 0) {
            --index;
            summary = this.getDialogDescription(this.dialogs[index]);
            select.prepend($(document.createElement('option')).
               text(summary).
               attr('title', summary).
               attr('value', String(index)));
         }
      }
      this.enableControls();
   },

   /**
    * Get a user-oriented description of the dialog prompt response.
    * @this {DejaClickUi.DialogPromptsProperty}
    * @param {!Element} aDialog The dialog element to be described.
    * @return {string} The description.
    */
   getDialogDescription: function (aDialog) {
      var script, constants, getMessage,
         dialog, action, repeat, option, type, summary;

      script = this.context.script;
      constants = this.context.constants;
      getMessage = this.context.getMessage;

      dialog = {
         type: aDialog.getAttribute('type'),
         action: script.domTreeGetDialogParam(aDialog, 'action'),
         repeat: script.domTreeGetDialogParam(aDialog, 'repeat'),
         input1: script.domTreeGetDialogParam(aDialog, 'input1'),
         input2: script.domTreeGetDialogParam(aDialog, 'input2'),
         input3: script.domTreeGetDialogParam(aDialog, 'input3'),
         option1: script.domTreeGetDialogParam(aDialog, 'option1'),
         check1: script.domTreeGetDialogParam(aDialog, 'check1')
      };

      if (this.dialogActions.hasOwnProperty(dialog.action)) {
         action = getMessage(this.dialogActions[dialog.action]);
      } else {
         action = '';
      }
      if (dialog.repeat === '1') {
         repeat = getMessage('deja_properties_dialogRepeatOnce');
      } else {
         repeat = getMessage('deja_properties_dialogRepeat', dialog.repeat);
      }

      switch (dialog.type) {
      case constants.DIALOGTYPE_CERTINVALID:
         summary = getMessage('deja_properties_dialogCertInvalid', [
            action,
            getMessage((dialog.check1 === 'true') ?
               'deja_properties_dialogCheck1p' :
               'deja_properties_dialogCheck1t'),
            repeat
         ]);
         break;

      case constants.DIALOGTYPE_CERTUNKNOWN:
         option = getMessage('deja_properties_dialogOption' + dialog.option1);
         if (option.length === 0) {
            option = 'unknown';
         }
         summary = getMessage('deja_properties_dialogCertUnknown', [
            action,
            option,
            repeat
         ]);
         break;

      case constants.DIALOGTYPE_CERTCLIENT:
         summary = getMessage('deja_properties_dialogCertClient', [
            action,
            getMessage((dialog.check1 === 'true') ?
               'deja_properties_dialogCheck1r' :
               'deja_properties_dialogCheck1f'),
            repeat
         ]);
         break;

      case constants.DIALOGTYPE_LOGINPROMPT:
         summary = getMessage('deja_properties_dialogLogin', [
            action,
            (dialog.input1 == null) ? '' : dialog.input1,
            (dialog.input2 == null) ? '' : dialog.input2.replace(/./g, '*'),
            repeat
         ]);
         break;

      default:
         if (this.dialogTypes.hasOwnProperty(dialog.type)) {
            type = getMessage(this.dialogTypes[dialog.type]);
         } else {
            type = '';
         }
         if (dialog.input1 == null) { dialog.input1 = ''; }
         if (dialog.input2 == null) { dialog.input2 = ''; }
         if (dialog.input3 == null) { dialog.input3 = ''; }
         if (dialog.input3.length !== 0) {
            summary = getMessage('deja_properties_dialogPrompt3Inputs', [
               type,
               action,
               dialog.input1,
               dialog.input2,
               dialog.input3,
               repeat
            ]);
         } else if (dialog.input2.length !== 0) {
            summary = getMessage('deja_properties_dialogPrompt2Inputs', [
               type,
               action,
               dialog.input1,
               dialog.input2,
               repeat
            ]);
         } else if (dialog.input1.length !== 0) {
            summary = getMessage('deja_properties_dialogPrompt1Input', [
               type,
               action,
               dialog.input1,
               repeat
            ]);
         } else {
            summary = getMessage('deja_properties_dialogPromptNoInput', [
               type,
               action,
               repeat
            ]);
         }
         break;
      }
      return summary;
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.DialogPromptsProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new dialog.
    * @this {DejaClickUi.DialogPromptsProperty}
    * @param {!Event} aEvent A jQuery click event on the add dialog button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaDialog.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected dialog.
    * @this {DejaClickUi.DialogPromptsProperty}
    * @param {!Event} aEvent A jQuery click event on the edit dialog button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.dialogs.length)) {
               this.context.openDialog('ui/content/dejaDialog.html',
                  {
                     context: this.context.element,
                     item: this.dialogs[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a dialog has been added or edited.
    * @this {DejaClickUi.DialogPromptsProperty}
    * @param {?Element} aDialog The added or edited dialog element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aDialog) {
      try {
         if (aDialog !== null) {
            this.context.syncPropertyChange('dialogPrompts');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected dialog.
    * @this {DejaClickUi.DialogPromptsProperty}
    * @param {!Event} aEvent A jQuery click event on the remove dialog button.
    */
   remove: function (aEvent) {
      var selected, index, dialog, dialogsElt, script, dialogs, ordinal;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.dialogs.length)) {
               dialog = this.dialogs[index];
               dialogsElt = dialog.parentNode;
               script = this.context.script;
               script.domTreeRemoveNode(dialog);
               if (this.dialogs.length === 1) {
                  script.domTreeRemoveNode(dialogsElt);
               } else {
                  // Update the sort order of the dialogs in this context.
                  dialogs = dialogsElt.getElementsByTagName('dialog');
                  for (ordinal = dialogs.length; ordinal !== 0; --ordinal) {
                     dialogs[ordinal - 1].setAttribute('ordinal',
                        String(ordinal));
                  }
               }
               script.renumberElements('dialog');
            }
            this.context.syncPropertyChange('dialogPrompts');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.DialogPromptsProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.DialogPromptsProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.DialogPromptsProperty}
    */
   enableControls: function () {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);
      }
   }
};


/**
 * Property specifying how event target elements are selected.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.MatchOptionsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#matchOptionsSection'),
      description: $('#matchOptionsDescription'),
      enableStopReplay: $('#matchOptionsEnableStopReplay'),
      stopReplay: $('#matchOptionsStopReplay'),
      enableDetectErrors: $('#matchOptionsEnableDetectErrors'),
      errorThreshold: $('#matchOptionsErrorThreshold'),
      ignoreAttributes: $('#matchOptionsIgnoreNamedAttributes'),
      matchTypeDiv: $('#matchOptionsMatchTypeDiv'),
      matchType: $('#matchOptionsMatchType'),
      fingerprint: $('#matchOptionsFingerprint'),
      elementPath: $('#matchOptionsElementPath'),
      editElementPath: $('#matchOptionsEditElementPath'),
      breadcrumbs: $('#matchOptionsBreadcrumbs'),
      reset: $('#matchOptionsReset'),
      apply: $('#matchOptionsApply')
   };

   this.elements.allInputs = this.elements.section.find('input,select');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.enableStopReplay.on('change', this.toggleSetting.bind(this));
   this.elements.stopReplay.on('input', this.changeValue.bind(this));
   this.elements.enableDetectErrors.on('change', this.toggleSetting.bind(this));
   this.elements.errorThreshold.on('input', this.changeValue.bind(this));
   this.elements.ignoreAttributes.on('change', this.changeValue.bind(this));
   this.elements.matchType.on('change', this.selectMatchType.bind(this));
   this.elements.fingerprint.on('change', this.changeMatchType.bind(this));
   this.elements.elementPath.on('change', this.changeMatchType.bind(this));
   this.elements.breadcrumbs.on('change', this.changeMatchType.bind(this));
   this.elements.editElementPath.on('click', this.editElementPath.bind(this));

   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.MatchOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.MatchOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.MatchOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.editElementPath.off('click');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.MatchOptionsProperty}
    */
   refresh: function () {
      var useMatchTypes, fingerprint, elementPath, breadcrumbs, diagnostic;

      this.elements.description.text(this.context.getMessage(
         'deja_properties_matchOptionsDescription_' + this.context.category));

      this.elements.enableStopReplay.prop('checked',
         this.context.getPreference('DC_OPTID_USEMINMATCHSCORE'));
      this.elements.stopReplay.val(String(
         this.context.getPreference('DC_OPTID_MINMATCHSCORE')));

      this.elements.enableDetectErrors.prop('checked',
         this.context.getPreference('DC_OPTID_USEMINMATCHSCORE2'));
      this.elements.errorThreshold.val(String(
         this.context.getPreference('DC_OPTID_MINMATCHSCORE2')));

      this.elements.ignoreAttributes.prop('checked',
         this.context.getPreference('DC_OPTID_IGNORENAMEDATTR'));

      useMatchTypes =
         this.context.getPreference('DC_OPTID_USEMATCHTYPES').toLowerCase();
      if (useMatchTypes.indexOf('all') !== -1) {
         fingerprint = elementPath = breadcrumbs = true;
      } else {
         fingerprint = useMatchTypes.indexOf('fp') !== -1;
         elementPath = useMatchTypes.indexOf('ep') !== -1;
         breadcrumbs = useMatchTypes.indexOf('bc') !== -1;
      }
      this.elements.fingerprint.prop('checked', fingerprint);
      this.elements.elementPath.prop('checked', elementPath);
      this.elements.breadcrumbs.prop('checked', breadcrumbs);

      if (this.context.getPreference('DC_OPTID_OPTIMIZEDMATCH')) {
         this.elements.matchType.val('optimized');
      } else if (!fingerprint && !elementPath && breadcrumbs) {
         this.elements.matchType.val('intensive');
      } else {
         this.elements.matchType.val('custom');
      }

      diagnostic = (this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);
      if (this.context.category === 'event') {
         this.elements.matchTypeDiv.show();
         if (diagnostic) {
            // Show if event has a target with an elementpath.
            this.elements.editElementPath.toggle($(this.context.event).
               has('target[type="element"] elementpath').length !== 0);
         } else {
            this.elements.editElementPath.hide();
         }
      } else {
         this.elements.matchTypeDiv.toggle(diagnostic);
         this.elements.editElementPath.hide();
      }

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_USEMINMATCHSCORE',
            'DC_OPTID_MINMATCHSCORE',
            'DC_OPTID_USEMINMATCHSCORE2',
            'DC_OPTID_MINMATCHSCORE2',
            'DC_OPTID_IGNORENAMEDATTR',
            'DC_OPTID_USEMATCHTYPES',
            'DC_OPTID_OPTIMIZEDMATCH'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Enable or disable the use of match scores for stopping replay or
    * detecting errors.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on a checkbox to enable
    *    use of match scores.
    */
   toggleSetting: function (aEvent) {
      try {
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Select a new general method of finding target elements.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on the match type select
    *    element.
    */
   selectMatchType: function (aEvent) {
      try {
         switch (this.elements.matchType.val()) {
         case 'optimized':
            this.elements.fingerprint.prop('checked', true);
            this.elements.elementPath.prop('checked', true);
            this.elements.breadcrumbs.prop('checked', true);
            break;
         case 'intensive':
            this.elements.fingerprint.prop('checked', false);
            this.elements.elementPath.prop('checked', false);
            this.elements.breadcrumbs.prop('checked', true);
            break;
         }
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the use of individual element search algorithms.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on a search method checkbox.
    */
   changeMatchType: function (aEvent) {
      try {
         this.elements.matchType.val('custom');
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the element path to the target for this
    * current event.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event} aEvent A jQuery click event on the edit elementpath link.
    */
   editElementPath: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaElementPath.html',
            { context: this.context.element },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Complete the edit of the element path to the event target.
    * There is nothing to do here since the elementpath does not
    * appear in the UI.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {?Element} aElement The event whose target element path was
    *    changed or null if the operation was canceled.
    */
   completeEdit: function (aElement) { },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USEMINMATCHSCORE');
         this.context.resetPreference('DC_OPTID_MINMATCHSCORE');
         this.context.resetPreference('DC_OPTID_USEMINMATCHSCORE2');
         this.context.resetPreference('DC_OPTID_MINMATCHSCORE2');
         this.context.resetPreference('DC_OPTID_IGNORENAMEDATTR');
         this.context.resetPreference('DC_OPTID_USEMATCHTYPES');
         this.context.resetPreference('DC_OPTID_OPTIMIZEDMATCH');
         this.context.syncPropertyChange('matchOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.MatchOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var minScore1, minScore2, fingerprint, elementPath, breadcrumbs,
         matchTypes;

      try {
         minScore1 = Number(this.elements.stopReplay.val());
         minScore2 = Number(this.elements.errorThreshold.val());

         if (!this.context.validate('DC_OPTID_MINMATCHSCORE', minScore1) ||
               !this.context.validate('DC_OPTID_MINMATCHSCORE2', minScore2)) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }

         this.context.setPreference('DC_OPTID_USEMINMATCHSCORE',
            this.elements.enableStopReplay.prop('checked'));
         this.context.setPreference('DC_OPTID_MINMATCHSCORE', minScore1);
         this.context.setPreference('DC_OPTID_USEMINMATCHSCORE2',
            this.elements.enableDetectErrors.prop('checked'));
         this.context.setPreference('DC_OPTID_MINMATCHSCORE2', minScore2);
         this.context.setPreference('DC_OPTID_IGNORENAMEDATTR',
            this.elements.ignoreAttributes.prop('checked'));
         this.context.setPreference('DC_OPTID_OPTIMIZEDMATCH',
            (this.elements.matchType.val() === 'optimized'));

         fingerprint = this.elements.fingerprint.prop('checked');
         elementPath = this.elements.elementPath.prop('checked');
         breadcrumbs = this.elements.breadcrumbs.prop('checked');
         if (fingerprint && elementPath && breadcrumbs) {
            matchTypes = 'all';
         } else {
            matchTypes = '';
            if (fingerprint) {
               matchTypes += ' fp';
            }
            if (elementPath) {
               matchTypes += ' ep';
            }
            if (breadcrumbs) {
               matchTypes += ' bc';
            }
         }
         this.context.setPreference('DC_OPTID_USEMATCHTYPES', matchTypes);

         this.context.syncPropertyChange('matchOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.MatchOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.editElementPath.attr('disabled', 'true');
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.editElementPath.removeAttr('disabled');
         this.elements.allInputs.removeAttr('disabled');
         if (!this.elements.enableStopReplay.prop('checked')) {
            this.elements.stopReplay.attr('disabled', 'true');
         }
         if (!this.elements.enableDetectErrors.prop('checked')) {
            this.elements.errorThreshold.attr('disabled', 'true');
         }

         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};

/**
 * Property specifying the browser preferences.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.BrowserPrefsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
	  section: $('#browserPrefsSection'),
	  proxySettingsUse: $('#useProxySettings'),
	  editProxySettings: $('#editProxySettings'),
	  editProxySettings2: $('#editProxySettings2'),
      reset: $('#proxyReset'),
      apply: $('#proxyApply')
   };

   this.elements.allInputs = this.elements.section.find('input,select');
   this.elements.allButtons = this.elements.section.find('button');
   this.elements.proxySettingsUse.on('change', this.toggle.bind(this));
   this.elements.editProxySettings2.on('click', this.edit.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.BrowserPrefsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.BrowserPrefsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.BrowserPrefsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('input');
         this.elements.speed.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.BrowserPrefsProperty}
    */
   refresh: function () {
      // Display settings in UI.
      var useProxy = this.context.getPreference('DC_OPTID_USEPROXYSETTINGS');
      this.elements.proxySettingsUse.prop('checked', useProxy);
      if (useProxy != null && useProxy) {
         if (this.elements.editProxySettings.prop('hidden')) {
            this.elements.editProxySettings.removeAttr('hidden');
         }
		 this.elements.editProxySettings.show();
      } else {
         this.elements.editProxySettings.attr('hidden', true);
		 this.elements.editProxySettings.hide();
      }
      this.state.hasNewValue = false;
      this.enableControls();
   },


   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.BrowserPrefsProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   completeEdit: function () {
   },

   /**
    * Edit the settings for this property.
    * @this {DejaClickUi.BrowserPrefsProperty}
    * @param {!Event=} opt_event A jQuery click event on the link.
    */   
   edit: function (opt_event) {
      try {
         this.context.openDialog('ui/content/dejaProxySettings.html',
            {context: this.context.element, item: null},
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
	  }
   },
   
   /**
    * Show or hide elements that have been enabled or disabled by
    * changing one of the checkboxes.
    * @this {DejaClickUi.PauseIntervalsProperty}
    * @param {!Event} aEvent A jQuery change event on a checkbox in the section.
    */
   toggle: function (aEvent) {
      try {
         this.elements.editProxySettings.toggle(
            this.elements.proxySettingsUse.prop('checked'));
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },
   
   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.BrowserPrefsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USEPROXYSETTINGS');
         this.context.syncPropertyChange('browserPrefs');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.BrowserPrefsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var event, dispatch, ready, response, maxScript;
      try {
         this.context.setPreference('DC_OPTID_USEPROXYSETTINGS',
            this.elements.proxySettingsUse.prop('checked'));
         this.context.syncPropertyChange('browserPrefs');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.BrowserPrefsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};

/**
 * Property specifying the replay speed.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.ReplayTimingsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#replayTimingsSection'),
      description: $('#replayTimingsDescription'),
      speed: $('#replayTimingsSpeed'),
      eventDelay: $('#replayTimingsEventDelay'),
      dispatchDelay: $('#replayTimingsDispatchDelay'),
      readyTimeout: $('#replayTimingsReadyTimeout'),
      responseTimeout: $('#replayTimingsResponseTimeout'),
      maxScriptTime: $('#replayTimingsMaxScriptTime'),
      reset: $('#replayTimingsReset'),
      apply: $('#replayTimingsApply')
   };

   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');
   this.elements.advancedOnly = this.elements.section.find('.advancedOnly');
   this.elements.diagnosticOnly = this.elements.section.find('.diagnosticOnly');
   this.elements.speedInputs = this.elements.eventDelay.
      add(this.elements.dispatchDelay).
      add(this.elements.readyTimeout);

   this.elements.speed.on('change', this.changeSpeed.bind(this));
   this.elements.speedInputs.on('input', this.changeTiming.bind(this));
   this.elements.responseTimeout.on('input', this.changeValue.bind(this));
   this.elements.maxScriptTime.on('input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.ReplayTimingsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ReplayTimingsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.ReplayTimingsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('input');
         this.elements.speed.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.ReplayTimingsProperty}
    */
   refresh: function () {
      var eventDelay, dispatchDelay, readyTimeout, constants;

      this.elements.description.text(this.context.getMessage(
         'deja_properties_replayTimingsDescription_' + this.context.category));

      eventDelay = this.context.getPreference('DC_OPTID_EVENTDELAY');
      dispatchDelay = this.context.getPreference('DC_OPTID_DISPATCHDELAY');
      readyTimeout = this.context.getPreference('DC_OPTID_READYTIMEOUT');

      this.elements.eventDelay.val(String(eventDelay));
      this.elements.dispatchDelay.val(String(dispatchDelay));
      this.elements.readyTimeout.val(String(readyTimeout));
      this.elements.responseTimeout.val(String(
         this.context.getPreference('DC_OPTID_RESPONSETIMEOUT')));
      this.elements.maxScriptTime.val(String(
         this.context.getPreference('DC_OPTID_MAXSCRIPTRUN')));

      constants = this.context.constants;
      if ((eventDelay === constants.EVENTDELAY_FASTER) &&
            (dispatchDelay === constants.DISPATCHDELAY_FASTER) &&
            (readyTimeout === constants.READYTIMEOUT_FASTER)) {
         this.elements.speed.val('FASTER');

      } else if ((eventDelay === constants.EVENTDELAY_NORMAL) &&
            (dispatchDelay === constants.DISPATCHDELAY_NORMAL) &&
            (readyTimeout === constants.READYTIMEOUT_NORMAL)) {
         this.elements.speed.val('NORMAL');

      } else if ((eventDelay === constants.EVENTDELAY_SLOWER) &&
            (dispatchDelay === constants.DISPATCHDELAY_SLOWER) &&
            (readyTimeout === constants.READYTIMEOUT_SLOWER)) {
         this.elements.speed.val('SLOWER');

      } else {
         this.elements.speed.val('CUSTOM');
      }

      this.elements.advancedOnly.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);
      this.elements.diagnosticOnly.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_EVENTDELAY',
            'DC_OPTID_DISPATCHDELAY',
            'DC_OPTID_READYTIMEOUT',
            'DC_OPTID_RESPONSETIMEOUT',
            'DC_OPTID_MAXSCRIPTRUN'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Adjust the specific timings to reflect the selected speed.
    * @this {DejaClickUi.ReplayTimingsProperty}
    * @param {!Event} aEvent A jQuery change event on the speed select element.
    */
   changeSpeed: function (aEvent) {
      var speed, constants;
      try {
         speed = this.elements.speed.val();
         constants = this.context.constants;
         if (constants.hasOwnProperty('EVENTDELAY_' + speed)) {
            this.elements.eventDelay.val(String(
               constants['EVENTDELAY_' + speed]));
         }
         if (constants.hasOwnProperty('DISPATCHDELAY_' + speed)) {
            this.elements.dispatchDelay.val(String(
               constants['DISPATCHDELAY_' + speed]));
         }
         if (constants.hasOwnProperty('READYTIMEOUT_' + speed)) {
            this.elements.readyTimeout.val(String(
               constants['READYTIMEOUT_' + speed]));
         }
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Change the speed setting to custom and mark the property as changed.
    * @this {DejaClickUi.ReplayTimingsProperty}
    * @param {!Event} aEvent A jQuery input event on a replay speed element.
    */
   changeTiming: function (aEvent) {
      try {
         this.elements.speed.val('CUSTOM');
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.ReplayTimingsProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.ReplayTimingsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_EVENTDELAY');
         this.context.resetPreference('DC_OPTID_DISPATCHDELAY');
         this.context.resetPreference('DC_OPTID_READYTIMEOUT');
         this.context.resetPreference('DC_OPTID_RESPONSETIMEOUT');
         this.context.resetPreference('DC_OPTID_MAXSCRIPTRUN');
         this.context.syncPropertyChange('replayTimings');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.ReplayTimingsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var event, dispatch, ready, response, maxScript;
      try {
         event = Number(this.elements.eventDelay.val());
         dispatch = Number(this.elements.dispatchDelay.val());
         ready = Number(this.elements.readyTimeout.val());
         // Use current settings while these features are not supported.
         response = Number(this.elements.responseTimeout.val()) ||
            this.context.getPreference('DC_OPTID_RESPONSETIMEOUT');
         maxScript = Number(this.elements.maxScriptTime.val()) ||
            this.context.getPreference('DC_OPTID_MAXSCRIPTRUN');

         if (!this.context.validate('DC_OPTID_EVENTDELAY', event) ||
               !this.context.validate('DC_OPTID_DISPATCHDELAY', dispatch) ||
               !this.context.validate('DC_OPTID_READYTIMEOUT', ready) ||
               !this.context.validate('DC_OPTID_RESPONSETIMEOUT', response) ||
               !this.context.validate('DC_OPTID_MAXSCRIPTRUN', maxScript)) {
            window.alert(this.context.getMessage(
               'deja_properties_skippedEventsInvalidCount'));
            return;
         }

         // Ensure that event timeout is not less than the response timeout.
         if (this.context.getPreference('DC_OPTID_EVENTTIMEOUT') < response) {
            if (!window.confirm(this.context.getMessage(
                  'deja_properties_adjustEventTimeout'))) {
               return;
            }
            this.context.setPreference('DC_OPTID_EVENTTIMEOUT', response);
            this.context.syncPropertyChange('eventTimeout');
         }

         this.context.setPreference('DC_OPTID_EVENTDELAY', event);
         this.context.setPreference('DC_OPTID_DISPATCHDELAY', dispatch);
         this.context.setPreference('DC_OPTID_READYTIMEOUT', ready);
         this.context.setPreference('DC_OPTID_RESPONSETIMEOUT', response);
         this.context.setPreference('DC_OPTID_MAXSCRIPTRUN', maxScript);

         this.context.syncPropertyChange('replayTimings');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.ReplayTimingsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.speed.removeAttr('disabled');
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property allowing customization of script variable inputs.
 *
 * This property has some issues because the lifetime of the options
 * page is independent of the lifetime of the service.
 *
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.VariableOptionsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasNewValue: false
   };

   this.elements = {
      section: $('#variableOptionsSection'),
      counter: $('#variableOptionsCounter'),
      location: $('#variableOptionsLocation'),
      reset: $('#variableOptionsReset'),
      apply: $('#variableOptionsApply'),
      allInputs: $('#variableOptionsCounter,#variableOptionsLocation'),
      allButtons: $('#variableOptionsReset,#variableOptionsApply')
   };

   this.elements.allInputs.on('input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.VariableOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.VariableOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.VariableOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.VariableOptionsProperty}
    */
   refresh: function () {
      var replayCount, location;

      replayCount = 0;
      location = this.context.getPreference('DC_OPTID_LOCATIONID');

      if (DejaClick.service !== null) {
         replayCount = DejaClick.service.getReplayCount();
         location = DejaClick.service.getLocationId();
      }

      this.elements.counter.val(String(replayCount));
      this.elements.location.val(location);
      this.context.updatePropertyModified(this.elements.section,
         [ 'DC_OPTID_LOCATIONID' ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.VariableOptionsProperty}
    * @param {!Event} aEvent A jQuery input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.VariableOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_LOCATIONID');

         if (DejaClick.service !== null) {
            DejaClick.service.setReplayCount(0);
            DejaClick.service.setLocationId(
               this.context.getPreference('DC_OPTID_LOCATIONID'));
         }

         this.context.syncPropertyChange('variableOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.VariableOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var location;
      try {
         location = this.elements.location.val();
         this.context.setPreference('DC_OPTID_LOCATIONID', location);

         if (DejaClick.service !== null) {
            DejaClick.service.setReplayCount(
               Number(this.elements.counter.val()));
            DejaClick.service.setLocationId(location);
         }

         this.context.syncPropertyChange('variableOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.VariableOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled', false);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};

/**
 * Property allowing using of script variables.
 *
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */

DejaClickUi.VariablesProperty = function (aContext) {
   this.context = aContext;

   this.variables = [];
   this.locationIDs = {};

   this.elements = {
      //description: $('#javascriptValidationDescription'),
      select: $('#variablesSelect'),
      replaceLocationID: $('#replaceLocationID'),
      add: $('#variablesAdd'),
      edit: $('#variablesEdit'),
      remove: $('#variablesRemove'),
      allButtons: $('#variablesSection').find('button')
   };

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.replaceLocationID.on('click', this.replaceLocationID.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.VariablesProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.VariablesProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.VariablesProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.variables;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.VariablesProperty}
    */
   refresh: function (aEvent) {
      var variableLocationIDs = [],
         selectElm, variablesElt, index, summary, i, l;

      // Remove any previously added validations.
      selectElm = this.elements.select;
      selectElm.empty();

      this.locationIDs = {};

      variablesElt = this.context.script.getChildWithTag(this.context.element,
         'variables');
      if (variablesElt == null) {
         this.variables = [];
      }
      else {
         this.variables = Array.prototype.filter.call(
            variablesElt.getElementsByTagName('variable'),
            this.isVariable,
            this);
         index = this.variables.length;
         while (index !== 0) {
            --index;
            summary = this.getVariableDescription(this.variables[index]);
            selectElm
               .prepend($(document.createElement('option'))
               .text(summary)
               .attr('title', summary)
               .attr('value', String(index)));

            variableLocationIDs = this.getLocationIDs(this.variables[index]);
            if (variableLocationIDs.length) {
               for (i = 0, l = variableLocationIDs.length; i < l; i++) {
                  this.locationIDs[variableLocationIDs[i]] = true;
               }
            }
         }
      }

      this.enableControls();
   },

   /**
    * Determine whether an element represents a variable
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Element} aVariable The variable element from the script.
    * @return {boolean} true if aValidation represents a script variable.
    */
   isVariable: function (aVariable) {
      return aVariable.getAttribute('type') ===
         this.context.constants.VARIABLE_TYPE;
   },

   /**
    * Get a user-oriented one-line description of the variable.
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Element} aVariable The variable element from the script.
    * @return {string} The description.
    */
   getVariableDescription: function (aVariable) {
      var description = '',
         varName, varValue;

      if (aVariable.getAttribute("type") == 1 && Number(aVariable.getAttribute("seq"))) {
         varName = this.context.script.domTreeGetVariableParam(aVariable, "varname");
         varValue = this.context.script.domTreeGetVariableParam(aVariable, "vartext");
         if (varName && varValue) {
            description = varName + ': ' + this.context.variableUtils.getVariableDescription(varValue);
         }
      }

      return description;
   },

   /**
    * Get an array of all location IDs specified in the variable
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Element} aVariable
    * @returns {Array} Found location IDs
    */
   getLocationIDs: function (aVariable) {
      var locationIDs = [],
         strVariable, tokens, token, i, l;

      if (aVariable.getAttribute("type") == 1 && Number(aVariable.getAttribute("seq"))) {
         strVariable = this.context.script.domTreeGetVariableParam(aVariable, "vartext");

         if (strVariable) {
            tokens = strVariable.split(this.context.constants.DC_SEPARATOR_TOKENS);

            if (tokens.length) {
               for (i = 0, l = tokens.length; i < l; i++) {
                  token = tokens[i].split(this.context.constants.DC_SEPARATOR_TOKENPARAMS);

                  if (token[1] !== '') {
                     locationIDs.push(token[1]);
                  }
               }
            }
         }
      }

      return locationIDs;
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to replace location ID in all existing variables
    * with another one.
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Event} aEvent A jQuery click event on the add variable icon.
    */
   replaceLocationID: function (aEvent) {
      try {
         if (!this.elements.replaceLocationID.hasClass('inactive')) {
            this.context.openDialog('ui/content/dejaVariableReplaceLocationID.html',
               {locationIDs: Object.keys(this.locationIDs)},
               this.refresh.bind(this));
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new script variable.
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Event} aEvent A jQuery click event on the add variable icon.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaVariable.html',
            {
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected script variable.
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Event} aEvent A jQuery click event on the edit variable icon.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.variables.length)) {
               this.context.openDialog('ui/content/dejaVariable.html',
                  {
                     item: this.variables[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Select the edited script variable.
    * @this {DejaClickUi.VariablesProperty}
    * @param {?Element} aVariable The newly defined variable element
    *    (or null if the add variable dialog was canceled).
    */
   completeEdit: function (aVariable) {
      var index, select, option;
      try {
         if (aVariable !== null) {
            this.context.syncPropertyChange('variables');
            //index = this.variables.indexOf(aVariable);
            //select = this.elements.select;
            //select.prop('selectedIndex', index);
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the currently selected script variable.
    * @this {DejaClickUi.VariablesProperty}
    * @param {!Event} aEvent A jQuery click event on the edit variable icon.
    */
   remove: function (aEvent) {
      var selected, index, variable, variablesElt, script;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.variables.length)) {
               variable = this.variables[index];
               variablesElt = variable.parentNode;
               script = this.context.script;
               script.domTreeRemoveNode(variable);
               if (variablesElt.firstElementChild == null) {
                  script.domTreeRemoveNode(variablesElt);
               } else {
                  script.renumberElements('variable');
               }
               this.refresh();
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.VariablesProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.VariablesProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.VariablesProperty}
    */
   enableControls: function (aEvent) {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);

         if (Object.keys(this.locationIDs).length)  {
            this.elements.replaceLocationID.removeClass('inactive');
         } else {
            this.elements.replaceLocationID.addClass('inactive');
         }
      }
   }
};


/**
 * Property allowing configuration of custom HTTP request headers.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.HeadersProperty = function (aContext) {
   this.context = aContext;

   this.headers = [];

   this.elements = {
      select: $('#headersList'),
      add: $('#headersAdd'),
      edit: $('#headersEdit'),
      remove: $('#headersRemove'),
      allButtons: $('#headersSection').find('button')
   };

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.HeadersProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.HeadersProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.HeadersProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.headers;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.HeadersProperty}
    */
   refresh: function () {
      var select, script, index, header, name, value, format, summary;

      // Remove any previously added headers.
      select = this.elements.select;
      select.empty();

      // Find the header script elements.
      this.headers = Array.prototype.filter.call(
         this.context.element.getElementsByTagName('header'),
         this.isRequestHeader,
         this);

      script = this.context.script;
      index = this.headers.length;
      while (index !== 0) {
         --index;
         header = this.headers[index];
         name = script.domTreeGetHeaderParam(header, 'headername');
         if (name == null) {
            name = '';
         }
         value = script.domTreeGetHeaderParam(header, 'headertext');
         if (value == null) {
            value = '';
         }
         if (script.domTreeGetHeaderParam(header, 'mergetype') ===
               this.context.constants.HEADER_MERGE) {
            format = 'deja_properties_headerMergeFormat';
         } else {
            format = 'deja_properties_headerReplaceFormat';
         }
         summary = this.context.getMessage(format, [ name, value ]);

         select.prepend($(document.createElement('option')).
            text(summary).
            attr('title', summary).
            attr('value', String(index)));
      }

      this.enableControls();
   },

   /**
    * Determine whether a script header represents a request header.
    * @this {DejaClickUi.HeadersProperty}
    * @param {!Element} aHeaderElt A header element.
    * @return {boolean} true if the element represents a request header.
    */
   isRequestHeader: function (aHeaderElt) {
      return aHeaderElt.getAttribute('type') ===
         this.context.constants.HEADERTYPE_REQUEST;
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.HeadersProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new custom header.
    * @this {DejaClickUi.HeadersProperty}
    * @param {!Event} aEvent A jQuery click event on the add header button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaHeader.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected custom header.
    * @this {DejaClickUi.HeadersProperty}
    * @param {!Event} aEvent A jQuery click event on the edit header button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.headers.length)) {
               this.context.openDialog('ui/content/dejaHeader.html',
                  {
                     context: this.context.element,
                     item: this.headers[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a header has been added or edited.
    * @this {DejaClickUi.HeadersProperty}
    * @param {?Element} aHeader The added or edited header element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aHeader) {
      try {
         if (aHeader !== null) {
            this.context.syncPropertyChange('headers');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected custom header.
    * @this {DejaClickUi.HeadersProperty}
    * @param {!Event} aEvent A jQuery click event on the remove header button.
    */
   remove: function (aEvent) {
      var selected, index, header, headers;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.headers.length)) {
               header = this.headers[index];
               headers = header.parentNode;
               this.context.script.domTreeRemoveNode(header);
               if (this.headers.length === 1) {
                  this.context.script.domTreeRemoveNode(headers);
               } else {
                  this.context.script.renumberElements('header');
               }
            }
            this.context.syncPropertyChange('headers');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.HeadersProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.HeadersProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.HeadersProperty}
    */
   enableControls: function () {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);
      }
   }
};


/**
 * Property allowing configuration of URLs to block or ignore.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.UrlExclusionsProperty = function (aContext) {
   this.context = aContext;

   this.urlMasks = [];

   this.elements = {
      select: $('#urlMasksList'),
      add: $('#urlMasksAdd'),
      edit: $('#urlMasksEdit'),
      remove: $('#urlMasksRemove'),
      allButtons: $('#urlMasksSection').find('button')
   };

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.UrlExclusionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.UrlExclusionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.UrlExclusionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.urlMasks;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.UrlExclusionsProperty}
    */
   refresh: function () {
      var select, script, constants, index, urlMask, text, type, style, summary;

      // Remove any previously added urlmasks.
      select = this.elements.select;
      select.empty();

      // Find the urlmask script elements.
      this.urlMasks = Array.prototype.slice.call(
         this.context.element.getElementsByTagName('urlmask'), 0);

      script = this.context.script;
      constants = this.context.constants;
      index = this.urlMasks.length;
      while (index !== 0) {
         --index;
         urlMask = this.urlMasks[index];

         text = script.domTreeGetUrlMaskParam(urlMask, 'matchtext');
         if (text == null) {
            text = '';
         }

         switch (urlMask.getAttribute('type')) {
         case constants.URLMASK_TYPE_IGNORE:
            type = this.context.getMessage('deja_properties_urlMaskIgnore');
            break;
         case constants.URLMASK_TYPE_BLOCK:
            type = this.context.getMessage('deja_properties_urlMaskBlock');
            break;
         default:
            type = '';
            break;
         }

         if (script.domTreeGetUrlMaskParam(urlMask, 'matchtype') ===
               constants.URLMASK_STYLE_PLAINTEXT) {
            style = this.context.getMessage('deja_properties_urlMaskPlain');
         } else {
            style = this.context.getMessage('deja_properties_urlMaskRegExp');
         }

         summary = this.context.getMessage('deja_properties_urlMaskSummary',
            [ text, type, style ]);

         select.prepend($(document.createElement('option')).
            text(summary).
            attr('title', summary).
            attr('value', String(index)));
      }

      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.UrlExclusionsProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new URL exclusion.
    * @this {DejaClickUi.UrlExclusionsProperty}
    * @param {!Event} aEvent A jQuery click event on the add URL mask button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaUrlMask.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected URL exclusion
    * @this {DejaClickUi.UrlExclusionsProperty}
    * @param {!Event} aEvent A jQuery click event on the edit URL mask button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.urlMasks.length)) {
               this.context.openDialog('ui/content/dejaUrlMask.html',
                  {
                     context: this.context.element,
                     item: this.urlMasks[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a URL exclusion has been added or edited.
    * @this {DejaClickUi.UrlExclusionsProperty}
    * @param {?Element} aUrlMask The added or edited urlmask element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aUrlMask) {
      try {
         if (aUrlMask !== null) {
            this.context.syncPropertyChange('urlMasks');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected URL exclusion from the script.
    * @this {DejaClickUi.UrlExclusionsProperty}
    * @param {!Event} aEvent A jQuery click event on the remove URL mask button.
    */
   remove: function (aEvent) {
      var selected, index, urlMask, urlMasks;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.urlMasks.length)) {
               urlMask = this.urlMasks[index];
               urlMasks = urlMask.parentNode;
               this.context.script.domTreeRemoveNode(urlMask);
               if (this.urlMasks.length === 1) {
                  this.context.script.domTreeRemoveNode(urlMasks);
               } else {
                  this.context.script.renumberElements('urlmask');
               }
            }
            this.context.syncPropertyChange('urlMasks');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.UrlExclusionsProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.UrlExclusionsProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.UrlExclusionsProperty}
    */
   enableControls: function () {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);
      }
   }
};


/**
 * Property allowing configuration of ContentViews applicable to the
 * current context.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.ContentViewsProperty = function (aContext) {
   this.context = aContext;

   this.items = [];

   this.elements = {
      description: $('#contentViewsDescription'),
      select: $('#contentViewsList'),
      add: $('#contentViewsAdd'),
      edit: $('#contentViewsEdit'),
      remove: $('#contentViewsRemove'),
      allButtons: $('#contentViewsSection').find('button')
   };

   this.elements.select.on('change', this.enableControls.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.ContentViewsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ContentViewsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.ContentViewsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.items;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.ContentViewsProperty}
    */
   refresh: function () {
      var select, script, views, delim, scope, index, name;

      this.elements.description.text(this.context.getMessage(
         'deja_properties_contentViewsDescription_' + this.context.category));

      // Remove any previously added contentViews.
      select = this.elements.select;
      select.empty();

      // Find the contentview script elements.
      script = this.context.script;
      views = script.getScriptElement().getElementsByTagName('contentview');
      if (this.context.category === 'script') {
         this.items = Array.prototype.slice.call(views, 0);
      } else {
         // Only list ContentViews that apply to the current action or event.
         // @todo Use named constant for hashkey delimiter.
         scope = this.context.context.split(':');
         this.items = Array.prototype.filter.call(views,
            this.doesViewApplyToContext.bind(this, scope[0],
               ((scope.length > 2) ? scope[2] : '0'),
               this.context.category + 'scope'));
      }

      index = this.items.length;
      while (index !== 0) {
         --index;
         name = script.domTreeGetContentViewParam(this.items[index], 'cvname');
         select.prepend($(document.createElement('option')).
            text(name).
            attr('title', name).
            attr('value', String(index)));
      }

      this.enableControls();
   },

   /**
    * Determine whether a ContentView applies to a given scope.
    * @param {string} aScopeNum The scope in question. The sequence number
    *    of the current action or event.
    * @param {string} aScriptNum The sequence number of the script to
    *    which the action or event belongs ('0' for the main script).
    * @param {string} aScopeName Name of the ContentView parameter
    *    defining the set of scopes for the current category (i.e.,
    *    'eventscope' or 'actionscope).
    * @param {!Element} aView The contentview element in question.
    * @return {boolean} true if the current context is in the scope
    *    of the ContentView.
    */
   doesViewApplyToContext: function (aScopeNum, aScriptNum, aScopeName, aView) {
      var scope, scopes, index, parts;

      scope = this.context.script.domTreeGetContentViewParam(aView, aScopeName);
      if (scope !== null) {
         scopes = scope.split(this.context.constants.CONTENTVIEW_SCOPE_DELIMITER);
         index = scopes.length;
         while (index !== 0) {
            --index;
            parts = scopes[index].split(this.context.constants.CONTENTVIEW_SCOPE_ITEM_DELIMITER);
            if (parts[0] === aScopeNum) {
               if (parts.length <= 2) {
                  if (aScriptNum === '0') {
                     return true;
                  }
               } else if (parts[2] === aScriptNum) {
                  return true;
               }
            }
         }
      }
      return false;
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new ContentView.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {!Event} aEvent A jQuery click event on the add ContentView button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaContentView.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected ContentView.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {!Event} aEvent A jQuery click event on the edit
    *    ContentView button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.items.length)) {
               this.context.openDialog('ui/content/dejaContentView.html',
                  {
                     context: this.context.element,
                     item: this.items[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a ContentView has been added or edited.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {?Element} aView The added or edited contentview element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aView) {
      try {
         if (aView !== null) {
            this.context.syncPropertyChange('contentViews');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected ContentView. For action and event contexts,
    * only remove the current action or event from the scope of the
    * ContentView.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {!Event} aEvent A jQuery click event on the remove ContentView
    *    button.
    */
   remove: function (aEvent) {
      var selected, index, contentView, contentViews;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.items.length)) {
               contentView = this.items[index];
               if (this.context.category === 'script') {
                  // Remove the contentview element.
                  contentViews = contentView.parentNode;
                  this.context.script.domTreeRemoveNode(contentView);
                  if (this.items.length === 1) {
                     this.context.script.domTreeRemoveNode(contentViews);
                  } else {
                     this.context.script.renumberElements('contentview');
                  }

               } else {
                  // Remove the current context from the ContentView's scope.
                  this.removeContextFromScope(contentView);
               }
            }
            this.context.syncPropertyChange('contentViews');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the current context from the scope of a ContentView.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {!Element} aView The contentview element to be modified.
    */
   removeContextFromScope: function (aView) {
      var script, constants, scopeName, viewScope, viewItems,
         context, contextNum, scriptNum, delim, index, parts;

      script = this.context.script;
      constants = this.context.constants;
      scopeName = this.context.category + 'scope';
      viewScope = script.domTreeGetContentViewParam(aView, scopeName);
      if (viewScope !== null) {
         viewItems = viewScope.split(constants.CONTENTVIEW_SCOPE_DELIMITER);
         // @todo Use named constant for hashkey delimiter.
         context = this.context.context.split(':');
         contextNum = context[0];
         scriptNum = (context.length > 2) ? context[2] : '0';
         delim = constants.CONTENTVIEW_SCOPE_ITEM_DELIMITER;
         index = viewItems.length;
         while (index !== 0) {
            --index;
            parts = viewItems[index].split(delim);
            if (parts[0] === contextNum) {
               if (parts.length <= 2) {
                  if (scriptNum === '0') {
                     viewItems.splice(index, 1);
                     break;
                  }
               } else if (parts[2] === scriptNum) {
                  viewItems.splice(index, 1);
                  break;
               }
            }
         }
         script.domTreeSetContentViewParam(aView, scopeName,
            viewItems.join(constants.CONTENTVIEW_SCOPE_DELIMITER));
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.ContentViewsProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.ContentViewsProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.ContentViewsProperty}
    */
   enableControls: function () {
      var selection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         selection = this.elements.select.prop('selectedOptions');
         if (selection.length === 0) {
            this.elements.edit.button('option', 'disabled', true);
            this.elements.remove.button('option', 'disabled', true);
         } else {
            this.elements.edit.button('option', 'disabled', false);
            this.elements.remove.button('option', 'disabled',
               (this.context.category === 'script') &&
               this.isViewReferenced(selection[0].textContent));
         }
      }
   },

   /**
    * Determine whether a ContentView is referenced by another ContentView.
    * @this {DejaClickUi.ContentViewsProperty}
    * @param {string} aViewName The name of the ContentView which may be
    *    referenced.
    * @return {boolean} true if there is a ContentView that references the
    *    named ContentView.
    */
   isViewReferenced: function (aViewName) {
      var constants, script, needle, index, definition;
      constants = this.context.constants;
      script = this.context.script;
      needle = constants.CONTENTVIEW_DEFINITION_REFERENCES +
         constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER +
         aViewName + constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER;
      index = this.items.length;
      while (index !== 0) {
         --index;
         definition = script.domTreeGetContentViewParam(this.items[index],
            'definition');
         if ((definition !== null) && (definition.indexOf(needle) !== -1)) {
            return true;
         }
      }
      return false;
   }
};


/**
 * Property allowing configuration of branching rules.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.BranchesProperty = function (aContext) {
   this.context = aContext;

   this.branches = [];

   this.elements = {
      description: $('#branchesDescription'),
      select: $('#branchesList'),
      add: $('#branchesAdd'),
      edit: $('#branchesEdit'),
      remove: $('#branchesRemove'),
      allButtons: $('#branchesSection').find('button')
   };

   this.elements.select.on('change', this.changeSelection.bind(this));
   this.elements.select.on('dblclick', this.edit.bind(this));
   this.elements.add.button().on('click', this.add.bind(this));
   this.elements.edit.button().on('click', this.edit.bind(this));
   this.elements.remove.button().on('click', this.remove.bind(this));
};

DejaClickUi.BranchesProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.BranchesProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.BranchesProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.select.off('change dblclick');
      }
      delete this.elements;
      delete this.branches;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.BranchesProperty}
    */
   refresh: function () {
      var select, branchesElt, index, summary;

      this.elements.description.text(this.context.getMessage(
         'deja_properties_branchesDescription_' + this.context.category));

      // Remove any previously added branches.
      select = this.elements.select;
      select.empty();

      // Find the branch script elements.
      branchesElt = this.context.script.getChildWithTag(this.context.element,
         'branches');
      if (branchesElt == null) {
         this.branches = [];
      } else {
         this.branches = Array.prototype.slice.call(
            branchesElt.getElementsByTagName('branch'), 0);
         index = this.branches.length;
         while (index !== 0) {
            --index;
            summary = this.getBranchDescription(this.branches[index]);
            select.prepend($(document.createElement('option')).
               text(summary).
               attr('title', summary).
               attr('value', String(index)));
         }
      }
      this.enableControls();
   },

   /**
    * Get a user-oriented one-line description of the branching rule.
    * @this {DejaClickUi.BranchesProperty}
    * @param {!Element} aBranch The branch element from the script.
    * @return {string} The description.
    */
   getBranchDescription: function (aBranch) {
      var script, constants, getMessage,
         name, condition, conditionText, target, targetText;

      script = this.context.script;
      constants = this.context.constants;
      getMessage = this.context.getMessage;

      name = script.domTreeGetBranchParam(aBranch, 'name');
      if (name == null) {
         name = '';
      }

      condition = script.domTreeGetBranchParam(aBranch, 'condition');
      if (condition == null) {
         condition = [];
      } else {
         condition = condition.split(constants.BRANCH_CONDITION_DELIMITER);
      }
      conditionText = '';

      switch (condition[0]) {
         case constants.BRANCH_CONDITION_ALWAYS:
            conditionText = getMessage('deja_properties_branchesAlways');
            break;

         case constants.BRANCH_CONDITION_NEVER:
            conditionText = getMessage('deja_properties_branchesNever');
            break;

         case constants.BRANCH_CONDITION_REPLAYSTATUS:
            conditionText = getMessage('deja_properties_branchesStatus' +
               condition[1]);
            break;

         case constants.BRANCH_CONDITION_REPLAYSTATUSNOT:
            conditionText = getMessage('deja_properties_branchesStatusNot' +
               condition[1]);
            break;
      }

      if (conditionText.length === 0) {
         conditionText = getMessage('deja_properties_branchesConditionUnknown');
      }

      target = script.domTreeGetBranchParam(aBranch, 'target');
      if (target == null) {
         target = [];
      } else {
         target = target.split(constants.BRANCH_TARGET_DELIMITER);
      }

      targetText = '';
      if (target[1] === constants.BRANCH_TARGET_END) {
         targetText = getMessage('deja_properties_branchesEndReplay');
      } else if ((target.length <= 2) || (target[2] === '0')) {
         targetText = getMessage('deja_properties_branchesMainScript_' +
            target[1], target[0]);
      } else {
         targetText = getMessage('deja_properties_branchesSubscript_' +
            target[1], [ target[0], target[2] ]);
      }
      if (targetText.length === 0) {
         targetText = getMessage('deja_properties_branchesTargetUnknown');
      }

      return getMessage('deja_properties_branchesSummary',
         [ name, conditionText, targetText ]);
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.BranchesProperty}
    * @param {!Event} aEvent A jQuery change event on the select element.
    */
   changeSelection: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a branching rule.
    * @this {DejaClickUi.BranchesProperty}
    * @param {!Event} aEvent A jQuery click event on the add rule button.
    */
   add: function (aEvent) {
      try {
         this.context.openDialog('ui/content/dejaBranch.html',
            {
               context: this.context.element,
               item: null
            },
            this.completeEdit.bind(this));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to edit the selected branching rule.
    * @this {DejaClickUi.BranchesProperty}
    * @param {!Event} aEvent A jQuery click event on the edit rule button.
    */
   edit: function (aEvent) {
      var selected, index;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.branches.length)) {
               this.context.openDialog('ui/content/dejaBranch.html',
                  {
                     context: this.context.element,
                     item: this.branches[index]
                  },
                  this.completeEdit.bind(this));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Refresh the property after a branching rule has been added or edited.
    * @this {DejaClickUi.BranchesProperty}
    * @param {?Element} aBranch The added or edited branching rule element,
    *    or null if the operation was canceled.
    */
   completeEdit: function (aBranch) {
      try {
         if (aBranch !== null) {
            this.context.syncPropertyChange('branches');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the selected branching rule.
    * @this {DejaClickUi.BranchesProperty}
    * @param {!Event} aEvent A jQuery click event on the remove rule button.
    */
   remove: function (aEvent) {
      var selected, index, branch, branchesElt, script, branches, ordinal;
      try {
         selected = this.elements.select.prop('selectedOptions');
         if (selected.length !== 0) {
            index = Number(selected[0].getAttribute('value'));
            if ((0 <= index) && (index < this.branches.length)) {
               branch = this.branches[index];
               branchesElt = branch.parentNode;
               script = this.context.script;
               script.domTreeRemoveNode(branch);
               if (this.branches.length === 1) {
                  script.domTreeRemoveNode(branchesElt);
               } else {
                  // Update the sort order of the branches in this context.
                  branches = branchesElt.getElementsByTagName('branch');
                  for (ordinal = branches.length; ordinal !== 0; --ordinal) {
                     branches[ordinal - 1].setAttribute('ordinal',
                        String(ordinal));
                  }
               }
               script.renumberElements('branch');
            }
            this.context.syncPropertyChange('branches');
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values. Does nothing.
    * @this {DejaClickUi.BranchesProperty}
    */
   reset: function () { },

   /**
    * Apply the changes made in the UI. Does nothing.
    * @this {DejaClickUi.BranchesProperty}
    */
   apply: function () { },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.BranchesProperty}
    */
   enableControls: function () {
      var noSelection;
      if (!this.context.controlsEnabled) {
         this.elements.select.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.select.removeAttr('disabled');
         this.elements.add.button('option', 'disabled', false);
         noSelection = (this.elements.select.prop('selectedIndex') === -1);
         this.elements.edit.button('option', 'disabled', noSelection);
         this.elements.remove.button('option', 'disabled', noSelection);
      }
   }
};


/**
 * Property enabling simulation of a new visitor to websites during replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.NewVisitorProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#newVisitorSection'),
      enable: $('#newVisitorEnable'),
      hideCookies: $('#newVisitorHideCookies'),
      clearBrowser: $('#newVisitorClearBrowser'),
      clearPasswords: $('#newVisitorClearPasswords'),
      clearFormData: $('#newVisitorClearFormData'),
      clearCertificates: $('#newVisitorClearCertificates'),
      clearLocalStorage: $('#newVisitorClearLocalStorage'),
      clearFileSystems: $('#newVisitorClearFileSystems'),
      clearAppCache: $('#newVisitorClearAppCache'),
      clearIndexedDb: $('#newVisitorClearIndexedDb'),
      clearWebSql: $('#newVisitorClearWebSql'),
      clearPluginData: $('#newVisitorClearPluginData'),
      reset: $('#newVisitorReset'),
      apply: $('#newVisitorApply'),
      allOptions: $('#newVisitorOptions').find('input'),
      allButtons: $('#newVisitorReset,#newVisitorApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.advancedOnly = this.elements.section.find('.advancedOnly');

   this.elements.enable.on('change', this.enableNewVisitor.bind(this));
   this.elements.allOptions.on('change', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.NewVisitorProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.NewVisitorProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.NewVisitorProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.NewVisitorProperty}
    */
   refresh: function () {
      this.elements.enable.prop('checked',
         this.context.getPreference('DC_OPTID_USENEWVISITOR'));
      this.elements.hideCookies.prop('checked',
         this.context.getPreference('DC_OPTID_HIDECOOKIES'));
      this.elements.clearBrowser.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARWEBCACHE'));
      this.elements.clearPasswords.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARPASSWORDS'));
      this.elements.clearFormData.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARFORMDATA'));
      this.elements.clearCertificates.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARCERTIFICATES'));
      this.elements.clearLocalStorage.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARLOCALSTORAGE'));
      this.elements.clearFileSystems.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARFILESYSTEMS'));
      this.elements.clearAppCache.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARAPPCACHE'));
      this.elements.clearIndexedDb.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARINDEXEDDB'));
      this.elements.clearWebSql.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARWEBSQL'));
      this.elements.clearPluginData.prop('checked',
         this.context.getPreference('DC_OPTID_CLEARPLUGINDATA'));

      this.elements.advancedOnly.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);

      // Enable the correct controls.
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_USENEWVISITOR',
            'DC_OPTID_HIDECOOKIES',
            'DC_OPTID_CLEARWEBCACHE',
            'DC_OPTID_CLEARPASSWORDS',
            'DC_OPTID_CLEARFORMDATA',
            'DC_OPTID_CLEARCERTIFICATES',
            'DC_OPTID_CLEARLOCALSTORAGE',
            'DC_OPTID_CLEARFILESYSTEMS',
            'DC_OPTID_CLEARAPPCACHE',
            'DC_OPTID_CLEARINDEXEDDB',
            'DC_OPTID_CLEARWEBSQL',
            'DC_OPTID_CLEARPLUGINDATA'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed. Always enable the
    * appropriate controls.
    * @this {DejaClickUi.NewVisitorProperty}
    * @param {!Event} aEvent A jQuery change event on the enable checkbox.
    */
   enableNewVisitor: function (aEvent) {
      try {
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.NewVisitorProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.NewVisitorProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USENEWVISITOR');
         this.context.resetPreference('DC_OPTID_HIDECOOKIES');
         this.context.resetPreference('DC_OPTID_CLEARWEBCACHE');
         this.context.resetPreference('DC_OPTID_CLEARPASSWORDS');
         this.context.resetPreference('DC_OPTID_CLEARFORMDATA');
         this.context.resetPreference('DC_OPTID_CLEARCERTIFICATES');
         this.context.resetPreference('DC_OPTID_CLEARLOCALSTORAGE');
         this.context.resetPreference('DC_OPTID_CLEARFILESYSTEMS');
         this.context.resetPreference('DC_OPTID_CLEARAPPCACHE');
         this.context.resetPreference('DC_OPTID_CLEARINDEXEDDB');
         this.context.resetPreference('DC_OPTID_CLEARWEBSQL');
         this.context.resetPreference('DC_OPTID_CLEARPLUGINDATA');

         this.context.syncPropertyChange('newVisitor');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.NewVisitorProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setPreference('DC_OPTID_USENEWVISITOR',
            this.elements.enable.prop('checked'));
         this.context.setPreference('DC_OPTID_HIDECOOKIES',
            this.elements.hideCookies.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARWEBCACHE',
            this.elements.clearBrowser.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARPASSWORDS',
            this.elements.clearPasswords.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARFORMDATA',
            this.elements.clearFormData.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARCERTIFICATES',
            this.elements.clearCertificates.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARLOCALSTORAGE',
            this.elements.clearLocalStorage.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARFILESYSTEMS',
            this.elements.clearFileSystems.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARAPPCACHE',
            this.elements.clearAppCache.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARINDEXEDDB',
            this.elements.clearIndexedDb.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARWEBSQL',
            this.elements.clearWebSql.prop('checked'));
         this.context.setPreference('DC_OPTID_CLEARPLUGINDATA',
            this.elements.clearPluginData.prop('checked'));

         this.context.syncPropertyChange('newVisitor');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.NewVisitorProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.enable.removeAttr('disabled');
         if (this.elements.enable.prop('checked')) {
            this.elements.allOptions.removeAttr('disabled');
         } else {
            this.elements.allOptions.attr('disabled', 'true');
         }
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling whether all popups and cookies are blocked
 * during record and replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.BlockOptionsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#blockOptionsSection'),
      popups: $('#blockOptionsPopups'),
      cookies: $('#blockOptionsCookies'),
      reset: $('#blockOptionsReset'),
      apply: $('#blockOptionsApply')
   };

   this.elements.popups.on('change', this.changeValue.bind(this));
   this.elements.cookies.on('change', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.BlockOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.BlockOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.BlockOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.apply.off('click').button('destroy');
         this.elements.reset.off('click').button('destroy');
         this.elements.cookies.off('change');
         this.elements.popups.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.BlockOptionsProperty}
    */
   refresh: function () {
      this.elements.popups.prop('checked',
         this.context.getPreference('DC_OPTID_DISABLEPOPUPS'));
      this.elements.cookies.prop('checked',
         this.context.getPreference('DC_OPTID_DISABLECOOKIES'));
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [ 'DC_OPTID_DISABLEPOPUPS', 'DC_OPTID_DISABLECOOKIES' ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.BlockOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.BlockOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_DISABLEPOPUPS');
         this.context.resetPreference('DC_OPTID_DISABLECOOKIES');
         this.context.syncPropertyChange('blockOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.BlockOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setPreference('DC_OPTID_DISABLEPOPUPS',
            this.elements.popups.prop('checked'));
         this.context.setPreference('DC_OPTID_DISABLECOOKIES',
            this.elements.cookies.prop('checked'));
         this.context.syncPropertyChange('blockOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.BlockOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.popups.attr('disabled', 'true');
         this.elements.cookies.attr('disabled', 'true');
         this.elements.reset.button('option', 'disabled', true);
         this.elements.apply.button('option', 'disabled', true);
      } else {
         this.elements.popups.removeAttr('disabled');
         this.elements.cookies.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling whether tab/window switching is handled
 * during record and replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.BrowserOptionsProperty = function (aContext) {
   var section;

   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#browserOptionsSection'),
      winTabOpen: $('#browserOptionsWinTabOpen'),
      winTabClose: $('#browserOptionsWinTabClose'),
      history: $('#browserOptionsBrowseHistory'),
      blockSwitch: $('#browserOptionsBlockSwitch'),
      reset: $('#browserOptionsReset'),
      apply: $('#browserOptionsApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.allInputs.on('change', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.BrowserOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.BrowserOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.BrowserOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.BrowserOptionsProperty}
    */
   refresh: function () {
      this.elements.winTabOpen.prop('checked',
         this.context.getPreference('DC_OPTID_RECWINTABOPEN'));
      this.elements.winTabClose.prop('checked',
         this.context.getPreference('DC_OPTID_RECWINTABCLOSE'));
      this.elements.history.prop('checked',
         this.context.getPreference('DC_OPTID_RECBROWSEHISTORY'));
      this.elements.blockSwitch.prop('checked',
         this.context.getPreference('DC_OPTID_BLOCKTABSWITCH'));
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_RECWINTABOPEN',
            'DC_OPTID_RECWINTABCLOSE',
            'DC_OPTID_RECBROWSEHISTORY',
            'DC_OPTID_BLOCKTABSWITCH'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.BrowserOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values for
    * the context. For some properties this may be a noop.
    * @this {DejaClickUi.BrowserOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_RECWINTABOPEN');
         this.context.resetPreference('DC_OPTID_RECWINTABCLOSE');
         this.context.resetPreference('DC_OPTID_RECBROWSEHISTORY');
         this.context.resetPreference('DC_OPTID_BLOCKTABSWITCH');
         this.context.syncPropertyChange('browserOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI to the context.
    * @this {DejaClickUi.BrowserOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setPreference('DC_OPTID_RECWINTABOPEN',
            this.elements.winTabOpen.prop('checked'));
         this.context.setPreference('DC_OPTID_RECWINTABCLOSE',
            this.elements.winTabClose.prop('checked'));
         this.context.setPreference('DC_OPTID_RECBROWSEHISTORY',
            this.elements.history.prop('checked'));
         this.context.setPreference('DC_OPTID_BLOCKTABSWITCH',
            this.elements.blockSwitch.prop('checked'));
         this.context.syncPropertyChange('browserOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.BrowserOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling whether all focus events are recorded.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.InputOptionsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#inputOptionsSection'),
      input: $('#inputOptionsForceFocus'),
      reset: $('#inputOptionsReset'),
      apply: $('#inputOptionsApply')
   };

   this.elements.input.on('change', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.InputOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.InputOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.InputOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.apply.off('click').button('destroy');
         this.elements.reset.off('click').button('destroy');
         this.elements.input.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.InputOptionsProperty}
    */
   refresh: function () {
      this.elements.input.prop('checked',
         this.context.getPreference('DC_OPTID_RECORDFOCUSEVENTS'));
      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [ 'DC_OPTID_RECORDFOCUSEVENTS' ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.InputOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.InputOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_RECORDFOCUSEVENTS');
         this.context.syncPropertyChange('inputOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.InputOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setPreference('DC_OPTID_RECORDFOCUSEVENTS',
            this.elements.input.prop('checked'));
         this.context.syncPropertyChange('inputOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.InputOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.input.attr('disabled', 'true');
         this.elements.reset.button('option', 'disabled', true);
         this.elements.apply.button('option', 'disabled', true);
      } else {
         this.elements.input.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling special processing for flash objects.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.FlashOptionsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#flashOptionsSection'),
      hide: $('#flashOptionsHide'),
      wmode: $('#flashOptionsWmode'),
      override: $('#flashOptionsOverride'),
      delay: $('#flashOptionsDelay'),
      wmodeOnly: $('.flashOptionsWmodeOnly'),
      reset: $('#flashOptionsReset'),
      apply: $('#flashOptionsApply')
   };

   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.hide.on('change', this.changeValue.bind(this));
   this.elements.wmode.on('change', this.toggleOverride.bind(this));
   this.elements.override.on('change', this.changeValue.bind(this));
   this.elements.delay.on('input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.FlashOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.FlashOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.FlashOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.FlashOptionsProperty}
    */
   refresh: function () {
      this.elements.hide.prop('checked',
         this.context.getPreference('DC_OPTID_HIDEFLASH'));
      this.elements.wmode.prop('checked',
         this.context.getPreference('DC_OPTID_FIXFLASHWMODE'));

      this.elements.override.prop('selectedIndex', -1);
      this.elements.override.find('option[value="' +
         this.context.getPreference('DC_OPTID_WMODEOVERRIDE') + '"]').
         prop('selected', true);

      this.elements.delay.val(String(
         this.context.getPreference('DC_OPTID_WMODETIMEOUT')));

      this.elements.wmodeOnly.toggle(this.elements.wmode.prop('checked'));

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_HIDEFLASH',
            'DC_OPTID_FIXFLASHWMODE',
            'DC_OPTID_WMODEOVERRIDE',
            'DC_OPTID_WMODETIMEOUT'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Show or hide the elements to configure how to override the WMODE
    * property of flash objects.
    * @this {DejaClickUi.FlashOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on the enable WMODE
    *    override checkbox.
    */
   toggleOverride: function (aEvent) {
      try {
         this.elements.wmodeOnly.toggle(this.elements.wmode.prop('checked'));
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.FlashOptionsProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.FlashOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_HIDEFLASH');
         this.context.resetPreference('DC_OPTID_FIXFLASHWMODE');
         this.context.resetPreference('DC_OPTID_WMODEOVERRIDE');
         this.context.resetPreference('DC_OPTID_WMODETIMEOUT');
         this.context.syncPropertyChange('flashOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.FlashOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var timeout;
      try {
         // Only apply this property if the frame containing this Properties
         // page is visible. This prevents a conflict between the replay
         // and record versions of the property on the options page.
         if (!$(window.frameElement).is(':visible')) {
            return;
         }

         timeout = Number(this.elements.delay.val());
         if (!this.context.validate('DC_OPTID_WMODETIMEOUT', timeout)) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }

         this.context.setPreference('DC_OPTID_HIDEFLASH',
            this.elements.hide.prop('checked'));
         this.context.setPreference('DC_OPTID_FIXFLASHWMODE',
            this.elements.wmode.prop('checked'));
         this.context.setPreference('DC_OPTID_WMODEOVERRIDE',
            this.elements.override.val());
         this.context.setPreference('DC_OPTID_WMODETIMEOUT', timeout);

         this.context.syncPropertyChange('flashOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.FlashOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling how location changes should be used during replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.LocationChangesProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#locationChangesSection'),
      enable: $('#locationChangesUse'),
      countDiv: $('#locationChangesCountDiv'),
      count: $('#locationChangesCount'),
      timeout: $('#locationChangesWait'),
      reset: $('#locationChangesReset'),
      apply: $('#locationChangesApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.allInputs.on('change input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.LocationChangesProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.LocationChangesProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.LocationChangesProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.LocationChangesProperty}
    */
   refresh: function () {
      this.elements.enable.prop('checked',
         this.context.getPreference('DC_OPTID_USELOCATIONHINTS'));
      this.elements.timeout.val(String(
         this.context.getPreference('DC_OPTID_LOCATIONTIMEOUT') / 1000));
      if (this.context.category === 'event') {
         this.elements.count.val(this.context.getReplayHint('locations'));
         this.elements.countDiv.show();
      } else {
         this.elements.countDiv.hide();
      }

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [ 'DC_OPTID_USELOCATIONHINTS', 'DC_OPTID_LOCATIONTIMEOUT' ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.LocationChangesProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue ||
               (aEvent.target.id === 'locationChangesUse')) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.LocationChangesProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USELOCATIONHINTS');
         this.context.resetPreference('DC_OPTID_LOCATIONTIMEOUT');
         this.context.syncPropertyChange('locationChanges');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.LocationChangesProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var timeout, isEvent, count;
      try {
         timeout = 1000 * this.elements.timeout.val();
         isEvent = (this.context.category === 'event');
         count = isEvent ? Number(this.elements.count.val()) : 0;

         // Validate the inputs.
         if (!this.context.validate('DC_OPTID_LOCATIONTIMEOUT', timeout) ||
               !((0 <= count) && (count <= 99))) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }

         // Ensure that event timeout is not less than the location timeout.
         if (this.context.getPreference('DC_OPTID_EVENTTIMEOUT') < timeout) {
            if (!window.confirm(this.context.getMessage(
                  'deja_properties_adjustEventTimeout'))) {
               return;
            }
            this.context.setPreference('DC_OPTID_EVENTTIMEOUT', timeout);
            this.context.syncPropertyChange('eventTimeout');
         }

         // Apply the changes.
         this.context.setPreference('DC_OPTID_USELOCATIONHINTS',
            this.elements.enable.prop('checked'));
         this.context.setPreference('DC_OPTID_LOCATIONTIMEOUT', timeout);
         if (isEvent) {
            this.context.setReplayHint('locations', count);
         }
         this.context.syncPropertyChange('locationChanges');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.LocationChangesProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         if (this.elements.enable.prop('checked')) {
            this.elements.allInputs.removeAttr('disabled');
         } else {
            this.elements.enable.removeAttr('disabled');
            this.elements.count.attr('disabled', 'true');
            this.elements.timeout.attr('disabled', 'true');
         }
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling how DOM mutations should affect replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.ContentChangesProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#contentChangesSection'),
      enable: $('#contentChangesUse'),
      settings: $('#contentChangesSettings'),
      startTime: $('#contentChangesStartTime'),
      stopTime: $('#contentChangesStopTime'),
      period: $('#contentChangesPeriod'),
      enableMinimum: $('#contentChangesUseMinimum'),
      minimum: $('#contentChangesMinimum'),
      reset: $('#contentChangesReset'),
      apply: $('#contentChangesApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.enable.on('change', this.enableContentChanges.bind(this));
   this.elements.startTime.on('input', this.changeValue.bind(this));
   this.elements.stopTime.on('input', this.changeValue.bind(this));
   this.elements.period.on('input', this.changeValue.bind(this));
   this.elements.enableMinimum.on('change', this.enableMinimum.bind(this));
   this.elements.minimum.on('input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.ContentChangesProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ContentChangesProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.ContentChangesProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.ContentChangesProperty}
    */
   refresh: function () {
      var minMutations;

      this.elements.enable.prop('checked',
         this.context.getPreference('DC_OPTID_USEMUTATIONHINTS'));
      this.elements.startTime.val(String(
         this.context.getPreference('DC_OPTID_MUTATIONBEGINTIMEOUT') / 1000));
      this.elements.stopTime.val(String(
         this.context.getPreference('DC_OPTID_MUTATIONENDTIMEOUT') / 1000));
      this.elements.period.val(String(
         this.context.getPreference('DC_OPTID_MUTATIONDELAY')));
      this.elements.enableMinimum.prop('checked',
         this.context.getPreference('DC_OPTID_USEMINMUTATIONS'));

      minMutations = (this.context.element == null) ? null :
         this.context.getReplayHint('mutations');
      if (this.context.hasPreference('DC_OPTID_MINMUTATIONS') ||
            (minMutations == null)) {
         minMutations = this.context.getPreference('DC_OPTID_MINMUTATIONS');
      }
      this.elements.minimum.val(String(minMutations));

      this.elements.settings.toggle(this.elements.enable.prop('checked'));

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_USEMUTATIONHINTS',
            'DC_OPTID_MUTATIONBEGINTIMEOUT',
            'DC_OPTID_MUTATIONENDTIMEOUT',
            'DC_OPTID_MUTATIONDELAY',
            'DC_OPTID_USEMINMUTATIONS',
            'DC_OPTID_MINMUTATIONS'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Enable or disable the use of content changes during replay.
    * Mark the property as changed.
    * @this {DejaClickUi.ContentChangesProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   enableContentChanges: function (aEvent) {
      try {
         this.elements.settings.toggle(this.elements.enable.prop('checked'));
         this.changeValue(aEvent);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the use of a minimum change count.
    * Mark the property as having been changed.
    * @this {DejaClickUi.ContentChangesProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   enableMinimum: function (aEvent) {
      try {
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.ContentChangesProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.ContentChangesProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USEMUTATIONHINTS');
         this.context.resetPreference('DC_OPTID_MUTATIONBEGINTIMEOUT');
         this.context.resetPreference('DC_OPTID_MUTATIONENDTIMEOUT');
         this.context.resetPreference('DC_OPTID_MUTATIONDELAY');
         this.context.resetPreference('DC_OPTID_USEMINMUTATIONS');
         this.context.resetPreference('DC_OPTID_MINMUTATIONS');
         this.context.syncPropertyChange('contentChanges');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.ContentChangesProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var startTime, stopTime, period, minChanges, maxTimeout;
      try {
         startTime = 1000 * this.elements.startTime.val();
         stopTime = 1000 * this.elements.stopTime.val();
         period = Number(this.elements.period.val());
         minChanges = Number(this.elements.minimum.val());

         if (!this.context.validate('DC_OPTID_MUTATIONBEGINTIMEOUT', startTime) ||
               !this.context.validate('DC_OPTID_MUTATIONENDTIMEOUT', stopTime) ||
               !this.context.validate('DC_OPTID_MUTATIONDELAY', period) ||
               !this.context.validate('DC_OPTID_MINMUTATIONS', minChanges)) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }

         // Ensure that event timeout is not less than the mutations timeouts.
         maxTimeout = (startTime < stopTime) ? stopTime : startTime;
         if (this.context.getPreference('DC_OPTID_EVENTTIMEOUT') < maxTimeout) {
            if (!window.confirm(this.context.getMessage(
                  'deja_properties_adjustEventTimeout'))) {
               return;
            }
            this.context.setPreference('DC_OPTID_EVENTTIMEOUT', maxTimeout);
            this.context.syncPropertyChange('eventTimeout');
         }

         // Apply the changes.
         this.context.setPreference('DC_OPTID_USEMUTATIONHINTS',
            this.elements.enable.prop('checked'));
         this.context.setPreference('DC_OPTID_MUTATIONBEGINTIMEOUT', startTime);
         this.context.setPreference('DC_OPTID_MUTATIONENDTIMEOUT', stopTime);
         this.context.setPreference('DC_OPTID_MUTATIONDELAY', period);
         this.context.setPreference('DC_OPTID_USEMINMUTATIONS',
            this.elements.enableMinimum.prop('checked'));
         this.context.setPreference('DC_OPTID_MINMUTATIONS', minChanges);

         this.context.syncPropertyChange('contentChanges');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.ContentChangesProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         if (!this.elements.enableMinimum.prop('checked')) {
            this.elements.minimum.attr('disabled', 'true');
         }
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling whether network activity hints are used during
 * replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.NetworkActivityProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#networkActivitySection'),
      useHints: $('#networkActivityUseHints'),
      fullpage: $('#networkActivityFullpage'),
      autoClose: $('#networkActivityAutoClose'),
      timeout: $('#networkActivityTimeout'),
      prune: $('#networkActivityPrune'),
      reset: $('#networkActivityReset'),
      apply: $('#networkActivityApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');
   this.elements.diagnosticOnly = this.elements.section.find('.diagnosticOnly');

   this.elements.allInputs.on('change input', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.NetworkActivityProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.NetworkActivityProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.NetworkActivityProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change input');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.NetworkActivityProperty}
    */
   refresh: function () {
      this.elements.useHints.prop('checked',
         this.context.getPreference('DC_OPTID_USENETWORKHINTS'));
      this.elements.fullpage.prop('checked',
         this.context.getPreference('DC_OPTID_FULLPAGEOBJECTS'));
      this.elements.autoClose.prop('checked',
         this.context.getPreference('DC_OPTID_AUTOCLOSEREQUESTS'));
      this.elements.timeout.val(String(
         this.context.getPreference('DC_OPTID_NETWORKTIMEOUT') / 1000));
      this.elements.prune.val(String(
         this.context.getPreference('DC_OPTID_NETPRUNETIMEOUT') / 1000));

      this.elements.diagnosticOnly.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_USENETWORKHINTS',
            'DC_OPTID_FULLPAGEOBJECTS',
            'DC_OPTID_AUTOCLOSEREQUESTS',
            'DC_OPTID_NETWORKTIMEOUT',
            'DC_OPTID_NETPRUNETIMEOUT'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.NetworkActivityProperty}
    * @param {!Event} aEvent A jQuery change or input event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.NetworkActivityProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_USENETWORKHINTS');
         this.context.resetPreference('DC_OPTID_FULLPAGEOBJECTS');
         this.context.resetPreference('DC_OPTID_AUTOCLOSEREQUESTS');
         this.context.resetPreference('DC_OPTID_NETWORKTIMEOUT');
         this.context.resetPreference('DC_OPTID_NETPRUNETIMEOUT');
         this.context.syncPropertyChange('networkActivity');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.NetworkActivityProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var timeout, prune;
      try {
         timeout = 1000 * this.elements.timeout.val();
         // Use current setting while this feature is not supported.
         prune = (1000 * this.elements.prune.val()) ||
            this.context.getPreference('DC_OPTID_NETPRUNETIMEOUT');
         if (!this.context.validate('DC_OPTID_NETWORKTIMEOUT', timeout) ||
               !this.context.validate('DC_OPTID_NETPRUNETIMEOUT', prune)) {
            window.alert(this.context.getMessage(
               'deja_properties_invalidEntry'));
            return;
         }

         // Ensure that event timeout is not less than the network timeout.
         if (this.context.getPreference('DC_OPTID_EVENTTIMEOUT') < timeout) {
            if (!window.confirm(this.context.getMessage(
                  'deja_properties_adjustEventTimeout'))) {
               return;
            }
            this.context.setPreference('DC_OPTID_EVENTTIMEOUT', timeout);
            this.context.syncPropertyChange('eventTimeout');
         }

         this.context.setPreference('DC_OPTID_USENETWORKHINTS',
            this.elements.useHints.prop('checked'));
         this.context.setPreference('DC_OPTID_FULLPAGEOBJECTS',
            this.elements.fullpage.prop('checked'));
         // Not currently supported.
         //this.context.setPreference('DC_OPTID_AUTOCLOSEREQUESTS',
         //   this.elements.autoClose.prop('checked'));
         this.context.setPreference('DC_OPTID_NETWORKTIMEOUT', timeout);
         this.context.setPreference('DC_OPTID_NETPRUNETIMEOUT', prune);
         this.context.syncPropertyChange('networkActivity');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.NetworkActivityProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling when images, headers, and source are captured
 * during replay.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.CaptureDataProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#captureDataSection'),
      levels: $('input:radio[name="captureDataWhen"]'),
      off: $('#captureDataOff'),
      error: $('#captureDataError'),
      action: $('#captureDataAction'),
      event: $('#captureDataEvent'),
      image: $('#captureDataImage'),
      source: $('#captureDataSource'),
      docHeaders: $('#captureDataDocHeaders'),
      objHeaders: $('#captureDataObjHeaders'),
      mimeTypes: $('input:radio[name="captureDataFormat"]'),
      png: $('#captureDataPng'),
      jpeg: $('#captureDataJpeg'),
      reset: $('#captureDataReset'),
      apply: $('#captureDataApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.allInputs.on('change', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.CaptureDataProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.CaptureDataProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.CaptureDataProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.CaptureDataProperty}
    */
   refresh: function () {
      var level, group, mtype;

      level = this.context.getPreference('DC_OPTID_CAPTURELEVEL').toLowerCase();
      if (level.indexOf('act') !== -1) {
         this.elements.action.prop('checked', true);
      } else if ((level.indexOf('evt') !== -1) ||
                 (level.indexOf('eve') !== -1)) {
         this.elements.event.prop('checked', true);
      } else if (level.indexOf('err') !== -1) {
         this.elements.error.prop('checked', true);
      } else {
         this.elements.off.prop('checked', true);
      }

      group = this.context.getPreference('DC_OPTID_CAPTUREGROUP').toLowerCase();
      this.elements.image.prop('checked', (group.indexOf('img') !== -1));
      this.elements.source.prop('checked', (group.indexOf('src') !== -1));
      this.elements.docHeaders.prop('checked', (group.indexOf('hdr') !== -1));
      this.elements.objHeaders.prop('checked', (group.indexOf('hdx') !== -1));

      mtype = this.context.getPreference('DC_OPTID_CAPTUREMTYPE').toLowerCase();
      if ((mtype.indexOf('jpg') !== -1) || (mtype.indexOf('jpeg') !== -1)) {
         this.elements.jpeg.prop('checked', true);
      } else {
         this.elements.png.prop('checked', true);
      }

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_CAPTURELEVEL',
            'DC_OPTID_CAPTUREGROUP',
            'DC_OPTID_CAPTUREMTYPE'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.CaptureDataProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values for
    * the context. For some properties this may be a noop.
    * @this {DejaClickUi.CaptureDataProperty}
    */
   reset: function () {
      try {
         this.context.resetPreference('DC_OPTID_CAPTURELEVEL');
         this.context.resetPreference('DC_OPTID_CAPTUREGROUP');
         this.context.resetPreference('DC_OPTID_CAPTUREMTYPE');
         this.context.syncPropertyChange('captureData');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI to the context.
    * @this {DejaClickUi.CaptureDataProperty}
    */
   apply: function () {
      var group;
      try {
         this.context.setPreference('DC_OPTID_CAPTURELEVEL',
            this.elements.levels.filter(':checked').val());
         this.context.setPreference('DC_OPTID_CAPTUREMTYPE',
            this.elements.mimeTypes.filter(':checked').val());

         group = [];
         if (this.elements.image.prop('checked')) {
            group.push('img');
         }
         if (this.elements.source.prop('checked')) {
            group.push('src');
         }
         if (this.elements.docHeaders.prop('checked')) {
            group.push('hdr');
         }
         if (this.elements.objHeaders.prop('checked')) {
            group.push('hdx');
         }
         this.context.setPreference('DC_OPTID_CAPTUREGROUP', group.join(','));

         this.context.syncPropertyChange('captureData');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.CaptureDataProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};

/**
 * Property controlling available and active mobile devices for emulation.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.ContentViewOptionsProperty = function (aContext) {
   this.context = aContext;

   this.isModified = false;

   this.predefinedItemsInfo = {};

   this.elements = {
      section: $('#contentViewOptionsSection'),
      predefinedItems: $('#contentViewOptionsPredefinedItems'),

      addItem: $('#contentViewOptionsAddItem'),
      editItem: $('#contentViewOptionsEditItem'),
      removeItem: $('#contentViewOptionsRemoveItem'),

      reset: $('#contentViewOptionsReset'),
      apply: $('#contentViewListOptionsApply')
   };

   this.elements.allInputs = this.elements.section.find('select, option');
   this.elements.allButtons = this.elements.section.find('button');

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.addItem.on('click', this.addItem.bind(this));
   this.elements.editItem.on('click', this.editItem.bind(this));
   this.elements.removeItem.on('click', this.removeItem.bind(this));
   this.elements.reset.on('click', this.reset.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.allInputs.on('change', this.enableControls.bind(this));

   this.init();
};

DejaClickUi.ContentViewOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ContentViewOptionsProperty,

   /**
    * Initialize the property UI with saved data
    * @this {DejaClickUi.ContentViewOptionsProperty}
    */
   init: function () {
      try {
         this.predefinedItemsInfo = jQuery.extend(true, {},
            this.context.getPreference('DC_OPTID_CV_PREDEFINEDLIST'));

         this.refresh();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.predefinedItems.children('option').off('dblclick');
      }

      delete this.elements;
      delete this.predefinedItemsInfo;
      delete this.isModified;
      delete this.context;
   },

   /**
    * Revert the settings for this property to the last applied values.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.predefinedItemsInfo = jQuery.extend(true, {},
            this.context.getPreference('DC_OPTID_CV_PREDEFINEDLIST'));

         this.refresh();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI to the context.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setPreference('DC_OPTID_CV_PREDEFINEDLIST', this.predefinedItemsInfo);
         this.changeValue(false);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Set up modification flag. Update controls.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    */
   changeValue: function (aIsModified) {
      try {
         this.isModified = aIsModified !== false;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    */
   refresh: function () {
      var keys, i, l;

      try {
         this.elements.predefinedItems.empty();

         keys = Object.keys(this.predefinedItemsInfo);

         for (i = 0, l = keys.length; i < l; i++) {
            this.addItemElem(keys[i], true);
         }

         this.changeValue(false);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new item.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the addItem button.
    */
   addItem: function (opt_event) {
      try {
         this.context.openDialog('ui/content/dejaContentViewPredefinedItem.html',
            {
               item: null,
               itemManager: {
                  isNameExist: this.isNameExist.bind(this)
               }
            },
            this.completeEditItem.bind(this, null));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected item.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the editItem button.
    */
   editItem: function (opt_event) {
      var selectedItemId, itemInfo;

      try {
         if (this.elements.predefinedItems[0].selectedIndex !== -1) {
            selectedItemId = this.elements.predefinedItems
               .children('option:selected').val();

            itemInfo = this.predefinedItemsInfo[selectedItemId];

            if (itemInfo) {
               this.context.openDialog('ui/content/dejaContentViewPredefinedItem.html',
                  {
                     item: itemInfo,
                     itemManager: {
                        isNameExist: this.isNameExist.bind(this)
                     }
                  },
                  this.completeEditItem.bind(this, selectedItemId));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Add or edit the item submitted. Is called after Add/Edit dialog closed.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {string} aItemId - The item ID
    * @param {Object} aItem - The item object
    */
   completeEditItem: function (aItemId, aItem) {
      var item, updatedItemId;

      try {
         if (aItem) {
            if (aItemId && this.predefinedItemsInfo[aItemId]) {
               item = this.predefinedItemsInfo[aItemId];

               if (item.name !== aItem.name) {
                  item.name = aItem.name;
                  updatedItemId = this.getIdByName(aItem.name);
               }

               item.description = aItem.description;
               item.value = aItem.value;

               if (updatedItemId) {
                  delete this.predefinedItemsInfo[aItemId];
                  this.predefinedItemsInfo[updatedItemId] = item;
               }

               this.addItemElem(updatedItemId || aItemId, false);
            } else {
               updatedItemId = this.getIdByName(aItem.name);

               if (updatedItemId) {
                  this.predefinedItemsInfo[updatedItemId] = aItem;
                  this.addItemElem(updatedItemId, true);
               }
            }

            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Remove the currently selected item.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the removeItem button.
    */
   removeItem: function (opt_event) {
      var selectedItem;

      try {
         if (this.elements.predefinedItems[0].selectedIndex !== -1) {
            selectedItem = this.elements.predefinedItems.children('option:selected');

            delete this.predefinedItemsInfo[selectedItem.val()];
            selectedItem.remove();

            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.ContentViewOptionsProperty}
    */
   enableControls: function () {
      var selectedItemIndex, isItemUnselected;

      try {
         if (!this.context.controlsEnabled) {
            this.elements.allInputs.prop('disabled', true);
            this.elements.allButtons.button('option', 'disabled', true);
         } else {
            selectedItemIndex = this.elements.predefinedItems[0]
               .selectedIndex;
            isItemUnselected = selectedItemIndex === -1;

            this.elements.apply.button('option', 'disabled', !this.isModified);
            this.elements.reset.button('option', 'disabled', !this.isModified);
            this.elements.allInputs.prop('disabled', false);

            this.elements.addItem.button('option', 'disabled', false);
            this.elements.editItem
               .button('option', 'disabled', isItemUnselected);
            this.elements.removeItem
               .button('option', 'disabled', isItemUnselected);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Add an option element to the Predefined Items select box
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {string} aItemId - The item ID
    * @param {Boolean} aIsNew - Is the item new
    */
   addItemElem: function(aItemId, aIsNew) {
      var itemInfo, itemElem;

      try {
         itemInfo = this.predefinedItemsInfo[aItemId];

         if (itemInfo) {
            itemElem = aIsNew && $('<option>') ||
               this.elements.predefinedItems.children('option:selected');

            itemElem
               .val(aItemId)
               .text(itemInfo.name);

            aIsNew && itemElem.on('dblclick', this.editItem.bind(this));

            itemElem && aIsNew && this.elements.predefinedItems.append(itemElem);

            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Transforms the name provided to id
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {string} aItemName - The item name
    * @returns {string} - The item ID
    */
   getIdByName: function(aItemName) {
      try {
         if (aItemName) {
            return aItemName.replace(/\s/g, '-').toLowerCase();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Check whether provided item name is in use
    * @this {DejaClickUi.ContentViewOptionsProperty}
    * @param {string} aItemName - The item name
    * @returns {boolean} - true if item with such name exists
    */
   isNameExist: function(aItemName) {
      var itemId;

      try {
         if (aItemName) {
            itemId = this.getIdByName(aItemName);

            if (itemId) {
               return !!this.predefinedItemsInfo[itemId];
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   }
};



/**
 * Property controlling available and active mobile devices for emulation.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.MobileOptionsProperty = function (aContext) {
   this.context = aContext;

   this.isModified = false;

   this.devicesInfo = {};

   this.elements = {
      section: $('#mobileOptionsSection'),
      activeDevices: $('#mobileOptionsActiveDevices'),

      addDevice: $('#mobileOptionsAddDevice'),
      editDevice: $('#mobileOptionsEditDevice'),
      removeDevice: $('#mobileOptionsRemoveDevice'),
      moveUpDevice: $('#mobileOptionsMoveUpDevice'),
      moveDownDevice: $('#mobileOptionsMoveDownDevice'),

      availableDevices: $('#mobileOptionsAvailableDevices'),

      reset: $('#mobileOptionsReset'),
      apply: $('#mobileOptionsApply')
   };

   this.elements.allInputs = this.elements.section.find('select');
   this.elements.allButtons = this.elements.section.find('button');

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.addDevice.on('click', this.addDevice.bind(this));
   this.elements.editDevice.on('click', this.editDevice.bind(this));
   this.elements.removeDevice.on('click', this.removeDeviceFromActive.bind(this));
   this.elements.moveUpDevice.on('click', this.moveUpDevice.bind(this));
   this.elements.moveDownDevice.on('click', this.moveDownDevice.bind(this));
   this.elements.availableDevices.on('change', this.addDeviceToActive.bind(this));
   this.elements.reset.on('click', this.reset.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));
   this.elements.allInputs.on('change', this.enableControls.bind(this));

   this.init();
};

DejaClickUi.MobileOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.MobileOptionsProperty,

   /**
    * Initialize the property UI with saved data
    * @this {DejaClickUi.MobileOptionsProperty}
    */
   init: function () {
      try {
         this.devicesInfo = jQuery.extend(true, {},
            this.context.getPreference('DC_OPTID_MOBILEDATA'));

         this.refresh();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.MobileOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.activeDevices.children('option').off('dblclick');
         this.elements.availableDevices.children('option').off('click');
      }

      delete this.elements;
      delete this.devicesInfo;
      delete this.isModified;
      delete this.context;
   },

   /**
    * Revert the settings for this property to the last applied values.
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.devicesInfo = jQuery.extend(true, {},
            this.context.getPreference('DC_OPTID_MOBILEDATA'));

         this.refresh();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI to the context.
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      try {
         this.context.setPreference('DC_OPTID_MOBILEDATA', this.devicesInfo);
         this.context.syncMobileOptionsChange();
         this.changeValue(false);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Set up modification flag. Update controls.
    * @this {DejaClickUi.MobileOptionsProperty}
    */
   changeValue: function (aIsModified) {
      try {
         this.isModified = aIsModified !== false && true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.MobileOptionsProperty}
    */
   refresh: function () {
      var activeDevices = [],
         availableDevices = [],
         keys, i, l, deviceId, deviceObject;

      try {
         this.elements.activeDevices.empty();
         this.elements.availableDevices.children('option').remove(':enabled');

         keys = Object.keys(this.devicesInfo);

         for (i = 0, l = keys.length; i < l; i++) {
            deviceId = keys[i];
            deviceObject = this.devicesInfo[deviceId];

            if (deviceObject.isActive) {
               activeDevices[deviceObject.position] = deviceId;
            }
            else {
               availableDevices[deviceObject.position] = deviceId;
            }
         }

         for (i = 0, l = activeDevices.length; i < l; i++) {
            this.addActiveDeviceElem(activeDevices[i], true);
         }

         for (i = 0, l = availableDevices.length; i < l; i++) {
            this.addAvailableDeviceElem(availableDevices[i]);
         }

         this.elements.availableDevices.children('option:disabled')
            .prop('selected', true);

         this.updateDevicesPosition();
         this.changeValue(false);
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new device.
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the addDevice button.
    */
   addDevice: function (opt_event) {
      try {
         this.context.openDialog('ui/content/dejaMobileDevice.html',
            {
               device: null,
               deviceManager: {
                  isNameExist: this.isNameExist.bind(this)
               }
            },
            this.completeEditDevice.bind(this, null));
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Open a dialog to edit the currently selected device.
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the editDevice button.
    */
   editDevice: function (opt_event) {
      var selectedActiveDeviceId, deviceInfo;

      try {
         if (this.elements.activeDevices[0].selectedIndex !== -1) {
            selectedActiveDeviceId = this.elements.activeDevices
               .children('option:selected').val();

            deviceInfo = this.devicesInfo[selectedActiveDeviceId];

            if (deviceInfo) {
               this.context.openDialog('ui/content/dejaMobileDevice.html',
                  {
                     device: deviceInfo,
                     deviceManager: {
                        isNameExist: this.isNameExist.bind(this)
                     }
                  },
                  this.completeEditDevice.bind(this, selectedActiveDeviceId));
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Add or edit the device submitted. Is called after Add/Edit dialog closed.
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {string} aDeviceId - The device ID
    * @param {Object} aDevice - The device object
    */
   completeEditDevice: function (aDeviceId, aDevice) {
      try {
         var device, updatedDeviceId;

         if (aDevice) {
            if (aDeviceId && this.devicesInfo[aDeviceId]) {
               device = this.devicesInfo[aDeviceId];

               if (device.name !== aDevice.name) {
                  device.name = aDevice.name;
                  updatedDeviceId = this.getIdByName(aDevice.name);
               }

               device.userAgent = aDevice.userAgent;
               device.XHTMLSupport = aDevice.XHTMLSupport;
               device.FlashSupport = aDevice.FlashSupport;
               device.size = {
                  height: aDevice.size.height,
                  width: aDevice.size.width
               };

               if (updatedDeviceId) {
                  delete this.devicesInfo[aDeviceId];
                  this.devicesInfo[updatedDeviceId] = device;
               }

               this.addActiveDeviceElem(updatedDeviceId || aDeviceId, false);
            } else {
               updatedDeviceId = this.getIdByName(aDevice.name);

               if (updatedDeviceId) {
                  this.devicesInfo[updatedDeviceId] = aDevice;
                  this.addActiveDeviceElem(updatedDeviceId, true);
               }
            }

            this.updateDevicesPosition();
            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Change selected device's state from Available to Active
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event
    */
   addDeviceToActive: function (opt_event) {
      var selectedDevice, deviceId, device;

      try {
         selectedDevice = this.elements.availableDevices.children('option:enabled:selected');
         deviceId = selectedDevice.val();
         device = this.devicesInfo[deviceId];

         if (device) {
            device.isActive = true;

            selectedDevice.remove();
            this.elements.availableDevices.children('option:disabled')
               .prop('selected', true);
            this.addActiveDeviceElem(deviceId, true);

            this.updateDevicesPosition();
            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Change selected device's state from Active to Available
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event
    */
   removeDeviceFromActive: function (opt_event) {
      var selectedDevice, deviceId, device;

      try {
         selectedDevice = this.elements.activeDevices.children('option:selected');
         deviceId = selectedDevice.val();
         device = this.devicesInfo[deviceId];

         if (device) {
            device.isActive = false;

            selectedDevice.remove();
            this.addAvailableDeviceElem(deviceId);

            this.updateDevicesPosition();
            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Move the selected device higher in the active devices list
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the moveUpDevice button.
    */
   moveUpDevice: function (opt_event) {
      var selectedDevice, previousDevice;

      try {
         if (this.elements.activeDevices[0].selectedIndex > 0) {

            selectedDevice = this.elements.activeDevices
               .children('option:selected');

            previousDevice = selectedDevice.prev();

            selectedDevice.insertBefore(previousDevice);

            this.updateDevicesPosition();
            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Move the selected device lower in the active devices list
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the moveDownDevice button.
    */
   moveDownDevice: function (opt_event) {
      var selectedDevice, nextDevice;

      try {
         if (this.elements.activeDevices[0].selectedIndex !==
               this.elements.activeDevices.children('option').length - 1) {

            selectedDevice = this.elements.activeDevices
               .children('option:selected');

            nextDevice = selectedDevice.next();

            selectedDevice.insertAfter(nextDevice);

            this.updateDevicesPosition();
            this.changeValue(true);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.MobileOptionsProperty}
    */
   enableControls: function () {
      var activeDevicesCount, selectedActiveDeviceIndex, isActiveDeviceUnselected;

      try {
         if (!this.context.controlsEnabled) {
            this.elements.allInputs.prop('disabled', true);
            this.elements.allButtons.button('option', 'disabled', true);
         } else {
            activeDevicesCount = this.elements.activeDevices.children('option')
               .length;
            selectedActiveDeviceIndex = this.elements.activeDevices[0]
               .selectedIndex;
            isActiveDeviceUnselected = selectedActiveDeviceIndex === -1;

            this.elements.apply.button('option', 'disabled', !this.isModified);
            this.elements.reset.button('option', 'disabled', !this.isModified);
            this.elements.allInputs.prop('disabled', false);

            this.elements.addDevice.button('option', 'disabled', false);
            this.elements.editDevice
               .button('option', 'disabled', isActiveDeviceUnselected);
            this.elements.removeDevice
               .button('option', 'disabled', isActiveDeviceUnselected);

            this.elements.moveUpDevice.button(
               'option',
               'disabled',
                  selectedActiveDeviceIndex < 1);
            this.elements.moveDownDevice.button(
               'option',
               'disabled',
                  isActiveDeviceUnselected ||
                  selectedActiveDeviceIndex === activeDevicesCount - 1);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Add an option element to the Active Devices select box
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {string} aDeviceId - The device ID
    * @param {Boolean} aIsNew - Is the device new
    */
   addActiveDeviceElem: function(aDeviceId, aIsNew) {
      var deviceInfo, deviceElem;

      try {
         deviceInfo = this.devicesInfo[aDeviceId];

         if (deviceInfo) {
            deviceElem = aIsNew && $('<option>') ||
               this.elements.activeDevices.children('option:selected');

            deviceElem
               .val(aDeviceId)
               .text(deviceInfo.name);

            aIsNew && deviceElem.on('dblclick', this.editDevice.bind(this));

            deviceElem && aIsNew && this.elements.activeDevices.append(deviceElem);

            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Add an option element to the Available Devices select box
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {string} aDeviceId - The device ID
    */
   addAvailableDeviceElem: function(aDeviceId) {
      var deviceInfo, deviceElem;

      try {
         deviceInfo = this.devicesInfo[aDeviceId];
         deviceElem = $('<option>');

         if (deviceInfo) {
            deviceElem
               .val(aDeviceId)
               .text(deviceInfo.name);

            deviceElem && this.elements.availableDevices.append(deviceElem);

            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Recalculate devices positions in the storage object based on their
    * position in the selectboxes
    * @this {DejaClickUi.MobileOptionsProperty}
    */
   updateDevicesPosition: function() {
      var activeDevices, availableDevices, deviceId, i, l;

      try {
         activeDevices = this.elements.activeDevices.children('option');
         availableDevices = this.elements.availableDevices
            .children('option:enabled');

         for (i = 0, l = activeDevices.length; i < l; i++) {
            deviceId = activeDevices[i].getAttribute('value');
            deviceId && (this.devicesInfo[deviceId].position = i);
         }

         for (i = 0, l = availableDevices.length; i < l; i++) {
            deviceId = availableDevices[i].getAttribute('value');
            deviceId && (this.devicesInfo[deviceId].position = i);
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Check whether provided device name is in use
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {string} aDeviceName - The device name
    * @returns {boolean} - true if device with such name exists
    */
   isNameExist: function(aDeviceName) {
      var deviceId;

      try {
         if (aDeviceName) {
            deviceId = this.getIdByName(aDeviceName);

            if (deviceId) {
               return !!this.devicesInfo[deviceId];
            }
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Transforms the name provided to id
    * @this {DejaClickUi.MobileOptionsProperty}
    * @param {string} aDeviceName - The device name
    * @returns {string} - The device ID
    */
   getIdByName: function(aDeviceName) {
      try {
         if (aDeviceName) {
            return aDeviceName.replace(/\s/g, '-').toLowerCase();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   }
};

/**
 * Property controlling when scripts should be encrypted.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.SecurityProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#securitySection'),
      local: $('#securityLocal'),
      remote: $('#securityRemote'),
      allInput: $('#securityAllInput'),
      reset: $('#securityReset'),
      apply: $('#securityApply')
   };
   this.elements.allInputs = this.elements.section.find('input');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.allInputs.on('change', this.changeValue.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.SecurityProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.SecurityProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.SecurityProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.SecurityProperty}
    */
   refresh: function () {
      this.elements.local.prop('checked',
         this.context.getPreference('DC_OPTID_ENCRYPTLOCAL'));
      this.elements.remote.prop('checked',
         this.context.getPreference('DC_OPTID_ENCRYPTREMOTE'));
      this.elements.allInput.prop('checked',
         this.context.getPreference('DC_OPTID_ENCRYPTINPUT'));

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_ENCRYPTLOCAL',
            'DC_OPTID_ENCRYPTREMOTE',
            'DC_OPTID_ENCRYPTINPUT'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.SecurityProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if ((aEvent.target.getAttribute('id') === 'securityRemote') &&
               this.elements.remote.prop('checked')) {
            window.alert(this.context.getMessage(
               'deja_properties_warnremotecrypto'));
         }
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values for
    * the context. For some properties this may be a noop.
    * @this {DejaClickUi.SecurityProperty}
    */
   reset: function () {
      try {
         this.context.resetPreference('DC_OPTID_ENCRYPTLOCAL');
         this.context.resetPreference('DC_OPTID_ENCRYPTREMOTE');
         this.context.resetPreference('DC_OPTID_ENCRYPTINPUT');
         this.context.syncPropertyChange('security');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI to the context.
    * @this {DejaClickUi.SecurityProperty}
    */
   apply: function () {
      try {
         this.context.setPreference('DC_OPTID_ENCRYPTLOCAL',
            this.elements.local.prop('checked'));
         this.context.setPreference('DC_OPTID_ENCRYPTREMOTE',
            this.elements.remote.prop('checked'));
         this.context.setPreference('DC_OPTID_ENCRYPTINPUT',
            this.elements.allInput.prop('checked'));
         this.context.syncPropertyChange('security');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.SecurityProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


/**
 * Property controlling which types of messages should be logged.
 * @constructor
 * @implements {DejaClickUi.Property}
 * @param {!DejaClickUi.PropertyContext} aContext The context to which
 *    the property applies.
 */
DejaClickUi.LogOptionsProperty = function (aContext) {
   this.context = aContext;

   this.state = {
      hasValue: false,
      hasNewValue: false
   };

   this.elements = {
      section: $('#logOptionsSection'),
      fail: $('#logOptionsFailures'),
      warn: $('#logOptionsWarnings'),
      info: $('#logOptionsInformation'),
      debug: $('#logOptionsDebug'),
      debugAll: $('#logOptionsAllDebug'),
      reset: $('#logOptionsReset'),
      apply: $('#logOptionsApply')
   };
   this.elements.allInputs = this.elements.section.find('input,select');
   this.elements.allButtons = this.elements.section.find('button');

   this.elements.fail.on('change', this.changeValue.bind(this));
   this.elements.warn.on('change', this.changeValue.bind(this));
   this.elements.info.on('change', this.changeValue.bind(this));
   this.elements.debug.on('change', this.selectDebugCategory.bind(this));
   this.elements.debugAll.on('change', this.toggleAllDebug.bind(this));
   this.elements.reset.button().on('click', this.reset.bind(this));
   this.elements.apply.button().on('click', this.apply.bind(this));
};

DejaClickUi.LogOptionsProperty.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.LogOptionsProperty,

   /**
    * Shut down the property and release all external objects.
    * @this {DejaClickUi.LogOptionsProperty}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.allInputs.off('change');
      }
      delete this.elements;
      delete this.state;
      delete this.context;
   },

   /**
    * Update the UI from the current context.
    * @this {DejaClickUi.LogOptionsProperty}
    */
   refresh: function () {
      var message, debug, options, index;

      message = this.context.getPreference('DC_OPTID_LOGMESSAGE').toLowerCase();
      debug = this.context.getPreference('DC_OPTID_LOGDEBUG').toLowerCase();

      if (message.indexOf('all') !== -1) {
         this.elements.fail.prop('checked', true);
         this.elements.warn.prop('checked', true);
         this.elements.info.prop('checked', true);
      } else {
         this.elements.fail.prop('checked', (message.indexOf('fail') !== -1));
         this.elements.warn.prop('checked', (message.indexOf('warn') !== -1));
         this.elements.info.prop('checked', (message.indexOf('info') !== -1));
      }

      if (debug.indexOf('all') !== -1) {
         this.elements.debugAll.prop('checked', true);
         this.toggleAllDebug();
      } else {
         this.elements.debugAll.prop('checked', false);
         options = this.elements.debug.prop('options');
         index = options.length;
         while (index !== 0) {
            --index;
            options[index].selected =
               (debug.indexOf(options[index].getAttribute('value')) !== -1);
         }
      }

      this.state.hasValue = this.context.updatePropertyModified(
         this.elements.section,
         [
            'DC_OPTID_LOGMESSAGE',
            'DC_OPTID_LOGDEBUG'
         ]);
      this.state.hasNewValue = false;
      this.enableControls();
   },

   /**
    * Mark the property as having been changed.
    * @this {DejaClickUi.LogOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on an input element
    *    in the section.
    */
   changeValue: function (aEvent) {
      try {
         if (!this.state.hasNewValue) {
            this.state.hasNewValue = true;
            this.enableControls();
         }
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Mark the property as having been changed. Uncheck the all debug
    * categories checkbox.
    * @this {DejaClickUi.LogOptionsProperty}
    * @param {!Event} aEvent A jQuery change event on an debug category
    *    selection element.
    */
   selectDebugCategory: function (aEvent) {
      try {
         this.elements.debugAll.prop('checked', false);
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable all debug categories.
    * @this {DejaClickUi.LogOptionsProperty}
    * @param {!Event=} opt_event A jQuery change event on the enable
    *    all debug categories checkbox.
    */
   toggleAllDebug: function (opt_event) {
      var enabled, options, index;
      try {
         enabled = this.elements.debugAll.prop('checked');
         options = this.elements.debug.prop('options');
         index = options.length;
         while (index !== 0) {
            --index;
            options[index].selected = enabled;
         }
         this.state.hasNewValue = true;
         this.enableControls();
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Revert the settings for this property to the default values.
    * @this {DejaClickUi.LogOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the reset button.
    */
   reset: function (opt_event) {
      try {
         this.context.resetPreference('DC_OPTID_LOGMESSAGE');
         this.context.resetPreference('DC_OPTID_LOGDEBUG');
         this.context.syncPropertyChange('logOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Apply the changes made in the UI.
    * @this {DejaClickUi.LogOptionsProperty}
    * @param {!Event=} opt_event A jQuery click event on the apply button.
    */
   apply: function (opt_event) {
      var message, debug, options, index;

      try {
         // Only apply this property if the frame containing this Properties
         // page is visible. This prevents a conflict between the replay
         // and record versions of the property on the options page.
         if (!$(window.frameElement).is(':visible')) {
            return;
         }

         message = '';
         if (this.elements.fail.prop('checked')) {
            message += 'fail';
         }
         if (this.elements.warn.prop('checked')) {
            message += ' warn';
         }
         if (this.elements.info.prop('checked')) {
            message += ' info';
         }

         if (this.elements.debugAll.prop('checked')) {
            debug = 'all';
         } else {
            options = this.elements.debug.prop('selectedOptions');
            index = options.length;
            if (index === 0) {
               debug = 'off';
            } else {
               debug = '';
               while (index !== 0) {
                  --index;
                  debug += ' ' + options[index].getAttribute('value');
               }
            }
         }

         this.context.setPreference('DC_OPTID_LOGMESSAGE', message);
         this.context.setPreference('DC_OPTID_LOGDEBUG', debug);
         this.context.syncPropertyChange('logOptions');
      } catch (ex) {
         this.context.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls for the property based upon the
    * current extension state.
    * @this {DejaClickUi.LogOptionsProperty}
    */
   enableControls: function () {
      if (!this.context.controlsEnabled) {
         this.elements.allInputs.attr('disabled', 'true');
         this.elements.allButtons.button('option', 'disabled', true);
      } else {
         this.elements.allInputs.removeAttr('disabled');
         this.elements.reset.button('option', 'disabled',
            !this.state.hasValue && !this.state.hasNewValue);
         this.elements.apply.button('option', 'disabled',
            !this.state.hasNewValue);
      }
   }
};


// Properties instance created by containing page.
