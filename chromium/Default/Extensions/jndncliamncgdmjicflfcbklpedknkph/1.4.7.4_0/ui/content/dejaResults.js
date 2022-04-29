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
 * Frame used to display the results of replaying a script, subscript,
 * action, or event. The containing window must create a
 * DejaClick.Results object when it is loaded and close it when it is
 * closed.
 * Input: {} None
 * Output: {} None
 */

/*global DejaClickUi,$,document*/

'use strict';

/**
 * Class to encapsulate the functionality of the DejaClick results window.
 * The results pane shows the attributes and replay status of the current
 * script, subscript (branch), action, or event.
 *
 * Results accepts the following events from external sources:
 * - setContext() - update the context of the results displayed.
 * - dejaclick:runmode - change the run mode, enabling or disabling the UI.
 * - dejaclick:preferences('DC_OPTID_DISPLAY_LEVEL') - change the display
 *    level, affecting which attributes are displayed.
 * - dejaclick:propertyupdated - Refresh the UI for the results based upon
 *    new data.
 *
 * @constructor
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function():?DejaClick.Script} aGetScript Function to retrieve the
 *    script being processed by the extension.
 * @param {integer} aRunMode The run mode at the time the sidebar was created.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.Results = function (aUtils, aConstants, aGetScript,
      aRunMode, AEventRegistration) {
   var observerService;

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
         this.refreshResults, this);

   this.state = {
      runmode: aRunMode,
      running: false // whether record/replay is active
   };

   this.context = new DejaClickUi.ResultsContext(aUtils, aConstants,
      aGetScript);

   this.results = {
      script: new DejaClickUi.ScriptResults(this.context),
      //subscript: new DejaClickUi.SubscriptResults(this.context),
      action: new DejaClickUi.ActionResults(this.context),
      event: new DejaClickUi.EventResults(this.context)
   };

   // Initialize the window.
   this.elements = {
      resultsPending: $('#resultsPending'),
      resultsData: $('#resultsData'),
      sections: $('.section')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   this.setContext('');
};

DejaClickUi.Results.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Results,

   /**
    * Shut down the results pane in response to the containing
    * page being unloaded.  Abort any asynchronous activities and
    * dialogs started by this window and release all references to
    * objects external to this page. The containing window should
    * call this when it is unloaded.
    * @this {!DejaClickUi.Results}
    */
   close: function () {
      try {
         this.broadcastAll('close');
         if (this.hasOwnProperty('events')) {
            this.events.close();
         }
         if (this.hasOwnProperty('context')) {
            this.context.close();
         }

         delete this.elements;
         delete this.results;
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
    * Change the object whose results are being displayed.  This is
    * called when the context of the results window is
    * changed. This is usually either at initialization time or when a
    * row in the tree view is selected.
    * @this {!DejaClickUi.Results}
    * @param {string} aContext The hashkey of an element in the
    *    current script. Any other value will
    *    hide all results.
    */
   setContext: function (aContext) {
      this.context.setContext(aContext);
      this.displayResults();
   },

   /**
    * Enable or disable widgets based upon the current run mode.
    * Called in response to the dejaclick:runmode event.
    * @this {!DejaClickUi.Results}
    * @param {!{runMode:integer}} aData The new runmode.
    */
   updateRunMode: function (aData) {
      try {
         this.state.runmode = aData.runMode;
         this.displayResults();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update which results are displayed based upon the current context
    * and run mode.
    * @this {!DejaClickUi.Properties}
    */
   displayResults: function () {
      var category, runmode;
      category = this.context.category;
      runmode = this.state.runmode;

      switch(runmode) {
         case this.constants.RUNMODE_STOPPED:
            this.elements.resultsPending.hide();

            if (category != 'none') {
               this.elements.sections.filter(':not(.' + category + ')').hide();
               this.elements.sections.filter('.' + category).show();
               this.elements.resultsData.show();
            } else {
               this.elements.resultsData.hide();
            }
            break;
         case this.constants.RUNMODE_RECORD:
         case this.constants.RUNMODE_REPLAY:
         case this.constants.RUNMODE_PAUSED:
         case this.constants.RUNMODE_RESUME:
         case this.constants.RUNMODE_SUSPEND:
            this.elements.resultsPending.show();
            this.elements.resultsData.hide();
            break;
         default:
         case this.constants.RUNMODE_INACTIVE:
            this.elements.resultsPending.hide();
            this.elements.resultsData.hide();
            break;
      }

      this.refresh();
   },

   /**
    * React to a modified preference value. Update the UI if appropriate.
    * This is called when the display level preference is changed.
    * Called in response to the dejaclick:preferences event.
    * @this {!DejaClickUi.Results}
    * @param {!{key:string,newValue:*,oldValue:*}} aData Details of the
    *    changed preference.
    */
   dispatchPreferenceChange: function (aData) {
      try {
         if (aData.key === 'DC_OPTID_DISPLAYLEVEL') {
            this.context.setDisplayLevel(aData.newValue);
            this.refresh();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Refresh the UI for the results.
    * @this {!DejaClickUi.Results}
    */
   refresh: function () {
      try {
         var category = this.context.category;
         if (category != 'none') {
            this.results[category].refresh();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Refresh the UI for the results if the specified category
    * would affect the current category.
    * Called in response to the dejaclick:propertyupdated event.
    * @this {!DejaClickUi.Results}
    * @param {!{property:string, category:string}} aData Details of the
    *    property and category that has been changed. If the property
    *    value is the empty string, all properties in that category
    *    have been updated.
    */
   refreshResults: function (aData) {
      var apply;
      try {
         switch (aData.category) {
         case 'script':
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
            this.refresh();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   }
};


/**
 * The context of the results being displayed.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function():?DejaClick.Script} aGetScript Function to retrieve the
 *    script being processed by the extension.
 */
DejaClickUi.ResultsContext = function (aUtils, aConstants, aGetScript) {
   this.logger = aUtils.logger;
   this.observerService = aUtils.observerService;
   this.prefService = aUtils.prefService;
   this.getMessage = aUtils.getMessage;
   this.constants = aConstants;
   this.getScript = aGetScript;

   /**
    * The current display level.
    * @type {integer}
    */
   this.displayLevel = this.prefService.getPrefOption('DC_OPTID_DISPLAYLEVEL');

   this.context = '';
   this.category = 'none';

   /** @type {?DejaClick.Script} */
   this.script = null;

   /**
    * The current script element.
    * @type {?Element}
    */
   this.element = null;

   /** @type {?Element} */
   this.event = null;
};

DejaClickUi.ResultsContext.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ResultsContext,

   /**
    * Close the context and release references to external objects.
    * @this {!DejaClickUi.ResultsContext}
    */
   close: function () {
      delete this.event;
      delete this.element;
      delete this.script;
      delete this.category;
      delete this.context;
      delete this.getScript;
      delete this.constants;
      delete this.getMessage;
      delete this.prefService;
      delete this.observerService;
      delete this.logger;
   },

   /**
    * Record the current display level.
    * @this {!DejaClickUi.ResultsContext}
    * @param {integer} aLevel The new display level.
    */
   setDisplayLevel: function (aLevel) {
      this.displayLevel = aLevel;
   },

   /**
    * Change the object whose properties are being displayed.  This is
    * called when the context of the results window is
    * changed. This is usually either at initialization time or when a
    * row in the tree view is selected.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aContext The hashkey of an element in the
    *    current script. Any other value will hide all results.
    */
   setContext: function (aContext) {
      this.context = aContext;
      this.event = null;

      var script = this.getScript();
      this.element = (script == null) ? null : script.getHashkeyNode(aContext);
      if (this.element == null) {
         this.script = null;
         this.category = 'none';
         this.context = '';
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
    * Get the value of a script attribute element for the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aName The name of the attribute element.
    * @return {?string} The value of the attribute or null if it does
    *    not exist.
    */
   getAttribute: function (aName) {
      return this.script.domTreeGetAttribute(this.element, aName);
   },

   /**
    * Determine whether a script attribute with the given name exists for the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aName The name of the attribute element.
    * @return {boolean} true if the script attribute is present, false if not.
    */
   hasAttribute: function (aName) {
      return this.script.domTreeHasAttribute(this.element, aName);
   },

   /**
    * Get the value of an event parameter of the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aName The name of the parameter.
    * @return {?string} The value of the parameter or null if it does
    *    not exist.
    */
   getEventParam: function (aName) {
      return this.script.domTreeGetEventParam(this.element, aName);
   },

   /**
    * Get the value of a preference in the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aName The name of the preference.
    * @return {*} The value of the preference.
    */
   getPreference: function (aName) {
      return this.prefService.getPrefOption(aName, this.script, this.event);
   },

   /**
    * Get the nodeset result of evaluating an XPath query against the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aQuery An XPath expression.
    * @return {!Array.<!Element>} The result of the XPath evaluation.
    */
   getNodes: function (aQuery) {
      return this.script.processXPath(this.element, aQuery);
   },

   /**
    * Get the number result of evaluating an XPath query against the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aQuery An XPath expression.
    * @return {integer} The result of the XPath evaluation.
    */
   getNumber: function (aQuery) {
      return this.script.processXPathCount(this.element, aQuery);
   },

   /**
    * Get the string result of evaluating an XPath query against the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aQuery An XPath expression.
    * @return {string} The result of the XPath evaluation.
    */
   getString: function (aQuery) {
      return this.script.processXPathString(this.element, aQuery);
   },

   /**
    * Get the single node result of evaluating an XPath query against the current context.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aQuery An XPath expression.
    * @return {?Element} The first node resulting from the evaluation,
    *    or null if it returned an empty set.
    */
   getNode: function (aQuery) {
      return this.script.processXPathFirstNode(this.element, aQuery);
   },

   /**
    * Get an actions root node of the script.
    * @this {!DejaClickUi.ResultsContext}
    * @param {string} aActionsType The type of actions node
    *    ('record' or 'replay') to get.
    * @return {?Element} The requested node or null if it does not exist.
    */
   getActionsRootNode: function (aActionsType) {
      // NOTE: Actions root nodes are actions nodes which are direct children
      // of the root script node. If there is more than one actions root node
      // of the given type, retrieve the last one.
      var actionsRootNode = this.script.processXPathFirstNode(this.script.getScriptElement(),
            "(child::actions[@type='" + aActionsType + "'])[last()]");
      return actionsRootNode;
   },

   /**
    * Get the record actions root node of the script.
    * @this {!DejaClickUi.ResultsContext}
    * @return {?Element} The requested node or null if it does not exist.
    */
   getRecordActionsRootNode: function () {
      return this.getActionsRootNode('record');
   },

   /**
    * Get the replay actions root node of the script.
    * @this {!DejaClickUi.ResultsContext}
    * @return {?Element} The requested node or null if it does not exist.
    */
   getReplayActionsRootNode: function () {
      return this.getActionsRootNode('replay');
   }
};


/**
 * Interface for a generic ContextResults.
 * @interface
 * @implements {DejaClick.Closable}
 */
DejaClickUi.ContextResults = function () {};

DejaClickUi.ContextResults.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ContextResults,

   /**
    * Shut down and release all external objects.
    * @this {!DejaClickUi.ContextResults}
    */
   close: function () {},

   /**
    * Update the UI from the current context.
    * @this {!DejaClickUi.ContextResults}
    */
   refresh: function () {},

   /**
    * Revert the UI to the default values for
    * the context. For some results this may be a noop.
    * @this {!DejaClickUi.ContextResults}
    */
   reset: function () {}
};


/**
 * Results of script replay.
 * @constructor
 * @implements {DejaClickUi.Results}
 * @param {!DejaClickUi.ResultsContext} aContext The context of the results.
 */
DejaClickUi.ScriptResults = function (aContext) {
   this.context = aContext;

   this.elements = {
      section: $('#scriptInfo'),
      scriptNumber: $('#scriptNumber'),
      scriptType: $('#scriptType'),
      scriptDesc: $('#scriptDesc'),
      recordedOnBox: $('#recordedOnBox'),
      recordedOn: $('#scriptRecorded'),
      producedOnBox: $('#producedOnBox'),
      producedOn: $('#scriptProduced'),
      prodVersion: $('#scriptPVersion'),
      modifiedOnBox: $('#modifiedOnBox'),
      modifiedOn: $('#scriptModified'),
      modVersion: $('#scriptMVersion'),
      scriptPath: $('#scriptPath'),
      scriptContains: $('#scriptContains'),
      scriptStatus: $('#scriptStatus')
   };

   this.elements.advancedOnly = this.elements.section.find('.advancedOnly');
   this.elements.diagnosticOnly = this.elements.section.find('.diagnosticOnly');

   this.results = new DejaClickUi.ReplayResults(this.context);
};

DejaClickUi.ScriptResults.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ScriptResults,

   /**
    * Shut down and release all external objects.
    * @this {!DejaClickUi.ScriptResults}
    */
   close: function () {
      delete this.elements;
      delete this.context;
   },

   /**
    * Update the UI for the current context.
    * @this {!DejaClickUi.ScriptResults}
    */
   refresh: function () {

      // Clear the existing values.
      this.reset();

      this.elements.scriptNumber.text('1');

      var scripttype = this.context.getAttribute('scripttype');
      if (scripttype) {
         this.elements.scriptType.text(scripttype);
      }

      var description = this.context.getAttribute('description');
      if (description) {
         this.elements.scriptDesc.text(description);
         this.elements.scriptDesc.attr('title', description);
      }

      var produced = this.context.getAttribute('produced');
      if (produced) {
         this.elements.producedOn.text(produced);
         this.elements.producedOn.attr('title', produced);

         var pversion = this.context.getAttribute('pversion');
         if (!pversion) {
            pversion = this.context.getMessage('deja_results_version_unknown');
         }

         var format, pbrowser, pbversion;
         if (this.context.hasAttribute('pbrowserversion')) {
            format = 'deja_results_dejaBrowserVersion';
            pbrowser = this.context.getAttribute('pbrowser');
            if (!pbrowser) {
               pbrowser = this.context.getMessage('deja_results_version_unknown');
            }
            pbversion = this.context.getAttribute('pbrowserversion');
         } else if (this.context.hasAttribute('pchromeversion')) {
            format = 'deja_results_dejaChromeVersion';
            pbversion = this.context.getAttribute('pchromeversion');
         } else if (this.context.hasAttribute('pffversion')) {
            format = 'deja_results_dejaFirefoxVersion';
            pbversion = this.context.getAttribute('pffversion');
         }
         if (!pbversion) {
            format = (pbrowser) ? 'deja_results_dejaBrowserVersion' : 'deja_results_dejaChromeVersion';
            pbversion = this.context.getMessage('deja_results_version_unknown');
         }
         var prodVersion = this.context.getMessage(format, [pversion, pbversion, pbrowser]);
         this.elements.prodVersion.text(prodVersion);

         this.elements.producedOnBox.show();
      } else {
         // for non-saved scripts, we don't yet have a producedOn timestamp and version,
         // so in its place, use the recordedOn timestamp from the recording tree data.
         var recordActionsRootNode = this.context.getRecordActionsRootNode();
         var recordedOn = (recordActionsRootNode) ? recordActionsRootNode.getAttribute("generated") : '';
         this.elements.recordedOn.text(recordedOn);
         this.elements.recordedOn.attr('title', recordedOn);

         this.elements.recordedOnBox.show();
      }

      // display modified timestamp only if different from produced timestamp
      var modified = this.context.getAttribute('modified');
      if (modified && (modified != produced)) {
         this.elements.modifiedOn.text(modified);
         this.elements.modifiedOn.attr('title', modified);

         var mversion = this.context.getAttribute('mversion');
         if (!mversion) {
            mversion = this.context.getMessage('deja_results_version_unknown');
         }

         var format3, mbrowser, mbversion;
         if (this.context.hasAttribute('mbrowserversion')) {
            format3 = 'deja_results_dejaBrowserVersion';
            mbrowser = this.context.getAttribute('mbrowser');
            if (!mbrowser) {
               mbrowser = this.context.getMessage('deja_results_version_unknown');
            }
            mbversion = this.context.getAttribute('mbrowserversion');
         } else if (this.context.hasAttribute('mchromeversion')) {
            format3 = 'deja_results_dejaChromeVersion';
            mbversion = this.context.getAttribute('mchromeversion');
         } else if (this.context.hasAttribute('mffversion')) {
            format3 = 'deja_results_dejaFirefoxVersion';
            mbversion = this.context.getAttribute('mffversion');
         }
         if (!mbversion) {
            format3 = (mbrowser) ? 'deja_results_dejaBrowserVersion' : 'deja_results_dejaChromeVersion';
            mbversion = this.context.getMessage('deja_results_version_unknown');
         }
         var modVersion = this.context.getMessage(format3, [mversion, mbversion, mbrowser]);
         this.elements.modVersion.text(modVersion);

         this.elements.modifiedOnBox.show();
      }

      var scriptPath = this.context.script.getFilename();
      if (scriptPath) {
         this.elements.scriptPath.text(scriptPath);
         this.elements.scriptPath.attr('title', scriptPath);
      } else {
         scriptPath = this.context.getMessage('deja_results_scriptNotSaved');
         this.elements.scriptPath.text(scriptPath);
      }

      var numActions = this.context.getNumber("count(//actions[@type='record']/action)");
      var numEvents = this.context.getNumber("count(//actions[@type='record']/action/event)");
      var format2;
      if (numActions > 1 && numEvents > 1) {
         format2 = "deja_results_scriptContains1";
      } else if (numActions > 1 && numEvents == 1) {
         format2 = "deja_results_scriptContains2";
      } else if (numActions == 1 && numEvents > 1) {
         format2 = "deja_results_scriptContains3";
      } else { // (numActions == 1 && numEvents == 1)
         format2 = "deja_results_scriptContains4";
      }
      var contains = this.context.getMessage(format2, [numActions, numEvents]);
      this.elements.scriptContains.text(contains);

      var scriptstatus = this.context.getAttribute('scriptstatus');
      var format1;
      switch (scriptstatus) {
         case "scriptCheck":
            format1 = "deja_results_scriptStatus_check";
            break;
         case "scriptWarn":
            format1 = "deja_results_scriptStatus_warn";
            break;
         case "scriptError":
            format1 = "deja_results_scriptStatus_error";
            break;
         case "scriptNorm":
            format1 = "deja_results_scriptStatus_norm";
            break;
         default:
            format1 = "deja_results_scriptStatus_none";
            break;
      }
      var scriptStatus = this.context.getMessage(format1);
      this.elements.scriptStatus.text(scriptStatus);

      this.elements.advancedOnly.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);
      this.elements.diagnosticOnly.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      this.results.refresh();
   },

   /**
    * Reset the UI to the default values.
    * @this {!DejaClickUi.ScriptResults}
    */
   reset: function () {
      this.elements.scriptNumber.text('1');
      this.elements.scriptType.text('');
      this.elements.scriptDesc.text('');
      this.elements.scriptDesc.attr('title', '');

      this.elements.recordedOn.text('');
      this.elements.recordedOn.attr('title', '');

      this.elements.producedOn.text('');
      this.elements.producedOn.attr('title', '');
      this.elements.prodVersion.text('');

      this.elements.modifiedOn.text('');
      this.elements.modifiedOn.attr('title', '');
      this.elements.modVersion.text('');

      this.elements.recordedOnBox.hide();
      this.elements.producedOnBox.hide();
      this.elements.modifiedOnBox.hide();

      this.elements.scriptPath.text('');
      this.elements.scriptPath.attr('title', '');
      this.elements.scriptContains.text('');
      this.elements.scriptStatus.text('');
   }
}; // End of DejaClickUi.ScriptResults.prototype


/**
 * Results of action replay.
 * @constructor
 * @implements {DejaClickUi.Results}
 * @param {!DejaClickUi.ResultsContext} aContext The context of the results.
 */
DejaClickUi.ActionResults = function (aContext) {
   this.context = aContext;

   this.elements = {
      section: $('#actionInfo'),
      actionNumber: $('#actionNumber'),
      actionType: $('#actionType'),
      actionDesc: $('#actionDesc'),
      urlRequestedBox: $('#actionURLRequestedBox'),
      urlRequested: $('#actionURLRequested'),
      urlFinalizedBox: $('#actionURLFinalizedBox'),
      urlFinalized: $('#actionURLFinalized'),
      actionContains: $('#actionContains')
   };

   this.elements.advancedOnly = this.elements.section.find('.advancedOnly');
   this.elements.diagnosticOnly = this.elements.section.find('.diagnosticOnly');

   this.results = new DejaClickUi.ReplayResults(this.context);
};

DejaClickUi.ActionResults.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ActionResults,

   /**
    * Shut down and release all external objects.
    * @this {!DejaClickUi.ActionResults}
    */
   close: function () {
      delete this.elements;
      delete this.context;
   },

   /**
    * Update the UI for the current context.
    * @this {!DejaClickUi.ActionResults}
    */
   refresh: function () {

      // Clear the existing values.
      this.reset();

      var seq = this.context.element.getAttribute('seq');
      if (seq) {
         this.elements.actionNumber.text(seq);
      }

      var actiontype = this.context.element.getAttribute('type');
      switch (actiontype) {
         case "browser":
            var actionType = this.context.getMessage("deja_results_actionType_" + actiontype);
            this.elements.actionType.text(actionType);
            break;
         case "dummy":
            // just to make jslint quiet
            break;
         default:
            break;
      }

      var description = this.context.getAttribute('description');
      if (description) {
         this.elements.actionDesc.text(description);
         this.elements.actionDesc.attr('title', description);
      }

      var urlrequested = this.context.getAttribute('urlrequested');
      if (urlrequested) {
         this.elements.urlRequested.text(urlrequested);
         this.elements.urlRequested.attr('title', urlrequested);

         this.elements.urlRequestedBox.show();
      }

      // We only display the originally requested URL as the target,
      // unless it was redirected, then we show both the requested
      // and finalized URLs.
      var urlfinalized = this.context.getAttribute('urlfinalized');
      // strip any trailing slash character from both urls before matching
      urlrequested = (urlrequested) ? urlrequested.replace(/\/$/,"") : "";
      urlfinalized = (urlfinalized) ? urlfinalized.replace(/\/$/,"") : "";
      if (urlfinalized && (urlfinalized != urlrequested)) {
         this.elements.urlFinalized.text(urlfinalized);
         this.elements.urlFinalized.attr('title', urlfinalized);

         this.elements.urlFinalizedBox.show();
      }

      var numEvents = this.context.getNumber("count(child::event)");
      var args = [numEvents];
      var contains;
      if (numEvents > 1) {
         contains = this.context.getMessage("deja_results_actionContains1", args);
      } else {
         contains = this.context.getMessage("deja_results_actionContains2", args);
      }
      this.elements.actionContains.text(contains);

      this.elements.advancedOnly.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);
      this.elements.diagnosticOnly.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      this.results.refresh();
   },

   /**
    * Reset the UI to the default values.
    * @this {!DejaClickUi.ActionResults}
    */
   reset: function () {
      this.elements.actionNumber.text('');
      this.elements.actionType.text('');

      this.elements.actionDesc.text('');
      this.elements.actionDesc.attr('title', '');

      this.elements.urlRequestedBox.hide();
      this.elements.urlFinalizedBox.hide();

      this.elements.actionContains.text('');
   }
}; // End of DejaClickUi.ActionResults.prototype


/**
 * Results of event replay.
 * @constructor
 * @implements {DejaClickUi.Results}
 * @param {!DejaClickUi.ResultsContext} aContext The context of the results.
 */
DejaClickUi.EventResults = function (aContext) {
   this.context = aContext;

   this.elements = {
      section: $('#eventInfo'),
      eventNumber: $('#eventNumber'),
      eventType: $('#eventType'),
      eventTarget: $('#eventTarget'),
      eventDesc: $('#eventDesc'),
      redirectURLBox: $('#eventRedirectURLBox'),
      redirectURL: $('#eventRedirectURL')
   };

   this.elements.advancedOnly = this.elements.section.find('.advancedOnly');
   this.elements.diagnosticOnly = this.elements.section.find('.diagnosticOnly');

   this.results = new DejaClickUi.ReplayResults(this.context);
};

DejaClickUi.EventResults.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.EventResults,

   /**
    * Shut down and release all external objects.
    * @this {!DejaClickUi.EventResults}
    */
   close: function () {
      delete this.elements;
      delete this.context;
   },

   /**
    * Update the UI for the current context.
    * @this {!DejaClickUi.EventResults}
    */
   refresh: function () {

      // Clear the existing values.
      this.reset();

      var seq = this.context.element.getAttribute('seq');
      if (seq) {
         this.elements.eventNumber.text(seq);
      }

      var eventtype = this.context.element.getAttribute('type');
      var eventType;
      switch (eventtype) {
         case "navigate":
         case "click":
         case "move":
         case "drag":
         case "change":
         case "focus":
         case "hover":
            eventType = this.context.getMessage("deja_results_eventType_" + eventtype);
            var isScreenEvent = this.context.element.getAttribute('screen');
            if (isScreenEvent) {
               eventType = this.context.getMessage("deja_results_eventType_screen", [eventType]);
            }
            this.elements.eventType.text(eventType);
            break;
         case "winopen":
         case "winclose":
         case "tabopen":
         case "tabclose":
         case "tabfocus":
            eventType = this.context.getMessage("deja_results_eventType_" + eventtype);
            this.elements.eventType.text(eventType);
            break;
         default:
            break;
      }

      // Refresh the eventTarget.
      switch (eventtype) {
         case "navigate":
            this.refreshNavigateType();
            break;
         case "click":
         case "move":
         case "drag":
         case "change":
         case "focus":
         case "hover":
            this.refreshElementType();
            break;
         case "winopen":
         case "winclose":
         case "tabopen":
         case "tabclose":
         case "tabfocus":
            this.refreshBrowserType();
            break;
         default:
            break;
      }

      var description = this.context.getAttribute('description');
      if (description) {
         this.elements.eventDesc.text(description);
         this.elements.eventDesc.attr('title', description);
      }

      this.elements.advancedOnly.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);
      this.elements.diagnosticOnly.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      this.results.refresh();
   },

   /**
    * Update the UI for a navigate type event.
    * @this {!DejaClickUi.EventResults}
    */
   refreshNavigateType: function () {
      var urlrequested = this.context.getEventParam('urlrequested');
      if (urlrequested) {
         this.elements.eventTarget.text(urlrequested);
         this.elements.eventTarget.attr('title', urlrequested);
      }

      // We only display the originally requested URL as the target,
      // unless it was redirected, then we show both the requested
      // and finalized URLs.
      var urlfinalized = this.context.getEventParam('urlfinalized');
      // strip any trailing slash character from both urls before matching
      urlrequested = (urlrequested) ? urlrequested.replace(/\/$/,"") : "";
      urlfinalized = (urlfinalized) ? urlfinalized.replace(/\/$/,"") : "";
      if (urlfinalized && (urlfinalized != urlrequested)) {
         this.elements.redirectURL.text(urlfinalized);
         this.elements.redirectURL.attr('title', urlfinalized);

         this.elements.redirectURLBox.show();
      }
   },

   /**
    * Update the UI for an element type event.
    * @this {!DejaClickUi.EventResults}
    */
   refreshElementType: function () {
      var eventTarget;

      // try to grab the target ELEMENT breadcrumb tag from the script tree
      var elementName = this.context.getString("child::targets/target[@type='element']/breadcrumbs/crumb/@tag");
      if (elementName) {
         eventTarget = this.context.getMessage('deja_results_eventTarget_element', [elementName]);
      } else {
         // otherwise, grab the target DOCUMENT breadcrumb tag from the script tree
         var documentName = this.context.getString("child::targets/target[@type='document']/breadcrumbs/crumb/@tag");
         if (documentName) {
            eventTarget = this.context.getMessage('deja_results_eventTarget_document');
         } else {
            // something went wrong
            eventTarget = this.context.getMessage('deja_results_notAvailable');
         }
      }
      this.elements.eventTarget.text(eventTarget);

      // Clear tooltip.
      this.elements.eventTarget.attr('title', '');
   },

   /**
    * Update the UI for a browser type event.
    * @this {!DejaClickUi.EventResults}
    */
   refreshBrowserType: function () {
      var eventTarget = this.context.getMessage('deja_results_eventTarget_browser');
      this.elements.eventTarget.text(eventTarget);

      // Clear tooltip.
      this.elements.eventTarget.attr('title', '');
   },

   /**
    * Reset the UI to the default values.
    * @this {!DejaClickUi.EventResults}
    */
   reset: function () {
      this.elements.eventNumber.text('');
      this.elements.eventType.text('');

      this.elements.eventTarget.text('');
      this.elements.eventTarget.attr('title', '');

      this.elements.eventDesc.text('');
      this.elements.eventDesc.attr('title', '');

      this.elements.redirectURLBox.hide();
   }
}; // End of DejaClickUi.EventResults.prototype


/**
 * Detailed results of replay.
 * @constructor
 * @implements {DejaClickUi.Results}
 * @param {!DejaClickUi.ResultsContext} aContext The context of the results.
 */
DejaClickUi.ReplayResults = function (aContext) {
   this.context = aContext;

   this.elements = {
      section: $('#replayResults'),
      replayDetailsBox: $('#replayDetailsBox'),
      statusMessage: $('#statusMessage'),
      statusImage: $('#statusImage'),
      statusReason: $('#statusReason'),
      statusCodeBox: $('#statusCodeBox'),
      statusCode: $('#statusCode'),
      statusLogIDBox: $('#statusLogIDBox'),
      statusLogID: $('#statusLogID'),
      matchResultsBox: $('#matchResultsBox'),
      targetsFound: $('#targetsFound'),
      matchScore:$('#matchScore'),
      networkResultsBox: $('#networkResultsBox'),
      networkSteps:$('#networkSteps'),
      replayedOnBox: $('#replayedOnBox'),
      replayedOn: $('#replayedOn')
   };

   this.elements.advancedOnly = this.elements.section.find('.advancedOnly');
   this.elements.diagnosticOnly = this.elements.section.find('.diagnosticOnly');
};

DejaClickUi.ReplayResults.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ReplayResults,

   /**
    * Shut down and release all external objects.
    * @this {!DejaClickUi.ReplayResults}
    */
   close: function () {
      delete this.elements;
      delete this.context;
   },

   /**
    * Update the UI for the current context.
    * @this {!DejaClickUi.ReplayResults}
    */
   refresh: function () {

      // Clear the existing values.
      this.reset();

      this.elements.advancedOnly.toggle(this.context.displayLevel >=
         this.context.constants.DISPLAYLEVEL_ADVANCED);
      this.elements.diagnosticOnly.toggle(this.context.displayLevel ===
         this.context.constants.DISPLAYLEVEL_DIAGNOSTIC);

      // Get a list of the events in the current context that have been replayed.
      var query;
      var category = this.context.category;
      var seq = this.context.element.getAttribute('seq');
      switch (category) {
         case 'script':
            query = "action/event";
            break;
         case 'subscript':
            query = "action/event[@orig_subscriptseq='" + seq + "']";
            break;
         case 'action':
            query = "action[@orig_seq='" + seq + "']/event";
            break;
         case 'event':
            query = "action/event[@orig_seq='" + seq + "']";
            break;
         default:
            break;
      }
      var replayedEventsRoot = this.context.getReplayActionsRootNode();
      var replayedEvents = (replayedEventsRoot) ?
         this.context.script.processXPath(replayedEventsRoot, query) :
         null;

      // Refresh the replay summary data.
      var hasStatus = this.refreshReplayStatus(replayedEvents);
      this.refreshReplayDetails(replayedEvents, hasStatus, replayedEventsRoot);
   },

   /**
    * Update the replay status UI.
    * @this {!DejaClickUi.ReplayResults}
    * @param {?Array.<!Element>} aReplayedEvents A list of replayed events, or null.
    * @return {boolean} true if a replay status can be determined, else false.
    */
   refreshReplayStatus: function (aReplayedEvents) {
      var category = this.context.category;

      var lastReplayedEventSeq;
      if (aReplayedEvents && aReplayedEvents.length) {
         lastReplayedEventSeq = aReplayedEvents[ aReplayedEvents.length-1 ].getAttribute('seq');
      } else {
         this.handleStatusUnknown();
         return false;
      }

      // Replay result data is available for the selected item type,
      // so populate the Status section of the results sidepanel...
      var statusAvailable = false;

      // Loop through all listed events and determine what our final status should be.
      // Note: we need to loop through all the status events here so that we can summarize
      // and populate whatever action statuses we can, since not all action status data
      // may be available for incomplete replays.
      var statusType, statusNodeIndex;
      for (var i=0; i < aReplayedEvents.length; i++) {
         if (aReplayedEvents[i].hasAttribute("statustype")) {
            var statustype = aReplayedEvents[i].getAttribute("statustype");
            statusType = Number(statustype);
         } else {
            statusAvailable = false;
            break;
         }
         if (statusType == this.context.constants.DC_REPLAY_SUCCESS) {
            if ((category == 'script') || (category == 'subscript') || (category == 'action')) {
               // A final replay status of 'successful' is set
               // only if the last replayed event had a status of success.
               if (aReplayedEvents[i].getAttribute('seq') == lastReplayedEventSeq) {
                  statusAvailable = true;
                  statusNodeIndex = i;
                  break;
               }
            } else { // (category == 'event')
               // For events, we always set statusAvailable to true, as
               // its very existence signals that the event had a status.
               statusAvailable = true;
               statusNodeIndex = i;
            }
         } else {
            // Any unsuccessful state we encounter automatically
            // stops the search -- no need to look any further.
            statusAvailable = true;
            statusNodeIndex = i;
            break;
         }
      }

      if (statusAvailable) {
         var messageID, statusMessage, statusReason, httpReason;

         // match the statusType to its status message
         switch (statusType) {
            case this.context.constants.DC_REPLAY_SUCCESS:
               messageID = "dcMessage_replaysuccess";
               break;
            case this.context.constants.DC_REPLAY_WARNING:
               messageID = "dcMessage_replaywarning";
               break;
            case this.context.constants.DC_REPLAY_ERROR:
               messageID = "dcMessage_replayfailure";
               break;
            default:
               messageID = "dcMessage_statusunknown";
               break;
         }
         if (messageID) {
            statusMessage = this.context.getMessage(messageID);
         }
         this.elements.statusMessage.text(statusMessage);

         var statuscode = aReplayedEvents[statusNodeIndex].getAttribute('statuscode');
         this.elements.statusCode.text(statuscode);
         if (statuscode) {
            this.elements.statusCodeBox.show();
         } else {
            this.elements.statusCodeBox.hide();
         }

         var statusCode = Number(statuscode);
         messageID = aReplayedEvents[statusNodeIndex].getAttribute('statusmsg');
         if (messageID) {
            if (statusCode == 7) {
               // for http errors (status 7), we also embed the http
               //  message ID within the main status reason message
               var httpcode = aReplayedEvents[statusNodeIndex].getAttribute('httperrorcode');
               if (httpcode) {
                  httpReason = this.context.getMessage('dcFailure_HTTP' + httpcode);
               } else {
                  httpReason = this.context.getMessage('dcFailure_HTTPNUL');
               }
               statusReason = this.context.getMessage(messageID, [ httpReason ]);
            } else {
               statusReason = this.context.getMessage(messageID);
            }
         }
         this.elements.statusReason.text(statusReason);

         var statuslogid;
         if (aReplayedEvents[statusNodeIndex].hasAttribute('statuslogid')) {
            statuslogid = aReplayedEvents[statusNodeIndex].getAttribute('statuslogid');
            //TODO: we don't have this in Chrome
            //this.elements.statusLogID.text(statuslogid);
            this.elements.statusLogID.text('XXXXX');
            this.elements.statusLogID.attr('title', statuslogid);
         }
         if (statuslogid) {
            this.elements.statusLogIDBox.show();
         } else {
            this.elements.statusLogIDBox.hide();
         }

         var statusImage = this.elements.statusImage.get(0);
         statusImage.setAttribute('statustype', statusType);
      } else {
         this.handleStatusUnknown();
         return false;
      }

      return statusAvailable;
   },

   /**
    * Update the replay details UI.
    * @this {!DejaClickUi.ReplayResults}
    * @param {?Array.<!Element>} aReplayedEvents A list of replayed events, or null.
    * @param {boolean} aHasReplayStatus Was a final replay status able to be detemined?
    * @param {?Element} aReplayedEventsRoot The replayed actions root node, or null.
    */
   refreshReplayDetails: function (aReplayedEvents, aHasReplayStatus, aReplayedEventsRoot) {
      var eventNode, matchScoreTotal=0, numTargetsFound=0, numTargetsSearched=0;
      var httpSteps=0, httpStepsEvt=0;
      var resultsDataAvailable = false;

      if (aReplayedEvents && aReplayedEvents.length) {
         // loop over all events nodes to accumulate totals
         for (var i=0; i < aReplayedEvents.length; i++) {
            resultsDataAvailable = true;
            eventNode = aReplayedEvents[i];
            if (eventNode.hasAttribute("matchscore")) {
               matchScoreTotal += Number(eventNode.getAttribute("matchscore"));
            }

            if (eventNode.hasAttribute("targetfound")) {
               ++numTargetsSearched;
               numTargetsFound += (eventNode.getAttribute("targetfound")=="yes")?1:0;
            }

            if (eventNode.hasAttribute("httpsteps")) {
               httpStepsEvt = parseInt(eventNode.getAttribute("httpsteps"), 10);
            }

            // accumulate totals....
            httpSteps  += httpStepsEvt;
         }
      }

      if (resultsDataAvailable) {
         // result data is available, so display the Match, and HTTP results sections...
         var matchScore = (matchScoreTotal) ? (matchScoreTotal / numTargetsSearched) : 0;

/*
         // TODO
         // calculate the width of the dim (unlit) portion of the matchscore meter
         var widthDim = MAX_MATCHSCORE_SEGMENTS * MATCHSCORE_SEGMENT_WIDTH;
         // calculate the width of the lit portion of the matchscore meter
         var widthLit = ((MAX_MATCHSCORE_SEGMENTS * matchscore).toFixed(0)) * MATCHSCORE_SEGMENT_WIDTH;

         // dynamically set the widths of both (stacked) matchscore meter hbox's
         gDejaResults.elems.meterDim.width = widthDim;
         gDejaResults.elems.meterLit.width = widthLit;
*/

         var matchScorePercent = (matchScore * 100).toFixed(0);
         this.elements.matchScore.text(matchScorePercent);

         var args = [numTargetsFound, numTargetsSearched];
         var targetsFound = this.context.getMessage("deja_results_targetsFound", args);
         this.elements.targetsFound.text(targetsFound);

         this.elements.matchResultsBox.show();

         this.elements.networkSteps.text(httpSteps);
         this.elements.networkResultsBox.show();
      } else {
         // no result data, so hide the Match and HTTP results sections...
         var notAvailString = this.context.getMessage('deja_results_notAvailable');
         this.elements.networkSteps.text(notAvailString);

         this.elements.matchResultsBox.hide();
         this.elements.networkResultsBox.hide();
      }

      if (aHasReplayStatus || resultsDataAvailable) {
         // if any data is available - display the Replayed-On timestamp...
         var timestamp = aReplayedEventsRoot.getAttribute("generated");
         var replayedOn = this.context.getMessage('deja_results_lastReplayedOn', [timestamp]);
         this.elements.replayedOn.text(replayedOn);

         this.elements.replayedOnBox.show();
      } else {
         this.elements.replayedOnBox.hide();
      }
   },

   /**
    * Update the UI for when the replay status is unknown.
    * @this {!DejaClickUi.ReplayResults}
    */
   handleStatusUnknown: function () {
      var statusMessage = this.context.getMessage('deja_results_replayStatus_unknown');
      this.elements.statusMessage.text(statusMessage);
      var statusReason = this.context.getMessage('deja_results_noStatus_' + this.context.category);
      this.elements.statusReason.text(statusReason);

      var statusImage = this.elements.statusImage.get(0);
      if (statusImage && statusImage.hasAttribute('statustype')) {
         statusImage.removeAttribute('statustype');
      }

      this.elements.statusCodeBox.hide();
      this.elements.statusLogIDBox.hide();
   },

   /**
    * Reset the UI to the default values.
    * @this {!DejaClickUi.ReplayResults}
    */
   reset: function () {
   }
}; // End of DejaClickUi.ReplayResults.prototype


// Results instance created in sidebar.
