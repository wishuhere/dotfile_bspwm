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
 * DejaClick extension options page.
 * Input: {} None
 * Output: {} None
 */

/*global DejaClickUi,$,document,window,DejaClick*/

'use strict';

/**
 * Class to encapsulate the functionality of the DejaClick options window.
 * @constructor
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function():?DejaClick.Script} aGetScript Function to retrieve the
 *    script being processed by the extension.
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
 * } ADisplayLevel The DisplayLevelSelector constructor.
 */
DejaClickUi.Options = function (aUtils, aConstants, aGetScript,
      AEventRegistration, ADialogWindow, ADisplayLevel, AVariable) {
   this.utils = aUtils;
   this.restApi = aUtils.restApi;
   this.logger = aUtils.logger;
   this.getMessage = aUtils.getMessage;
   this.constants = aConstants;
   this.getScript = aGetScript;
   this.EventRegistration = AEventRegistration;
   this.DialogWindow = ADialogWindow;
   this.Variable = AVariable;

   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:preferences',
         this.displayPreferenceChange, this);

   this.state = {
      recordProperties: null,
      replayProperties: null,
      dialog: null,
      preferences: {}
   };

   this.elements = {
      toolbar: $('#toolbarDiv'),
      generalButton: $('#generalTabButton'),
      recordButton: $('#recordTabButton'),
      replayButton: $('#replayTabButton'),
      tabButtons: $('#generalTabButton,#recordTabButton,#replayTabButton'),
      headerLine: $('#headerDiv'),
      tabLabel: $('#tabLabel'),
      generalTab: $('#generalTab'),
      recordTab: $('#recordTab'),
      replayTab: $('#replayTab'),
      allTabs: $('section.tabs'),
      actionBar: $('#actionBar'),
      recordFrame: $('#recordPropertiesFrame').contents().prop('defaultView'),
      replayFrame: $('#replayPropertiesFrame').contents().prop('defaultView'),
      applyButton: $('#applyButton'),
      resetButton: $('#resetButton'),
      restApiEndpoint: $('#restApiEndpoint'),
      allInputs: $('input'),
      allButtons: $('button'),
      actionButtons: $('#refreshButton,#applyButton,#resetButton'),
      advancedOnly: $('.advancedOnly'),
      diagnosticOnly: $('.diagnosticOnly')
   };

   this.displayLevel = new ADisplayLevel(
      'x',
      $('#displayLevel')[0],
      this.displayDisplayLevel.bind(this),
      this.constants,
      this.utils,
      this.EventRegistration);

   aUtils.localizeTree(document.documentElement, 'deja_');

   this.definePreferenceCheckbox($('#highlight'), 'DC_OPTID_HIGHLIGHTACTIVE');
   this.definePreferenceCheckbox($('#scroll'), 'DC_OPTID_SCROLLTOACTIVE');
   this.definePreferenceCheckbox($('#notify'), 'DC_OPTID_NOTIFYCOMPLETE');
   this.definePreferenceCheckbox($('#skipTodOptions'),
      'DC_OPTID_SKIPTESTOPTSDLG');
   this.definePreferenceCheckbox($('#notify'), 'DC_OPTID_NOTIFYCOMPLETE');
   this.definePreferenceCheckbox($('#samlEnabled'), 'DC_OPTID_SAMLENABLED');
   this.definePreferenceValue($('#samlUrl'), 'DC_OPTID_SAMLURL');
   this.buildComboBox();
   $('#refreshButton').button().on('click', this.refreshPreferences.bind(this));

   this.elements.generalButton.button({ icons: { primary: 'general-icon' } });
   this.elements.recordButton.button({ icons: { primary: 'record-icon' } });
   this.elements.replayButton.button({ icons: { primary: 'replay-icon' } });
   this.elements.actionButtons.button();

   this.elements.tabButtons.on('click', this.switchTabs.bind(this));
   this.elements.allTabs.hide();
   this.elements.generalTab.show();

   this.elements.applyButton.on('click', this.applyAll.bind(this));
   this.elements.resetButton.on('click', this.resetAll.bind(this));

   $(this.elements.recordFrame).on('load', this.initRecordFrame.bind(this));
   $(this.elements.replayFrame).on('load', this.initReplayFrame.bind(this));

   $(window).on('resize', this.resizePanes.bind(this));
   this.resizePanes();
};

