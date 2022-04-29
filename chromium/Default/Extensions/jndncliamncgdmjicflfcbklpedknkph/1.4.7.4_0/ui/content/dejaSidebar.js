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
 * DejaClick extension sidebar window. This displays the toolbar, the
 * script view, and properties and results of the script.
 * Input: {!chrome.Tab} The tab in which the browser action was clicked.
 * Output: {} None
 */

/*global DejaClickUi,$,document,window,FileReader,Blob,Event,DejaClick,chrome*/

'use strict';

/**
 * Preferred width of the sidebar.
 * @const
 */
var preferredWidth = DejaClick.constants.SIDEBAR_WIDTH;
/**
 * Preferred height of the sidebar.
 * @const
 */
var preferredHeight = 600;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

/**
 * Class to encapsulate the major functionality of the DejaClick sidebar.
 * @constructor
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {function():?DejaClick.Script} aGetScript Function to retrieve the
 *    script being processed by the extension.
 * @param {function(!DejaClick.Script)} aSetScript Function to set the
 *    script being processed by the extension.
 * @param {integer} aRunMode The run mode at the time the sidebar was created.
 * @param {function(integer)} aSetRunMode Function to change the current
 *    run mode.
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
 * @param {function(new:DejaClick.Script)} AScript The script constructor.
 * @param {function(new:DejaClick.Script)} AVariable The script variable utils constructor.
 * @param {!chrome.ExtensionApi} aExtension The chrome.extension API.
 * @param {!chrome.TabsApi} aTabs The chrome.tabs API.
 * @param {!chrome.WindowsApi} aWindows The chrome.windows API.
 * @param {?chrome.DownloadsApi} aDownloads The chrome.downloads API.
 * @param {!chrome.RuntimeApi} aRuntime The chrome.runtime API.
 */