DejaClickUi.Options.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Options,

   /**
    * Shut down the options page in response to the window being closed.
    * @this {!DejaClickUi.Options}
    */
   close: function () {
      if (this.hasOwnProperty('state')) {
         if (this.state.recordProperties !== null) {
            this.state.recordProperties.close();
         }
         if (this.state.replayProperties !== null) {
            this.state.replayProperties.close();
         }
      }

      $(window).off('resize unload');
      if (this.hasOwnProperty('elements')) {
         this.elements.restApiEndpoint.autocomplete('destroy');
         this.elements.allInputs.off('change');
         $(this.elements.replayFrame).off('load');
         $(this.elements.recordFrame).off('load');
         this.elements.allButtons.off('click').button('destroy');
      }

      if (this.hasOwnProperty('displayLevel')) {
         this.displayLevel.close();
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.elements;
      delete this.state;
      delete this.displayLevel;
      delete this.events;
      delete this.Variable;
      delete this.DialogWindow;
      delete this.EventRegistration;
      delete this.getScript;
      delete this.constants;
      delete this.getMessage;
      delete this.logger;
      delete this.utils;
   },
   
   /**
    * Determine the set of possible REST endpoints and create a combo
    * box with these choices.
    * @this {!DejaClickUi.Options}
    */
   buildComboBox: function () {
      var endpoints, endpoint, selected, index, selectElt, optionElt;

      endpoints = this.utils.prefService.getPrefOption('DC_OPTID_RESTENDPOINTS').
         slice();

      endpoint = this.utils.prefService.getPrefOption('DC_OPTID_RESTENDPOINT');
      if (endpoints.indexOf(endpoint) === -1) {
         endpoints.push(endpoint);
      }
      selected = endpoint;
      endpoint = this.restApi.getEndpoint();
      if (endpoint.length !== 0) {
         if (endpoints.indexOf(endpoint) === -1) {
            endpoints.push(endpoint);
         }
         selected = endpoint;
      }

      endpoints.sort();
      this.utils.prefService.setPrefOption('DC_OPTID_RESTENDPOINTS', endpoints);

      this.elements.restApiEndpoint.autocomplete({
         source: endpoints,
         minLength: 0
      }).val(selected);
	  
      this.state.preferences['DC_OPTID_RESTENDPOINT'] = this.elements.restApiEndpoint;	  
      this.elements.restApiEndpoint.on('change', this.updateValuePreference.bind(this, 'DC_OPTID_RESTENDPOINT')).
      prop('value', this.utils.prefService.getPrefOption('DC_OPTID_RESTENDPOINT'));
   },
   
   /**
    * Define a relationship between a checkbox and a boolean preference.
    * Display the current value of the preference in the checkbox and
    * create events to keep them in sync.
    * @this {!DejaClickUi.Options}
    * @param {!jQuery} aElement A jQuery object that refers to a checkbox.
    * @param {string} aPref The name of the preference item with which
    *    the checkbox is associated.
    */
   definePreferenceCheckbox: function (aElement, aPref) {
      this.state.preferences[aPref] = aElement;
      aElement.on('change', this.updateBooleanPreference.bind(this, aPref)).
         prop('checked', this.utils.prefService.getPrefOption(aPref));
   },
   
   /**
    * Define a relationship between a textbox and the text preference.
    * Display the current value of the preference in the textbox and
    * create events to keep them in sync.
    * @this {!DejaClickUi.Options}
    * @param {!jQuery} aElement A jQuery object that refers to a checkbox.
    * @param {string} aPref The name of the preference item with which
    *    the checkbox is associated.
    */
   definePreferenceValue: function (aElement, aPref) {
      this.state.preferences[aPref] = aElement;
      aElement.on('change', this.updateValuePreference.bind(this, aPref)).
         prop('value', this.utils.prefService.getPrefOption(aPref));

   },
   
   /**
    * Initialize the record properties frame once it has been loaded.
    * @this {!DejaClickUi.Options}
    * @param {!Event} aEvent A jQuery load event on the properties frame.
    */
   initRecordFrame: function (aEvent) {
      var frameDeja;
      try {
         frameDeja = this.elements.recordFrame.DejaClickUi;
         this.state.recordProperties = frameDeja.properties =
            new frameDeja.Properties(DejaClick, this.utils,
               this.constants,
               this.getScript,
               this.openDialog.bind(this),
               this.EventRegistration,
               this.Variable);
         this.state.recordProperties.setContext('record');

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Initialize the replay properties frame once it has been loaded.
    * @this {!DejaClickUi.Options}
    * @param {!Event} aEvent A jQuery load event on the properties frame.
    */
   initReplayFrame: function (aEvent) {
      var frameDeja;
      try {
         frameDeja = this.elements.replayFrame.DejaClickUi;
         this.state.replayProperties = frameDeja.properties =
            new frameDeja.Properties(DejaClick, this.utils,
               this.constants,
               this.getScript,
               this.openDialog.bind(this),
               this.EventRegistration,
               this.Variable);
         this.state.replayProperties.setContext('play');

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Resize the panes in response to a window resize event.
    * @this {!DejaClick.Options}
    * @param {!Event=} opt_event A jQuery resize event on the window.
    */
   resizePanes: function (opt_event) {
      var availableHeight;

      try {
         availableHeight = window.innerHeight;
         // Remove height of toolbar.
         availableHeight -= this.elements.toolbar.outerHeight(true);
         // Remove height of header line.
         availableHeight -= this.elements.headerLine.outerHeight(true);
         // Remove height of action buttons.
         availableHeight -= this.elements.actionBar.outerHeight(true);
         // Remove an additional fudge factor.
         availableHeight -= 30;

         // Enforce a minimum height.
         if (availableHeight < 200) {
            availableHeight = 200;
         }

         this.elements.allTabs.height(availableHeight);

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display the newly selected tab.
    * @this {!DejaClickUi.Options}
    * @param {!Event} aEvent A jQuery click event on a tab icon.
    */
   switchTabs: function (aEvent) {
      var tabType;

      try {
         this.elements.allTabs.hide();
         tabType = aEvent.target.parentNode.getAttribute('value');
         this.elements.tabLabel.text(
            this.getMessage('deja_options_' + tabType + 'TabLabel'));
         this.elements[tabType + 'Tab'].show();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * React to a modified preference value. Update the UI if appropriate.
    * Called in response to the dejaclick:preferences event.
    * @this {!DejaClickUi.Sidebar}
    * @param {!{key:string, newValue:*, oldValue:*}} aData Details of the
    *    modified preference value.
    */
   displayPreferenceChange: function (aData) {
      var id;
      try {
         id = aData.key;
         if (this.hasOwnProperty.call(this.state.preferences, id)) {
            if (id === 'DC_OPTID_SAMLURL' || id === 'DC_OPTID_RESTENDPOINT') {
	       this.state.preferences[id].prop('value', aData.newValue);
            }
            else {
               this.state.preferences[id].prop('checked', aData.newValue);
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the display based upon the new display level.
    * @this {!DejaClickUi.Sidebar}
    * @param {integer} aLevel The new display level.
    */
   displayDisplayLevel: function (aLevel) {
      this.elements.advancedOnly.
         toggle(aLevel >= this.constants.DISPLAYLEVEL_ADVANCED);
	  this.elements.diagnosticOnly.
         toggle(aLevel >= this.constants.DISPLAYLEVEL_DIAGNOSTIC);
   },

   /**
    * Modify the value of a boolean preference item to match the value
    * in the UI. Called when the value is changed in the UI.
    * @this {!DejaClickUi.Options}
    * @param {string} aPref The name of the preference associated with
    *    the changed value.
    * @param {!Event} aEvent A jQuery change event on a checkbox.
    */
   updateBooleanPreference: function (aPref, aEvent) {
      try {
         this.utils.prefService.setPrefOption(aPref, aEvent.target.checked);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },
   
   /**
    * Modify the value of a string preference item to match the value
    * in the UI. Called when the value is changed in the UI.
    * @this {!DejaClickUi.Options}
    * @param {string} aPref The name of the preference associated with
    *    the changed value.
    * @param {!Event} aEvent A jQuery change event on a checkbox.
    */
   updateValuePreference: function (aPref, aEvent) {
      try {

         if (aPref === 'DC_OPTID_RESTENDPOINT') {
            if (aEvent.target.value.length === 0) {
               window.alert(this.getMessage('deja_connect_missingendpoint'));
               this.state.preferences['DC_OPTID_RESTENDPOINT'].prop('value', this.utils.prefService.getPrefOption(aPref));
               return;
	    }
  	    var endpoints = this.prefService.getPrefOption('DC_OPTID_RESTENDPOINTS').slice();
            var endpoint = aEvent.target.value;
            if (endpoints.indexOf(endpoint) === -1) {
               endpoints.push(endpoint);
               endpoints.sort();
               this.prefService.setPrefOption('DC_OPTID_RESTENDPOINTS',
                  endpoints);
	    }
         }
         this.utils.prefService.setPrefOption(aPref, aEvent.target.value);

      } catch (ex) {
         this.logger.logException(ex);
      }
   },
   
   /**
    * Reload all preference settings from the persistent store.
    * @this {!DejaClickUi.Options}
    * @param {!Event} aEvent A jQuery click event on the refresh button.
    */
   refreshPreferences: function (aEvent) {
      try {
         this.utils.prefService.refresh();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Apply all changes made in the options window.
    * @this {!DejaClickUi.Options}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   applyAll: function (aEvent) {
      try {
         var endpoint = this.elements.restApiEndpoint.val();
         if (endpoint.length === 0) {
            window.alert(this.getMessage('deja_connect_missingendpoint'));
            return;
         }    
         else {
            this.utils.prefService.setPrefOption('DC_OPTID_RESTENDPOINT', endpoint);
            var endpoints = this.utils.prefService.
               getPrefOption('DC_OPTID_RESTENDPOINTS').slice();
            if (endpoints.indexOf(endpoint) === -1) {
               endpoints.push(endpoint);
               endpoints.sort();
               this.utils.prefService.setPrefOption('DC_OPTID_RESTENDPOINTS',
                  endpoints);
               this.elements.restApiEndpoint.autocomplete({
                  source: endpoints,
                  minLength: 0
               }).val(endpoint);
            }

         }	
         var saml_url = this.utils.prefService.getPrefOption('DC_OPTID_SAMLURL');
         if (saml_url) {
            if (!this.restApi.isMatchingDomain(endpoint, saml_url)) {
	       window.alert(this.getMessage('deja_options_urlmismatch'));
            }
         }
         this.state.recordProperties.broadcastActive('apply');
         this.state.replayProperties.broadcastActive('apply');
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Return the extension to its default state.
    * @this {!DejaClickUi.Options}
    * @param {!Event} aEvent A jQuery click event on the reset button.
    */
   resetAll: function (aEvent) {
      var pref;
      try {
         this.state.recordProperties.broadcastActive('reset');
         this.state.replayProperties.broadcastActive('reset');
         for (pref in this.state.preferences) {
            if (this.hasOwnProperty.call(this.state.preferences, pref)) {
               this.utils.prefService.resetPrefOption(pref);
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window and disable all the controls in the options window.
    * @this {!DejaClickUi.Options}
    * @param {string} aUrl Relative URL of the dialog page to be opened.
    * @param {*=} opt_args Arguments to pass to the dialog window.
    * @param {function(*)=} opt_callback Optional callback to invoke
    *    to process the result of the dialog window.
    */
   openDialog: function (aUrl, opt_args, opt_callback) {
      if (this.state.dialog == null) {
         this.state.dialog = new this.DialogWindow(aUrl,
            ((opt_args == null) ? null : opt_args),
            this.centerDialog.bind(this),
            this.closeDialog.bind(this,
               ((opt_callback == null) ? null : opt_callback)),
            this.logger);
         if (this.state.recordProperties !== null) {
            this.state.recordProperties.openParentDialog();
         }
         if (this.state.replayProperties !== null) {
            this.state.replayProperties.openParentDialog();
         }
         this.enableControls();
      }
   },

   /**
    * Center the dialog over the options window.
    * @this {!DejaClickUi.Options}
    * @param {!DejaClick.DialogWindow} aDialog The dialog window to be centered.
    */
   centerDialog: function (aDialog) {
      try {
         aDialog.centerOn(window);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Clean up after a dialog window has been closed. Enable the
    * controls in the options window. Handle the dialog result.
    * @this {!DejaClickUi.Options}
    * @param {?function(*)} aCallback Function to handle the result
    *    of the dialog.
    * @param {*} aResult Value returned from the dialog.
    */
   closeDialog: function (aCallback, aResult) {
      try {
         this.state.dialog = null;
         if (this.state.recordProperties !== null) {
            this.state.recordProperties.closeParentDialog();
         }
         if (this.state.replayProperties !== null) {
            this.state.replayProperties.closeParentDialog();
         }
         this.enableControls();
         if (aCallback !== null) {
            aCallback(aResult);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable controls in the options window.
    * @this {!DejaClickUi.Options}
    */
   enableControls: function () {
      // @todo Implement
      //this.displayLevel.enableControls(true);
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('options')) {
            DejaClickUi.options.close();
            delete DejaClickUi.options;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      DejaClickUi.options = new DejaClickUi.Options(DejaClick.getUtils(),
         DejaClick.constants,
         DejaClick.getScript,
         DejaClick.EventRegistration,
         DejaClick.DialogWindow,
         DejaClickUi.DisplayLevelSelector,
         DejaClick.Variable);
      $(window).on('unload', unload);
   } catch (ex) {
      DejaClick.getUtils().logger.logException(ex);
   }
});