DejaClickUi.Sidebar = function (aUtils, aConstants,
      aGetScript, aSetScript, aRunMode, aSetRunMode,
      AEventRegistration, ADialogWindow, AScript, AVariable,
      aExtension, aTabs, aWindows, aDownloads, aRuntime) {
   var prefs, observerService;

   // Get references to background objects, especially the logger.
   this.utils = aUtils;
   this.logger = aUtils.logger;
   this.prefService = prefs = aUtils.prefService;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;
   this.constants = aConstants;
   this.getScript = aGetScript;
   this.setScript = aSetScript;
   this.setRunMode = aSetRunMode;
   this.EventRegistration = AEventRegistration;
   this.DialogWindow = ADialogWindow;
   this.Script = AScript;
   this.Variable = AVariable;
   this.extensionApi = aExtension;
   this.tabsApi = aTabs;
   this.windowsApi = aWindows;
   this.downloadsApi = aDownloads;
   this.runtimeApi = aRuntime;

   observerService = aUtils.observerService;
   this.events = new AEventRegistration().
      addDejaListener(observerService, 'dejaclick:preferences',
         this.dispatchPreferenceChange, this).
      addDejaListener(observerService, 'dejaclick:restapi',
         this.displayRestActivity, this).
      addDejaListener(observerService, 'dejaclick:treeclicked',
         this.displaySelectedTreeRow, this).
      addDejaListener(observerService, 'dejaclick:runmode',
         this.onRunModeUpdated, this).
      addDejaListener(observerService, 'dejaclick:runstate',
         this.updateRunState, this).
      addDejaListener(observerService, 'dejaclick:suggestedkeyword',
         this.displaySuggestedKeyword, this).
      addDejaListener(observerService, 'dejaclick:eventblocked',
         this.onEventBlocked, this).
      addDejaListener(observerService, 'dejaclick:mobileoptionschange',
         this.fillMobileDevices, this).
      addDejaListener(observerService, 'dejaclick:loginresponse',
         this.loginResponse, this);		 
   if (aDownloads != null) {
      this.events.addChromeListener(this.downloadsApi.onChanged,
                                    this.onDownloadChanged, this);
   }
   this.prefHandlers = {
      DC_OPTID_DISPLAYLEVEL: this.displayDisplayLevel,
      DC_OPTID_AUTOREPLAYPAUSE: this.displayReplayMode,
      DC_OPTID_EVENTDELAY: this.displayReplaySpeed,
      DC_OPTID_READYTIMEOUT: this.displayReplaySpeed,
      DC_OPTID_DISPATCHDELAY: this.displayReplaySpeed
   };

   this.state = {
      optionsUrl: this.extensionApi.getURL('ui/content/dejaOptions.html'),
      submitting: false,
      dialog: null,
      results: null,
      properties: null,
      treeViewFraction: 0.4,
      resize: null,
      runmode: aRunMode,
      runmode2: aRunMode,
      validationmode: false,
      validationtype: '',
      selectedMobileDeviceID: '',
      currentDownload: null
   };

   // Initialize the window.
   this.elements = {
      document: $(document),
      body: $('body'),

      openButton: $('#openButton'),
      saveButton: $('#saveButton'),
      recordButton: $('#recordButton'),
      chooseMobileButton: $('#chooseMobileButton'),
      chooseMobileMenu: $('#chooseMobileMenu'),
      chooseAppendModeButton: $('#chooseAppendModeButton'),
      chooseAppendModeRadio: $('input[name="appendmode"]'),
      playButton: $('#playButton'),
      chooseReplayModeButton: $('#chooseReplayModeButton'),
      pauseButton: $('#pauseButton'),
      stopButton: $('#stopButton'),
      closeDecorateButton: $('#closeDecorateButton'),
      decorateButton: $('#decorateButton'),
      todButton: $('#testOnDemandButton'),
      optionsButton: $('#optionsButton'),
      loginButton: $('#loginButton'),
      monitorButton: $('#monitorButton'),
      helpButton: $('#helpButton'),
      allButtons: $('button'),

      allMenus: $('ul.toolbarMenu'),
      nonReplayOptions: $('#optionsMenu').children('li').not('#replayModeItem'),
      displayLevelItems: $('#displayLevelItem').find('ul span'),
      displayLevelBasicItem: $('#displayLevelBasicItem').find('span'),
      displayLevelAdvancedItem: $('#displayLevelAdvancedItem').find('span'),
      displayLevelDiagnosticItem: $('#displayLevelDiagnosticItem').find('span'),
      replayModeItem: $('#replayModeItem'),
      replayModeItems: $('#chooseReplayModeMenu').find('span'),
      replayAllItem: $('#replayAllItem').find('span'),
      replayActionItem: $('#replayActionItem').find('span'),
      replayEventItem: $('#replayEventItem').find('span'),

      needsScriptItems: $('li.needsScript'),

      toolbar: $('#mainToolbar'),

      keywordValidationToolbar: $('#keywordValidationToolbar'),
      jsValidationToolbar: $('#jsValidationToolbar'),
      keywordSelect: $('#keywordSelect'),
      keywordHelpButton: $('#keywordHelpButton'),
      keywordValBarCloseButton: $('#keywordValidationToolbarCloseButton'),
      jsValBarCloseButton: $('#jsValidationToolbarCloseButton'),
      keywordValidationItem: $('#keywordValidationItem'),
      jsValidationItem: $('#jsValidationItem'),

      contentViewItem: $('#contentViewItem'),

      treeviewBox: $('#treeviewBox'),
      expandLevel: $('#expandLevel'),
      treeview: $('#treeview'),

      splitter: $('#splitter'),

      tabsBar: $('#tabs'),
      resultsTab: $('#tabResults'),
      panelHeaders: $('div.panelHeader'),
      resultsLabel: $('#resultsLabel'),
      frameElements: $('iframe'),
      resultsFrame: $('#resultsFrame').contents().prop('defaultView'),
      propertiesTab: $('#tabProperties'),
      propertiesLabel: $('#propertiesLabel'),
      propertiesFrame: $('#propertiesFrame').contents().prop('defaultView')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   if (!prefs.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
      // Remove features only allowed in diagnostic mode.
      $('li.diagnostic').remove();
      if (prefs.getPrefOption('DC_OPTID_DISPLAYLEVEL') ===
            this.constants.DISPLAYLEVEL_DIAGNOSTIC) {
         prefs.setPrefOption('DC_OPTID_DISPLAYLEVEL',
            this.constants.DISPLAYLEVEL_BASIC);
      }
   }

   // Create jQuery UI widgets and set up event handlers.
   this.elements.allButtons.each(this.initializeButton);
   this.elements.openButton.on('click', this.triggerFileInput.bind(this));
   this.elements.saveButton.on('click', this.saveScript.bind(this));
   this.elements.recordButton.on('click', this.triggerRecording.bind(this));
   this.elements.playButton.on('click', this.beginReplay.bind(this));
   this.elements.pauseButton.on('click', this.pauseReplay.bind(this));
   this.elements.stopButton.on('click', this.stopRecordReplay.bind(this));

   this.elements.closeDecorateButton.on('click', this.disableValidationMode.bind(this));
   this.elements.todButton.on('click', this.configureTestOnDemand.bind(this));
   this.elements.loginButton.on('click', this.loginToAlertSite.bind(this));
   $('button.menuButton').on('click', this.displayMenu.bind(this));
   if(DejaClick.utils.autoUploadUrl){
       // Bind save action for monitor button.
       this.elements.monitorButton.unbind('click');
       this.elements.monitorButton.on('click', this.uploadScript.bind(this));
   }
   $(document).on({
      dragover: this.displayDragAndDropEffect.bind(this),
      drop: this.openDroppedScript.bind(this),
      click: this.hideMenus.bind(this)
   });

   this.elements.chooseMobileMenu.on('click', this.selectMobileDevice.bind(this));
   this.elements.chooseAppendModeRadio.on('click', this.setAppendMode.bind(this));

   this.elements.splitter.on('mousedown', this.splitStart.bind(this));

   this.elements.allMenus.menu({ select: this.dispatchMenuEvent.bind(this) });
   this.menuItemHandlers = {
      // Decorate Menu
      //contentViewItem: null,
      //noteStickyItem: null,
      //noteBalloonItem: null,
      //noteThoughtItem: null,
      //noteAnnotateItem: null,
      //notePlainItem: null,

      // Validations Menu
      keywordValidationItem: this.openKeywordValidationToolbar,
      jsValidationItem: this.openJsValidationToolbar,

      contentViewItem: this.addContentView,

      // Options Menu
      configureItem: this.findOptionsPage,
      displayLevelItem: null, // submenu
      displayLevelBasicItem: this.setDisplayLevel,
      displayLevelAdvancedItem: this.setDisplayLevel,
      displayLevelDiagnosticItem: this.setDisplayLevel,
      replayModeItem: null, // submenu
      replayAllItem: this.setReplayMode,
      replayActionItem: this.setReplayMode,
      replayEventItem: this.setReplayMode,
      replaySpeedItem: null, //submenu
      replayFasterItem: this.setReplaySpeed,
      replayNormalItem: this.setReplaySpeed,
      replaySlowerItem: this.setReplaySpeed,
      activeElementItem: null, //submenu

      // Monitor Menu
      logoffItem: this.logoutOfAlertSite,
      changeUserItem: this.changeUser,
      uploadItem: this.uploadScript,
      downloadItem: this.downloadScript,
      //shareRecordingItem: null,
      dashboardItem: this.displayAlertSiteDashboard,
      monitoringStatusItem: this.displayAlertSiteConsole,
      reportsItem: this.displayAlertSiteReports,
      //repositoryItem: null,

      // Help Menu
      quickStartGuideItem: null, // Navigation link
      helpTopicsItem: null, // Navigation link
      helpForumItem: null, // Navigation link
      learnMoreItem: null, // Navigation link
      freeTrialItem: null, // Navigation link
      dejaClickPageItem: null, // Navigation link
      alertSitePageItem: null, // Navigation link
      smartBearPageItem: null, // Navigation link
      aboutDejaClickItem: this.displayAboutPage
   };
   this.addMenuCheckBox('newVisitorItem', 'DC_OPTID_USENEWVISITOR');
   this.addMenuCheckBox('replayNotesItem', 'DC_OPTID_REPLAYNOTES');
   this.addMenuCheckBox('replayUEItem', 'DC_OPTID_REPLAYUE');
   this.addMenuCheckBox('useKeystrokesItem', 'DC_OPTID_USEKEYSTROKES');
   this.addMenuCheckBox('highlightItem', 'DC_OPTID_HIGHLIGHTACTIVE');
   this.addMenuCheckBox('scrollToItem', 'DC_OPTID_SCROLLTOACTIVE');
   this.addMenuCheckBox('blockPopupsItem', 'DC_OPTID_DISABLEPOPUPS');
   this.addMenuCheckBox('blockCookiesItem', 'DC_OPTID_DISABLECOOKIES');
   this.addMenuCheckBox('notifyWhenCompleteItem', 'DC_OPTID_NOTIFYCOMPLETE');
   this.addMenuCheckBox('encryptLocalItem', 'DC_OPTID_ENCRYPTLOCAL');
   this.elements.tabsBar.tabs({ active: 1 });

   this.elements.keywordValBarCloseButton.on('click', this.disableValidationMode.bind(this));
   this.elements.jsValBarCloseButton.on('click', this.disableValidationMode.bind(this));

   // Update display according to current settings.
   this.hideMenus();

   this.displayDisplayLevel(prefs.getPrefOption('DC_OPTID_DISPLAYLEVEL'));
   this.displayReplayMode(prefs.getPrefOption('DC_OPTID_AUTOREPLAYPAUSE'));
   this.displayReplaySpeed(0);
   this.enableControls();

   // Replace the non-editable select with an editable combobox.
   this.elements.keywordSelect.combobox({
      select: this.editKeyword.bind(this)
   });
   this.elements.keywordCombo = this.elements.keywordSelect.data('dejaui-combobox');
   this.elements.keywordCombo.input.on('keyup', this.enterKeyword.bind(this));

   // Set the keyword combobox's placeholder text.
   this.elements.keywordCombo.input.attr('placeholder',
         this.elements.keywordSelect.attr('placeholder'));

   this.prefService.setPrefOption('DC_OPTID_SIMULATEMOBILE', '');

   $(this.elements.resultsFrame).on('load', this.initResultsFrame.bind(this));
   $(this.elements.propertiesFrame).on('load',
      this.initPropertiesFrame.bind(this));

   $(window).on('resize', this.resizePanes.bind(this));

   this.resizePanes();

   this.fillMobileDevices();

   this.utils.promptService.setWindow(window);
   
};

DejaClickUi.Sidebar.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Sidebar,

   /**
    * Shut down the sidebar in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by the
    * sidebar and release all references to objects external to this
    * dialog.
    * @this {DejaClickUi.Sidebar}
    */
   close: function () {
      if (this.hasOwnProperty('state')) {
         if (this.state.properties !== null) {
            this.state.properties.close();
         }

         if (this.state.submitting && this.hasOwnProperty('restApi')) {
            this.state.submitting = false;
            this.restApi.abortRequest();
         }

         if (this.state.dialog !== null) {
            this.state.dialog.close();
            this.state.dialog = null;
         }
      }

      if (this.hasOwnProperty('elements')) {
         this.elements.document.off('click dragover drop mousemove mouseup mouseleave');
         this.elements.splitter.off('mousedown');
         this.elements.tabsBar.tabs('destroy');
         this.elements.allMenus.menu('destroy');
         this.elements.allButtons.off('click').button('destroy');
      }
      $(window).off('resize');

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.elements;
      delete this.prefHandlers;
      delete this.menuItemHandlers;
      delete this.state;
      delete this.events;
      delete this.runtimeApi;
      delete this.downloadsApi;
      delete this.windowsApi;
      delete this.tabsApi;
      delete this.extensionApi;
      delete this.Variable;
      delete this.Script;
      delete this.DialogWindow;
      delete this.EventRegistration;
      delete this.setRunMode;
      delete this.setScript;
      delete this.getScript;
      delete this.constants;
      delete this.getMessage;
      delete this.restApi;
      delete this.prefService;
      delete this.logger;
      delete this.utils;
   },

   /**
    * Turn a button element into a jQuery UI button widget.  The class
    * name of the button's icon is derived from the id of the button
    * (the Button suffix is replaced with -icon).
    * @this {DejaClickUi.Sidebar}
    * @param {integer} aIndex Index of the button element among all button
    *    elements to become button widgets.
    * @param {!Element} aButton The button element.
    */
   initializeButton: function (aIndex, aButton) {
      $(aButton).button({
         text: false,
         icons: {
            primary: aButton.getAttribute('id').slice(0,-6) + '-icon'
         }
      });
   },

   /**
    * Link a menu item to a boolean preference.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aMenuElementId The id of the li element for the menu item.
    * @param {string} aPrefId The id of the preference.
    */
   addMenuCheckBox: function (aMenuElementId, aPrefId) {
      var menuElement;

      this.menuItemHandlers[aMenuElementId] =
         this.togglePreference.bind(this, aPrefId);
      menuElement = $('#' + aMenuElementId).find('span');
      this.prefHandlers[aPrefId] =
         this.displayBooleanOption.bind(this, menuElement);
      this.displayBooleanOption(menuElement,
         this.prefService.getPrefOption(aPrefId));
   },

   /**
    * Initialize the results frame once it has been loaded.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery load event on the results frame.
    */
   initResultsFrame: function (aEvent) {
      var frameDeja;
      try {
         frameDeja = this.elements.resultsFrame.DejaClickUi;
         this.state.results = frameDeja.results = new frameDeja.Results(
            this.utils,
            this.constants,
            this.getScript,
            this.state.runmode,
            this.EventRegistration);
         this.state.results.setContext('1:script');
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Initialize the properties frame once it has been loaded.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery load event on the properties frame.
    */
   initPropertiesFrame: function (aEvent) {
      var frameDeja;
      try {
         frameDeja = this.elements.propertiesFrame.DejaClickUi;
         this.state.properties = frameDeja.properties =
            new frameDeja.Properties(DejaClick,
               this.utils,
               this.constants,
               this.getScript,
               this.openDialog.bind(this),
               this.EventRegistration,
               this.Variable);
         this.state.properties.setContext('1:script');

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * React to a modified preference value. Update the UI if appropriate.
    * Called in response to the dejaclick:preferences event.
    * @this {DejaClickUi.Sidebar}
    * @param {!{key:string, newValue:*, oldValue:*}} aData Details of the
    *    modified preference value.
    */
   dispatchPreferenceChange: function (aData) {
      var id;
      try {
         id = aData.key;
         if (this.prefHandlers.hasOwnProperty(id)) {
            this.prefHandlers[id].call(this, aData.newValue);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Adjust the display according to the current state of the REST API.
    * Enable or disable widgets that require an active session.
    * Update the label of the login/logoff menu item.
    * Called in response to the dejaclick:restapi event.
    * @this {DejaClickUi.Sidebar}
    * @param {!{active:boolean, connected:boolean}} aData Whether the
    *    REST API is active and connected.
    */
   displayRestActivity: function (aData) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the sidebar to display information about the script element
    * selected in the treeview.
    * Called in response to the dejaclick:treeclicked event.
    * @this {DejaClickUi.Sidebar}
    * @param {!{hashkey: string}} aData Hashkey of the selected element.
    */
   displaySelectedTreeRow: function (aData) {
      var parts;
      try {
         parts = aData.hashkey.split(':');
         this.elements.resultsLabel.text(this.getMessage('deja_sidebar_' +
            parts[1] + 'Results', parts[0]));
         this.elements.propertiesLabel.text(this.getMessage('deja_sidebar_' +
            parts[1] + 'Properties', parts[0]));
         if (this.state.results !== null) {
            this.state.results.setContext(aData.hashkey);
         }
         if (this.state.properties !== null) {
            this.state.properties.setContext(aData.hashkey);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Begin to adjust the size of the treeview and the properties panes.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery mousedown event on the splitter element.
    */
   splitStart: function (aEvent) {
      try {
         this.elements.document.on('mousemove', this.splitMove.bind(this)).
            on('mouseup', this.splitEnd.bind(this)).
            on('mouseleave', this.splitEnd.bind(this));
         this.elements.body.css('cursor', 'row-resize');
         this.state.resize = {
            initialPos: this.elements.treeviewBox.outerHeight(true) -
               aEvent.pageY,
            range: this.elements.treeviewBox.outerHeight(true) +
               this.elements.tabsBar.outerHeight(true)
         };
         aEvent.preventDefault();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Adjust the size of the treeview and the properties panes.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery mousemove event.
    */
   splitMove: function (aEvent) {
      var newPos;
      try {
         newPos = aEvent.pageY + this.state.resize.initialPos;
         if (newPos < 0) {
            newPos = 0;
         } else if (this.state.resize.range < newPos) {
            newPos = this.state.resize.range;
         }
         this.state.treeViewFraction = newPos / this.state.resize.range;
         this.resizePanes();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Stop adjusting the size of the treeview and the properties panes.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery mouseup or mouseleave event.
    */
   splitEnd: function (aEvent) {
      try {
         this.elements.document.off('mousemove mouseup mouseleave');
         this.elements.body.css('cursor', 'default');
         this.state.resize = null;
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Resize the panes in response to a window resize event.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event=} opt_event A jQuery resize event on the window.
    */
   resizePanes: function (opt_event) {
      var availableHeight, treeHeight, tabsHeight, width;

      try {
         // Find space available for variable height sections.
         availableHeight = window.innerHeight;
         // Remove total height of toolbars.
         availableHeight -= this.elements.toolbar.outerHeight(true);
         if (this.elements.keywordValidationToolbar.is(":visible")) {
            availableHeight -= this.elements.keywordValidationToolbar.outerHeight(true);
         }
         else if (this.elements.jsValidationToolbar.is(":visible")) {
            availableHeight -= this.elements.jsValidationToolbar.outerHeight(true);
         }
         // Remove total height of splitter.
         availableHeight -= this.elements.splitter.outerHeight(true);
         // Remove an additional fudge factor.
         availableHeight -= 20;
         if (availableHeight < 220) {
            availableHeight = 220;
         }

         // Determine space available for both treeview and properties tabs.
         treeHeight = Math.floor(this.state.treeViewFraction * availableHeight);
         tabsHeight = Math.floor(availableHeight - treeHeight);

         // Remove margin, border, and padding of treeview.
         treeHeight -= this.elements.treeviewBox.outerHeight(true) -
            this.elements.treeviewBox.height();
         this.elements.treeviewBox.height(treeHeight);
         this.elements.treeview.height(treeHeight -
            this.elements.expandLevel.outerHeight(true));

         // Remove margin, border, and padding of properties and results tabs.
         tabsHeight -= this.elements.tabsBar.outerHeight(true) -
            this.elements.tabsBar.height();
         this.elements.tabsBar.height(tabsHeight);

         // Remove height of tab buttons.
         tabsHeight -= this.elements.tabsBar.find('ul').outerHeight(true);
         // Remove margin, border, and padding of tab div.
         tabsHeight -= this.elements.resultsTab.outerHeight(true) -
            this.elements.resultsTab.height();
         this.elements.resultsTab.height(tabsHeight);
         this.elements.propertiesTab.height(tabsHeight);

         // Remove height of panel header.
         tabsHeight -= this.elements.panelHeaders.outerHeight(true);
         // Remove margin, border, and padding of iframe.
         tabsHeight -= this.elements.frameElements.outerHeight(true) -
            this.elements.frameElements.height();

         this.elements.frameElements.height(tabsHeight);

         width = this.elements.tabsBar.width();
         // Remove margin, border, and padding of iframe.
         width -= this.elements.frameElements.outerWidth(true) -
            this.elements.frameElements.width();
         this.elements.frameElements.width(width);

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * The user has clicked on the open file button. Check if the current
    * script should be saved first, then call openFileSelector to choose
    * the script to be loaded.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the open file button.
    */
   triggerFileInput: function (aEvent) {
      this.checkScript(this.openFileSelector.bind(this));
   },

   /**
    * Create and activate a file input element to select the script to
    * be loaded.
    * @this {DejaClickUi.Sidebar}
    */
   openFileSelector: function () {
      var input;
      try {
         // Use a new input element so that the change event will
         // fire even if the same file has been opened before.
         input = $(document.createElement('input'));
         input.attr('type', 'file').
            attr('accept', '.xml,application/xml').
            on('change', this.openSelectedScript.bind(this)).
            trigger('click');
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open the file selected by the file input element.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery change event on the file input element.
    */
   openSelectedScript: function (aEvent) {
      var files;
      try {
         files = aEvent.target.files;
         if (files.length === 1) {
            this.readScriptFile(files[0]);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Advertise that files can be dropped (copied) onto the sidebar.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery dragover event.
    * @return {boolean} false to prevent propagation of the event.
    */
   displayDragAndDropEffect: function (aEvent) {
      try {
         aEvent.originalEvent.dataTransfer.dropEffect = 'copy';
      } catch (ex) {
         this.logger.logException(ex);
      }
      return false;
   },

   /**
    * Open a file that was dropped onto the sidebar.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery drop event.
    * @return {boolean} false to prevent propagation of the event.
    */
   openDroppedScript: function (aEvent) {
      var files;
      try {
         if ((this.state.runmode !== this.constants.RUNMODE_INACTIVE) &&
               (this.state.runmode !== this.constants.RUNMODE_STOPPED)) {
            // Do not allow dropping while running.
            return false;
         } else if (this.state.dialog !== null) {
            // Do not allow dropping while dialog is open.
            return false;
         }

         files = aEvent.originalEvent.dataTransfer.files;
         if (files.length === 1) {
            // Check if current script needs to be saved before reading
            // the new file.
            this.checkScript(this.readScriptFile.bind(this, files[0]));
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
      return false;
   },

   /**
    * Read the contents of a file.
    * @this {DejaClickUi.Sidebar}
    * @param {!File} aFile The file to be read.
    */
   readScriptFile: function (aFile) {
      var reader = new FileReader();
      this.logger.logInfo('Reading script file \'' + aFile.name + '\'');
      reader.addEventListener('error',
         this.handleReadError.bind(this, aFile.name),
         false);
      reader.addEventListener('load',
         this.parseScript.bind(this, aFile.name),
         false);
      reader.readAsText(aFile);
   },

   /**
    * Inform the user about the failure to read a file.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aFilename The name of the file being read.
    * @param {!Event} aEvent A FileReader error event.
    */
   handleReadError: function (aFilename, aEvent) {
      var message;
      try {
         message = this.getMessage('deja_sidebar_scriptReadFailure',
            [aFilename, this.getFileErrorCode(aEvent.target.error)]);
         this.logger.logFailure(message);
         window.alert(message);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Get a string representation of the error code in a FileError object.
    * @param {*} aError A FileError object.
    * @return {string} The type of the error.
    */
   getFileErrorCode: function (aError) {
      var errorCode, errorType, keys, index;
      errorCode = '';
      if ((aError !== undefined) && (aError.code !== undefined)) {
         errorCode = String(aError.code);
         errorType = aError.constructor;
         if (errorType !== undefined) {
            keys = Object.keys(errorType);
            index = keys.length;
            while (index !== 0) {
               --index;
               if (errorType[keys[index]] === aError.code) {
                  errorCode = keys[index];
                  break;
               }
            }
         }
      }
      return errorCode;
   },

   /**
    * Parse a text file into a script.
    * @this {DejaClickUi.Sidebar}
    * @param {!string} aFilename The name of the file that was read.
    * @param {!Event} aEvent The FileReader load event.
    *    The target is the FileReader.
    */
   parseScript: function (aFilename, aEvent) {
      var script, error, digest, message;
      try {
         script = new this.Script();
         error = script.loadFromText(aEvent.target.result);
         if (error.length === 0) {
            digest = script.getLocalPasswordDigest();
            if (digest == null) {
               this.normalizeScript(aFilename, script);
            } else {
               this.openDialog('ui/content/dejaPassword.html', {
                  question: 'deja_password_loadPrompt',
                  digest: digest
               }, this.processLoadPassword.bind(this, aFilename, script));
            }

         } else {
            message = this.getMessage('deja_sidebar_scriptLoadFailure',
               [aFilename, error]);
            this.logger.logFailure(message);
            window.alert(message);
         }
      } catch (ex) {
         this.logger.logException(ex);
         window.alert(this.getMessage('deja_sidebar_scriptLoadFailure',
            [aFilename, ex.stack]));
      }
   },

   /**
    * Process the result of selecting a password to decrypt the script.
    * @this {DejaClickUi.Sidebar}
    * @param {!string} aFilename The name of the file that was read.
    * @param {!DejaClick.Script} aScript The script being loaded.
    * @param {?DejaClick.Encryption} aEncryption Encryption object
    *    initialized by the password selected by the user. May be
    *    null if the user canceled the load or if the correct password
    *    was not supplied.
    */
   processLoadPassword: function (aFilename, aScript, aEncryption) {
      try {
         if (aEncryption == null) {
            window.alert(this.getMessage('deja_sidebar_scriptPassword'));
         } else {
            this.normalizeScript(aFilename, aScript,
               aEncryption.decrypt.bind(aEncryption));
         }
      } catch (ex) {
         this.logger.logException(ex);
         window.alert(this.getMessage('deja_sidebar_scriptLoadFailure',
            [aFilename, ex.stack]));
      }
   },

   /**
    * Normalize the loaded script and prepare it for use.
    * @this {DejaClickUi.Sidebar}
    * @param {!string} aFilename The name of the file that was read.
    * @param {!DejaClick.Script} aScript The script being loaded.
    * @param {function(string):string=} opt_decrypt Optional function
    *    to decrypt the script being loaded.
    */
   normalizeScript: function (aFilename, aScript, opt_decrypt) {
      var message, description;
      if (!aScript.normalize(false, opt_decrypt)) {
         message = this.getMessage('deja_sidebar_scriptNotUriEncoded');
         this.logger.logWarning(message);
         window.alert(message);
      }
      aScript.setFilename(aFilename);
      description = aFilename.match(this.DESCRIPTION_EXP);
      aScript.updateMissingDescription(description[1] || description[2]);
      this.logger.logDebug('script imported from file: ' + aFilename);
      this.setScript(aScript);
      this.enableControls();
      // TODO refactor needed
      this.state.results.updateRunMode({runMode: this.constants.RUNMODE_STOPPED});
   },

   /**
    * Save the current script to a file.
    * @this {DejaClickUi.Sidebar}
    * @param {Event=} opt_event A jQuery click event on the save button.
    */
   saveScript: function (opt_event) {
      var script, prefs;
      try {
         script = this.getScript();
         if (script !== null) {
            prefs = this.prefService;
            if (prefs.getPrefOption('DC_OPTID_ENCRYPTLOCAL') &&
                  script.needsEncryption(
                     prefs.getPrefOption('DC_OPTID_ENCRYPTINPUT'))) {
               this.openDialog('ui/content/dejaPassword.html', {
                  question: 'deja_password_savePrompt',
                  digest: null
               }, this.processSavePassword.bind(this, script));
            } else {
               this.completeSaveScript(script);
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Report the failure to save the script if the user chose not to
    * provide an encryption password.
    * @this {DejaClickUi.Sidebar}
    * @param {!DejaClick.Script} aScript The script to be saved.
    * @param {?DejaClick.Encryption} aEncryption The encryption object
    *    initialized with the user provided password. May be null if
    *    the user cancelled the save.
    */
   processSavePassword: function(aScript, aEncryption) {
      try {
         if (aEncryption == null) {
            window.alert(this.getMessage('deja_sidebar_localCryptCancelled'));
         } else {
            this.completeSaveScript(aScript, aEncryption);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Save the script as an XML file.
    * @this {DejaClickUi.Sidebar}
    * @param {!DejaClick.Script} aScript The script to be saved.
    * @param {DejaClick.Encryption=} opt_encryption The encryption object
    *    initialized with the user provided password.
    */
   completeSaveScript: function (aScript, opt_encryption) {
      var prefs, pretty, scriptText, blob, url, anchor, filename, now;
      prefs = this.prefService;
      pretty = prefs.getPrefOption('DC_OPTID_WRITEPRETTYPRINT');
      scriptText = '<?xml version="1.0" encoding="UTF-8" ?>' +
         (pretty ? '\n' : '') +
         aScript.serializeScript({
            pretty: pretty,
            uriEncode: prefs.getPrefOption('DC_OPTID_WRITEURIENCODE'),
            writeActions: prefs.getPrefOption('DC_OPTID_WRITEACTTREES'),
            writeResults: prefs.getPrefOption('DC_OPTID_WRITERESTREES'),
            writeNavigation: prefs.getPrefOption('DC_OPTID_WRITENAVTREES'),
            writeFingerprints: prefs.getPrefOption('DC_OPTID_WRITEIDTAGS'),
            encrypt: (opt_encryption == null) ? null : opt_encryption,
            local: true,
            cleanup : false,
            encryptAllInput: prefs.getPrefOption('DC_OPTID_ENCRYPTINPUT')
         }, this.utils.versionInfo);

      blob = new Blob([scriptText], {type: 'text/xml'});
      url = window.URL.createObjectURL(blob);

      filename = aScript.getFilename();
      if (filename.length === 0) {
         // Create a reasonably unique filename.
         now = new Date();
         filename = 'script-' +
            ('0000' + now.getUTCFullYear()).slice(-4) +
            ('00' + now.getUTCMonth()).slice(-2) +
            ('00' + now.getUTCDate()).slice(-2) +
            'T' + ('00' + now.getUTCHours()).slice(-2) +
            ('00' + now.getUTCMinutes()).slice(-2) +
            ('00' + now.getUTCSeconds()).slice(-2) + '.xml';
         aScript.setFilename(filename);
      } else {
         filename = filename.match(this.FILENAME_EXP)[1];
      }

      if (this.downloadsApi == null) {
         // For compatibility with Chrome < 31.

         // $(anchor).trigger('click') does not trigger the download,
         // so use the standard DOM interface.
         anchor = document.createElement('a');
         anchor.setAttribute('href', url);
         anchor.setAttribute('download', filename);
         anchor.dispatchEvent(new Event('click'));
         // @todo Do the following only after a save is successful.
         aScript.clearChangesPending();
         this.logger.logInfo('Script saved');

      } else {
         // Use chrome.downloads when it is available. This allows us
         // access to the filename that was chosen and whether the
         // download was successful.

         this.downloadsApi.download({
            url: url,
            saveAs: true,
            filename: filename,
            conflictAction: 'prompt'
         }, this.onDownloadStarted.bind(this));
      }
   },

   /**
    * Record the id of the current script download, so that we can tell
    * when and if it completes.
    * @this {DejaClickUi.Sidebar}
    * @param {integer} aId
    */
   onDownloadStarted: function(aId) {
      try {
         if (aId == null) {
            if (chrome.runtime.lastError == null) {
               this.logger.logFailure('Save failed');
            } else {
               this.logger.logFailure('Save failed: ' +
                                      chrome.runtime.lastError.message);
            }
         } else {
            this.state.currentDownload = aId;
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   FILENAME_EXP: /(?:^|\/|\\)([^\/\\]*)$/,
   DESCRIPTION_EXP: /^(?:(.*).xml|.*)$/i,

   /**
    * React to a change in the progress of a download.
    * @this {DejaClickUi.Sidebar}
    * @param {!{
    *    id: integer,
    *    url: (undefined|chrome.StringDelta),
    *    filename: (undefined|chrome.StringDelta),
    *    danger: (undefined|chrome.StringDelta),
    *    mime: (undefined|chrome.StringDelta),
    *    startTime: (undefined|chrome.StringDelta),
    *    endTime: (undefined|chrome.StringDelta),
    *    state: (undefined|chrome.StringDelta),
    *    canResume: (undefined|chrome.BooleanDelta),
    *    paused: (undefined|chrome.BooleanDelta),
    *    error: (undefined|chrome.StringDelta),
    *    totalBytes: (undefined|chrome.LongDelta),
    *    fileSize: (undefined|chrome.LongDelta),
    *    exists: (undefined|chrome.BooleanDelta),
    * }} aDelta
    */
   onDownloadChanged: function(aDelta) {
      var script, filename, description;
      try {
         if (aDelta.id === this.state.currentDownload) {
            script = this.getScript();
            if (aDelta.filename != null) {
               filename = aDelta.filename.current.match(this.FILENAME_EXP)[1];
               description = filename.match(this.DESCRIPTION_EXP);
               script.updateMissingDescription(description[1] || description[2]);
               script.setFilename(filename);
            }
            if (aDelta.state != null) {
               if (aDelta.state.current === 'complete') {
                  script.clearChangesPending();
                  this.logger.logInfo('Script saved to ' +
                                      script.getFilename());
                  this.state.currentDownload = null;
                  this.utils.observerService.notifyLocalObservers(
                     'dejaclick:propertyupdated',
                     {
                        property: 'description',
                        category: 'script',
                        hashkey: '1:script'
                     });

               } else if (aDelta.state.current === 'interrupted') {
                  if (aDelta.error == null) {
                     this.logger.logFailure('Save interrupted');
                  } else if (aDelta.error.current === 'USER_CANCELED') {
                     this.logger.logInfo('User canceled save');
                  } else {
                     this.logger.logFailure('Save interrupted - ' +
                        aDelta.error.current);
                  }
                  this.state.currentDownload = null;
               }
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Ensure that the current script has been saved before performing
    * an activity that would discard it.
    * @this {DejaClickUi.Sidebar}
    * @param {function()} aNext Callback to perform the destructive task.
    *    aNext may be called before checkScript completes.
    *    It may also be called (once) at a later time or not at all.
    * @param {boolean=} opt_delay If true, delay the invocation of aNext
    *    until the dialog window has been closed.
    *
    * The opt_delay feature is needed to support the download script
    * action which also opens a dialog. The prompt dialog must be
    * closed before the download script dialog is opened. The action
    * must be invoked synchronously in the case of the load script
    * action, because the file input element can only be triggered
    * within a user event handler.
    */
   checkScript: function (aNext, opt_delay) {
      var script, next, callback;
      script = this.getScript();
      if ((script !== null) && script.areChangesPending()) {
         this.openDialog('ui/content/dejaPromptSave.html', {
            save: this.saveScript.bind(this),
            action: opt_delay ? null : aNext,
            script: script
         }, opt_delay ? this.completeCheckScript.bind(this, aNext) : null);
      } else {
         aNext();
      }
   },

   /**
    * Invoke the original action that triggered a checkScript call
    * (if the user indicated that the script should not be saved and the
    * action needed the dialog to be closed first).
    * @param {function()} aNext Function to invoke the original action.
    * @param {boolean} aInvoke True if the user requested that the original
    *    action be performed without saving the script.
    */
   completeCheckScript: function(aNext, aInvoke) {
      try {
         if (aInvoke) {
            aNext();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Check to see if the current script has been saved (or should be).
    * Then begin recording a new transaction.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the record button.
    */
   triggerRecording: function (aEvent) {
      try {
         /*if (this.state.runmode2 == this.constants.RUNMODE_STOPPED) {
            this.checkScript(this.beginRecording.bind(this));
         } else if (this.state.runmode2 == this.constants.RUNMODE_PAUSED) {
            var self = this;
            this.utils.promptService.confirmUser(
                  {
                     question: 'deja_sidebar_confirmOverwriteRecording',
                     buttons: [ 'deja_global_btn_ok', 'deja_global_btn_cancel' ]
                  },
                  function(selectedButtonIndex) {
                     if (selectedButtonIndex === 0) {
                        self.beginRecording.call(self);
                     }
                  });
         }*/
         if (this.state.runmode2 == this.constants.RUNMODE_PAUSED &&
               this.prefService.getPrefOption('DC_OPTID_APPENDMODE') == this.constants.DC_APPENDMODE_DEFAULT)
         {
            var self = this;
            this.utils.promptService.confirmUser(
               {
                  question: 'deja_sidebar_confirmOverwriteRecording',
                  buttons: [ 'deja_global_btn_ok', 'deja_global_btn_cancel' ]
               },
               function(selectedButtonIndex) {
                  if (selectedButtonIndex === 0) {
                     self.beginRecording.call(self);
                  }
               });
         }
         else if (this.state.runmode2 == this.constants.RUNMODE_PAUSED &&
            this.prefService.getPrefOption('DC_OPTID_APPENDMODE') == this.constants.DC_APPENDMODE_SUBSCRIPT)
         {
            this.beginRecording();
         }
         else {
            this.checkScript(this.beginRecording.bind(this));
         }


      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Begin recording a new transaction.
    * @this {DejaClickUi.Sidebar}
    */
   beginRecording: function () {
      try {
         this.logger.logInfo('Begin recording');
         this.setRunMode( this.constants.RUNMODE_RECORD );
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Begin replaying the current transaction.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the play button.
    */
   beginReplay: function (aEvent) {
      try {
         this.logger.logInfo('Begin replaying');
         this.setRunMode( this.constants.RUNMODE_REPLAY );
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Pause the current replay.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the pause button.
    */
   pauseReplay: function (aEvent) {
      try {
         this.logger.logInfo('Pause replay');
         this.setRunMode( this.constants.RUNMODE_PAUSED );
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Stop recording or replaying a transaction.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the stop button.
    */
   stopRecordReplay: function (aEvent) {
      try {
         this.logger.logInfo('Stop recording or replaying');
         this.setRunMode( this.constants.RUNMODE_STOPPED );
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * React to updated runMode. Update the UI if appropriate.
    * Called in response to the dejaclick:runmode event.
    * @this {DejaClickUi.Sidebar}
    * @param {!{runMode: integer}} aData The new run mode.
    */
   onRunModeUpdated: function (aData) {
      try {
         this.state.runmode = aData.runMode;
         this.enableControls();

         // Only keep track of real runMode changes.
         if ((this.state.runmode != this.constants.RUNMODE_SUSPEND) &&
               (this.state.runmode != this.constants.RUNMODE_RESUME)) {
            this.state.runmode2 = this.state.runmode;
         }

         // focus main window when runmode is stopped/record/replay/paused
         if (this.state.runmode >= this.constants.RUNMODE_STOPPED &&
            this.state.runmode <= this.constants.RUNMODE_PAUSED) {
            this.windowsApi.update(DejaClick.service.windowId, {
               focused: true
            });
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * React to a new run state. Update the UI if appropriate.
    * Called in response to the dejaclick:runstate event.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aData The new run state.
    */
   updateRunState: function (aData) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display a menu. This is called when a button that enables a menu
    * is clicked. The id of the menu is derived from the id of the button
    * that enables it (the Button suffix is replaced with Menu).
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the menu button.
    */
   displayMenu: function (aEvent) {
      var menu, enable;

      try {
         menu = $('#' + aEvent.currentTarget.getAttribute('id').slice(0,-6) +
            'Menu');
         enable = menu.css('display') === 'none';
         this.elements.allMenus.hide();
         if (enable) {
            menu.show();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
      return false;
   },

   /**
    * Disable (hide) all menus. This is called whenever a click occurs
    * other than on a button enabling a menu.
    * @this {DejaClickUi.Sidebar}
    */
   hideMenus: function () {
      try {
         this.elements.allMenus.hide();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Process the activation of a menu item.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   dispatchMenuEvent: function (aEvent, aUi) {
      var id, handler;
      try {
         id = aUi.item.attr('id');
         if (!this.menuItemHandlers.hasOwnProperty(id)) {
            this.logger.logInfo('Unhandled menu item ' + aUi.item.text());
         } else {
            handler = this.menuItemHandlers[id];
            if (handler !== null) {
               handler.call(this, aEvent, aUi);
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Show the keyword validation toolbar.
    * @this {DejaClickUi.Sidebar}
    * @param {!{enabled: boolean, type: integer}} aData The new validation mode setting.
    */
   openKeywordValidationToolbar: function (aData) {
      try {
         this.state.validationtype = 'keyword';
         this.enableValidationMode();
         this.elements.keywordValidationToolbar.toggle(aData.enabled);

         // Update the list of existing keywords.
         if (aData.enabled) {
            this.updateKeywordList();
         }

         this.resizePanes();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Show the javascript validation toolbar.
    * @this {DejaClickUi.Sidebar}
    * @param {!{enabled: boolean, type: integer}} aData The new validation mode setting.
    */
   openJsValidationToolbar: function (aData) {
      try {
         this.state.validationtype = 'javascript';
         this.enableValidationMode();
         this.elements.jsValidationToolbar.toggle(aData.enabled);

         this.resizePanes();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Hide an opened validation toolbar.
    * @this {DejaClickUi.Sidebar}
    */
   closeValidationToolbars: function() {
      try {
         this.elements.keywordValidationToolbar.hide();
         this.elements.jsValidationToolbar.hide();

         this.resizePanes();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Reload the keywords list and clear the input field
    * in the validation toolbar.
    * @this {DejaClickUi.Sidebar}
    */
   updateKeywordList: function () {
      try {
         this.elements.keywordCombo.input.val("");
         this.getKeywords();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Populate the keyword combobox in the validation toolbar
    * with the existing keywords for the current action/event.
    * @this {DejaClickUi.Sidebar}
    */
   getKeywords: function () {
      try {
         // clear any existing items in the keyword menu
         this.elements.keywordSelect.empty();

         var script = this.getScript();
         if (script) {
            var domNode = this.getActionOrEventNode(true);

            if (domNode) {
               // extract the validations for the current node
               var nodeList = domNode.getElementsByTagName("validation");
               /*jslint curly: false*/
               if (!nodeList.length) return;
               for (var i=0; i < nodeList.length; i++) {
                  if (domNode.nodeName=="action" && nodeList[i].parentNode.parentNode.nodeName != "action") {
                     continue;  // if this is an action node, skip any event keyword validations
                  }
                  var valnode = nodeList[i];
                  var valhashkey = valnode.getAttribute('seq') + ":validation";
                  if (valnode) {
                     // TODO handle varreferences
                     var matchText = script.domTreeGetValidateParam( valnode, "matchtext" );

                     // insert them into the keyword menu
                     this.elements.keywordSelect.append( $("<option/>", {
                        value: valhashkey,
                        text: matchText
                     }));
                  }
               }
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable validation mode and notify listeners by sending
    * the 'dejaclick:validationmode' message.
    * This is called asynchronously when the validation menu item is selected.
    * @this {DejaClickUi.Sidebar}
    */
   enableValidationMode: function () {
      try {
         this.state.validationmode = true;

         this.utils.observerService.notifyObservers('dejaclick:validationmode',
            {enabled: this.state.validationmode, type: this.state.validationtype});

         // Suspend the current runmode when enabling validation mode.
         this.setRunMode( this.constants.RUNMODE_SUSPEND );
         DejaClick.service.setSuspendType('validation');

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Disable validation mode and notify listeners by sending
    * the 'dejaclick:validationmode' message.
    * This is called asynchronously when the validation menu item is selected.
    * @this {DejaClickUi.Sidebar}
    */
   disableValidationMode: function () {
      try {
         this.state.validationmode = false;
         this.state.validationtype = '';

         this.utils.observerService.notifyObservers('dejaclick:validationmode',
            {enabled: this.state.validationmode, type: this.state.validationtype});

         DejaClick.service.setSuspendType('');

         // Reinstate the previous runmode when disabling validation mode.
         this.setRunMode( this.constants.RUNMODE_RESUME );
         this.closeValidationToolbars();

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display a suggested keyword in the validation toolbar.
    * Called in response to the 'dejaclick:suggestedkeyword' notification.
    * @this {DejaClickUi.Sidebar}
    * @param {!{keyword: string}} aData The suggested keyword.
    * @param {!chrome.Tab} aTab Details of the tab that sent the notification.
    * @param {!integer} aDocId Identifier of the document in which the
    *    suggested keyword was found.
    */
   displaySuggestedKeyword: function (aData, aTab, aDocId) {
      try {
         this.elements.keywordCombo.input.val( aData.keyword );

         // keep a reference to the tab and document for later
         this.state.aTabId = aTab.id;
         this.state.aDocId = aDocId;
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Called in response to the 'dejaclick:eventblocked' notification.
    * @this {DejaClickUi.Sidebar}
    * @param {!{
    *    eventType: string,
    *    selectedText: string,
    *    suggestedText: string
    * }} aData Details of the event that was blocked.
    * @param {!chrome.Tab} aTab Details of the tab that sent the notification.
    * @param {!integer} aDocId Identifier of the document in which the
    *    event occurred.
    */
   onEventBlocked: function (aData, aTab, aDocId) {
      try {
         var domNode = this.getActionOrEventNode(true);
         if (!domNode) {
            throw new Error("Unable to get action/event node for keyword validation!");
         }

         switch (this.state.validationtype) {
            case 'keyword':
               this.serveKeywordValidation(aData, aTab, aDocId, domNode);
               break;

            case 'javascript':
               this.serveJavascriptValidation(aData, aTab, aDocId, domNode);
               break;

            default:
               break;
         }

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   serveKeywordValidation: function(aData, aTab, aDocId, domNode) {
      switch (aData.eventType) {
         case 'suspend-click':
            // display the add keyword dialog with the suggested/selected text
            this.openDialog('ui/content/dejaKeyword.html',
               {
                  context: domNode,
                  item: null,
                  matchText: aData.selectedText || aData.suggestedText,
                  // set matchWord, fixSpaces depending on
                  // whether text was selected or suggested
                  matchWord: (aData.selectedText) ? false : true,
                  fixSpaces: (aData.selectedText) ? false : true,
                  document: DejaClick.service.getNavDocumentNode(aTab.id, aDocId)
               }, function() {
                  this.updateKeywordList();
                  this.updateTreeViewNodeValidation(domNode);
               }.bind(this));
            break;
         case 'suspend-ctrl-click':
            // add a new keyword using the suggested/selected text
            DejaClick.service.addKeyword( domNode, aData, aTab.id, aDocId );
            this.updateKeywordList();
            this.updateTreeViewNodeValidation(domNode);
            break;
         default:
            break;
      }
   },

   serveJavascriptValidation: function(aData, aTab, aDocId, domNode) {
      try {
         this.openDialog('ui/content/dejaJavascript.html',
            {
               context: domNode,
               item: null,
               document: DejaClick.service.getNavDocumentNode(aTab.id, aDocId)
            }, this.updateTreeViewNodeValidation.bind(this, domNode));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Notify listeners by sending the 'dejaclick:validationpropertyupdated' message
    * @this {DejaClickUi.Sidebar}
    * @param {!Element} aNode - Script node to be redrawn in the treeview
    */
   updateTreeViewNodeValidation: function(aNode) {
      var hashkey = null;

      try {
         if (aNode) {
            hashkey = this.getNodeHashkey(aNode);

            if (hashkey) {
               this.utils.observerService.notifyLocalObservers(
                  'dejaclick:validationpropertyupdated', {
                     node: aNode,
                     hashkey: hashkey
                  });
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Returns hashkey for specified node.
    * @param {!Element} aNode - Script node to be redrawn in the treeview
    * @returns {string|null} Node hashkey
    */
   getNodeHashkey: function(aNode) {
      var container, scriptNum = null, hashkey = null;

      try {
         if (aNode) {
            container = aNode.parentNode;

            while (container) {
               if (container.nodeName.indexOf('script') !== -1) {
                  scriptNum = container.getAttribute('seq') || '0';
                  break;
               }
               container = container.parentNode;
            }

            if (scriptNum) {
               hashkey = DejaClick.service.getHashkey(aNode, scriptNum);
            }
         }

         return hashkey;
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Opens a dialog for editing the selected keyword.
    * Called in response to the 'comboboxselect' event.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery selection event.
    * @param {!{item: !jQuery}} aUi The selected combobox item.
    */
   editKeyword: function (aEvent, aUi) {
      try {
         var domNode = this.getActionOrEventNode(true);
         if (!domNode) {
            throw new Error("Unable to get action/event node for keyword validation!");
         }
         var valHashkey = aUi.item.value;
         var valNode = this.getScript().getHashkeyNode( valHashkey );

         this.openDialog('ui/content/dejaKeyword.html',
            {
               context: domNode,
               item: valNode
            },
            this.updateKeywordList.bind(this));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Adds a new keyword that was typed in.
    * Called in response to the 'keyup' event.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery keypress event.
    */
   enterKeyword: function (aEvent) {
      try {
         if (aEvent.which == $.ui.keyCode.ENTER) {
            // TODO refactor to combine with similar calls above
            // FORNOW piggy-back on the onEventBlocked handler
            // if Ctrl+Enter was pressed, skip the Add dialog
            this.onEventBlocked( {
               eventType: 'suspend-' + (aEvent.ctrlKey ? 'ctrl-' : '') + 'click',
               suggestedText: this.elements.keywordCombo.input.val()
            }, {}, 0);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window to define a new ContentView.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the add ContentView button.
    */
   addContentView: function (aEvent) {
      try {
         this.openDialog('ui/content/dejaContentView.html',
            {
               context: this.getActionOrEventNode(false),
               item: null
            });
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   // Select the correct action/event node for the currently displayed browser tab.
   // This is important because a document can be loaded in one tab, then the user
   // can open documents in several other tabs in the background without moving off
   // the current tab.  Then, if the user creates keywords on the currently displayed
   // tab, we must assign the validation data to the action node for the current tab,
   // not any of the new ones.  Also, a document that is loaded in a tab can be
   // overlayed with a new document at any time, which may then be keyworded; thus
   // we must get the action associated with the latest document load for that tab,
   // not the first.  Finally, if the current event is just a tabfocus event, then
   // we honor that event as the current action, rather than doing the whole nav
   // doc lookup operation (web page scripting may have changed the page content
   // since it was first loaded, so we can't attach it to the original action node).
   /**
    * Display a suggested keyword in the validation toolbar.
    * @this {DejaClickUi.Sidebar}
    * @param {!boolean} bAForValidation True if the result is being used to determine
    * the appropriate parent node for a validation.
    */
   getActionOrEventNode: function( bAForValidation )
   {
      try {
         // first, grab the DOM node for the current event
         var domNode = DejaClick.service.currentEventNode();

         // now decide if we should override the current event DOM node with the action DOM node...
         if (domNode) {
            var actionNode = domNode.parentNode;
            // associate the validation/note with the current action if we have an action description or if the
            // autopause mode is set to DC_AUTOPAUSE_ACTION, or if the current event node is a tabfocus
            var actionDesc;
            if (this.state.runmode2 == this.constants.RUNMODE_RECORD) {
               actionDesc = this.getScript().domTreeGetAttribute(actionNode, 'description');
            }
            var pauseOption = DejaClick.service.getSystemIntPref( 'DC_OPTID_AUTOREPLAYPAUSE' );
            if (actionDesc || pauseOption==this.constants.DC_AUTOPAUSE_ACTION || domNode.getAttribute('type')=='tabfocus') {
               domNode = actionNode;
            }
         }

         if (bAForValidation && !domNode) {
            var tabId, docId, docActionID, docSubscriptNum;

            // try to pull the document ID from the last hovered-over document
            if (this.state.tabId && this.state.docId) {
               tabId = this.state.aTabId;
               docId = this.state.aDocId;
            } else {
               // TODO get the most recent tab. This can only be done async!
               /*
               // nope, so try to get the most recent window and browser tab
               var windowObj = DejaClick.windowMediator.getMostRecentWindow("navigator:browser");
               // get the browser object associated with the currently focused tab
               var browserObj = DejaClick.getFocusedBrowser( windowObj.getBrowser() );
               // get the browser object's current document element
               docElement = browserObj.contentDocument.documentElement;
               */
            }

            if (tabId && docId) {
               // get the associated nav tree document node
               var docTarget = DejaClick.service.getNavDocumentNode( tabId, docId );
               if ( docTarget ) {
                  docActionID = docTarget.getAttribute('action');
                  docSubscriptNum = docTarget.getAttribute('subscript');
               }
            }

            if (docActionID) {
               // use the associated action ID found for this document
               var docHashkey = docActionID + ":action" + (Number(docSubscriptNum) ? ":" + docSubscriptNum + ":subscript" : "");
               domNode = DejaClick.service.getHashkeyNode( docHashkey );
            } else {
               // otherwise, if we can't get the docActionID for some reason, use parent action for current event
               domNode = DejaClick.service.currentEventNode();
               if (domNode) {
                  domNode = domNode.parentNode;
               }
            }
         }
         return domNode;

      } catch (ex) {
         this.logger.logException(ex);
      }
      return null;
   },

   /**
    * Look for an existing tab with the options page loaded.  Proceed
    * to focusOptionsPage when search is complete.  This is called
    * asynchronously when the options menu item is selected.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   findOptionsPage: function (aEvent, aUi) {
      this.tabsApi.query({ url: this.state.optionsUrl },
         this.focusOptionsPage.bind(this));
   },

   /**
    * Open or focus the options page. This is called asynchronously
    * when chrome.tabs.query completes.
    * @this {DejaClickUi.Sidebar}
    * @param {!Array.<!chrome.Tab>} aTabs List of tabs with the options
    *    page loaded.
    */
   focusOptionsPage: function (aTabs) {
      var tab;

      try {
         if (aTabs.length === 0) {
            this.tabsApi.create({
               url: this.state.optionsUrl,
               active: true
            });
         } else {
            tab = aTabs[0];
            if (!tab.active) {
               this.tabsApi.update(tab.id, {active: true});
            }
            this.windowsApi.update(tab.windowId, {focused: true});
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Change the display level in response to selecting a menu item.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   setDisplayLevel: function (aEvent, aUi) {
      this.prefService.setPrefOption('DC_OPTID_DISPLAYLEVEL',
         this.constants[aUi.item.attr('dcvalue')]);
   },

   /**
    * Mark the current display level in the UI.
    * @this {DejaClickUi.Sidebar}
    * @param {integer} aLevel The current display level.
    */
   displayDisplayLevel: function (aLevel) {
      var active;

      this.elements.displayLevelItems.removeClass('ui-icon ui-icon-check');
      switch (aLevel) {
      case this.constants.DISPLAYLEVEL_BASIC:
         active = this.elements.displayLevelBasicItem;
         break;
      case this.constants.DISPLAYLEVEL_ADVANCED:
         active = this.elements.displayLevelAdvancedItem;
         break;
      case this.constants.DISPLAYLEVEL_DIAGNOSTIC:
         active = this.elements.displayLevelDiagnosticItem;
         break;
      }
      if (active !== undefined) {
         active.addClass('ui-icon ui-icon-check');
      }
   },

   /**
    * Change the replay mode in response to selecting a menu item.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   setReplayMode: function (aEvent, aUi) {
      this.prefService.setPrefOption('DC_OPTID_AUTOREPLAYPAUSE',
         this.constants[aUi.item.attr('dcvalue')]);
   },

   /**
    * Mark the current auto pause mode in the UI.
    * @this {DejaClickUi.Sidebar}
    * @param {integer} aMode The current auto pause mode
    */
   displayReplayMode: function (aMode) {
      var active, step;
      this.elements.replayModeItems.removeClass('ui-icon ui-icon-check');
      switch (aMode) {
      case this.constants.AUTOPAUSE_NONE:
         active = this.elements.replayAllItem;
         step = false;
         break;
      case this.constants.AUTOPAUSE_ACTION:
         active = this.elements.replayActionItem;
         step = true;
         break;
      case this.constants.AUTOPAUSE_EVENT:
         active = this.elements.replayEventItem;
         step = true;
         break;
      }
      if (active !== undefined) {
         active.addClass('ui-icon ui-icon-check');
         this.elements.playButton.button('option', 'icons', {
            primary: step ? 'step-icon' : 'play-icon'
         });
      }
   },

   /**
    * Toggle the value of a boolean preference in response to selecting
    * a menu item.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aPrefId The ID of the preference to be toggled.
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   togglePreference: function (aPrefId, aEvent, aUi) {
      this.prefService.setPrefOption(aPrefId,
         !this.prefService.getPrefOption(aPrefId));
   },

   /**
    * Mark an option as enabled or disabled in the UI.
    * @this {DejaClickUi.Sidebar}
    * @param {!Element} aElement The element (span) to be marked.
    * @param {boolean} aEnabled true if the option is enabled.
    */
   displayBooleanOption: function (aElement, aEnabled) {
      if (aEnabled) {
         aElement.addClass('ui-icon ui-icon-check');
      } else {
         aElement.removeClass('ui-icon ui-icon-check');
      }
   },

   /**
    * Change the replay speed in response to selecting a menu item.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   setReplaySpeed: function (aEvent, aUi) {
      var speed = aUi.item.attr('dcvalue');
      this.prefService.setPrefOption('DC_OPTID_EVENTDELAY',
         this.constants['EVENTDELAY_' + speed]);
      this.prefService.setPrefOption('DC_OPTID_READYTIMEOUT',
         this.constants['READYTIMEOUT_' + speed]);
      this.prefService.setPrefOption('DC_OPTID_DISPATCHDELAY',
         this.constants['DISPATCHDELAY_' + speed]);
   },

   /**
    * Display the current replay speed in the UI.
    * @this {DejaClickUi.Sidebar}
    * @param {integer} aValue An updated preference value. Not used.
    */
   displayReplaySpeed: function (aValue) {
      var eventDelay, readyTimeout, dispatchDelay, item;

      eventDelay = this.prefService.getPrefOption('DC_OPTID_EVENTDELAY');
      readyTimeout = this.prefService.getPrefOption('DC_OPTID_READYTIMEOUT');
      dispatchDelay = this.prefService.getPrefOption('DC_OPTID_DISPATCHDELAY');
      $('#replaySpeedItem').find('ul span').
         removeClass('ui-icon ui-icon-check');
      if (eventDelay === this.constants.EVENTDELAY_FASTER) {
         if ((readyTimeout === this.constants.READYTIMEOUT_FASTER) &&
               (dispatchDelay === this.constants.DISPATCHDELAY_FASTER)) {
            item = $('#replayFasterItem');
         }
      } else if (eventDelay === this.constants.EVENTDELAY_NORMAL) {
         if ((readyTimeout === this.constants.READYTIMEOUT_NORMAL) &&
               (dispatchDelay === this.constants.DISPATCHDELAY_NORMAL)) {
            item = $('#replayNormalItem');
         }
      } else if (eventDelay === this.constants.EVENTDELAY_SLOWER) {
         if ((readyTimeout === this.constants.READYTIMEOUT_SLOWER) &&
               (dispatchDelay === this.constants.DISPATCHDELAY_SLOWER)) {
            item = $('#replaySlowerItem');
         }
      }
      if (item !== undefined) {
         item.find('span').addClass('ui-icon ui-icon-check');
      }
   },
   
   /**
    * Regular expression to extract important pieces of a URL.
    * @private
    * @const
    */   
   URL_REGEXP: /^(\w+:\/*)?([\w+\.]+)(?::\d+)?\/([^\?#]*)(?:\?[^#]+)?(?:#.+)?/,
   SAML_LOGIN_APPEND: "/?state=source%3Dlogin_deja",
   SAML_LOGOUT_APPEND: "/?state=source%3Dlogout_deja",   
   LOGIN_URL_APPEND: "login?state=source%3Dlogin_deja",
   LOGOUT_URL_APPEND: "logout/?state=source%3Dlogout_deja",


   /**
    * Asynchronously log in to an AlertSite Monitoring account.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event on the login button.
    */
   loginToAlertSite: function (aEvent) {
      try {
//         this.openDialog('ui/content/dejaLogin.html', { silent: false });

         var samlUrl = this.prefService.getPrefOption('DC_OPTID_SAMLURL');
         var restApiEndpoint = this.prefService.getPrefOption('DC_OPTID_RESTENDPOINT');
         if (!restApiEndpoint) {
            window.alert(this.getMessage("deja_sidebar_invalid_restapi_url"));
            return;
         }			 
         var match = this.URL_REGEXP.exec(restApiEndpoint);
         if (match === null) {
            window.alert(this.getMessage("deja_sidebar_invalid_restapi_url"));
            return;
         }
         var loginUrl = samlUrl ? samlUrl + this.SAML_LOGIN_APPEND: (match[1] || 'http://') + match[2] + '/' + this.LOGIN_URL_APPEND;
console.log("Url is " + loginUrl);		 
         window.open(loginUrl, '_blank');

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   loginResponse: function (aEvent) {
      try {
         var response = ((new DOMParser()).parseFromString(aEvent.response, "text/xml")).firstElementChild;
         this.restApi.handleLoginResponse(null, null, response);
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },
   
   /**
    * Log out of an AlertSite monitoring account.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The jQuery event that caused the activation.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   logoutOfAlertSite: function (aEvent, aUi) {
      try {

         var samlUrl = this.prefService.getPrefOption('DC_OPTID_SAMLURL');
         var restApiEndpoint = this.prefService.getPrefOption('DC_OPTID_RESTENDPOINT');
         if (!restApiEndpoint) {
            window.alert(this.getMessage("deja_sidebar_invalid_restapi_url"));
            return;
         }			 
         var match = this.URL_REGEXP.exec(restApiEndpoint);
         if (match === null) {
            window.alert(this.getMessage("deja_sidebar_invalid_restapi_url"));
            return;
         }
//         var logoutUrl = samlUrl ? samlUrl + SAML_LOGOUT_APPEND : (match[1] || 'http://') + match[2] + '/' + this.LOGOUT_URL_APPEND;
         var logoutUrl = (match[1] || 'http://') + match[2] + '/' + this.LOGOUT_URL_APPEND;
		 
         window.open(logoutUrl, '_blank');
         this.restApi.logoff();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously change the effective user of the current AlertSite session.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   changeUser: function (aEvent, aUi) {
      try {
         this.openDialog('ui/content/dejaChangeUser.html');
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously upload a script to an AlertSite monitoring account.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   uploadScript: function (aEvent, aUi) {
      var script, prefs, digest, message;
      try {
         script = this.getScript();

         if (script !== null) {
            prefs = this.prefService;
            
            if (this.utils.autoUploadUrl) {

               // Warn that user encrypted scripts are not supported in Integrated Mode
               if (prefs.getPrefOption('DC_OPTID_ENCRYPTREMOTE') ||
                  script.needsEncryption(prefs.getPrefOption('DC_OPTID_ENCRYPTINPUT'))) {                  
                  message = this.getMessage('dcMessage_encryptedScriptNotSupported');
                  if (!window.confirm(message)) {
                     return;
                  }
               }

               // Validate script for upload
               var error = script.isUploadable();
               if (error && error.length !== 0) {
                  message = this.getMessage(error);
                  if (error === "dcMessage_unverifiedScript") {
                     window.alert(message);
                     return;
                  }
                  else {
                     if (!window.confirm(message)) {
                        return;
                     }
                  }
               }
               
               // Serialize the script
               var scriptString = script.serializeScript({
                                    writeActions: true,
                                    writeNavigation: false,
                                    writeResults: Boolean(this.prefService.getPrefOption('DC_OPTID_WRITERESTREES')),
                                    writeFingerprints: false,
                                    uriEncode: true,
                                    pretty: false,
                                    encrypt:  null,
                                    local: false,
                                    cleanup : false,
                                    encryptAllInput: false
                                    }, this.utils.versionInfo);

               if (scriptString.length > this.constants.MAX_UPLOAD_SCRIPT_SIZE) {
                  message =  this.getMessage('deja_restapi_toolargeupload');
                  window.alert(message);
                  return;
               }
               
               //  Upload script
               var xmlhttp = new XMLHttpRequest();
               xmlhttp.open("POST", this.utils.autoUploadUrl, false);
               xmlhttp.setRequestHeader("Content-type", "application/xml");
               xmlhttp.send(scriptString);
               if (xmlhttp.status == 200) {
                  message = this.getMessage('dcMessage_scriptUploaded');
                  window.alert(message);

                  this.utils.autoUploadUrl = null;

                  // Remove the current recording tab, to assure the integrated mode page is closed.
                  chrome.tabs.remove(DejaClick.tabId);
                  // Remove the sidebar as well
                  window.close();
               }else {
                  message = "Script not sent. ERROR: " + xmlhttp.responseText;
                  window.alert(message);
               }
               return;
            }

            if (prefs.getPrefOption('DC_OPTID_ENCRYPTREMOTE') &&
                  script.needsEncryption(
                     prefs.getPrefOption('DC_OPTID_ENCRYPTINPUT'))) {
               digest = script.getRemotePasswordDigest();
               if (digest == null) {
                  message = 'deja_sidebar_encryptRemoteQuery1';
               } else {
                  message = 'deja_sidebar_encryptRemoteQuery2';
               }
               if (window.confirm(this.getMessage(message))) {
                  this.openDialog('ui/content/dejaPassword.html', {
                     question: 'deja_password_uploadPrompt',
                     digest: digest
                  }, this.processUploadPassword.bind(this));

               } else {
                  script.domTreeDelAttribute(script.getScriptElement(),
                                             'rctoken');
                  this.startScriptUpload();
               }

            } else {
               this.startScriptUpload();
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   processUploadPassword: function (aEncryption) {
      try {
         if (aEncryption == null) {
            window.alert(this.getMessage('deja_sidebar_remoteCryptCancelled'));
         } else {
            this.startScriptUpload(aEncryption);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   startScriptUpload: function (opt_encryption) {
      this.openDialog('ui/content/dejaUpload.html',
         (opt_encryption == null) ? null : opt_encryption,
         this.completeUploadScript.bind(this));
   },

   /**
    * Complete the upload of a script to AlertSite.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aUrl The URL to which to navigate, if non-empty.
    */
   completeUploadScript: function (aUrl) {
      try {
         this.logger.logDebug('Script upload complete: ' + aUrl);
         if (aUrl.length !== 0) {
            window.open(aUrl, '_blank');
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously download a script from an AlertSite monitoring account.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   downloadScript: function (aEvent, aUi) {
      this.checkScript(this.openDialog.bind(this,
         'ui/content/dejaDownload.html'), true);
   },

   /**
    * Bring up the dialog to configure test on demand.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent A jQuery click event for the TOD button.
    */
   configureTestOnDemand: function (aEvent) {
      try {
         if (this.state.dialog == null) {
            if (this.prefService.getPrefOption('DC_OPTID_SKIPTESTOPTSDLG')) {
               this.initiateTestOnDemand(true);
            } else {
               this.openDialog('ui/content/dejaTest.html',
                  null,
                  this.initiateTestOnDemand.bind(this));
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * URL for an interstitial page used while a test on demand loads.
    * @const
    */
   TOD_URL: 'https://scripts.alertsite.com/uploading/test_on_demand',

   /**
    * Initiate a test on demand run.
    * @this {DejaClickUi.Sidebar}
    * @param {boolean} aSuccess True if the configuration was successful.
    */
   initiateTestOnDemand: function (aSuccess) {
      var error;
      try {
         if (aSuccess) {
            error = this.restApi.uploadScript(this.getScript(),
               this.restApi.TYPE_INSTANTTEST,
               this.prefService.getPrefOption('DC_OPTID_INSTANTTESTOPTS'),
               null, // Never encrypt for Test on Demand.
               this.completeTestOnDemand.bind(this));
            if (error.length !== 0) {
               window.alert(error);
            } else {
               window.open(this.TOD_URL, '_blank');
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display the results of a test-on-demand run.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aError The empty string on success, an error message
    *    if the TOD submission failed.
    * @param {string} aUrl The URL to monitor the TOD run.
    */
   completeTestOnDemand: function (aError, aUrl) {
      try {
         this.logger.logDebug('Test on Demand initiated: ' +
            aError + ', ' + aUrl);
         if (aError.length !== 0) {
            window.alert(aError);
            aUrl = '';
         }
         this.tabsApi.query({ url: this.TOD_URL },
            this.loadUrlInTab.bind(this, aUrl));
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Load a URL into an existing tab (or create a new tab).
    * @this {DejaClickUi.Sidebar}
    * @param {string} aUrl The URL to be loaded. If this is an empty string,
    *    close the tab instead.
    * @param {!Array.<!chrome.Tab>} aTabs List of potential tabs in which
    *    to open the URL.
    */
   loadUrlInTab: function (aUrl, aTabs) {
      try {
         if (aTabs.length === 0) {
            if (aUrl.length !== 0) {
               window.open(aUrl, '_blank');
            }

         } else if (aUrl.length === 0) {
            this.tabsApi.remove(aTabs[0].id);

         } else {
            this.tabsApi.update(aTabs[0].id, {
               url: aUrl,
               active: true
            });
         }

      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Display the dashboard for the current AlertSite user.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   displayAlertSiteDashboard: function (aEvent, aUi) {
	   var dashboardUrl = this.restApi.getDashboardURL();
	   if (dashboardUrl && dashboardUrl != '') {
          window.open(dashboardUrl, '_blank');
	   }
	   else {
          this.postNavigate('loadDashboard');
       }
   },

   /**
    * Display the console for the current AlertSite user.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   displayAlertSiteConsole: function (aEvent, aUi) {
      this.postNavigate('loadConsole');
   },

   /**
    * Display the reports for the current AlertSite user.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   displayAlertSiteReports: function (aEvent, aUi) {
      var reportUrl = this.restApi.getReportURL();
	  if (reportUrl && reportUrl != '') {
         window.open(reportUrl, '_blank');
	  }
	  else {
         this.postNavigate('loadReports');
      }
   },

   /**
    * Load the specified page of the current user's AlertSite account
    * via a POST request.
    * @this {DejaClickUi.Sidebar}
    * @param {string} aType The type of page to be loaded. This is
    *    actually the name of a function in dejaPostNavigation.js.
    */
   postNavigate: function (aType) {
      var postWindow;

      if (this.restApi.isLoggedIn()) {
         postWindow = window.open(this.extensionApi.getURL(
            'ui/content/dejaPostNavigation.html'), '_blank');
         if (postWindow.hasOwnProperty('DejaClickUi') &&
             postWindow.DejaClickUi.hasOwnProperty(aType)) {
            postWindow.DejaClickUi[aType]();
         } else {
            postWindow.onload = function () {
               postWindow.DejaClickUi[aType]();
            };
         }
      }
   },

   /**
    * Display an About DejaClick page.
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call.
    * @param {!{item: !jQuery}} aUi The activated menu item.
    */
   displayAboutPage: function (aEvent, aUi) {
      try {
         this.openDialog('ui/content/dejaAbout.html');
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Open a dialog window and disable all the controls in the sidebar
    * and its frames.
    * @this {DejaClickUi.Sidebar}
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
         if (this.state.properties !== null) {
            this.state.properties.openParentDialog();
         }
         this.enableControls();
      }
   },

   /**
    * Center the dialog over the sidebar window.
    * @this {DejaClickUi.Sidebar}
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
    * sidebar controls. Handle the dialog result.
    * @this {DejaClickUi.Sidebar}
    * @param {?function(*)} aCallback Function to handle the result
    *    of the dialog.
    * @param {*} aResult Value returned from the dialog.
    */
   closeDialog: function (aCallback, aResult) {
      try {
         this.state.dialog = null;
         if (this.state.properties !== null) {
            this.state.properties.closeParentDialog();
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
    * Enable or disable the UI controls based upon the current state.
    * @this {DejaClickUi.Sidebar}
    */
   enableControls: function () {
      var unloaded, loggedIn, restActive,
         stopped, recording, playing, paused, suspended,
         numevents;

      if (this.state.dialog !== null) {
         this.elements.allButtons.button('option', 'disabled', true);
         this.elements.tabsBar.tabs('option', 'disabled', true);
      } else {
         unloaded = this.getScript() == null;
         loggedIn = this.restApi.isLoggedIn();
         restActive = this.restApi.isActive();

         stopped = recording = playing = paused = suspended = false;
         switch (this.state.runmode) {
         case this.constants.RUNMODE_INACTIVE:
         case this.constants.RUNMODE_STOPPED:
            stopped = true;
            break;
         case this.constants.RUNMODE_RECORD:
            recording = true;
            break;
         case this.constants.RUNMODE_REPLAY:
            playing = true;
            break;
         case this.constants.RUNMODE_PAUSED:
            paused = true;
            break;
         case this.constants.RUNMODE_SUSPEND:
            suspended = true;
            break;
         }

         // TODO extract this info from the runstate notification instead
         numevents = DejaClick.service.recordedEvents || DejaClick.service.replayedEvents || 0;

         this.elements.openButton.button('option', 'disabled', !stopped);
         this.elements.saveButton.button('option', 'disabled',
            !stopped || unloaded);
         this.elements.recordButton.button('option', 'disabled',
            !stopped && !paused);

         this.elements.chooseMobileButton.button('option', 'disabled', !stopped);
         if (stopped) {
            this.elements.chooseMobileButton.show();
         } else {
            this.elements.chooseMobileButton.hide();
         }

         this.elements.chooseAppendModeButton.button('option', 'disabled', !paused);
         if (playing || paused) {
            this.elements.chooseAppendModeButton.show();
         } else {
            this.elements.chooseAppendModeButton.hide();
         }

         this.elements.playButton.button('option', 'disabled',
            (!stopped && !paused) || unloaded);

         this.elements.chooseReplayModeButton.button('option', 'disabled',
            (!stopped && !paused) || unloaded);

         this.elements.pauseButton.button('option', 'disabled', !playing);
         this.elements.stopButton.button('option', 'disabled',
            !recording && !playing && !paused && !suspended);
         this.elements.todButton.button('option', 'disabled',
            !stopped || !loggedIn || restActive || unloaded);
         this.elements.optionsButton.button('option', 'disabled',
            !stopped && !paused);
         this.elements.nonReplayOptions.toggleClass('ui-state-disabled',
                                                    !stopped);
         this.elements.replayModeItem.toggleClass('ui-state-disabled',
                                                  !stopped && !paused);

         if (this.utils.autoUploadUrl){
             this.elements.loginButton.hide();
             this.elements.monitorButton.show();
             this.elements.monitorButton.button('option', 'disabled', this.getScript() == null);
         }else if (loggedIn) {
            this.elements.loginButton.hide();
            this.elements.monitorButton.show();
         } else {
            this.elements.loginButton.show();
            this.elements.monitorButton.hide();
         }

         this.elements.loginButton.button('option', 'disabled',
            !stopped || restActive);
         if (!this.utils.autoUploadUrl) {
             this.elements.monitorButton.button('option', 'disabled',
                 !stopped || restActive);
         }

         this.elements.helpButton.button('option', 'disabled', false);

         if (!stopped) {
            this.elements.tabsBar.tabs('option', 'active', 0);
         }
         this.elements.tabsBar.tabs('option', 'disabled', !stopped);

         if (stopped && this.state.validationmode) {
            this.disableValidationMode();
         }
         this.elements.decorateButton.button('option', 'disabled',
            (!recording && !paused && !suspended) || (numevents < 1) || (this.state.validationmode));
         if (this.state.validationmode) {
            this.elements.decorateButton.hide();
            this.elements.closeDecorateButton.show();
            this.elements.closeDecorateButton.button('option', 'disabled', false);
         }
         else {
            this.elements.decorateButton.show();
            this.elements.closeDecorateButton.hide();
         }

         if (unloaded) {
            this.elements.needsScriptItems.addClass('ui-state-disabled');
         } else {
            this.elements.needsScriptItems.removeClass('ui-state-disabled');
         }
      }
   },

   /**
    * Fill the ChooseMobile dropdown menu
    * @this {DejaClickUi.Sidebar}
    */
   fillMobileDevices: function() {
      var mobileDevices, activeMobileDevices = [], keys,
         i, l, deviceId, deviceObject;

      mobileDevices = jQuery.extend(true, {},
         this.prefService.getPrefOption('DC_OPTID_MOBILEDATA'));
      keys = Object.keys(mobileDevices);

      for (i = 0, l = keys.length; i < l; i++) {
         deviceId = keys[i];
         deviceObject = mobileDevices[deviceId];
         if (deviceObject.isActive) {
            deviceObject.id = deviceId;
            activeMobileDevices[deviceObject.position] = deviceObject;
         }
      }

      this.elements.chooseMobileMenu.empty();
      this.addMobileDeviceItem('Normal', '');

      for (i = 0, l = activeMobileDevices.length; i < l; i++) {
         deviceId = activeMobileDevices[i].id;
         deviceObject = mobileDevices[deviceId];
         this.addMobileDeviceItem(deviceObject.name, deviceId);
      }

      this.selectMobileDeviceItem(this.state.selectedMobileDeviceID);
   },

   /**
    * Append a device menuitem into the ChooseMobile menu
    * @this {DejaClickUi.Sidebar}
    * @param {string} name
    * @param {string} value
    */
   addMobileDeviceItem: function(name, value) {
      var innerHTML, li, a, label, input;

      try {
         input = $('<input>')
            .attr('name', 'mobile')
            .attr('type', 'radio')
            .attr('value', value);

         label = $('<label>')
            .append(input)
            .append(name);

         a = $('<a>')
            .append(label);

         li = $('<li>')
            .addClass('ui-menu-item')
            .append(a);

         this.elements.chooseMobileMenu.append(li);

      } catch (ex) {
         this.logger.logException(ex);
      }

   },

   /**
    * Save a selected device as a param for script recording
    * @this {DejaClickUi.Sidebar}
    * @param aEvent
    */
   selectMobileDevice: function(aEvent) {
      var deviceNode, deviceId, devices, deviceObj, simulateDeviceObj, simulateDeviceStr;

      try {
         if ($(aEvent.target).is('input')) {
            deviceNode = $(aEvent.target);
         }
         else {
            deviceNode = $(aEvent.target).find('input');
         }

         deviceId = deviceNode.val();

         if (deviceId) {
            deviceObj = this.prefService.getPrefOption('DC_OPTID_MOBILEDATA')[deviceId];

            if (deviceObj !== undefined) {
               simulateDeviceObj = {
                  name: deviceObj.name,
                  useragent: deviceObj.userAgent,
                  width: deviceObj.size.width,
                  height: deviceObj.size.height,
                  XHTML_MP: deviceObj.XHTMLSupport
               };

               simulateDeviceStr = JSON.stringify(simulateDeviceObj);

               this.state.selectedMobileDeviceID = deviceId;
            }
            else {
               simulateDeviceStr = '';

               this.state.selectedMobileDeviceID = '';
            }

            this.prefService.setPrefOption('DC_OPTID_SIMULATEMOBILE', simulateDeviceStr);
         }
         else {
            simulateDeviceStr = '';
            this.state.selectedMobileDeviceID = ''; 
            this.prefService.setPrefOption('DC_OPTID_SIMULATEMOBILE', simulateDeviceStr);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Set mobile device menuitem as selected
    * @this {DejaClickUi.Sidebar}
    * @param {string} aValue
    */
   selectMobileDeviceItem: function(aValue) {
      var selectedItem;
      try {
         selectedItem = this.elements.chooseMobileMenu
            .find('input[value="' + aValue + '"]');

         if (!selectedItem.length) {
            selectedItem = this.elements.chooseMobileMenu
               .find('input[value=""]');
         }

         selectedItem.prop('checked', true);
      } catch (ex) {
         this.logger.logException(ex);
      }

   },

   /**
    * Set append mode when replay is paused
    * @this {DejaClickUi.Sidebar}
    * @param {!Event} aEvent The event that caused the call
    */
   setAppendMode: function(aEvent) {
      try {
         if (aEvent.currentTarget.value == 'default') {
            this.prefService.setPrefOption('DC_OPTID_APPENDMODE', this.constants.DC_APPENDMODE_DEFAULT);
         }
         else if (aEvent.currentTarget.value == 'subscript') {
            this.prefService.setPrefOption('DC_OPTID_APPENDMODE', this.constants.DC_APPENDMODE_SUBSCRIPT);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   }
};

$(function () {
   var dejaService;

   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('sidebar')) {
            DejaClickUi.sidebar.close();
            delete DejaClickUi.sidebar;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      dejaService = DejaClick.service;
      DejaClickUi.sidebar = new DejaClickUi.Sidebar(DejaClick.utils,
         DejaClick.constants, DejaClick.getScript, DejaClick.setScript,
         dejaService.getRunMode(),
         dejaService.setRunMode.bind(dejaService),
         DejaClick.EventRegistration, DejaClick.DialogWindow, DejaClick.Script,
         DejaClick.Variable,
         chrome.extension, chrome.tabs, chrome.windows,
         chrome.downloads,
         chrome.runtime);

      $(window).on('unload', unload);
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
