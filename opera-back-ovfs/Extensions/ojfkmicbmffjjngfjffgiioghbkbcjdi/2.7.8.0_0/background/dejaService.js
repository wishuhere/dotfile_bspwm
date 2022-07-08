/*
* DejaClick by SmartBear.
* Copyright (C) 2013-2022 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

/*global DejaClick,chrome,document,setTimeout,clearTimeout*/

'use strict';
//////////////////////////////////////////////////
// Create a private scope
(function() {
//////////////////////////////////////////////////

// treeview icon states
var TREETYPE_NORM           = 0;
var TREETYPE_PAUSE          = 1;
var TREETYPE_PLAY           = 2;
var TREETYPE_CHECK          = 3;
var TREETYPE_WARN           = 4;
var TREETYPE_ERROR          = 5;
var TREETYPE_OFF            = 6;


var locationChanges = [];
/**
 * @constructor
 */
DejaClick.DejaService = function (){
};

var gDC = DejaClick.service;

//var gSearch = new DejaClick.Search(gDC.logger);
var constants = DejaClick.constants;

DejaClick.DejaService.prototype = {

   DCMODULE: "DejaService.",

   // replay hint labels
   DC_THINKTIMEHINT: 'thinktime',
   DC_LOCATIONHINT: 'locations',
   DC_MUTATIONHINT: 'mutations',
   DC_SCRIPTINGHINT: 'scripting',
   DC_BROWSERHINT: 'browsers',
   DC_NETWORKHINT: 'netactivity',

   DC_OPTVAL_MAXERRORCOUNT: constants.MAXERRORCOUNT,
   DC_OPTVAL_STATUSDELAY: 10,
   DC_OPTVAL_STOPRECORDREPLAYDELAY: 50,
   DC_OPTVAL_VALIDATIONDELAY: 500,

   // Replay status states.
   REPLAY_SUCCESS: 0,
   REPLAY_WARNING: 1,
   REPLAY_ERROR: 2,

   VALIDATIONTYPE_KEYWORD    : constants.VALIDATION_TYPE_KEYWORD,
   VALIDATIONTYPE_JAVASCRIPT : constants.VALIDATION_TYPE_JAVASCRIPT,
   VALIDATIONTYPE_IMAGE      : constants.VALIDATION_TYPE_IMAGE,

   
   DC_SMARTBEAR_VERSION_HEADER      : "X-SmartbearVersion",
   DC_SMARTBEAR_REQUEST_ID_HEADER   : "X-SmartbearReqID",
   DC_APPDYNAMICS_INTEGRATION_HEADER: "appdynamicssnapshotenabled",
   DC_SMARTBEAR_VERSION             : "1.1",

   _initialized : false,         // indicates if component is initialized
   _runMode : constants.RUNMODE_INACTIVE,  // primary deja run-mode indicator
   _waitMode:  constants.WAITMODE_INACTIVE, // primary deja wait-mode indicator
   _waitType: constants.WAITTYPE_INACTIVE, // progress dialog wait type indicator

   // the default set of urls to mask (block) during processing - others may be added from GUI
   _maskedURLs : [ "^about:", "^wyciwyg:", "^resource:", "^javascript:", "^chrome"],

   // array of run-type property strings from the dejaService.properties localization file
   // note: these are position-dependent and must match the official order of valid run types defined above and in the .idl file
   _runTypeProperties : [ "dcService_runInactive", "dcService_runStoppedAborted", "dcService_runStoppedNoScript", "dcService_runStoppedLoaded",
                          "dcService_runReplay", "dcService_runPaused", "dcService_runRecordNew", "dcService_runRecordAppend" ],

   // array of wait-type property strings from the dejaService.properties localization file
   // note: these are position-dependent and must match the official order of valid wait types defined above and in the .idl file
   _waitTypeProperties : [ "dcService_waitInactive", "dcService_waitLoading", "dcService_waitSaving", "dcService_waitLoadRemote",
                           "dcService_waitSaveRemote", "dcService_waitPausing", "dcService_waitPaused", "dcService_waitStopping",
                           "dcService_waitStopped", "dcService_waitInitializing", "dcService_waitDispatching", "dcService_waitProcessing",
                           "dcService_waitSkipping", "dcService_waitAnalyzing", "dcService_waitValidating", "dcService_waitLoadingDoc",
                           "dcService_waitLocationChg", "dcService_waitThinktime", "dcService_waitLocations", "dcService_waitMutations",
                           "dcService_waitBrowsers", "dcService_waitNetwork", "dcService_waitCache", "dcService_waitClassifytime" ],

   // arrays of boolean, integer, and character system preferences that should persist after Stop command is issued
   _boolPrefsP : [ 'DC_OPTID_AUTOSHUTDOWN', 'DC_OPTID_WARNEMBEDEDOBJPROMPT', 'DC_OPTID_WARNSCREENRESIZEPROMPT', 'DC_OPTID_WARNFIRSTEVENTPROMPT',
                   'DC_OPTID_WARNURLMISMATCHPROMPT', 'DC_OPTID_WARNADVANCEDMODEPROMPT', 'DC_OPTID_WARNNEWVISITORPROMPT', 'DC_OPTID_WARNFILEINPUTPROMPT' ],

   _intPrefsP  : [ 'DC_OPTID_AUTOREPLAYPAUSE', 'DC_OPTID_APPENDMODE' ],

   _charPrefsP : [ ],

   _suspendType : '',          // indicates the type of record/replay suspend mode (validate/dejanotes floater)
   
   init: function(aWindowId, aUtils, aSearch)
   {
      if (this._initialized) { return; }
      gDC = this;

      // initialize our startup values;
      this.windowId = aWindowId;
      this._modal = {
            set: (func)=>{
                  gDC.__modal = func
            }
      };
      this.__modals = [];

      this._isFirefox = this.isFirefoxExtension();

      // grab handle to few interfaces
      this.sidebarElements = null;
      this._observerService = aUtils.observerService;
      this._utils = aUtils;
      this._script = null;
      this._fileLists = null; //UXM-10587
      this._fileListLastUpdate = null;
      this.logger = aUtils.logger;
      this._search = aSearch;
      this._prefs = aUtils.prefService;
      this._serverOperation = false;
      this._isrecording = false;
      this._isAppending = false;
      this._timers = [];
      this._variables = [];
      this._encounteredUrls = {};
      this._encounteredMimes = {};
      this._actionLabel = {};
      this._runState = null;
      this._waitState = null;
      this._systemBundle = null;
      this._messageBundle = null;
      this.validationModeEnabled = false;

      //UXM-11786 & UXM-11949 - MFA / Triggered subscripts
      this._triggeredSubscripts = null;
      this._triggers = null;
      this._mfaInfo = null;
      this.triggerFired = null;
      this.triggeredSubscriptPrevNode = null;
      this.triggeredSubscriptPrevSubcript = null;
      this.triggeredScriptNextEvent = null;
      this.waitingForTriggerKeywordResult = null;
      this.waitingForMFAvalue = null; //UXM-11947 - Keystrokes support for MFA

      this._actTreeRoots = [];  // list of root nodes of record actions DOM subtrees (including subscripts)

      this._domTreeRoot = null;
      this._resTreeRoot = null;
      this._navTreeRoot = null;
      this._totalEventCount = 0;         // total number of events in the current script (including subscripts)
      this._totalActionCount = 0;        // total number of actions in the current script (including subscripts)

      this._replayCount = 0;
      this.navDocumentNodes = [];
      this.documentsTracked = [];
      this.browsersTracked = [];
      this.storeNavFrames = true;
      
      this.contentViews = [ ];
      this.contentViewsByName = { };
      
      this.eventTimeout = null;          // event replay timeout
      this.readyTimeout = null;          // browser-is-ready check delay
      this.replayTimeout = null;         // timeout/delay prior restarting event replay
      this.statusTimeout = null;         // timeout/delay prior to sending runState notifications
      this.responseTimeout = null;       // injected event response listener timeout
      this.shutdownTimeout = null;       // event replay shutdown delay
      this.networkTimeout = null;        // network content timeout before prompting user for action
      this.locationsTimeout = null;      // location timeout before prompting user for action
      this.navigationTimeout = null;     // navigation timeout before prompting user for action
      this.mutationBeginTimeout = null;  // wait-for-mutations-start timeout before prompting user for action
      this.mutationEndTimeout = null;    // wait-for-mutations-end   timeout before prompting user for action
      this.replayFailureTimeout = null;  // timeout/delay prior restarting replay failure processing
      this.finalizeStateTimeout = null;  // timeout/delay prior to restarting finalizeState activities
      this.quitApplicationTimeout = null;// timeout/delay prior to restarting application shutdown activities
      this.popupBlockerTimeout = null;   // timeout/delay prior to restarting popup blocker
      this.domFixupTimeout = null;       // timeout/delay prior to restarting DOM fixup activities
      this.validationTimeout = null;     // time limit for performing asynchronous validations
      this.mutationsDelay = null;        // post-last mutation delay before replaying next event
      this.stopRecordReplayTimeout = null;   // timeout/delay prior to capturing 
      this.authUserCredentials = null;
      this.onCompletedTimeout = null; //UXM-12644 Timeout for the chrome.webNavigation.onCompleted event
      
      // clear replay/record exception counter now, as errors may occur before replay/record begins
      this.exceptionCount = 0;

      this.activeStyleApplied = false;
      this.lastSearchId = 0;
      this.activeSearches = {};
      this.activeValidations = {};
      this.lastValidationId = 0;
      this.eventsCaptured = [];           
      this.tabDetachCounter = [];         // UXM-13398 - Keystrokes Improvement ( Tab Attacher )
 
      this.captureInitiated = false;
      this.resizePromptActive = false;

      this.replayedEvents = 0;
      this.headerPrefix = null;
      this.attempt = 0;
      this.pendingStepTiming = true;
      this.pendingCapture = false;
      this.simulateMobile = null;
      this.processStepErrors = false;

      //Chrome KeyStrokes - Script variables
      this.stickyValue = null; 
      this.varName = null;
      
      // initialize subordinate data structures and variables
      this.subinit();

      // initialize main state variables
      this._waitMode =  constants.WAITMODE_READY;

      this._runMode = constants.RUNMODE_STOPPED;

      // init runState and waitState variables (skip notification)
      this._setWaitType( constants.WAITTYPE_STOPPED, true );

      this._setRunType( constants.RUNTYPE_STOPNOSCRIPT, true );

      this._initialized = true;

      // set our state again, this time sending client notification
      this._setWaitType( constants.WAITTYPE_STOPPED );
      this._setRunType( constants.RUNTYPE_STOPNOSCRIPT );

      gDC.logger.logInfo( "DejaService component started", false );
   },

   isFirefoxExtension: function () {
      return typeof browser !== "undefined";
   },

   isInitialized: function () {
      return this._initialized;
   },

   // Perform component shutdown and finalization
   halt: function()
   {
      if (!gDC) { gDC = this; }
      gDC.logger.logInfo( "DejaService component stopping", false );
      gDC._setWaitType( constants.WAITTYPE_STOPPED );
      gDC._setWaitType( constants.WAITTYPE_INACTIVE );

      gDC._setRunType( constants.RUNTYPE_INACTIVE );

      // stop any pending timers
      gDC.teardownAsyncTimers();

      gDC.purgeReplayData();
      gDC.purgeRecordData();
      // drop any record/replay object or dom references
      gDC.resetRecordReplayRefs();

      gDC._timers = [];

      gDC._runState = null;
      gDC._waitState = null;

      gDC._domTreeRoot = null;
      gDC._actTreeRoots = [];
      gDC._resTreeRoot = null;
      gDC._navTreeRoot = null;

      gDC.lastFocusedBrowserObj = {};

      gDC._encounteredUrls = {};
      gDC._encounteredMimes = {};
      gDC._actionLabel = {};
      
      gDC.contentViews = [ ];
      gDC.contentViewsByName = { };
      
      // Reset the script
      DejaClick.setScript(null);

      // remove our "always on" observer topics
      gDC.teardownObservers();
      gDC.teardownListeners();
      // send out one last notification
      if (gDC._observerService) {  gDC._setTimeout( function(){gDC._observerService.notifyObservers( "dejaclick:servicehalted", null);}, 1000); }
      //if (gDC._observerService) { gDC._observerService.notifyObservers( "dejaclick:servicehalted", null); }

      gDC._initialized = false;

      // DejaClick.gDC = null;  // don't remove, commented out as a reminder!

      return;
   },

   quitApplication: function()
   {
      try {
         gDC.logger.logInfo( "shutting down application" );
         chrome.windows.getAll({ populate: false },
                                 function(aWindowList) {                                 
                                 for (var index = 0; index < aWindowList.length; index++) {
                                    gDC.logger.logInfo( "closing window " +  aWindowList[index].id);
                                    chrome.windows.remove(aWindowList[index].id);
                                 }
                              });

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"quitApplication" );
      }
   },

   shutdown: function()
   {
       gDC.quitApplication();
   },

   // ============================
   // Primary support functions
   // ============================

   // one-time init of DejaClick object-instantiation properties
   subinit: function()
   {
      try {
         // grab references to our localized string bundle sets
         this._systemBundle  = chrome.i18n;
         this._messageBundle = chrome.i18n;

         this._serverOperation = this._utils.versionInfo.extension.server;

         // reset some persistent client-side preferences back to their default values
         this.resetSystemIntPref( 'DC_OPTID_AUTOREPLAYPAUSE' );
         this.resetSystemIntPref( 'DC_OPTID_APPENDMODE' );

         // initialize location identifier +
         this.replayLocation = this.getSystemStringPref( 'DC_OPTID_LOCATIONID');

         gDC.attachObservers();
         if (!this._serverOperation) {
            chrome.webRequest.onBeforeRedirect.addListener(gDC.alertLogout, {urls:["<all_urls>"]});
         }

         gDC._observerService.notifyObservers("dejaclick:power", "on");

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"subinit", "Error while initializing DejaClick object" );
      }

   },  // end of subinit

   /**
    * Get the number of times the script has been replayed.
    * @this {!DejaClick.DejaService}
    * @return {integer} The number of replays.
    */
   getReplayCount: function() {
      return this._replayCount;
   },

   /**
    * Set the number of times the current script has been replayed.
    * @this {!DejaClick.DejaService}
    * @param {integer} count The number of replays.
    */
   setReplayCount: function(count) {
      this._replayCount = count;
   },

   /**
    * Get the location id.
    * @this {!DejaClick.DejaService}
    * @return {string} The location id..
    */
   getLocationId: function() {
      return this.replayLocation;
   },

   /**
    * Set the location id.
    * @this {!DejaClick.DejaService}
    * @param {string} location The location id.
    */
   setLocationId: function(location) {
      this.replayLocation = location;
   },
   
   /**
    * Set the prefix for HTTP request headers.
    * @this {!DejaClick.DejaService}
    * @param {string} aPrefix The prefix with {BrowserPrefix}{CustID}.{DeviceID}.{DevLogID}.{LocationID}.
    */   
   setHeaderPrefix: function(aPrefix) {
      this.headerPrefix = aPrefix;
   },
   
   /**
    * Set the attempt for HTTP request headers.
    * @this {!DejaClick.DejaService}
    * @param {integer} aAttempt The attempt number (First try = 0, Second try = 1)
    */   
   setAttempt: function(aAttempt) {
      this.attempt = aAttempt;
   },
  

   setStepError: function(aStepError) {
      this.processStepErrors = aStepError;
   },
 
   /**
    * Get the tracking sequence number for a given URL .
    * @this {!DejaClick.DejaService}
    * @param {string} aUrl The URL that we need the sequence number for.
    */
   getTrackingSeq : function (aUrl) {
   
      if (!aUrl || !gDC.trackingSeq) {
         return -1;
      }      
      
      if (gDC.trackingSeq.hasOwnProperty(aUrl)) {
         return gDC.trackingSeq[aUrl];
      }
      
      return -1;   
   },

   _extractDomain : function (aUrl)
   {
       var arr = aUrl.split(".");
       var arrLength = arr.length;
       if (arrLength > 1) {
          var domain = arr[arrLength-2] + "." + arr[arrLength-1];
          return domain;
       }
       return null;
   },

   _setBaseDomain : function (aUrl1, aUrl2)
   {
       if (!aUrl1 || !aUrl2) {
          return;
       }

       if (aUrl1.indexOf("://") == -1) {
          aUrl1 = "http://" + aUrl1;
       }
       if (aUrl2.indexOf("://") == -1) {
          aUrl2 = "http://" + aUrl2;
       }
       var hostname1 = (new window.URL(aUrl1)).hostname;
       var hostname2 = (new window.URL(aUrl2)).hostname;
       var domain1 = gDC._extractDomain(hostname1);
       var domain2 = gDC._extractDomain(hostname2);
       if (domain1) {
          gDC.domainList.push(domain1);
       }
       if (domain2) {
          gDC.domainList.push(domain2);
       }
   },


   
   
   // -----------------------------------------------
   // -----------------------------------------------
   // reset all record/replay references
   resetRecordReplayRefs : function()
   {
      try {
         this.eventsCaptured = [];
         this.eventsSkipped = [];
         this.eventsBranched = [];
         this.httpSteps = [];
         this.documentsTracked = [];
         this.browsersTracked = [];
         this.browsersIgnored = [];
         this.tabsIgnored = [];
         this.urlsIgnored = [];
         this.urlsBlocked = [];
         this.customHeaders = [];
         this.customCookies = [];
         this.domainList = [];
         this.baseBrowser = null;
         this.actActionNode = null;
         this.actScriptNode = null;
         this.resActionNode = null;
         this.actEventNode = null;
         this.resEventNode = null;
         this.navEventNode = null;
         this.userTabOpenEvent = null;
         this.userTabCloseEvent = null;
         this.userTabFocusEvent = null;
         this.userWinOpenEvent = null;
         this.userWinCloseEvent = null;
         this.userNavigationEvent = null;
         this.eventTimeout = null;
         this.readyTimeout = null;
         this.replayTimeout = null;
         this.statusTimeout = null;
         this.responseTimeout = null;
         this.shutdownTimeout = null;
         this.networkTimeout = null;
         this.locationsTimeout = null;
         this.navigationTimeout = null;
         this.mutationBeginTimeout = null;
         this.mutationEndTimeout = null;
         this.replayFailureTimeout = null;
         this.quitApplicationTimeout = null;
         this.finalizeStateTimeout = null;
         this.popupBlockerTimeout = null;
         this.domFixupTimeout = null;
         this.validationTimeout = null;
         this.stopRecordReplayTimeout = null;
         this.onCompletedTimeout = null;
         this.mutationsDelay = null;
         this.newTabBrowserNode = null;
         this.lastBrowserObj = null;
         this.nextEvent = null;
         this.branchingRule = null;
         this.actTreeRoot = null;
         this.actEventNodes = null;
         this.subscriptNode = null;
         this._variable = null;
         this.trackingSeq = null;
         this.simulateMobile = null;
         this.m_debuggerAttached = {};
         this.dialogRules = [];
         this.dialogOpen = null;
         gDC._observerService.notifyObservers("dejaclick:reseteventinfo", {eventsCaptured : gDC.eventsCaptured});
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"resetRecordReplayRefs" );
      }
   },


   // reset all record/replay variables
   resetRecordReplayVars : function()
   {
      try {
         this.exceptionCount = 0;
         this.eventDialogs = 0;
         this.actionEvents = 0;
         this.recordedEvents = 0;
         this.replayedEvents = 0;
         this.replayedActions = 0;
         this.eventSteps = 0;
         this.actDialogNum = 0;
         this.actActionNum = 0;
         this.actEventNum = 0;
         this.resActionNum = 0;
         this.resEventNum = 0;
         this.navBrowserNum = 0;
         this.navLocationNum = 0;
         this.navDocumentNum = 0;
         this.navEventNum = 0;
         this.warnedForFlashClick = false;
         this.eventStartTime = 0;
         this.thinktimeStart = 0;
         this.thinktimeStop = 0;
         this.classifytimeStop = 0;
         this.networkStopTime = 0;
         this.pendingLocations = 0;
         this.evtKwValsProcessed = 0;
         this.actKwValsProcessed = 0;
         this.evtJSValsProcessed = 0;
         this.actJSValsProcessed = 0;
         this.evtImgValsProcessed = 0;
         this.actImgValsProcessed = 0;
         this.pendingEvtValidation = false;
         this.pendingActValidation = false;
         this.pendingActivity = false;
         this.pendingNetwork = false;
         this.pendingXMLRequest = false;
         this.pendingPrompt = false;
         this.pendingDispatch = false;
         this.pendingDispatchInfo = null;
         this.pendingDialog = 0;
         this.pendingBrowser = false;
         this.pendingValidate = false;
         this.skipSpeedAdjust = false;
         this.fullpageObjects = false;
         this.captureInitiated = false;
         this.pendingEvent = null;
         this.lastLogDebug = null;
         this.lastLogMessage = null;
         this.lastSuspendDelay = 0;
         this.lastReadyTimeout = 0;
         this.netActivityCount = 0;
         this.lastPausedEvent = 0;
         this.lastPausedNode = null;
         this.evtTimeoutCounter = 0;
         this.mutationsCount = 0;
         this.mutationsRecorded = 0;
         this.mutationsRequired = 0;
         this.mutationsCountLast = 0;
         this.fixupThreshold = 0;
         this.advisorRepairs = false;
         this.replayShuttingDown = false;
         this.eventsEnabled = true;
         
         this.scriptedHints = null;
         this.networkHints = null;
         this.verboseMode = false;
         this.restoreDeferred = false;
         this.eventMaxTime = 0;
         this.subscriptNum = 0;
         this.finalizedURL = null;
         this.requestedURL = null;
         this.activeSearches = {};
         this.lastTargetSearchId = -1;
         this.lastTargetDocId = -1;
         this.activeValidations = {};
         this.lastValidationId = -1;
         this.storeNavFrames = true;
         this.onCompletedReceived = false;
         this.activeStyleApplied = false;
         this.validatingActSeqNum = 0;
         this.validatingEvtSeqNum = 0;
         this.userAgent = '';
         this.httpCounter = 1;
         this.validationType = this.VALIDATIONTYPE_JAVASCRIPT;
         this.lastValidationEvent = 0;
         this.screenWasResized = false;
         this.pendingResize = false;
         this.pendingCapture = false;
         this.pendingStepTiming = true;
         this.lastEventSkipped = false;
         this.elementTargetNotFound = false;
         this.lastAppendEvent = 0;
         this.expectedDownloads = 0; //UXM-10759 - Used on playback to track downloads.
         this.activeDownloads = [];

         //UXM-11303 - Sticky variables should be calculated again on every replay.
         this._variables = [];

         //UXM-12071 - New variable to track last executed event type.
         this.previousEventType = null;
         this.currentEventType = null;
         
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"resetRecordReplayVars" );
      }
   },

   purgeRecordData : function()
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("purging record data..."); }

         if (gDC._domTreeRoot) {
            // remove any recording DOM subtree structures
            gDC._script.domTreeRemoveRoot( gDC._domTreeRoot, "actions", "record" );
            gDC._script.domTreeRemoveRoot( gDC._domTreeRoot, "navigation", "record" );
         }

         // clear recording references
         gDC._actTreeRoots = [];
         gDC._domTreeRoot = null;
         gDC._encounteredMimes = {};
         gDC._encounteredUrls = {};
         gDC._actionLabel = {};
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"purgeRecordData" );
      }
   },

   purgeReplayData : function()
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("purging replay data..."); }

         if (gDC._domTreeRoot) {
            // remove any replay DOM subtree structures
            gDC._script.domTreeRemoveRoot( gDC._domTreeRoot, "navigation", "replay" );
            gDC._script.domTreeRemoveRoot( gDC._domTreeRoot, "actions", "replay" );
         }
         gDC._navTreeRoot = null;
         gDC._resTreeRoot = null;

         //Global variable to track location changes
         locationChanges = [];

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"purgeReplayData" );
      }
   },

   startReplay: function() {
      this._setRunType( constants.RUNTYPE_REPLAY );
   },

   // begin record or replay actions
   begin : function()
   {
      try {
         gDC.resetRecordReplayRefs();
         gDC.resetRecordReplayVars();

         if (gDC._runMode == constants.RUNMODE_RECORD) {

            gDC.purgeReplayData();
            gDC.purgeRecordData();



            gDC._updateRunState();  // let observers update their recorded event
            gDC._scriptPath = null;

            if (gDC._domTreeRoot == null) {
               // create our base script DOM object and its initial XML root tag
               gDC._script = new DejaClick.Script ();
               gDC._fileLists = null; //UXM-10587 - Clean the file list variables always that we reset the script.
               gDC._fileListLastUpdate = null;
               gDC._triggeredSubscripts = null; 
               gDC._triggers = null; //UXM-11786
               gDC._mfaInfo = null;
               gDC.waitingForMFAvalue = null;
               if (document.implementation == null) {
                  throw new Error('No DocumentImplementation available');
               }
               var script = gDC._script.createScript( document.implementation);
               DejaClick.setScript(script);
               gDC._domTreeRoot = gDC._script.getScriptElement();
            } else {
               // otherwise, just remove the existing script attributes section
               gDC._script.domTreeRemoveNode(gDC._domTreeRoot.getElementsByTagName("attributes")[0]);
            }

            gDC._script.setChangesPending();

            // check for mobile simulation mode
            var simulateMobileStr = gDC.getSystemStringPref('DC_OPTID_SIMULATEMOBILE');
            if (simulateMobileStr && simulateMobileStr.length > 0) {

               gDC.simulateMobile = JSON.parse(simulateMobileStr);
               if (!gDC.simulateMobile) {
                  // the mobile device properties string is invalid
                  // (the exception has already been logged, so just get out of here)
                  return;
               }

               gDC.simulateMobile.width = Number(gDC.simulateMobile.width);
               gDC.simulateMobile.height = Number(gDC.simulateMobile.height);
               // set up mobile simulation mode before calling freezeCurrentSettings()
               gDC.setUpMobileSimulation();
            }
            
            // freeze the current browser preferences and deja settings to the script during record mode
            gDC.freezeCurrentSettings();

            // pre-load any custom cookies
            gDC.loadCustomCookies( gDC._domTreeRoot );

            // now apply the same frozen settings during record mode
            gDC.applyFrozenSettings();

            // Create an actions subtree structure to hold elements representing
            // all actions and events encountered during the recording process.
            // This tree also persists any config options the user has choosen
            // to customize for this particular script.
            gDC.actTreeRoot = gDC._script.domTreeCreateRoot( gDC._domTreeRoot, "actions", "record" );
            gDC._actTreeRoots = gDC._script.getActTreeRoots();


            // Create a navigation subtree structure to hold elements representing
            // all browsers, locations, documents, and events encountered during
            // the recording process.
            gDC._navTreeRoot = gDC._script.domTreeCreateRoot( gDC._domTreeRoot, "navigation", "record" );
            gDC._observerService.notifyObservers('dejaclick:refreshscripttabs', {hashkey: "1:script", state:"initial"} );

            gDC.updateTreeViews();

         }
         else if (gDC._runMode == constants.RUNMODE_REPLAY) {

            gDC._script = DejaClick.getScript();
            gDC._observerService.notifyObservers('dejaclick:handlescripttabfrombackground', {hashkey: "1:script", state: "initial"} );
            // In replay mode, make sure at least one actTreeRoot has been created,
            // from either an imported script file or from an interactive recording.
            if (!gDC._script) {
               gDC.logger.logWarning("Script missing while switching to RUNMODE_REPLAY.");
               gDC.alertUser( "dcMessage_missingscript", true, false );
               return;
            }

            gDC._domTreeRoot = gDC._script.getScriptElement();
            gDC._actTreeRoots = gDC._script.getActTreeRoots();

            if (!gDC._actTreeRoots || gDC._actTreeRoots.length === 0) {
               gDC.logger.logWarning("Nothing to replay while switching to RUNMODE_REPLAY. There are no action tree elements. ");
               gDC.alertUser( "dcMessage_missingscript", true, false );
               return;
            }

            //UXM-10587 - Load the existing file lists.
            gDC.exportAllFileLists();

            //UXM-11786 - Load triggered subscripts
            gDC.loadTriggeredSubcripts();

            //UXM-11786 - Load MFA info
            gDC.loadMFAinfo();

            // reset actTreeRoot to point to the main actions tree
            gDC.actTreeRoot = gDC._actTreeRoots[0];
            gDC.actEventNodes = gDC.actTreeRoot.getElementsByTagName("event");

            gDC.updateTreeViewState( TREETYPE_NORM );
            gDC.purgeReplayData();
            
            // check for mobile simulation mode
            var mobileMode = gDC._script.domTreeHasAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE );
            if (mobileMode) {
               gDC.simulateMobile = {};

               // set up mobile simulation mode before calling persistBrowserPrefs()
               gDC.setUpMobileSimulation();
            }
            
/*
            // persist some of our current browser settings
            gDC.persistBrowserPrefs();
*/
            // Create a navigation subtree structure to hold elements representing
            // all browsers, locations, documents, and events encountered during
            // the replay process.
            gDC._navTreeRoot = gDC._script.domTreeCreateRoot( gDC._domTreeRoot, "navigation", "replay" );

            // Create a new replay actions subtree to contain status, timings, and scoring "results"
            gDC._resTreeRoot = gDC._script.domTreeCreateRoot( gDC._domTreeRoot, "actions", "replay" );

            // pre-load any custom cookies
            gDC.loadCustomCookies( gDC._domTreeRoot );

            // apply the 'frozen' browser and deja settings from the script during replay mode
            gDC.applyFrozenSettings(gDC.setInitialBrowser.bind(gDC,
               gDC.areWeThereYet.bind(gDC)));

            // @todo save off the user's current popup-blocker setting
            // note: we must do this after applying the frozen script settings
            gDC.userAgent = gDC.getSystemStringPref("DC_OPTID_USERAGENT");
            
            if (gDC._script.domTreeHasAttribute(gDC._domTreeRoot, "useproxysettings") &&
                gDC._script.domTreeGetAttribute(gDC._domTreeRoot, "useproxysettings") === 'true') {
               gDC.loadProxySettings();
            }
            
            gDC._setWaitType( constants.WAITTYPE_INITIALIZING );            

         }

         // pre-load any URL exclusion masks
         gDC.loadUrlMasks( gDC._domTreeRoot );

         // pre-load any HTTP custom headers
         gDC.loadCustomHeaders( gDC._domTreeRoot );

         // cache our optional DOM node fixup throttle feature
         gDC.fixupThreshold = gDC.getSystemIntPref( 'DC_OPTID_FIXUPTHRESHOLD' );

         if (gDC._runMode == constants.RUNMODE_REPLAY) {

            // @todo: Resize Screen if we are replaying to collect
            // user experience parameters Do not resize for mobile
            // replay, since the screen isalready resized

            if (gDC._script.getFilename()) {
               var spath = gDC._script.getFilename().split( "/" );
               var sname = spath[ spath.length - 1 ];
               gDC.logger.logInfo( "Beginning replay for script: " + sname );
            } else {
               gDC.logger.logInfo( "Beginning replay of unsaved recording" );
            }

            // force-clear any prior value for this pref (set by nsDejaExtras)
            gDC.setSystemBoolPref('DC_OPTID_SUSPENDREPLAY', false);

            // cache the current system location ID
            var locationID = this.getScriptStringPref( 'DC_OPTID_LOCATIONID');
            gDC._setLocation(locationID);


            if (gDC._utils.verboseMode) {
               gDC.verboseMode = true;
            }

            // TODO: Load data sets and file lists.
            
            // init ContentViews
            if (!gDC.loadContentViews()) {
               gDC.logger.logInfo("Replay failure. Error loading Content Views!");
               gDC.handleReplayFailure( "dcMessage_dialogPromptInvalidTabError", null, constants.STATUS_SCRIPT_PARSE_ERROR );
               return;
            }

            // UXM-10587 - If the file list has never been loaded, we have to load it.
            if ( ! gDC._fileListLastUpdate )  {
               gDC.exportAllFileLists();
            }

            // UXM-10587 - Send the file lists to all the content scripts (if it isn't empty).
            if ( gDC._fileLists && gDC._fileLists.length > 0 ) {
               gDC._observerService.notifyObservers("dejaclick:prepareuploadfile", 
                  {  
                     listsdate: gDC._fileListLastUpdate,
                     filelists: gDC._fileLists
                  }
               );
            }

            gDC._replayCount++;  // bump replay counter
            
            gDC._variable = new DejaClick.Variable(gDC.logger, gDC._replayCount, gDC.replayLocation);
            
            // Performed when applyFrozenSettings completes.
            //gDC.setInitialBrowser(gDC.areWeThereYet.bind(gDC));

         } else {
            gDC.setInitialBrowser();
         }

         return;

      } catch ( e ) {
        try {
            // catch any possible faiures here too
            gDC.teardownObservers();
            gDC.teardownListeners();
         } catch ( e2 ) {}
         if (e) {
            gDC.logException( e, gDC.DCMODULE+"begin", "dcFailure_badscripterror", true, constants.STATUS_SCRIPT_PARSE_ERROR );
         }
      }
   },

   // append record actions to an existing script which is loaded and currently paused in replay
   appendRecording : function()
   {
      try {
         gDC.updateTreeViewState( TREETYPE_NORM );

         // take note of our append point
         var oldSubscriptNum  = gDC.subscriptNum;
         var oldEventNum      = gDC.actEventNum;

         var addSubscript = (gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_SUBSCRIPT);
         gDC.prepareRecordData( addSubscript );
         // rebuild treeview based on what's left of the script
         gDC.updateTreeViews();

         // @todo prepare dejaevents service for record mode

         gDC._setWaitType( constants.WAITTYPE_PAUSED );

         // @todo try to place focus on the last targeted node,
         //try { gDC.lastTargetNode.focus(); } catch(ex) {}

         var sname = "";
         if (gDC._script.getFilename()) {
            var spath = gDC._script.getFilename().split( "/" );
            sname = spath[ spath.length - 1 ];
         }

         gDC.logger.logInfo( "Recording: " + (addSubscript ? "Adding new subscript " + gDC.subscriptNum : "Appending") +
               " to " + (sname ? "script: " + sname : "unsaved recording") +
               " after [" + (oldSubscriptNum ? "subscript " + oldSubscriptNum : "main script") + "]" +
               " event " + oldEventNum);

         return;

      } catch ( e ) {
         try {
            // catch any possible failures here too
            gDC.teardownObservers();
            gDC.teardownListeners();
         } catch ( e2 ) {}

         if (e) {
            gDC.logException( e, gDC.DCMODULE+"appendRecording", "dcFailure_badscripterror", true, constants.STATUS_SCRIPT_PARSE_ERROR );
         }
      }
   },

   // set up mobile simulation mode
   setUpMobileSimulation : function()
   {
      try {

         if (gDC._runMode == constants.RUNMODE_RECORD) {

            // Add constantsmobile attributes to the script
            gDC._script.domTreeAddAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE, gDC.simulateMobile.name );

            if (gDC.simulateMobile.XHTML_MP == "true") {
               gDC._script.domTreeAddAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_CONTENT, constants.DC_MOBILECONTENT_XHTML_MP );
            }
/*
            if (gDC.simulateMobile.plugins) {
               var strMobilePlugins = gDC.simulateMobile.plugins.join(",");
               gDC._script.domTreeAddAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_PLUGINS, strMobilePlugins );
            }

            if (gDC.simulateMobile.imageURL) {
               gDC._script.domTreeAddAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_IMAGE_URL, gDC.simulateMobile.imageURL );
            }
*/
            // Add persisted browser preferences to the script.
            // This must be done before persistBrowserPrefs() gets called,
            // so that the current value of these prefs will be backed up (persisted)
            // and then restored after record/replay.
            if (gDC.simulateMobile.useragent) {
               gDC._script.domTreeAddPreference( gDC._domTreeRoot, 'general.useragent.override', gDC.simulateMobile.useragent, 'charprefs' );
            }

         } else if (gDC._runMode == constants.RUNMODE_REPLAY) {

            // recreate the simulate mobile properties object and save it back to the pref
            // (to be later referenced by the mobile sidebar)
            gDC.simulateMobile.name = gDC._script.domTreeGetAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE );
            gDC.simulateMobile.width = gDC._script.domTreeGetAttribute( gDC._domTreeRoot, 'browserwidth' );
            gDC.simulateMobile.height = gDC._script.domTreeGetAttribute( gDC._domTreeRoot, 'browserheight' );
//            gDC.simulateMobile.imageURL = gDC.domTreeGetAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_IMAGE_URL );
            gDC.simulateMobile.useragent = gDC._script.domTreeGetPreference( gDC._domTreeRoot, 'general.useragent.override', 'charprefs' );
/*
            var mobilePluginsList = gDC.domTreeGetAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_PLUGINS );
            if (mobilePluginsList) {
               gDC.simulateMobile.plugins = mobilePluginsList.split(',');
            }
*/
            var mobileContent = gDC._script.domTreeGetAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_CONTENT );
            if (mobileContent) {
               gDC.simulateMobile.XHTML_MP = (mobileContent.indexOf( constants.DC_MOBILECONTENT_XHTML_MP ) >= 0);
            }

         }

         return;

      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"setUpMobileSimulation" );
      }
   },

   resizeScreenResponse: function(aTabId, aResult)
   {
      try {
         
         if (chrome.runtime.lastError) {
            gDC.logException( chrome.runtime.lastError , gDC.DCMODULE+"resizeScreenResponse" );
            return;
         }
         
         gDC.pendingResize = false;
         if (gDC._runMode == constants.RUNMODE_RECORD) {
         
            // Add the dom attributes only for the first response to prevent duplicates.
            if (!gDC.screenWasResized) {
               // only attach the browser size params to the script if the browser was actually resized
               gDC._script.domTreeAddAttribute( gDC._domTreeRoot, 'browserwidth', gDC.simulateMobile.width );
               gDC._script.domTreeAddAttribute( gDC._domTreeRoot, 'browserheight', gDC.simulateMobile.height );
             }
            
            gDC.screenWasResized = true;
            // override dejaevents dimensions with the mobile dimensions
            gDC.screenResizeWidth = gDC.simulateMobile.width;
            gDC.screenResizeHeight = gDC.simulateMobile.height;
            

         } else if (gDC._runMode == constants.RUNMODE_REPLAY) {
            gDC.screenWasResized = true;
            gDC.screenResizeWidth = Number(gDC.simulateMobile.width);
            gDC.screenResizeHeight = Number(gDC.simulateMobile.height);
         }

         if (gDC.simulateMobile.done) return;
/*
         // Enable mobile content handlers
         var mobileContent = gDC.domTreeGetAttribute( gDC._domTreeRoot, constants.DC_SIMULATEMOBILE_CONTENT );
         if (mobileContent && mobileContent.indexOf( constants.DC_MOBILECONTENT_XHTML_MP ) >= 0) {

            // enable mobile XHTML content handler
            gDC.toggleContentHandler( MIMETYPE_XHTML_MP, true );
            gDC.updateAcceptMimeTypes( ACCEPT_MIMETYPE_XHTML_MP, true );
         }

         // Disable non-mobile plugins
         var simMobilePlugins = gDC.domTreeHasAttribute( gDC._domTreeRoot, DC_SIMULATEMOBILE_PLUGINS );
         if (simMobilePlugins) {
            var mobilePluginsList = gDC.domTreeGetAttribute( gDC._domTreeRoot, DC_SIMULATEMOBILE_PLUGINS );

            // first save off the current state (enabled/disabled) of all plugins
            gDC._utils.backupPluginsState();

            // next enable just the ones we want to simulate
            gDC._utils.setPluginsState( mobilePluginsList );
         }
*/
      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"resizeScreenResponse" );      
      }
   },
   
   detachAllChromeDebuggers : function() {
      try {
         for (var tab in gDC.m_debuggerAttached) {
            chrome['debugger'].detach({ tabId: Number(tab)}, 
               function() {
                  delete gDC.m_debuggerAttached[Number(tab)];
                  for (var tabId in gDC.m_debuggerAttached) {
                     return;
                  }
                  gDC.m_debuggerAttached = {};
               }
            );
         }
      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"detachAllChromeDebuggers" );      
      }         
   },
   
   stopMobileSimulationResponse: function(aTabId, aResult)
   {
      try {

         // In some cases, the simulate mobile is reset earlier.
         // Hence added a check
         if (gDC.simulateMobile) {
            gDC.simulateMobile.done = true;   // shutting down mobile mode
         }
         gDC.pendingResize = false;
         
         gDC.simulateMobile = null;
         chrome['debugger'].detach(
            { tabId: aTabId}, 
            function() {
               delete gDC.m_debuggerAttached[aTabId];
               for (var tabId in gDC.m_debuggerAttached) {
                  return;
               }
               gDC.m_debuggerAttached = {};
            }
         );
            
//         gDC.simulateMobile.useragent = null;
         
/*
         // Disable mobile content handlers
         var mobileContent = gDC.domTreeGetAttribute( gDC._domTreeRoot, DC_SIMULATEMOBILE_CONTENT );
         if (mobileContent && mobileContent.indexOf( DC_MOBILECONTENT_XHTML_MP ) >= 0) {

            // disable mobile XHTML content handler
            gDC.toggleContentHandler( MIMETYPE_XHTML_MP, false);
            gDC.updateAcceptMimeTypes( ACCEPT_MIMETYPE_XHTML_MP, false);
         }

         // Screen size, browser preferences, and plugin state will be restored in stopRecordReplay()
*/
      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"stopMobileSimulationResponse" );      
      }
   },
   
   completeResize : function ( aTabId, aWidth, aHeight, aScreenX, aScreenY, bACenterScreen, bASkipReposition, aDeviceScaleFactor) 
   {
      try{
      
         if (!gDC.m_debuggerAttached[aTabId]) {
            gDC.m_debuggerAttached[aTabId] = true;
            try {
               chrome['debugger'].attach({ tabId: aTabId },
                  '1.0',
                  gDC.completeResize.bind( gDC, aTabId, Number(aWidth), Number(aHeight), 0, 0, false, true, 1 ));
            }
            catch (e) {
            }
            return;
         }
                 
         var pageParameters = {};

         pageParameters = {
            width: aWidth,
            height: aHeight,
            offsetX: aScreenX,
            offsetY: aScreenY,
            fitWindow: bACenterScreen,
            mobile: true,
            deviceScaleFactor: aDeviceScaleFactor,
            fontScaleFactor: 1,
            emulateViewport: true,
            };

            chrome['debugger'].sendCommand({
            tabId: aTabId
            }, 
            "Page.setDeviceMetricsOverride",
            pageParameters, 
            gDC.resizeScreenResponse.bind(gDC, aTabId)
         );

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"completeResize" );
         return;
      }   
   },
   
   //------------------------------------------------
   // resize the screen dimension to the given dimensions for the device
   resizeScreen : function( aTabId, aWidth, aHeight, aScreenX, aScreenY, bACenterScreen, bASkipReposition, aDeviceScaleFactor )
   {
      try {

         if (aWidth <= 0 || aHeight <= 0 || aScreenX < 0 || aScreenY < 0) {
            gDC.pendingResize = false;
            return;
         }
         
         if (!chrome['debugger']) {
            //TODO Firefox Quantum UXM-11026
            gDC.logger.logWarning("Resize Screen not supported. Chrome Debugger not available!");
            return;
         }
         
         // The user chose not to resize the screen, return
         if (!gDC.getSystemBoolPref('DC_OPTID_WARNSCREENRESIZE')) {
            gDC.pendingResize = false;
            return;
         }

         gDC.stopMobileSimulation(aTabId, null);
         
         // Resize without prompting if not running in interactive mode
         // or if the prompt for re-size is turned off.
         if (!gDC.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') ||
             !gDC.getSystemBoolPref('DC_OPTID_WARNSCREENRESIZEPROMPT') ||
             gDC.screenWasResized) {
            gDC.completeResize(aTabId, aWidth, aHeight, aScreenX, aScreenY, bACenterScreen, bASkipReposition, aDeviceScaleFactor);
            return;
         }           

         // Don't display prompt or save resize dimensions in replay mode
         var skipPrompt = (gDC._runMode == constants.RUNMODE_REPLAY) && !gDC.getEventBoolPref('DC_OPTID_REPLAYUE');
         if (!gDC.resizePromptActive) {
            if (!skipPrompt) {
               // let Replay Advisor prompt the user to let them know the browser window will be resized
               gDC.promptBrowserScreenResize( gDC.completeResize.bind(gDC, aTabId, aWidth, aHeight, aScreenX, aScreenY, bACenterScreen, bASkipReposition, aDeviceScaleFactor));
               return;
            }
            else {
               gDC.completeResize(aTabId, aWidth, aHeight, aScreenX, aScreenY, bACenterScreen, bASkipReposition, aDeviceScaleFactor);
            }
         }
                             
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"resizeScreen" );
         return;
      }
   },
   
   // switch on mobile simulation handlers
   startMobileSimulation : function(aTabId, aBrowser)
   {
      try {
         if (gDC.simulateMobile && gDC.simulateMobile.done) return;   // mobile mode has been shut down

         if (!chrome['debugger']) {
            //TODO Firefox Quantum UXM-11026
            gDC.logger.logWarning("Mobile Simulation not supported. Chrome Debugger not available!");
            return;
         }
         
         gDC.logger.logInfo( "Starting mobile simulation of: " + gDC.simulateMobile.name );
         gDC.pendingResize = true;
        
/*
         if (!gDC.screenResizeDelay) {
            gDC.screenResizeDelay = gDC.getSystemIntPref( constants.DC_OPTID_SCREENRESIZEDELAY );
         }

*/

         // Chrome does not let you attach the debugger to chrome tabs.
         // So, navigate to about:blank in those cases
         if (aBrowser && gDC.isChromeTab(aBrowser)) {
            chrome.tabs.update(
               aTabId, 
               {url: "http://www.google.com"},
               gDC.startMobileSimulation.bind(gDC, aTabId)
            );
            return;
         }

         // Resize browser window to dimensions of simulated mobile
         gDC.screenWasResized = false;         
         if (gDC._runMode == constants.RUNMODE_RECORD) {
            gDC.resizeScreen( aTabId, gDC.simulateMobile.width, gDC.simulateMobile.height, 0, 0, false, true, 1 );

         } else if (gDC._runMode == constants.RUNMODE_REPLAY) {

            // get mobile width/height from recorded script properties
            gDC.simulateMobile.width = Number(gDC._script.domTreeGetAttribute( gDC._domTreeRoot, 'browserwidth' ));
            gDC.simulateMobile.height = Number(gDC._script.domTreeGetAttribute( gDC._domTreeRoot, 'browserheight' ));
            gDC.resizeScreen(aTabId, gDC.simulateMobile.width, gDC.simulateMobile.height, 0, 0, false, true, 1 );
         }

         return;

      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"startMobileSimulation" );
      }
   },


   // switch off mobile simulation handlers
   stopMobileSimulation : function(aTabId, aCallback)
   {
      try {
      
         if (!gDC.m_debuggerAttached[aTabId]) {
            return;
         }
         
         gDC.logger.logInfo( "Stopping mobile simulation of: " + gDC.simulateMobile.name );
      
         chrome['debugger'].sendCommand({
            tabId: aTabId
            }, 
            "Page.clearDeviceMetricsOverride",
            null, 
            aCallback
         );

         return;

      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"stopMobileSimulation" );
      }
   },
   
   // setting a shared manual proxy
   setSingleProxy : function (aUrl, aPort, aByPassList) 
   {
      try {

         //Firefox
         if ( gDC._isFirefox ) {
            config = {
               proxyType: "manual",
               http: "http://"+aUrl+":"+aPort,
               passthrough: aByPassList,
               httpProxyAll: true
            };      
            browser.proxy.settings.set({value: config});
            gDC.logger.logInfo("[Firefox] Using proxy configuration ["+config.http+"]");
         
         //Chrome
         } else {
            var singleProxy = {};
            singleProxy.host = aUrl;
            if (aPort > 0) {
               singleProxy.port = aPort;
            }
            var config = {};
            
            config = {
               mode: "fixed_servers",
               rules: {
                  singleProxy: singleProxy,
                  bypassList: aByPassList
               }
            };           

            var scope = this._serverOperation ? 'incognito_session_only' : 'regular';
            chrome.proxy.settings.set(
               {value: config, scope: scope},
               function() {}
            );

            gDC.logger.logInfo("[Chrome] Using proxy configuration ["+aUrl+":"+aPort+"]");
         }
      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"setSingleProxy" );
      }
      
   },
   
   loadProxySettings : function() 
   {
      try {


         var mode = "system";
         var config = {};

         var proxyType = parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.type", "intprefs"));

         switch (proxyType) {
            case 0:
               mode = "direct";

               if ( gDC._isFirefox ) {
                  config = {
                     proxyType: "system"
                  };
               } else {
                  config = {
                     mode: mode
                  };
               }
               
               break;
            case 1:
               mode = "fixed_servers";
               var share_proxy_settings = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.share_proxy_settings", "boolprefs");
               var url = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.http", "charprefs");
               var port = parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.http_port", "intprefs"));
               var bypass_list = null;

               var proxyForHttp = {}, proxyForHttps = null, proxyForFtp = null;
               var noproxy_list = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.no_proxies_on", "charprefs");
               if (noproxy_list && noproxy_list.length) {
                  bypass_list = noproxy_list.split(',');
               }

               if (share_proxy_settings) {
                  return this.setSingleProxy(url, port, bypass_list);
               }
               else {
                  if ( gDC._isFirefox ) {
                     config = {
                        proxyType: "manual"
                     };

                     //HTTP
                     if (url) {
                        config.http = "http://"+url+":"+port;
                     }
                     else if (gDC._script.domTreeHasPreference(gDC._domTreeRoot, "network.proxy.socks_version", "charprefs")) {
                        config.socksVersion  = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.socks_version", "intprefs");
                        var hostSocks = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.socks", "charprefs");
                        var portSocks = parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.socks_port", "intprefs"));
                        config.http = "http://"+hostSocks+":"+portSocks;
                     }

                     //HTTPS/SSL
                     var ssl_url = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ssl", "charprefs");
                     if (ssl_url) {
                        config.ssl = "https://"+ssl_url+":"+parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ssl_port", "intprefs"));
                     }

                     //FTP
                     var ftp_url = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ftp", "charprefs");
                     if (ftp_url) {
                        config.ftp = "ftp://"+ftp_url+":"+parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ftp_port", "intprefs"));
                     }

                  } else {
                     //HTTP
                     proxyForHttp.scheme = "http";
                     if (url) {
                        proxyForHttp.host = url;
                        proxyForHttp.port = port;
                     }
                     else if (gDC._script.domTreeHasPreference(gDC._domTreeRoot, "network.proxy.socks_version", "charprefs")) {
                        var version = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.socks_version", "intprefs");
                        proxyForHttp.scheme = (version == "4") ? "socks4" : "socks5";
                        proxyForHttp.host = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.socks", "charprefs");
                        proxyForHttp.port = parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.socks_port", "intprefs"));
                     }

                     //HTTPS/SSL
                     var ssl_url = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ssl", "charprefs");
                     if (ssl_url) {
                        proxyForHttps = {};
                        proxyForHttps.scheme = "https";
                        proxyForHttps.host = ssl_url;
                        proxyForHttps.port = parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ssl_port", "intprefs"));
                     }

                     //FTP
                     var ftp_url = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ftp", "charprefs");
                     if (ftp_url) {
                        proxyForFtp = {};
                        proxyForFtp.host = ftp_url;
                        proxyForFtp.port = parseInt(gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.ftp_port", "intprefs"));
                     }

                     config = {
                        mode: mode,
                        rules: {
                           proxyForHttp : proxyForHttp,
                           proxyForHttps: proxyForHttps,
                           proxyForFtp : proxyForFtp,
                           bypassList : bypass_list
                        }
                     };
                  }
                  

               }        
               break;
            case 2:
               var url = gDC._script.domTreeGetPreference(gDC._domTreeRoot, "network.proxy.autoconfig_url", "charprefs");
                  
               if ( gDC._isFirefox ) {
                  config = {
                     proxyType: "autoConfig",
                     autoConfigUrl: url
                  };
               } else {
                  mode = "pac_script";
                  var pacScript = {};
                  pacScript.url = url;
                  config = {
                     mode: mode,
                     rules: {
                        pacScript: pacScript
                     }
                  };
               }
               
               break;
            case 4:
               if ( gDC._isFirefox ) {
                  config = {
                     proxyType: "autoDetect"
                  };
               } else {
                  config = {
                     mode: "auto_detect"
                  };
               }
               break;
            case 5:
            default:
               if ( gDC._isFirefox ) {
                  config = {
                     proxyType: "system"
                  };
               } else {
                  config = {
                     mode: "system"
                  };
               }
               break;
         }
         


         if ( gDC._isFirefox ) {
            browser.proxy.settings.set({value: config});
            gDC.logger.logInfo("[Firefox] Using proxy configuration ["+config.proxyType+"]");
         } else {
            var scope = this._serverOperation ? 'incognito_session_only' : 'regular';
            chrome.proxy.settings.set(
                 {value: config, scope: scope},
                function() {});

            gDC.logger.logInfo("[Chrome] Using proxy configuration ["+config.mode+"]");
         }
         
               
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"loadProxySettings" );
      }
   },

   clearProxySettings : function ()
   {
      try {

         if ( gDC._isFirefox ) {
            browser.proxy.settings.clear({});
            gDC.logger.logInfo("[Firefox] Cleared proxy configuration");
         } else {
            var scope = this._serverOperation ? 'incognito_session_only' : 'regular';
            chrome.proxy.settings.clear({scope: scope}, function() {});
         }
         
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"clearProxySettings" );
      }
   },
   
   // In record append mode, sets up flags and pointers so that
   // we can smoothly switch from replay mode to record mode,
   // without losing track of our current position in the script.
   prepareRecordData : function( aAddSubscript )
   {
      try {
         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug("preparing record data for appending...");
         }

         // Make sure at least one actions subtree exists
         if (!gDC._actTreeRoots || gDC._actTreeRoots.length === 0) {
            gDC.logger.logWarning("Nothing to replay at 'prepareRecordData'. There are no action tree elements. ");
            gDC.alertUser( "dcMessage_missingscript", true, false );
            return;
         }

         if (aAddSubscript) {
            // Create the new subscript node.
            var subscriptNode = gDC.domTreeInsertSubscript( gDC._domTreeRoot );
            gDC._observerService.notifyObservers('dejaclick:refreshscripttabs', {hashkey: subscriptNode.getAttribute("seq")+":subscript", state: "initial"} );
         } else {
            var i;
            var defaultMode = gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_OVERWRITE;
         
            if (gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_INSERT) {
               gDC.alertUser( "dcMessage_insertWarning", true, false );
            }
         }

         // Use the existing navigation subtree generated during replay.
         gDC._script.domTreeRemoveRoot( gDC._domTreeRoot, "navigation", "record" );
         if (gDC._navTreeRoot == null) {
            gDC.logger.logWarning("Null tree root at 'prepareRecordData'. There are no action tree elements. ");
            gDC.alertUser( "dcMessage_missingscript", true, false );
            return;
         }
         gDC._navTreeRoot.setAttribute("type", "record");
         var date = new Date();  date.setTime(date.getTime());
         gDC._navTreeRoot.setAttribute("generated", date.toUTCString());

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"prepareRecordData" );
      }
   },
   


   /**
    * List of system preferences that are applicable when simulate new
    * visitor is enabled.
    * @const
    * @type {!Object.<string,string>}
    */
   NEW_VISITOR_OPTIONS: {
      DC_OPTID_HIDECOOKIES: 'hidecookies',
      DC_OPTID_CLEARWEBCACHE: 'clearwebcache',
      DC_OPTID_CLEARPASSWORDS: 'clearpasswords',
      DC_OPTID_CLEARFORMDATA: 'clearformdata',
      DC_OPTID_CLEARCERTIFICATES: 'clearcertificates',
      DC_OPTID_CLEARLOCALSTORAGE: 'clearlocalstorage',
      DC_OPTID_CLEARFILESYSTEMS: 'clearfilesystems',
      DC_OPTID_CLEARAPPCACHE: 'clearappcache',
      DC_OPTID_CLEARINDEXEDDB: 'clearindexeddb',
      DC_OPTID_CLEARWEBSQL: 'clearwebsql',
      DC_OPTID_CLEARPLUGINDATA: 'clearplugindata'
   },

   /**
    * Save the configuration of certain browser and record/replay
    * settings into the script so that they can be reapplied whenever
    * the script is replayed.
    * @this {!DejaClick.DejaService}
    */
   freezeCurrentSettings: function() {
      var index, option;
      if (this.getSystemBoolPref('DC_OPTID_USENEWVISITOR')) {
         for (option in this.NEW_VISITOR_OPTIONS) {
            if (this.NEW_VISITOR_OPTIONS.hasOwnProperty(option) &&
                  this.getSystemBoolPref(option)) {
               this._script.domTreeChangeAttribute(this._domTreeRoot,
                  this.NEW_VISITOR_OPTIONS[option], 'true');
            }
         }
      }
      // Save in script as acceptcookies = 2 to mimic Firefox behavior.
      this._script.domTreeChangeAttribute(this._domTreeRoot, 'acceptcookies',
         this.getSystemBoolPref('DC_OPTID_DISABLECOOKIES') ? '2' : '0');
      this._script.domTreeChangeAttribute(this._domTreeRoot, 'disablepopups',
         String(this.getSystemBoolPref('DC_OPTID_DISABLEPOPUPS')));
   },

   /**
    * Asynchronously apply browser-level settings before beginning
    * record or replay.
    * @this {!DejaClick.DejaService}
    * @param {function()=} opt_callback Optional function to invoke when
    *    the frozen settings have been applies.
    */
   applyFrozenSettings: function(opt_callback) {
      var callback, script, root, callsLeft, hideCookies,
         disablePopups, disableCookies;

      function onCallCompleted(call) {
         callsLeft -= call;
         if ((callsLeft === 0) && (callback !== null)) {
            callback();
         }
      }

      callback = (opt_callback == null) ? null : opt_callback;
      script = this._script;
      root = this._domTreeRoot;

      callsLeft = 0xf;
      hideCookies = script.domTreeGetAttribute(root, 'hidecookies') === 'true';
      disablePopups = script.domTreeGetAttribute(root, 'disablepopups') === 'true';
      disableCookies = script.domTreeGetAttribute(root, 'acceptcookies') === '2';
      if (!hideCookies) {
         callsLeft -= 0x2;
      }
      if (disablePopups) {
         callsLeft -= 0x4;
      }
      if (!disableCookies) {
         callsLeft -= 0x8;
      }

      var configOptions = {
         cache: script.domTreeGetAttribute(root, 'clearwebcache') === 'true',
         formData: script.domTreeGetAttribute(root, 'clearformdata') === 'true',
         indexedDB: script.domTreeGetAttribute(root, 'clearindexeddb') === 'true',
         localStorage: script.domTreeGetAttribute(root, 'clearlocalstorage') === 'true',
         serverBoundCertificates: script.domTreeGetAttribute(root, 'clearcertificates') === 'true',
         pluginData: script.domTreeGetAttribute(root, 'clearplugindata') === 'true',
         passwords: script.domTreeGetAttribute(root, 'clearpasswords') === 'true',
      };

      //Options just supported by Chrome
      //TODO Firefox Quantum UXM-11026
      if ( ! gDC._isFirefox ) {
         configOptions.appcache = script.domTreeGetAttribute(root, 'clearappcache') === 'true';
         configOptions.fileSystems = script.domTreeGetAttribute(root, 'clearfilesystems') ===  'true';
         configOptions.webSQL = script.domTreeGetAttribute(root, 'clearwebsql') === 'true'
      }

      chrome.browsingData.remove({}, configOptions, onCallCompleted.bind(null, 0x1));

      if (hideCookies) {
         this._utils.cookieManager.hideCookies(onCallCompleted.bind(null, 0x2));
      }

      if (!disablePopups) {
         if ( chrome.contentSettings ) {
            chrome.contentSettings.popups.set({
               primaryPattern: '<all_urls>',
               setting: 'allow'
            }, onCallCompleted.bind(null, 0x4));
         } else {
            //TODO Firefox Quantum UXM-11026
            callsLeft -= 0x4;
         }
      }

      if (disableCookies) {
         if ( chrome.contentSettings ) {
            chrome.contentSettings.cookies.set({
               primaryPattern: '<all_urls>',
               setting: 'block'
            }, onCallCompleted.bind(null, 0x8));
         } else {
            //TODO Firefox Quantum UXM-11026
         }
         
      }

      //UXM-10002
      if ( gDC.customCookies && gDC.customCookies.length > 0 ) {
         for (var i = 0; i < gDC.customCookies.length; ++i) {
            this._utils.cookieManager.setCookieAllTabs(gDC.customCookies[i]);
         }
      }
      
   },

   /**
    * Find the document element in the navigation tree that best
    * matches the target for the specified script element. The script
    * element must contain a single target element of type
    * document. The navigation tree will be searched for the best
    * matching document element. The search results will be attached
    * to this.resEventNode.
    * @this {!DejaClick.DejaService}
    * @param {!Element} aNode A script element containing a target
    *    identifying a document.
    * @param {number} aMinMatchScore The minimum score allowed for a
    *    document to be considered a match.
    * @return {?Element} The document element from the navigation tree
    *    that best matches the target, or null if there is no good match.
    */
   findTargetDocument: function(aNode, aMinMatchScore) {
      var targets, resultObj, requestType, score;

      if (this.logger.tracesearch) {
         this.logger.logDebug('Inside findTargetDocument');
      }

      // Find the target elements for this node. There can be only one.
      targets = this._script.processXPath(aNode, 'child::targets/target');
      if ((targets.length !== 1) ||
            (targets[0].getAttribute('type') !== 'document')) {
            // check if it can be handled by a matching branching rule
            if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_SCRIPT_PARSE_ERROR )) {
               this.logger.logInfo("Replay failure. Unable to find target document info!");
               this.handleReplayFailure('dcFailure_badscriptdata', null,
               constants.STATUS_SCRIPT_PARSE_ERROR);
            }
         return null;
      }

      resultObj = this.searchForTargetDocument(targets[0]);

      requestType = aNode.tagName;
      if ((requestType !== 'validation') && (requestType !== 'dynamicobj')) {
         // Only do this for real searches, not temporary validation searches.

         // -------------------
         //  Summarize results:  compute the final search results (score)
         // -------------------

         score = resultObj.targetScore;
         this.lastMatchScore = score;
         if (this.logger.tracesearch) {
            this.logger.logDebug('   Setting FINAL target search match score to ' +
               score + '\n');
         }
         this.resEventNode.setAttribute('matchscore', score);

         if (resultObj.targetNode != null) {
            // Target was found.
            this.resEventNode.setAttribute('targetfound', 'yes');
         } else {
            // Could not find an appropriate DOM target, so we must quit (but
            // we still generate all the target match score info for analysis).
            this.resEventNode.setAttribute('targetfound', 'no');
            this.logger.logInfo("Replay failure. Target element not found!");
            this.handleReplayFailure('dcFailure_targetnotfound', null,
               constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
         }

         // Make sure the overall target match score doesn't exceed user
         // pref limits.
         if (score < aMinMatchScore) {
            this.logger.logInfo("Replay failure. Target element found doesn't have the mininum score required! [score="+score+"][aMinMatchScore="+aMinMatchScore+"]");
            this.handleReplayFailure('dcFailure_targetmatchscore', null,
               constants.STATUS_MATCH_SCORE_FAILURE);
            resultObj.targetNode = null;
         }
      }

      return resultObj.targetNode;
   },

   isExecutionSuspended : function() {
      if (gDC._serverOperation) {
         if (gDC.getSystemBoolPref('DC_OPTID_SUSPENDREPLAY')) {
            return true;
         }
      }
      return false;
   },


   /**
    * Find the node in a user document that best matches the target
    * for the specified script element. The script element must
    * contain two target elements of types document and element,
    * respectively. The navigation tree will be searched for the best
    * matching document element. Then the tracked user documents will
    * be searched asynchronously for the best matching element. The
    * final target search results are attached to
    * this.resEventNode. Information about the best match will be
    * passed to a callback when the search is complete.
    * @this {!DejaClick.DejaService}
    * @param {!Element} aNode A script element containing a targets
    *    identifying an element in a user document.
    * @param {number} aMinMatchScore The minimum score allowed for an
    *    element to be considered a match.
    * @param {function(integer, integer)} aCallback Function to call
    *    when the search is complete. It is passed the tab id and
    *    document id of the document containing the matched element.
    * @return {integer} Id of the asynchronous search operation. This
    *    is a key into the this.activeSearches object. It may be null
    *    if the arguments to this call are invalid.
    */
   findTargetElement: function(aNode, aMinMatchScore, aCallback) {
      var targets, resultObj, searchId, args, target, eltList, searchObj, doc;

      if (this.logger.tracesearch) {
         this.logger.logDebug('Inside findTargetElement');
      }

      // Find the target elements for this node. There must be two.
      targets = this._script.processXPath(aNode, 'child::targets/target');
      if ((targets.length !== 2) ||
            (targets[0].getAttribute('type') !== 'document') ||
            (targets[1].getAttribute('type') !== 'element')) {
         // Only fail here if not handled by a matching branching rule.
         if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_SCRIPT_PARSE_ERROR )) {         
            this.logger.logInfo("Replay failure. We don't have enough information to find the target element! [Out of branching]");
            this.handleReplayFailure('dcFailure_badscriptdata', null,
               constants.STATUS_SCRIPT_PARSE_ERROR);
         }
         return -1;
      }

      // Search for the preferred document.
      resultObj = this.searchForTargetDocument(targets[0]);

      if (this.logger.tracesearch) {
         this.logger.logDebug('\n===================== ' +
            'BEGINNING [element] TARGET SEARCH ===============');
      }

      // Get unique ID for this search.
      searchId = this.lastSearchId;
      do {
         ++searchId;
         if (searchId === 0x100000000) {
            searchId = 0;
         }
      } while (this.activeSearches.hasOwnProperty(searchId));
      this.lastSearchId = searchId;

      // Initialize target information to send to content scripts.
      args = {
         searchId: searchId,
         matchTypes: this.getEventStringPref('DC_OPTID_USEMATCHTYPES',
            this.actEventNode),
         ignoreNamedAttr: this.getEventBoolPref('DC_OPTID_IGNORENAMEDATTR',
            this.actEventNode),
         optimizedMatch: this.getEventBoolPref('DC_OPTID_OPTIMIZEDMATCH',
            this.actEventNode)
      };

      target = targets[1];

      eltList = target.getElementsByTagName('fingerprint');
      if (eltList.length !== 0) {
         args.fingerprint = eltList[0].textContent;
      }

      eltList = target.getElementsByTagName('elementpath');
      if (eltList.length !== 0) {
         try {
            args.elementpath = this.getElementPathValue(eltList[0]);
         } catch (ignore) { }
      }

      var scriptVarInfo = null;
      if (!args.elementpath) {
         scriptVarInfo = gDC.retrieveElementpathVariableInfo(eltList[0]);
         scriptVarInfo.replayLocation = gDC.replayLocation;
         scriptVarInfo.replayCount = gDC._replayCount;
      }
      args.scriptVarInfo = scriptVarInfo;

      var eltFPList = target.getElementsByTagName('elementfullxpath');
      if (eltFPList.length !== 0) {
         try {
            args.elementfullxpath = this.getElementPathValue(eltFPList[0]);
         } catch (ignore) { }
      }

      args.breadcrumbs = this.extractBreadcrumbsFromTarget(target);

      // Initialize accounting data for the element search.
      this.activeSearches[searchId] = searchObj = {
         id: searchId,
         targetInfo: args,

         context: aNode,
         minMatchScore: aMinMatchScore,
         callback: aCallback,
         document: resultObj.targetNode,
         documentScore: resultObj.targetScore,

         matchScore: 0,
         matchDetails: null,
         matchTabId: -1,
         matchDocId: -1,

         preferred: true,
         responsesLeft: []
      };

      doc = resultObj.targetNode;

      if ((doc != null) && doc.hasAttribute('docId')) {
         if (this.logger.tracesearch || this.logger.debugsearch ) {
            this.logger.logDebug('findTargetElement - Dispatching element search ' + searchId +
               ' to preferred document ' + doc.getAttribute('docId'));
         }
         if (this._observerService.notifyDocument(
               Number(doc.getAttribute('docId')),
               'dejaclick:elementsearch',
               args)) {
            searchObj.responsesLeft = [Number(doc.getAttribute('docId'))];
         }
      }

      if (searchObj.responsesLeft.length === 0) {
         searchObj.preferred = false;
         searchObj.responsesLeft = this._observerService.notifyObservers(
            'dejaclick:elementsearch', args);
         if (this.logger.tracesearch || this.logger.debugsearch ) {
            this.logger.logDebug('findTargetElement - Dispatched element search ' + searchId +
               ' to documents ' + searchObj.responsesLeft.join(','));
         }

         if (searchObj.responsesLeft.length === 0) {
            // There are no user documents to search.
            // Queue the failure to be processed.
            this._setTimeout(
               this.processElementSearchResult.bind(this, searchObj),
               0);
         }
      }
      return searchId;
   },

   /**
    * Find the document element in the navigation tree that best matches
    * the target element.
    * @this {!DejaClick.DejaService}
    * @param {!Element} aTarget A target element from the script of
    *    type document.
    * @return {{
    *    targetNode: ?Element,
    *    targetScore: number
    * }} The matching document element or null and score evaluating how
    *    well it matches the target.
    */
   searchForTargetDocument: function(aTarget) {
      var requestType, eltList, fingerprint, result,
         searchElt, index, details, methodElt;

      if (this.logger.tracesearch) {
         this.logger.logDebug('\n===================== ' +
            'BEGINNING [document] TARGET SEARCH ===============');
      }

      requestType = aTarget.parentNode.parentNode.tagName;

      fingerprint = null;
      eltList = aTarget.getElementsByTagName('fingerprint');
      if (eltList.length !== 0) {
         fingerprint = eltList[0].textContent;
      }

      result = this._search.searchForTargetNode(
         this._navTreeRoot,
         fingerprint,
         null,
         null,
         this.extractBreadcrumbsFromTarget(aTarget),
         'fp bc',  // Document search is always fingerprint and breadcrumbs.
         this.getEventBoolPref('DC_OPTID_IGNORENAMEDATTR', this.actEventNode),
         false);

      if (this.resEventNode != null) {
         searchElt = this._script.domTreeInsertNode(this.resEventNode,
            'search');
         searchElt.setAttribute('type', requestType);
         searchElt.setAttribute('target', 'document');
         searchElt.setAttribute('methods', result.methods);
         searchElt.setAttribute('selected', result.selected);
         searchElt.setAttribute('matchscore', result.targetScore);

         for (index = 0; index < result.methodResults.length; ++index) {
            details = result.methodResults[index];
            methodElt = this._script.domTreeInsertNode(searchElt, 'method');
            methodElt.setAttribute('type', details.type);
            methodElt.setAttribute('huntmode', 'no');
            methodElt.setAttribute('targetfound', details.targetfound);
            methodElt.setAttribute('score', details.score);
         }
      }

      if (this.logger.tracesearch || this.logger.debugsearch ) {
         this.logger.logDebug('searchForTargetDocument - Target Match Score for ' + requestType +
            ' document search is ' + result.targetScore);
      }
      return {
         targetNode: result.targetNode,
         targetScore: result.targetScore
      };
   },

   /**
    * Get a plain JavaScript object containing the breadcrumbs for a
    * script target element.
    * @this {!DejaClick.DejaService}
    * @param {!Element} aTarget A target element of the script.
    * @return {?Array.<!{
    *    tag: string,
    *    index: string,
    *    numAttributes: integer,
    *    attributes: Object.<string,string>
    * }>} A list of crumb objects.
    */
   extractBreadcrumbsFromTarget: function (aTarget) {
      var result, crumbs, index, src, dest, attrs, attrIndex, srcAttr;

      result = [];
      crumbs = this._script.processXPath(aTarget, 'child::breadcrumbs/crumb');
      for (index = 0; index < crumbs.length; ++index) {
         src = crumbs[index];
         attrs = this._script.processXPath(src, 'child::attributes/attrib');
         dest = {
            tag: src.getAttribute('tag'),
            index: src.getAttribute('index'),
            numAttributes: attrs.length,
            attributes: {}
         };

         for (attrIndex = 0; attrIndex < attrs.length; ++attrIndex) {
            srcAttr = attrs[attrIndex];
            dest.attributes[srcAttr.getAttribute('name')] = srcAttr.textContent;
         }
         result.push(dest);
      }
      return (result.length === 0) ? null : result;
   },

   /**
    * Process the results of searching for an element in a user document.
    * Called in response to the dejaclick:searchcomplete event.
    * @param {{
    *    searchId: integer,
    *    targetScore: number,
    *    targetSelected: string,
    *    targetMethods: string,
    *    targetFound: boolean,
    *    searchResults: !Array.<{ type: string, targetfound: boolean, score: number }>
    * }} aDetails
    * @param {!chrome.Tab} aTab Details of the tab containing the document
    *    that has been searched.
    * @param {integer} aDocId Id of the document that has been searched.
    */
   searchComplete : function (aDetails, aTab, aDocId)
   {
      var searchObj, matchFound, matchScore, index;
      try {

         if (gDC.replayShuttingDown) {
            return;
         }

         if (!gDC.activeSearches.hasOwnProperty(aDetails.searchId)) {
            // The search is no longer active. Discard the results.
            return;
         }
         matchFound = aDetails.targetFound;
         matchScore = aDetails.targetScore;
         if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
            gDC.logger.logDebug('searchComplete - Search ' + aDetails.searchId +
               ' completed for document ' + aDocId + ' in tab ' + aTab.id +
               ': ' + matchFound + ', ' + matchScore);
         }

         searchObj = gDC.activeSearches[aDetails.searchId];
         if (searchObj.preferred) {
            // We got a response from the preferred document. If the
            // target was found, we are done searching at this
            // point. If not, do a hail mary search of all documents.
            if (matchFound && (matchScore + searchObj.documentScore >=
                     2 * searchObj.minMatchScore)) {
               if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug('searchComplete - Target element FOUND in preferred document using ' +
                     aDetails.targetSelected + ' search: ' +
                     aDetails.targetScore);
               }
               searchObj.matchScore = matchScore;
               searchObj.matchDetails = aDetails;
               searchObj.matchTabId = aTab.id;
               searchObj.matchDocId = aDocId;
            } else {
               // No match found. Begin search of all documents.
               searchObj.preferred = false;
               searchObj.responsesLeft = gDC._observerService.notifyObservers(
                  'dejaclick:elementsearch', searchObj.targetInfo);
               if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug('searchComplete - Element search in preferred document failed. Dispatched search to documents ' +
                     searchObj.responsesLeft.join(','));
               }
               if (searchObj.responsesLeft.length === 0) {
                  // Now there are no documents. Where did the preferred
                  // document go? Handle the failure.
                  gDC.processElementSearchResult(searchObj);
               }
               return;
            }

         } else {
            // The response is from a hail mary search. Check if this match
            // is better than previous matches. Added check for file urls
            // since we dont seem to always get an onCompleted event for them
            if (matchFound && (gDC.isDocumentIdTracked(aDocId) || aTab.url.indexOf("file:") == 0)) {
               if ((searchObj.matchDetails == null) ||
                     (matchScore >= searchObj.matchScore)) {
                  searchObj.matchScore = matchScore;
                  searchObj.matchDetails = aDetails;
                  searchObj.matchTabId = aTab.id;
                  searchObj.matchDocId = aDocId;
                  if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                     gDC.logger.logDebug("searchComplete [tab="+aTab.id+"][doc="+aDocId+"] - *** this targetScore was higher or equal but more recent, saving as the new highest score.");
                  }
               } else {
                  if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                     gDC.logger.logDebug("searchComplete [tab="+aTab.id+"][doc="+aDocId+"] - Discarded. We already have a better score [Tab="+searchObj.matchTabId+"][Doc="+searchObj.matchDocId+"].");
                  }
               }
            //UXM-11559 - In some cases, when there are active tabs in background, we could require to interact with documents that weren't tracked
            //So, if we get the highest score, we should take it in consideration.
            } else if (matchFound && ! gDC.isDocumentIdTracked(aDocId) && matchScore == 1 && ((searchObj.matchDetails == null) || matchScore > searchObj.matchScore ) ) {
               searchObj.matchScore = matchScore;
               searchObj.matchDetails = aDetails;
               searchObj.matchTabId = aTab.id;
               searchObj.matchDocId = aDocId;

               if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug("searchComplete [tab="+aTab.id+"][doc="+aDocId+"] - Taking search result in consideration although it comes from a non-tracked document, because it has the highest score.");
               }
            } else if ((searchObj.matchDetails == null) &&
                  (matchScore >= searchObj.matchScore)) {
               // Record best score, even if there is no match.
               searchObj.matchScore = matchScore;
               if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug("searchComplete [tab="+aTab.id+"][doc="+aDocId+"] - Discarded. But we update the score.");
               }
            } else {
               if (gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug("searchComplete [tab="+aTab.id+"][doc="+aDocId+"] - Discarded. [TrackedDoc="+gDC.isDocumentIdTracked(aDocId)+"][File="+(aTab.url.indexOf("file:") == 0)+"]");
               }
            }

            index = searchObj.responsesLeft.indexOf(aDocId);
            if (index !== -1) {
               searchObj.responsesLeft.splice(index, 1);
            }
            if (searchObj.responsesLeft.length !== 0) {
               // Wait for more responses.
               return;
            }

            // Discount the match score due to the hail mary search.
            searchObj.matchScore *= 0.7;
         }

         // Store results.
         gDC.processElementSearchResult(searchObj);
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"searchComplete" );
      }
   },

   /**
    * Account for a document that has been disconnected from the
    * background script. Most likely the document has been unloaded.
    * Stop waiting for any search responses from this document.
    * @param {null} aData
    * @param {!chrome.Tab} aTab Details of the tab containing the document
    *    that has been disconnected.
    * @param {integer} aDocId Id of the document that has been disconnected.
    */
   handleDocumentDisconnect: function (aData, aTab, aDocId) {
      var searchId, validation, responses, index;
      // Mark all active target searches as failed in this document.
      for (searchId in gDC.activeSearches) {
         if (gDC.hasOwnProperty.call(gDC.activeSearches, searchId)) {
            responses = gDC.activeSearches[searchId].responsesLeft;
            index = responses.indexOf(aDocId);
            if (index !== -1) {
               if (responses.length !== 1) {
                  responses.splice(index, 1);
               } else {
                  gDC.searchComplete({
                     searchId: Number(searchId),
                     targetScore: 0,
                     targetSelected: 'none',
                     targetMethods: 'allfailed',
                     targetFound: false,
                     searchResults: []
                  }, aTab, aDocId);
               }
            } else {
               // @todo What if the disconnected document has already
               // matched the target?
            }
         }
      }
      // Mark all active keyword validations as failed for this document.
      for (searchId in gDC.activeValidations) {
         if (gDC.hasOwnProperty.call(gDC.activeValidations, searchId)) {
            validation = gDC.activeValidations[searchId];
            responses = validation.validationsLeft;
            index = responses.indexOf(aDocId);
            if (index !== -1) {
               if (responses.length !== 1) {
                  responses.splice(index, 1);
               } else {
                  gDC.keywordSearchComplete({
                     id: Number(searchId),
                     strMatchText: validation.args.strMatchText,
                     keywordFound: false
                  }, aTab, aDocId);
               }
            }
         }
      }
   },


   /**
    * Store the results of an element search in the results tree,
    * then invoke the callback to perform the desired action
    * on the target.
    * @this {!DejaClick.DejaService}
    * @param {{
    *    id: integer,
    *    targetInfo: !Object,
    *    context: Element,
    *    minMatchScore: number,
    *    callback: function(integer, integer, integer),
    *    document: ?Element,
    *    documentScore: number,
    *    matchScore: number,
    *    matchDetails: ?{
    *       searchId: integer,
    *       targetScore: number,
    *       targetSelected: string,
    *       targetMethods: string,
    *       targetFound: boolean,
    *       searchResults: !Array.<{ type: string, targetfound: boolean, score: number }>
    *    },
    *    matchTabId: integer,
    *    matchDocId: integer,
    *    preferred: boolean,
    *    responsesLeft: integer
    * }} aSearch Details of the search that has been completed.
    */
   processElementSearchResult: function (aSearch) {

      var requestType, searchElt, methodElt, details, index, results, score;

      try {

         if (gDC.replayShuttingDown) {
            return;
         }

         // Take the search off the active list.
         delete this.activeSearches[aSearch.id];

         requestType = aSearch.context.tagName;
         if (this.resEventNode !== null) {
            searchElt = this._script.domTreeInsertNode(this.resEventNode,
               'search');
            searchElt.setAttribute('type', requestType);
            searchElt.setAttribute('target', 'element');
            searchElt.setAttribute('matchscore', aSearch.matchScore);
            if (aSearch.matchDetails !== null) {
               details = aSearch.matchDetails;
               searchElt.setAttribute('selected', details.targetSelected);
               searchElt.setAttribute('methods', details.targetMethods);

               for (index = 0; index < details.searchResults.length; ++index) {
                  results = details.searchResults[index];
                  methodElt = this._script.domTreeInsertNode(searchElt,
                     'method');
                  methodElt.setAttribute('type', results.type);
                  methodElt.setAttribute('huntmode',
                     aSearch.preferred ? 'yes' : 'no');
                  methodElt.setAttribute('targetfound', results.targetfound);
                  methodElt.setAttribute('score', results.score);
               }
            }
         }

         if (requestType === 'event') {
            score = (aSearch.documentScore + aSearch.matchScore) / 2;
            this.resEventNode.setAttribute('matchscore', score);
            if (aSearch.matchDetails == null) {
               this.elementTargetNotFound = true;
               if ( gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug("processElementSearchResult - Target not found. Retrying. Calling findTargetElement after 3 seconds.");
               }
               gDC._setTimeout( function(){gDC.findTargetElement(aSearch.context, aSearch.minMatchScore, aSearch.callback);}, 3000 );
               return;
            } else {
               this.elementTargetNotFound = false;
               this.resEventNode.setAttribute('targetfound', 'yes');
            }

            if (score < aSearch.minMatchScore) {
               if ( gDC.logger.tracesearch || gDC.logger.debugsearch ) {
                  gDC.logger.logDebug("processElementSearchResult - Target not found. Failing.");
               }

               this.logger.logInfo("Replay failure at processElementSearchResult. The result score ["+score+"] is lower than the minumum required ["+aSearch.minMatchScore+"]");
               this.handleReplayFailure('dcFailure_targetmatchscore', null,
                  constants.STATUS_MATCH_SCORE_FAILURE);
               return;
            }
         }

         if ( gDC.logger.tracesearch || gDC.logger.debugsearch ) {
            gDC.logger.logDebug("processElementSearchResult - [Search="+aSearch.id+"] Search finished. Calling callback function [TabID="+aSearch.matchTabId+"][DocId="+aSearch.matchDocId+"]");
         }

         aSearch.callback(aSearch.matchTabId, aSearch.matchDocId, aSearch.id);
      } catch (ex) {
         this.logException(ex, gDC.DCMODULE + 'processElementSearchResult');
      }
   },

   /**
    * Simulate keystroke (keydown, keypress and keyup) for the provided text.
    * 
    * @param {*} aText 
    * @param {*} aTabId 
    * @param {*} enter 
    */
   sendKeystroke : function (aText, aTabId) {

      for (var i = 0; i < aText.length; i++) {
         var dec = aText.charCodeAt(i);
         var hex = "U+00" + Number(dec).toString(16);
         chrome['debugger'].sendCommand({
                tabId: aTabId
             },
             "Input.dispatchKeyEvent",
              {
                 "type": "rawKeyDown",
                 "windowsVirtualKeyCode": dec,
                 "keyIdentifier": hex
              });
          chrome['debugger'].sendCommand({
                tabId: aTabId
             },
             "Input.dispatchKeyEvent",
              {
                 "type": "char",
                 "text": aText[i],
                  "unmodifiedText": aText[i]
              });
          chrome['debugger'].sendCommand({
                tabId: aTabId
             },
             "Input.dispatchKeyEvent", {
                 "type": "keyUp",
                 "windowsVirtualKeyCode": dec,
                 "keyIdentifier": hex
             });
       }
   },

   /**
    * Simulate keystroke for "Enter" (keycode 13)
    * 
    * Keystroke = sequence of keydown, keypress and keyup.
    * 
    * UXM-12024
    * 
    * @param {*} aText 
    * @param {*} aTabId 
    * @param {*} enter 
    */
   sendEnterKeystroke : function (aTabId) {

      chrome['debugger'].sendCommand({
            tabId: aTabId
         },
         "Input.dispatchKeyEvent",
         {
            "type": "rawKeyDown",
            "windowsVirtualKeyCode": 13
         });
      chrome['debugger'].sendCommand({
            tabId: aTabId
         },
         "Input.dispatchKeyEvent",
         {
            "type": "char",
            "windowsVirtualKeyCode": 13
         });
      chrome['debugger'].sendCommand({
            tabId: aTabId
         },
         "Input.dispatchKeyEvent", {
            "type": "keyUp",
            "windowsVirtualKeyCode": 13
         });
       
   },

   /**
    * Sends a message to the active document so the MFA security question answer is calculated there.
    * 
    * UXM-11947 - Keystrokes support for MFA
    *
    * @param {*} mfaInfo 
    * @param {*} defaultText 
    */
   computeMFAasync : function ( mfaInfo, defaultText ) {
      try {
         if ( ! mfaInfo || ! mfaInfo.docId ) {
            gDC.logger.logWarning("computeMFAasync - Invalid MFA info. Returning default text! MFA info: "+(mfaInfo?JSON.stringify(mfaInfo):"undefined"));
            gDC.handleKeyboardEvent(defaultText);
         } else {
            mfaInfo.defaultText = defaultText;
            gDC.logger.logInfo("computeMFAasync - Sending MFA info to document "+mfaInfo.docId+" [TabID="+mfaInfo.tabId+"].");
            this._observerService.notifyDocument(mfaInfo.docId, 'dejaclick:calculatemfavalue', mfaInfo);

            //Just in case the asynchronous MFA value calculation doesn't get a response
            //we set a timeout so we can replay using the default value.
            let eventDelay = gDC.getEventIntPref('DC_OPTID_EVENTDELAY', gDC.actEventNode);
            var timeoutDelay = isNaN(eventDelay)?50:Number(eventDelay/2);
            gDC.waitingForMFAvalue = Date.now();
            const waitingId = gDC.waitingForMFAvalue;
            gDC.logger.logInfo("computeMFAasync - Starting timeout of "+timeoutDelay+" for obtaining MFA challenge value [ID="+waitingId+"].");
            gDC._setTimeout( 
               function(){
                  if ( gDC.waitingForMFAvalue === waitingId ) {
                     gDC.waitingForMFAvalue = null;
                     gDC.logger.logWarning("computeMFAasync - Using default text for MFA replay, as we didn't get any answer from the document..... ");
                     gDC.handleKeyboardEvent(defaultText);
                  } else if (gDC.logger.debugprocess ) {
                     gDC.logger.logDebug("computeMFAasync - Result already received. Discarding timeout :) ");
                  }
               }, timeoutDelay );
         }
      } catch(e) {
         gDC.logException( e, gDC.DCMODULE+"computeMFAasync" );
      }
   },

   /**
    * Process the response from 'dejaclick:calculatemfavaluecomplete'
    * 
    * UXM-11947 - Keystrokes support for MFA
    * 
    * @param {*} mfaInfoResponse 
    */
   calculateMFAvalueComplete : function ( mfaInfoResponse ) {
      try {
         gDC.logger.logInfo("calculateMFAvalueComplete - Received result from content script: "+mfaInfoResponse.result);
         
         gDC.waitingForMFAvalue = null;

         gDC.handleKeyboardEvent(mfaInfoResponse.result);
      } catch(e) {
         gDC.logException( e, gDC.DCMODULE+"calculateMFAvalueComplete" );
      }
   },

   /**
    * If Chrome and "replay using keystrokes" is checked, this function simulate the keyboard input
    * using Chrome debugger API.
    * 
    * Otherwise it sends the event to the corresponding tab so it is replayed from the Content Script
    * 
    * In the case of Firefox, as Chrome dubugger API is not available, the content script types
    * one character at a type, trying to simulate a real user.
    * 
    * UXM-11607 - Before executing the keyboard event, This function performs a call to get the script variable value
    * if required.
    * 
    * @param {*} replayText - Event value or result of the calculation of the script variable
    * @param {*} varInfo - Script variable info (if applies)
    * @param {*} mfaInfo - Script variable info (if applies)
    * @param {*} aResponse - Response from Chrome debugger (if we get an error while attaching the debugger to the active tab)
    */
   handleKeyboardEvent : function ( replayText, varInfo, mfaInfo, aResponse )
   {
       try {
          if (aResponse) {
            gDC.logger.logInfo("Replay failure at handleKeyboardEvent. Chrome error: "+chrome.runtime.lastError.message);
            gDC.handleReplayFailure ('dcFailure_internalerror', chrome.runtime.lastError.message, constants.STATUS_INTERNAL_ERROR);
             return;
          }

          //UXM-11786 - Get the value for MFA access.
          if ( mfaInfo ) {
             //We have to get the value executing the corresponding MFA check.
             gDC.logger.logInfo("Keyboard/Change event with MFA value required. Obtaining MFA value asynchronously.");
             gDC.computeMFAasync(mfaInfo, replayText); //UXM-11947 - Keystrokes support for MFA
             return;
          }

          //UXM-11607 - If the variable is "sticky" and we have already a value, we use it.
          if ( varInfo && varInfo.sticky && varInfo.varText ) {
             replayText = varInfo.varText;
          //UXM-11607 - Otherwise, we call a function to calculate the value at the currently active tab.
          } else if ( varInfo && varInfo.varName ) {
             gDC._variable.computeScriptVariableAsync(
                varInfo.varName, 
                varInfo.varValue, 
                gDC.processScriptVariableResult.bind(
                   gDC,
                   varInfo,
                   gDC.handleKeyboardEvent.bind(gDC)));
          } 

          gDC.m_debuggerAttached[gDC.lastBrowserObj.tabId] = true;

          var eventNode = gDC.actEventNode;
          var dispatchDelay = this.getEventIntPref('DC_OPTID_DISPATCHDELAY', eventNode)
          if ( eventNode.getAttribute('type') == 'keyboard' || //UXM-10776 - New keyboard event.
               ( eventNode.getAttribute('type') == 'change' && 
                this.getEventBoolPref('DC_OPTID_USEKEYSTROKES', eventNode)) ) {   
             //UXM-10430 - Avoid undefined exception when replay text is empty.
             if ( replayText && replayText.length > 0 ) {
               for (var i = 0; i < replayText.length; ++i) {
                  var dec = replayText.charCodeAt(i);
                  var hex = "U+00" + Number(dec).toString(16);
                  if (replayText[i].match(/['.#"%&$(]/g)) {
                     chrome['debugger'].sendCommand({
                        tabId: gDC.lastBrowserObj.tabId
                       },
                        "Input.dispatchKeyEvent",
                       {
                         "type": "char",
                         "text": replayText[i],
                         "unmodifiedText": replayText[i]
                       });
                  }
                  else {
                     gDC.sendKeystroke(replayText[i], gDC.lastBrowserObj.tabId);
                  }
               }

               if ( this.getEventBoolPref('DC_OPTID_SIMULATEENTER', eventNode) ) {
                  gDC.logger.logInfo("Simulating 'Enter' key after replay of change event ["+replayText+"].");
                  gDC.sendEnterKeystroke(gDC.lastBrowserObj.tabId);
               }               
             } else {
               gDC.logger.logWarning("Empty value at handleKeyboardEvent!");
             }
             
             gDC.continuePageEventReplay(null, gDC.lastBrowserObj, null);
           }
       } catch ( e ) {
          gDC.logException( e, gDC.DCMODULE+"handleKeyboardEvent" );
       }
    },

   /**
    * Calculates the value for the script variable or uses the default value if the
    * script variables are not configured.
    * 
    * Returns null if there is an error while processing the script variable.
    * 
    * @param {*} varInfo 
    * @param {*} replayCount 
    * @param {*} replayLocation 
    * @param {*} defaultValue 
    */
   getChangeScriptVariableValue: function (defaultValue) {
      try {
      
         var varInfo = gDC.retrieveEventVariableInfo (gDC.actEventNode);
         var replayCount = gDC.actEventNode.replayCount;
         var replayLocation = gDC.actEventNode.replayLocation;

         var strText = undefined;
         
         if (varInfo.varName) {
         
            if (varInfo.varText) {
               strText = varInfo.varText;
            }
            else {
               var variable = new DejaClick.Variable(this.logger, replayCount, replayLocation);
               strText = variable.computeScriptVariable(varInfo.varName, varInfo.varValue);
               if (strText == null) {
                  gDC.logger.logInfo("Replay failure while getting Script Variable Value. Invalid value. [Var=" + varInfo.varName+"]");
                  gDC.handleReplayFailure("dcFailure_populateScriptVar", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
                  return null;
               }
               gDC.stickyValue = varInfo.sticky > 0 ? strText : null;
            }
            gDC.varName = varInfo.varName;
         }
         else {
            strText = defaultValue;
         }

         return strText;
      } catch ( e ) {
         gDC.logException( e, this.DCMODULE+"getChangeScriptVariableValue" );
         return null;
      }
   },


   /**
    * Send the details of the event currently being replayed to the
    * target document. This method is called once the target element
    * for the event being replayed has been found.
    * @this {!DejaClick.DejaService}
    * @param {integer} aTabId Id of the tab containing the target document.
    * @param {integer} aDocId Id of the document containing the target element.
    * @param {integer} aSearchId Id of the search that found the
    *    target element for the event.
    */
   dispatchEventToDocument : function (aTabId, aDocId, aSearchId)
   {
      var eventNode, details;
      try {
         this.lastTargetDocId = aDocId;
         eventNode = gDC.actEventNode;
         var varInfo = null;
         var mfaInfo = null;
         var eventType = gDC.actEventNode.getAttribute('type');
         if (eventType == "change" || eventType == "keyboard" ) {
            varInfo = gDC.retrieveEventVariableInfo(gDC.actEventNode);
            mfaInfo = gDC.retrieveEventMfaInfo(gDC.actEventNode);
            if ( mfaInfo ) {
               mfaInfo.docId = aDocId;
               mfaInfo.tabId = aTabId;
            }
         }

         var eventparam = this.convertDomParamsToObject(this._script.getChildWithTag(eventNode, 'eventparams'))
         var isShadowkeystroke = typeof eventparam.shadowParameters !== 'undefined';

         // If event is set to use keystrokes, turn on the debugger mode and send keystrokes to the tab
         if ( ! gDC._isFirefox && //TODO Firefox Quantum UXM-11026 - Debugger Keystrokes NOT supported.
             ( eventNode.getAttribute('type') == 'keyboard' || //UXM-10776 - New keyboard event, replay ALWAYS with keystrokes.
               ( eventNode.getAttribute('type') == 'change' &&
               this.getEventBoolPref('DC_OPTID_USEKEYSTROKES', eventNode) ) ) && !isShadowkeystroke) 
         {
            var defaultValue = this._script.domTreeGetParam(eventNode, "value", "eventparams");
               
            if (!gDC.m_debuggerAttached[aTabId]) {
               chrome['debugger'].attach(
                  { tabId: aTabId },
                  '1.0',
                  gDC.handleKeyboardEvent.bind(gDC, defaultValue, varInfo, mfaInfo)
               );
            }
            else {
               gDC.handleKeyboardEvent(defaultValue, varInfo, mfaInfo);
            }
            return;
         }

         details = {
            searchId: aSearchId,
            type: eventNode.getAttribute('type'),
            replayCount: gDC._replayCount,
            replayLocation : gDC.replayLocation,
            eventparams: eventparam,
            variables: varInfo,
            mfa: mfaInfo, //UXM-11786 - Required for firefox and Chrome (no keystrokes) support for MFA security questions.
            replayhints: this.convertDomParamsToObject(
               this._script.getChildWithTag(eventNode, 'replayhints')),
            attributes: {
               usemutationhints: this.getEventBoolPref('DC_OPTID_USEMUTATIONHINTS', eventNode),
               usekeystrokes: this.getEventBoolPref('DC_OPTID_USEKEYSTROKES', eventNode),
               simulateenter: this.getEventBoolPref('DC_OPTID_SIMULATEENTER', eventNode),
               dispatchDelay: this.getEventIntPref('DC_OPTID_DISPATCHDELAY', eventNode),
               scrollToActive: this.getEventBoolPref('DC_OPTID_SCROLLTOACTIVE', eventNode),
               responsetimeout: this.getEventIntPref('DC_OPTID_RESPONSETIMEOUT', eventNode),
               useeventspeed: this.getEventBoolPref('DC_OPTID_USEEVENTSPEED', eventNode),
               eventspeed: this.getEventStringPref('DC_OPTID_EVENTSPEED', eventNode),
               selectType: this.getEventStringPref('DC_OPTID_OPTIONSELECT', eventNode)
            }
         };
         if (this.getEventBoolPref('DC_OPTID_HIGHLIGHTACTIVE', eventNode)) {
            details.attributes.highlight =
               this.getEventStringPref('DC_OPTID_ACTIVATEDSTYLE', eventNode);
            this.activeStyleApplied = true;
         }

         // @todo Resolve script variable references in details.

         this._observerService.notifyDocument(aDocId,
            'dejaclick:dispatchevent', details);

         this._setWaitType(constants.WAITTYPE_DISPATCHING);
         this.pendingDispatch = true;
         this.pendingDispatchInfo = {
            docId: aDocId,
            tabId: aTabId,
            acknowledged: false
         };
         this.thinktimeStart = Date.now();

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"dispatchEventToDocument" );
      }
   },


   /**
    * Convert a DOM element that contains several parameter elements
    * into a simple JavaScript object. Each child element is expected
    * to have a name attribute and a text node as its only
    * child. Child elements may also have itemname and itemval
    * attributes.
    * @param {?Element} aElement The parent element.
    * @return {Object.<string,(string|Object)>}
    *    The JavaScript object representation.
    */
   convertDomParamsToObject: function (aElement) {
      var object, child;
      object = {};
      if (aElement !== null) {
         for (child = aElement.firstElementChild;
               child !== null;
               child = child.nextElementSibling) {
            if (child.hasAttribute('itemname') ||
                  child.hasAttribute('itemval')) {
               object[child.getAttribute('name')] = {
                  text: child.textContent,
                  itemname: child.getAttribute('itemname'),
                  itemval: child.getAttribute('itemval')
               };
            } else {
               object[child.getAttribute('name')] = child.textContent;
            }
         }
      }
      return object;
   },

   /**
    * Continue replay of an event after the associated DOM events have
    * been dispatched to the target element. Called in response to the
    * dejaclick:dispatchComplete notification fired by a content script.
    * @param {*} aDetails
    * @param {!chrome.Tab} aTab Details of the tab in which the event
    *    was dispatched.
    * @param {integer} aDocId Id of the document in which the event was
    *    dispatched.
    */
   continuePageEventReplay: function (aDetails, aTab, aDocId) {
      var eventType, browserIndex, lastBrowserLocation;
      try {
         eventType = gDC.actEventNode.getAttribute('type');
         gDC.eventsCaptured.push(eventType);
         browserIndex = gDC.getBrowserIndex (aTab.id);
         lastBrowserLocation = gDC.getLastBrowserElement(browserIndex,
            'location');
         gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation,
            'event', eventType, ++gDC.navEventNum);

         if (gDC.pendingDispatch) {
            gDC.pendingDispatch = false;
            gDC.pendingDispatchInfo = null;
            gDC.restartResponseTimeout();
         }
         if (aDetails) {
            gDC.mutationsCountLast = aDetails.mutationsCountLast;
            // Set sticky variables, if any
            if (aDetails.stickyValue) {
               gDC._variables[aDetails.varName] = aDetails.stickyValue;
            }
         }
         gDC.areWeThereYet();
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'continuePageEventReplay');
      }
   },

   /**
    * Processes the dispatch acknowledge from the content scripts
    * 
    * Implemented with UXM-11863. With this acknowledge we will move forward with
    * the replay on event timeout even if the dispach complete didn't happen.
    * 
    * @param {*} aInfo 
    * @param {*} aTab 
    * @param {*} aDocId 
    * @param {*} aFrameId 
    */
   dispatchAcknowledged: function (aInfo, aTab, aDocId, aFrameId ) {
      try {
         if ( gDC.pendingDispatch && gDC.pendingDispatchInfo ) {
            if ( gDC.pendingDispatchInfo.docId === aDocId && gDC.pendingDispatchInfo.tabId === aTab.id ) {
               gDC.pendingDispatchInfo.acknowledged = true;
               if ( gDC.logger.debugpending ) {
                  gDC.logger.logDebug("Stored dispatch acknowledge for event [TabId="+aTab.id+"][DocId="+aDocId+"][aFrameId="+aFrameId+"][Message="+aInfo.message+"]");
               }
            } else {
               gDC.pendingDispatchInfo.otherAcks.push({
                  tabId: aTab.id,
                  docId: aDocId,
                  frameId: aFrameId
               });
               if ( gDC.logger.debugpending ) {
                  gDC.logger.logDebug("Stored complentary acknowledge for event dispatch [TabId="+aTab.id+"][DocId="+aDocId+"][aFrameId="+aFrameId+"][Message="+aInfo.message+"]");
               }
            }
         } else {
            gDC.logger.logWarning("Discarding dispatch acknowledge message. There is no pending dispatch now. [TabId="+aTab.id+"][DocId="+aDocId+"][aFrameId="+aFrameId+"][Message="+aInfo.message+"]");
         }
      } catch (ex) {
         gDC.logger.logWarning("Unexpected error processing dispatchAcknowledged: "+ex);
      }
   },

   getHashkeyNode : function(aHashkey)
   {
      if (!aHashkey || !this._actTreeRoots || !this._actTreeRoots.length) { return; }
      var parts = aHashkey.split(':');
      if (parts && parts.length > 1) {
         if (parts[1] == "script") {
            return this._domTreeRoot;
         } else {
            var baseNode;
            if (parts[1].match(/action|event/i)) {
               var s = (parts.length > 2) ? Number(parts[2]) : 0;
               baseNode = this._actTreeRoots[s];   // use actions node as the base
            } else {
               baseNode = this._domTreeRoot;       // use script node as the base
            }
            var idx = Number(parts[0])-1;
            if (idx>=0) {
               var nodeList = baseNode.getElementsByTagName(parts[1]);
               if (nodeList.length) {
                  return nodeList[idx];
               }
            }
         }
      }
      return null;
   },
   
   // retrieve the dialog activity data recorded for this event
   retrieveDialogData : function( aEventNode )
   {
      try {
         gDC.dialogRules = [];  // clear previous event's instructions
         // store a dialog rules object for each dialog data node for this event
         var nodeList = aEventNode.getElementsByTagName("dialog");
         for (var i=0; i < nodeList.length; i++) {
            var dialogNode = nodeList[i];
            var dataObj = { type    : dialogNode.getAttribute( "type" ),
                            action  : gDC._script.domTreeGetDialogParam( dialogNode, "action" ),
                            repeat  : Number(gDC._script.domTreeGetDialogParam( dialogNode, "repeat" )),
                            input1  : gDC._script.domTreeGetDialogParam( dialogNode, "input1" ),
                            input2  : gDC._script.domTreeGetDialogParam( dialogNode, "input2" ),
                            input3  : gDC._script.domTreeGetDialogParam( dialogNode, "input3" ),
                            check1  : gDC._script.domTreeGetDialogParam( dialogNode, "check1" ),
                            option1 : gDC._script.domTreeGetDialogParam( dialogNode, "option1" ),
                            option2 : gDC._script.domTreeGetDialogParam( dialogNode, "option2" ),
                            option3 : gDC._script.domTreeGetDialogParam( dialogNode, "option3" ),
                            message : gDC._script.domTreeGetDialogParam( dialogNode, "message" )
                         };
            gDC.dialogRules.push( dataObj );
         }
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"retrieveDialogData" );
      }
   },

   // try to find a matching dialog type for this event which has not yet been processed
   // note: aDialogType may be passed an array to search for multiple types simultaneously
   searchDialogData : function( aDialogType, aText )
   {
      try {
         var dataObj, dialogTypeMatched = false;
         var dialogTypes = (aDialogType instanceof Array) ? aDialogType : [ aDialogType ];

         for (var i=0; i < gDC.dialogRules.length; i++) {
            dataObj = gDC.dialogRules[i];
            for (var t in dialogTypes) {
               if (dataObj.type == dialogTypes[t]) {
                  // Try to see if the Dialog text matches, If not continue
                  // On Chrome, we can identify a dialog using the message
                  // displayed on the dialog. When we have multiple dialogs
                  // for the same event, the message attribute would help
                  // identify  the dialog.
                  if (dataObj.message && dataObj.message.length && aText && (dataObj.message != aText)) {
                     continue;
                  }
                  dialogTypeMatched = true;
                  break;
               }
            }
            if (dialogTypeMatched) {
               if (dataObj.repeat) {
                  --dataObj.repeat;
                  dataObj.replay = true;
                  return dataObj;  // found it
               }
               else {
                  // zero-out repeat count when skipping to next
                  // instruction to keep proper dialog sequence
                  dataObj.repeat = 0;
                  dataObj.replay = false;
                  return dataObj;
               }   
            }
         }
         return null;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"searchDialogData" );
         return null;
      }
   },

   handleJSDialog : function ( aResponse )
   {
      try {
         if (aResponse) {
            gDC.logger.logInfo("Replay failure at handleJSDialog. Chrome error: "+chrome.runtime.lastError.message);
            gDC.handleReplayFailure ('dcFailure_internalerror', chrome.runtime.lastError.message, constants.STATUS_INTERNAL_ERROR);
            return;
         }
         
         gDC.logger.logInfo("[Process Dialog] Activating listener of JavaScript dialog prompts for tab "+gDC.lastBrowserObj.tabId);
         gDC.m_debuggerAttached[gDC.lastBrowserObj.tabId] = true;
         chrome['debugger'].sendCommand({
               tabId: gDC.lastBrowserObj.tabId
            }, 
            "Page.enable",
            null,
            function(){
               if (chrome.runtime.lastError) {
                  gDC.logger.logInfo("Replay failure after sending command at handleJSDialog. Chrome error: "+chrome.runtime.lastError.message);
                  gDC.handleReplayFailure ('dcFailure_internalerror', chrome.runtime.lastError.message, constants.STATUS_INTERNAL_ERROR);
                  return;
               }
               chrome['debugger'].onEvent.addListener(function(source, method, params){
                  if (method  == "Page.javascriptDialogOpening") {
                     gDC.pendingDialog++;
                     var dialogObj = {method : method, params: params, source: source};
                     gDC.onTabModalDialog(dialogObj);
                  }
                  else if (method  == "Page.javascriptDialogClosed") {
                     gDC.pendingDialog--;
                  }

               });                     
            }
         );   
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"handleJSDialog" );
      }
   },
   
   onTabModalDialog : function( aDialogObj )
   {
      try {
         if (!aDialogObj) {
            throw new Error("onTabModalDialog was not passed a dialog object!");
         }

         // although the browser window has already been loaded, still give it
         // a small delay (single-threading issue, same main UI thread used).
         gDC._setWaitType( constants.WAITTYPE_ANALYZING );
         gDC._setTimeout( function(){gDC.processDialogEvent( aDialogObj );}, 50 );

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"onTabModalDialog" );
      }
   },   
    
   processCommonDialogEvent : function( aDialogObj )
   {
      try {

         // :::::::::::::::::::::::::::::::::::::::::::::::
         // :::  begin processCommonDialogEvent() logic :::
         // :::::::::::::::::::::::::::::::::::::::::::::::
         var dataObj = null;
         
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            // on replay, update the dialog with recorded input data
            dataObj = gDC.searchDialogData( [constants.DIALOGTYPE_CONFIRMPROMPT, constants.DIALOGTYPE_INPUTPROMPT] );
            if (dataObj) {
               var dialogParams = {};
               if (dataObj.type == constants.DIALOGTYPE_INPUTPROMPT) {
                  dialogParams.promptText = dataObj.input1;
               }
               
               if (dataObj.action == constants.DIALOGBUTTON_ACCEPT) {
                  dialogParams.accept = true;
               } else if (dataObj.action == constants.DIALOGBUTTON_CANCEL) {
                  dialogParams.accept = false;
               }
               
               chrome['debugger'].sendCommand({
                  tabId: aDialogObj.source.tabId
                  }, 
                  "Page.handleJavaScriptDialog",
                  dialogParams,
                  function(aResponse){
                  }
               );
               
            } else {            
               var messageLong = gDC._messageBundle.getMessage("dcFailure_unexpectedDialogLong", [aDialogObj.params.message]);
               gDC.logger.logInfo("Replay failure unexpected dialog found at processCommonDialogEvent. "+messageLong);
               gDC.handleReplayFailure( "dcFailure_unexpectedDialog", messageLong, constants.STATUS_UNEXPECTED_DIALOG );
            }
         }

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"processCommonDialogEvent" );
      }
   },

   //------------------------------------------------
   // Process prompts & dialog windows encountered during record & replay.
   // During recording, dialog interactions will be captured and associated with the current event.
   // During replay, these interactions will be replayed automatically for the matching dialog,
   // but only if a dialog of the same type is presented.  Only a specific set of dialog windows
   // are currently handled.  Note that if the 'runinteractive' preference option is set to false
   // and a dialog is encountered that dejaclick does not understand or has no instructions for
   // handling, replay will automatically terminate with an error and all dialogs will be closed.
   // Also, we don't need to drop event listeners here, as they are specific to the dialog they
   // are attached to, and go away when that dialog is closed.

   processDialogEvent : function( aDialogObj )
   {
      try {

         var dataObj = null;
         
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            // on replay, update the dialog with recorded input data
            dataObj = gDC.searchDialogData( [constants.DIALOGTYPE_CONFIRMPROMPT, constants.DIALOGTYPE_INPUTPROMPT] );
            if (dataObj) {
               // Return, if we dont need to replay the dialog.
               // On Chrome, we see multiple dialog opening events 
               // for the same dialog. We only need to process the
               // first open
               if (!dataObj.replay) {
                  return;
               }
               var dialogParams = {};

               if (dataObj.type == constants.DIALOGTYPE_INPUTPROMPT) {
                  dialogParams.promptText = dataObj.input1;
               }
               
               if (dataObj.action == constants.DIALOGBUTTON_ACCEPT) {
                  dialogParams.accept = true;
               } else if (dataObj.action == constants.DIALOGBUTTON_CANCEL) {
                  dialogParams.accept = false;
               }
               chrome['debugger'].sendCommand({
                  tabId: aDialogObj.source.tabId
                  }, 
                  "Page.handleJavaScriptDialog",
                  dialogParams,
                  function(aResponse){
                  }
               );
               
            } else {            
               var messageLong = gDC._messageBundle.getMessage("dcFailure_unexpectedDialogLong", [aDialogObj.params.message]);
               gDC.logger.logInfo("Replay failure unexpected dialog found at processDialogEvent. "+messageLong);
               gDC.handleReplayFailure( "dcFailure_unexpectedDialog", messageLong, constants.STATUS_UNEXPECTED_DIALOG );
            }
         }

         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            gDC.areWeThereYet();
         }

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"processDialogEvent" );
      }
   },
   
   isAuthDialog : function ()
   {
      try {
         if (gDC.dialogRules.length == 1) {
             if (gDC.dialogRules[0].type == 1) {
                return true;
             }                
         }
         return false;
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"isAuthDialog" );
      }         
   },
   
   processJSDialog : function () 
   {
      try {
         if ( this._isFirefox ) {
            gDC.logger.logInfo("Replay failure while processing JavaScript Dialog. Option not supported at Firefox Extension. Please, use Chrome instead.");
            gDC.handleReplayFailure('dcFailure_jsDialogsNotSupported', null,
               constants.STATUS_SCRIPT_PARSE_ERROR);
            return;
         }


         var tabId;
         if (!gDC.lastBrowserObj) {
            gDC.lastBrowserObj = gDC.browsersTracked[0];
         }
         
         tabId = gDC.lastBrowserObj.tabId;
         
         // If there is only a single dialog rule for authorization 
         // skip the JS Dialog handling since the login is not
         // a JS Dialog
         if (gDC.isAuthDialog()) {
            return;
         }
         
         var tab = gDC.lastBrowserObj.browser;     
         if ( gDC.logger.debugprocess ) {
            gDC.logger.logDebug("[Process Dialog][TabId="+tabId+"] Checking tab before running 'processJSDialog'. URL="+tab?tab.url:"URL n/a.");
         }    
         //UXM-11847 - The update to 'about:blank' is not resolving the issue
         // it is not happening on time and, if I add a delay, it breaks the script
         // replay, So, for the moment, I am returning a failure.
         // In any case, we could need to evolve this approach to do a navigation to about:black 
         // before starting the replay of any script.
         if (gDC.isChromeTab(tab) || gDC.isNewTab(tab)) { 
            gDC.logger.logWarning("[Process Dialog][TabId="+tabId+"] Unable to attach Chrome Debugger. Dialog prompts not allowed for URL: "+tab.url );      
            gDC.handleReplayFailure( "dcMessage_dialogPromptTabError", null, constants.STATUS_SCRIPT_PARSE_ERROR );
            return;
         }

         if (!gDC.m_debuggerAttached[tabId]) {
            gDC.logger.logInfo("[Process Dialog][TabId="+tabId+"] Attaching debugger to tab "+tabId);
            chrome['debugger'].attach(
               { tabId: tabId },
               '1.0',
               gDC.handleJSDialog.bind(gDC)
            );
         }
         else {
            if ( gDC.logger.debugprocess ) {
               gDC.logger.logDebug("[Process Dialog][TabId="+tabId+"] Debugger already attached. Calling 'handleJSDialog'");
            } 
            gDC.handleJSDialog();
         }
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"processJSDialog" );
      }
   },
   
   //------------------------------------------------
   // Figure out which event to replay next,
   // based on the branching rules defined for the given event.
   getNextEvent : function( aEventNode )
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "calculating next event to replay..." ); }

         // no events loaded, so nothing to replay
         if (!gDC.actEventNodes) { 
            if ( gDC.logger.debugprocess ) {
               gDC.logger.logDebug("getNextEvent Result: NULL");
            }
            return null; 
         }      
         if (!aEventNode) {
            if ( gDC.logger.debugprocess ) {
               gDC.logger.logDebug("getNextEvent - No aEventNode defined. Returning reference to first event of script. Result: num=1, subscriptNum=0, node=[1:event]");
            }
            return {
               num:  1, // no event given, so return event 1
               subscriptNum: 0,
               node: gDC.getHashkeyNode("1:event")
            };
         }

         gDC.triggeredScriptFinished = null;
         
         //UXM-11786 - Support for the new triggered subscripts
         if ( gDC.triggerFired != null ) {
            gDC.logger.logInfo("getNextEvent - Subscript triggered by keyword [triggerFired="+gDC.triggerFired+"]");

            let triggerInfo = gDC._triggers[gDC.triggerFired];
            if ( ! triggerInfo ) {
               gDC.logger.logWarning("getNextEvent - Invalid subscript triggered! No info found. Ignoring...");
               gDC.triggerFired = null;
            } else { 
               let subscriptNode = gDC.getHashkeyNode(triggerInfo.subscript+":subscript");

               if ( ! subscriptNode ) {
                  gDC.logger.logWarning("getNextEvent - Subcriptn NOT found. ID: "+ triggerInfo.subscript); 
               } else {
                  let eventsList = subscriptNode.getElementsByTagName('event');     
                  if (eventsList.length) {
                     //NO triggered script in progress already
                     if ( ! gDC.triggeredSubscriptPrevNode ) {
                        gDC.triggeredSubscriptPrevNode = aEventNode;
                        gDC.triggeredSubscriptPrevSubcript = gDC.subscriptNum;
                        gDC.triggeredScriptNextEvent = 1;
                        gDC.logger.logInfo("getNextEvent - Replaying first event of triggered subscript! [Triggered_Script="+ triggerInfo.subscript+"][EventId=1]"); 
                        let tmpNextEventProps = {
                           num: gDC.triggeredScriptNextEvent,
                           subscriptNum: triggerInfo.subscript,
                           triggerId: gDC.triggerFired,
                           triggeredEvent: gDC.triggeredScriptNextEvent,
                           node: eventsList[0]
                        };
                        if ( gDC.logger.debugprocess ) {
                           gDC.logger.logDebug("getNextEvent Result: "+JSON.stringify(tmpNextEventProps));
                        }
                        return tmpNextEventProps;

                     //Replay next event of the triggered script
                     } else if ( gDC.triggeredScriptNextEvent < eventsList.length ) {
                        gDC.logger.logInfo("getNextEvent - Replaying "+gDC.triggeredScriptNextEvent+" event of triggered subscript! [Triggered_Script="+ triggerInfo.subscript+"][EventId="+gDC.triggeredScriptNextEvent+"]"); 
                        gDC.triggeredScriptNextEvent++;
                        let tmpNextEventProps = {
                           num: gDC.triggeredScriptNextEvent,
                           subscriptNum: triggerInfo.subscript,
                           triggerId: gDC.triggerFired,
                           triggeredEvent: gDC.triggeredScriptNextEvent,
                           node: eventsList[gDC.triggeredScriptNextEvent-1]
                        };   
                        if ( gDC.logger.debugprocess ) {
                           gDC.logger.logDebug("getNextEvent Result: "+JSON.stringify(tmpNextEventProps));
                        }
                        return tmpNextEventProps;
                     
                     //Triggered script replay done, back to previous replay situation
                     } else {
                        aEventNode = gDC.triggeredSubscriptPrevNode;
                        gDC.subscriptNum = gDC.triggeredSubscriptPrevSubcript;
                        gDC.logger.logInfo("getNextEvent - Triggered script replay finished! Back to main flow! [Triggered_Script="+ triggerInfo.subscript+"][ReturningEventId="+(Number(aEventNode.getAttribute('seq')) + 1)+"][ReturningSubscriptId="+gDC.subscriptNum+"]"); 
                        gDC.triggeredSubscriptPrevNode = null;
                        gDC.triggeredSubscriptPrevSubcript = null;
                        gDC.triggeredScriptFinished = gDC.triggerFired;
                        gDC.triggerFired = null;
                        gDC.triggeredScriptNextEvent = null;
                        //Back to main flow!

                        //Restore the actEventNodes 
                        gDC.subscriptNum = (gDC.subscriptNum) ? gDC.subscriptNum : 0; 
                        gDC.actTreeRoot = gDC._actTreeRoots[ gDC.subscriptNum ];
                        gDC.actEventNodes = gDC.actTreeRoot.getElementsByTagName("event");
                        gDC.subscriptNode =  (gDC.subscriptNum) ? gDC.actTreeRoot.parentNode : null;

                        gDC.subscriptNum == 0 ? 
                        gDC._observerService.notifyObservers('dejaclick:handlescripttabfrombackground', {hashkey: "1:script", state: "continue"} ) : 
                        gDC._observerService.notifyObservers('dejaclick:handlescripttabfrombackground', {hashkey: gDC.subscriptNum+":subscript", state: "continue"} );
                        
                     }
                  } else {
                     gDC.logger.logWarning("getNextEvent - Triggered subscript DOES NOT HAVE events! ID: "+ gDC.triggerFired); 
                  }

               }
            
            }
         }

         var nextEventNum = -1, nextSubscriptNum = 0, nextEventNode = null, nextEventProps = null;

         // check if there is an applicable branching rule
         var branchingRule = gDC.getBranchingRule( aEventNode, constants.CONDITIONTYPE_REPLAYSTATUS, 0 );
         if (branchingRule) {
            var branchName    = gDC._script.domTreeGetBranchParam( branchingRule, "name" );
            var condition     = gDC._script.domTreeGetBranchParam( branchingRule, "condition" );
            var target        = gDC._script.domTreeGetBranchParam( branchingRule, "target" );

            if (gDC.logger.debugprocess) {
               var branchParent = branchingRule.parentNode.parentNode;
               gDC.logger.logDebug( "getNextEvent: applying branching rule '" + branchName + "' of " +
                     branchParent.nodeName + " " + branchParent.getAttribute('seq') +
                     "\n   (condition: '" + condition + "', target: '" + target + "')" );
            }

            // if so, then the next event will be this branching rule's target
            if (target) {
               var targetParts = target.split(':');
               if (targetParts && (targetParts.length > 1)) {

                  // extract the event properties we need
                  switch (targetParts[1]) {
                     case constants.TARGETTYPE_EVENT:
                        nextEventNum      = Number(targetParts[0]);
                        nextSubscriptNum  = (targetParts.length > 2) ? Number(targetParts[2]) : 0;
                        nextEventNode     = gDC.getHashkeyNode( target );
                        break;
                     case constants.TARGETTYPE_ACTION:
                        // for action-type targets, use the 1st event of the action
                        var actionNode = gDC.getHashkeyNode( target );
                        if (actionNode) {
                           var actionEvents = actionNode.getElementsByTagName('event');
                           if (actionEvents.length) {
                              nextEventNode     = actionEvents[0];
                              nextEventNum      = Number(nextEventNode.getAttribute('seq'));
                              nextSubscriptNum  = (targetParts.length > 2) ? Number(targetParts[2]) : 0;
                           }
                        }
                        break;
                     case constants.TARGETTYPE_ENDREPLAY:
                        nextEventNum = 0;
                        break;
                     default:
                        break;
                  }

                  if (nextEventNum != -1) {
                     // set a flag on the results tree to indicate that at least one branch was taken
                     if (gDC._resTreeRoot && !gDC._resTreeRoot.hasAttribute("branchtaken")) {
                        gDC._resTreeRoot.setAttribute( "branchtaken", true );
                     }
                  }
               }
            }
         }

         // else the default is the next event in the current subscript
         if (nextEventNum == -1) {
            nextEventNum = Number(aEventNode.getAttribute('seq')) + 1;
            nextSubscriptNum = gDC.subscriptNum;
         }

         // make sure that the result is a valid event else return null
         if ((nextEventNum <= 0) ||
             (nextSubscriptNum >= gDC._actTreeRoots.length) ||
             (nextEventNum > gDC._actTreeRoots[nextSubscriptNum].getElementsByTagName("event").length)) {
            nextEventProps = null;
         } else {
            nextEventNode = (nextEventNode) ? nextEventNode : gDC._actTreeRoots[nextSubscriptNum].getElementsByTagName("event")[nextEventNum-1];
            nextEventProps = { num:          nextEventNum,
                               subscriptNum: nextSubscriptNum,
                               node:         nextEventNode };
         }

         //If the next script sequence is flagged for skipping, loop until we get the next sequence for playing        
         if(nextEventNode !== null){
            if(nextEventNode.getAttribute('skipstep')){
               nextEventProps = null;
               for(let i = nextEventNum+1;i<=gDC._actTreeRoots[nextSubscriptNum].getElementsByTagName("event").length;i++){
                  let tempEvent = gDC._actTreeRoots[nextSubscriptNum].getElementsByTagName("event")[i-1];
                  if(!tempEvent.getAttribute('skipstep') && nextEventProps === null){
                     nextEventProps = {
                        num:i,
                        subscriptNum:nextSubscriptNum,
                        node:tempEvent
                     };
                  }
               }
            }
         }


         if ( gDC.logger.debugprocess ) {
            gDC.logger.logDebug("getNextEvent Result: "+JSON.stringify(nextEventProps));
         }
         return nextEventProps;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getNextEvent" );
         return null;
      }
   },

   continueReplay : function (aData, aCompletedItem)
   {
      try {

         switch (aCompletedItem) {
            case constants.TIMINGS_COMPLETED:
               gDC.pendingStepTiming = false;
               break;
            case constants.CAPTURE_COMPLETED:
               gDC.pendingCapture = false;
               break;
            default:
               break;
         }
         
         if (gDC.pendingStepTiming || gDC.pendingCapture) {
            gDC.setSystemBoolPref('DC_OPTID_SUSPENDREPLAY', true);
         }
         else {
            gDC.setSystemBoolPref('DC_OPTID_SUSPENDREPLAY', false);
         }
         
         if (gDC.replayShuttingDown) {
            return;
         }
         
         // this topic delivers notification that replay should proceed
         if (aData) {
            // if aData has a non-null value, it means an event was skipped,
            // so we reset all net activity counters and jump directly into
            // replayNextEvent to prevent any additional network activity
            // from hanging up our transition to the next event.
            gDC.resetActivity();
            gDC.replayNextEvent();
         } else {
            // otherwise we just do our normal check-if-we're-done logic
            if (!gDC.pendingPrompt) {
               gDC.areWeThereYet();
            }
         }
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"continueReplay" );
         return null;
      }
   },

   /**
    * @param {!{
    *    messageId: string,
    *    statusCode: integer,
    *    statusLogID: null
    * }} aData Details of the failure.
    */
   clientFailure : function(aData)
   {
      try {
         if (gDC._runMode == constants.RUNMODE_RECORD || gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            if (!gDC.replayShuttingDown) {
               var messageID = aData.messageId;
               var statusCode = aData.statusCode;
               var statusLogID = aData.statusLogID;

               // this ensures we have stopped net activity before processing failure
               // use a persistent!!! timer to break any re-entrant deadlocks.
               gDC._setTimeout( function(){gDC.handleReplayTimeout( messageID, statusCode, statusLogID, true );}, 100, true );
            }
         }
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"clientFailure" );
         return null;
      }
   },

   //------------------------------------------------
   // We must use an async timer to check for final activity completion, because
   // we can run into race conditions with opening windows on the final event.
   shutdownEventReplay : function()
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("in shutdownEventReplay"); }

         // send both messages to force an observer notification for each iteration
         gDC._setWaitType( constants.WAITTYPE_ANALYZING );
         gDC._setWaitType( constants.WAITTYPE_STOPPING );

         // check to see if the special 'suspendreplay' pref is enabled
         // which means replay activity is being delayed via an external
         // controller which is waiting to finalize its processing.
         if (gDC.isExecutionSuspended()) {
            // yes, we're suspended, so fire off a timer to call ourselves
            // again, retrying until the pref option has been deactivated.
            gDC.lastSuspendDelay = gDC.lastSuspendDelay ? gDC.lastSuspendDelay : gDC.getSystemIntPref('DC_OPTID_SUSPENDDELAY');
            gDC.logger.logInfo( "shutdown processing pending, sleeping for " + Number(gDC.lastSuspendDelay)/1000 + " seconds..." );
            gDC.restartShutdownTimeout( gDC.lastSuspendDelay );
            return;
         }

         // now check if all browser activity has stopped
         if (gDC._runMode == constants.RUNMODE_REPLAY && !gDC.areWeThereYet() && !gDC.lastEventSkipped) {
            gDC.pendingActivity = false;  // clear these flags to prevent looping
            gDC.pendingXMLRequest = false;

            gDC.restartShutdownTimeout();  // not yet, so keep rechecking
            return;
         }

         // its now okay to proceed with final replay shutdown..
         gDC.stopShutdownTimeout();

         // UXM-13804 - Inform UI that the subscript was done
         gDC.actScriptNode.tagName == "subscript" 
         ? gDC._observerService.notifyObservers('dejaclick:updatetabstate', gDC.actScriptNode.getAttribute("seq")+":subscript" )
         : gDC._observerService.notifyObservers('dejaclick:updatetabstate', "1:script" );

         if (gDC.resEventNode && !gDC.resEventNode.hasAttribute('statuscode')) {
            gDC.handleReplaySuccess( "dcSuccess_replaySuccess", null, true );
         }

         if (gDC._resTreeRoot) {
            gDC._resTreeRoot.setAttribute( "replaycomplete", "true" );
         }

         gDC.logger.logInfo( "No more events to process.  Replay Complete." );

         gDC.setRunMode( constants.RUNMODE_STOPPED, true);
         gDC._setWaitType( constants.WAITTYPE_STOPPED );

         this._observerService.notifyLocalObservers('dejaclick:exportResults',
            null);

         // show replay advisor notice if repairs were made
         if (gDC.advisorRepairs) {
            gDC._script.setChangesPending();
            gDC._utils.promptService.notifyUser( "dcMessage_warnadvisorchanges", true );
         }

         if (gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE')) {
            var autoPowerOff = gDC.getSystemBoolPref( 'DC_OPTID_AUTOPOWEROFF');
            if (!(autoPowerOff && !gDC.advisorRepairs)) {
               // always show a final 'success' notification popup
               // unless the autopoweroff option is set and there
               // were no replay advisor script repairs.
               var args, notifymsg;
               if (gDC.eventsSkipped.length) {
                  args = [gDC.eventsCaptured.length, gDC.eventsSkipped.length];
                  notifymsg = gDC._messageBundle.getMessage("dcMessage_replayCompleteSkip", args);
               } else {
                  args = [gDC.eventsCaptured.length];
                  notifymsg = gDC._messageBundle.getMessage("dcMessage_replayComplete", args);
               }

			   // Check if there are no http steps due to url block/ignore. If so, notify that
               var urlsIgnored = gDC.urlsIgnored.slice(gDC._maskedURLs.length+1,gDC.urlsIgnored.length);
               if (urlsIgnored.length || gDC.urlsBlocked.length) {
                  var httpSteps = 0, httpStepsEvt = 0;
                  var eventNodes = this._script.processXPath(this._domTreeRoot,
                     "//actions[@type='replay']/action/event");

                  if (eventNodes && eventNodes.length ) {
                     // loop over all events nodes to accumulate totals
                     for (var i=0; i < eventNodes.length; i++) {
                        var eventNode = eventNodes[i];

                        if (eventNode.hasAttribute("httpsteps")) {
                           httpStepsEvt = parseInt(eventNode.getAttribute("httpsteps"), 10);
                        }

                        // accumulate totals....
                        httpSteps  += httpStepsEvt;
                     }
                     if (!httpSteps) {
                        var ignoredString = urlsIgnored.length ? "URLs Ignored: " + urlsIgnored.toString() + "\n" : "";
                        var blockedString = gDC.urlsBlocked.length ? "URLs Blocked: " + gDC.urlsBlocked.toString() + "\n" : "";
                        var urlString = ignoredString + blockedString;
	                notifymsg = gDC._messageBundle.getMessage("dcMessage_replayCompleteNoStep", urlString);
                     }
                  }
               }

               gDC.notifyUserAndRestoreBrowserWindows( notifymsg, false );
            }
         }

         gDC.finalizeState();  // finalize our worldly state

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"shutdownEventReplay" );
      }
   },

   _getEventLabelByType: function (aEventNode) {
      var eventType, eventLabel, params;
      try {
         // show the event type and target as event tree label
         eventType = aEventNode.getAttribute('type');

         switch (eventType) {
            case "navigate":
               var url = gDC._script.domTreeGetEventParam(aEventNode, "urlrequested");
               params = [url];
               break;
            case "mousedown":
            case "click":
            case "hover":
            case "move":
            case "drag":
            case "focus":
            case "keyboard":
            case "change":
               var elt = this._getFirstCrumbLabel(aEventNode);
               params = [elt];
               break;
            case "submit":
            case "winopen":
            case "winclose":
            case "tabopen":
            case "tabclose":
            case "tabfocus":
               params = [];
               break;
            default:
               // unknown type
               eventLabel = "";
               break;
         }

         if (params) {
            eventLabel = DejaClick.utils.getMessage("dcTreeview_" + eventType + "Label", params);
         }

         return eventLabel;

      } catch(ex) {
         gDC.logException(ex);
      }
   },

   /**
    * Get the label for the event based on crumb element
    * @this {DejaClickUi.TreeViewHelpers}
    * @param {!Element} aEventNode
    * @returns {string}
    * @private
    */
   _getFirstCrumbLabel: function (aEventNode) {
      // drill down for the target element type
      var xpath = "child::targets/target",
         targetNodes = gDC._script.processXPath(aEventNode, xpath),
         firstCrumb;

      for (var i = 0; i < targetNodes.length; i++) {
         if (targetNodes[i].getAttribute('type') == 'element') {
            firstCrumb = targetNodes[i].getElementsByTagName('crumb')[0];
            return (firstCrumb) ? firstCrumb.getAttribute('tag') : "???";
         }
      }

      return "???";
   },


   //------------------------------------------------
   // called at event time - no this
   // This is the main event replay function, called by a timer to process one event at a time.
   // It recreates the original browser actions by injecting synthesized events into the DOM
   // from the recorded script.
   replayNextEvent : function()
   {
      var minMatchScore = 0;
      var eventNode, browserNode;

      function findTargetBrowserNode( aEventNode, aMinMatchScore ) {

            // note: this function has a side-effect of also setting gDC.lastBrowserObj
         var browserNode = null;

         //UXM-12071 - If the navigate event happens right after tab focus or tab open, we just use the last tab tracked.
         //Otherwise we reset the "gDC.lastBrowserObj" so we calculate a new value.
         if ( gDC.currentEventType === 'navigate' && //We may want to do this for all the event types, not just navigation.
            ( gDC.previousEventType === 'tabfocus' || gDC.previousEventType === 'tabopen') ) 
         {
            if ( gDC.lastBrowserObj ) {
               gDC.logger.logInfo("findTargetBrowserNode - Using last tracked browser tab for the new navigation event ["+gDC.lastBrowserObj.tabId+"]");
               return gDC.lastBrowserObj;
            } else {
               gDC.logger.logWarning("findTargetBrowserNode - Navigation event after tab focus/open. There is no last browser information, recalculating again!" );
            }
         } else {
            gDC.lastBrowserObj = null;
         }

         if (gDC.replayedEvents == 1) {
               // If this is the first event of the script, just pick the initial browser.
               // (that is, don't bother hunting for the 'best' browser to load the URL
               //  in, as the currently focused browser is always the one we want to use)
            gDC.lastBrowserObj = gDC.browsersTracked[0];
            browserNode = gDC.lastBrowserObj;

         } else {

            // Otherwise, find the best available DOM target node for this event
            // (that is, try to find the best matching browser target available)
            // and from that, grab the associated browser object to replay the
            // event.
            var targetNode = gDC.findTargetDocument( aEventNode, aMinMatchScore );
            if (targetNode == null) {
               return null;  // user already alerted of error, just exit quietly
            }

            // Browser events are diffferent from 'web page' events, as they
            // will target a particular browser instance for event execution.
            // The target dom node found should point us to a navigation tree
            // node whose parent browser node represents the browser element
            // we want, so just pull off its index number for to reference
            // the actual browserNode we are tracking.

            // get the nav event's parent browser nav node
            var navBrowserNodes = gDC._search.processXPath( targetNode, "ancestor-or-self::browser" );

            // get its associated tracking (array) index number (not sequence number!)
            var browserIndex = navBrowserNodes[0].getAttribute('browserindex');

            // get our tracked browser object
            try { gDC.lastBrowserObj = gDC.browsersTracked[ browserIndex ]; } catch(ex) {}
            if (!gDC.lastBrowserObj) {
               gDC.lastBrowserObj = gDC.browsersTracked[0];
               gDC.logger.logWarning("Unable to determine browser target, using initial browser");
            }
            // get its associated browser node
            browserNode = gDC.lastBrowserObj;
         }

         return browserNode;

      }  // end of findTargetBrowserNode()


      try {

         // :::::::::::::::::::::::::::::::::
         // :::  begin event replay logic :::
         // :::::::::::::::::::::::::::::::::


         gDC.stopReplayTimeout();  // wipe the timer, so new ones may be set


         if (gDC.logger.debugprocess) { gDC.logger.logDebug("in replayNextEvent"); }


         //  handle final checks for the current event
         //  --------
         if (!gDC.processCheckpoints()) {
            return;
         }

         var ueClientReplay = false;
/*
         var ueClientReplay = !gDC._serverOperation && gDC.getEventBoolPref( 'DC_OPTID_REPLAYUE' );
*/
         //  check if we're done processing all events
         //  --------
         if (!gDC.nextEvent) {
            // In the case that we had to preload the original starting URL for the script,
            // we would have reset the counters to 0 (since we haven't replayed the 1st event yet),
            // so clear the current event node to make sure that we pick up the 1st event again.
            if (!gDC.replayedEvents) { gDC.actEventNode = null; }

            gDC.nextEvent = gDC.getNextEvent( gDC.actEventNode );
         }

         if (!gDC.nextEvent) {
/*
            if (ueClientReplay) {
               gDC.segmentAreas();
            }
*/

            if (gDC.replayShuttingDown) { return; } // already told to shutdown elsewhere

            // no events left to replay, so begin replay shutdown (we never come back)
            gDC.replayShuttingDown = true;
            gDC.stopReadyTimeout();
            gDC.stopReplayTimeout();

            if (!gDC.shutdownTimeout) {
               gDC._setWaitType( constants.WAITTYPE_STOPPING );
               gDC.restartShutdownTimeout(10);
            }

            return;
         }


         //  still more events, so update the last event's replay result status
         //  --------
         if (gDC.resEventNode && !gDC.resEventNode.hasAttribute('statuscode') && gDC.replayedEvents > 0) {
/*
            if (ueClientReplay) {
               gDC.segmentAreas();
            }
*/
            // no previous event status, default to Success
            gDC.handleReplaySuccess( "dcSuccess_replaySuccess" );
            if (gDC.isExecutionSuspended()) {
               return;
            }
         }

         //UXM-11786 - Before processing the next event we have to
         //check if there is any triggered subscript that could match
         //the current page.
         if( gDC._triggers && gDC._triggers.length > 0  //Just if triggered subscripts are defined
            && ! gDC.nextEvent.hasOwnProperty('triggerId') ) //We are already at a triggered subscript, no check for triggered actions required!
         {
            //Already sent the keyword search for this event... We are still waiting for results.
            if ( gDC.waitingForTriggerKeywordResult && gDC.waitingForTriggerKeywordResult.size > 0 ) {
               gDC.logger.logInfo("replayNextEvent - triggered subscripts - Still waiting for keyword response. Allowing one more replay time out.");
               gDC.waitingForTriggerKeywordResult = new Set(); //Clearing the waiting flag, so we don't keep waiting forever.
               this.restartReplayTimeout();
               return;
            }
            //We haven't sent the keyword search event before the current event. Sending them!
            //NOTE: gDC.waitingForTriggerKeywordResult is null when there is no active triggered search
            // and it is empty when the search has finished.
            else if ( gDC.waitingForTriggerKeywordResult == null ) {
               gDC.waitingForTriggerKeywordResult = new Set();
               if ( gDC.logger.debugprocess ) {
                  gDC.logger.logDebug("replayNextEvent - triggered subscripts - Sending keyword search for all the defined triggered subscripts [#Scripts="+Object.keys(gDC._triggeredSubscripts).length+"][#Triggers="+gDC._triggers.length+"]");
               }
               for( let i=0; i<this._triggers.length; i++ ) { 
                  gDC._triggers[i].trigger.triggerSearchId = i;
                  gDC.waitingForTriggerKeywordResult.add(i);
                  if ( gDC.logger.debugprocess ) {
                     gDC.logger.logDebug("replayNextEvent - triggered subscripts - Sending search: "+JSON.stringify(gDC._triggers[i].trigger));
                  }
                  gDC._observerService.notifyObservers('dejaclick:keywordsearch', gDC._triggers[i].trigger );
               }
               if ( gDC.logger.debugprocess ) {
                  gDC.logger.logDebug("replayNextEvent - triggered subscripts - Restarting replay timeout to let the triggered subscripts keyword search finish!");
               }
               this.restartReplayTimeout();
               return;
           
            //Keyword search succeed, so we have to switch to the triggered subscript.
            } else if ( gDC.triggerFired != null ) {
               gDC.logger.logInfo("replayNextEvent - Triggered subscripts - Triggered! [ID="+gDC.triggerFired+"]");
               
               gDC.nextEvent = gDC.getNextEvent( gDC.actEventNode );
               gDC.waitingForTriggerKeywordResult = null;
            
            //gDC.waitingForTriggerKeywordResult is defined and empty (all the keyword search result arrived or timed out)
            // and the gDC.triggerFired is null, so none of the keyword search results were positive, we continue with normal replay
            } else {
               if ( gDC.logger.debugprocess ) {
                  gDC.logger.logDebug("replayNextEvent - Triggered subscripts - Already tried to search for this event without keyword found. So, moving forward with the standard replay!");
               }
            }
         }


         // :::::::::::::::::::::::::::::::::
         // :::   process the next event  :::
         // :::::::::::::::::::::::::::::::::

         this.pendingStepTiming = true;
         gDC.mutationsRequired = 0;
         gDC.thinktimeStart = 0;
         gDC.thinktimeStop = 0;
         gDC.classifytimeStop = 0;
         gDC.dynamicObjs = false;
         gDC.activeValidations = {};
         // Deactivate search for target of previous event as a precaution.
         delete gDC.activeSearches[gDC.lastTargetSearchId];
         gDC.lastTargetSearchId = -1;
         gDC.lastTargetDocId = -1;
         gDC.httpCounter = 1;
         gDC.validationType = gDC.VALIDATIONTYPE_JAVASCRIPT;

         //  deal with any replay hints (looks ahead into next event)
         //  --------
         if (gDC.processReplayHints( gDC.nextEvent.node )) {
            // exit early if positive value returned from processReplayHints
            gDC.lastReadyTimeout = 0;
            gDC.restartReadyTimeout();
            return;
         }

         //Clear the trigger as the replay is moving forward to the next event.
         gDC.waitingForTriggerKeywordResult = null;

         gDC._setWaitType( constants.WAITTYPE_INITIALIZING );

         //  update current event
         //  --------
         gDC._setCurrentEvent( gDC.nextEvent.subscriptNum, gDC.nextEvent.num, gDC.nextEvent );

         gDC.replayedEvents++;   // bump event counter

         if (!gDC.resActionNode ||
               (Number(gDC.resActionNode.getAttribute('orig_subscriptseq')) != gDC.subscriptNum) ||
               (Number(gDC.resActionNode.getAttribute('orig_seq')) != gDC.actActionNum)) {
            gDC.replayedActions++;  // bump action counter
         }

         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug("replayNextEvent: next event is: [" +
               (gDC.subscriptNum ? "subscript " + gDC.subscriptNum :
               "main script") + "] event " + gDC.actEventNum + " of " +
               gDC.actEventNodes.length);
         }
         
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: replaying event (" + gDC.replayedEvents + " of " + gDC._totalEventCount + ")"); }

            
         gDC._setRunType( constants.RUNTYPE_REPLAY );  // updates the current replay state

         eventNode = gDC.actEventNode;
         var eventType = eventNode.getAttribute('type');

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "replayNextEvent: initializing event: " + eventType ); }

         gDC.updateTreeViewNodeState( eventNode, gDC.subscriptNum, TREETYPE_PLAY, TREETYPE_NORM, true, true );
         gDC.updateTreeViewNodeState( eventNode, gDC.subscriptNum, TREETYPE_PLAY, TREETYPE_CHECK, true, true );
         
         var ensureVisibleHashkey = gDC.subscriptNum == 0 
         ? eventNode.getAttribute("seq")+":event" 
         : eventNode.getAttribute("seq")+":event:"+gDC.subscriptNum+":subscript";
         
         gDC._observerService.notifyLocalObservers("dejaclick:ensurevisible", ensureVisibleHashkey);
         
         gDC.retrieveDialogData( eventNode );

         if (gDC.dialogRules && gDC.dialogRules.length > 0) {
            gDC.processJSDialog();
         }

         // append to the results tree
         if (!gDC.resActionNode ||
               (Number(gDC.resActionNode.getAttribute('orig_subscriptseq')) != gDC.subscriptNum) ||
               (Number(gDC.resActionNode.getAttribute('orig_seq')) != gDC.actActionNum)) {

            // add a new results action node
            gDC.resActionNode = gDC.domTreeInsertResElement(gDC._resTreeRoot, "action", gDC.actActionNode.getAttribute('type'), ++gDC.resActionNum);
            gDC.resActionNode.setAttribute('orig_seq', gDC.actActionNum);
            if (gDC.subscriptNum) { gDC.resActionNode.setAttribute('orig_subscriptseq', gDC.subscriptNum); }

            // copy description directly from script action node to use in results reporting
            var actionDesc = gDC._script.domTreeGetAttribute(gDC.actActionNode, 'description');
            if (!actionDesc) {
               actionDesc = "Action " + gDC.actActionNode.getAttribute('seq');  // create a default action label if no description
            }
            gDC.resActionNode.setAttribute('description', actionDesc);
         }

         // add a new results event node
         gDC.resEventNode = gDC.domTreeInsertResElement(gDC.resActionNode, "event", gDC.actEventNode.getAttribute('type'), ++gDC.resEventNum);
         gDC.resEventNode.setAttribute('orig_seq', gDC.actEventNum);
         if (gDC.subscriptNum) { gDC.resEventNode.setAttribute('orig_subscriptseq', gDC.subscriptNum); }

         // copy description directly from script event node to use in results reporting
         var eventDesc = gDC._script.domTreeGetAttribute(gDC.actEventNode, 'description');
         if (!eventDesc) {
            eventDesc = "Event " + gDC.actEventNode.getAttribute('seq') + ": " + gDC._getEventLabelByType(gDC.actEventNode);  // create a default event label if no description

         }
         if (gDC.subscriptNum) {
            var subscriptDesc = gDC._script.domTreeGetAttribute(gDC.subscriptNode, 'description');
            if (!subscriptDesc) {
               subscriptDesc = "Branch " + gDC.subscriptNum;
            }
            eventDesc = subscriptDesc + ": " + eventDesc;
         }
         gDC.resEventNode.setAttribute('description', eventDesc);

         // notify observers that a result node has been created for the event
         var details = { resActionNum: gDC.resActionNum, resEventNum: gDC.resEventNum };
         gDC._observerService.notifyLocalObservers('dejaclick:resulteventnode', details);
         gDC.httpSteps = [];


         if (gDC._runMode != constants.RUNMODE_REPLAY) {
            gDC.stopReadyTimeout();
            gDC.stopReplayTimeout();  // our runmode has changed, so jump out now
            return;
         }

         // reset special flags
         gDC.pendingEvtValidation = false;
         gDC.pendingActValidation = false;

         gDC.evtTimeoutCounter = 0;
         gDC.lastReadyTimeout = 0;
         gDC.lastSuspendDelay = 0;
         gDC.mutationsCount = 0;
         gDC.networkStopTime = 0;
         gDC.eventSteps = 0;
         gDC.resetActivity();

         gDC.captureInitiated = false;
         gDC.networkHints = null;
         gDC.scriptedHints = null;
         gDC.networkTimeout = null;
         gDC.branchingRule = null;
         gDC.nextEvent = null;
         gDC.validatingActSeqNum = 0;
         gDC.validatingEvtSeqNum = 0;
         gDC.onCompletedReceived = false;
         gDC._clearTimeout(gDC.onCompletedTimeout);
         gDC.onCompletedTimeout = null;
         gDC.trackingSeq = null;
         gDC.lastEventSkipped = false;
         gDC.elementTargetNotFound = false;

         if (gDC.getEventBoolPref('DC_OPTID_USEMINMATCHSCORE', eventNode)) {
            // get the minimum acceptable target match score, if any
            minMatchScore = (gDC.getEventIntPref('DC_OPTID_MINMATCHSCORE', eventNode) * 0.01 );
            if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: observing minimum match score setting: " + minMatchScore); }
         }

         gDC.restartEventTimeout();
 
         // :::::::::::::::::::::::::::::::::
         // ::: BEGIN BROWSER EVENT TYPES :::
         // :::::::::::::::::::::::::::::::::

         //UXM-12071 - Tracking type of the previous event because in some cases
         //the replay of the new event is conditioned by the type of the previous.
         gDC.previousEventType = gDC.currentEventType;
         gDC.currentEventType = eventType;
         gDC.logger.logInfo("Starting to replay "+eventType+" [" + (gDC.subscriptNum ? "subscript " + gDC.subscriptNum : "main script") + "] event " + gDC.actEventNum +".");

         //  replay 'navigate' event
         //  --------
         if (eventType == 'navigate') {
            
            gDC.navigateAction(gDC, eventType, eventNode, minMatchScore, findTargetBrowserNode, undefined);

            return;
         
         }

         //  replay 'winopen' event
         //  --------
         if (eventType == 'winopen') {
            try {
               gDC._setWaitType( constants.WAITTYPE_INITIALIZING );

               // WinOpen events are those in which the user opened a new window manually
               // in some way (ctrl-N, File->New Window, etc) and was not a result of web
               // page navigation or web page events.

               gDC.lastMatchScore = null;
               gDC.lastBrowserObj = null;

               // bump our runtime counters
               gDC.userWinOpenEvent="browserwinopen";
               gDC.actionEvents++;

               if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: dispatching winopen event..."); }
               gDC._setWaitType( constants.WAITTYPE_DISPATCHING );
               gDC.restartResponseTimeout();
               gDC.pendingEvent = eventType;
               gDC.thinktimeStart = Date.now();

               // @todo Open new window
               return;

            } catch ( e1 ) {
               throw new Error("Failed to process winopen event: " + e1 );
            }
         }

         //  replay 'winclose' event
         //  --------
         if (eventType == 'winclose') {
            try {
               gDC._setWaitType( constants.WAITTYPE_INITIALIZING );

               // WinClose events are those in which the user closed a window manually
               // in some way (ctrl-shift-W, File->Close Window, etc) and was not a
               // result of web page (scripted) events.

               gDC.lastMatchScore = null;
               gDC.lastBrowserObj = null;

               // bump our runtime counters
               gDC.userWinOpenEvent="browserwinclose";
               gDC.actionEvents++;

               if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: dispatching winclose event..."); }
               gDC._setWaitType( constants.WAITTYPE_DISPATCHING );
               gDC.restartResponseTimeout();
               gDC.pendingEvent = eventType;
               gDC.thinktimeStart = Date.now();

               // @todo Close window
               return;

            } catch ( e2 ) {
               throw new Error("Failed to process winclose event: " + e2 );
            }
         }

         //  replay 'tabopen' event
         //  --------
         if (eventType == 'tabopen') {
            try {
               gDC._setWaitType( constants.WAITTYPE_INITIALIZING );

               // TabOpen events are those in which the user opened a new tab manually
               // in some way (ctrl-T, File->New Tab, etc) and was not a result of web
               // page navigation or web page events.


               // bump our runtime counters
               gDC.userTabOpenEvent="browsertabopen";
               gDC.actionEvents++;

               if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: dispatching tabopen event..."); }
               gDC._setWaitType( constants.WAITTYPE_DISPATCHING );
               gDC.restartResponseTimeout();
               gDC.pendingEvent = eventType;
               gDC.thinktimeStart = Date.now();

               //UXM-11389 - Support for Firefox Quantum
               if ( gDC._isFirefox ) { 
                  chrome.tabs.create({active:true}); //Not required URL, will open a "New Tab" by default.
               } else {
                  chrome.tabs.create({url : "chrome://newtab", active:true});
               }
               
               return;

            } catch ( e3 ) {
               throw new Error("Failed to process tabopen event: " + e3 );
            }
         }

         //  replay 'tabclose' or 'tabfocus' event
         //  --------
         if (eventType == 'tabclose' || eventType == 'tabfocus' ) {
            try {
               gDC._setWaitType( constants.WAITTYPE_INITIALIZING );

               gDC.tabSearchAction(gDC, eventType, eventNode, minMatchScore, findTargetBrowserNode, undefined, undefined);

               return;

            } catch ( e4 ) {
               throw new Error("Failed to process "+eventType +" event: " + e4 );
            }
         }

         // ::::::::::::::::::::::::::::::::::
         // ::: BEGIN WEB PAGE EVENT TYPES :::
         // ::::::::::::::::::::::::::::::::::

         //  replay event within user document.
         //  --------
         if (eventType == 'mousedown' || eventType == 'click' || eventType == 'move' || eventType == 'drag' || eventType == 'focus' ||
               eventType == 'change' || eventType == 'submit' || eventType == 'hover' || eventType == 'keyboard' ) {
            gDC._setWaitType( constants.WAITTYPE_INITIALIZING );
            gDC.actionEvents++;

            // Initiate asynchronous search for the target node for this event.
            gDC.lastTargetSearchId = gDC.findTargetElement(eventNode,
               minMatchScore,
               gDC.dispatchEventToDocument.bind(gDC));
            return;
         }

         //  unrecognized replay command - just log a warning
         //  --------
         gDC.handleReplayWarning( "dcWarning_unknownevent", true );
         gDC.restartReplayTimeout();
         gDC._setWaitType( constants.WAITTYPE_PROCESSING );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"replayNextEvent" );
      }

   },  // end of replayNextEvent

   /**
    * UXM-11559 - New function to manage the replay of tab focus or close events.
    * 
    * In the past we were just using the "findTargetBrowserNode" function to try to find the tab, now we are using
    * that function JUST if we cannot find the tab just by searching existing tabs by URL and/or Title.
    * 
    * This new approach uses chrome.tabs.query to search tabs by the title and/or url and then execute the corresponding
    * close or focus.
    * 
    * If chrome.tabs.query doesn't return the expected result (just one possible tab) this function calls the 
    * legacy code and tries to find the tab using "findTargetBrowserNode"
    * 
    * NOTE: This improvement will be very effective at server side, at client side it could be less efective
    * as the user could have multiple tabs with the same title and/or URL.
    * 
    * @param {*} gDC 
    * @param {*} eventType 
    * @param {*} eventNode 
    * @param {*} minMatchScore 
    * @param {*} findTargetBrowserNode 
    * @param {*} tabSearchAlternatives 
    * @param {*} tabs 
    */
   tabSearchAction : function ( gDC, eventType, eventNode, minMatchScore, findTargetBrowserNode, tabSearchAlternatives, tabs ) {
      try {
         

         //This is a recursive function. The first time we call it we have to build the list of search alternatives.
         if ( ! tabSearchAlternatives ) {
            tabSearchAlternatives = [];
            try {
               let targets = gDC._script.processXPath(eventNode, 'child::targets/target');
               if ( ! targets || (targets.length !== 1) || 
                     targets[0].getAttribute('type') !== 'document' ) {
                  gDC.logger.logWarning(eventType+" - We couldn't find document target to be searched. We will use the legacy approach.");
               } else {
                  let crumbs = gDC._script.processXPath(targets[0], 'child::breadcrumbs/crumb');
   
                  //Let's get the latest crumb, with the tab title and url
                  if ( ! crumbs || (crumbs.length == 0 ) ) {
                     gDC.logger.logWarning(eventType+" - We cannot find document crumbs to be searched. We will use the legacy approach.");
                  } else {
                     let titleAttr = gDC._script.processXPath(crumbs[0], 'child::attributes/attrib[@name="title"]');
                     let title;
                     if ( titleAttr && titleAttr.length == 1 ) {
                        title = titleAttr[0].textContent;
                        tabSearchAlternatives.push({"title": title});
                     }
                     let urlAttr = gDC._script.processXPath(crumbs[0], 'child::attributes/attrib[@name="urldocument"]');
                     let url;
                     if ( urlAttr && urlAttr.length == 1 ) {
                        url = urlAttr[0].textContent;
                        tabSearchAlternatives.push({"url": url});
                     }

                     if ( url && title ) {
                        tabSearchAlternatives.push({"url": url, "title": title});
                     }

                     gDC.logger.logInfo(eventType+" - Prepared tab search options ["+tabSearchAlternatives.length+"]");
                  }
               }
   
            } catch( e ) {
               gDC.logger.logWarning(eventType+" - Error trying to prepare the tab search options: "+e);
            }
         } 
         
         /*
          * If this is the first iteration or in the previous call to chrome.tabs.query we didn't find 
          * just one tab matching the search criteria, we have to try again (if there are search alternatives remaining)
          */
         if ( ( ! tabs || tabs.length == 0 || tabs.length > 1 ) && tabSearchAlternatives && tabSearchAlternatives.length > 0 ) {
            let searchOption = tabSearchAlternatives.pop();

            let searchOptionStr = "N/A";
            try {
               searchOptionStr = JSON.stringify(searchOption);
            } catch(e) { 
               // Do nothing it is just for log
            }
            gDC.logger.logInfo(eventType+" - Trying to find tab using the following criteria: "+searchOptionStr);
            
            chrome.tabs.query(searchOption, 
               gDC.tabSearchAction.bind(this, gDC, eventType, eventNode, minMatchScore, findTargetBrowserNode, tabSearchAlternatives)
            );
            return;
         }

         // TabFocus events are those in which the user caused focus to be shifted
         // to a different browser tab in some way (clicking, cycling list of tabs,
         // an event from another extension, etc).

         gDC.lastMatchScore = null;
         gDC.lastBrowserObj = null;

         var tabId = -1;
         if ( tabs && tabs.length == 1 ) {
            gDC.logger.logInfo(eventType+" - Found tab. [ID="+tabs[0].id+"]");
            tabId = tabs[0].id;

            //UXM-11559 - "findTargetBrowserNode" function takes care of updating lastBrowserObj,
            // so, for the new approach to find the tab, we have to include also the 
            // feature of updating that variable.
            // 1) First we try to using an existing tracked browser
            var browserObj;
            if ( this.browsersTracked && this.browsersTracked.length > 0 ) {
               for( let i=0; i<this.browsersTracked.length; i++ ) {
                  if ( this.browsersTracked[i].tabId == tabId ) {
                     browserObj = this.browsersTracked[i];
                     gDC.logger.logInfo(eventType+" - Updating last browser info from already tracked data [ID="+tabs[0].id+"]");
                     break;
                  }
               }
            } 
            // 2) If we haven't found it already tracked, let's create a new one.
            if ( ! browserObj ) {
               browserObj = gDC.trackNewBrowser( tabId, tabs[0].windowId, 'tabpanel', tabs[0] );
               gDC.logger.logWarning(eventType+" - Tab not found at already tracked browser info. Updating last browser info from Chrome tab info [ID="+tabs[0].id+"]");
            }

            gDC.lastMatchScore = 1; //If we found the tab. The score is 1, max score :) 
            gDC.lastBrowserObj = browserObj;
         } else {
            if ( tabs && tabs.length > 1 ) {
               gDC.logger.logInfo(eventType+" - Too many tabs found using chrome.tabs.query. Using legacy approach to search tabs as we cannot determine which one to use.");
            } else {
               gDC.logger.logInfo(eventType+" - No tabs found using chrome.tabs.query. Using legacy approach to search tabs.");
            }
            // get our target browser
            var browserNode = findTargetBrowserNode( eventNode, minMatchScore );
            if (!browserNode) { return; }  // exit quietly, user already alerted
            tabId = browserNode.tabId;
         }
         
         // bump our runtime counters
         gDC.actionEvents++;

         if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: dispatching "+eventType+" event..."); }
         gDC._setWaitType( constants.WAITTYPE_DISPATCHING );
         gDC.restartResponseTimeout();
         gDC.pendingEvent = eventType;
         gDC.thinktimeStart = Date.now();

         if ( eventType == 'tabfocus' && tabId >= 0 ) {
            gDC.userTabFocusEvent = "browsertabfocus";
            
            //UXM-12071 - If the tab is already active we should force the "onTabActivated" function
            // execution to be sure that the replay continues.
            chrome.tabs.get(tabId, function(tabGetResult) {
               if (tabGetResult) {
                  if ( tabGetResult.active ) {
                     gDC.logger.logInfo(eventType+" - The requested tab is ALREADY ACTIVE. [ID="+tabId+"]. Emulating 'onTabActivated' call.");
                     gDC.onTabActivated( tabGetResult, tabGetResult );
                  } else {
                     gDC.logger.logInfo(eventType+" - Confirmed that selected tab is NOT active yet. Updating it! [ID="+tabId+"]");
                     chrome.tabs.update(tabId, {active : true, highlighted : true});
                  }
               } else {
                  gDC.logger.logInfo("Replay failure at Tab Search action. Unable to find Tab in chrome! ["+eventType+"]");
                  gDC.handleReplayFailure('dcFailure_targetnotfound', null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
               }
            });
         } else if (eventType == 'tabclose' && tabId >= 0 ) {
            gDC.userTabOpenEvent="browsertabclose"; 
            chrome.tabs.remove(tabId);
         } else if ( eventType == 'tabfocus' || eventType == 'tabclose' ) {
            gDC.logger.logInfo("Replay failure at Tab Focus action. Invalid Tab ID! ["+tabId+"]");
            gDC.handleReplayFailure('dcFailure_targetnotfound', null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
         } else {
            gDC.logger.logException("Unknown tab event! "+eventType);
            gDC.handleReplayWarning( "dcWarning_unknownevent", true );
            gDC.restartReplayTimeout();
            gDC._setWaitType( constants.WAITTYPE_PROCESSING );
         }  
      } catch(e) {
         gDC.logger.logException("Unexpected error at tabSearchAction: "+e);
      }
   },

   /**
    * UXM-11607 - Migrated the navigate actions to an separate function
    * so we can use promises to get the navigation URL if it is calculated based
    * on a JavaScript validation.
    * 
    * @param {*} gDC 
    * @param {*} eventType 
    * @param {*} eventNode 
    * @param {*} minMatchScore 
    * @param {*} findTargetBrowserNode 
    * @param {*} requestedURL 
    */
   navigateAction : function ( gDC, eventType, eventNode, minMatchScore, findTargetBrowserNode, requestedURL, error )
   {
      try {
         gDC._setWaitType( constants.WAITTYPE_INITIALIZING );

         // Navigation events are those in which the user navigated directly to a
         // URL by affecting the browser location bar in some way (typing an address
         // and pressing Enter or clicking Go, clicking on the URL history, dragging &
         // dropping a link, selecting a bookmark, etc).  Its possible that a single
         // navigation event might trigger multiple page loads prior to showing the
         // final URL, due to HTTP 301/302 redirects, HTML meta refreshes, or via HTML
         // javascripted location changes.  That's why the originally requested URL
         // must be used to replay the event, so that the browser can do its thing
         // and re-trigger the same page load sequence.  Note, some navigation events
         // may also be triggered by embedded objects which also change the URL bar.

         // retrieve all the event parameters we are interested in
         if ( typeof requestedURL === 'undefined' && typeof error === 'undefined' ) {
            gDC.retrieveEventParamValue(eventNode, "urlrequested", gDC.navigateAction.bind(this, gDC, eventType, eventNode, minMatchScore, findTargetBrowserNode ));
            return;
         //if we got a null value we should return
         } else if ( error && error instanceof Error ) {
            gDC.logger.logInfo("Replay failure at navigate action. Unexpected error: "+error);
            gDC.handleReplayFailure( "dcFailure_populateScriptVar", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
         }
         
         /* TODO - Check the result of requestedURL!
         if (strReturn == null) {         
            gDC.logger.logWarning(gDC.DCMODULE+"retrieveEventParamValue: invalid value of script variable '" + varInfo.varName + "'");
            gDC.handleReplayFailure( "dcFailure_populateScriptVar", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
         }*/
//
         var finalizedURL = gDC._script.domTreeGetEventParam(eventNode, "urlfinalized");
         gDC._setBaseDomain(requestedURL, finalizedURL);
         if (requestedURL == null) {
            return;
         }
         
         // UXM-8567 - bugfix - Fail when URL is blank
         if (requestedURL.length == 0 || requestedURL.trim().length == 0) {
            gDC.logger.logInfo("Replay failure at navigate action. Missing URL!");
            gDC.handleReplayFailure("dcFailure_badURL", null, constants.STATUS_SCRIPT_PARSE_ERROR);
            return;
         }
         gDC.lastMatchScore = null;
         
         // get our target browser
         var browserNode = findTargetBrowserNode( eventNode, minMatchScore );
         if (!browserNode) { return; }  // exit quietly, user already alerted
         if (gDC.replayedEvents === 0 && browserNode.url != "about:blank") {
            // For Navigation events, always force-load the about:blank page before
            // our intial page load.  Otherwise, the browser may try to reload the
            // unfinished docs from the last stopped replay (either stopped by the
            // user or by an error) and if network activities didn't finalize, it
            // could corrupt the navigation trail.  Another reason we must preload
            // about:blank is that if the initial URL matches the same one already
            // loaded into the browser's location bar, the browser may not generate
            // a location change event at all.
            gDC.pendingLocations = 0;
            gDC.mutationsRecorded = 0;
            gDC.mutationsRequired = 0;
            gDC.mutationsCount = 0;
            gDC.actEventNum--;
            chrome.tabs.update(
               browserNode.tabId, {url: "about:blank"},
               function () {}
            );

            gDC.pendingActivity = false;
            gDC.pendingLocations = 0;
//                  gDC.restartReadyTimeout();
            return;
         }

         // bump our runtime counters
         // (note: these must appear after above "about:blank" special case
         gDC.userNavigationEvent="navigate";
         gDC.actionEvents++;
         // temporarily stop event replay to help prevent needless processing
         // cycles during time-consuming page loads
         gDC.stopReplayTimeout();

         // dispatch the event (actually, this is more of a direct execution)
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: dispatching navigation event..."); }
         gDC._setWaitType( constants.WAITTYPE_DISPATCHING );
         gDC.restartResponseTimeout();
         gDC.pendingEvent = eventType;
         gDC.thinktimeStart = Date.now();
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: loading navigation URI [" + requestedURL + "] into target browser..."); }

         // In case we got an invalid URL (for example an invalid path) we stop the replay
         // w/ a 96 and NOT a 90
         try {
            chrome.tabs.update(
               browserNode.tabId, {url: requestedURL, 
                  active : true, highlighted : true} //UXM-11251 - Change active window after navigation.
            );
         }
         catch ( exx ) {
            // check if it can be handled by a matching branching rule
            if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_SCRIPT_PARSE_ERROR )) {
               gDC.logger.logInfo("Replay failure at navigate action. Unexpected error: "+exx);
               gDC.handleReplayFailure( "dcFailure_badURL", null, constants.STATUS_SCRIPT_PARSE_ERROR);
            }
         }
         return;

      } catch ( e0 ) {
         throw new Error("Failed to process navigate event:\n" + e0 );
      }
   },
   
   /**
    * @this {!DejaClick.DejaService}
    * @param {!Error} aError The exception.
    * @param {string} aFunction Function in which the exception was caught.
    * @param {string=} aFailure Additional failure message or message name.
    * @param {boolean=} aIsMessageID
    * @param {integer=} aStatusCode
    */
   logException : function( aError, aFunction, aFailure, aIsMessageID, aStatusCode )
   {
      var message;
      try {
         if (++this.exceptionCount > this.DC_OPTVAL_MAXERRORCOUNT) {
            this.logger.logWarning("Maximum number of exceptions encountered - no more exceptions will be logged.");
            return;
         }
         message = (aIsMessageID) ?  gDC._utils.getMessage(aFailure) : aFailure;
         var statusLogID = this.logger.logException(aError, aFunction, message);

         // Alert user of failure and stop replay, if active.
         if ((this.exceptionCount === 1) &&
               ((this._runMode === constants.RUNMODE_REPLAY) ||
                  (this._runMode === constants.RUNMODE_PAUSED))) {
            this.logger.logWarning("Replay failure. Exception happened!");
            this.handleReplayFailure('dcFailure_internalerror', null,
               (((aStatusCode == null) || (aStatusCode === 0)) ? null :
                  aStatusCode),
               statusLogID);

         } else {
            this._setWaitType(constants.WAITTYPE_STOPPED);
            this.setRunMode(constants.RUNMODE_STOPPED);
            this._setRunType(constants.RUNTYPE_STOPABORTED);

            message = (aIsMessageID && aFailure) ? aFailure :
               'dcFailure_internalerror';
            this.alertUserAndRestoreBrowserWindows(message, true, statusLogID);
            if (this.exceptionCount === 1) {
               this._observerService.notifyLocalObservers(
                  'dejaclick:exportResults',
                  {
                     message: message,
                     statusCode: aStatusCode || constants.STATUS_INTERNAL_ERROR,
                     statusLogId: statusLogID
                  });
               this.finalizeState();
            }
         }

      } catch ( e ) {
         this.logger.logException(e, this.DCMODULE + 'logException');
      }
   },

   /**
    * Report an exception that occurred in a content script.
    * @param {string} aMessage Details of the exception.
    * @param {!chrome.Tab} aTab The tab in which the exception occurred.
    * @param {integer} aDocId ID of the document in which the exception
    *    occurred.
    */
   handleExceptionFromDocument: function(aMessage, aTab, aDocId) {
      try {
         gDC.logger.logFailure('Exception in tab ' + aTab.id +
            ', document ' + aDocId + ': ' + aMessage);
         gDC.exceptionCount++;
         if (gDC.isDocumentIdTracked(aDocId)) {
            // Alert user of failure and stop replay, if active.
            if ((gDC.exceptionCount === 1) &&
                  ((gDC._runMode === constants.RUNMODE_REPLAY) ||
                     (gDC._runMode === constants.RUNMODE_PAUSED))) {
               gDC.logger.logWarning("Replay failure. Exception from document!");
               gDC.handleReplayFailure('dcFailure_internalerror', null,
                  null, aMessage);

            } else {
               gDC._setWaitType(constants.WAITTYPE_STOPPED);
               gDC.setRunMode(constants.RUNMODE_STOPPED);
               gDC._setRunType(constants.RUNTYPE_STOPABORTED);

               gDC.alertUserAndRestoreBrowserWindows('dcFailure_internalerror',
                  true, aMessage);
               if (gDC.exceptionCount === 1) {
                  // @todo Export results to file.
                  gDC.finalizeState();
               }
            }
         }
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'handleExceptionFromDocument');
      }
   },

   attachNetworkListeners : function()
   {
      try {

         chrome.webRequest.onBeforeRequest.addListener(gDC.onBeforeRequest, {urls: ["<all_urls>"]}, ["blocking"]);
         chrome.webRequest.onBeforeRedirect.addListener(gDC.onBeforeRedirect, {urls:["<all_urls>"]});
         chrome.webRequest.onBeforeSendHeaders.addListener(gDC.onBeforeSendHeaders, {urls:["<all_urls>"]},
            ["blocking", "requestHeaders"]);
         chrome.webRequest.onCompleted.addListener(gDC.onRequestCompleted, {urls:["<all_urls>"]});
         chrome.webRequest.onHeadersReceived.addListener(gDC.onHeaderReceived, {urls:["<all_urls>"]}, ["responseHeaders"]);
         chrome.webRequest.onErrorOccurred.addListener(gDC.onRequestErrorOccurred, {urls:["<all_urls>"]});
         chrome.webRequest.onAuthRequired.addListener(gDC.onAuthRequired, {urls: ["<all_urls>"]}, ["asyncBlocking"]);  

         gDC._isFirefox ? null : chrome.debugger.onDetach.addListener(gDC.onTabDetached.bind(gDC)); // UXM-13398 Only for chrome

         chrome.tabs.onUpdated.addListener(gDC.onTabUpdated);
         chrome.tabs.onCreated.addListener(gDC.onTabPanelAdded);
         chrome.tabs.onRemoved.addListener(gDC.onTabPanelRemoved);
         chrome.tabs.onReplaced.addListener(gDC.onTabReplaced);
         chrome.tabs.onActivated.addListener(gDC.onTabActivated);
/*
         chrome.windows.onCreated.addListener(gDC.onWindowCreated);
         chrome.windows.onRemoved.addListener(gDC.onWindowRemoved);
*/
         chrome.webNavigation.onBeforeNavigate.addListener(gDC.onBeforeNavigate);
         chrome.webNavigation.onCreatedNavigationTarget.addListener(gDC.onCreatedNavigationTarget);
         chrome.webNavigation.onCompleted.addListener(gDC.onCompleted);
         chrome.webNavigation.onErrorOccurred.addListener(gDC.onWebErrorOccurred);
         chrome.webNavigation.onCommitted.addListener(gDC.onNavigateCommitted);
         chrome.webNavigation.onDOMContentLoaded.addListener(gDC.onWebNavigationDOMContentLoaded);

         //UXM-10759 - New feature to monitor downloads.
         chrome.downloads.onCreated.addListener(gDC.onDownloadCreated);
         chrome.downloads.onChanged.addListener(gDC.onDownloadChanged);

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"attachNetworkListeners" );
      }
   },

   attachObservers : function ()
   {
      try {
         gDC._observerService.addObserver("dejaclick:getrunmode", gDC.getRunModeMessage);
         gDC._observerService.addObserver("dejaclick:onunloaded", gDC.onUnloaded);
         gDC._observerService.addObserver("dejaclick:onDOMContentLoaded", gDC.onDOMContentLoaded);
         gDC._observerService.addObserver('dejaclick:exception', gDC.handleExceptionFromDocument);
         gDC._observerService.addObserver("dejaclick:addEvent", gDC.onAddEvent);
         gDC._observerService.addObserver("dejaclick:addEventParams", gDC.onAddEventParams);
         gDC._observerService.addObserver("dejaclick:insertdialogdata", gDC.onAddDialogParams);
         gDC._observerService.addObserver("dejaclick:addKeyPressParams", gDC.onAddKeyPressParams);
         gDC._observerService.addObserver("dejaclick:searchcomplete", gDC.searchComplete);
         gDC._observerService.addObserver("dejaclick:calculatemfavaluecomplete", gDC.calculateMFAvalueComplete);
         gDC._observerService.addObserver("dejaclick:keywordsearchcomplete", gDC.keywordSearchComplete);
         gDC._observerService.addObserver('dejaclick:dispatchComplete', gDC.continuePageEventReplay);
         gDC._observerService.addObserver("dejaclick:dispatchAck", gDC.dispatchAcknowledged);
         gDC._observerService.addObserver("dejaclick:mutationstarted", gDC.onMutationStarted);
         gDC._observerService.addObserver("dejaclick:mutationcomplete", gDC.onMutationComplete);
         gDC._observerService.addObserver("dejaclick:onloaded", gDC.onLoaded);
         gDC._observerService.addObserver('dejaclick:disconnect', gDC.handleDocumentDisconnect);
         gDC._observerService.addObserver('dejaclick:preferences', gDC.updateLogLevel);
         gDC._observerService.addObserver('dejaclick:objectClick', gDC.handleFlashClick);
         gDC._observerService.addObserver('dejaclick:invalidevent', gDC.reportInvalidEvent);
         gDC._observerService.addObserver('dejaclick:clientfailure', gDC.handleClientFailure);
         gDC._observerService.addObserver('dejaclick:replayfailure', gDC.handleReplayFailureFromDocument);
         gDC._observerService.addObserver('dejaclick:recordfailure', gDC.handleRecordMessageFromDocument);
         gDC._observerService.addObserver('dejaclick:validationmode', gDC.handleValidationMode );
         gDC._observerService.addObserver('dejaclick:newUploadedFile', gDC.handleUploadedFile );
         gDC._observerService.addObserver('dejaclick:contentscriptlogtrace', gDC.handleContentScriptLogTrace );
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"attachObservers" );
      }
   },

   //------------------------------------------------
   // teardown all event listeners, or if an object is specified,
   // teardown any listeners matching just the specified object
   // and remove its entry from any listener arrays.
   teardownObservers : function ()
   {
      try {
         gDC._observerService.removeObserver("dejaclick:getrunmode", gDC.getRunModeMessage);
         gDC._observerService.removeObserver("dejaclick:onDOMContentLoaded", gDC.onDOMContentLoaded);
         gDC._observerService.removeObserver("dejaclick:onunloaded", gDC.onUnloaded);
         gDC._observerService.removeObserver('dejaclick:exception', gDC.handleExceptionFromDocument);
         gDC._observerService.removeObserver("dejaclick:addEvent", gDC.onAddEvent);
         gDC._observerService.removeObserver("dejaclick:addEventParams", gDC.onAddEventParams);
         gDC._observerService.removeObserver("dejaclick:addKeyPressParams", gDC.onAddKeyPressParams);
         gDC._observerService.removeObserver("dejaclick:searchcomplete", gDC.searchComplete);
         gDC._observerService.removeObserver("dejaclick:calculatemfavaluecomplete", gDC.calculateMFAvalueComplete);
         gDC._observerService.removeObserver("dejaclick:keywordsearchcomplete", gDC.keywordSearchComplete);
         gDC._observerService.removeObserver("dejaclick:dispatchComplete", gDC.continuePageEventReplay);
         gDC._observerService.removeObserver("dejaclick:dispatchAck", gDC.dispatchAcknowledged);
         gDC._observerService.removeObserver("dejaclick:mutationstarted", gDC.onMutationStarted);
         gDC._observerService.removeObserver("dejaclick:mutationcomplete", gDC.onMutationComplete);
         gDC._observerService.removeObserver("dejaclick:onloaded", gDC.onLoaded);
         gDC._observerService.removeObserver('dejaclick:disconnect', gDC.handleDocumentDisconnect);
         gDC._observerService.removeObserver('dejaclick:preferences', gDC.updateLogLevel);
         gDC._observerService.removeObserver('dejaclick:objectClick', gDC.handleFlashClick);
         gDC._observerService.removeObserver('dejaclick:invalidevent', gDC.reportInvalidEvent);
         gDC._observerService.removeObserver('dejaclick:clientfailure', gDC.handleClientFailure);
         gDC._observerService.removeObserver('dejaclick:replayfailure', gDC.handleReplayFailureFromDocument);
         gDC._observerService.removeObserver('dejaclick:recordfailure', gDC.handleRecordMessageFromDocument);
         gDC._observerService.removeObserver('dejaclick:newUploadedFile', gDC.handleUploadedFile);
         gDC._observerService.removeObserver('dejaclick:contentscriptlogtrace', gDC.handleContentScriptLogTrace );

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"teardownObservers" );
      }
   },

   teardownListeners : function ()
   {
      try {
         chrome.webRequest.onBeforeRequest.removeListener(gDC.onBeforeRequest);
         chrome.webRequest.onBeforeRedirect.removeListener(gDC.onBeforeRedirect);
         chrome.webRequest.onBeforeSendHeaders.removeListener(gDC.onBeforeSendHeaders);
         chrome.webRequest.onHeadersReceived.removeListener(gDC.onHeaderReceived);
         chrome.webRequest.onCompleted.removeListener(gDC.onRequestCompleted);
         chrome.webRequest.onErrorOccurred.removeListener(gDC.onRequestErrorOccurred);
         chrome.webRequest.onAuthRequired.removeListener(gDC.onAuthRequired);
         
         chrome.tabs.onUpdated.removeListener(gDC.onTabUpdated);
         chrome.tabs.onCreated.removeListener(gDC.onTabPanelAdded);
         chrome.tabs.onRemoved.removeListener(gDC.onTabPanelRemoved);
         chrome.tabs.onReplaced.removeListener(gDC.onTabReplaced);
         chrome.tabs.onActivated.removeListener(gDC.onTabActivated);

/*
         chrome.windows.onCreated.removeListener(gDC.onWindowCreated);
         chrome.windows.onRemoved.removeListener(gDC.onWindowRemoved);
*/
         chrome.webNavigation.onBeforeNavigate.removeListener(gDC.onBeforeNavigate);
         chrome.webNavigation.onCreatedNavigationTarget.removeListener(gDC.onCreatedNavigationTarget);
         chrome.webNavigation.onCompleted.removeListener(gDC.onCompleted);
         chrome.webNavigation.onErrorOccurred.removeListener(gDC.onWebErrorOccurred);
         chrome.webNavigation.onCommitted.removeListener(gDC.onNavigateCommitted);
         chrome.webNavigation.onDOMContentLoaded.removeListener(gDC.onWebNavigationDOMContentLoaded);

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"teardownListeners" );
      }
   },

   /**
    * Update the active message and debug options when the corresponding
    * system preference is changed.
    * @param {!{
    *    key: string,
    *    newValue: string,
    *    oldValue: string
    * }} aData
    */
   updateLogLevel: function(aData) {
      var options;
      if ((gDC._runMode === constants.RUNMODE_INACTIVE) ||
            (gDC._runMode === constants.RUNMODE_STOPPED)) {
         if (aData.key === 'DC_OPTID_LOGMESSAGE') {
            options = aData.newValue;
            if (options === '') {
               options = gDC._prefs.getDefault('DC_OPTID_LOGMESSAGE');
            }
            gDC.logger.setMessageOptions(options);
         } else if (aData.key == 'DC_OPTID_LOGDEBUG') {
            options = aData.newValue;
            if (options === '') {
               options = gDC._prefs.getDefault('DC_OPTID_LOGDEBUG');
            }
            gDC.logger.setDebugOptions(options);
         }
      }
   },

   addSearchTargets : function( aParentNode, aDocTarget, aElemTarget )
   {
      gDC._script.setChangesPending();
      var searchTargets = [];

      if (aDocTarget)  { searchTargets.push({ domNode: aDocTarget,  searchType: "document" }); }
      if (aElemTarget) { searchTargets.push({ domNode: aElemTarget, searchType: "element" }); }
      if (!searchTargets.length) { throw new Error("Invalid or missing search targets passed to addSearchTargets."); }

      return gDC.domTreeInsertTargets( aParentNode, searchTargets );
   },

   /**
    * @param {{docURL:string, docTitle:string}} aData
    */
   addDOMSearchTargets : function (aEventNode, aData, aTabId, aTab)
   {
      try {
         var browserIndex = gDC.getBrowserIndex (aTabId);

         var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );

         var docs = lastBrowserLocation.getElementsByTagName("document");
         var fingerprint, breadcrumbs;

         if (docs.length === 0) {
            var lastBrowserDocument = gDC.getLastBrowserElement( browserIndex, "document" );
            fingerprint = gDC._search.createFingerprint(lastBrowserDocument);
            breadcrumbs = gDC._search.leaveBreadcrumbs(lastBrowserDocument);
         }
         else {

            for (var index = 0; index < docs.length; index++) {
               if (docs[index].getAttribute("urldocument") == aData.docURL) {

                  if ("docTitle" in aData) {
                     docs[index].setAttribute("title", aData.docTitle);
                  }
                  fingerprint = gDC._search.createFingerprint(docs[index]);
                  breadcrumbs = gDC._search.leaveBreadcrumbs( docs[index] );
                  break;
               }
            }
         }

         var eventTargetsNode = gDC._script.domTreeInsertNode(aEventNode, "targets", null, false);
         var targetNodeDoc = gDC._script.domTreeInsertNode(eventTargetsNode, "target", null, false);
         targetNodeDoc.setAttribute("type", "document");

         // insert a fingerprint for this target
         if (fingerprint && fingerprint!="1") {
            gDC._script.domTreeInsertNode(targetNodeDoc, "fingerprint", fingerprint, true);
            if (gDC.logger.debugprocess) { gDC.logger.logDebug( "fingerprint for event target inserted" ); }
         }
         if (breadcrumbs && breadcrumbs.length) {
            gDC.domTreeInsertBreadcrumbs( targetNodeDoc, breadcrumbs );
            if (gDC.logger.debugprocess) { gDC.logger.logDebug( "breadcrumbs for event target inserted" ); }
         } else if ( aTab ){
            gDC.logger.logInfo("No breadcrumbs found for a tab event. Adding at least one breacrumb with the tab ID, URL and Title.");
            breadcrumbs = [];
            breadcrumbs.push({});
            breadcrumbs[0].tag = 'document';
            breadcrumbs[0].index = 0;
            breadcrumbs[0].attribs = {};
            if ( aTab.id ) breadcrumbs[0].attribs.tabId = aTab.id;
            if ( aTab.title ) breadcrumbs[0].attribs.title = aTab.title;
            if ( aTab.url ) {
               breadcrumbs[0].attribs.urldocument = aTab.url;
            } else if ( aTab.pendingUrl ) {
               breadcrumbs[0].attribs.urldocument = aTab.pendingUrl;
            }

            let breadcrumbsStr = "N/A";
            try {
               breadcrumbsStr = JSON.stringify(breadcrumbs[0]);
            } catch(e) { /* do nothing */ }
            gDC.logger.logInfo("Breadcrumbs generated for tab: "+breadcrumbsStr);

            gDC.domTreeInsertBreadcrumbs( targetNodeDoc, breadcrumbs );
         }

         if ("targets" in aData) {
            var targetNodeElem = gDC._script.domTreeInsertNode(eventTargetsNode, "target", null, false);
            targetNodeElem.setAttribute("type", "element");
            gDC._script.domTreeInsertNode(targetNodeElem, "fingerprint", aData.targets.fingerprint, true);
            gDC._script.domTreeInsertNode(targetNodeElem, "elementpath", aData.targets.elementpath, true);
            gDC._script.domTreeInsertNode(targetNodeElem, "elementfullxpath", aData.targets.elementfullxpath, true);

            if (aData.targets.breadcrumbs && aData.targets.breadcrumbs.length) {
               gDC.domTreeInsertBreadcrumbs( targetNodeElem, aData.targets.breadcrumbs );
               if (gDC.logger.debugprocess) { gDC.logger.logDebug( "breadcrumbs for event target inserted" ); }
            }
         }
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"addDOMSearchTargets");
      }
   },
   
   onAddDialogParams : function (aData) {
      try {
            var dialogData = aData.data;
            var dialogIter;
            // loop through the set of dialog rules objects and create new dialog subtrees
            for ( dialogIter in dialogData) {
               var dataObj = dialogData[dialogIter];
               var dialogNode = gDC.domTreeInsertDialog( gDC.actEventNode, dataObj.type );
               gDC._script.domTreeAddDialogParam( dialogNode, "action", dataObj.action );
               gDC._script.domTreeAddDialogParam( dialogNode, "repeat", dataObj.repeat );
               if (dataObj.input1!=null)  gDC._script.domTreeAddDialogParam( dialogNode, "input1", dataObj.input1 );
               if (dataObj.input2!=null)  gDC._script.domTreeAddDialogParam( dialogNode, "input2", dataObj.input2 );
               if (dataObj.input3!=null)  gDC._script.domTreeAddDialogParam( dialogNode, "input3", dataObj.input3 );
               if (dataObj.check1!=null)  gDC._script.domTreeAddDialogParam( dialogNode, "check1", dataObj.check1 );
               if (dataObj.option1!=null) gDC._script.domTreeAddDialogParam( dialogNode, "option1", dataObj.option1 );
               if (dataObj.option2!=null) gDC._script.domTreeAddDialogParam( dialogNode, "option2", dataObj.option2 );
               if (dataObj.option3!=null) gDC._script.domTreeAddDialogParam( dialogNode, "option3", dataObj.option3 );
            }

         return;
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onAddDialogParams");
      }
   },
   
   onAddEventParams : function (aData) {
      try {
         var eventNode = gDC.actEventNode;

         if (aData.eventparams && aData.eventparams.param) {
            var params = aData.eventparams.param;
            for (var i = 0; i < params.length; i++) {
               var param = params[i];
               var name = param["@name"];
               var value = String(param["#text"]);
               if (gDC._script.domTreeHasEventParam( gDC.actEventNode, name)) {
                  gDC._script.domTreeSetEventParam( gDC.actEventNode, name, value );
               }
               else {
                  gDC._script.domTreeAddEventParam(gDC.actEventNode, name, value);
               }

            }
         }
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onAddEventParams");
      }
   },
   
   /**
    * Record event inputs captured in a content script.
    * @param {!{
    *    eventparams: {
    *       param: Array.<!Object.<string,string>>
    *    },
    *    attributes: {
    *       attrib: Array.<!Object.<string,string>>
    *    }
    * }} aData Details of the event to be added.
    * @param {!chrome.Tab} aTab The tab in which the event was captured.
    * @param {integer} aDocId Id of the document in which the event occurred.
    */
   onAddKeyPressParams : function (aData, aTab, aDocId) {
      var name, value;
      try {
         if ( gDC.logger.debugactivity ) {
            gDC.logger.logDebug("onAddKeyPressParams [TabId="+aTab.id+"] ");
         }

         if (gDC.eventsCaptured && gDC.eventsCaptured.length === 0) {
            gDC.alertUser("dcService_promptNonURLMessage", true);
            return;
         }

         var eventNode = gDC.actEventNode;
         if (!eventNode) {
            if ( gDC.logger.debugactivity ) {
               gDC.logger.logDebug("onAddKeyPressParams [TabId="+aTab.id+"] - Discarded as there is no active event node.");
            }
            return;
         }

         if (aData.eventparams && aData.eventparams.param) {
            if ( gDC.logger.debugactivity ) {
               gDC.logger.logDebug("onAddKeyPressParams [TabId="+aTab.id+"] - Event params present! "+JSON.stringify(aData.eventparams));
            }
            var params = aData.eventparams.param;
            var keyCodeFound = false;
            for (var i = 0; i < params.length; i++) {
               var param = params[i];
               name = param["@name"];
               value = String(param["#text"]);
               if (name == "keycodes") {
                  keyCodeFound = true;

                  if ((value.indexOf("13") != -1) && !gDC._script.domTreeHasReplayHint(gDC.actEventNode, gDC.DC_NETWORKHINT)) {
                     // Special case: if we are emitting the enter keystroke, but we have not yet
                     // seen any network activity in prior recorded keystrokes, then set a special
                     // flag to prevent assigning the super-slow replay speed to this input event.
                     gDC.skipSpeedAdjust = true;
                  }

                  if (gDC._script.domTreeHasEventParam( gDC.actEventNode, "keycodes")) {
                     var keyCodes = gDC._script.domTreeGetEventParam( gDC.actEventNode, "keycodes" );
                     gDC._script.domTreeSetEventParam( gDC.actEventNode, "keycodes", keyCodes + "|" + value );
                  } else {
                     gDC._script.domTreeAddEventParam( gDC.actEventNode, "keycodes", "" + value );
                  }
               }
               else {
                  if (gDC._script.domTreeHasEventParam( gDC.actEventNode, name)) {
                     gDC._script.domTreeSetEventParam( gDC.actEventNode, name, value );
                  }
                  else {
                     gDC._script.domTreeAddEventParam(eventNode, name, value);
                  }
               }
            }

            // In some scenarios when Ctrl key is pressed, we need to delete the keycode from the
            // DOM since it will no longer be in sync with the recorded input
            if (!keyCodeFound) {
               gDC._script.domTreeDelEventParam(eventNode, "keycodes");
            }
         }

         // attach event attributes
         if (aData.attributes && aData.attributes.attrib) {
            if ( gDC.logger.debugactivity ) {
               gDC.logger.logDebug("onAddKeyPressParams [TabId="+aTab.id+"] - Event attributes present! "+JSON.stringify(aData.attributes));
            }
            var attribs = aData.attributes.attrib;
            for (var j = 0; j < attribs.length; j++) {
               var attrib = attribs[j];
               name = attrib["@name"];
               value = String(attrib["#text"]);
               if (gDC._script.domTreeHasAttribute(eventNode, name)) {
                  gDC._script.domTreeSetAttribute(eventNode, name, value);
               } else {
                  gDC._script.domTreeAddAttribute(eventNode, name, value);
               }
            }
         }

      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onAddKeyPressParams");
      }
   },
   
   /**
    * Record a tab focus event.
    * @param {!{docURL:string, docTitle:string}} aData Details of the event to be added.
    * @param {!chrome.Tab} aTab The tab in which the event was captured.
    * @param {integer} aDocId Id of the document in which the event occurred.
    */
   onAddTabFocus : function (aData, aTab, aDocId) {
      try {
         if (gDC._runMode != constants.RUNMODE_RECORD) {
            return;
         }

         if (gDC.eventsCaptured.length === 0) {
            return;
         }

         if (gDC.userTabOpenEvent != null || gDC.userTabCloseEvent != null) {
            // replaying a tab open or close event will trigger a browser tab
            // focus event, which is not a replayed event, so just ignore it
            gDC.userTabCloseEvent = null;
            gDC.userTabOpenEvent = null;  // reset it
            return;
         }

         // get the index number of the associated browser (must occur before action insert)
         var browserIndex = gDC.getBrowserIndex( aTab.id );

         // track the event for display and replay handling
         if (aTab.id === gDC.lastFocusedBrowserObj.id || (aTab.windowId === gDC.lastFocusedBrowserObj.windowId && aTab.index === gDC.lastFocusedBrowserObj.index)) {
            // don't record a tabfocus event if we are switching back
            // to the same tab as the last recorded one we came from
            return;
         }

         // House-keeping for previous event
         gDC.setReplayHints(false);

         // For a tabfocus event, we always create a new action element since the page has changed
         var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");

         // create a new event element
         var eventNode = gDC.domTreeInsertEvent(gDC.actActionNode, "tabfocus");

         gDC._updateRunState();  // let observers update their recorded event

         gDC.addDOMSearchTargets(eventNode, aData, aTab.id, aTab);

         // add new treeview action and event nodes
         gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
         gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );

         // insert a new navTree event node and attach it to the last active location node for this browser window
         var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
         gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", "tabfocus", ++gDC.navEventNum);
         gDC.eventsCaptured.push( 'tabfocus' );

         gDC.userNavigationEvent = null;
         gDC.actionEvents = 0;
/*
         // send notification that our focused location has changed; this is important,
         // for example, to let the GUI to associate keywords with the correct document.
         gDC._observerService.notifyObservers("dejaclick:locationchg", null );
         gDC._setWaitType( constants.WAITTYPE_LOCATIONCHG );

         gDC.restartStatusTimeout();
         gDC.areWeThereYet();
*/
         gDC.lastFocusedBrowserObj = aTab;
         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onAddTabFocus" );
      }
   },

   /**
    * Record a new event captured in a content script.
    * @param {!{
    *    replayhints: {
    *       hint: Array.<!Object.<string,string>>
    *    },
    *    useMutationHint: boolean,
    *    type: string,
    *    eventparams: {
    *       param: Array.<!Object.<string,string>>
    *    },
    *    attributes: {
    *       attrib: Array.<!Object.<string,string>>
    *    }
    * }} aData Details of the event to be added.
    * @param {!chrome.Tab} aTab The tab in which the event was captured.
    * @param {integer} aDocId Id of the document in which the event occurred.
    */
   onAddEvent : function (aData, aTab, aDocId) {
      var attribs, j, attrib, name, value;
      try {

         if (gDC._runMode != constants.RUNMODE_RECORD) {
            return;
         }

         if (gDC.eventsCaptured && gDC.eventsCaptured.length === 0) {
            gDC.alertUser("dcService_promptNonURLMessage", true);
            return;
         }

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "Adding event ..." ); }

         if (gDC.actEventNode){

            // attach replay hints to the previous event
            if (aData.replayhints && aData.replayhints.hint) {
               attribs = aData.replayhints.hint;
               for (j = 0; j < attribs.length; j++) {
                  attrib = attribs[j];
                  name = attrib["@name"];
                  value = String(attrib["#text"]);
                  gDC._script.domTreeAddReplayHint(gDC.actEventNode, name, value);
               }

               if (aData.useMutationHint !== undefined) {
                  gDC._script.domTreeAddAttribute(gDC.actEventNode, 'usemutationhints', true);
               }
            }
         }

         if (gDC.actEventNode && gDC.actEventNode.getAttribute('type') != 'hover') {
            // take care of some housekeeping for the previous event
            gDC.setReplayHints( false );
         }
         else {
            gDC.setReplayHints (false, true);
         }

         // create a new action element if the current user action has no previous events
         // but only when there is at least one recorded event (see onContentLoaded)
         // or when appending to an existing recording.
         if (gDC.actionEvents === 0) {
            var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");
            // add a new treeview action node
            gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
         }
         gDC.eventsCaptured.push(aData.type);

         // create a new event element
         var eventNode = gDC.domTreeInsertEvent(gDC.actActionNode, aData.type);

         gDC._updateRunState();  // let observers update their recorded event

         var isFileChangeEvent = false;
         // attach event parameters
         if (aData.eventparams && aData.eventparams.param) {
            var params = aData.eventparams.param;
            for (var i = 0; i < params.length; i++) {
               var param = params[i];
               name = param["@name"];
               //UXM-10587 - Detect if it is an input-file event.
               if ( name == "filelistref" ) {
                  isFileChangeEvent = true;
               }
               value = String(param["#text"]);
               var addNode = gDC._script.domTreeAddEventParam(eventNode, name, value);
               try {
                  var itemname = param["@itemname"];
                  var itemval = param["@itemval"];
                  if (itemname !== undefined) {
                     addNode.setAttribute("itemname", itemname);
                  }
                  if(itemval !== undefined) {
                     addNode.setAttribute("itemval", itemval);
                  }
               }
               catch(e0){
               }
            }
         }

         //UXM-10587 - If the event is an input file update, 
         //we have to remove the click to the same xpath (if exists).
         //We don't need the select file popup to be opened on playback.
         var deletedPreviousClick = false;
         if ( isFileChangeEvent ) {
            var inputFullXPath = aData.targets.elementfullxpath;

            var toDelete = null;
            var previousClicks = gDC._domTreeRoot.querySelectorAll("event[type='click']");
            if ( previousClicks && previousClicks.length > 0 ) {
               for( var i=previousClicks.length-1; i>=0; i--) {
                  var fullXpathClick = previousClicks[i].querySelector("elementfullxpath");
                  if ( fullXpathClick && fullXpathClick.textContent == inputFullXPath ) {
                     toDelete = previousClicks[i];
                     break;
                  } 
               }
            }
            
            if ( toDelete ) {
               gDC.logger.logWarning("Removing click to "+inputFullXPath+".");

               //Remove node, and update event numbers at the script.
               let rootNodeForRenumber = //<actions> <action> <event> ... If an event is deleted, we should renumber all the events inside the "actions" node
                     ( toDelete.parentNode && toDelete.parentNode.parentNode ) ? toDelete.parentNode.parentNode : null;
               gDC._script.domTreeRemoveNode(toDelete);
               gDC._script.renumberElements(toDelete.nodeName, rootNodeForRenumber);
               
               //Decrease counters used while recording that were incrased at domTreeInsertEvent
               gDC.actEventNum--;
               gDC.recordedEvents--;
               gDC.actionEvents--;

               deletedPreviousClick = true;
            } else {
               gDC.logger.logWarning("No click to "+inputFullXPath+" found.");
            }
         }

         // attach event attributes
         if (aData.attributes && aData.attributes.attrib) {
            attribs = aData.attributes.attrib;
            for (j = 0; j < attribs.length; j++) {
               attrib = attribs[j];
               name = attrib["@name"];
               value = String(attrib["#text"]);
               if (gDC._script.domTreeHasAttribute(eventNode, name)) {
                  gDC._script.domTreeSetAttribute(eventNode, name, value);
               } else {
                  gDC._script.domTreeAddAttribute(eventNode, name, value);
               }
            }
         }



         gDC.addDOMSearchTargets(eventNode, aData, aTab.id);

         //UXM-10587 - If we have deleted one element, we have to refresh the whole tree view.
         if ( deletedPreviousClick ) {
            gDC.updateTreeViews();
         } else {
            gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );
         }
 

         // insert a new navTree event node and attach it to the last active location node for this browser window
         var browserIndex = gDC.getBrowserIndex (aTab.id);
         var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
         gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", aData.type, ++gDC.navEventNum);
         
         gDC.userNavigationEvent = null;
/*
         // The index is set to -1, when the page is loading. Setting the lastFocusedBrowserObj to the tab in this
         // case would cause issues in determing whether to record the tab focus event. Hence adding a check to only
         // update the tab id in such scenarios.
         if (aTab.index < 0) {
            gDC.lastFocusedBrowserObj.id = aTab.id;
         }
         else {
            gDC.lastFocusedBrowserObj = aTab;
         }
*/
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onAddEvent" );
      }
   },

   /**
    * Handles the upload a file (input file field). Stores the content of the file in the script and also in the local
    * file lists Map, so it can be used in playback.
    * 
    * Feature UXM-10587
    * 
    * @param {object} aFileInfo File list name and also all the file info (name, type and data).
    */
   handleUploadedFile: function (aFileInfo) {
      try{
         //Let's confirm that we have received file info 
         if ( aFileInfo && aFileInfo.name && aFileInfo.data ) {
            var nodeFileLists, nodeFileList, nodeFile;

            gDC.logger.logInfo("Processing file "+aFileInfo.name + "[Type:"+aFileInfo.type+"]");

            // get the existing <filelists> root node, or create a new one
            var listFileLists = gDC._domTreeRoot.getElementsByTagName("filelists");
            if (listFileLists && listFileLists.length > 0) {
               nodeFileLists = listFileLists[0];
            } else {
               nodeFileLists = gDC._script.domTreeInsertNode( gDC._domTreeRoot, "filelists", null );
            }

            //Try to get existing file list
            nodeFileList = gDC._domTreeRoot.querySelector('filelist[name="'+aFileInfo.fileListName+'"]');
            if ( ! nodeFileList ) {
               // create a new <filelist> node
               nodeFileList = gDC._script.domTreeInsertNode( nodeFileLists, "filelist", null );

               // add the name for the new <filelist> node
               nodeFileList.setAttribute('name', aFileInfo.fileListName);
            }

            //Add file
            nodeFile = gDC._script.domTreeInsertNode( nodeFileList, "file", aFileInfo.data );
            nodeFile.setAttribute('name', aFileInfo.name);
            nodeFile.setAttribute('type', aFileInfo.type);
            
            gDC.logger.logInfo("Stored file "+aFileInfo.name);

            //Update the file lists always that we receive a new file.
            gDC.exportAllFileLists();

         } else {
            gDC.logger.logWarning("Received empty file info!");
         }
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'handleUploadedFile');
      }
   },

   /**
    * Handle a click on an embedded object.
    * @param {null} aData Details about the click.
    * @param {!chrome.Tab} aTab The tab in which the event occurred.
    * @param {integer} aDocId Id of the document in which the event occurred.
    */
   handleFlashClick: function (aData, aTab, aDocId) {
      try {
         if (!gDC.warnedForFlashClick &&
               gDC.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') &&
               gDC.getSystemBoolPref('DC_OPTID_WARNEMBEDEDOBJPROMPT')) {
            gDC.warnedForFlashClick = true;

            gDC.pendingPrompt = true;
            gDC._utils.promptService.confirmUser({
               title: 'dcService_promptEmbeddedObjTitle',
               question: 'dcService_promptEmbeddedObjMessage',
               extraText: 'dcService_promptEmbeddedObjPrompt',
               extraValue: true,
               buttons: [ 'dcService_ok' ]
            }, gDC.completeFlashClick.bind(gDC));
         }
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'handleFlashClick');
      }
   },

   /**
    * Process the user response to questions of how to handle recording
    * an interaction with a Flash object.
    * @this {!DejaClick.DejaService}
    * @param {integer} aChoice 0
    * @param {boolean} aAskAgain true if the dialog should be opened
    *    whenever a user first clicks on a Flash element while recording.
    */
   completeFlashClick: function (aChoice, aAskAgain) {
      try {
         this.pendingPrompt = false;
         this.setSystemBoolPref('DC_OPTID_WARNEMBEDEDOBJPROMPT', aAskAgain);
      } catch (ex) {
         this.logException(ex, this.DCMODULE + 'completeFlashClick');
      }
   },

   /**
    * Report to the user that a user event on a pre-existing page will
    * not be recorded.
    * @param {string} aType The type of event that occurred.
    * @param {!chrome.Tab} aTab The tab in which the event occurred.
    * @param {integer} aDocId Id of the document in which the event occurred.
    */
   reportInvalidEvent: function (aType, aTab, aDocId) {
      try {
         if (gDC.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') &&
               gDC.getSystemBoolPref('DC_OPTID_WARNFIRSTEVENTPROMPT') &&
               !gDC.pendingPrompt) {
            gDC.pendingPrompt = true;
            gDC._utils.promptService.confirmUser({
               title: 'dcService_promptInvalidEventTitle',
               question: 'dcService_promptInvalidEventMessage',
               buttons: [ 'dcService_yes', 'dcService_no' ]
            }, gDC.completeReportInvalidEvent.bind(gDC));
         }
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'reportInvalidEvent');
      }
   },

   /**
    * Process the user response to whether to continue warning the user
    * that events on existing pages cannot be recorded.
    * @this {!DejaClick.DejaService}
    * @param {integer} aChoice 0 to continue warning, 1 to stop.
    */
   completeReportInvalidEvent: function (aChoice) {
      try {
         this.pendingPrompt = false;
         this.setSystemBoolPref('DC_OPTID_WARNFIRSTEVENTPROMPT', aChoice === 0);
      } catch (ex) {
         this.logException(ex, gDC.DCMODULE + 'completeReportInvalidEvent');
      }
   },

   /**
    * Handle a failure condition during replay.
    * @param {!{
    *    messageID: string,
    *    statusCode: integer,
    *    statusLogID: integer
    * }} aData Details of the failure.
    */
   handleClientFailure: function (aData) {
      try {
         // this topic delivers notification of an external client failure which
         // should force deja to abort current activities and log a failure.

         // this ensures we have stopped net activity before processing failure
         // use a persistent!!! timer to break any re-entrant deadlocks.
         gDC._setTimeout( function(){
            gDC.handleReplayTimeout( aData.messageID, aData.statusCode, aData.statusLogID, true );
         }, 100, true );
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'handleClientFailure');
      }
   },

   /**
    * Add a keyword validation to an action or event.
    * @this {!DejaClick.DejaService}
    * @param {!Node} aDomNode The action or event to add the keyword to.
    * @param {!{
    *    eventType: string,
    *    selectedText: string,
    *    suggestedText: string
    * }} aData Details of the keyword to be added.
    * @param {?integer} aTabId Identifier of the tab where the keyword is located.
    * @param {?integer} aDocId Identifier of the document where the keyword is located.
    */
   addKeyword : function (aDomNode, aData, aTabId, aDocId) {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "Adding keyword ..." ); }

         if (!aDomNode) { return; }

         var domNode = aDomNode;

         // add a new keyword validation for this DOM node
         var validationsRootNode;
         var nodeList = domNode.getElementsByTagName("validations");
         if (nodeList.length) {
            // XXX convert this to an xpath query
            if (!(domNode.nodeName=="action" && nodeList[0].parentNode.nodeName != "action")) {
               // use the existing 'validations' root node (but if this
               // is an action node, skip any event keyword validations)
               validationsRootNode = nodeList[0];
            }
         }
         if (!validationsRootNode) {
            // create a new 'validations' root element if an exisitng one is not available
            validationsRootNode = domNode.appendChild( domNode.ownerDocument.createElement("validations") );
         }
         var validationNode = validationsRootNode.appendChild( validationsRootNode.ownerDocument.createElement("validation") );
         validationNode.setAttribute("type", gDC.VALIDATIONTYPE_KEYWORD);

         // always renumber all validation sequence attributes
         var script = DejaClick.getScript();
         nodeList = script.getScriptElement().getElementsByTagName("validation");
         for (var i=0; i < nodeList.length; i++) {
            nodeList[i].setAttribute('seq',i+1);
         }

         var matchText = aData.selectedText || aData.suggestedText;
         // set matchWord, fixSpaces depending on whether text was selected or suggested
         var matchWord = (aData.selectedText) ? "false" : "true";
         var fixSpaces = (aData.selectedText) ? "false" : "true";
         script.domTreeAddValidateParam( validationNode, "matchtext", matchText );
         script.domTreeAddValidateParam( validationNode, "matchword", matchWord );
         script.domTreeAddValidateParam( validationNode, "fixspaces", fixSpaces );
         script.domTreeAddValidateParam( validationNode, "matchcase", "true" );
         script.domTreeAddValidateParam( validationNode, "allowwrap", "true" );
         script.domTreeAddValidateParam( validationNode, "matchtype", "1" );
         script.domTreeAddValidateParam( validationNode, "errortype", "1" );

         var targetNavDoc;
         if (aTabId && aDocId) {
            // add the target document
            targetNavDoc = gDC.getNavDocumentNode(aTabId, aDocId);
            if (targetNavDoc) {
               gDC.addSearchTargets(validationNode, targetNavDoc, null);
               script.domTreeAddValidateParam( validationNode, "searchtype", "2" );
            }
         }
         if (!targetNavDoc) {
            script.domTreeAddValidateParam( validationNode, "searchtype", "1" );
         }

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"addKeyword" );
      }
   },

   /**
    * Get a navigation tree document node.
    * @this {!DejaClick.DejaService}
    * @param {!integer} aTabId Identifier of the tab that contains the document.
    * @param {!integer} aDocId Identifier of the document.
    */
   getNavDocumentNode : function ( aTabId, aDocId )
   {
      try {
         var navDocNode;

         if (!aTabId || !aDocId) { return null; }

         var browserIndex = gDC.getBrowserIndex (aTabId);
         var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
         var docs = lastBrowserLocation.getElementsByTagName("document");
         for (var index = 0; index < docs.length; index++) {
            if (docs[index].getAttribute("docId") == aDocId) {
               navDocNode = docs[index];
               break;
            }
         }

         if (!navDocNode) {
            navDocNode = gDC.getLastBrowserElement( browserIndex, "document" );
         }

         return navDocNode;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"getNavDocumentNode" );
         return null;
      }
   },

   onBeforeRequest : function(aDetails) {
      var cancel;
      try {
         cancel = false;

         if (gDC.replayShuttingDown || gDC._runMode == constants.RUNMODE_STOPPED || gDC._runMode == constants.RUNMODE_INACTIVE) {
            return {cancel : cancel};
         }
         
         // Insert the URL encountered to the hash array
         if ( aDetails.url && ! String(aDetails.url).startsWith("data") ) { //UXM-10893 - Firefox is returning the data of fonts or images as the URL. Ignoring any URL that begins with "data..."
            gDC._encounteredUrls[aDetails.url] = 1;
         } else {
            gDC.logger.logDebug("Ignoring URL from the list of available URLs for Content Views, as the URL contains data, instead of a valid URL. [Type="+aDetails.type+"][RequestID="+aDetails.requestId+"]");
         }
         
         // Check if we should block...
         var strURL = aDetails.url;
         if (gDC.shouldBlockURL( strURL )) {
            cancel = true;
            return {cancel : cancel};
         }

/*

         // Nope we have to go the full nine yard
         var domWin = null;
         var hasGroupObserver = false;  // catch any errors here checking for groupObserver
         try { hasGroupObserver = (aSubject.loadGroup && aSubject.loadGroup.groupObserver); } catch(ex) {}
         if (hasGroupObserver) {
            domWin = aSubject.loadGroup.groupObserver.DOMWindow;
            // skip this event if its from a DOMwindow we are ignoring
            if (domWin && gDC.shouldIgnoreDOMWindow( domWin )) {
               // Note: for some unknown reason, the loadGroup DOMWindow
               // lookup may behave differently with & without the debugger,
               // probably due to some kind of network timing issue.  If
               // we can't get the info, skip the ignore check.
               return;
            }
         }
*/
         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("onBeforeRequest [" + aDetails.url + "]" + ", Tab " + aDetails.tabId); }
         
         if (gDC.shouldIgnoreURL(aDetails.url)) {
            return {cancel : cancel};
         }
         
         if (gDC.replayShuttingDown) {
               return {cancel : cancel};  // don't record any new network start events when shutting down replay
         }

         // Ignore any requests made from browser/tabs that were opened prior to the recording.
         if (aDetails.tabId < gDC.baseBrowser) {
            return {cancel : cancel};
         }

         gDC.netActivityCount++;

         var  browserObj = gDC.getBrowserObj( aDetails.tabId );
         if (browserObj) {
            browserObj.networkActivity++;
         }

         switch (aDetails.type)
         {
            case "main_frame":
            case "sub_frame":
               if (browserObj) {
                  gDC.handleDocumentStart( aDetails, browserObj );
               }
               break;
            case "xmlhttprequest":
               if (!gDC.actEventNode) { return; }  // exit now if first event node is missing
               gDC.handleXMLRequestStart( aDetails );
               break;
            default:
               gDC.handleNetworkStart();
         }
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onBeforeRequest" );
      }

      return { cancel: cancel };

   },

   onBeforeRedirect : function (aDetails) {
      try {
         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("onBeforeRedirect called for " + aDetails.url + ", tab " + aDetails.tabId); }

         // Ignore any requests made from browser/tab that were opened prior to the recording.
         if (aDetails.tabId < gDC.baseBrowser) {
            return;
         }
         
         if (gDC.shouldIgnoreURL(aDetails.url)) {
            return;
         }
         
         if (gDC.netActivityCount) {
            gDC.netActivityCount--;
         }

         var browserObj = gDC.getBrowserObj( aDetails.tabId );
         if (browserObj) {
            if (browserObj.networkActivity > 0) {browserObj.networkActivity--; }
         }


         switch (aDetails.type) {
            case "main_frame":
            case "sub_frame":
               if (browserObj && browserObj.docsStarted > 0) {
                  browserObj.docsStarted--;
               }
               break;
            case "xmlrequest":
               gDC.pendingXMLRequest = false;
               break;
         }

/*
         if(aDetails.type != "main_frame") {
            return;
         }
         if (gDC._runMode == constants.RUNMODE_RECORD) {

            // do some location timeout housekeeping
            ++gDC.pendingLocations;

//            if (isSameDoc) {
//               if (gDC._script.domTreeGetReplayHint(gDC.actEventNode, gDC.DC_NETWORKHINT)==null) {
                  // Assign the "wait for network activity" attribute to our current event.
                  // This sends a hint to the replay engine to wait for a short timeout period
                  // before processing the next event so anchor tag page transitioning can occur.
//                  gDC.domTreeAddReplayHint(gDC.actEventNode, gDC.DC_NETWORKHINT, 'yes');
//               }

               if (browserObj) {
                  browserObj.contentIsLoaded = true
               }

//               gDC.areWeThereYet();  // restart event replay

//            } else {
//               // do any screen event cleanup here, since we need
               // to be sure we don't do the clean up if we are on
               // the same page but at a different anchor position
//               gDC.deactivateScreenCapture();
//            }


         } else if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {

            // do some location timeout housekeeping
            if (gDC.pendingLocations > 0) {
               --gDC.pendingLocations;
            }
            if (gDC.pendingLocations) {
               gDC.restartLocationTimeout();
            } else {
               gDC.stopLocationTimeout();
            }

            if (browserObj) {
               browserObj.contentIsLoaded = true;
            }
//            gDC.areWeThereYet();
         }
*/
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onBeforeRedirect" );
         return;
      }
   },

   onBeforeSendHeaders : function (aDetails) {
      try {
         // If we have a token to append to the user-agent string, do so now.
         var userAgentAppend = gDC.getSystemStringPref("DC_OPTID_USERAGENTAPPEND");
         if (gDC.simulateMobile && gDC.simulateMobile.useragent) {
            userAgentAppend = gDC.simulateMobile.useragent;
         }
         
         if (userAgentAppend && aDetails.requestHeaders) {
            var headers = aDetails.requestHeaders;
            for (var i = 0; i < headers.length; ++i) {
               if (headers[i].name === 'User-Agent') {
                  // UXM-8958 - Do not append headers if in mobile mode
                  if (gDC.simulateMobile && gDC.simulateMobile.useragent) {
                     headers[i].value = userAgentAppend;
                  } else {
                     headers[i].value += " " + userAgentAppend;
                  }
                  break;
               }
            }
         }
                  
         // We append a Unique ID for every HTTP request while monitoring the transaction
         if (gDC.headerPrefix && aDetails.requestHeaders) {
            if (!gDC.trackingSeq) {
               gDC.trackingSeq = {};
            }
            gDC.trackingSeq[aDetails.url] = gDC.httpCounter;
            var value = gDC.headerPrefix + "." + gDC.resEventNum + "." + gDC.httpCounter + "." + gDC.attempt;
            gDC.httpCounter++;
            aDetails.requestHeaders.push({name : gDC.DC_SMARTBEAR_VERSION_HEADER, value : gDC.DC_SMARTBEAR_VERSION});
            aDetails.requestHeaders.push({name : gDC.DC_APPDYNAMICS_INTEGRATION_HEADER, value : 'true'});
            aDetails.requestHeaders.push({name : gDC.DC_SMARTBEAR_REQUEST_ID_HEADER, value : value});
         }

         // if replay mode and we have custom headers, add them to the http channel
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            if (gDC.customHeaders && gDC.customHeaders.length > 0) {
               gDC.addHeadersToHttpChannel(aDetails);
            }
//            (gDC.userAgent && gDC.userAgent.length > 0))) {
//            gDC.addHeadersToHttpChannel(aDetails);
         }

         return { requestHeaders: aDetails.requestHeaders };
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onBeforeSendHeaders" );
         return;
      }
   },

   onHeaderReceived : function (aDetails) {
      try {
         
         var headers = aDetails.responseHeaders;
         if (headers) {
            for (var i = 0; i < headers.length; ++i) {
               if (headers[i].name === 'Content-Type') {
                  gDC._encounteredMimes[headers[i].value] = 1;
                  break;
               }
            }
         }
         return;
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onHeaderReceived" );
         return;
      }
   
   },
   
   onRequestCompleted : function (aDetails) {
      try {

         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("onRequestCompleted [" + aDetails.url + "]" + ", Tab " + aDetails.tabId); }
       
         // Ignore any requests made from browser/tab that were opened prior to the recording.
         if (aDetails.tabId < gDC.baseBrowser) {
            return;
         }
         
         if (gDC.shouldIgnoreURL(aDetails.url)) {
            return;
         }
       
         if (gDC.netActivityCount) {
            gDC.netActivityCount--;
         }

         var browserObj = gDC.getBrowserObj( aDetails.tabId );
         if (browserObj) {
            if (browserObj.networkActivity > 0) { browserObj.networkActivity--; }
         }

         switch (aDetails.type)
         {
            case "main_frame":
            case "sub_frame":
               gDC.handleDocumentStop( aDetails, browserObj );
               break;
            case "xmlhttprequest":
               gDC.handleXMLRequestStop( aDetails );
               break;
            default:
               gDC.handleNetworkStop();
         }

         if (gDC.isBrowserIdle() && gDC.isNetworkIdle() && !gDC.isBrowserActive()) {
            // Special case: stop the net timer now if our network and
            // browser activity profiles match the above special state
            if (gDC.networkTimeout) { gDC.stopNetworkTimeout(); }
         }

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onRequestCompleted" );
         return;
      }
   },

   onAuthRequired : function (aDetails, aCallback) {
      try {
         if (gDC._runMode != constants.RUNMODE_RECORD && gDC._runMode != constants.RUNMODE_REPLAY) {
            return;
         }
         
         if (gDC._runMode === constants.RUNMODE_RECORD) {
            var args = {
               details: aDetails,
               callback: aCallback
            };
            var message = aDetails.url + " requires a username and password.";
            gDC.authUser(message, false, args);
         }
         else {
            var authUserCreds = {};
            for (var i=0; i < gDC.dialogRules.length; i++) {
               var dataObj = gDC.dialogRules[i];
               if (dataObj.type == 1) {
                  var authUserCredentials = {
                     authCredentials: {
                        username: dataObj.input1, 
                        password: dataObj.input2
                     }
                  };
                  aCallback(authUserCredentials);        
                  //return authUserCredentials;     
               }
            }
         }

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onAuthRequired" );
         return;
      }
   },
   
   onRequestErrorOccurred : function (aDetails) {
      try {
         // This event occurs when we navigate to an invalid URL.
         gDC.onWebErrorOccurred(aDetails);
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onRequestErrorOccurred" );
         return;
      }
   },


   onWebErrorOccurred : function(aDetails) {
      try {
         if (gDC.replayShuttingDown) {
            return;
         }
         if (gDC.logger.debugnetwork) { 
            gDC.logger.logDebug(`webNavigation.onErrorOccurred - onWebErrorOccurred [URL=${aDetails.url}][Tab=${aDetails.tabId}][Type=${aDetails.type}][Error=${aDetails.error}]`); 
         }

         // Ignore any requests made from browser/tab that were opened prior to the recording.
         if (aDetails.tabId < gDC.baseBrowser) {
            return;
         }

         if (gDC.netActivityCount) {
            gDC.netActivityCount--;
         }

         var browserObj = gDC.getBrowserObj( aDetails.tabId );
         if (browserObj && browserObj.networkActivity > 0) {
            browserObj.networkActivity--;
         }

         switch (aDetails.type) {
            case "main_frame":
            case "sub_frame":
               if (browserObj && browserObj.docsStarted > 0) {
                  browserObj.docsStarted--;
               }
               break;
            case "xmlrequest":
               gDC.pendingXMLRequest = false;
               break;
         }

         if (gDC.isBrowserIdle() && gDC.isNetworkIdle() && !gDC.isBrowserActive()) {
            // Special case: stop the net timer now if our network and
            // browser activity profiles match the above special state
            if (gDC.networkTimeout) { gDC.stopNetworkTimeout(); }
         }

         // We are interested in base document errors
         if (aDetails.frameId !== 0 || aDetails.error === "net::ERR_ABORTED" || aDetails.type !== "main_frame") {
            return;
         }

         if (gDC.shouldIgnoreURL(aDetails.url)) {
            return;
         }

         // UXM-13518 - Avoiding sensitive ST1 only on FF
         if(gDC._isFirefox 
            && !gDC.getScriptBoolPref('DC_OPTID_NETWORKWARNING') 
            && (aDetails.error == "NS_ERROR_NET_ON_WAITING_FOR"
            || aDetails.error == "NS_ERROR_NET_INTERRUPT"
            || aDetails.error == "NS_ERROR_NET_TIMEOUT_EXTERNAL"
            || aDetails.error == "NS_ERROR_NET_ON_WAITING_FOR"
            || aDetails.error == "Error code 2152398850"
            || aDetails.error.includes("not match the server’s certificate."))
         ){
            gDC.logger.logWarning(gDC._messageBundle.getMessage("dcWarning_networkError"));
            return;
         }

         var messageID = "dcFailure_genericFailure";

         switch (aDetails.error) {
            case "net::ERR_NAME_NOT_RESOLVED":
               messageID = "dcFailure_dnsNotFound";
               break;
            case "net::ERR_ABORTED":
               messageID = "dcFailure_bindingAborted";
               break;
            case "net::ERR_CONNECTION_ABORTED":
               messageID = "dcFailure_connectionFail";
               break;
            case "net::ERR_CONNECTION_RESET":
               messageID = "dcFailure_netReset";
               break;
            case "net::ERR_CONNECTION_FAILED":
               messageID = "dcFailure_connectionFail";
               break;
            case "net::ERR_FAILED":
               messageID = "dcFailure_connectionFail";
               break;
            case "net::ERR_CONNECTION_REFUSED":
               messageID = "dcFailure_connectionFail";
               break;
            default:
               messageID = "dcFailure_genericFailure";
               break;
         }

         var longMessageID = messageID + "Long";  // output the long-style message to the error log
         var statusLogID, messageLong;
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {

            messageLong = gDC._messageBundle.getMessage( "dcMessage_replayfailure" ) + " event (" + gDC.replayedEvents + ")" +
               " - [" + (gDC.subscriptNum ? "subscript " + gDC.subscriptNum : "main script") + "] event " + gDC.actEventNum +
               " - " + gDC._messageBundle.getMessage( "dcMessage_replayTerminated", false ) +
               gDC._messageBundle.getMessage( longMessageID, true );
            statusLogID = gDC.logger.logFailure( messageLong, false );

            gDC.handleReplayTimeout( messageID,
               constants.STATUS_CONNECTION_FAILURE,
               statusLogID, true);
            return;

         } else if (gDC._runMode == constants.RUNMODE_RECORD) {
            messageLong = gDC._messageBundle.getMessage(longMessageID);
            statusLogID = gDC.logger.logFailure(messageLong);

            //gDC._setRunType( RUNTYPE_STOPLOADED );
            gDC._setTimeout( function(){gDC._setRunType( constants.RUNTYPE_STOPLOADED );}, 1000 );
            gDC.notifyUserAndRestoreBrowserWindows (messageID,  true);

//            gDC.alertUserAndRestoreBrowserWindows( messageID, true, (statusLogID)?statusLogID:false );
            return;
         }
         return;
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onWebErrorOccured" );
      }
   },

   onTabPanelAdded : function(aTab)
   {
      var browserObj, lastBrowserLocation;
      try {
            // return if validation mode is enabled
            if(gDC.validationModeEnabled){
                  return;
            }  

         // Ignore chrome tabs (excluding New Tabs).
         if (gDC.isChromeTab(aTab) && !gDC.isNewTab(aTab)) { return; }

         if ( !aTab.url  && !aTab.pendingUrl &&  !aTab.title) { return; }
/*
         gDC.pendingBrowser = true;
         gDC.stopStatusTimeout();
*/
         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "got an onTabPanelAdded event" ); }

         // get the index number of our last focused browser tab
         var browserIndex = gDC.getBrowserIndex( gDC.lastFocusedBrowserObj.id );

         // get the last navigation document target for this browser, if any,
         // else the docTarget selected will be the navigation browser itself
         var docTarget = gDC.getLastBrowserElement( browserIndex, "document" );
         if (!docTarget) {
            throw new Error("Unable to determine navigation document target node for element target.");
         }

         var tabId = aTab.id;
         var windowId = aTab.windowId;

         var isPendingEventDone = false;

         // :: the following section is only for record/replay of user-created tabs
         if (gDC.isNewTab(aTab)) {
            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               if (!gDC.pendingEvent || gDC.pendingEvent != "tabopen") {
                  if (gDC.logger.debugprocess) { gDC.logger.logDebug( "onTabPanelAdded - no pending tabopen event, ignoring" ); }
                  return;  // event mismatch
               }
//               gDC.stopResponseTimeout();  // reset the event response timeout
               gDC.pendingEvent = null;
               isPendingEventDone = true;
               gDC.logger.logInfo("tabopen - New tab open replayed successfuly [TabID="+tabId+"]");
            }

//            gDC._setWaitType( constants.WAITTYPE_PROCESSING );

            gDC.userTabOpenEvent = "browsertabopen";

            // track the event for display and replay handling
            gDC.eventsCaptured.push( 'tabopen' );

            if (gDC._runMode == constants.RUNMODE_RECORD) {

               // Take care of a little final housekeeping for the previous event
               gDC.setReplayHints( false );

               // always create a new action element since the page has changed
               var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");

               // create a new event element
               var eventNode = gDC.domTreeInsertEvent(gDC.actActionNode, "tabopen");

               gDC._updateRunState();  // let observers update their recorded event

               // insert a new navTree event node and attach it to the last active location node for originating browser window
               lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
               gDC.navEventNode = gDC.domTreeInsertNavElement( lastBrowserLocation, "event", "tabopen", ++gDC.navEventNum );

               // note: this must come after call to domTreeInsertAction
               browserObj = gDC.trackNewBrowser( tabId, windowId, 'tabpanel', aTab );

               gDC.newTabBrowserNode = browserObj.navBrowserNode;

               // get the index number of the newly opened browser
               browserIndex = gDC.getBrowserIndex( tabId, windowId );

               // attach a document search target to this event node
               gDC.addSearchTargets( eventNode, docTarget );

               // add new treeview action and event nodes
               gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
               gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );


            } else {  // RUNMODE_REPLAY or RUNMODE_PAUSED

               if (gDC.mutationsRecorded) {
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               }
               if (gDC.pendingLocations) {
                  gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
               }

               // insert a new navTree event node and attach it to the last active location node for originating browser window
               lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
               gDC.navEventNode = gDC.domTreeInsertNavElement( lastBrowserLocation, "event", "tabopen", ++gDC.navEventNum );

               // give focus to this browser's window now
//               gDC.setBrowserWindowFocus( browserNode );

               browserObj = gDC.trackNewBrowser( tabId, windowId, 'tabpanel', aTab);

               gDC.newTabBrowserNode = browserObj.navBrowserNode;

            }

            gDC.userNavigationEvent = null;
            gDC.actionEvents = 0;

         } else {
            // userTabOpenEvent is null
            browserObj = gDC.trackNewBrowser( tabId, windowId, 'tabpanel', aTab );
            gDC.newTabBrowserNode = browserObj.navBrowserNode;
         }

         if (gDC.userTabOpenEvent != null || aTab.selected 
            || aTab.active ) //UXM-11389 - Support for Firefox Quantum
         {
            gDC.lastFocusedBrowserObj = aTab;
            //UXM-12071 - New tab opened by user should update the lastBrowserObj object.
            if ( browserObj ) {
               gDC.lastBrowserObj = browserObj;
               gDC.logger.logInfo("onTabPanelAdded - Updated current active browser tab information [TabID="+browserObj.tabId+"]");
            }

            if ( isPendingEventDone ) {
               gDC.restartStatusTimeout();
               gDC.areWeThereYet();
            }
         }

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"onTabPanelAdded" );
      }
   },

   /**
    * React to a closed browser tab.
    * @param {integer} aTabId The id of the tab that was removed.
    * @param {!{windowId: integer, isWindowClosing: boolean}} aRemoveInfo
    *    The window to which the tab belonged and whether it was closed too.
    */
   onTabPanelRemoved : function(aTabId, aRemoveInfo) {
      var index, browserIndex;
      try {
            // return if validation mode is enabled
            if(gDC.validationModeEnabled){
                  return;
            } 

         if (gDC.logger.debugprocess) { gDC.logger.logDebug("removing browser tab..."); }

         // Find index of removed tab in browsersTracked array.
         browserIndex = null;
         index = gDC.browsersTracked.length;
         while (index !== 0) {
            --index;
            if (gDC.browsersTracked[index].tabId === aTabId) {
               browserIndex = index;
               break;
            }
         }
         // Ignore non-tracked tabs.
         if (browserIndex == null) {
            return;
         }
         
         if (gDC.m_debuggerAttached[aTabId]) {
            chrome['debugger'].detach({ tabId: aTabId });
            delete gDC.m_debuggerAttached[aTabId];
         }
         var browserNode = aTabId;
/*
         if (gDC.userTabCloseEvent != null) {

            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               if (!gDC.pendingEvent || gDC.pendingEvent != "tabclose") {
                  if (gDC.logger.debugprocess)  gDC.logger.logDebug( "onTabPanelRemoved - no pending tabclose event, ignoring" );
                  return;  // event mismatch
               }
               gDC.stopResponseTimeout();  // reset the event response timeout
               gDC.pendingEvent = null;
            }
*/
            gDC._setWaitType( constants.WAITTYPE_PROCESSING );

            // track the event for display and replay handling
            gDC.eventsCaptured.push( 'tabclose' );

            if (gDC._runMode == constants.RUNMODE_RECORD) {

               // Take care of a little final housekeeping for the previous event
               gDC.setReplayHints( false );

               // always create a new action element since the page has changed
               var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");

               // create a new event element
               var eventNode = gDC.domTreeInsertEvent(gDC.actActionNode, "tabclose");

               gDC._updateRunState();  // let observers update their recorded event

               // get the last navigation document target for this browser, if any,
               // else the docTarget selected will be the navigation browser itself
               var docTarget = gDC.getLastBrowserElement( browserIndex, "document" );
               if (!docTarget) {
                  throw new Error("Unable to determine navigation document target node for element target.");
               }

               // attach a document search target to this event node
               gDC.addSearchTargets( eventNode, docTarget );

               // add new treeview action and event nodes
               gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
               gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );


            } else {  // RUNMODE_REPLAY or RUNMODE_PAUSED

               if (gDC.mutationsRecorded) {
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               }
               if (gDC.pendingLocations) {
                  gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
               }
               // give focus to this browser's window now
//               gDC.setBrowserWindowFocus( browserNode );

            }

            // insert a new navTree event node and attach it to the last active location node for this browser window
            var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
            gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", "tabclose", ++gDC.navEventNum);

            gDC.userNavigationEvent = null;
            gDC.actionEvents = 0;
/*
         }
*/
         gDC.newTabBrowserNode = null;  // reset for next check
         gDC.pendingBrowser = false;  // reset (in case no content was loaded in tab)

         gDC.cleanupClosedBrowser( browserNode );

/*
         if (gDC.userTabCloseEvent != null) {
            //gDC.userTabCloseEvent = null;  // reset it
            gDC.restartStatusTimeout();
            gDC.areWeThereYet();
         } else {
            // reset to prevent creating a new tab focus event
            gDC.userTabFocusEvent = null;
         }
*/
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onTabPanelRemoved" );
         return;
      }
   },

   onTabUpdated : function(aTabId, aChangeInfo, aTab) {
      try {
            // return if validation mode is enabled
            if(gDC.validationModeEnabled){
                  return;
            } 
         // Ignore chrome tabs (excluding New Tabs).
         if (gDC.isChromeTab(aTab) && !gDC.isNewTab(aTab)) { return; }
         
         if (gDC.simulateMobile) {
            gDC.resizeScreen(aTab.id, gDC.simulateMobile.width, gDC.simulateMobile.height, 0, 0, false, true, 1, null );
         }
         
         if (aChangeInfo.status == "complete") {
            var focusedBrowser = gDC.lastFocusedBrowserObj;                       
            if (focusedBrowser.id !== aTab.id && focusedBrowser.windowId === aTab.windowId && focusedBrowser.index === aTab.index) {
               if ( gDC.logger.debugnetwork ) {
                  gDC.logger.logDebug("Called onTabReplaced because of status change for tab "+aTab.id);
               }
               gDC.onTabReplaced(aTab.id, focusedBrowser.id, aTab);
            }
         }
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onTabUpdated" );
         return;
      }
   },

   onTabReplaced : function (aAddedTabId, aRemovedTabId, aTab) {
      try {
            // return if validation mode is enabled
            if(gDC.validationModeEnabled){
                  return;
            } 

         if (!aTab) {
            //UXM-10657 - Commenting out this code as it wasn't working and just generating exceptions.
            //The variable "aTab" doesn't exist inside the anonymous function.
            //So, if aTab is null we are just ignoring this event as it was happening with the invalid code. 
            //I am not removing the code just in case we need to add it back in the future.
            /* 
            chrome.tabs.get(aAddedTabId, function(tab) {
               if (tab) {
                  // Ignore chrome tabs (excluding New Tabs).
                  if (gDC.isChromeTab(tab) && !gDC.isNewTab(tab)) { return; }
                  if (!aTab.url && !aTab.pendingUrl && !aTab.title) { return; }
                  gDC.onTabReplaced( aAddedTabId, aRemovedTabId, tab );
               }
            });
            */
            return;
         }

         if (gDC.m_debuggerAttached[aRemovedTabId]) {
            chrome['debugger'].detach({ tabId: aRemovedTabId });
            delete gDC.m_debuggerAttached[aRemovedTabId];
         }

         if (gDC.simulateMobile) {
            gDC.resizeScreen(aAddedTabId, gDC.simulateMobile.width, gDC.simulateMobile.height, 0, 0, false, true, 1 );
         }
         
         if (gDC.lastFocusedBrowserObj.id === aRemovedTabId) {
            gDC.lastFocusedBrowserObj = aTab;
         }

         for (var i=0; i < gDC.browsersTracked.length; i++) {
            var browserObj = gDC.browsersTracked[i];
            if (browserObj.tabId == aRemovedTabId) {
               browserObj.tabId = aAddedTabId;
               browserObj.browser = aTab;
               for (var j = 0; j < gDC.browsersIgnored.length; j++) {
                  var browserIgnoredObj = gDC.browsersIgnored[j];
                  if (browserIgnoredObj.tabId == aAddedTabId) {
                     browserObj.networkActivity = browserIgnoredObj.networkActivity + browserObj.networkActivity;
                     browserObj.docsRequested = browserIgnoredObj.docsRequested + browserObj.docsRequested;
                     browserObj.docsStarted = browserIgnoredObj.docsStarted + browserObj.docsStarted;
                     browserObj.docsStopped = browserIgnoredObj.docsStopped + browserObj.docsStopped;
                     browserObj.docsLoaded = browserIgnoredObj.docsLoaded + browserObj.docsLoaded;

                     if (browserIgnoredObj.browser === undefined) {
                        browserObj.contentIsLoaded = false;
                     }
                     else {
                        browserObj.contentIsLoaded = (browserIgnoredObj.browser.status == "complete");
                     }
                     gDC.browsersIgnored.splice(j, 1);
                     break;
                  }
               }
               break;
            }
         }
/*
         var dupCount = 0;
         var dupIndex = 0;
         var origdupIndex = 0;
         for (var dup = 0; dup < gDC.browsersTracked.length; dup++) {
            if (gDC.browsersTracked[dup].tabId == aAddedTabId) {
               dupCount++;
               if (dupCount > 1) {
                  origdupIndex
                  break;
               }
               else {
                  origdupIndex = dup;
               }
            }
         }
*/
         for (var docIndex = 0; docIndex < gDC.documentsTracked.length; docIndex++) {
            var doc = gDC.documentsTracked[docIndex];
            if (doc.tabId == aRemovedTabId) {
               doc.tabId = aAddedTabId;
            }
         }


      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onTabReplaced" );
         return;
      }
   },

   onTabDetached : function (aDetachInfo, b){ 
   
      try{
         
         var counts, getVal, aTabId;

         // UXM-13398 - Getting tabId counter from tabDetachCounter (with IIFE)
         (function(gDC, aDetachInfo){
            aTabId = aDetachInfo.tabId;
            getVal = gDC.tabDetachCounter.filter( tab => tab.tabId === aTabId );
            counts = getVal.length !== 0 ? getVal[getVal.length-1].counter : 0;
         })(this, aDetachInfo);

         counts++;
         
         if(gDC._runMode === constants.RUNMODE_REPLAY && counts < constants.MAX_TABATTACH_COUNT){ // UXM-13398 - Only reattach on replay mode.
            
            chrome.debugger.attach( { tabId:aTabId }, '1.0', function(e){ 
               if(chrome.runtime.lastError){
                  gDC.logger.logWarning("The tab "+aTabId+" is already attached");
               }
            });
            
            if(counts === 1){
               gDC.logger.logWarning(gDC._messageBundle.getMessage("dcMessage_extensionWarn"));
               gDC.tabDetachCounter.push( { tabId: aTabId, counter: counts } ); // UXM-13398 - Pushing one object per tab.
            }else{
               getVal[0].counter = counts; // UXM-13398 - Changing the value of counter of the object.
            }

         }else if(gDC._runMode === constants.RUNMODE_REPLAY && counts >= constants.MAX_TABATTACH_COUNT){
            gDC.tabDetachCounter = [];
            gDC.handleReplayFailure("dcMessage_extensionWarn");
         }

      }

      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onTabDetached" );
      }
      
   },

   onTabActivated : function (aActiveInfo, aTab)
   {
      try {
        // return if validation mode is enabled
        if(gDC.validationModeEnabled){
              return;
        }    

         if (!aTab) {
            //UXM-11389, UXM-11401 - Reenabled the code commmented at UXM-10657
            // It seems to be required as in some cases the tab focus events weren't working fine
            // (DejaClick was getting hang waiting on the tab activated to happen)
            chrome.tabs.get(aActiveInfo.tabId, function(tab) {
               if (tab) {
                  // Ignore chrome tabs (excluding New Tabs).
                  if (gDC.isChromeTab(tab) && !gDC.isNewTab(tab)) { return; }
                  if (!tab.url && !tab.pendingUrl && !tab.title) { return; }
                  gDC.onTabActivated( aActiveInfo, tab );
               }
            });
            
            return;
         }

         if (gDC._runMode != constants.RUNMODE_RECORD && gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED) {
            if (gDC.eventsEnabled || gDC._runMode == constants.RUNMODE_SUSPEND) {
               gDC.setRunMode( constants.RUNMODE_RESUME );
               // continue event processing by falling through
            } else {
               if (gDC.logger.debugprocess) { gDC.logger.logDebug( "onTabPanelFocus - invalid runMode (1), ignoring this event" ); }
               return;
            }
         }

         if (gDC._runMode == constants.RUNMODE_RECORD) {
            // Ignore recording tab focus events when we are in the middle of navigation
            if (gDC.userNavigationEvent) {
               return;
            }

            var data = {};
            //UXM-10769 - Add support to Chrome 79 new "pendingUrl" property.
            if ( aTab.url == "" && aTab.pendingUrl != "" ) {
               data.docURL = aTab.pendingUrl;
            } else {
               data.docURL = aTab.url;
            }
            data.docTitle = aTab.title;
            gDC.onAddTabFocus(data, aTab);

         }
         else {  // RUNMODE_REPLAY or RUNMODE_PAUSED
            if (gDC.lastFocusedBrowserObj.id == aActiveInfo.tabId) {
               return;
            }

            // get the index number of the associated browser (must occur before action insert)
            var browserIndex = gDC.getBrowserIndex( aActiveInfo.tabId );
            gDC.lastFocusedBrowserObj = aTab;

            if (gDC.mutationsRecorded) {
               gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
            }
            if (gDC.pendingLocations) {
               gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
            }
            // give focus to this browser's window now
            //gDC.setBrowserWindowFocus( browserNode );

            // insert a new navTree event node and attach it to the last active location node for this browser window
            var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
            gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", "tabfocus", ++gDC.navEventNum);
            gDC.eventsCaptured.push( 'tabfocus' );

            gDC.userNavigationEvent = null;
            gDC.actionEvents = 0;
/*
            // send notification that our focused location has changed; this is important,
            // for example, to let the GUI to associate keywords with the correct document.
            gDC._observerService.notifyObservers( gDC.resEventNode, "dejaclick:locationchg", null );
            gDC._setWaitType( constants.WAITTYPE_LOCATIONCHG );

            gDC.restartStatusTimeout();
*/
            gDC.areWeThereYet();

         }

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onTabActivated" );
      }

   },

   /**
    * Determine whether a tab is a chrome tab (e.g. a dialog window,
    * an extension-created tab/window, or a Chrome Developer Tools window).
    * @this {!DejaClick.DejaService}
    * @param {!chrome.Tab} aTab Details of the tab.
    * @return {boolean} true if the tab is a chrome tab.
    */
   isChromeTab : function (aTab) {
      try {
         // Check for chrome*:// urls.
         
         //UXM-10769 - Add support to Chrome 79 new "pendingUrl" property.
         var url = aTab.url;
         if ( url == "" && aTab.pendingUrl != "" ) {
            url = aTab.pendingUrl;
         }   
         return (url ? (url.match(/^(chrome|view-source)/) != null) : false);
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"isChromeTab" );
      }
      return false;
   },

   /**
    * Determine whether a tab is a New Tab.
    * @this {!DejaClick.DejaService}
    * @param {!chrome.Tab} aTab Details of the tab.
    * @return {boolean} true if the tab is a New Tab.
    */
   isNewTab : function (aTab) {
      try {
         //UXM-10769 - Add support to Chrome 79 new "pendingUrl" property.
         var url = aTab.url;
         if ( url == "" && aTab.pendingUrl != "" ) {
            url = aTab.pendingUrl;
         }
         return ((aTab.title == "New Tab") && gDC.isNewTabURL(url));
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"isNewTab" );
      }
      return false;
   },

   /**
    * Determine whether a URL is a New Tab URL.
    * @this {!DejaClick.DejaService}
    * @param {string} aURL A URL.
    * @return {boolean} true if the URL is a New Tab URL.
    */
   isNewTabURL : function (aURL) {
      // The New Tab URL is chrome://newtab/
      // (but for Chrome v28+ can be chrome-search://local-ntp/local-ntp.html).
      return (aURL == "chrome://newtab/" ||
               aURL == "about:newtab" || //UXM-11389 - Support for Firefox Quantum
               aURL == "chrome-search://local-ntp/local-ntp.html");

   },

   //------------------------------------------------
   onWindowCreated : function( aWindow )
   {
      var windowId, browserIndex;
      try {
         gDC.pendingBrowser = true;
//         gDC.stopStatusTimeout();

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "got an onWindowCreated event" ); }

         // :: the following section is only for record/replay of user-created windows
         var recentWin, browserObj, browserNode;

         if (!aWindow.tabs && aWindow.type == "normal") {

            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               if (!gDC.pendingEvent || gDC.pendingEvent != "winopen") {
                  if (gDC.logger.debugprocess) { gDC.logger.logDebug( "onWindowCreated - no pending winopen event, ignoring" ); }
                  return;  // event mismatch
               }
//               gDC.stopResponseTimeout();  // reset the event response timeout
               gDC.pendingEvent = null;
            }

            gDC._setWaitType( constants.WAITTYPE_PROCESSING );

            gDC.userWinOpenEvent = "browserwinopen";

            // track the event for display and replay handling
            gDC.eventsCaptured.push( 'winopen' );

            windowId = aWindow.id;
            browserObj = {windowId : windowId, tabId : windowId + 1, index : 0};
            gDC.lastFocusedBrowserObj = browserObj;


            if (gDC._runMode == constants.RUNMODE_RECORD) {

               // Take care of a little final housekeeping for the previous event
               gDC.setReplayHints( false );

               // always create a new action element since the page has changed
               var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");

               // create a new event element
               var eventNode = gDC.domTreeInsertEvent(gDC.actActionNode, "winopen");

               gDC._updateRunState();  // let observers update their recorded event

               windowId = aWindow.id;

               browserObj = gDC.initializeBrowser(windowId + 1);

               // get the index number of the associated browser
               browserIndex = browserObj.browserIndex;

               // get the last navigation document target for this browser, if any,
               // else the docTarget selected will be the navigation browser itself
               var docTarget = gDC.getLastBrowserElement( browserIndex, "document" );
               if (!docTarget) {
                  throw new Error("Unable to determine navigation document target node for element target.");
               }

               // attach a document search target to this event node
               gDC.addSearchTargets( eventNode, docTarget );

               // add new treeview action and event nodes
               gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
               gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );

            } else {  // RUNMODE_REPLAY or RUNMODE_PAUSED

               if (gDC.mutationsRecorded) {
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               }
               if (gDC.pendingLocations) {
                  gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
               }

               windowId = aWindow.id;

               browserObj = gDC.initializeBrowser( windowId );

               // get the index number of the associated browser
               browserIndex = browserObj.browserIndex;
/*
               // give focus to this browser's window now
               gDC.setBrowserWindowFocus( browserNode );

               // get the index number of the associated browser
               browserIndex = gDC.getBrowserIndex( browserNode );
*/
            }

            // insert a new navTree event node and attach it to the last active location node for this browser window
            var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
            gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", "winopen", ++gDC.navEventNum);

            gDC.userNavigationEvent = null;
            gDC.actionEvents = 0;
         }
         if (gDC.userWinOpenEvent != null) {
            gDC.userWinOpenEvent = null;  // reset it
//            gDC.restartStatusTimeout();
            gDC.areWeThereYet();
         }


         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"onWindowCreated" );
      }
   },


   //------------------------------------------------
   onWindowRemoved : function( aWindow )
   {
      var browserIndex;
      try {
/*
         gDC.stopStatusTimeout();
*/
         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "got an onWindowRemoved event" ); }

         var windowId = aWindow.id;

         // :: the following section is only for record/replay of user-closed windows
/*
         if (gDC.userWinCloseEvent != null) {

            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               gDC.stopResponseTimeout();  // reset the event response timeout
            }
*/
            gDC._setWaitType( constants.WAITTYPE_PROCESSING );
            gDC.userWinCloseEvent = "browserwinclose";

            // track the event for display and replay handling
            gDC.eventsCaptured.push( 'winclose' );

            if (gDC._runMode == constants.RUNMODE_RECORD) {

               // Take care of a little final housekeeping for the previous event
               gDC.setReplayHints( false );

               // always create a new action element since the page has changed
               var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");

               // create a new event element
               var eventNode = gDC.domTreeInsertEvent(gDC.actActionNode, "winclose");

               gDC._updateRunState();  // let observers update their recorded event

               // get the index number of the associated browser
               browserIndex = gDC.getBrowserFromWindowIndex( windowId );

               // get the last navigation document target for this browser, if any,
               // else the docTarget selected will be the navigation browser itself
               var docTarget = gDC.getLastBrowserElement( browserIndex, "document" );
               if (!docTarget) {
                  throw new Error("Unable to determine navigation document target node for element target.");
               }

               // attach a document search target to this event node
               gDC.addSearchTargets( eventNode, docTarget );

               // add new treeview action and event nodes
               gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
               gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );

            } else {  // RUNMODE_REPLAY or RUNMODE_PAUSED

               if (gDC.mutationsRecorded) {
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               }
               if (gDC.pendingLocations) {
                  gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
               }

               // give focus to this browser's window now
//               gDC.setBrowserWindowFocus( browserNode );

               // get the index number of the associated browser
               browserIndex = gDC.getBrowserFromWindowIndex( windowId );
            }

            // insert a new navTree event node and attach it to the last active location node for this browser window
            var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
            gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", "winclose", ++gDC.navEventNum);

            gDC.userNavigationEvent = null;
            gDC.actionEvents = 0;
//         }

         gDC.newTabBrowserNode = null;  // reset for next check
         gDC.pendingBrowser = false;  // reset (in case no content was loaded in initial tab)

         if (gDC.userWinCloseEvent != null) {
            gDC.userWinCloseEvent = null;  // reset it
//            gDC.restartStatusTimeout();
            gDC.areWeThereYet();
         }

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"onWindowRemoved" );
      }
   },

   onBeforeNavigate : function (aDetails) {
      try {
         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("onBeforeNavigate called for  url="+aDetails.url+", tab="+aDetails.tabId); }


         // We are interested in navigation for base document
         if (aDetails.frameId !== 0) {
            return;
         }

         if (!gDC.requestedURL || gDC.onCompletedReceived) {
            gDC.requestedURL = aDetails.url;
            gDC.storeNavFrames = true;
         }

         gDC.onCompletedReceived = false;

      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onBeforeNavigate" );
         return;
      }
   },

   onCreatedNavigationTarget  : function (aDetails) {
      try {

         // In the event, we accidentally added an user tab added event, when it was a tab created
         // due to a browser navigation we need to delete it.
         if (gDC.actEventNode && (gDC.actEventNode.getAttribute('type') == 'tabopen' || gDC.actEventNode.getAttribute('type') == 'winopen')) {
            if (gDC.actEventNode) { gDC.actActionNode.removeChild( gDC.actEventNode ); }

            // Delete node from nav tree
            var browserIndex = gDC.getBrowserIndex(aDetails.tabId);
            var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "location" );
            if (gDC.navEventNode) { lastBrowserLocation.removeChild( gDC.navEventNode); }

             // remove it from the eventsCaptured array
            gDC.eventsCaptured.pop();
            // decrement counters bumped in domTreeInsertEvent
            gDC.actEventNum--;
            gDC.recordedEvents--;
            gDC.actionEvents--;
            gDC.userTabOpenEvent = null;
            gDC.updateTreeViews();
         }
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onCreatedNavigationTarget" );
         return;
      }
   },

   processNavigation  : function () {
      try {

         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("Starting processNavigation"); }

         var browserObj, browserIndex;

         // retrieve browser index after creating a new browser tracking object
         browserIndex = gDC.getBrowserIndex( gDC.lastFocusedBrowserObj.id );

         if (browserIndex < 0) {
            browserIndex = 0;
         }
         browserObj = gDC.browsersTracked[ browserIndex ];
         if (browserObj == null) {
            throw new Error("Unable to find associated browser object.");
         }

         var type = gDC.userNavigationEvent ? "navigate" : "event";

         if (gDC.userNavigationEvent) {
            if (gDC.logger.debugnetwork) { gDC.logger.logDebug("processNavigation - userNavigationEvent"); }

            var lastBrowserLocation = gDC.getLastBrowserElement( browserIndex, "browser" );
            gDC.navEventNode = gDC.domTreeInsertNavElement(lastBrowserLocation, "event", "navigate", ++gDC.navEventNum);

            // track the event for display and replay handling
            gDC.eventsCaptured.push( 'navigate' );

            // update the event node status count for our observers (GUI)
            if (gDC._runMode == constants.RUNMODE_RECORD) {
               gDC._updateRunState();

            } else if (gDC._runMode == constants.RUNMODE_REPLAY) {
               gDC._setRunType( constants.RUNTYPE_REPLAY );
               gDC.stopResponseTimeout();
               gDC.pendingEvent = null;

            } else if (gDC._runMode == constants.RUNMODE_PAUSED) {
               gDC._setRunType( constants.RUNTYPE_PAUSED );
               gDC.stopResponseTimeout();
               gDC.pendingEvent = null;
               gDC.areWeThereYet();

            }
         }

         // insert a new location node...
         if (gDC.newTabBrowserNode != null) {
            // Special case: if a new browser tab was just opened, we need to attach this new
            // location node to it (needed when 'browse ahead' tabs are loaded in the background)
            browserObj.navLocationNode = gDC.domTreeInsertNavElement(gDC.newTabBrowserNode, "location", type, ++gDC.navLocationNum);
         } else {
            // otherwise, just attach the new location node to the current or new browser's last known event, if any
            var lastBrowserEvent = gDC.getLastBrowserElement( browserIndex, "event" );
            browserObj.navLocationNode = gDC.domTreeInsertNavElement(lastBrowserEvent, "location", type, ++gDC.navLocationNum);
         }


         for (var nodeNum = 0; nodeNum < gDC.navDocumentNodes.length; nodeNum++) {
            var navDocumentNode = gDC.domTreeInsertNavElement(browserObj.navLocationNode, "document", "", ++gDC.navDocumentNum);
            navDocumentNode.setAttribute('urldocument', gDC.navDocumentNodes[nodeNum].urldocument);
            navDocumentNode.setAttribute('title', gDC.navDocumentNodes[nodeNum].title);
            navDocumentNode.setAttribute('type', gDC.navDocumentNodes[nodeNum].type);
            navDocumentNode.setAttribute('tabId', gDC.lastFocusedBrowserObj.id);
            navDocumentNode.setAttribute('docId', gDC.navDocumentNodes[nodeNum].docId);
            var docObj = {};
            docObj.url = gDC.navDocumentNodes[nodeNum].urldocument;
            docObj.title = gDC.navDocumentNodes[nodeNum].title;
            docObj.baseURI = null;
            docObj.navDocNode = navDocumentNode;
            docObj.mutationsCount = 0;
            docObj.docId = gDC.navDocumentNodes[nodeNum].docId;
            gDC.documentsTracked.push( docObj );
         }

         // assign some attributes to the new location node
         browserObj.navLocationNode.setAttribute('urlrequested', gDC.requestedURL);
         browserObj.navLocationNode.setAttribute('urlfinalized', gDC.finalizedURL);

         if (gDC._runMode == constants.RUNMODE_RECORD) {

            // do some location timeout housekeeping
            ++gDC.pendingLocations;

            gDC._setWaitType( constants.WAITTYPE_STOPPED );
            browserObj.contentIsLoaded = true;
/*
               gDC.areWeThereYet();  // restart event replay

            } else {
               // do any screen event cleanup here, since we need
               // to be sure we don't do the clean up if we are on
               // the same page but at a different anchor position
               gDC.deactivateScreenCapture();
            }
*/

         } else if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {

            if (gDC.logger.debugnetwork) { gDC.logger.logDebug("processNavigation - Cleanup of locations and set content to loaded."); }

            //Track location changes as they occur
            if(!!docObj){
               locationChanges.push({
                  url:docObj.url
               });
            }

            // do some location timeout housekeeping
            if (gDC.pendingLocations > 0) {
               --gDC.pendingLocations;
            }
            if (gDC.pendingLocations) {
               gDC.restartLocationTimeout();
            } else {
               gDC.stopLocationTimeout();
            }
            browserObj.contentIsLoaded = true;

            gDC.areWeThereYet();
         }

         gDC._observerService.notifyObservers("dejaclick:reseteventinfo", {eventsCaptured : gDC.eventsCaptured});

         // reset these important counters
         gDC.userNavigationEvent = null;
         gDC.actionEvents = 0;
         gDC.requestedURL = null;
         gDC.finalizedURL = null;
         gDC.newTabBrowserNode  = null;
         gDC.navDocumentNodes = [];
         gDC.storeNavFrames = false;

         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("processNavigation - Generated reseteventinfo event"); }

      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"processNavigation" );
         return;
      }
   },


   /**
    * @param {{
    *    url: string,
    *    title: string,
    *    isFrame: boolean,
    *    isVisible: boolean
    * }} aDetails
    * @param {!chrome.Tab} aTab
    * @param {integer} aDocId
    */
   onDOMContentLoaded : function(aDetails, aTab, aDocId) {
      try {

         if (gDC._runMode != constants.RUNMODE_RECORD && gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED) {
            return;
         }

         if (gDC.logger.debugnetwork) { 
            gDC.logger.logDebug(`onDOMContentLoaded called for url=${aDetails.url}, tab=${aTab.id}, isFrame=${aDetails.isFrame}`); 
         }
         
         // Ignore any content loaded events before the record or replay has started.
         if (!gDC._domTreeRoot) {
            return;
         }
         
         var type = aDetails.isFrame ? "framebody" : "body";

         // insert a new navTree document node and attach it to the last created location node
         var browserObj = gDC.getBrowserObj (aTab.id);

         if (browserObj) {
            browserObj.docsLoaded++;
         }

         if (type == "framebody") {
            if (browserObj.navLocationNode && !gDC.storeNavFrames) {
               // create a new tracking object for the visited document
               var navDocumentNode = gDC.domTreeInsertNavElement(browserObj.navLocationNode, "document", "", ++gDC.navDocumentNum);
               navDocumentNode.setAttribute('urldocument', aDetails.url);
               navDocumentNode.setAttribute('title', aDetails.title);
               navDocumentNode.setAttribute('type', type);
               navDocumentNode.setAttribute('tabId', aTab.id);
               navDocumentNode.setAttribute('docId', aDocId);

               var docObj = {};
               docObj.url = aDetails.url;
               docObj.tabId = aTab.id;
               docObj.baseURI = null;
               docObj.navDocNode = navDocumentNode;
               docObj.mutationsCount = 0;
               docObj.docId = aDocId;
               gDC.documentsTracked.push( docObj );
               gDC._observerService.notifyObservers("dejaclick:reseteventinfo", {eventsCaptured : gDC.eventsCaptured});
            }
            else {
               gDC.navDocumentNodes.push({
                  urldocument: aDetails.url,
                  title: aDetails.title,
                  type: type,
                  docId: aDocId
               });
            }
            return;
         }

         if (!aDetails.isVisible) {
            return;
         }
         
         if (browserObj.navLocationNode && !gDC.storeNavFrames) {
               // create a new tracking object for the visited document
               var navDocumentNode = gDC.domTreeInsertNavElement(browserObj.navLocationNode, "document", "", ++gDC.navDocumentNum);
               navDocumentNode.setAttribute('urldocument', aDetails.url);
               navDocumentNode.setAttribute('title', aDetails.title);
               navDocumentNode.setAttribute('type', type);
               navDocumentNode.setAttribute('tabId', aTab.id);
               navDocumentNode.setAttribute('docId', aDocId);

               var docObj = {};
               docObj.url = aDetails.url;
               docObj.tabId = aTab.id;
               docObj.baseURI = null;
               docObj.navDocNode = navDocumentNode;
               docObj.mutationsCount = 0;
               docObj.docId = aDocId;
               gDC.documentsTracked.push( docObj )
         }
         else {
            // We are interested in navigation commits for base document
            gDC.navDocumentNodes.push({
               urldocument: aDetails.url,
               title: aDetails.title,
               type: type,
               docId: aDocId
            });
         }
         

         var completedUrl = aDetails.url;
         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("onDOMContentLoaded called for  url="+completedUrl+", tab="+aTab.id); }
         if (completedUrl.match(/about:/) || completedUrl.match(/chrome:/)) {

            return;
         }

         if (gDC.lastFocusedBrowserObj.id !== aTab.id && gDC.lastFocusedBrowserObj.windowId === aTab.windowId && gDC.lastFocusedBrowserObj.index === aTab.index) {
            gDC.onTabReplaced(aTab.id, gDC.lastFocusedBrowserObj.id, aTab);
         }
         
         gDC.finalizedURL = completedUrl;
         if (gDC._runMode == constants.RUNMODE_RECORD) {

            // Insert a new action and navigate event element if we detect one or
            // more user-initiated navigation events since our last location change

            // Note: 'browser initiated' navigation events are never inserted, as they
            // are automatically handled by the browser itself when responding to user
            // recorded events, but 'user initiated' navigation events are inserted.

            if (!gDC.requestedURL || gDC.isNewTabURL(gDC.requestedURL)) {
               gDC.requestedURL = gDC.finalizedURL;
            }

            // Get the title of the url that has been navigated to.
            var newlabel = aDetails.title;

            gDC.setReplayHints(false);

            if (gDC.userNavigationEvent) {

               var actionNode = gDC.domTreeInsertAction(gDC.actTreeRoot, "browser");
               var eventNode = gDC.domTreeInsertEvent(actionNode, "navigate");
               gDC._script.domTreeAddEventParam(eventNode, "urlrequested", gDC.requestedURL);
               gDC._script.domTreeAddEventParam(eventNode, "urlfinalized", gDC.finalizedURL);

               var browserIndex = gDC.getBrowserIndex (gDC.lastFocusedBrowserObj.id);
               if (browserIndex  < 0){
                  browserIndex = 0;
               }

               // add the event target DOM structure for the navigation event
               // (if not the first in the main script)
               if (gDC.subscriptNum > 0 || gDC.actEventNum > 1) {

                  // get the last navigation document target for this browser, if any,
                  // else the docTarget selected will be the navigation browser itself
                  var docTarget = gDC.getLastBrowserElement( browserIndex, "document" );
                  if (!docTarget) {
                     throw new Error("Unable to determine navigation document target node for element target.");
                  }
                  // attach a document search target to this event node
                  gDC.addSearchTargets( eventNode, docTarget );
               }

               // add new treeview action and event nodes
               gDC.updateTreeViews( gDC.addTreeViewNode( actionNode, gDC.subscriptNum, true ) );
               gDC.updateTreeViews( gDC.addTreeViewNode( eventNode, gDC.subscriptNum, true ) );

            }
            else {
               // update the urlfinalized param of the current event (if already exists) since our location has changed
               if (gDC.actEventNode && gDC._script.domTreeGetEventParam(gDC.actEventNode, "urlfinalized")) {
                  gDC._script.domTreeSetEventParam(gDC.actEventNode, "urlfinalized", gDC.finalizedURL);
               }
            }
            if (!gDC.actActionNode) {
               return;
            }

            var actionNum = gDC.actActionNode.getAttribute('seq');
            gDC._actionLabel[actionNum] = newlabel;
            if (!newlabel) {
               if (gDC.finalizedURL) {
                  newlabel = gDC.finalizedURL;
               }
            }

            var currActionLabel = gDC._systemBundle.getMessage( "dcTreeview_actionLabel", [actionNum]);
            var label =  (!gDC._actionLabel[actionNum-1] || !gDC._actionLabel[actionNum-1].length) ? currActionLabel : gDC._actionLabel[actionNum-1];
            var eventNode = gDC.actEventNode;
            var eventType = eventNode.getAttribute('type');
            if (eventType == 'navigate') {
               label = newlabel;
            }


            // populate the urlrequested and urlfinalized params of the action (for gui display purposes only)
            if (!gDC._script.domTreeGetAttribute(gDC.actActionNode, "urlrequested")) {
               gDC._script.domTreeAddAttribute(gDC.actActionNode, "urlrequested", gDC.requestedURL);  // stickly, only set once
            }
            if (gDC._script.domTreeGetAttribute(gDC.actActionNode, "urlfinalized")) {
               gDC._script.domTreeSetAttribute(gDC.actActionNode, "urlfinalized", gDC.finalizedURL);
            } else {
               gDC._script.domTreeAddAttribute(gDC.actActionNode, "urlfinalized", gDC.finalizedURL);
            }


            if (!gDC._script.domTreeHasAttribute(gDC.actActionNode, 'description'))
            {
               gDC._script.domTreeAddAttribute(gDC.actActionNode, 'description', label);
            }
            else {
               gDC._script.domTreeSetAttribute(gDC.actActionNode, 'description', label);
            }

            // update the tree view label
            gDC.updateTreeViewNodeLabel( gDC.actActionNode, gDC.subscriptNum, label );
            gDC.processNavigation ();

         }
         else {
//            gDC.processNavigation();
            if (gDC.mutationsRecorded > 0 || gDC.mutationsRequired > 0) {
               gDC._observerService.notifyObservers("dejaclick:mutationconfig", {recorded: gDC.mutationsRecorded, required : gDC.mutationsRequired} );
            }
         }


      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onDOMContentLoaded" );
         return;
      }

   },

   /**
    * Determine whether a document id corresponds to a document that
    * is being tracked.
    * @this {!DejaClick.DejaService}
    * @param {integer} aDocId Identifier used to communicate with a
    *    user document.
    * @return {boolean} true if the identifier matches a tracked document.
    */
   isDocumentIdTracked: function (aDocId) {
      var index = this.documentsTracked.length;
      while (index !== 0) {
         --index;
         if (this.documentsTracked[index].docId === aDocId) {
            return true;
         }
      }
      return false;
   },

   onCompleted : function (aDetails) {
      try {
         // We dont seem to get this event during replay mode after the keyword
         // validation panel is closed. Adding additional hooks to use the onLoaded
         // too in addition to the onCompleted event.
         if (gDC.logger.debugnetwork) { 
            gDC.logger.logDebug(`onNavigateCompleted [URL=${aDetails.url}][Tab=${aDetails.tabId}][frameId=${aDetails.frameId}]`); 
         }

         if (aDetails.frameId === 0) {
            for (var i = 0; i < gDC.documentsTracked.length; i++) {
               if (gDC.documentsTracked[i].baseURI == null) {
                  gDC.documentsTracked[i].baseURI = aDetails.url;
               }
            }


            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               //UXM-12644 - New timeout to generate a fake "onCompleted" event if we do not need to wait for all objects
               gDC._clearTimeout(gDC.onCompletedTimeout);
               gDC.onCompletedTimeout = null;

               //Process navigation event, to mark it as done.
               gDC.processNavigation();
            }

            gDC.onCompletedReceived = true;
         }

      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onCompleted" );
         return;
      }
   },

   onLoaded : function (aDetails) {
   },

   onUnloaded : function (aDetails) {
      try {
         if (gDC.documentsTracked && (gDC._runMode == constants.RUNMODE_RECORD || gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED)) {
            var docObj;
            for (var d=0; d < gDC.documentsTracked.length; d++) {
               docObj = gDC.documentsTracked[d];
               if (docObj && docObj.baseURI == aDetails.url) {
                  if (docObj.navDocNode) {
                     docObj.navDocNode.setAttribute('docunloaded','true');
                  }
               }
            }
         }

      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onUnloaded" );
         return;
      }
   },

   /**
    * Listener for chrome.webNavigation.onDOMContentLoaded event
    * 
    * We use it to get all the tab info to simulate the "onCompleted" event
    * if it doesn't come before the event timeout and the navigation event
    * is not set to "full page" (wait for all the objects to load)
    * 
    * @param {*} aDetails 
    * @returns 
    */
   onWebNavigationDOMContentLoaded : function(aDetails) {
      try {
         if (gDC.logger.debugnetwork) { gDC.logger.logDebug(`onWebNavigationDOMContentLoaded called for url=${aDetails.url}, tab=${aDetails.tabId}, frameId=${aDetails.frameId}`); }
      
         if ( aDetails.frameId === 0 && //Just for the main frame.
            ( gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED ) ) //And on replay mode
         {
            let fullPageMode = gDC.getEventBoolPref('DC_OPTID_FULLPAGEOBJECTS', gDC.actEventNode);
            if ( gDC.eventTimeout !== null &&
                ! fullPageMode ) //If full page is configured for the event we have to wait for onCompleted event.
            {

               //To be sure that we simulate the onCompleted event before the event timeout, the simulation will wait just
               //for the 80% of the remaining event timeout.
               let timeLeft = gDC._getTimeoutRemainingTime( ( gDC.validationTimeout !== null ) ? gDC.validationTimeout : gDC.eventTimeout );
               let sleepTimeToForceProcessNavigation = Math.ceil(timeLeft*0.8);
               if (gDC.logger.debugnetwork) { gDC.logger.logDebug(`onWebNavigationDOMContentLoaded - Starting time out to wait for onComplete event [EventTimeOutRemaining=${timeLeft}ms][onCompletedTimeout=${sleepTimeToForceProcessNavigation}ms][url=${aDetails.url}][tab=${aDetails.tabId}][frameId=${aDetails.frameId}].`); }
               
               //Clear any previous timeout
               if ( gDC.onCompletedTimeout ) gDC._clearTimeout(gDC.onCompletedTimeout);
               
               //Start a new one for the current main frame.
               gDC.onCompletedTimeout = gDC._setTimeout(
                  function(){
                     if ( gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED ) {
                        //Force onCompleted event
                        gDC.logger.logWarning(`onWebNavigationDOMContentLoaded - onCompletedTimeout - Simulating onCompleted event to avoid replay hanging. [url=${aDetails.url}][tab=${aDetails.tabId}][frameId=${aDetails.frameId}]`);
                        //FIXME We should do it just when the option "wait for all page objects" is NOT selected.
                        gDC.onCompleted(aDetails);
                     } else {
                        if (gDC.logger.debugnetwork) { gDC.logger.logDebug(`onWebNavigationDOMContentLoaded - onCompletedTimeout - Skipping. Not in replay mode anymore.`); }
                     }
                  },
                  sleepTimeToForceProcessNavigation
               );
            } else if ( fullPageMode ) {
               if (gDC.logger.debugnetwork) { gDC.logger.logDebug(`onWebNavigationDOMContentLoaded - Fullpage - We need the onCompleted event. Timeout not started. [url=${aDetails.url}][tab=${aDetails.tabId}][frameId=${aDetails.frameId}]`); }
            }
         } else if ( aDetails.frameId !== 0 ) {
            if (gDC.logger.debugnetwork) { gDC.logger.logDebug(`onWebNavigationDOMContentLoaded - Skipping not main frame [url=${aDetails.url}][tab=${aDetails.tabId}][frameId=${aDetails.frameId}]`); }
            return;
         } else {
            if (gDC.logger.debugnetwork) { gDC.logger.logDebug(`onWebNavigationDOMContentLoaded - Skipping not in replay mode [url=${aDetails.url}][tab=${aDetails.tabId}][frameId=${aDetails.frameId}]`); }
            return;
         }
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onWebNavigationDOMContentLoaded" );
      }
   },

   onNavigateCommitted : function(aDetails) {
      try {
         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("onNavigateCommitted called for  url="+aDetails.url+", tab="+aDetails.tabId); }
/*

         var browserIndex = gDC.getBrowserIndex( aDetails.tabId );
         var browserObj = gDC.browsersTracked[ browserIndex ];
         if (browserObj) {
            browserObj.networkActivity++;
         }
*/

         // We are interested in navigation commits for base document
         if (aDetails.frameId !== 0 || gDC._runMode != constants.RUNMODE_RECORD) {
            return;
         }

         if (gDC.isChromeTab(aDetails)) {
            return;
         }
       
         // reset these important counters
         gDC.actionEvents = 0;
         if (aDetails.transitionQualifiers.length) {
            if (gDC.logger.debugnetwork) { gDC.logger.logDebug("   transitionQualifiers="+aDetails.transitionQualifiers.join(',')); }
            if (aDetails.transitionQualifiers.indexOf('forward_back') !== -1) {
               gDC.userNavigationEvent="backfwd-keypress";
            }
            if (aDetails.transitionQualifiers.indexOf('from_address_bar') !== -1) {
               gDC.userNavigationEvent="url-input";
            }
         }
        
         if (gDC.userNavigationEvent) {
            return;
         }

         if (gDC.logger.debugnetwork) { gDC.logger.logDebug("   transitionType="+aDetails.transitionType); }
         var eventName = '';
         switch(aDetails.transitionType) {
            case "start_page":
               gDC.userNavigationEvent="go-command";
               break;
            case "typed": case "auto_bookmark":
               gDC.userNavigationEvent="url-textentered";
               break;
            case "keyword": case "keyword_generated": case "generated":
               gDC.userNavigationEvent="url-input";
               break;
            case "link":
               if (gDC.userNavigationEvent != "url-input") {
                  gDC.userNavigationEvent=null;
                  eventName = "click";
               }
               break;
            case "form_submit":
               gDC.userNavigationEvent=null;
               eventName = "submit";
               break;
            case "reload":
               gDC.userNavigationEvent="url-reload";
               gDC.requestedURL = aDetails.url;
               break;
         }

      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onNavigateCommitted" );
      }
   },


   // create a new tracking object for this browser
   trackNewBrowser: function( aTabId, aWindowId, aType, aBrowser )
   {
      var browserObj;
      try {
         // create a new browser tracking object
         browserObj = {};
         browserObj.tabId = aTabId;
         browserObj.windowId = aWindowId;
         browserObj.contentIsLoaded = true;
         browserObj.networkActivity = 0;
         browserObj.navBrowserNode = null;
         browserObj.navLocationNode = null;
         browserObj.docsRequested = 0;
         browserObj.docsStarted = 0;
         browserObj.docsStopped = 0;
         browserObj.docsLoaded = 0;

         if (aBrowser) {
            browserObj.browser = aBrowser;
         }
         else {
            chrome.tabs.get( browserObj.tabId, function(tab) {
               if (tab) {
                  browserObj.browser = tab;
               }
            });
         }

         gDC.browsersTracked.push( browserObj );
         browserObj.browserIndex = gDC.browsersTracked.length - 1;
         // attach a new navigation tree browser node
         browserObj.navBrowserNode = gDC.domTreeInsertNavElement(gDC._navTreeRoot, 'browser', aType, ++gDC.navBrowserNum);
         browserObj.navBrowserNode.setAttribute('browserindex', browserObj.browserIndex);

         if (gDC.simulateMobile) {
            gDC.startMobileSimulation( aTabId, aBrowser );
         }
      } catch( e ) {
         gDC.logException( e, gDC.DCMODULE+"trackNewBrowser" );
      }

      return browserObj;

   },

   //------------------------------------------------
   initializeBrowser : function( aTabId, aWindowId)
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("initializing new browser object"); }

         var wintype = "tabbrowser";
         // create a new browser tracking object
         var browserObj = gDC.trackNewBrowser( aTabId, aWindowId, wintype );
         return browserObj;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"initializeBrowser" );
         return null;
      }
   },

   /**------------------------------------------------
    * Cleanup bookkeeping of a browser tab that has been closed.
    * @this {!DejaClick.DejaService}
    * @param {integer} aTabId ID of the tab that has been closed.
    */
   cleanupClosedBrowser: function(aTabId) {
      var index, browser, docs;

      if (this.logger.debugprocess) {
         this.logger.logDebug(' cleaning up closed tab ' + aTabId + '...');
      }

      index = this.browsersTracked.length;
      while (index !== 0) {
         --index;
         browser = this.browsersTracked[index];
         if (browser.tabId === aTabId) {
/*
            if (index === 0) {
               this.logger.logWarning('Base browser was closed - aborting record/replay...');
               this.setRunMode(constants.RUNMODE_STOPPED);
            }
*/
            if (this.logger.debugprocess) {
               this.logger.logDebug('  cleaning up closed tracked tab [' +
                  index + ']');
            }
            // Remove array entry.
            this.browsersTracked.splice(index, 1);
            if (browser.navBrowserNode) {
               // Add a 'closed' attrib to the associated navTree browser
               // node and mark all its subdocments with a 'docunloaded'
               // attrib to assist in document filtering during searches.
               browser.navBrowserNode.setAttribute('closed','true');

               docs = browser.navBrowserNode.getElementsByTagName('document');
               index = docs.length;
               while (index !== 0) {
                  --index;
                  docs[index].setAttribute('docunloaded','true');
               }
            }
            break;
         }
      }

      index = this.browsersIgnored.length;
      while (index !== 0) {
         --index;
         if (this.browsersIgnored[index].tabId == aTabId) {
            if (this.logger.debugprocess) {
               this.logger.logDebug('  cleaning up closed ignored browser [' +
                  index + ']');
            }
            // remove array entry
            this.browsersIgnored.splice(index, 1);
            break;
         }
      }
   },

   /**
    * Tracks the downloads on recording and replaying. 
    * 
    * While recording we should detect downloads so we include a download flag in the last event recorded.
    * 
    * During replay we have to monitor that the download finishes properly, so on creating we have to start the timeout to monitor it.
    * 
    * Also, for replay we fail on any unexpected download (when download wasn't detected while recording).
    * 
    * Fuction included with feature UXM-10759.
    *  
    * @param {object} aDownloadItem 
    */
   onDownloadCreated : function (aDownloadItem)
   {
      try {
         if (gDC._runMode != constants.RUNMODE_RECORD && gDC._runMode != constants.RUNMODE_REPLAY) {
            gDC.logger.logDebug("Ignoring download as we are not replaying or recording!");
            return;
         }


         if ( !aDownloadItem ) {
            gDC.logger.logWarning("Missing download info!");
         } else {
            gDC.logger.logDebug("New download detected!!  [ID="+aDownloadItem.id+"][State="+aDownloadItem.state+"][Filename=" + aDownloadItem.filename +"]");

            //On record mode we just add log traces for helping debug. No actions required.
            if ( gDC._runMode == constants.RUNMODE_RECORD ) {
               if (!gDC.actEventNode) {
                  gDC.logger.logDebug("Ignoring download as we don't have active node info");
                  return;
               }

               if (gDC._script.domTreeHasEventParam( gDC.actEventNode, "downloads")) {
                  var count = parseInt(gDC._script.domTreeGetEventParam( gDC.actEventNode, "downloads" ));
                  gDC._script.domTreeSetEventParam( gDC.actEventNode, "downloads", ""+(++count) );
                  gDC.logger.logInfo("[ID="+aDownloadItem.id+"][State="+aDownloadItem.state+"][Filename=" + aDownloadItem.filename +"] Adding one more download to the active node [Count="+count+"]");
                  
               } else {
                  gDC._script.domTreeAddEventParam( gDC.actEventNode, "downloads", "1" );
                  gDC.logger.logInfo("[ID="+aDownloadItem.id+"][State="+aDownloadItem.state+"][Filename=" + aDownloadItem.filename +"] One download added to the current active node");
               }

            //On replay we have to track the downloads.
            } else if ( gDC._runMode == constants.RUNMODE_REPLAY ) {
               if ( gDC.expectedDownloads > 0 ) {
                  //We should track the download to confirm that it finishes correctly
                  gDC.activeDownloads.push(aDownloadItem.id);
                  gDC.expectedDownloads--;

                  var timeOut = gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode);
                  gDC._setTimeout(
                     gDC.onDownloadTimeout.bind(gDC, aDownloadItem.id),
                     timeOut);
                  
                  gDC.logger.logInfo("[ID="+aDownloadItem.id+"][State="+aDownloadItem.state+"][Filename=" + aDownloadItem.filename +"] Added download "+aDownloadItem.id+" to the list of active downloads [TimeOut="+timeOut+"]");
               } else {
                  //UXM-12130 - Let's just ignore non-recorded download events.
                  var message = gDC._messageBundle.getMessage('dcFailure_downloadUnexpected', "");
                  gDC.logger.logWarning(message);
               }
            }
         }
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onDownloadCreated" );
      }

   },

   /**
    * Tracks the downloads updates while recording and replaying. 
    * 
    * While recording we just log the changes on debug log level.
    * 
    * During replay we have to monitor that the download finishes properly.
    * 
    * Fuction included with feature UXM-10759.
    *  
    * @param {object} downloadDelta Object with the information of download changes.
    */
   onDownloadChanged : function (downloadDelta)
   {
      try {
         if (gDC._runMode != constants.RUNMODE_RECORD && gDC._runMode != constants.RUNMODE_REPLAY) {
            gDC.logger.logDebug("Ignoring download change as we are not replaying or recording!");
            return;
         }


         if ( gDC._runMode == constants.RUNMODE_RECORD && gDC.logger.debugprocess ) {
            //Just log change detail. Nothing to be done.
            if ( downloadDelta.filename ) {
               gDC.logger.logDebug("[Download "+downloadDelta.id+"][RECORD] File name changed [Current="+downloadDelta.filename.current+"][Previous="+downloadDelta.filename.previous+"]");
            }

            if ( downloadDelta.state ) {
               gDC.logger.logDebug("[Download "+downloadDelta.id+"][RECORD] Status changed [Current="+downloadDelta.state.current+"][Previous="+downloadDelta.state.previous+"]");
            }

            if ( downloadDelta.error ) {
               gDC.logger.logDebug("[Download "+downloadDelta.id+"][RECORD] Error changed [Current="+downloadDelta.error.current+"][Previous="+downloadDelta.error.previous+"]");
            }

            gDC.logger.logDebug("[Download "+downloadDelta.id+"][RECORD] Change update!");
            
         } else if ( gDC._runMode == constants.RUNMODE_REPLAY ) {
            if ( ! gDC.activeDownloads || gDC.activeDownloads.length == 0 || ! gDC.activeDownloads.includes(downloadDelta.id) ) {
               gDC.logger.logWarning("[Download "+downloadDelta.id+"][REPLAY] Change update for untracked download...");
            } else {
               if ( downloadDelta.filename ) {
                  gDC.logger.logDebug("[Download "+downloadDelta.id+"][REPLAY] File name changed [Current="+downloadDelta.filename.current+"][Previous="+downloadDelta.filename.previous+"]");
               }
   
               if ( downloadDelta.state ) {
                  gDC.logger.logInfo("[Download "+downloadDelta.id+"][REPLAY] Status changed [Current="+downloadDelta.state.current+"][Previous="+downloadDelta.state.previous+"]");
                  if ( downloadDelta.state.current == "complete" ) {
                     gDC.logger.logInfo("[Download "+downloadDelta.id+"][REPLAY] Completed!");
                     gDC.activeDownloads.splice( gDC.activeDownloads.indexOf(downloadDelta.id), 1 );
                  }
               }
   
               if ( downloadDelta.error ) {
                  gDC.logger.logInfo("[Download "+downloadDelta.id+"][REPLAY] Replay failure. Error changed [Current="+downloadDelta.error.current+"][Previous="+downloadDelta.error.previous+"]");
               
                  var message = gDC._messageBundle.getMessage('dcFailure_downloadErrorLong', downloadDelta.error.current);
                  var logId = gDC.logger.logFailure(message);
                  gDC.handleReplayFailure('dcFailure_downloadError', message,
                     constants.STATUS_VALIDATION_FAILURE, logId);
               }

               gDC.logger.logFailure("[Download "+downloadDelta.id+"][REPLAY] Change update!");
            }
         }
         
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onDownloadChanged" );
      }

   },

   /**
    * Manages the timeout on replay for a download event.
    * 
    * If the download already finsihed, it doesn't do anything. 
    * 
    * If it is still in progress we consider the replay as failed.
    * 
    * Fuction included with feature UXM-10759.
    * 
    * @param {integer} aDownloadId 
    */
   onDownloadTimeout: function(aDownloadId) {
      var message, logId;
      try {

         if (gDC._runMode != constants.RUNMODE_REPLAY) {
            gDC.logger.logDebug("Ignoring download timeout as we are not replaying anymore!");
            return;
         }

         //When the timeout is triggered with ID=-1 is the initial timeout waiting for the download to start.
         if ( aDownloadId < 0 && gDC.expectedDownloads > 0 ) {
            gDC.logger.logWarning("At least one download of event didn't started! Considering replay failure! ");
         } else if ( aDownloadId < 0 ) {
            gDC.logger.logInfo("The timeout waiting for the download to start has expired. But the download started. Nothing to do.");
            return;
         
         //Otherwise the timeout was for an especific download.
         } else if (!gDC.activeDownloads || gDC.activeDownloads.length == 0 ||
             ! gDC.activeDownloads.includes(aDownloadId)) {
            // The validation has already completed.
            gDC.logger.logDebug("[Download "+aDownloadId+"][TIMEOUT] Download already completed!")
            return;
         }
         
         gDC.logger.logInfo("Replay failure. Download timeout!");
         message = gDC._messageBundle.getMessage('dcFailure_downloadTimeout', "");
         logId = gDC.logger.logWarning(message);
         gDC.handleReplayFailure('dcFailure_downloadTimeout', message,
            constants.STATUS_VALIDATION_FAILURE, logId);

      } catch (e) {
         gDC.logException(e, gDC.DCMODULE + 'onDownloadTimeout');
      }
   },

   // pre-load any URL exclusion masks.
   loadUrlMasks : function( aDomNode )
   {
      var idx;

      function addUrlToList(aArray, aString)
      {
         try {
            if (aArray && aString && aString.length) {
               var regexURL = new RegExp(aString);
               if (regexURL) {
                  aArray.push(regexURL);
               } else if (gDC.logger.debugurlmask) {
                  gDC.logger.logDebug("ignored invalid URL string: " + aString);
               }
            }

         } catch (e){}
      }

      try {
         // first load up our internal (permanent) urlmasks
         for (idx = 0; idx !== gDC._maskedURLs.length; ++idx) {
            addUrlToList(gDC.urlsIgnored, gDC._maskedURLs[idx]);
         }
         if (gDC.getScriptBoolPref('DC_OPTID_IGNOREOCSPURLS')) {
            addUrlToList(gDC.urlsIgnored, "^http://ocsp\\.");
         }

         // now load up any script-specified urlmasks
         var urlmaskNodes = gDC._search.processXPath(aDomNode, "child::urlmasks/urlmask");
         if (urlmaskNodes.length) {

            var urlmaskNode, urlmaskType, matchText, matchType;
            for (idx = 0; idx !== urlmaskNodes.length; ++idx) {

               urlmaskNode = urlmaskNodes[idx];
               urlmaskType = Number(urlmaskNode.getAttribute("type"));
               matchText = gDC._script.domTreeGetUrlMaskParam( urlmaskNode, "matchtext" );
               matchType = gDC._script.domTreeGetUrlMaskParam( urlmaskNode, "matchtype" );

               // Check the "matchtype" (plain-text/regexp)
               switch (matchType) {

                  case "1": // push the plain-text match string onto the corresponding array
                     switch (urlmaskType) {
                        case 1:
                           gDC.urlsIgnored.push(matchText);
                           break;
                        case 2:
                           gDC.urlsBlocked.push(matchText);
                           break;
                     }
                     break;

                  case "2": // eval the regex match string and push onto the corresponding array
                     // Note: user-supplied regexp strings should not have outer '/' delimiters,
                     // and any special chars used as literals must be escaped by user (e.g., '\[')
                     switch (urlmaskType) {
                        case 1:
                           addUrlToList(gDC.urlsIgnored, matchText);
                           break;
                        case 2:
                           addUrlToList(gDC.urlsBlocked, matchText);
                           break;
                     }
                     break;

                  default: // We don't know what this is, so ignore it
                     continue;
               }
            }

            return true;
         }
      }
      catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "loadUrlMasks" );
      }
      return false;
   },

   /**
    * Pre-load any custom request headers for fast retrieval during replay
    * @param aDomNode - a container to extract custom headers from.
    */
   loadCustomHeaders: function (aDomNode) {
      try {
         var xpath = "child::headers/header",
            headerNodes = gDC._search.processXPath(aDomNode, xpath);

         if (!headerNodes.length) {
            return;  // no custom headers to process
         }

         var headerNode,
            obj;

         if (!gDC.customHeaders) {
            gDC.customHeaders = [];
         }

         for (var i in headerNodes) {
            headerNode = headerNodes[i];
            obj = { // push a new custom header object onto our storage array
               headerType: headerNode.getAttribute("type"),
               headerName: gDC._script.domTreeGetHeaderParam(headerNode, "headername"),
               headerText: gDC._script.domTreeGetHeaderParam(headerNode, "headertext"),
               mergeType: gDC._script.domTreeGetHeaderParam(headerNode, "mergetype")
            };
            gDC.customHeaders.push(obj);
         }
         return;

      } catch (e) {
         gDC.logException(e, gDC.DCMODULE + "loadCustomHeaders");
      }
   },

   /**
    * Pre-load any custom cookies for fast retrieval during replay
    * @param aDomNode - a container to extract custom headers from.
    */
   loadCustomCookies: function (aDomNode) {
      try {
         var xpath = "child::cookies/cookie",
            cookiesNodes = gDC._search.processXPath(aDomNode, xpath);

         if (!cookiesNodes.length) {
            gDC.customCookies = [];
            return;  // no custom cookies to process
         }

         var cookieNode,
            obj;

         if (!gDC.customCookies) {
            gDC.customCookies = [];
         }

         for (var i in cookiesNodes) {
            cookieNode = cookiesNodes[i];
            obj = { // push a new custom header object onto our storage array
               url: gDC._script.domTreeGetHeaderParam(cookieNode, "url"),
               name: gDC._script.domTreeGetHeaderParam(cookieNode, "name"),
               value: gDC._script.domTreeGetHeaderParam(cookieNode, "value")
            };
            gDC.customCookies.push(obj);
         }
         return;

      } catch (e) {
         gDC.logException(e, gDC.DCMODULE + "loadCustomCookies");
      }
   },


   //------------------------------------------------
   // check if the URL is on the urlsIgnored list
   shouldIgnoreURL : function( aURL )
   {
      try {
         var bMatchFound, ignoredURL;
         for (var i=0; i < gDC.urlsIgnored.length; i++) {
            bMatchFound = false;
            ignoredURL = gDC.urlsIgnored[i];

            if (typeof ignoredURL == "string") {
               bMatchFound = (aURL.indexOf(ignoredURL) != -1);
            } else {
               // if param is not a string type, assume its a regex type
               // (typeof in FF2/FF3 sees as "function", FF3.1 uses "object")
               bMatchFound = ignoredURL.test(aURL);
            }

            if (bMatchFound) {
               if (gDC.logger.debugurlmask) { gDC.logger.logDebug("ignored URL: " + aURL); }
               return true;  // yes, ignore it
            }
         }
         // just in case some blocked URLs did slip through, make at least sure we ignore them
         return gDC.shouldBlockURL(aURL);

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"shouldIgnoreURL" );
         return true;
      }
   },
   
   LOGOUT_URL: "accounts/logout?post_logout_redirect_uri=",
   
   alertLogout : function( aDetails )
   {
      try {
         if((aDetails.url.indexOf(gDC.LOGOUT_URL) != -1) && (aDetails.url.indexOf("alertsite.com") != -1)) {
            gDC._utils.restApi.logoff();           
            return true;  // yes, logout url         
         }
         
         return false;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"alertLogout" );
         return true;
      }
   },
   
   //------------------------------------------------
   // check if the URL is on the urlsIgnored list
   shouldBlockURL : function( aURL )
   {
      try {
         var bMatchFound, blockedURL;
         for (var i=0; i < gDC.urlsBlocked.length; i++) {
            bMatchFound = false;
            blockedURL = gDC.urlsBlocked[i];

            if (typeof blockedURL == "string") {
               bMatchFound = (aURL.indexOf(blockedURL) != -1);
            } else {
               // if param is not a string type, assume its a regex type
               // (typeof in FF2/FF3 sees as "function", FF3.1 uses "object")
               bMatchFound = blockedURL.test(aURL);
            }
            if (bMatchFound) {
               if (gDC.logger.debugurlmask) { gDC.logger.logDebug("blocked URL: " + aURL); }
               return true;  // yes, block it
            }
         }
         return false;
      }
      catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "shouldBlockURL" );
      }
      return false;
   },

   /**
    * Turn a branch of the script tree into a content view object.
    * @param aNode A contentview node in the script DOM tree.
    * @return A DejaContentView object or null.
    */
   createContentView : function (aNode) {
      var objView, param, numberListPattern, numberPattern;

      /**
       * Add a filter from the content view definition to the object.
       * @param aFilter A string describing the filter. Details of the
       *    filter are separated by "::".
       */
      function addFilter(aFilter) {
         var details = aFilter.split("::");
         switch (details[0]) {
         case constants.CONTENTVIEW_DEFINITION_CONTAINS:
            if (details.length === 4) {
               if (details[2] === constants.CONTENTVIEW_DEFINITION_PLAINTEXT) {
                  objView.addStringFilter(details[1], (details[3] === constants.CONTENTVIEW_DEFINITION_INCLUDE));
               } else {
                  objView.addRegExpFilter(details[1], (details[3] === constants.CONTENTVIEW_DEFINITION_INCLUDE));
               }
            }
            break;
         case constants.CONTENTVIEW_DEFINITION_REFERENCES:
            if (details.length === 3) {
               objView.addContentViewFilter(details[1], (details[2] === constants.CONTENTVIEW_DEFINITION_INCLUDE));
            }
            break;
         case constants.CONTENTVIEW_DEFINITION_PREDEFINED:
            if (details.length === 5) {
               objView.addRegExpFilter(details[3], (details[4] === constants.CONTENTVIEW_DEFINITION_INCLUDE));
            }
            break;
         }
      }

      try {
         objView = null;

         param = this._script.domTreeGetParam(aNode, "cvname", "contentviewparams");
         if ((param !== null) &&
             (param.length > 0) &&
             (param.indexOf(",") < 0) &&
             (param.indexOf(constants.CONTENTVIEW_DEFINITION_DELIMITER) < 0) &&
             (param.indexOf(constants.CONTENTVIEW_DEFINITION_ITEM_DELIMITER) < 0))
         {
            objView = new DejaClick.DejaContentView(param);

            numberListPattern = /^\d+(:\d+)?(\|\|\d+(:\d+)?)*$/;
            numberPattern = /^\d+$/;

            // Add the filters from the definition to the object.
            param = this._script.domTreeGetParam(aNode, "definition",
               "contentviewparams");
            if ((param !== null) && (param.length > 0)) {
               param.split(constants.CONTENTVIEW_DEFINITION_DELIMITER).forEach(addFilter);
            }

            // Add associated actions.
            param = this._script.domTreeGetParam(aNode, "actionscope",
               "contentviewparams");
            if ((param !== null) && (param.match(numberListPattern) !== null)) {
               param.split(constants.CONTENTVIEW_SCOPE_DELIMITER).forEach(function (aActionMHash) {
                  var hashParts = aActionMHash.split(":");
                  var actionSeq = hashParts[0];
                  var subSeq = hashParts[1] || 0;

                  // Find the events for each action.
                  gDC._search.processXPath(gDC._actTreeRoots[subSeq],
                     "child::action[@seq='" + actionSeq + "']/event/@seq").
                     forEach(function (aEventSeq) {
                        var eventMHash = aEventSeq.value + ":" + subSeq;
                        objView.associateWithEvent(eventMHash);
                     });
               });
            }

            // Add associated events.
            param = this._script.domTreeGetParam(aNode, "eventscope",
               "contentviewparams");
            if ((param !== null) && (param.match(numberListPattern) !== null)) {
               param.split(constants.CONTENTVIEW_SCOPE_DELIMITER).forEach(function (aEvent) {
                  objView.associateWithEvent(aEvent);
               });
            }

            // Set minimum size.
            param = this._script.domTreeGetParam(aNode, "gtsize", "contentviewparams");
            if ((param !== null) && (param.match(numberPattern) !== null)) {
               objView.setMinimumSize(Number(param));
            }

            // Set maximum size.
            param = this._script.domTreeGetParam(aNode, "ltsize", "contentviewparams");
            if ((param !== null) && (param.match(numberPattern) !== null)) {
               objView.setMaximumSize(Number(param));
            }

            // Add MIME type requirements.
            param = this._script.domTreeGetParam(aNode, "type", "contentviewparams");
            if ((param !== null) && (param.length > 0)) {
               param.split(constants.CONTENTVIEW_DEFINITION_DELIMITER).forEach(function (aType) {
                  objView.addMimeTypeFilter(aType);
               });
            }

            objView.skip = ("true" ===
               this._script.domTreeGetParam(aNode, "skip", "contentviewparams"));
         }

      } catch (e) {
         this.logger.logFailure("Invalid ContentView - " + e, false);
         objView = null;
      }
      return objView;
   },

   loadContentViews : function ()
   {
      var bResult = true;

      function nameToView(aName) {
         return viewsByName[aName];
      }
      function isValidCV(aValue) {
         // Force loadContentViews() to fail if we encounter an invalid (empty) CV
         if (!aValue)
            bResult = false;
         return bResult;
      }
      function isNonNull(aValue) { return aValue !== null; }

      var viewsByName;
      try {
         this.contentViewsByName = { };
         // Reference the property locally for the nameToView closure.
         viewsByName = this.contentViewsByName;

         // Create all content view object for the transaction.
         this.contentViews = gDC._search.processXPath(this._domTreeRoot,
            "descendant::contentviews/contentview").
            map(this.createContentView, this).
            filter(isValidCV);

         // Index the content views by name, removing duplicates.
         this.contentViews.forEach(function (aView, aIndex, aContainer) {
            if (!this.contentViewsByName.hasOwnProperty(aView.name)) {
               this.contentViewsByName[aView.name] = aView;
            } else {
               aContainer[aIndex] = null;
            }
         }, this);
         this.contentViews = this.contentViews.filter(isNonNull);

         // Resolve internal references to content views.
         this.contentViews.forEach(function (aView) {
            aView.resolveViews(nameToView);
         });

         // Break circular references in content views.
         this.contentViews.forEach(function (aView) {
            aView.breakCircularReferences();
         });

      } catch (e) {
         this.logger.logFailure("Failed to load ContentViews - " + e, false);
         bResult = false;
      }
      return bResult;
   },

   getContentViews : function(aURL, aEventHashkey, aSize, aMimeType, aCVList)
   {
      var numViews, arrayCV, nSize, strMimeType, i, urlPath,
         objView, viewName;
      numViews = this.contentViews.length;
      if ((numViews !== 0) &&
          (aURL !== undefined) && (typeof (aURL) === "string") &&
          (aURL.length > 0))
      {
         try {
            arrayCV = aCVList ? aCVList.split(",") : [];

            var eventHashkey = aEventHashkey ? aEventHashkey : this.currentEventHashkey();
            var hashParts = eventHashkey.split(":");
            var eventMHash = hashParts[0] + ((hashParts.length > 2) ? ":" + hashParts[2] : "");

            nSize = ((aSize !== undefined) && (typeof(aSize) === "number") && (aSize > -1)) ? aSize : -1;

           // Reformat the mimetype: can come in as: "text/html" or
            // "text/html; charset=UTF-8" or empty we want only the
            // "text/html" or null;
            strMimeType = ((aMimeType !== undefined) && (typeof (aMimeType) === "string") &&
                  (aMimeType.length > 0))
               ? aMimeType.split(";")[0]
               : null;

            // Slice off all the query and fragment for clear text matching.
            i = aURL.indexOf("?");
            urlPath = (i >= 0) ? aURL.substr(0, i) : aURL;
            i = urlPath.indexOf("#");
            if (i >= 0) {
               urlPath = urlPath.substr(0, i);
            }

            for (i = 0; i < numViews; ++i) {
               objView = this.contentViews[i];
               viewName = objView.name;
               if ((arrayCV.indexOf(viewName) < 0) &&
                   objView.isMatch(aURL, urlPath, eventMHash, nSize, strMimeType))
               {
                  arrayCV.push(viewName);
               }
            }
            if (arrayCV.length) {
               return arrayCV.join(",");
            }
         }
         catch ( e ) {
         }
      }
      return null; // URL does not match any ContentView defined
   },

   isSkippedCV : function(aCVNameList)
   {
      var arrayCV, idx;
      try {
         if ((typeof(aCVNameList) == "string") && (aCVNameList.length > 0)) {
            arrayCV = aCVNameList.split(",");
            idx = arrayCV.length;
            while (idx > 0) {
               if (this.contentViewsByName[arrayCV[--idx]].skip) {
                  ++this.skippedCVErrors;
                  return true;
               }
            }
         }
      }
      catch ( e ) {}
      return false;
   },

   shouldSkipRequestError : function(aURL)
   {
      try {
         if ((gDC.contentViews.length > 0) &&
             (typeof(aURL) == "string") &&
             (aURL.length > 0))
         {
            return this.isSkippedCV(this.getContentViews(aURL, null, -1, null, null));
         }

         // Check if the request belongs to base domain. If so, do not skip error
         if (gDC.processStepErrors) {
            return false;
         }

         // Check if the request belongs to base domain. If so, do not skip error
         var hostname = (new window.URL (aURL)).hostname;
         var domain = gDC._extractDomain(hostname);
         if (domain && gDC.domainList.length > 0) {
            for (var i = 0; i < gDC.domainList.length; i++) {
               if (gDC.domainList[i] === domain) {
                  return false;
               }
            }
            return true;
         }
      }
      catch ( e ) {}
      return false;
   },
   
   

   /**
    * UXM-11786
    * 
    * Loads the MFA info. For the moment just the table of
    * questions and answer for the security questions
    * challenge.
    * 
    */
   loadMFAinfo : function() {
      var invalidData = false;
      try {

         //The script is null. No file list can be initialized. 
         if ( ! gDC._script ) {
            return;
         }
         
         var mfaSecQuestionsList = gDC._script.processXPath(gDC._domTreeRoot, "child::mfa/securityquestion/option");

         if ( mfaSecQuestionsList === null || mfaSecQuestionsList.length === 0 ) {
            gDC._mfaInfo = null;
            return false;
         }
         
         gDC._mfaInfo = {
            securityquestions: []
         };

         gDC.logger.logInfo("Loading MFA security question values. Found: "+mfaSecQuestionsList.length);

         for (var i=0; i < mfaSecQuestionsList.length; i++) {
            var optionNode = mfaSecQuestionsList[i];
            var optionJSON = {};
            optionJSON.value = optionNode.getElementsByTagName('value')[0].textContent;

            //Trigger
            let optionKeywordList = optionNode.getElementsByTagName("keyword");
            if (optionKeywordList.length !== 1 ) {
               gDC.logger.logWarning("Discarded MFA Security Question option! No trigger defined!");
               break;
            } else {
               var keywordObj = {
                  id : 0,
                  strMatchText: null,
                  bFixSpaces: false,
                  oRegExText: null,
                  keywordFound : false,
                  preferred : false
               };
               gDC.initValidator(keywordObj, optionKeywordList[0]);

               optionJSON.keyword = keywordObj;
               gDC._mfaInfo.securityquestions.push(optionJSON);
            }
         }

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "loadMFAinfo" );
         invalidData = true;
      }

      if ( invalidData ) {
         gDC.handleReplayFailure( "dcMessage_errorLoadMFAinfo", null, constants.STATUS_SCRIPT_PARSE_ERROR );
      }
   },

   /**
    * Loads the list of triggered subscripts from the script.
    * 
    * UXM-11786 & UXM-11949
    */
   loadTriggeredSubcripts : function()
   {
      var invalidData = false;
      try {

         //The script is null. No file list can be initialized. 
         if ( ! gDC._script ) {
            return;
         }

         gDC._triggers = [];
         gDC._triggeredSubscripts = {};
         gDC.triggerFired = null;
         gDC.triggeredScriptFinished = null;
         gDC.triggeredSubscriptPrevNode = null;
         gDC.triggeredScriptNextEvent = null;
         gDC.waitingForTriggerKeywordResult = null;

         var triggeredSubscriptsList = gDC._script.processXPath(gDC._domTreeRoot, "child::subscripts/subscript[triggers]"); 
         if ( triggeredSubscriptsList === null ||triggeredSubscriptsList.length === 0 ) {
            return false;
         }

         gDC.logger.logInfo("Loading triggered subscripts. Found: "+triggeredSubscriptsList.length);

         for (var i=0; i < triggeredSubscriptsList.length; i++) {
            var subscriptNode = triggeredSubscriptsList[i];
            var subscriptSeq = subscriptNode.getAttribute('seq');
            var description = gDC._script.domTreeGetAttribute( subscriptNode, 'description' );
            var name = description?description:("Subscript_"+subscriptSeq);

            let triggersNode = subscriptNode.getElementsByTagName("triggers")[0];
            var skipIfMaxReplays;
            if ( triggersNode.hasAttribute(gDC._prefs.getName('DC_OPTID_TRIGGER_SKIP_AFTER_MAX_REPLAYS')) ) {
               skipIfMaxReplays = 
                  gDC._prefs.decodeValue(
                     'DC_OPTID_TRIGGER_SKIP_AFTER_MAX_REPLAYS',
                     triggersNode.getAttribute(gDC._prefs.getName('DC_OPTID_TRIGGER_SKIP_AFTER_MAX_REPLAYS'))
                  );
            } else {
               skipIfMaxReplays = gDC._prefs.getDefault('DC_OPTID_TRIGGER_SKIP_AFTER_MAX_REPLAYS');
            }

            var maxReplays = NaN;
            if ( triggersNode.hasAttribute(gDC._prefs.getName('DC_OPTID_TRIGGER_MAX_REPLAYS')) ) {
               maxReplays = 
                  gDC._prefs.decodeValue(
                     'DC_OPTID_TRIGGER_MAX_REPLAYS',
                     triggersNode.getAttribute(gDC._prefs.getName('DC_OPTID_TRIGGER_MAX_REPLAYS'))
                  );
               
            }
            if ( isNaN(maxReplays) ) {
               maxReplays = gDC._prefs.getDefault('DC_OPTID_TRIGGER_MAX_REPLAYS');
            }

            gDC._triggeredSubscripts[subscriptSeq] = {
               skipIfMaxReplays: skipIfMaxReplays,
               maxReplays: maxReplays,
               triggeredCount: 0
            };
            
            //Trigger
            let triggerList = subscriptNode.getElementsByTagName("trigger");
            if (triggerList.length <= 0 ) { 
               gDC.logger.logWarning("Discarded subscript! No trigger defined! ["+name+"]");
               break;
            } else {
               //UXM-11948 - Allow multiple triggers per subscript
               // Each trigger is added to the list as an alternative, in other words
               // they are OR, it is not required to match all the triggers just one match
               // will launch the subscript.
               for (let index = 0; index < triggerList.length; index++) {
                  const triggerKeyword = triggerList[index];
                  
                  var triggerObj = {
                     id : 0,
                     strMatchText: null,
                     bFixSpaces: false,
                     oRegExText: null,
                     keywordFound : false,
                     preferred : false
                  };
                  gDC.initValidator(triggerObj, triggerKeyword);
   
                  let triggeredScriptInfo = {
                     name: name,
                     trigger: triggerObj,
                     subscript: Number(subscriptSeq)
                  };
                  gDC._triggers.push(triggeredScriptInfo);
                  gDC.logger.logInfo("Found trigger [strMatchText="+triggerObj.strMatchText+"] for subscript '"+name+"' [Seq="+triggeredScriptInfo.subscript+"]");
               }
            }
            
         }

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "loadTriggeredSubcripts" );
         invalidData = true;
      }

      if ( invalidData ) {
         gDC.handleReplayFailure( "dcMessage_errorLoadTriggeredSubcripts", null, constants.STATUS_SCRIPT_PARSE_ERROR );
      }
   },

   /**
    * Increase the number of times a triggered subscript has been triggered.
    * 
    * Returns false if the trigger should be ignored or true if it can be processed.
    * 
    * @param {*} triggerId 
    */
   checkTriggerCounts : function(triggerId) {
      try {
         let triggerInfo = gDC._triggers[triggerId];

         if ( triggerInfo ) {
            let scriptCountInfo = gDC._triggeredSubscripts[triggerInfo.subscript];
            scriptCountInfo.triggeredCount++;

            if ( scriptCountInfo.triggeredCount > scriptCountInfo.maxReplays ) {
               gDC.logger.logWarning("Maximum number of times reached for script '"+triggerInfo.name+"'. [Max="+scriptCountInfo.maxReplays+"][Count="+scriptCountInfo.triggeredCount+"]");

               if ( ! scriptCountInfo.skipIfMaxReplays ) {
                  let messageLong = gDC._messageBundle.getMessage("dcFailure_triggerMaxReplaysExceededLong", [triggerInfo.name, scriptCountInfo.maxReplays, scriptCountInfo.triggeredCount]);
                  let statusLogID = gDC.logger.logFailure( messageLong );
                  gDC.handleReplayFailure( "dcFailure_triggerMaxReplaysExceeded", messageLong, constants.STATUS_VALIDATION_FAILURE, statusLogID );
               }

               return false;
            } else {
               gDC.logger.logInfo("Script '"+triggerInfo.name+"' triggered count: "+scriptCountInfo.triggeredCount+". [Max="+scriptCountInfo.maxReplays+"]")
               return true;
            }
         } else {
            gDC.logger.logWarning("Invalid trigger ID received. No trigger found with that ID: "+triggerId);
         }

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "checkTriggerCounts" );
      }
      return false;
   },

   /**
    * Gets for all the referenced file lists included at the DejaClick script.
    * 
    * For each of the referenced file lists it gets the file information.
    * 
    * Feature - UXM-10587
    */
   exportAllFileLists : function()
   {
      var invalidData = false;
      try {

         //The script is null. No file list can be initialized. 
         if ( ! gDC._script ) {
            return;
         }

         gDC._fileListLastUpdate = (new Date()).getTime();

         // get a list of all filelist references in the script
         var listFileListRefs = gDC._script.processXPath(gDC._domTreeRoot, "descendant::param[@name='filelistref']/text()");
         if (!(listFileListRefs && listFileListRefs.length)) {
            gDC._fileLists = []; // no file lists are referenced. Empty Array.
            return;
         }
            

         gDC._fileLists = [];
         for (var i=0; i < listFileListRefs.length; i++) {
            var fileListName = listFileListRefs[i].nodeValue;
            if (!fileListName) {
               invalidData = true;
               this.logger.logWarning("File list name not found!");
               break;
            }

            var fileList = this.exportFileList( fileListName );
            if (!fileList) {
               invalidData = true;
               this.logger.logWarning("File list with reference "+fileListName);
               break;
            } else {
               gDC._fileLists.push(fileList);
            }
         }
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "getBrexportAllFileListsowserObj" );
         invalidData = true;
      }

      if ( invalidData ) {
         gDC.logger.logInfo("Replay failure. Invalid file lists data!");
         gDC.handleReplayFailure( "dcMessage_errorExportFileLists", null, constants.STATUS_SCRIPT_PARSE_ERROR );
      }
   },
   
   /**
    * Gets all the files information related with one file list.
    * 
    * @param {string} aFileListName File list name
    */
   exportFileList : function( aFileListName )
   {
      try {
         var fileList = {};
         fileList.name = aFileListName;
         fileList.files = [];
         
         // get the files in the filelist
         var listFiles = gDC._script.processXPath(gDC._domTreeRoot, "child::filelists/filelist[@name='" + aFileListName + "']/file");
         if (!(listFiles && listFiles.length))
            return false;

         //For each of the files, it takes the content and send it to the content script
         for (var i=0; i < listFiles.length; i++) {
            var nodeFile = listFiles[i];
            var file = {};
            file.name = nodeFile.getAttribute('name');
            if ( nodeFile.hasAttribute('type') ) {
               file.type = nodeFile.getAttribute('type');
            }
            file.data = nodeFile.textContent;
            file.listname = aFileListName;
            fileList.files.push(file);
          }

         return fileList;

      } catch ( e ) {
         gDC.logException( e, DCMODULE+"exportFileList" );
         return false;
      }
   },
   
   getBrowserObj : function( aTabId, aWindowId)
   {
      try {

         // The tab id is not unique for a given tab in chrome even when it is
         // open. It could change on page navigation. Hence we maintain 2 separated lists of
         // browsers to track. Once we get a tab replaced event, we update the
         // appropriate list accordingly.

         var browserIndex = gDC.getBrowserIndex(aTabId, aWindowId);
         var browserObj = null;
         // If we cant find the index in the tracked list, check
         // the ignored list.
         if (browserIndex < 0) {
            browserIndex = gDC.getBrowserIgnoredIndex(aTabId, aWindowId);
            browserObj = gDC.browsersIgnored[browserIndex];
         }
         else {
            browserObj = gDC.browsersTracked[browserIndex];
         }
         return browserObj;
      }
      catch ( e ) {
         gDC.logException( e, gDC.DCMODULE + "getBrowserObj" );
      }
      return null;
   },

   //------------------------------------------------
   // For the specified tab/window id, return the associated index into
   // the array of browser tracking objects we are keeping.  Note: this
   // function has the side effect of initializing a new browser tracking
   // object for the specified browser if it has not yet been seen.  Thus,
   // it should always return a valid browser tracking index as a result.
   getBrowserIndex : function( aTabId, aWindowId)
   {
      try {
         if (aTabId < 0) {
//            throw new Error("Invalid or missing browser node.");
            return -1;
         }
         var i, browserIndex = -1;

         for (i=0; i < gDC.browsersTracked.length; i++) {

            if (gDC.browsersTracked[i].tabId == aTabId) {
               browserIndex = i;
               break;  // we've seen this browser already
            }
         }

         if (!gDC.browsersTracked || gDC.browsersTracked.length === 0) {
            var browserObj = gDC.initializeBrowser(aTabId, aWindowId);
            browserIndex = browserObj.browserIndex;
         }
/*
         if (browserIndex < 0) {
            // fall-thru safety feature
            browserIndex = gDC.browsersTracked.length - 1;
         }
*/
         return browserIndex;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getBrowserIndex" );
         return -1;
      }
   },

   getBrowserIgnoredIndex : function( aTabId, aWindowId)
   {
      try {
         if (aTabId < 0) {
//            throw new Error("Invalid or missing browser node.");
            return -1;
         }
         var i, browserIndex = -1;

         for (i=0; i < gDC.browsersIgnored.length; i++) {

            if (gDC.browsersIgnored[i].tabId == aTabId) {
               browserIndex = i;
               break;  // we've seen this browser already
            }
         }

         if (browserIndex < 0) {
            var browserObj = {};
            browserObj.tabId = aTabId;
            browserObj.windowId = aWindowId;
            browserObj.contentIsLoaded = true;
            browserObj.networkActivity = 0;
            browserObj.navBrowserNode = null;
            browserObj.navLocationNode = null;
            browserObj.docsRequested = 0;
            browserObj.docsStarted = 0;
            browserObj.docsStopped = 0;
            browserObj.docsLoaded = 0;
            browserIndex = gDC.browsersIgnored.length;
            gDC.browsersIgnored.push (browserObj);
         }

         return browserIndex;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getBrowserIgnoredIndex" );
         return -1;
      }
   },

   //------------------------------------------------
   // For the specified window id, return the associated index into
   // the array of browser tracking objects we are keeping.
   getBrowserFromWindowIndex : function(aWindowId)
   {
      try {
         if (aWindowId < 0) {
//            throw new Error("Invalid or missing browser node.");
            return -1;
         }
         var i, browserIndex = -1;

         for (i=0; i < gDC.browsersTracked.length; i++) {

            if (gDC.browsersTracked[i].windowId == aWindowId) {
               browserIndex = i;
               break;  // we've seen this browser already
            }
         }

         if (browserIndex < 0) {
            // fall-thru safety feature
            browserIndex = gDC.browsersTracked.length - 1;
         }

         return browserIndex;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getBrowserFromWindowIndex" );
         return -1;
      }
   },

   /**
    * Asynchronously find the tab in which to begin recording or replaying.
    * @this {!DejaClick.DejaService}
    * @param {?function()=} opt_callback Optional function to invoke after
    *    the initial tab is found.
    */
   setInitialBrowser: function(opt_callback) {
      chrome.windows.getAll({ populate: true, windowTypes: ['normal'] },
         this.chooseInitialWindow.bind(this,
            (opt_callback == null) ? null : opt_callback));
   },

   /**
    * Choose the window in which to begin recording or replaying from
    * a list of open windows. The window to which the sidebar was last
    * docked or the most recently opened normal browser window will be
    * chosen. If no normal browser window is available, a new one will
    * be opened.
    * @this {!DejaClick.DejaService}
    * @param {?function()} aCallback Optional function to invoke after
    *    the initial tab is found.
    * @param {!Array.<!chrome.Window>} aWindows List of the open windows.
    */
   chooseInitialWindow: function (aCallback, aWindows) {
      var currWindow, index;
      try {
         currWindow = null;
         index = aWindows.length;
         while (index !== 0) {
            --index;
            if (aWindows[index].id === this.windowId) {
               currWindow = aWindows[index];
               break;
            } else if(aWindows[index].tabs.length){
               currWindow = aWindows[index];
            }
         }

         if (currWindow == null) {
            chrome.windows.create(
               {
                  url: 'about:blank',
                  type: 'normal',
                  incognito: true,
                  focused: true
               }, this.chooseInitialTab.bind(this, aCallback));
         } else {
            this.chooseInitialTab(aCallback, currWindow);
         }
      } catch (ex) {
         this.logException(ex, this.DCMODULE + 'chooseInitialTab');
      }
   },

   /**
    * Choose the active tab of a window to begin recording or replaying in.
    * @this {!DejaClick.DejaService}
    * @param {?function()} aCallback Optional function to invoke after
    *    the initial tab is found.
    * @param {!chrome.Window} aWindow The window in which to record or replay.
    */
   chooseInitialTab: function (aCallback, aWindow) {
      var tabs, index, tab;
      try {
         tabs = aWindow.tabs;
         index = tabs.length;
         while (index !== 0) {
            --index;
            tab = tabs[index];
            if (tab.active) {
               if (this.logger.debugprocess) {
                  this.logger.logDebug('Focused tab is ' + tab.id);
               }
               this.lastFocusedBrowserObj = tab;
               this.baseBrowser = tab.id;
               // create a new browser tracking object
               this.trackNewBrowser(tab.id, aWindow.id, 'tabbrowser', tab);

               // setup location change listeners
               this.attachNetworkListeners();

               if (this.logger.debugprocess) {
                  this.logger.logDebug('starting window is selected: URI is [' +
                     tab.url + '][PendingURL='+tab.pendingUrl+'], focused tab is ' + tab.id);
               }
               if (aCallback !== null) {
                  aCallback();
               }
               return;
            }
         }
         // This should only be possible if Chrome does something unexpected.
         // Presumably all normal windows have an active tab.
         throw new Error('Cannot find initial tab. Exiting...');
      } catch (ex) {
         this.logException(ex, this.DCMODULE + 'chooseInitialTab');
      }
   },

   //------------------------------------------------
   // Check if any tracked browser is active
   isBrowserActive : function()
   {
      var pObj = gDC.getPendingBrowserInfo();
      var retVal=false;
      if (gDC.logger.debugactivity) {
         gDC.logger.logDebug("isBrowserActive:  pendingActivity=" + gDC.pendingActivity +
                      ", documentPending="   + pObj.documentPending +
                      ", contentPending="    + pObj.contentPending +
                      ", fullpageObjects="   + gDC.fullpageObjects +
                      ", pendingNetwork="    + gDC.pendingNetwork +
                      ", pendingXMLRequest=" + gDC.pendingXMLRequest +
                      ", netActivityCount="  + gDC.netActivityCount);
      }
/*
      if (pObj.documentPending) {
         retVal = true;
      }
*/

      if (gDC.pendingActivity || pObj.documentPending || pObj.contentPending) {
         if (gDC.pendingActivity &&
               (!pObj.documentPending && !pObj.contentPending && !gDC.fullpageObjects &&
                !gDC.pendingNetwork && !gDC.pendingXMLRequest && !gDC.netActivityCount)) {
            gDC.pendingActivity = false;  // special case: clear pendingActivity if all other checks are false
            // and fall through (basically, don't let pendingActivity hold us up if fullpageObjects is not set)
         } else {
            retVal = true;
         }
      } else {
         if (gDC.fullpageObjects && (gDC.pendingNetwork || gDC.pendingXMLRequest || gDC.netActivityCount > 0)) {
            var networkActivityRemaining = false;

            // if fullpageObjects option is enabled, make sure network activity is completely stopped
            if (gDC.networkTimeout==null) { gDC.restartNetworkTimeout(); }

            retVal = true;
            if (gDC.pendingLocations === 0 && (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED))  {
               for (var i=0; i < gDC.browsersTracked.length; i++) {
                  if (gDC.browsersTracked[i].networkActivity > 0) {
                     networkActivityRemaining = true;
                     break;
                  }
               }

               if (!networkActivityRemaining) {
                  gDC.pendingNetwork = false;
                  gDC.pendingXMLRequest = false;
                  gDC.netActivityCount = 0;
                  gDC.stopNetworkTimeout();
                  retVal = false;
               }
            }
         }
      }


      if (gDC.thinktimeStop > 0) {
         if (!retVal) { gDC._setWaitType( constants.WAITTYPE_THINKTIME ); }  // set only if browser not busy
         gDC.restartReplayTimeout();  // ensures thinktimeStop is updated
      }
/*
      if (gDC.classifytimeStop > 0) {
         if (!retVal) { gDC._setWaitType( constants.WAITTYPE_CLASSIFYTIME ); }  // set only if browser not busy
         gDC.restartReplayTimeout();  // ensures thinktimeStop is updated
      }
*/
      return retVal;
   },

   //------------------------------------------------
   // Check if all tracked browsers are idle
   isBrowserIdle : function()
   {
      var retVal = true;
      var pObj = gDC.getPendingBrowserInfo();

      // if our state doesn't match the following profile, then
      // we are "idle" (as in, the browser's throbber is stopped)
      if (!gDC.pendingActivity && !pObj.networkPending && !pObj.contentPending) {
         if (gDC.pendingNetwork || gDC.pendingXMLRequest || pObj.documentPending || gDC.netActivityCount > 0) {
            retVal = false;
         }
      }
      if (gDC.logger.debugactivity) {
         gDC.logger.logDebug("isBrowserIdle:  pendingActivity=" + gDC.pendingActivity +
                      ", documentPending="   + pObj.documentPending +
                      ", contentPending="    + pObj.contentPending +
                      ", networkPending="    + pObj.networkPending +
                      ", pendingNetwork="    + gDC.pendingNetwork +
                      ", pendingXMLRequest=" + gDC.pendingXMLRequest +
                      ", netActivityCount="  + gDC.netActivityCount);
      }
      return retVal;
   },

   //------------------------------------------------
   // Check for pending network activity only
   isNetworkIdle : function()
   {
      var retVal = true;
      var pObj = gDC.getPendingBrowserInfo();

      if (gDC.pendingActivity || gDC.pendingNetwork || gDC.pendingXMLRequest || gDC.netActivityCount > 0 || pObj.networkPending) {
         retVal = false;
      }
      return retVal;
   },


   //------------------------------------------------
   // Return a handle to the last inserted DOM node element (of the specified type)
   // in the navigation tree for the browser node with the specified browser index.
   // Or no element, return a handle to the tree element for the specified browser.
   // Or no browser, return a handle to the root node of the navigation tree itself.
   getLastBrowserElement : function( aBrowserIndex, aType )
   {
      try {
         var navBrowserNode = null;
         var navBrowserNodes = gDC._navTreeRoot.getElementsByTagName('browser');
         if (aBrowserIndex >= navBrowserNodes.length) {
            // warn, but do not abort
            gDC.logger.logWarning("Specified browser index out of range in getLastBrowserElement.");
         } else {
            // loop through all navigation tree browser nodes looking
            // for one with a matching browserindex and not closed
            var browserNode;
            for (var i=0; i < navBrowserNodes.length; i++) {
               browserNode = navBrowserNodes[i];
               if (Number(browserNode.getAttribute('browserindex')) == aBrowserIndex &&
                   !browserNode.hasAttribute('closed')) {
                  navBrowserNode = browserNode;
                  break;
               }
            }
         }

         if (!navBrowserNode) {
            // target browser not found, return navigation tree root element
            return gDC._navTreeRoot;
         }
         var browserElements = navBrowserNode.getElementsByTagName( aType );
         if (browserElements.length === 0) {
            // specified element types not found under this browser, return browser element
            return navBrowserNode;
         }
         // return last element node of the specified type for this requested browser
         return browserElements[browserElements.length-1];

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getLastBrowserElement" );
         return null;
      }
   },
   //------------------------------------------------
   // Return an object summarizing pending browser activities
   // associated with all the browser objects we are tracking.
   // Note: Important side-effect also sends the pending info
   // (as a string) to any registered observers as an update.
   getPendingBrowserInfo : function()
   {
      try {
         // initialize default object values
         var pendingObj = {};
         pendingObj.networkPending = false;
         pendingObj.contentPending = false;
         pendingObj.documentPending = false;

         for (var i=0; i < gDC.browsersTracked.length; i++) {
            var browserObj = gDC.browsersTracked[i];
            // check if any network activity is pending for this tracked browser.
            if (browserObj.networkActivity > 0) {
               if (gDC.replayShuttingDown) {
                  // reset network activity stuff during shutdown
                  browserObj.networkActivity = 0;
                  gDC.netActivityCount = 0;
                  gDC.pendingNetwork = false;

               } else {
                  // else, enable our master net activity flag
                  pendingObj.networkPending = true;
               }
            }

            // check if all document network requests have been received
            // for this tracked browser.
            if (browserObj.docsStopped < browserObj.docsStarted &&
                browserObj.docsLoaded < browserObj.docsStarted) {
               if (gDC.logger.debugpending) {
                  gDC.logger.logDebug("Marking documentPending=true -> browserObj.docsStopped="+browserObj.docsStopped+" -- browserObj.docsStarted="+browserObj.docsStarted+" -- browserObj.docsLoaded="+browserObj.docsLoaded);
               }
               pendingObj.documentPending = true;
            }

            // check if all document contents have been loaded for this tracked browser.
            // Note: this means the DOMContentLoaded event was fired for all documents,
            // it does not, however, necessarily mean that all page resources have fully
            // loaded (css, js, images, etc).
            if (!browserObj.contentIsLoaded && (browserObj.browser.status != "complete")) {
               if (gDC.logger.debugpending) {
                  gDC.logger.logDebug("Updating tab info "+browserObj.tabId+" because the last time we tracked that the status wasn't complete. [contentIsLoaded="+browserObj.contentIsLoaded+"][browserObj.browser.status="+browserObj.browser.status+"] ");
               }
               //UXM-11863 - We are not processing all the updates of the tab, so, in some cases the
               // status was already completed but our browserObj.browser didn't have the status properly updated.
               // With this call to chrome tabs we force the update of the browserObj object.
               chrome.tabs.get( browserObj.tabId, function(tab) {
                     if (tab) {
                        browserObj.browser = tab;
                        browserObj.contentIsLoaded = (tab.status == "complete"); //UXM-12644 - Update content loaded status 
                     }
                  });
               if (gDC.logger.debugpending) {
                  gDC.logger.logDebug("Marking contentPending=true -> contentIsLoaded="+browserObj.contentIsLoaded+" -- browserObj.browser.status="+browserObj.browser.status+" ");
               }
               pendingObj.contentPending = true;
            }

            // force-set documentPending flag if all requested documents were received,
            // but all document loads have not yet completed AND we either have pending
            // network activity or pending content.
            if (browserObj.docsLoaded < browserObj.docsStarted && !pendingObj.documentPending &&
                (pendingObj.networkPending || pendingObj.contentPending)) {
               // also occurs when non-html docs like pdf files are loaded
               // into the browser or when some flash objects are loaded.
               if (gDC.logger.debugpending) {
                  gDC.logger.logDebug("Marking documentPending=true -> browserObj.docsLoaded="+browserObj.docsLoaded+" -- browserObj.docsStarted="+browserObj.docsStarted+" -- pendingObj.documentPending="+pendingObj.documentPending+" -- pendingObj.networkPending="+pendingObj.networkPending+" -- pendingObj.contentPending="+pendingObj.contentPending);
               }
               pendingObj.documentPending = true;
            }

            // Special case: ensure we don't hang forever if document's content
            // never loads (this might happen in cases where webpage javascript
            // starts to load a url but then immediately replaces that url load
            // with a different one based on some conditional check, or opens a
            // new browser before the first url can fully load.
            if (!pendingObj.documentPending &&
                (browserObj.docsLoaded < browserObj.docsStarted || !browserObj.contentIsLoaded)) {
               // restart a timer to display the Replay Advisor if this situation lasts too long
               gDC.pendingActivity = false;
               if (gDC.networkTimeout!=null) { gDC.restartNetworkTimeout(); }
            }

            if (gDC.logger.debugpending) {
               gDC.logger.logDebug("getPendingBrowserInfo - browser [" + i +
                     "]:  docsRequested="   + browserObj.docsRequested +
                     "  docsStarted="     + browserObj.docsStarted +
                     ", docsLoaded= "     + browserObj.docsLoaded +
                     ", docsStopped="     + browserObj.docsStopped +
                     ", networkActivity=" + browserObj.networkActivity +
                     ", contentIsLoaded=" + browserObj.contentIsLoaded +
                     ", browserObj.browser.status=" + browserObj.browser.status );
            }
         }

         if (gDC.logger.debugpending) {
            gDC.logger.logDebug("getPendingBrowserInfo - Summary ---:" +
                  "  documentPending=" + pendingObj.documentPending +
                  ", networkPending="  + pendingObj.networkPending +
                  ", contentPending="  + pendingObj.contentPending );
         }

         // sending pending info (as a string) to any registered observers
         var pendingInfo = pendingObj.documentPending + "||" + pendingObj.networkPending + "||" + pendingObj.contentPending;
         if (gDC._observerService) {  // check first, as we may no longer have observer service after shutdown
            gDC._observerService.notifyLocalObservers("dejaclick:getpendinginfo", pendingInfo);
         }

         return pendingObj;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getPendingBrowserInfo" );
         return null;
      }
   },

   /**
    * @this {!DejaClick.DejaService}
    * @param {string} aWarnPromptId Name of preference indicating whether
    *    to prompt the user.
    * @param {string} aMessageId Name of localizable message to be displayed
    *    to the user.
    */
   handleSkippedEvent : function( aWarnPromptId, aMessageId )
   {
      try {
         // Only do this in client mode.
         this.stopBrowserActivity();

         // @todo In server mode, notify extras dejaclick:cancelnetwork.

         // Clear these counters to permit the next event to be replayed.
         this.mutationsCount = 0;
         this.mutationsRecorded = 0;
         this.mutationsRequired = 0;
         this.pendingLocations = 0;
         this.lastEventSkipped = true;

         this.resetActivity();
       
         if (!this.checkHasEventPref(aWarnPromptId, this.actEventNode)) {
            // Always warn unless the event specifically suppresses
            // it. That is, if we have already 'dealt with' this
            // skipped event during the first replay (or RA prompting
            // for evt timeout is disabled) just process it as a
            // successful event with no warning indicator for the
            // event.
            this.handleReplayWarning(aMessageId, true);
         }

         if (this.replayTimeout == null) {
            this.restartReplayTimeout(1000);
         }

         this._setWaitType(constants.WAITTYPE_PROCESSING);

      } catch (e) {
         this.logException(e, this.DCMODULE + 'handleSkippedEvent');
      }
   },

   /** ------------------------------------------------
    * Perform activities associated with processing a replay warning,
    * including updating the replayed event status, adjusting the
    * navigation tree, setting XML event result attributes, and
    * logging messages. This is a localized function, so all messages
    * must be passed using a message ID.
    *
    * Note: this function should only be called if DejaClick is
    * actively replaying a script. For non-replay warnings (GUI or
    * config issues, etc) just call the logWarning() or alertUser()
    * functions.
    * @this {!DejaClick.DejaService}
    * @param {string} aMessageId Name of localizable message.
    * @param {boolean=} opt_skipEvent true if replay of the current event
    *    should be skipped.
    * @param {integer=} opt_statusCode AlertSite status code to assign
    *    to the current event.
    */
   handleReplayWarning: function (aMessageId, opt_skipEvent, opt_statusCode) {
      var statusCode, statusLogId, lastBrowserLocation;
      try {
         statusCode = (opt_statusCode == null) ? 0 : opt_statusCode;

         // Process the warning as a skipped event if opt_skipEvent is true.
         // If not set, the warning is not due to forceably skipping an event.
         // Check if number of skipped events exceeds any user-configured limits
         if (opt_skipEvent && (statusCode === 0) &&
               this.getScriptBoolPref('DC_OPTID_USEMAXSKIPPED') &&
               (this.eventsSkipped.length + 1 >
                  this.getScriptIntPref('DC_OPTID_MAXSKIPPED'))) {
            this.logger.logInfo("Replay failure. Too many events skipped!");
            this.handleReplayFailure('dcFailure_maxskipped', null,
               constants.STATUS_SKIPPED_EVENTS);
            return;
         }

         if (aMessageId.length === 0) {
            throw new Error("Invalid message ID.");
         }

         // Bump event counter if needed to prevent array indexing issues.
         if (this.actEventNum === 0) {
            this.actEventNum = 1;
         }

         // Get our localized message strings and log a warning message.
         // The statusLogID always gets stamped onto the XML results
         // subtree for post failure analysis.
         statusLogId = this.logger.logWarning(
            this._messageBundle.getMessage('dcMessage_replaywarning') +
               ' event (' + this.replayedEvents + ') - [' +
               (this.subscriptNum ? 'subscript ' + this.subscriptNum :
                  'main script') +
               '] event ' + this.actEventNum + ' - ' +
               this._messageBundle.getMessage(aMessageId),
            false);

         // Process the warning as a skipped event if opt_skipEvent is true
         // and there is an event processing deficit in the navigation tree.
         if ((statusCode === 0) && opt_skipEvent &&
               (this._navTreeRoot.getElementsByTagName('event').length +
                  this.eventsSkipped.length + this.eventsBranched.length <
                  this.replayedEvents)) {

            this._setWaitType(constants.WAITTYPE_SKIPPING);
            // Add a new 'skipped' event to the event list.
            // ** Note: this array push also allows the replayNextEvent
            // **       function to proceed with its next pending event
            this.eventsSkipped.push('skipped');

            // Insert a new navTree "skipped event" node and attach it
            // to the last created location node. This is important to
            // prevent our navigation tree structure from getting
            // out-of-whack.
            if (this.lastBrowserObj == null) {
               this.lastBrowserObj =
                  this.browsersTracked[this.browsersTracked.length - 1];
            }
            lastBrowserLocation = this.getLastBrowserElement(
               this.lastBrowserObj.browserIndex, 'location');
            this.navEventNode = this.domTreeInsertNavElement(
               lastBrowserLocation, 'event', 'skipped', ++this.navEventNum);
         }

         if ((this.lastTargetSearchId !== -1) &&
               (this.lastTargetDocId !== -1) &&
               this.getEventBoolPref('DC_OPTID_HIGHLIGHTACTIVE',
                  this.actEventNode)) {
            // Update last targeted dom node style to indicate a warning.
            this._observerService.notifyDocument(this.lastTargetDocId,
               'dejaclick:applyStyle',
               {
                  searchId: this.lastTargetSearchId,
                  style: this.getEventStringPref('DC_OPTID_ONWARNINGSTYLE',
                                                 gDC.actEventNode)
               });
            this.activeStyleApplied = false;
         }

         // Update tree view.
         gDC.updateTreeViewNodeState( gDC.actEventNode, gDC.subscriptNum, TREETYPE_WARN, null, true );

         if (this.replayedEvents !== 0) {
            // Assign our replay attributes to the results tree.
            // @todo Assign user experience timings.
            this.assignStatusAttribs(statusCode, this.REPLAY_WARNING,
               statusLogId, aMessageId);
         }

      } catch (e) {
         this.logException(e, this.DCMODULE + 'handleReplayWarning');
      }
   },
   
   handleReplayFailureFromDocument : function (aMessage, aTab, aDocId) {
      try {
         if (!aMessage) {
            return;
         }
         
         if (gDC.isDocumentIdTracked(aDocId)) {
            gDC.logger.logInfo("Replay failure message received from document ["+aDocId+"][MessageId="+(aMessage?aMessage.messageId:"N/A")+"][MessageString="+(aMessage?aMessage.messageString:"Unknown message")+"]");
            gDC.handleReplayFailure(aMessage.messageId, aMessage.messageString, aMessage.statusCode, aMessage.statusLogId);
         }
      
      } catch (e) {
         gDC.logger.logException(e, this.DCMODULE + 'handleReplayFailureFromDocument');
      }
      
   },

   /**
    * Shows a popup warning message to customer.
    * 
    * @param {*} aMessage 
    */
   handleRecordMessageFromDocument : function (aMessageId) {
      try {
         if (!aMessageId) {
            gDC.logger.logWarning("Empty message received at handleRecordMessageFromDocument.");
            return;
         }
         gDC._utils.promptService.alertUser( aMessageId, true );
      } catch (e) {
         gDC.logger.logException(e, this.DCMODULE + 'handleRecordMessageFromDocument');
      }
      
   },

   handleValidationMode : function(aData){
            gDC.validationModeEnabled = aData.enabled;
   }, 

   /** ------------------------------------------------
    * Handles activities associated with processing a replay failure,
    * including updating the recorded script status, logging messages,
    * and alerting the user.
    * Note: this function should only be called when DejaClick
    * is actively replaying a script.  For non-replay  failure events,
    * just use logException() and alertUser(). Note also that if
    * 'run interactive' mode is disabled, no modal dialogs will be
    * opened to prevent the extension from hanging.
    * @this {!DejaClick.DejaService}
    * @param {string} aMessageId Name of the localizable message describing
    *    the failure.
    * @param {?string} aMessageString Optional text elaborating on the failure.
    * @param {?integer} aStatusCode The status code characterizing the
    *    failure. This will be the value of the statuscode attribute
    *    of the replay actions results data.
    * @param {string=} opt_statusLogId Optional log entry giving
    *    more details about the failure.
    */
   handleReplayFailure: function (aMessageId, aMessageString,
         aStatusCode, opt_statusLogId) {
      var msgId, messageText, statusLogId , eventType;
      try {

         if ( ! gDC.actEventNode ) {
            gDC.logger.logWarning("Current event node is undefined. Replay was probably stopped!");
            return;
         }

         // Do not fail on hover and focus events in low sensitivity mode.
         eventType = gDC.actEventNode.getAttribute('type');

         if (this.getEventBoolPref('DC_OPTID_LOW_SENSITIVITY', gDC.actEventNode) &&
             (eventType == "hover" || eventType == "focus" || eventType == "tabfocus") &&
             !(aStatusCode == 5 || aStatusCode == 81)) {
            this.handleReplayWarning(aMessageId, true /* skip event */, 0);
            gDC.areWeThereYet();
            return;
         }

         // @todo Return if branching rule is matched.

         // Stop replayNextEvent activity.
         this.replayShuttingDown = true;
         this._setWaitType(constants.WAITTYPE_STOPPING);

         // stop pending timers
         this.teardownAsyncTimers();

         // @todo Try again later if DC_OPTID_SUSPENDREPLAY is set.
         this.logger.logInfo('Beginning replay failure processing [Status='+aStatusCode+']');

         if (this.actEventNum === 0) {
            this.actEventNum = 1;
         }

         this._observerService.notifyLocalObservers('dejaclick:stopTiming',
            { script: this._script, resultNode: this.resEventNode, success : false });

         if (!this.captureInitiated &&
               (this.getEventStringPref('DC_OPTID_CAPTURELEVEL',
                                        this.actEventNode).length !== 0)) {
            this.notifyCaptureData('err');
         }

         if (aMessageId === '') {
            throw new Error('Invalid message ID.');
         }

         // Assign a default status code (processing exception) if
         // none is available.
         // Note: the message ID checks are an ugly hack to force a
         // statuscode of 0 at the event level for document step
         // timeouts and page object errors.
         if (((aStatusCode == null) ||
                  (aStatusCode === constants.STATUS_SUCCESS)) &&
               (aMessageId !== 'dcFailure_steptimeout') &&
               (aMessageId !== 'dcFailure_objectfailure')) {
            aStatusCode = constants.STATUS_INTERNAL_ERROR;
         }

         if (opt_statusLogId == null) {
            // If a status log message is not passed as a parameter, we
            // create a new one by logging a Failure message.  The
            // opt_statusLogId always gets stamped onto the XML results
            // subtree for post failure analysis.
            if ((this._runMode === constants.RUNMODE_REPLAY) ||
                  (this._runMode === constants.RUNMODE_PAUSED)) {
               msgId = "dcMessage_replayfailure";
            } else if (this._runMode == constants.RUNMODE_RECORD) {
               msgId = "dcMessage_recordfailure";
            } else {
               msgId = "dcMessage_generalfailure";
            }

            messageText = this._messageBundle.getMessage(aMessageId);
            if (messageText === '') {
               messageText = '(UNKNOWN MESSAGE ID)';
            }

            statusLogId = this.logger.logFailure(
               this._messageBundle.getMessage(msgId) + ' event (' +
                  this.replayedEvents + ') - [' +
                  (this.subscriptNum ? 'subscript ' + this.subscriptNum :
                     'main script') +
                  '] event ' + this.actEventNum + ' - ' + messageText,
               false);
         } else {
            statusLogId = opt_statusLogId;
         }

         if ((this.lastTargetSearchId !== -1) &&
               (this.lastTargetDocId !== -1) &&
               this.getEventBoolPref('DC_OPTID_HIGHLIGHTACTIVE',
                  this.actEventNode)) {
            // Update last targeted dom node style to indicate a failure.
            this._observerService.notifyDocument(this.lastTargetDocId,
               'dejaclick:applyStyle',
               {
                  searchId: this.lastTargetSearchId,
                  style: this.getEventStringPref('DC_OPTID_ONFAILURESTYLE',
                                                 gDC.actEventNode)
               });
            this.activeStyleApplied = false;
         }

         // Update tree view.
         gDC.updateTreeViewNodeState( gDC.actEventNode, gDC.subscriptNum, TREETYPE_ERROR, null, true );

         if (this.replayedEvents !== 0) {
            // @todo Assign user experience timings.
            this.assignStatusAttribs(aStatusCode, this.REPLAY_ERROR,
               statusLogId, aMessageId, aMessageString);
            // @todo Notify extras dejaclick:replayfailure.
         }

         this._setWaitType(constants.WAITTYPE_STOPPED);
         this.setRunMode(constants.RUNMODE_STOPPED, true);
         this._setRunType(constants.RUNTYPE_STOPABORTED);

         // Export results to file.
         if (this.replayedEvents !== 0) {
            this._observerService.notifyLocalObservers('dejaclick:exportResults',
                                                       null);
         } else {
            this._observerService.notifyLocalObservers('dejaclick:exportResults',
               {
                  message: aMessageId,
                  statusCode: aStatusCode,
                  statusLogId: statusLogId
               });
         }

         if ((aStatusCode !== constants.STATUS_HTTP_ERROR) ||
               (aMessageString == null) ||
               (aMessageString === '')) {
            this.alertUserAndRestoreBrowserWindows(aMessageId, true,
               statusLogId);
         } else {
            this.alertUserAndRestoreBrowserWindows(aMessageString, false,
               statusLogId);
         }

         this.finalizeState();

      } catch (ex) {
         this.exceptionCount = 0;
         this._setWaitType(constants.WAITTYPE_STOPPED);
         this.setRunMode(constants.RUNMODE_STOPPED, true);
         this._setRunType(constants.RUNTYPE_STOPABORTED);
         this.logException(ex, this.DCMODULE + 'handleReplayFailure');
      }
   },

   /**
    * Act as a proxy for handleReplayFailure to first ensure that all
    * browser and network activity is stopped and any listeners have
    * had an opportunity to finish activities prior to failure
    * processing.
    * @this {!DejaClick.DejaService}
    * @param {string} aMessageId Name of localizable message describing
    *    the timeout condition.
    * @param {integer} aStatusCode DejaClick status code to apply to the
    *    timed out event.
    * @param {string=} opt_statusLogId Optional log message to reference in
    *    the results.
    * @param {boolean=} opt_skipContentCheck Optional flag indicating that
    *    the user page should not be validated before reporting the timeout.
    */
   handleReplayTimeout: function (aMessageId, aStatusCode,
      opt_statusLogId, opt_skipContentCheck)
   {
      var self;
      try {
         if (aMessageId.length === 0) {
            throw new Error("Invalid message ID.");
         }

         if ((aStatusCode != constants.STATUS_BROWSER_TIMEOUT_TRANSACTION) && (aStatusCode != constants.STATUS_INTERNAL_ERROR) && (aStatusCode != constants.STATUS_TOO_MANY_STEPS)) {
            // check if there is a branching rule to handle this timeout failure.
            // If aStatusCode == 0 e.g. a full page step timeout or object error,
            // handle it as a status code 2 (network timeout error).
            if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, aStatusCode || constants.STATUS_SERVER_TIMEOUT )) {
               return;
            }
         }

         // Check for browser or network activity or if the special
         // 'suspendreplay' pref is enabled, which means replay
         // activity is being suspended via an external controller
         // that is waiting to finalize its processing.  If so, call
         // ourselves again using a timer to allow for activities to
         // complete.
         if (gDC.isBrowserActive() ||
               gDC.getSystemBoolPref('DC_OPTID_SUSPENDREPLAY')) {

            if (!gDC.replayShuttingDown) {
               gDC.replayShuttingDown = true;  // stop replayNextEvent activity

               gDC.pendingPrompt = true;
               gDC.logger.logInfo('replay timeout - stopping all browser and network activity (statuscode=' + aStatusCode + ') ...');

               gDC.resetActivity();

               // @todo Notify extras dejaclick:cancelnetwork.
            }

            // Retry ourselves again after a second
            gDC._setTimeout(function () {
               gDC.handleReplayTimeout(aMessageId, aStatusCode,
                  opt_statusLogId, opt_skipContentCheck);
            }, 1000);
            gDC._setWaitType(constants.WAITTYPE_PROCESSING);
            return;
         }

         if (!opt_skipContentCheck &&
               !gDC.pendingPrompt &&
               gDC.isContentError()) {
            // A page content error was detected and error was already handled.
            return;
         }

         gDC.stopBrowserActivity();

         // Browser and network activities have stopped, so process the
         // replay failure.
         gDC.logger.logInfo("Replay failure due to replay time out. ["+aMessageId+"]["+aStatusCode+"]");
         gDC.handleReplayFailure(aMessageId, null, aStatusCode,
            opt_statusLogId);

      } catch (e) {
         gDC.logException(e, gDC.DCMODULE + 'handleReplayTimeout');
      }
   },

   /**
    * Perform special processing rules for auto-detecting page content
    * errors. Return true if it appears that we have a page content
    * error, else false. Note: this function should never be called
    * if there is pending network or browser load activity occurring
    * or after a timeout during page load.
    * @this {!DejaClick.DejaService}
    * @return {boolean} true if the loaded page does not meet our
    *    expectations.
    */
   isContentError : function()
   {
      var minMatchScore2, events, action, keyword, count;
      try {
         // Check if our last matchscore was below the matchscore2
         // minimum AND there are no keywords (which means we are
         // probably on the wrong page, which is adjustable via script
         // properties)
         minMatchScore2 = this.getEventIntPref('DC_OPTID_MINMATCHSCORE2',
            this.actEventNode);
         if (this.getEventBoolPref('DC_OPTID_USEMINMATCHSCORE2',
                  this.actEventNode) &&
               (this.lastMatchScore !== null) &&
               (this.lastMatchScore < 0.01 * minMatchScore2) &&
               (this.actEventNum !== 0) &&
               (this.actActionNum !== 0) &&
               !this.hasValidations(this.actActionNode) &&
               !this.hasValidations(this.actEventNode)) {
            // Convert the timeout error [8X] to a content error [97].
            this.logger.logInfo("Replay failure at 'isContentError'. Switching ST8X to ST97.");
            this.handleReplayFailure('dcFailure_targetnotfound', null,
               constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
            // return true to skip timeout error
            return true;
         }

         /** @todo Perform event (and maybe action) keyword validations.
            This will require some significant redesign since keyword
            validation will need to be asynchronous.

         // Now force-check any keywords to see if we should bypass
         // processing the timeout error. We are definitely on the
         // wrong page if we have any keyword errors.
         events = this.actActionNode.getElementsByTagName('event');
         action = (events[events.length - 1] !== this.actEventNode) ? null :
            this.actActionNode;

         keyword = constants.VALIDATION_TYPE_KEYWORD;
         // Stop looping at 20 in case of 'continue' keywords.
         for (count = 20; count !== 0; --count) {
            // Teardown all timers before processing validations.
            this.teardownAsyncTimers();

            // Check for and process any event validations now.
            if (this.processValidations(this.actEventNode, keyword)) {
               // We have a validation failure or a wait-for-keyword validation.
               if (this.evtKwValsProcessed !== 0) {
                  return true;
               }
               break;
            }

            // Check for and process any action validations now if
            // this is the last event of the action.
            if ((action !== null) && this.processValidations(action, keyword)) {
               // We have a validation failure or a wait-for-keyword validation.
               if (this.actKwValsProcessed !== 0) {
                  return true;
               }
               break;
            }
         }
         */

      } catch (e) {
         this.logException(e, this.DCMODULE + 'isContentError');
      }
      return false;  // continue processing of timeout error
   },

   /**
    * Determine whether an action or event contains any validations.
    * @this {!DejaClick.DejaService}
    * @param {!Element} aElement An action or event element of the script.
    * @return {boolean} true if aElement contains any validations.
    */
   hasValidations: function (aElement) {
      return this._script.processXPathPresence(aElement,
         'child::validations/validation');
   },

   /**
    * Clean up after replay completion.
    * @this {!DejaClick.DejaService}
    */
   finalizeState: function () {
      try {
      
         if (gDC.isExecutionSuspended() || gDC.stopRecordReplayTimeout){
            gDC.restartFinalizeState(gDC.DC_OPTVAL_STOPRECORDREPLAYDELAY);
            return;
         }

         gDC.stopFinalizeState();
         
         // @todo Delete imported datasets.
         // @todo Delete exported files.
         // @todo Close dialogs/windows/tabs if DC_OPTID_AUTOCLEANUP is set.

         this.stopBrowserActivity();

         // @todo Load about:blank in remaining tab if DC_OPTID_AUTOCLEANUP.
         
         // first, check if we are supposed to perform a hard shutdown
         if (gDC.getSystemBoolPref('DC_OPTID_AUTOSHUTDOWN')) {
            //gDC._observerService.notifyLocalObservers("dejaclick:servicehalted", null );
            gDC._setTimeout( function(){gDC._observerService.notifyLocalObservers("dejaclick:servicehalted", null );}, 1000);
            // note shutting down the app will also close all windows and dialogs
            gDC.quitApplication();
            return;  // we're done
         }
         
        
         var autoPowerOff = gDC.getSystemBoolPref('DC_OPTID_AUTOPOWEROFF');
         if (autoPowerOff && !gDC.advisorRepairs) {
            // optionally power down the service if the autoPowerOff
            // option is enabled AND there were no Advisor repairs
            gDC.setSystemBoolPref( 'DC_OPTID_AUTOPOWEROFF', false);
            gDC.halt();

         } else {
            // notify any observers that our state is finalized (only if not halting)
             gDC._setTimeout( function(){gDC._observerService.notifyLocalObservers("dejaclick:statefinalized", null );}, 2000);
         }

      } catch (ex) {
         this.logException(ex, this.DCMODULE + 'finalizeState');
      }
   },

   // --------------------------------------------------------
   // This function serves as the main gatekeeper for checking when its
   // safe to:
   //   1. notify the user that we're ready for the next event to record
   //   2. process the next replay event in the recorded script
   //
   // During replay, we also check for any validations that need processing
   // for the current action after its last event.  Also, a check is made
   // to see if the shutdownTimeout has been activated (on completion of the
   // entire script on replay), in which case we don't restart any timers
   // and just return.
   // -----
   /** @param {boolean=} aBlockEventCheck */
   areWeThereYet : function( aBlockEventCheck )
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("in areWeThereYet"); }
         gDC.stopReadyTimeout();

         var beforeFirstReplayedEvent = false;
         if ((gDC._runMode==constants.RUNMODE_REPLAY || gDC._runMode==constants.RUNMODE_PAUSED) && gDC.actActionNum === 0) {
            beforeFirstReplayedEvent = true;
         }

         if (gDC._runMode == constants.RUNMODE_STOPPED || gDC._runMode == constants.RUNMODE_PAUSED) {
            gDC.teardownAsyncTimers();
            // notify observers to update their displays
            if (gDC._runMode == constants.RUNMODE_PAUSED) {
               gDC._setWaitType( constants.WAITTYPE_PAUSED );
            } else {
               gDC._setWaitType( constants.WAITTYPE_STOPPED );
            }
            return false;
         }
         if (gDC.pendingPrompt) {
            // don't proceed if we are displaying a prompt to the user
            return false;
         }

         // check if any browser windows have network activity
         // Special case: skip this next section if any stray document
         // content loads occur before we process our first replayed
         // event (sometimes occurs after a previous failure event).
         if (!beforeFirstReplayedEvent) {
            if (gDC.isBrowserActive()) {
               if (!gDC.replayShuttingDown) {
                  // browser is active and we're not shutting down, so hold back the gate
                  if (gDC.pendingActValidation || gDC.pendingEvtValidation) {
                     gDC._setWaitType( constants.WAITTYPE_VALIDATING );
                  }

                  if (gDC.lastReadyTimeout < 1000) { gDC.lastReadyTimeout += 100; } // important!
                  gDC.restartReadyTimeout();
               }

               gDC.pendingActivity = false;
               // restart event replay timer (if needed) to continue processing the recording
               if (gDC.replayTimeout == null) {  gDC.restartReplayTimeout(); }

               return false;
            }
         }

         if (gDC._runMode != constants.RUNMODE_RECORD && gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED) {
            return false;  // invalid mode, exit now
         }

         if (!beforeFirstReplayedEvent  && !gDC.eventTimeout) {
            gDC.restartEventTimeout();  // restart timer only if cleared
         }

         // note: these next 2 checks must come after all browser load activity is complete
         if (gDC._runMode == constants.RUNMODE_RECORD) {
            if (gDC.mutationsCountLast != gDC.mutationsCount) {
               // mutations are still occurring
               //gDC._setWaitType( WAITTYPE_MUTATIONS );
               if (!gDC.shutdownTimeout) {
                  gDC.restartReadyTimeout();
               }
               gDC.mutationsCountLast = gDC.mutationsCount;
               return (aBlockEventCheck ? true : false);
            }
         }

         // Special case: skip this next section if any stray document
         // content loads occur before we process our first replayed
         // event (sometimes occurs after a previous failure event).
         if (!beforeFirstReplayedEvent) {
            if (gDC.mutationsRecorded || (gDC.mutationsCountLast != gDC.mutationsCount) ) {
               // mutations have not been cleared or are still occurring
               gDC._setWaitType( constants.WAITTYPE_MUTATIONS );

               if (gDC.logger.debugprocess) { gDC.logger.logDebug("areWeThereYet: dom mutations pending (mutationsRecorded=" + gDC.mutationsRecorded + ", mutationsCountLast=" + gDC.mutationsCountLast + ", mutationsCount=" + gDC.mutationsCount + ")..."); }
/*
               // XXX tried using the following without the gDC.mutationsCount !== 0 check,
               // but it introduced other issues where mutationsRecorded was never getting
               // cleared (the onMutationDelay callback that restartMutationDelay calls is
               // what does the clearing).  Use C39021.xml as a test case for any changes.
               if (!gDC.shutdownTimeout && gDC.mutationsCount !== 0) {
                  if (!gDC.mutationsDelay) { gDC.restartMutationDelay(); }  // restart timer only if needed
               }
*/
               gDC.mutationsCountLast = gDC.mutationsCount;

               if (!gDC.mutationEndTimeout) { gDC.restartMutationEndTimeout(); }  // restart timer only if cleared
               //gDC.restartReadyTimeout();

               gDC.restartReplayTimeout();
               return false;
            }
         }

         // removed...was interfering with lastReadyTimeout increment logic
         // if (gDC.thinktimeStop === 0) gDC.lastReadyTimeout = 0;

         if (!gDC.networkTimeout && !gDC.pendingNetwork && !gDC.pendingXMLRequest && !gDC.pendingActivity) {
            gDC.stopNetworkTimeout();
         }

         gDC.pendingActivity = false;

         if (gDC._runMode == constants.RUNMODE_RECORD) {
            gDC._setWaitType( constants.WAITTYPE_STOPPED );

         } else if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {

            if (gDC._runMode == constants.RUNMODE_PAUSED) {
               gDC._setWaitType( constants.WAITTYPE_PAUSED );

            } else if (!gDC.shutdownTimeout) {
               if (gDC.pendingLocations) {
                  gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
               } else if (gDC.mutationsRecorded || (gDC.mutationsRequired && gDC.mutationsCount < gDC.mutationsRequired)) {
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               } else if (gDC.pendingActValidation || gDC.pendingEvtValidation) {
                  gDC._setWaitType( constants.WAITTYPE_VALIDATING );
               } else if (gDC.thinktimeStop > 0) {
                  gDC._setWaitType( constants.WAITTYPE_THINKTIME );
               } else if (gDC.classifytimeStop > 0) {
                  gDC._setWaitType( constants.WAITTYPE_CLASSIFYTIME );
               }
               else {
                  if (gDC.thinktimeStop === 0) { gDC._setWaitType( constants.WAITTYPE_PROCESSING ); }
               }

               // restart event replay timer (if needed) to continue processing the recording
               if (gDC.replayTimeout == null) {
                  gDC.restartReplayTimeout();
               }

            }
         }

         return true;  // yes, we're ready now

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"areWeThereYet" );
         return null;
      }
   },

   onMutationStarted : function ()
   {
      try {
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
            gDC.stopMutationBeginTimeout();
            gDC.restartMutationEndTimeout();
         }
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onMutationStated" );
      }
   },

   onMutationComplete : function ()
   {
      try {
         gDC.mutationsRecorded  = 0;
         gDC.stopMutationBeginTimeout();
         gDC.stopMutationEndTimeout();
         gDC._observerService.notifyObservers("dejaclick:mutationstop", null);
         gDC.areWeThereYet();
      }
      catch (e) {
         gDC.logException( e, gDC.DCMODULE+"onMutationComplete" );
      }
   },

   handleNetworkStart : function()
   {
      try {
         if (gDC.replayShuttingDown) { return; }  // don't track any new network starts during shutdown


         gDC.pendingNetwork = true;

         gDC.restartNetworkTimeout();  // refresh the timer

         gDC.stopStatusTimeout();

         gDC._setWaitType( constants.WAITTYPE_LOADINGDOC );

         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleNetworkStart" );
         return;
      }
   },


   handleNetworkStop : function()
   {
      try {
         gDC.pendingNetwork = false;

         if (gDC._runMode == constants.RUNMODE_RECORD && !gDC.isBrowserActive()) {
            gDC.restartStatusTimeout();
         }

         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleNetworkStop" );
         return;
      }
   },

   handleXMLRequestStart : function( aDetails )
   {
      try {

         if (gDC.replayShuttingDown) { return; }  // don't track any new XML requests during shutdown

         gDC.pendingXMLRequest = true;
         if (gDC._runMode == constants.RUNMODE_RECORD && gDC.actEventNode) {
            if (gDC._script.domTreeGetReplayHint(gDC.actEventNode, gDC.DC_NETWORKHINT)==null) {
               // assign the "wait for network activity" attribute to our current event
               gDC._script.domTreeAddReplayHint(gDC.actEventNode, gDC.DC_NETWORKHINT, 'yes');

            }
         }

         gDC.stopStatusTimeout();

         if (gDC.logger.debugnetwork) {
            gDC.logger.logDebug("new XMLHttpRequest sent: " + aDetails.url);
            gDC.getPendingBrowserInfo();  // to show debugging info
         }

         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            // bump the event step counter
            gDC.resEventNode.setAttribute('httpsteps', ++gDC.eventSteps);
         }

         gDC.restartNetworkTimeout();  // refresh the timer

         gDC._setWaitType( constants.WAITTYPE_LOADINGDOC );

         return;


      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleXMLRequestStart" );
         return;
      }
   },

   handleXMLRequestStop : function( aDetails )
   {
      try {
         //if (gDC.replayShuttingDown) return;  // don't track any more XML responses during shutdown
         gDC.pendingXMLRequest = false;
         
         if (gDC.logger.debugnetwork) {
            gDC.logger.logDebug("new XMLHttpResponse received: " + aDetails.url);
         }
         
         // update network stop time (always overwrite, last one wins)
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            gDC.networkStopTime = Date.now();
         }

         if ((gDC._runMode == constants.RUNMODE_RECORD || gDC._runMode == constants.RUNMODE_SUSPEND) && !gDC.isBrowserActive()) {
            gDC.restartStatusTimeout();
         }

         // flip on pendingActivity flag to give any newly loaded javascript
         // just a bit more time to execute before proceeding with replay
         gDC.pendingActivity = true;

         if (gDC.isBrowserIdle()) {
            // stop the timer if isBrowserIdle profile is true
            if (gDC.networkTimeout) { gDC.stopNetworkTimeout(); }
         }

         if (gDC.logger.debugnetwork) {
            gDC.logger.logDebug("new XMLHttpRequest received: " + aDetails.url);
            gDC.getPendingBrowserInfo();  // to show debugging info
         }
/*
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            // AS bug 4951 - ensure that ajax requests also get checked for
            // errors, since they don't have the normal onStateChange hook.
            if (gDC.checkAndProcessNetworkErrors( aSubject, aSubject.status )) {
               return;  // exit now if network error
            }
         }

         gDC.lastReadyTimeout = 0;
         gDC.restartReadyTimeout(500); // kick off the timer also
*/
         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleXMLRequestStop" );
         return;
      }
   },

   handleRequestStart : function( aRequest, aBrowserObj )
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED && gDC._runMode == constants.RUNMODE_RECORD) {
            return;  // exit now if not in record, replay or paused mode
         }

         if (gDC.replayShuttingDown) { return; }  // don't track any new requests during shutdown

         gDC.restartNetworkTimeout();  // refresh the timer

         if (aBrowserObj) { aBrowserObj.docsRequested++; }
         if (gDC.logger.debugactivity) {
            gDC.logger.logDebug("new document --requested: " + aRequest.url);
            gDC.getPendingBrowserInfo();  // show debugging info
         }
         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleRequestStart" );
         return;
      }
   },


   handleRequestStop : function( aRequest, aBrowserObj )
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED && gDC._runMode == constants.RUNMODE_RECORD) {
            return;  // exit now if not in record, replay or paused mode
         }

         if (aBrowserObj) { aBrowserObj.docsRequested--; }
         if (gDC.logger.debugactivity) {
            gDC.logger.logDebug("new document --completed: " + aRequest.url);
            gDC.getPendingBrowserInfo();  // show debugging info
         }

         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleRequestStop" );
         return;
      }
   },


   handleDocumentStart : function( aRequest, aBrowserObj )
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED && gDC._runMode == constants.RUNMODE_RECORD) {
            return;  // exit now if not in record, replay, or paused mode
         }

         if (gDC.replayShuttingDown) { return; }  // don't track any new documents during shutdown

         gDC.pendingActivity = true;

         if (aRequest.type == "main_frame" || aRequest.type == "sub_frame") {
            // a document request..
            if (aBrowserObj) {
               aBrowserObj.docsStarted++;
               if (aRequest.type == "main_frame") {
                  aBrowserObj.contentIsLoaded = false;
               }
            }

            if (gDC.logger.debugactivity) {
               gDC.logger.logDebug("new document --started: " + aRequest.url);
               gDC.getPendingBrowserInfo();  // show debugging info
            }
/*
         } else {  // not a document request..
            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               if (gDC.isBrowserIdle() && gDC.isNetworkIdle() && !gDC.isBrowserActive()) {
                  // Special case: stop the net timer now if our network and
                  // browser activity profiles match the above special state
                  if (gDC.networkTimeout) gDC.stopNetworkTimeout();
               }
            }
            return;  // not interested in anything but documents beyond this point
*/
         }

         if (gDC._runMode == constants.RUNMODE_RECORD) {
            gDC._setWaitType( constants.WAITTYPE_LOADINGDOC );  // set doc-loading indicators
            return;  // exit now when recording
         }
         
         //UXM-11863 - Sometimes the dispach of an event is interrupted because of a navigation, for instance,
         //the navigation after clicking on sign out/in buttons, are triggered by the "mouse up" so the click of the 
         //event is never dispatched and dejaServiceCS never sends the 'dejaclick:dispatchComplete' message.
         //In those cases we can assume that the event dispatch is done.
         //So, if we detect a navigation for a tab with pending dispatch, we reset the value.
         if ( gDC.pendingDispatch && gDC.pendingDispatchInfo.tabId == aBrowserObj.tabId ) {
            gDC.logger.logInfo("New navigation event at tab "+gDC.pendingDispatchInfo.tabId+". Assuming that the navigation was triggered after the event dispatch. [TabId="+gDC.pendingDispatchInfo.tabId+"][Was_Acknowledged="+gDC.pendingDispatchInfo.acknowledged+"]");
            gDC.pendingDispatch = false;
            gDC.pendingDispatchInfo = null;
         }

         gDC.restartNetworkTimeout();  // refresh the timer
         gDC.trackHttpStep( aRequest );
         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleDocumentStart" );
         return;
      }
   },


   handleDocumentStop : function( aRequest, aBrowserObj )
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_PAUSED && gDC._runMode != constants.RUNMODE_RECORD) {
            return;  // exit now if not in record, replay or paused mode
         }

         // update network stop time (always overwrite, last one wins)
         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
            gDC.networkStopTime = Date.now();
         }

         // a document request..
         if (aBrowserObj) {
            aBrowserObj.docsStopped++;
            if (gDC.logger.debugactivity) {
               gDC.logger.logDebug("new document ---stopped: " + aRequest.url);
               gDC.getPendingBrowserInfo();  // show debugging info
            }
         }
/*
         } else {  // not a document request..
            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               if (gDC.isBrowserIdle() && gDC.isNetworkIdle() && !gDC.isBrowserActive()) {
                  // Special case: stop the net timer now if our network and
                  // browser activity profiles match the above special state
                  if (gDC.networkTimeout) gDC.stopNetworkTimeout();
               }
               gDC.lastReadyTimeout = 0;
               gDC.restartReadyTimeout();  // kick off the timer
            }
            return;  // not interested in anything but documents beyond this point
*/


         if (gDC._runMode == constants.RUNMODE_RECORD) {
            //gDC._setWaitType( WAITTYPE_LOADINGDOC );  // clear doc-loading indicators
            gDC._setWaitType( constants.WAITTYPE_STOPPED );  // clear doc-loading indicators
            return;  // exit now when recording
         }

         gDC.trackHttpStep( aRequest );
/*
         if (aStatus != null && gDC.checkAndProcessNetworkErrors( aRequest, aStatus )) {
            return;  // exit now if network error

         } else
*/
         if (aRequest.statusCode != null && gDC.checkAndProcessHttpErrors( aRequest )) {
            return;  // exit now if http error
         }

         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"handleDocumentStop" );
         return;
      }
   },

   trackHttpStep : function( aRequest )
   {
      try {
         var httpStep = gDC.findHttpStep( aRequest );
         if (httpStep == null) {
            // We need to keep track of all httpSteps in order to know when to bump
            // the httpsteps attribute of the event node to match external tracking.

            // create a new httpStep object for tracking httpstep hits
            httpStep = { request   : aRequest,
                         URIspec   : aRequest.url };
            gDC.httpSteps.push( httpStep );

            if (!gDC.resEventNode) { return; }

            // bump the event step counter
            gDC.resEventNode.setAttribute('httpsteps', ++gDC.eventSteps);

            // add the page-preload attrib to the event result node if missing
            if (gDC.userNavigationEvent == 'preload' && !gDC.resEventNode.hasAttribute('preload')) {
               gDC.resEventNode.setAttribute('preload', 'true');
            }
         }
         return;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"trackHttpStep" );
      }
   },


   // retrieve the first http step object matching the specified request
   findHttpStep : function( aRequest )
   {
      try {
         if (!aRequest || !gDC.httpSteps) { return null; }

         var URIspec = aRequest.url;
         if (URIspec) {
            for (var i=0; i < gDC.httpSteps.length; i++) {
               if (aRequest == gDC.httpSteps[i].request && gDC.httpSteps[i].URIspec == URIspec) {
                  return gDC.httpSteps[i];
               }
            }
         }

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"findHttpStep" );
      }
      return null;
   },

   checkAndProcessHttpErrors : function( aRequest )
   {
      try {
         var respStatus;
         if (aRequest == null) {
            return false;
         }
         respStatus = aRequest.statusCode;
         if (respStatus == null) {
            return false;
         }

         if (gDC.shouldSkipRequestError(aRequest.url)) {
            return false;
         }

         // for HTTP failures (non-redirect), we stop playback and update the event statuscode & statusmessage
         if (Number(aRequest.statusCode) >= 400) {
            // attach the http result code to the ancestor event for gui display support

            // check if it can be handled by a matching branching rule
            if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_HTTP_ERROR )) {
               return false;
            }
            gDC.resEventNode.setAttribute('httperrorcode', aRequest.statusCode?aRequest.statusCode:"");

            if (aRequest.statusCode == 401 || aRequest.statusCode == 407) {
               // special hack to bump back the event step counter, since we already bumped it up
               // in http-on-examine-response but we never got the 200 response we were expecting.
               gDC.resEventNode.setAttribute('httpsteps', --gDC.eventSteps);
            }

            // output a (localized) formatted message describing the HTTP error for display
            var httpMessage;
            var strCode = (aRequest.statusCode) ? String(aRequest.statusCode) : "???";
            try {
               // be sure to catch any errors here, as web servers could send us unknown HTTP error codes
               httpMessage = gDC._messageBundle.getMessage( "dcFailure_HTTP" + strCode );
            } catch (ex) {
               httpMessage = "[" + strCode + "] " + gDC._messageBundle.getMessage( "dcFailure_HTTPNUL" );
               gDC.logger.logWarning("nsDejaService: Encountered unknown HTTP code [" + strCode + "], outputing as: " + httpMessage );
            }

            aRequest.requestSucceeded = "false";
            var args = [httpMessage, aRequest.url, aRequest.requestSucceeded, aRequest.statusCode, aRequest.statusLine];
            var messageLong = gDC._messageBundle.getMessage( "dcMessage_replayfailure" ) + " event (" + gDC.replayedEvents + ")" +
                              " - [" + (gDC.subscriptNum ? "subscript " + gDC.subscriptNum : "main script") + "] event " + gDC.actEventNum +
                              " - " + gDC._messageBundle.getMessage( "dcMessage_replayTerminated", false ) +
                              gDC._messageBundle.getMessage("dcFailure_httpErrorLong", args);
            var statusLogID = gDC.logger.logFailure( messageLong, false );

            var messageShort = gDC._messageBundle.getMessage("dcFailure_httpError", [httpMessage]);
            // pass an AlertSite status code of 7 to indicate there was an HTTP server error;
            // status code 7 also tells handlReplayFailure not to decode the pre-formatted message string.
            gDC.logger.logInfo("Replay failure while processing HTTP errors.");
            gDC.handleReplayFailure( "dcFailure_httpError", messageShort, constants.STATUS_HTTP_ERROR, statusLogID );
            return true;
         }

         return false;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"checkAndProcessHttpErrors" );
         return false;
      }
   },

   //------------------------------------------------
   // Handles activities associated with processing a replay Success,
   // including updating the recorded script status and logging messages.
   // Note: this function should only be called if DejaClick is actively
   // replaying a script.  Also note, unlike handleReplayFailure(), this
   // method is called for every successfully processed step, so final
   // user notification of successful script replay isn't done here.
   handleReplaySuccess : function( aMessageID, aMessageString, aReplayComplete )
   {
      try {
         if (!aMessageID) { throw new Error("Invalid message ID."); }

         // bump event counter if needed to prevent array indexing issues
         if (gDC.actEventNum === 0) { gDC.actEventNum = 1; }


         gDC.setSystemBoolPref('DC_OPTID_SUSPENDREPLAY', false);

         var lastEventScriptInfo =  "main script";
         if ( gDC.triggeredScriptFinished != null ) {
            lastEventScriptInfo = "Triggered Subscript "+gDC._triggers[gDC.triggeredScriptFinished].subscript;
         } else if ( gDC.triggerFired != null ) {
            lastEventScriptInfo = "Triggered Subscript "+gDC._triggers[gDC.triggerFired].subscript;
         } else if ( gDC.subscriptNum != null ) {
            lastEventScriptInfo = "Subscript "+gDC.subscriptNum;
         }

         // Get our localized message strings and log a Success message.
         // The statusLogID result gets stamped onto the XML results subtree.
         var statusLogID = 
               gDC.logger.logInfo( gDC._messageBundle.getMessage( "dcMessage_replaysuccess" ) 
                  + " event (" + gDC.replayedEvents + ")" 
                  + " - [" + lastEventScriptInfo + "] event " + gDC.actEventNum 
                  + " - " + gDC._messageBundle.getMessage( aMessageID ), false );

         if ((this.lastTargetSearchId !== -1) &&
               (this.lastTargetDocId !== -1) &&
               this.getEventBoolPref('DC_OPTID_HIGHLIGHTACTIVE',
                  this.actEventNode)) {
            // Update last targeted dom node style to indicate success.
            gDC._observerService.notifyDocument(this.lastTargetDocId,
               'dejaclick:applyStyle',
               {
                  searchId: this.lastTargetSearchId,
                  style: gDC.getEventStringPref('DC_OPTID_ONSUCCESSSTYLE',
                                                gDC.actEventNode)
               });
            gDC.activeStyleApplied = false;
         }

         // update the treeview
         gDC.updateTreeViewNodeState( gDC.actEventNode, gDC.subscriptNum, TREETYPE_CHECK, TREETYPE_PLAY, true,
              !aReplayComplete );

         if (gDC.resEventNode.hasAttribute('statuscode')) {
            // if a statuscode attrib was already assigned, exit now
            // (we never want to overwrite a warning or error status)
            return;
         }

         if (gDC.replayedEvents) {
            // assign our replay attributes to the results tree
//            gDC.assignUETimings();
            gDC.assignStatusAttribs( 0, gDC.REPLAY_SUCCESS, statusLogID, aMessageID, aMessageString );
         }


         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"handleReplaySuccess" );
      }
   },

   /**
    * Assign status diagnostic attributes to the results tree.
    * @this {!DejaClick.DejaService}
    * @param {integer} aStatusCode The DejaClick status code for the event.
    * @param {integer} aStatusType Whether the event resulted in success,
    *    a warning or an error.
    * @param {?string} aStatusLogID Optional log entry to refer to in
    *    the event results.
    * @param {string} aMessageID Name of a localizable message to refer to
    *    in the event results.
    * @param {?string=} aMessageString Optional description of the replay
    *    results to include in the event results.
    */
   assignStatusAttribs : function( aStatusCode, aStatusType, aStatusLogID, aMessageID, aMessageString )
   {
      try {
         if ( ! gDC.resEventNode ) {
            gDC.logger.logWarning("Unable to update the status information at the current event node. The failure probably happened while trying to run the first event.");
            return;
         }
         
         gDC.resEventNode.setAttribute('statuscode', aStatusCode);
         gDC.resEventNode.setAttribute('statustype', aStatusType);
         gDC.resEventNode.setAttribute('statusmsg', aMessageID);
         gDC.resEventNode.setAttribute('statusmsgtext', (aMessageString)?aMessageString:gDC._messageBundle.getMessage( aMessageID ));

         if (aStatusLogID) {
            gDC.resEventNode.setAttribute('statuslogid', aStatusLogID);
         }
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"assignStatusAttribs" );
      }
   },

   setObserverService : function (aObserverService) {
      try {
         gDC._observerService = aObserverService;
      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"setObserverService" );
      }
   },

   getRunModeMessage : function(aData, aTab, aDocId) {
      try {

         //UXM-10587 - If the file list has never been loaded, we have to load it.
         if ( ! gDC._fileListLastUpdate )  {
            gDC.exportAllFileLists();
         }

         var recordFocusEvents = gDC.getSystemBoolPref('DC_OPTID_RECORDFOCUSEVENTS');
         var maxMutations = gDC.getSystemIntPref('DC_OPTID_MUTATIONSLIMIT');
         gDC._observerService.notifyDocument(aDocId, 'dejaclick:runmode', {
            runMode: gDC._runMode,
            eventsCaptured : gDC.eventsCaptured,
            messageOptions : gDC.logger.getMessageOptions(),
            debugOptions : gDC.logger.getDebugOptions(),
            recordFocusEvents : recordFocusEvents,
            fixupThreshold : gDC.fixupThreshold,
            mutationsRecorded : gDC.mutationsRecorded,
            mutationsRequired : gDC.mutationsRequired,
            maxMutations : maxMutations,
            server: gDC._serverOperation,
            filelists: gDC._fileLists,
            filelistsdate: gDC._fileListLastUpdate,
            jsDialogDetection: gDC.getSystemBoolPref( 'DC_OPTID_JS_DIALOG_INJECTION_ENABLED' )
         });

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getRunModeMessage" );
      }
      return true;
   },

   /**
    * The ContentScript log traces are not visible at server side.
    * 
    * This function allows to log at background process the most important log traces that we want
    * to send from the content script.
    * 
    * UXM-11863 - Enhancement to have more visibility of what's happening at the content scripts.
    * 
    * @param {*} aLogLevel 
    * @param {*} aLogTrace 
    * @param {*} aTab 
    * @param {*} aDocId 
    */
   handleContentScriptLogTrace : function(aMessage, aTab, aDocId, aFrameId) {
      try {
         if ( aMessage && aMessage.level && aMessage.message ) {
            switch ( aMessage.level ) {
               case constants.LOG_INFO:
                  gDC.logger.logInfo("[ContentScript][TabId="+(aTab?aTab.id:"tab_undefined")+"][DocId="+aDocId+"][FrameId="+aFrameId+"] "+aMessage.message);
                  break;
               case constants.LOG_FAILURE:
                     gDC.logger.logFailure("[ContentScript][TabId="+(aTab?aTab.id:"tab_undefined")+"][DocId="+aDocId+"][FrameId="+aFrameId+"] "+aMessage.message);
                     break;
               case constants.LOG_WARNING:
                  gDC.logger.logWarning("[ContentScript][TabId="+(aTab?aTab.id:"tab_undefined")+"][DocId="+aDocId+"][FrameId="+aFrameId+"] "+aMessage.message);
                  break;
               case constants.LOG_DEBUG:
                  //NOTE: Not including the "if (gDC.logger.<logtype>)" validation, as I assume that it is validated at the dejaServiceCS.js code.
                  gDC.logger.logDebug("[ContentScript][TabId="+(aTab?aTab.id:"tab_undefined")+"][DocId="+aDocId+"][FrameId="+aFrameId+"] "+aMessage.message);
                  break;
               default:
                  gDC.logger.logInfo("[ContentScript][TabId="+(aTab?aTab.id:"tab_undefined")+"][DocId="+aDocId+"][FrameId="+aFrameId+"][LogLevel="+aMessage.level+"] "+aMessage.message);
                  break;     
            }
         } else {
            gDC.logger.logWarning("handleContentScriptLogTrace - Received invalid message [TabId="+(aTab?aTab.id:"tab_undefined")+"][DocId="+aDocId+"][FrameId="+aFrameId+"][LogLevel="+(aMessage?aMessage.level:"null_aMessage")+"][Message="+(aMessage?aMessage.message:"null_aMessage")+"]");
         }

      } catch ( e ) {
         gDC.logger.logWarning("handleContentScriptLogTrace - Unexpected error processing ContentScript log trace: "+e);
      } 
   },

   /**
    * Get the current run mode (synchronously).
    * @this {!DejaClick.DejaService}
    * @return {integer} The current run mode.
    */
   getRunMode: function () {
      try {
         return this._runMode;
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getRunMode" );
      }
   },

   setRecodingVar : function(bool){
      this._isrecording = bool;
   },

   setAppendingVar : function(bool){
      this._isAppending = bool;
   },
   /**
    * Map externally requested (operational) runMode values to
    * internal runType function calls.
    * @this {!DejaClick.DejaService}
    * @param {integer} aNewMode The new run mode.
    * @param {boolean=} aDisableNotification If true, do not display
    *    a replay stopped notification to the user when setting the run
    *    mode to stopped.
    */
   setRunMode : function( aNewMode, aDisableNotification )
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("inside setRunMode (current mode: " + gDC._runMode + ", requested mode: " + aNewMode + ")"); }
         if (gDC._runMode == constants.RUNMODE_SUSPEND) {
            // if currently in suspend mode, any mode change will first resume normal activities
            gDC._handleResumeMode();
         }

         switch (aNewMode) {
         case constants.RUNMODE_INACTIVE:
            /*
            // @todo Define checkChanges
            if (!gDC.checkChanges()) {
               return;  // operation cancelled
            }
            */
            gDC._setRunType( constants.RUNTYPE_INACTIVE );
            break;
         case constants.RUNMODE_STOPPED:

            var eventCount;
            if (gDC._runMode == constants.RUNMODE_RECORD) {
               eventCount = gDC.eventsCaptured ? gDC.eventsCaptured.length : 0;
            } else {
               eventCount = gDC._totalEventCount;
            }
            var notifyUser = aDisableNotification ? false : true;
            if (eventCount) {
               gDC._setRunType( constants.RUNTYPE_STOPLOADED, false, notifyUser );
            } else {
               gDC._setRunType( constants.RUNTYPE_STOPNOSCRIPT, false, notifyUser );
            }
            gDC.pendingNetwork = false;
            gDC.pendingXMLRequest = false;
            break;
             
         case constants.RUNMODE_RECORD:
/*
            // advise users before recording when SimNewVisitor option not enabled
            if (!gDC.getSystemBoolPref(DC_OPTID_USENEWVISITOR) && !gDC.newVisitorCheck) {
               if (gDC.promptNewVisitorDisabled()) {
                  return CR.NS_OK;  // operation cancelled ("more info" option was chosen)
               }
               gDC.newVisitorCheck = true;
            }
*/
            if (gDC._runMode == constants.RUNMODE_PAUSED) {
               gDC._setRunType( constants.RUNTYPE_RECORDAPPEND );
            } else {
               if(gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_DEFAULT){
                  gDC._setRunType( constants.RUNTYPE_RECORDNEW);
               } else {
                  //UXM-11847 - Recording append requires to have a replayed script. 
                  if (!gDC._script) {
                     gDC.logger.logWarning("No script loaded while trying to append recording. Replay required!");
                     gDC.alertUser( "dcMessage_replayBeforeAppend", true, false );
                     return;
                  }
                  gDC._setRunType( constants.RUNTYPE_RECORDAPPEND);
               }
            }
            break;
         case constants.RUNMODE_REPLAY:
            gDC._setRunType( constants.RUNTYPE_REPLAY );
            break;
         case constants.RUNMODE_RECORD_APPEND:
            //If we are inserting a recording without replaying then DejaClick needs to replay up to the point of insertion
            if(gDC._runState.split('Stopped').length > 1){
               gDC._setRunType( constants.RUNTYPE_REPLAY );
            } 
            gDC._setRunType( constants.RUNTYPE_RECORDAPPEND );
            break;
         case constants.RUNMODE_PAUSED:
            gDC._setRunType( constants.RUNTYPE_PAUSED );
            break;
         case constants.RUNMODE_SUSPEND:
            gDC._handleSuspendMode();
            break;
         case constants.RUNMODE_RESUME:
            break;  // already handled above
         default:
            throw new Error("Invalid run mode specified (" + aNewMode + ")");
         }

         var maxMutations = gDC.getSystemIntPref('DC_OPTID_MUTATIONSLIMIT');
         gDC._observerService.notifyObservers("dejaclick:runmode", 
            {
               runMode : gDC._runMode, 
               eventsCaptured : gDC.eventsCaptured,
               maxMutations : maxMutations,
               server: gDC._serverOperation,
               jsDialogDetection: gDC.getSystemBoolPref( 'DC_OPTID_JS_DIALOG_INJECTION_ENABLED' )
            });

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"setRunMode", "Unable to update internal run mode state." );
      }
   },

   // used during replay to jump to the given event num on the given subscript
   _setCurrentEvent : function( aSubscriptNum, aEventNum, aNextEventInfo )
   {
      try {
         if (aSubscriptNum != gDC.subscriptNum) {
            gDC.subscriptNum = (aSubscriptNum) ? aSubscriptNum : 0;
            gDC.actTreeRoot = gDC._actTreeRoots[ gDC.subscriptNum ];
            gDC.actEventNodes = gDC.actTreeRoot.getElementsByTagName("event");
            gDC.subscriptNode =  (aSubscriptNum) ? gDC.actTreeRoot.parentNode : null;
         }

         gDC.actEventNum = (aEventNum) ? aEventNum : 1;
         gDC.actEventNode = gDC.actEventNodes[ gDC.actEventNum-1];

         //UXM-10759 - If there is a "downloads" attribute we have to increment the number of expected downloads.
         if ( gDC._script.domTreeHasEventParam( gDC.actEventNode, "downloads") ) {
            var downloadsOfEvent = parseInt(gDC._script.domTreeGetEventParam( gDC.actEventNode, "downloads" ));
            gDC.expectedDownloads += downloadsOfEvent;

            var timeOut = gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode);
                  gDC._setTimeout(
                     gDC.onDownloadTimeout.bind(gDC, -1),
                     timeOut);
         }

         gDC.actActionNode = gDC.actEventNode.parentNode;
         
         // UXM-13804 - Updating the actual script node, and notifying the UI for some visual changes
         if(gDC.actScriptNode != gDC.actActionNode.parentNode.parentNode){

            if(gDC.actScriptNode != null){
               if(gDC.actScriptNode.tagName == "script"){
                  gDC._observerService.notifyObservers('dejaclick:updatetabstate', "1:script" );
               }else{
                  gDC._observerService.notifyObservers('dejaclick:updatetabstate', gDC.actScriptNode.getAttribute("seq")+":subscript" );
               }
            }
         
            gDC.actScriptNode = gDC.actActionNode.parentNode.parentNode;
            gDC.actScriptNode.tagName == "subscript" ? gDC._observerService.notifyObservers('dejaclick:handlescripttabfrombackground', {hashkey: gDC.actScriptNode.getAttribute("seq")+":subscript", state: "continue"} ) : null;
         }

         gDC.actActionNum = Number(gDC.actActionNode.getAttribute('seq'));

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"_setCurrentEvent" );
      }

   },

   //------------------------------------------------
   teardownAsyncTimers : function()
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("clearing all async timers and timeouts..."); }
/*
         // restore all browser windows to their original sizes/positions now
         // since we are about to kill the timer that would have done it later.
         if (gDC.restoreDeferred) {
            gDC.restoreDeferred = false;
            gDC.restoreBrowserWindows();
         }
*/
         gDC._clearAll();

         gDC.eventTimeout = null;
         gDC.readyTimeout = null;
         gDC.replayTimeout = null;
         gDC.statusTimeout = null;
         gDC.responseTimeout = null;
         gDC.shutdownTimeout = null;
         gDC.networkTimeout = null;
         gDC.locationsTimeout = null;
         gDC.navigationTimeout = null;
         gDC.mutationsDelay = null;
         gDC.mutationBeginTimeout = null;
         gDC.mutationEndTimeout = null;
         gDC.replayFailureTimeout = null;
         gDC.quitApplicationTimeout = null;
         gDC.finalizeStateTimeout = null;
         gDC.popupBlockerTimeout = null;
         gDC.domFixupTimeout = null;
         gDC.validationTimeout = null;
         gDC.stopRecordReplayTimeout = null;
         gDC.onCompletedTimeout = null;

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"teardownAsyncTimers" );
      }
   },


   //------------------------------------------------
   // Reset network activity flags
   resetActivity : function()
   {
      try {
         gDC.pendingActivity = false;
         gDC.pendingNetwork = false;
         gDC.pendingXMLRequest = false;
         gDC.netActivityCount = 0;

         for (var i=0; i < gDC.browsersTracked.length; i++) {
            gDC.browsersTracked[i].contentIsLoaded = true;
            gDC.browsersTracked[i].networkActivity = 0;
            gDC.browsersTracked[i].docsRequested = 0;
            gDC.browsersTracked[i].docsStarted = 0;
            gDC.browsersTracked[i].docsStopped = 0;
            gDC.browsersTracked[i].docsLoaded = 0;
         }

         for (var j=0; j < gDC.browsersIgnored.length; j++) {
            gDC.browsersIgnored[j].contentIsLoaded = true;
            gDC.browsersIgnored[j].networkActivity = 0;
            gDC.browsersIgnored[j].docsRequested = 0;
            gDC.browsersIgnored[j].docsStarted = 0;
            gDC.browsersIgnored[j].docsStopped = 0;
            gDC.browsersIgnored[j].docsLoaded = 0;
         }

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"resetActivity" );
      }
   },

   stopBrowserActivity : function()
   {
      gDC._observerService.notifyObservers("dejaclick:stopactivity");
   },

   stopRecordReplay : function()
   {
      try {
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("stopping script record/replay"); }

         gDC.userNavigationEvent = null;
         gDC.requestedURL = null;
         gDC.finalizedURL = null;
         gDC.onCompletedReceived = false;
         gDC._clearTimeout(gDC.onCompletedTimeout);
         gDC.onCompletedTimeout = null;
         gDC.pendingLocations = 0;
         gDC.attempt = 0;
         gDC.tabDetachCounter = [];
         
         if (gDC.isExecutionSuspended()) {
            gDC.restartStopRecordReplayTimeout(gDC.DC_OPTVAL_STOPRECORDREPLAYDELAY);
            return;
         }
         
         gDC.stopStopRecordReplayTimeout();
         
         if (gDC.simulateMobile) {           
            for (var tab in gDC.m_debuggerAttached) {
               gDC.stopMobileSimulation(Number(tab), gDC.stopMobileSimulationResponse.bind(gDC, Number(tab)));
            }
         }
         else {
            gDC.detachAllChromeDebuggers ();
         }
         
         gDC._setWaitType( constants.WAITTYPE_STOPPING );
/*
         gDC.deleteImportedExtDS();
         gDC.deleteExportedFileLists();
*/

         gDC.stopBrowserActivity();
         gDC.teardownListeners();
/*
         gDC.wipeDocFingerprints();

         var autoPowerOff = gDC.getSystemBoolPref( 'DC_OPTID_AUTOPOWEROFF');
         if (!gDC.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') ||
             !gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE') ||
             (autoPowerOff && !gDC.advisorRepairs)) {

            gDC.restoreBrowserWindows();
         }


         // Else windows remain as they are (e.g. the mobile sidebar remains open)
         // until after the user has been notified that recording/replay has stopped.

         if (gDC._runMode ==constants.RUNMODE_RECORD) {
            // if any screen events were just recorded, disable the hideflash option
            var nodeList = gDC.processXPath(gDC._domTreeRoot, "descendant::event[@screen='true']");
            if (nodeList && nodeList.length) {
               // set at the script-level to prevent issues during server replay
               gDC.setScriptBoolPref( DC_OPTID_HIDEFLASH, false );
            }
         }

         // After record/replay, some of our pref settings should be maintained,
         // so we must save off these special prefs to temporary arrays so we can
         // restore (potentially modified) values after the restoreState command.
         var pref, prefname, prefvalue;
         var boolPrefsTmp = {};
         for (pref in gDC._boolPrefsP) {
            prefname = gDC._boolPrefsP[pref];
            boolPrefsTmp[prefname] = gDC.getSystemBoolPref(prefname);
         }
         var intPrefsTmp = {};
         for (pref in gDC._intPrefsP) {
            prefname = gDC._intPrefsP[pref];
            intPrefsTmp[prefname] = gDC.getSystemIntPref(prefname);
         }
         var charPrefsTmp = {};
         for (pref in gDC._charPrefsP) {
            prefname = gDC._charPrefsP[pref];
            charPrefsTmp[prefname] = gDC.getSystemStringPref(prefname);
         }

         // reload dejaclick system settings
         gDC.loadSystemPrefs();

         // restore browser preferences, cookies and plugin state
         gDC._utils.restoreState();

         // now reapply the stored values from above
         for (pref in gDC._boolPrefsP) {
            prefname = gDC._boolPrefsP[pref];
            prefvalue = boolPrefsTmp[prefname];
            gDC.setSystemBoolPref(prefname, prefvalue);
         }
         for (pref in gDC._intPrefsP) {
            prefname = gDC._intPrefsP[pref];
            prefvalue = intPrefsTmp[prefname];
            gDC.setSystemIntPref(prefname, prefvalue);
         }
         for (pref in gDC._charPrefsP) {
            prefname = gDC._charPrefsP[pref];
            prefvalue = charPrefsTmp[prefname];
            gDC.setSystemStringPref(prefname, prefvalue);
         }
*/
         // This is asynchronous. Do we need to wait for it to complete?
         gDC._utils.cookieManager.revealCookies();

         //UXM-10002
         if ( gDC.customCookies && gDC.customCookies.length > 0 ) {
            for (var i = 0; i < gDC.customCookies.length; ++i) {
               this._utils.cookieManager.restoreCookie(gDC.customCookies[i]);
            }
         }

         // Clear browser settings applied by the extension.
         // These calls are asynchronous, too.
         if ( chrome.contentSettings ) {
            chrome.contentSettings.cookies.clear({});
            chrome.contentSettings.popups.clear({});

            // Allow popups from Alertsite.com
            chrome.contentSettings.popups.set({
               primaryPattern: "*://*.alertsite.com/*",
               setting: 'allow'
               }, null
            );
         } else {
            //TODO Firefox Quantum UXM-11026
         }
         
         // reload and rebroadcast our normal system-level logging options
         // (since they may have been overridden by script-level settings)
         var messageOptions = gDC.getSystemStringPref("DC_OPTID_LOGMESSAGE");
         if (!messageOptions) {
            messageOptions = gDC._prefs.getDefault('DC_OPTID_LOGMESSAGE');
         }
         gDC.logger.setMessageOptions( messageOptions );
         gDC._observerService.notifyObservers("dejaclick:messageoptions", messageOptions );

         var debugOptions = gDC.getSystemStringPref("DC_OPTID_LOGDEBUG");
         if (!debugOptions) {
            debugOptions = gDC._prefs.getDefault('DC_OPTID_LOGDEBUG');
         }
         gDC.logger.setDebugOptions( debugOptions );
         gDC._observerService.notifyObservers("dejaclick:debugoptions", debugOptions );

         // finish things up
         gDC._setWaitType( constants.WAITTYPE_STOPPED );
       
       gDC.clearProxySettings();
       
         if (gDC.logger.debugprocess) { gDC.logger.logDebug("script record/replay now stopped"); }
/*
         // If we are in UE client mode, reset the replay user experience mode setting.
         if (!gDC._serverOperation && gDC.getEventBoolPref('DC_OPTID_REPLAYUE')) {
            gDC.resetSystemBoolPref(DC_OPTID_REPLAYUE);
         }
*/
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"stopRecordReplay" );
      }
   },

   /**
    * Get the reason for suspending replay.
    * @this {!DejaClick.DejaService}
    * @return {string} The reason (either '' or 'validation').
    */
   getSuspendType: function() {
      return this._suspendType;
   },

   /**
    * Set the reason for suspending replay.
    * @this {!DejaClick.DejaService}
    * @param {string} aType The reason (either '' or 'validation').
    */
   setSuspendType: function(aType) {
      this._suspendType = aType;
   },

   // set deja's (progress) wait type and notify observers
   // note: setting the wait type automatically updates the wait mode
   /** @param {boolean=} aInitialize */
   _setWaitType : function( aNewType, aInitialize )
   {
      try {
         if (gDC._waitType == aNewType) {
            return;  // no change, just exit
         }

         // set the new wait type
         gDC._waitType = aNewType;

         switch (aNewType) {
         case constants.WAITTYPE_INACTIVE:
         case constants.WAITTYPE_STOPPED:
            if (gDC._waitMode !=  constants.WAITMODE_READY) {
               gDC._waitMode =  constants.WAITMODE_READY;  // set the new wait mode
            }
            break;
         case constants.WAITTYPE_PAUSED:
            var browserBusy = false;
            // determine if any tracked browser are busy
            for (var i=0; i < gDC.browsersTracked.length; i++) {
               if (gDC.browsersTracked[i].networkActivity > 0) {
                  browserBusy = true;
                  break;
               }
            }
            if (gDC._waitMode !=  constants.WAITMODE_READY && !browserBusy) {
               gDC._waitMode =  constants.WAITMODE_READY; // set the new wait mode
            } else {
               gDC._waitMode =  constants.WAITMODE_BUSY;  // set the new wait mode
            }
            break;

         default:
            if (gDC._waitMode !=  constants.WAITMODE_BUSY) {
               gDC._waitMode =  constants.WAITMODE_BUSY;  // set the new wait mode
            }
            break;
         }

         // update our waitState data and optionally notify observers
         gDC._updateWaitState( aInitialize );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"_setWaitType", "Unable to update internal waitType state." );
      }
   },


   // set the deja's (operational) run type and notify observers
   // note: setting the run type automatically updates the run mode;
   // we always process every call, since we might be updating our
   // current record/replay node counts.
   /**
    * @param {boolean=} aInitialize
    * @param {boolean=} aNotifyUser
    */
   _setRunType : function( aNewType, aInitialize, aNotifyUser )
   {
      try {
      // delegate runType processing to individual handlers
         switch (aNewType) {
         case constants.RUNTYPE_INACTIVE:
            gDC._runType = aNewType;
            gDC._handleInactiveMode();
            break;
         case constants.RUNTYPE_STOPABORTED:
         case constants.RUNTYPE_STOPNOSCRIPT:
         case constants.RUNTYPE_STOPLOADED:
            gDC._handleStoppedMode( aNotifyUser );
            gDC._runType = aNewType;
            break;
         case constants.RUNTYPE_RECORDNEW:
         case constants.RUNTYPE_RECORDAPPEND:
            gDC._runType = aNewType;
            gDC._handleRecordMode();
            break;
         case constants.RUNTYPE_REPLAY:
            gDC._runType = aNewType;
            gDC._handleReplayMode();
            break;
         case constants.RUNTYPE_PAUSED:
            gDC._runType = aNewType;
            gDC._handlePausedMode();
            break;

         default:
            throw new Error("Invalid runType specified (" + aNewType + ")");
         }

         // update our runState data and optionally notify observers
         gDC._updateRunState( aInitialize );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"_setRunType", "Unable to update internal runType state." );
      }
   },

   _handleInactiveMode : function()
   {
      try {
         gDC.resetRecordReplayVars();
         gDC._runMode = constants.RUNMODE_INACTIVE;
         return;

      } catch ( e ) {
         throw new Error("Error in _handleInactiveMode: " + e);
      }
   },


   _handleStoppedMode : function( aNotifyUser )
   {
      try {
         var notifymsg;

         switch (gDC._runMode) { // check current mode
         case constants.RUNMODE_REPLAY:
         case constants.RUNMODE_PAUSED:
            // Don't consolidate the following call, it sets the new run mode for us,
            // but we also need to know what mode we are in BEFORE it gets changed.
            gDC.stopRecordReplay();
            gDC._runMode = constants.RUNMODE_STOPPED;

            // convert any pending play or paused tree icons back to normal status
            gDC.updateTreeViewState( TREETYPE_NORM, TREETYPE_PLAY );
            gDC.updateTreeViewState( TREETYPE_NORM, TREETYPE_PAUSE );

            if (aNotifyUser && gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE')) {
               // construct a user notification string
               var args = [gDC.replayedEvents, gDC._totalEventCount];
               notifymsg = gDC._messageBundle.getMessage("dcMessage_replayStopped", args);
               if (gDC.logger.debugprocess) { gDC.logger.logDebug( "Replay stopped by user after " + gDC.replayedEvents + " events" ); }
            }

            break;

         case constants.RUNMODE_RECORD:
            gDC.setReplayHints( true );  // take care of a little final housekeeping from the previous event
            gDC.stopRecordReplay();  // refer to the anti-consolidation note above
            gDC._runMode = constants.RUNMODE_STOPPED;

            if (gDC._runType == constants.RUNTYPE_RECORDNEW) {
               if (gDC.recordedEvents === 0) {
                  // reset the total event count
                  gDC._totalEventCount = 0;

                  // reset the encountered mime types and urls array
                  gDC._encounteredUrls = {};
                  gDC._encounteredMimes = {};
                  gDC._actionLabel = {};

                  // Remove the empty script.
                  gDC.purgeReplayData();
                  gDC.purgeRecordData();
                  gDC._script = null;
                  gDC._fileLists = null;
                  gDC._fileListLastUpdate = null;
                  gDC._scriptPath = null;
                  gDC._triggeredSubscripts = null;
                  gDC._triggers = null;
                  gDC._mfaInfo = null;
                  gDC.waitingForMFAvalue = null;
                  gDC.triggerFired = null;
                  gDC.triggeredScriptFinished = null;
                  gDC.triggeredSubscriptPrevNode = null;
                  gDC.triggeredScriptNextEvent = null;
                  gDC.waitingForTriggerKeywordResult = null;
                  DejaClick.setScript(null);

                  // flush any incomplete treeview data refresh all treeviews
                  gDC.updateTreeViews();

                  if (aNotifyUser && gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE')) {
                  // construct a user notification string
                     notifymsg = gDC._messageBundle.getMessage("dcMessage_recordIncomplete", [gDC.recordedEvents]);
                     if (gDC.logger.debugprocess) { gDC.logger.logDebug( notifymsg ); }
                  }

               } else {
                  // update the total event count
                  gDC._totalEventCount = (gDC._script != null) ? gDC._script.getTotalEventCount() : 0;

                  if (aNotifyUser && gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE')) {
                     // construct a user notification string
                     notifymsg = gDC._messageBundle.getMessage("dcMessage_recordComplete", [gDC.recordedEvents]);
                     if (gDC.logger.debugprocess) { gDC.logger.logDebug("recording stopped by user after " + gDC.recordedEvents + " events"); }
                  }
               }
            } else if (gDC._runType == constants.RUNTYPE_RECORDAPPEND) {
               if (gDC.recordedEvents === 0) {

                  if (gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_SUBSCRIPT) {
                     // remove the empty subscript node that was added
                     // (or the entire subscripts root node if this is the only subscript present)
                     var emptyActTree = gDC._actTreeRoots.pop();
                     var subscriptNode = emptyActTree.parentNode;
                     var subscriptsNode = subscriptNode.parentNode;
                     var nodeToDelete = (subscriptsNode.childNodes.length == 1) ? subscriptsNode : subscriptNode;
                     gDC._script.domTreeRemoveNode( nodeToDelete );

                     // reset the action tree root back to the main script
                     gDC.subscriptNum = 0;
                     gDC.subscriptNode = null;
                     gDC.actTreeRoot = gDC._actTreeRoots[0];
                     gDC.actEventNodes = gDC.actTreeRoot.getElementsByTagName("event");
                  }

                  if (aNotifyUser && gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE')) {
                     // construct a user notification string
                     notifymsg = gDC._messageBundle.getMessage("dcMessage_appendIncomplete", [gDC.recordedEvents]);
                     if (gDC.logger.debugprocess) { gDC.logger.logDebug( notifymsg ); }
                  }

               } else {
                  // update the total event count
                  gDC._totalEventCount = (gDC._script != null) ? gDC._script.getTotalEventCount() : 0;

                  if (aNotifyUser && gDC.getSystemBoolPref('DC_OPTID_NOTIFYCOMPLETE')) {
                     // construct a user notification string
                     notifymsg = gDC._messageBundle.getMessage("dcMessage_appendComplete", [gDC.recordedEvents]);
                     if (gDC.logger.debugprocess) { gDC.logger.logDebug("recording stopped by user after appending " + gDC.recordedEvents + " events"); }
                  }
               }
            }

            break;

         case constants.RUNMODE_STOPPED:
         case constants.RUNMODE_INACTIVE:
            // user notifications not needed
            gDC._runMode = constants.RUNMODE_STOPPED;
            break;
         default:
            break;
         }

         var autoPowerOff = gDC.getSystemBoolPref('DC_OPTID_AUTOPOWEROFF');
         if (aNotifyUser && notifymsg && !(autoPowerOff && !gDC.advisorRepairs)) {
            // notify user whenever we stop replay/record activities,
            // unless the autopoweroff option is set and there were
            // no replay advisor script repairs.
            gDC.notifyUserAndRestoreBrowserWindows( notifymsg, false );
         }

         return;

      } catch ( e ) {
         throw new Error("Error in _handleStoppedMode: " + e);
      }
   },

   _handleRecordMode : function()
   {
      try {
         switch (gDC._runMode) { // check current mode
            case constants.RUNMODE_STOPPED:
               if(gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_DEFAULT){
                  // update run mode and begin recording
                  gDC._runMode = constants.RUNMODE_RECORD;
                  gDC.eventsEnabled = true;
                  // Mark existing pages as inactive.
                  gDC._observerService.notifyObservers('dejaclick:markinactive', null);
                  // (a timer is used to allow the sidebar to display sooner)
                  gDC._setTimeout( function(){gDC.begin();}, 50 );
               } else {
                  gDC._runMode = constants.RUNMODE_RECORD;
                  gDC.eventsEnabled = true;
                  gDC.appendRecording();
               }
               break;

            case constants.RUNMODE_SUSPEND:
               gDC._runMode = constants.RUNMODE_RECORD;
               gDC.eventsEnabled = true;
               break;

            case constants.RUNMODE_PAUSED:
               gDC._runMode = constants.RUNMODE_RECORD;
               gDC.eventsEnabled = true;
               gDC.appendRecording();
               break;

            case constants.RUNMODE_RECORD:
            case constants.RUNMODE_REPLAY:
            case constants.RUNMODE_INACTIVE:
               /* falls through */
            default:
               break;  // invalid run mode
         }
         return;

      } catch ( e ) {
         throw new Error("Error in _handleRecordMode: " + e);
      }
   },

//    sets sidebar elements

   setSidebarElements : function(elements){
      gDC.sidebarElements = elements;
   },

   _handleReplayMode : function()
   {
      try {
         switch (gDC._runMode) { // check current mode
         case constants.RUNMODE_STOPPED:
            // Mark existing pages as inactive.
            gDC._observerService.notifyObservers('dejaclick:markinactive', null);
            // update run mode and begin playback
            // (a timer is used to let the browser finish any tabbed mode processing)
            gDC._runMode = constants.RUNMODE_REPLAY;
            gDC._setTimeout( function(){gDC.begin();}, 50 );
            gDC.replayedEvents = 0;
            gDC.replayedActions = 0;
            gDC.actEventNum = 0;
            gDC.subscriptNum = 0;
            gDC.subscriptNode = null;
            break;

         case constants.RUNMODE_PAUSED:
         case constants.RUNMODE_SUSPEND:
            // update run mode and continue playback
            gDC._setWaitType( constants.WAITTYPE_INITIALIZING );
            gDC._runMode = constants.RUNMODE_REPLAY;

            // reset some things, then reactivate event replay
            gDC.updateTreeViewState( TREETYPE_PLAY, TREETYPE_PAUSE );
            gDC.thinktimeStart = 0;  // reset replay hints to prevent getting stuck
            gDC.thinktimeStop = 0;
            gDC.networkStopTime = 0;
            gDC.pendingLocations = 0;
            gDC.resetActivity();
            gDC.mutationsRecorded = 0;
            gDC.eventsEnabled = true;
            if (gDC.actEventNum != gDC.navEventNum) {
               gDC.actEventNum = gDC.navEventNum;
            }

            this.pendingDispatch = false;
            this.pendingDispatchInfo = null;

            gDC.replayNextEvent();

            break;

         case constants.RUNMODE_REPLAY:
            //UXM-10578 - Just for Client mode (side bar exists)
            // The sidebarElements variable doesn't exist in server extension
            if ( gDC.sidebarElements ) {
               var notifymsg = gDC._messageBundle.getMessage("dcMessage_replaying", [gDC.actEventNum,gDC._totalEventCount]);
               gDC.sidebarElements.replayEventStatusContainer.empty();
               gDC.sidebarElements.replayEventStatusContainer.append('<span>' + notifymsg + '</span>');
               var eventType = gDC.actEventNode.getAttribute('type');
               gDC.sidebarElements.replayEventTypeContainer.empty();
               gDC.sidebarElements.replayEventTypeContainer.append('<span>' + eventType + '</span>');
            }
            break;   // do nothing

         case constants.RUNMODE_RECORD:
         case constants.RUNMODE_INACTIVE:
            /* falls through */
         default:
            break;  // invalid run mode
         }
         return;

      } catch ( e ) {
         throw new Error("Error in _handleReplayMode: " + e);
      }
   },

   _handlePausedMode : function()
   {
      try {
         switch (gDC._runMode) { // check current mode
         case constants.RUNMODE_REPLAY:
            // update run mode and pause all playback activities
            gDC._setWaitType( constants.WAITTYPE_PAUSING );
            gDC._runMode = constants.RUNMODE_PAUSED;
            // stop all active timers
            gDC.teardownAsyncTimers();
            // convert any pending play tree icons to paused status
            gDC.updateTreeViewState( TREETYPE_PAUSE, TREETYPE_PLAY );
       if (gDC.lastPausedNode && gDC.lastPausedNode.breakpoint) {
            // if appendmode remove all the events after the selected event ans starting appending the new recording
            if(gDC.lastPausedNode.breakpointType == constants.BREAKPOINT_RECORD_APPEND){
                  // check if lastpausedNode is the last node and toggle the warning message accordingly

                  // selected event is not the last event
                  gDC._utils.promptService.confirmUser(
                        {
                        question: 'deja_sidebar_confirmOverwriteRecording',
                        buttons: [ 'deja_global_btn_ok', 'deja_global_btn_cancel' ]
                        },
                        function(selectedButtonIndex) {
                        if (selectedButtonIndex === 0) {
                              var i;
                              var nodesToDelete = [];
                              var curr_event = gDC.actEventNode;
                        
      
                              if (gDC.actActionNum) {
                                    var actionNodes = gDC.actTreeRoot.getElementsByTagName('action');
                                    for (i=0; i < actionNodes.length; i++) {
                                          if (Number(actionNodes[i].getAttribute('seq')) > gDC.actActionNum) {
                                                nodesToDelete.push(actionNodes[i]);
                                          }
                                    }
                              }
                              // and by discarding all events that come after the current event.
                              if (gDC.actActionNode && gDC.actEventNum) {
                                    var eventNodes = gDC.actActionNode.getElementsByTagName('event');
                                    for (i=0; i < eventNodes.length; i++) {
                                          if (Number(eventNodes[i].getAttribute('seq')) > gDC.actEventNum) {
                                                nodesToDelete.push(eventNodes[i]);
                                          }
                                    }
                              }
                              for (i in nodesToDelete) {
                                    if (nodesToDelete.hasOwnProperty(i)) {
                                    gDC._script.domTreeRemoveNode(nodesToDelete[i]);
                                    }
                              }
                              if (curr_event && curr_event.breakpoint && curr_event.breakpointType == constants.BREAKPOINT_RECORD_APPEND ) {
                                    curr_event.breakpoint = false;
                                    curr_event.breakpointType = constants.BREAKPOINT_TYPE_NONE;
                              }
                              gDC.setRunMode(constants.RUNMODE_RECORD);  
                        }
                  });
                  
                  gDC.lastPausedNode.breakpoint = false;
                  gDC.lastPausedNode.breakpointType = constants.BREAKPOINT_TYPE_NONE;
                  gDC.lastPausedNode = null;
                  gDC.sidebarElements.appendModeOverwrite.hide();
                  gDC.sidebarElements.continueAppend.show();
            } 
            else if(gDC.lastPausedNode.breakpointType == constants.BREAKPOINT_RECORD_INSERT){
                  gDC.lastPausedNode.breakpoint = false;
                  gDC.lastPausedNode.breakpointType = constants.BREAKPOINT_TYPE_NONE;
                  gDC.lastPausedNode = null;
                  gDC.setRunMode(constants.RUNMODE_RECORD);  
            }
            
            
//             gDC._setTimeout( function(){gDC.setRunMode(constants.RUNMODE_RECORD);}, 1000);   
       } 

            // begin looping until all activity stops
            gDC.areWeThereYet();
            break;

         case constants.RUNMODE_STOPPED:
         case constants.RUNMODE_RECORD:
         case constants.RUNMODE_PAUSED:
         case constants.RUNMODE_INACTIVE:
            /* falls through */
         default:
            break;  // invalid run mode
         }
         return;

      } catch ( e ) {
         throw new Error("Error in _handlePausedMode: " + e);
      }
   },

   _handleSuspendMode : function()
   {
      try {
         // suspend is a pseudo-mode that affects the current
         // run type's behavior but doesn't change it.
         switch (gDC._runType) { // check current run type
         case constants.RUNTYPE_RECORDNEW:
         case constants.RUNTYPE_RECORDAPPEND:
         case constants.RUNTYPE_PAUSED:
            gDC._runMode = constants.RUNMODE_SUSPEND;
            gDC.eventsEnabled = false;
            break;

         case constants.RUNMODE_STOPPED:
            // used to suspend page event processing when linking
            // notes to page elements and not in record/replay mode
            gDC._runMode = constants.RUNMODE_SUSPEND;
            gDC.eventsEnabled = false;
            break;

         default:
            break;  // invalid run mode
         }
         return;

      } catch ( e ) {
         throw new Error("Error in _handleSuspendMode: " + e);
      }
   },

   _handleResumeMode : function()
   {
      try {
         // resume is a pseudo-mode that affects the current
         // run type's behavior but doesn't change it.
         gDC.eventsEnabled = true;

         if (gDC._suspendType == "validation") {
            // notify observers to disable validation mode
            gDC._observerService.notifyObservers("dejaclick:validationmode", {enabled: false});
         }
         gDC._suspendType = "";

         switch (gDC._runType) { // check current run type
         case constants.RUNTYPE_RECORDNEW:
         case constants.RUNTYPE_RECORDAPPEND:
            gDC._runMode = constants.RUNMODE_RECORD;
            break;
         case constants.RUNTYPE_REPLAY:
            gDC._runMode = constants.RUNMODE_REPLAY;
            break;
         case constants.RUNTYPE_PAUSED:
            gDC._runMode = constants.RUNMODE_PAUSED;
            break;
         case constants.RUNTYPE_STOPABORTED:
         case constants.RUNTYPE_STOPNOSCRIPT:
         case constants.RUNTYPE_STOPLOADED:
            gDC._runMode = constants.RUNMODE_STOPPED;
            break;
         default:
            break;  // invalid run mode
         }

      } catch ( e ) {
         throw new Error("Error in _handleResumeMode: " + e);
      }
   },

   // notify all observers of a new waitState (optionally accepts a variable number of unamed args)
   _updateWaitState : function( aInitialize )
   {
      try {
         if (!gDC._systemBundle) { return; }  // during hard shutdown, just exit

         var args = [];
         // while run mode is paused or pausing, accept only constants.WAITTYPE_PAUSING or constants.WAITTYPE_PAUSED notifications
         if (gDC._runMode == constants.RUNMODE_PAUSED &&
             gDC._waitType != constants.WAITTYPE_PAUSING &&
             gDC._waitType != constants.WAITTYPE_PAUSED) {
            return;
         }

         // begin assembling a new waitState status string
         gDC._waitState = String(gDC._waitMode) + "||" + String(gDC._waitType) + "||";

         // note: we currently don't use extra format args or payload
         // data for waitState but this situation could easily change.
         // if/when it does, add them here.
         // args.push( ... );

         // get the associated waitType property string (localized)
         var propString = gDC._waitTypeProperties[ gDC._waitType ];

         // attach the waitState status property string, with optionally formatted args
         try {
            if (args.length) {
               gDC._waitState += gDC._systemBundle.getMessage( propString, args);
            } else {
               gDC._waitState += gDC._systemBundle.getMessage( propString );
            }
         } catch( e ) {
            //TODO Firefox Quantum UXM-11026 - This seems to be happening just with Firefox
            gDC.logger.logWarning("Unexpected error trying to get message: "+propString+": "+e);
         }
         

         if (!aInitialize) {
            // ship the updated status string to all observers
            gDC._observerService.notifyLocalObservers("dejaclick:waitstate", gDC._waitState );
         }
         return;

      } catch ( e ) {
         throw new Error("Error in _updateWaitState: " + e);
      }
   },


   // notify all observers of a new runState (optionally accepts a variable number of unamed args)
   _updateRunState : function( aInitialize )
   {
      try {

         if (!gDC._systemBundle) { return; }  // during hard shutdown, just exit

         var args = [];
         // begin assembling a new runState status string
         gDC._runState = String(gDC._runMode) + "||" + String(gDC._runType) + "||";

         // use the number of events recorded/replayed and total events captured/loaded as payload data and format args
         if (gDC._runMode == constants.RUNMODE_RECORD) {
            var eventscaptured = gDC.eventsCaptured ? gDC.eventsCaptured.length : 0;
            gDC._runState += String(eventscaptured) + "||" + String(eventscaptured) + "||";  // just use same total for each
            if (gDC._runType == constants.RUNTYPE_RECORDAPPEND) {
               args.push( gDC.recordedEvents );    // # of events newly recorded in this session
            }
            args.push( eventscaptured );

         } else {
            // update the total event count
            gDC._totalEventCount = (gDC._script != null) ? gDC._script.getTotalEventCount() : 0;
            gDC._runState += String(gDC.replayedEvents) + "||" + String(gDC._totalEventCount) + "||";
            if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_PAUSED) {
               args.push( gDC.replayedEvents );
               args.push( gDC._totalEventCount );
            } else if (gDC._runType == constants.RUNTYPE_STOPLOADED) {
               args.push( gDC._totalEventCount );
            }
         }

         // get the associated runType property string (localized)
         var propString = gDC._runTypeProperties[ gDC._runType ];

         // attach the runState status property string, with optionally formatted args
         if (args.length) {
            gDC._runState += gDC._systemBundle.getMessage( propString, args);
         } else {
            gDC._runState += gDC._systemBundle.getMessage( propString );
         }

         // Attach the Action and Event Details if in verbose mode. This is used by for Instant Test display.
         if (gDC.verboseMode) {
            // Insert the current action count and total action count
            gDC._totalActionCount = gDC._script.getTotalActionCount();
            gDC._runState += "||" + String(gDC.replayedActions) + "||" + String(gDC._totalActionCount);

            // Insert the current action description as the action label
            var actionDesc = gDC._script.domTreeGetAttribute( gDC.actActionNode, 'description' );
            gDC._runState += "||" + encodeURIComponent(actionDesc);

            // Use the user-provided description as the event label if it exists, if not use the event type.
            var eventDetails = "Event " + gDC.actEventNum + ": ";
            var eventDesc = gDC._script.domTreeGetAttribute( gDC.actEventNode, 'description' );
            var eventType = gDC.actEventNode.getAttribute('type');
            eventDetails += (eventDesc || eventType);

            // If we are replaying a subscript, prepend its description to the event details
            if (gDC.subscriptNum) {
               var subscriptDesc = gDC._script.domTreeGetAttribute( gDC.subscriptNode, 'description' );
               if (!subscriptDesc) {
                  subscriptDesc = "Branch " + gDC.subscriptNum;
               }
               eventDetails = subscriptDesc + ": " + eventDetails;
            }

            gDC._runState += "||" + encodeURIComponent(eventDetails);
         }

         if (!aInitialize) {
            // ship the updated status string to all observers
            gDC._observerService.notifyLocalObservers("dejaclick:runstate", gDC._runState );
         }
         return;

      } catch ( e ) {
         throw new Error("Error in _updateRunState: " + e);
      }
   },

   addAuthCredentials : function ( aUsername, aPassword)
   {
      try {
         var data = { type : 1, action : 1, repeat : 1, input1 : aUsername, input2 : aPassword};
         var authUser = [];
         authUser.push(data);
         gDC.authUserCredentials = {data : authUser};

      } catch ( e ) {
         throw new Error("Error in addAuthCredentials: " + e);
      }
   },
   
   
   // Display an alert message to the user via a standard popup message box.
   // If a message ID is specified, the aIsMessageID param should be set to true.
   // If aIsMessageID is false or not specified, the message should already be
   // in localized form.
   // If aLogEntryRef is specified, it must be a log entry reference returned from
   // any of the log* functions. It will cause a "Display additional
   // information from the log" checkbox to be displayed.
   alertUser : function ( aMessage, aIsMessageID, aLogEntryRef )
   {
      try {
         if (!gDC.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE')) {
            return;  // user alerts are suppressed, exit now
         }
         gDC._setTimeout( function(){gDC._utils.promptService.alertUser( aMessage, aIsMessageID?true:false, aLogEntryRef?aLogEntryRef:"" );}, 100 );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"alertUser" );
      }
   },
   
   authUser : function ( aMessage, aIsMessageID, aArgs)
   {
      try {
         gDC._setTimeout( function(){gDC._utils.promptService.authUser( aMessage, aIsMessageID?true:false, window, aArgs );}, 1 );

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"authUser" );
      }
   },
   
   notifyUserAndRestoreBrowserWindows : function ( aMessage, aIsMessageID )
   {
      try {
         if (!gDC.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE')) {
            return;  // user notifications are suppressed, exit now
         }

         gDC.restoreDeferred = true;

         gDC._setTimeout( function(){
            if (gDC.restoreDeferred) {
               gDC.restoreDeferred = false;
            }
            
            gDC._utils.promptService.alertUser( aMessage, aIsMessageID );
            
         }, 100 );

         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"notifyUserAndRestoreBrowserWindows" );
      }
   },

   /**
    * Asynchronously display an alert message to the user and restore
    * the browser windows to their original sizes and positions.
    * @this {!DejaClick.DejaService}
    * @param {string} aMessage The message to display in the alert.
    * @param {boolean} aIsMessageId If true, then aMessage is the name of
    *    a localizable message to be displayed rather than the actual
    *    text.
    * @param {string=} opt_logEntry Additional details to provide in the
    *    dialog.
    */
   alertUserAndRestoreBrowserWindows: function (aMessage, aIsMessageId,
         opt_logEntry) {
      var self;
      try {
         if (this.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE')) {
            this.restoreDeferred = true;
            self = this;
            this._setTimeout(function () {
               try {
                  self._utils.promptService.alertUser(aMessage, aIsMessageId,
                     (((opt_logEntry == null) || (opt_logEntry === '')) ? null :
                        opt_logEntry));
                  if (self.restoreDeferred) {
                     self.restoreDeferred = false;
                  }
                  // @todo Define restoreBrowserWindows
                  //self.restoreBrowserWindows();
               } catch (ex) {
                  self.logger.logException(ex,
                     self.DCMODULE + 'alertUserAndRestoreBrowserWindows');
               }
            }, 1);
         }
      } catch (ex) {
         this.logger.logException(ex,
            this.DCMODULE + 'alertUserAndRestoreBrowserWindows');
      }
   },

   /**
    * Asynchronously prompt user when the browser screen is going to resize
    * @this {!DejaClick.DejaService}
    * @param {function(boolean)} aCallback Function to invoke when the
    *    prompting is complete. 
    */
   promptBrowserScreenResize : function (aCallback)
   { 
      try {

         gDC.resizePromptActive = true;  // only prompt once during multiple onContentLoaded events
         var promptTitle = "dcService_promptScreenResizeTitle";
         var promptMessage = "dcService_promptScreenResizeMessage";
         
         if (gDC.simulateMobile && !gDC.simulateMobile.skipResize) {
            promptMessage = "dcService_promptScreenResizeMessage2";
         }
         var checkboxLabel = "dcService_promptScreenResizePrompt";
         this.pendingPrompt = true;

         this._utils.promptService.confirmUser({
            title: promptTitle,
            question: promptMessage,
            buttons: [
               'dcService_yes', // Yes
               'dcService_no' // No
            ],
            extraText: checkboxLabel,
            extraValue: true
            }, this.completeResizePrompt.bind(this, 'DC_OPTID_WARNSCREENRESIZEPROMPT',
                                         aCallback));


      } catch ( e ) {
         gDC.logException( e, this.DCMODULE +"promptBrowserScreenResize" );
         gDC.resizePromptActive = false;
         return null;
      }
   },
   
   /**
    * Process a user response to a Replay Advisor timeout prompt.
    * @this {!DejaClick.DejaService}
    * @param {string} aTimeoutId Name of timeout preference item that
    *    has expired.
    * @param {string} aPromptId Name of preference item indicating
    *    whether the user should be prompted for this timeout.
    * @param {function(boolean)} aCallback Function to invoke when the
    *    prompting is complete. A true argument means to skip to the
    *    next event or error. A false argument means to continue
    *    waiting.
    * @param {integer} aChoice The user's response: 0 = Process with resize,
    *    1 = do not resize.
    * @param {boolean} aAskAgain Whether this dialog should be displayed
    *    again for this script.
    */
   completeResizePrompt: function ( aPromptId, aCallback, aChoice, aAskAgain) {
      try {
         gDC.pendingPrompt = false;
         if (!aAskAgain) {
            // Suppress future Replay Advisor prompting for this type
            // of timeout for this script.
            gDC.setScriptBoolPref(aPromptId, false);
         }

         // If the user chooses to re-size, call the callback method
         if (aChoice === 0) {
            aCallback();
         }
         else {
            // remember that the user declined to resize the browser window
            this.simulateMobile.skipResize = true;

            // disabling zooming since not using mobile screen size
            this.zoomToMobileSize = false;       

            gDC.pendingResize = false;
         }
         
         // write the user's answer back to pref settings
         gDC.setSystemBoolPref('DC_OPTID_WARNSCREENRESIZE', (aChoice == 0));
         gDC.setSystemBoolPref('DC_OPTID_WARNSCREENRESIZEPROMPT', aAskAgain);

         // write the don't-ask-me-again choice back to pref settings
         gDC.resizePromptActive = false;
         return (aChoice == 0);
      } catch (ex) {
         gDC.logException(ex, gDC.DCMODULE + 'completeResizeTimeout');
      }
   },   
   
   
   /**
    * Asynchronously prompt user when an event has not completed
    * within the timeout window.
    * @this {!DejaClick.DejaService}
    * @param {string} aTimeoutId Name of timeout preference item that
    *    has expired.
    * @param {string} aWarnChoiceId Name of preference item specifying the
    *    default action to take when this timeout expires.
    * @param {string} aWarnPromptId Name of preference item indicating
    *    whether the user should be prompted for this timeout.
    * @param {string} aPromptPrefix Prefix of localizable message
    *    names to display to the user in the prompt.
    * @param {function(boolean)} aCallback Function to invoke when the
    *    prompting is complete. A true argument means to skip to the
    *    next event or error. A false argument means to continue
    *    waiting.
    */
   promptTimeout: function (aTimeoutId, aWarnChoiceId, aWarnPromptId,
         aPromptPrefix, aCallback) {
      // Check whether we should prompt the user for assistance (i.e.,
      // Replay Advisor) or instead use whatever action (skip or
      // error) is currently set for the event.
//      if (!this.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') ||

       if (this.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') || this.getEventBoolPref('DC_OPTID_LOW_SENSITIVITY', this.actEventNode)) {
          if (aTimeoutId == 'DC_OPTID_MUTATIONBEGINTIMEOUT' ) {
              gDC.mutationsRecorded = 0;
              gDC.mutationsRequired = 0;
              this.stopMutationBeginTimeout();
              this.areWeThereYet();
              return;
          }
          if (aTimeoutId == 'DC_OPTID_MUTATIONENDTIMEOUT') {
              gDC.mutationsRecorded = 0;
              gDC.mutationsRequired = 0;
              this.stopMutationEndTimeout();
              this.areWeThereYet();
              return;
          }
          if (aTimeoutId == 'DC_OPTID_NETWORKTIMEOUT') {
              gDC.fullpageObjects = false;
              this.stopNetworkTimeout();
              this.areWeThereYet();
              return;
          }
          if (this.mutationBeginTimeout || this.mutationEndTimeout || this.networkTimeout &&
              !(this.locationsTimeout || this.navigationTimeout || this.responseTimeout)) {
              gDC.mutationsRecorded = 0;
              gDC.mutationsRequired = 0;
              gDC.resetActivity();
              this.stopMutationBeginTimeout();
              this.stopMutationEndTimeout();
              this.stopNetworkTimeout();
              this.areWeThereYet();
              return;
          }
      }

      if (!this.getSystemBoolPref('DC_OPTID_RUNINTERACTIVE') || !this.getEventBoolPref(aWarnPromptId, this.actEventNode)) {

         // Do not prompt. Instead, get the configured action choice.
         aCallback(this.getEventBoolPref(aWarnChoiceId, this.actEventNode));
         return;
      } 

      this.teardownAsyncTimers();

      this.pendingPrompt = true;
      this._utils.promptService.confirmUser({
         title: aPromptPrefix + 'Title',
         question: aPromptPrefix + 'Message',
         buttons: [
            'dcService_promptTimeoutButtonSkip', // Skip
            'dcService_promptTimeoutButtonStop', // Stop
            'dcService_promptTimeoutButtonWait' // Wait
         ],
         extraText: aPromptPrefix + 'Prompt',
         extraValue: true
      }, this.completePromptTimeout.bind(this, aTimeoutId, aWarnPromptId,
                                         aCallback));
   },

   /**
    * Process a user response to a Replay Advisor timeout prompt.
    * @this {!DejaClick.DejaService}
    * @param {string} aTimeoutId Name of timeout preference item that
    *    has expired.
    * @param {string} aPromptId Name of preference item indicating
    *    whether the user should be prompted for this timeout.
    * @param {function(boolean)} aCallback Function to invoke when the
    *    prompting is complete. A true argument means to skip to the
    *    next event or error. A false argument means to continue
    *    waiting.
    * @param {integer} aChoice The user's response: 0 = Skip to next event,
    *    1 = continue waiting, 2 = stop replay.
    * @param {boolean} aAskAgain Whether this dialog should be displayed
    *    again for this script.
    */
   completePromptTimeout: function (aTimeoutId, aPromptId, aCallback,
                                    aChoice, aAskAgain) {
      var evtId, tmo, evtTimeout;
      try {
         this.pendingPrompt = false;
         if (!aAskAgain) {
            // Suppress future Replay Advisor prompting for this type
            // of timeout for this script.
            this.setScriptBoolPref(aPromptId, false);
         }

         if (aChoice === 1) {
            // User wants to stop replay now.
            this.setRunMode(constants.RUNMODE_STOPPED);
         } else if (this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
               this.actEventNode)) {

            // Try to repair the issue.if it isnt the first event
            if (aChoice === 0) {
               // Proceed to the next event and let Replay Advisor
               // reset the specified timeout value back to its script
               // or system default (in case it was previously
               // extended by Replay Advisor).
               if (this.checkHasEventPref(aTimeoutId, this.actEventNode)) {
                  // Reset the event timeout to its default if it was
                  // also modified by Replay Advisor to match this
                  // timeout.
                  evtId = 'DC_OPTID_EVENTTIMEOUT';
                  if ((aTimeoutId !== evtId) &&
                        this.checkHasEventPref(evtId, this.actEventNode) &&
                        (this.getEventIntPref(aTimeoutId, this.actEventNode) ===
                           this.getEventIntPref(evtId, this.actEventNode))) {
                     this.resetEventIntPref(evtId, this.actEventNode);
                  }
                  this.resetEventIntPref(aTimeoutId, this.actEventNode);
               }
               // Suppress future Replay Advisor prompting for this
               // type of timeout on this EVENT only.
               this.setEventBoolPref(aPromptId, false, this.actEventNode);

            } else {
               // User wants to continue waiting, so let Replay
               // Advisor double this event's specified timeout
               // setting.
               tmo = 2 * this.getEventIntPref(aTimeoutId, this.actEventNode);
               this.setEventIntPref(aTimeoutId, tmo, this.actEventNode);

               // Also increase the event timeout if necessary, so that
               // this timeout will always occur before the event timeout.
               evtId = 'DC_OPTID_EVENTTIMEOUT';
               if ((aTimeoutId !== evtId) &&
                     (this.getEventIntPref(evtId, this.actEventNode) < tmo)) {
                  this.setEventIntPref(evtId, tmo, this.actEventNode);
               }
            }
         }
         // Reset optional auto-shutdown
         this.setSystemBoolPref('DC_OPTID_AUTOPOWEROFF', false);
         aCallback(aChoice === 0);
      } catch (ex) {
         this.logException(ex, this.DCMODULE + 'completePromptTimeout');
      }
   },

   // --------------------------------------------------------
   // start/stop timer/timeout functions

   /**
    * @param {integer=} aTimeoutDelay Optional time (in milliseconds)
    *    to wait before timing out replay.
    */
   restartReplayTimeout : function( aTimeoutDelay )  // restart replayTimeout after a brief delay
   {
      gDC.stopReplayTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }
      var timeoutDelay = aTimeoutDelay ? aTimeoutDelay : gDC.getEventIntPref('DC_OPTID_EVENTDELAY', gDC.actEventNode);
      gDC.replayTimeout = gDC._setTimeout( function(){gDC.replayNextEvent();}, timeoutDelay );
   },

   stopReplayTimeout : function()
   {
      gDC._clearTimeout( gDC.replayTimeout ); gDC.replayTimeout = null;
   },

   /**
    * @param {integer=} aTimeoutDelay Optional time (in milliseconds) to wait
    *    before rechecking if an event has completed.
    */
   restartReadyTimeout : function( aTimeoutDelay )
   {
      gDC.stopReadyTimeout();
      if (gDC.replayShuttingDown) {return; }

      var timeoutDelay = aTimeoutDelay ? aTimeoutDelay : (gDC.lastReadyTimeout ? gDC.lastReadyTimeout : gDC.getEventIntPref('DC_OPTID_READYTIMEOUT', gDC.actEventNode));
      // note: update gDC.lastReadyTimeout, but only if aTimeoutDelay not passed
      if (aTimeoutDelay == null) { gDC.lastReadyTimeout = timeoutDelay; }
      gDC.readyTimeout = gDC._setTimeout( function(){gDC.areWeThereYet();}, timeoutDelay );
   },
   stopReadyTimeout : function()
   {
      gDC._clearTimeout( gDC.readyTimeout ); gDC.readyTimeout = null;
   },
   /**
    * @param {integer=} aTimeoutDelay Optional time (in milliseconds)
    *    to wait before attempting to time out the event.
    */
   restartEventTimeout : function( aTimeoutDelay )
   {
      gDC.stopEventTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }

      var timeoutDelay = 0;
      if (aTimeoutDelay) {
         // if a timeout delay was passed in, use it
         timeoutDelay = aTimeoutDelay;

      } else if (gDC.evtTimeoutCounter >= 1) {
         timeoutDelay = 2000;  // event timeout already triggered, force a delay

      } else {
         // otherwise...
         if (gDC.getEventBoolPref( 'DC_OPTID_USEPAUSETIMEOUT', gDC.actEventNode )) {
            // use recorded thinktime as the event timeout if special event attribute is set
            timeoutDelay = parseInt(gDC._script.domTreeGetReplayHint(gDC.actEventNode, constants.DC_THINKTIMEHINT), 10);
         }
         if (!gDC._serverOperation && gDC.getEventBoolPref('DC_OPTID_REPLAYUE') ) {
            var timeoutDelayUE = gDC.getEventIntPref('DC_OPTID_USEREXPERIENCETIMEOUT', gDC.actEventNode);
            timeoutDelay = timeoutDelayUE > timeoutDelay ? timeoutDelayUE : timeoutDelay;
         }
         if (!timeoutDelay) {
            timeoutDelay = gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode);
         }

         //UXM-11282 - Add small delay to event timeout to be sure that it is trigger later than others 
         timeoutDelay += 2000; //2 sec
      }
      gDC.eventMaxTime = Date.now() + timeoutDelay;
      gDC.eventTimeout = gDC._setTimeout( function(){gDC.onEventTimeout();}, timeoutDelay);
   },

   stopEventTimeout : function()
   {
      gDC._clearTimeout( gDC.eventTimeout ); gDC.eventTimeout = null;
   },

   restartResponseTimeout : function()
   {
      gDC.stopResponseTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }
      if (gDC.mutationsRecorded) {
         gDC.restartMutationBeginTimeout();
         gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
      }
      if (gDC.pendingLocations) {
         gDC.restartLocationTimeout();
         gDC._setWaitType( constants.WAITTYPE_LOCATIONS );
      }
      if (gDC.pendingLocations || gDC.mutationsRecorded) {
         return;
      }
      // @todo Define onResponseTimeout
      //gDC.responseTimeout = gDC._setTimeout( function(){gDC.onResponseTimeout();}, gDC.getEventIntPref('DC_OPTID_RESPONSETIMEOUT', gDC.actEventNode) );
   },
   stopResponseTimeout : function()
   {
      gDC._clearTimeout( gDC.responseTimeout ); gDC.responseTimeout = null;
   },


   restartStatusTimeout : function( aTimeoutDelay )
   {
      gDC.stopStatusTimeout();
      if (gDC.replayShuttingDown) { return false; }
      var timeoutDelay = aTimeoutDelay ? aTimeoutDelay : gDC.DC_OPTVAL_STATUSDELAY;
      gDC.statusTimeout = gDC._setTimeout( function(){gDC.onStatusTimeout();}, timeoutDelay );
   },

   stopStatusTimeout : function()
   {
      gDC._clearTimeout( gDC.statusTimeout ); gDC.statusTimeout = null;
   },

   restartShutdownTimeout : function( aTimeoutDelay )
   {
      gDC.stopShutdownTimeout();
      var timeoutDelay = aTimeoutDelay ? aTimeoutDelay : gDC.getEventIntPref('DC_OPTID_READYTIMEOUT', gDC.actEventNode);
      gDC.shutdownTimeout = gDC._setTimeout( function(){gDC.shutdownEventReplay();}, timeoutDelay );
   },
   stopShutdownTimeout : function()
   {
      gDC._clearTimeout( gDC.shutdownTimeout ); gDC.shutdownTimeout = null;
   },

   restartStopRecordReplayTimeout : function( aTimeoutDelay )
   {
      gDC.stopStopRecordReplayTimeout();
      var timeoutDelay = aTimeoutDelay ? aTimeoutDelay : gDC.DC_OPTVAL_STOPRECORDREPLAYDELAY;
      gDC.stopRecordReplayTimeout = gDC._setTimeout( function(){gDC.stopRecordReplay();}, timeoutDelay );
   },

   stopStopRecordReplayTimeout : function()
   {
      gDC._clearTimeout( gDC.stopRecordReplayTimeout ); gDC.stopRecordReplayTimeout = null;
   },
   
   /**
    * @param {integer=} aTimeoutDelay Milliseconds to wait before invoking
    *    onNetworkTimeout.
    */
   restartNetworkTimeout : function( aTimeoutDelay )
   {
      if (gDC._serverOperation) {
         return;  // network timeout logic only used in desktop replay
      }
      gDC.stopNetworkTimeout();
      if ((gDC._runMode != constants.RUNMODE_REPLAY && gDC._runMode != constants.RUNMODE_RECORD) || gDC.replayShuttingDown) {
         return;
      }

      var timeoutDelay;
      if (gDC._runMode == constants.RUNMODE_RECORD) {
         timeoutDelay = 250;  // special case to reset status during record mode
      } else {
         timeoutDelay = aTimeoutDelay ? aTimeoutDelay : gDC.getEventIntPref('DC_OPTID_NETWORKTIMEOUT', gDC.actEventNode);
      }

      gDC.networkTimeout = gDC._setTimeout( function(){gDC.onNetworkTimeout();}, timeoutDelay );
   },
   stopNetworkTimeout : function()
   {
      gDC._clearTimeout( gDC.networkTimeout ); gDC.networkTimeout = null;
   },

   restartLocationTimeout : function()
   {
      gDC.stopLocationTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }

      var timeoutDelay = gDC.getEventIntPref('DC_OPTID_LOCATIONTIMEOUT', gDC.actEventNode);
      gDC.locationsTimeout = gDC._setTimeout( function(){gDC.onLocationTimeout();}, timeoutDelay );
   },
   stopLocationTimeout : function()
   {
      gDC._clearTimeout( gDC.locationsTimeout ); gDC.locationsTimeout = null;
   },

   restartMutationBeginTimeout : function()
   {
      gDC.stopMutationBeginTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }

      gDC.mutationBeginTimeout = gDC._setTimeout( function(){gDC.onMutationBeginTimeout();}, gDC.getEventIntPref('DC_OPTID_MUTATIONBEGINTIMEOUT', gDC.actEventNode) );
   },
   stopMutationBeginTimeout : function()
   {
      gDC._clearTimeout( gDC.mutationBeginTimeout ); gDC.mutationBeginTimeout = null;
   },

   restartMutationEndTimeout : function()
   {
      gDC.stopMutationEndTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }
      gDC.mutationEndTimeout = gDC._setTimeout( function(){gDC.onMutationEndTimeout();}, gDC.getEventIntPref('DC_OPTID_MUTATIONENDTIMEOUT', gDC.actEventNode) );
   },
   stopMutationEndTimeout : function()
   {
      gDC._clearTimeout( gDC.mutationEndTimeout ); gDC.mutationEndTimeout = null;
   },

   restartNavigationTimeout : function()
   {
      gDC.stopNavigationTimeout();
      if (gDC._runMode != constants.RUNMODE_REPLAY) { return; }

      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }
      gDC.navigationTimeout = gDC._setTimeout( function(){gDC.onNavigationTimeout();}, gDC.getEventIntPref('DC_OPTID_NAVIGATIONTIMEOUT', gDC.actEventNode) );
   },
   stopNavigationTimeout : function()
   {
      gDC._clearTimeout( gDC.navigationTimeout ); gDC.navigationTimeout = null;
   },

   restartMutationDelay : function( aTimeoutDelay )
   {
      gDC.stopMutationDelay();
      if (gDC.replayShuttingDown) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
         }
         return;
      }
      var timeoutDelay = aTimeoutDelay ? aTimeoutDelay : gDC.getEventIntPref('DC_OPTID_MUTATIONDELAY', gDC.actEventNode);
      //gDC.mutationsDelay = gDC._setTimeout( function(){gDC.onMutationDelay(aTimeoutDelay);}, timeoutDelay );
   },
   stopMutationDelay : function()
   {
      gDC._clearTimeout( gDC.mutationsDelay ); gDC.mutationsDelay = null;
   },

   restartReplayFailure : function( aMessageID, aMessageString, aStatusCode, aStatusLogID )
   {
      gDC.logger.logInfo("Restarted replay failure timeout. [Status="+aStatusCode+"][Message="+aMessageString+"]");
      gDC.stopReplayFailure();
      gDC.replayFailureTimeout = gDC._setTimeout( function(){gDC.handleReplayFailure( aMessageID, aMessageString, aStatusCode, aStatusLogID );}, gDC.getSystemIntPref('DC_OPTID_SUSPENDDELAY') );
   },
   stopReplayFailure : function()
   {
      gDC._clearTimeout( gDC.replayFailureTimeout ); gDC.replayFailureTimeout = null;
   },

   restartQuitApplication : function( aTimeoutDelay )
   {
      gDC.stopQuitApplication();
      // @todo Define quitApplication
      //gDC.quitApplicationTimeout = gDC._setTimeout( function(){gDC.quitApplication();}, aTimeoutDelay );
   },
   stopQuitApplication : function()
   {
      gDC._clearTimeout( gDC.quitApplicationTimeout ); gDC.quitApplicationTimeout = null;
   },

   restartFinalizeState : function( aTimeoutDelay )
   {
      gDC.stopFinalizeState();
      gDC.finalizeStateTimeout = gDC._setTimeout( function(){gDC.finalizeState();}, aTimeoutDelay );
   },
   stopFinalizeState : function()
   {
      gDC._clearTimeout( gDC.finalizeStateTimeout ); gDC.finalizeStateTimeout = null;
   },

   restartPopupBlockerTimeout : function( aTimeoutDelay )
   {
      gDC.stopPopupBlockerTimeout();
      if (gDC.replayShuttingDown) { return; }
      // @todo Define enablePopupBlocker
      //gDC.popupBlockerTimeout = gDC._setTimeout( function(){gDC.enablePopupBlocker();}, aTimeoutDelay );
   },
   stopPopupBlockerTimeout : function()
   {
      gDC._clearTimeout( gDC.popupBlockerTimeout ); gDC.popupBlockerTimeout = null;
   },

   restartDomFixupTimeout : function( aDocElement )
   {
      gDC.stopDomFixupTimeout();
      if (gDC.replayShuttingDown) { return; }
      // @todo Define fixupAllDomNodes
      //gDC.domFixupTimeout = gDC._setTimeout( function(){gDC.fixupAllDomNodes( aDocElement ); gDC.restartMutationDelay();}, 500 );
   },
   stopDomFixupTimeout : function()
   {
      gDC._clearTimeout( gDC.domFixupTimeout ); gDC.domFixupTimeout = null;
   },

   restartValidationTimeout: function(aHandler, aDelay) {
      this.stopValidationTimeout();
      this.validationTimeout = this._setTimeout(aHandler, aDelay);
   },

   stopValidationTimeout: function() {
      this._clearTimeout(this.validationTimeout);
      this.validationTimeout = null;
   },
   // --------------------------------------------------------
   // timer/timeout handler functions

   onStatusTimeout : function()
   {
      if (gDC._runMode == constants.RUNMODE_STOPPED || gDC.isBrowserActive()) {
         var readyTimeout = gDC.getSystemIntPref( 'DC_OPTID_READYTIMEOUT' );
         gDC.restartStatusTimeout( readyTimeout );
         return;
      }
      if (gDC._runMode == constants.RUNMODE_RECORD || gDC._runMode == constants.RUNMODE_SUSPEND) {
         // update Ready status during Record only when
         // no other browser activity is occurring.
         gDC._setWaitType( constants.WAITTYPE_STOPPED );
      }
   },

   /**
    * Process the expiration of the event timeout.
    * @this {!DejaClick.DejaService}
    */
   onEventTimeout : function ()
   {
      try {

        if ((this._runMode != constants.RUNMODE_REPLAY) ||
               this.replayShuttingDown) {
            // Wrong mode - only replay mode may proceed past this point.
            this.stopEventTimeout();
            return;
         }

         var timeNow = Date.now();
         if ((this.thinktimeStop > timeNow) ||
               (this.classifytimeStop !== 0) ||
               this.pendingDispatch) {
            if (this.thinktimeStop > timeNow) {
               this.restartEventTimeout(this.thinktimeStop - timeNow);
            }
            // Restart during thinktime or pendingDispatch.
            this.restartEventTimeout();

            //UXM-11863 - If the event dispatch was acknowledged, let's assume it was processed. Let's move forward with the replay.
            if ( this.pendingDispatch && this.pendingDispatchInfo.acknowledged === true ) {
               gDC.logger.logWarning("Event time out with dispatch events acknowledged. Assuming that they were executed. Setting pendingDispatch=false.");
               this.pendingDispatch = false;
               this.pendingDispatchInfo = null;
            }
            return;
         }
         if (this.isExecutionSuspended() ||
               this.networkTimeout ||
               this.locationsTimeout ||
               this.mutationBeginTimeout ||
               this.mutationEndTimeout ||
               this.navigationTimeout ||
               this.responseTimeout) {
            // If we are currently being suspended by an external
            // controller, or if other timers are active, let them
            // timeout first.  But only allow a brief window of time
            // in which to let this happen, after which we force the
            // event timeout.  Otherwise, timer deadlocks may result
            // in pages that continuously load content via timers that
            // keep resetting.  What we are really trying to do here
            // is allow the event timeout to occur last if any other
            // timeouts have the same timeout interval set.
            if (this.evtTimeoutCounter < 1) {
               this.evtTimeoutCounter++;
               this.logger.logInfo('** other timers pending, restarting onEventTimeout check in 2 secs...');
               this.logger.logInfo('** Timers status '+
                     "[this.isExecutionSuspended()="+this.isExecutionSuspended()+"]"+
                     "[this.networkTimeout="+this.networkTimeout+"]"+
                     "[this.locationsTimeout="+this.locationsTimeout+"]"+
                     "[this.mutationBeginTimeout="+this.mutationBeginTimeout+"]"+
                     "[this.mutationEndTimeout="+this.mutationEndTimeout+"]"+
                     "[this.navigationTimeout="+this.navigationTimeout+"]"+
                     "[this.responseTimeout="+this.responseTimeout+"]"
                     );
               // Special: clear nav timer to prevent endless looping
               this.stopNavigationTimeout();
               this.restartEventTimeout(2000);
               return;
            }
         }

         // check if there is a branching rule to handle this timeout
         if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_BROWSER_TIMEOUT_EVENT )) {
            gDC.areWeThereYet();
            return;
         }

         if (gDC.elementTargetNotFound) {
            this.resEventNode.setAttribute('targetfound', 'no');
            this.logger.logInfo("Replay failure. Event timeout. Target element not found. ");
            this.handleReplayFailure('dcFailure_targetnotfound', null,
               constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
            return;            
         }

         //UXM-6951: Do not fail if we have undergone at least one location change.
         var locationsNumber = gDC._script.domTreeGetReplayHint(this.actEventNode, gDC.DC_LOCATIONHINT);
         var recordedLocations = Number(locationsNumber);
         if (recordedLocations > 1 && (recordedLocations - gDC.pendingLocations > 0)) {
            this.logger.logWarning("[Event Timeout] Although we recorded "+recordedLocations+" location changes and we have just detected "+(recordedLocations - gDC.pendingLocations)+ ", we consider location changes as a non-blocking issue. So, let's continue replaying [Recorded_Changes="+recordedLocations+"][Pending_Changes="+gDC.pendingLocations+"]");
            gDC.stopLocationTimeout(); //UXM-11282 - Added "stopLocationTimeout" to be sure that "onEventTimeout" it doesn't think we are waiting on locations.
            gDC.pendingLocations = 0;
            gDC.areWeThereYet();
            return;
         }

         var alreadyPrompted = this.checkHasEventPref(
            'DC_OPTID_WARNEVTTIMEOUTPROMPT', this.actEventNode);

         var timeoutOpt = 'DC_OPTID_EVENTTIMEOUT';
         var warnOpt = 'DC_OPTID_WARNEVTTIMEOUT';
         var promptOpt = 'DC_OPTID_WARNEVTTIMEOUTPROMPT';
         var promptId = 'dcService_promptEvtTimeout';

         // UXM-4451 Classify errors correctly. Currently, most
         // errors get wrongly classified as 82
         if (this.networkTimeout) {
            this.logger.logWarning(`[Event Timeout] Network timeout!`);

            timeoutOpt = 'DC_OPTID_NETWORKTIMEOUT';
            warnOpt = 'DC_OPTID_WARNNETTIMEOUT';
            promptOpt = 'DC_OPTID_WARNNETTIMEOUTPROMPT';
            promptId = 'dcService_promptNetTimeout';
         }
         else if (this.mutationBeginTimeout) {
            this.logger.logWarning(`[Event Timeout] mutationBeginTimeout timeout!`);
            
            timeoutOpt = 'DC_OPTID_MUTATIONBEGINTIMEOUT';
            warnOpt = 'DC_OPTID_WARNMUTBTIMEOUT';
            promptOpt = 'DC_OPTID_WARNMUTBTIMEOUTPROMPT';
            promptId = 'dcService_promptMutTimeout';
         }
         else if (this.mutationEndTimeout) {
            this.logger.logWarning(`[Event Timeout] mutationEndTimeout timeout!`);
            
            timeoutOpt = 'DC_OPTID_MUTATIONENDTIMEOUT';
            warnOpt = 'DC_OPTID_WARNMUTETIMEOUT';
            promptOpt = 'DC_OPTID_WARNMUTETIMEOUTPROMPT';
            promptId = 'dcService_promptMutTimeout';
         }
         
         if (this.locationsTimeout) {
            this.logger.logWarning(`[Event Timeout] locationsTimeout timeout!`);
            
            timeoutOpt = 'DC_OPTID_LOCATIONTIMEOUT';
            warnOpt = 'DC_OPTID_WARNLOCTIMEOUT';
            promptOpt = 'DC_OPTID_WARNLOCTIMEOUTPROMPT';
            promptId = 'dcService_promptLocTimeout';
         }
         else if (this.navigationTimeout) {
            this.logger.logWarning(`[Event Timeout] navigationTimeout timeout!`);
            
            timeoutOpt = 'DC_OPTID_NAVIGATIONTIMEOUT';
            warnOpt = 'DC_OPTID_WARNNAVTIMEOUT';
            promptOpt = 'DC_OPTID_WARNNAVTIMEOUTPROMPT';
            promptId = 'dcService_promptNavTimeout';
         }
         
         if ( this.responseTimeout ) {
            this.logger.logWarning(`[Event Timeout] responseTimeout timeout!`);
         }

         this.logger.logWarning(`[Event Timeout] Details: timeoutOpt=${timeoutOpt}, warnOpt=${warnOpt}, promptOpt=${promptOpt}, promptId=${promptId}`);

         // Determine how to handle this timeout.
         //
         this.promptTimeout(timeoutOpt,
               warnOpt,
               promptOpt,
               promptId,
               this.completeEventTimeout.bind(this, alreadyPrompted));


      } catch (ex) {
         this.logException(ex, this.DCMODULE + 'onEventTimeout');
      }
   },

   /**
    * Complete event timeout handling after asking user how to proceed.
    * @this {!DejaClick.DejaService}
    * @param {boolean} aAlreadyPrompted true if the current event
    *    has already encountered an event timeout.
    * @param {boolean} aDontWait true if we should skip to the next event
    *    or error. false to continue waiting.
    */
   completeEventTimeout: function (aAlreadyPrompted, aDontWait) {
      try {
         if (!aDontWait) {
            if (this._runMode !== constants.RUNMODE_STOPPED) {
               // ::: User wants to extend timeout and continue waiting.

               this.evtTimeoutCounter = 0;
               this.restartEventTimeout();
               // Restart event replay timer to continue processing
               // the recording.
               if (this.replayTimeout == null) {
                  this.restartReplayTimeout();
               }
               this._setWaitType(constants.WAITTYPE_PROCESSING);
               this.restartReadyTimeout();
            }

         } else if (this.getEventBoolPref('DC_OPTID_FAILONTIMEOUT',
               this.actEventNode)) {
            var errStr = 'dcFailure_eventtimeout';
            var error = constants.STATUS_BROWSER_TIMEOUT_EVENT;
            if (this.locationsTimeout){
               errStr = 'dcFailure_locationtimeout';
               error = constants.STATUS_BROWSER_TIMEOUT_LOCATION;
            }
            else if (this.navigationTimeout) {
               errStr = "dcFailure_navigationtimeout";
               error = constants.STATUS_BROWSER_TIMEOUT_NAVIGATE;
            }

            // We are configured to handle timeouts as a failure, so
            // terminate script replay.
            this.handleReplayTimeout(errStr,
               error);

         } else {

            // ::: Proceed to the next event...

            // We are configured to skip on timeout, so push ahead and
            // optionally repair the issue.

            if ((this.replayedEvents > 0) && !aAlreadyPrompted &&
                  this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
                     this.actEventNode)) {
               // :: Try to repair the issue..

               // Special-case: Enable the "Skip after user pause
               // interval" Event Timeout option.
               // Note: this setting is mostly for dealing with
               // keep-alive or persistent network connections where
               // the page continues to load additional content after
               // the main content has already been loaded and the
               // user has already started to record the next event.
               // There are also cases where requested documents may
               // contain invalid content. This option may be disabled
               // via Event Timeout properties if necessary.  So we
               // set the default event (skip) timeout to match the
               // originally recorded user think time (which can be
               // adjusted) rather than waiting the full 30 secs.
               this.setEventBoolPref('DC_OPTID_USEPAUSETIMEOUT', true,
                  this.actEventNode);

               // Replay advisor 'fixes' this issue by skipping the
               // event (don't generate a failure).
               var eventType = this.actEventNode.getAttribute('type');
               if (eventType != "navigate") {
                  this.setEventBoolPref('DC_OPTID_FAILONTIMEOUT', false,
                     this.actEventNode );
               }

               // Reset optional auto-shutdown.
               this.setSystemBoolPref('DC_OPTID_AUTOPOWEROFF', false);
               this.advisorRepairs = true;
            }
            this.handleSkippedEvent('DC_OPTID_WARNEVTTIMEOUTPROMPT',
               'dcWarning_eventtimeout');
         }

      } catch (e) {
         if (!this.replayShuttingDown) {
            this.logException(e, this.DCMODULE + 'completeEventTimeout');
         }
      }
   },

   // Network Timeouts are handled essentially the same as normal Event Timeouts,
   // except that they are triggered when the page appears to be fully loaded yet
   // there is still some kind of lingering network activity occuring on the page
   // AND all tracked browsers appear to be idle AND there are no other pending
   // top-level timers AND the network timeout interval has expired.  This lets
   // us prompt the user a bit earlier than the normal Event Timeout to determine
   // if they want to continue waiting for page activity or not.  In some cases,
   // such as keep-alive 'push-style' server-side processing queries, the user
   // may want to continue waiting, while in other cases, such as for streaming
   // stock quotes or video, they may want to skip directly to the next event,
   // so we leave it to the user to decide.
   onNetworkTimeout : function()
   {
      try {

         if (gDC._runMode == constants.RUNMODE_REPLAY && (gDC.thinktimeStop !== 0 || gDC.classifytimeStop !== 0)) {
            gDC.restartNetworkTimeout();
            return;  // restart during thinktime
         }

         if (gDC._runMode == constants.RUNMODE_REPLAY || gDC._runMode == constants.RUNMODE_RECORD) {
            // if one or more network STATE_STOP events are still pending...
            if (gDC.netActivityCount > 0) {
               for (var i=0, browserObj=null; i < gDC.browsersTracked.length; i++) {
                  browserObj = gDC.browsersTracked[i];
                  if (browserObj.networkActivity > 0) {
                     // refresh the timer and exit unless all our tracked browser
                     // throbbers are IDLE and there are NO pending document loads.
                     if (browserObj.docsLoaded < browserObj.docsStarted) {
                        gDC.restartNetworkTimeout();
                        return;
                     }
                  }
               }
            }

            if (gDC._runMode == constants.RUNMODE_RECORD) {
               // special case: we provide a small delay to update the
               // statusbar when a network timeout occurs during record
               // and all browsers are idle
               gDC.stopNetworkTimeout();
               gDC._setWaitType( constants.WAITTYPE_STOPPED );
               gDC.resetActivity();
               return;
            }
         }

         // only replay mode gets past this point..

         if (gDC._runMode != constants.RUNMODE_REPLAY || !gDC._observerService || gDC.replayShuttingDown || gDC.pendingPrompt) {
            gDC.stopNetworkTimeout();
            return;  // wrong mode
         }

         if (gDC.pendingDispatch) {
            gDC.restartNetworkTimeout();
            return;  // restart during pendingDispatch
         }

         if (gDC.locationsTimeout || gDC.mutationBeginTimeout || gDC.mutationEndTimeout ||
             gDC.navigationTimeout || gDC.responseTimeout) {
            // If any of these other timers are active, let them timeout first.
            // What we are really trying to do here is allow the network timeout
            // to occur last if any of these timeouts are set and currently active.
            gDC.stopNavigationTimeout();  // clear to prevent endless looping
            gDC.restartNetworkTimeout();
            return;
         }

         if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_BROWSER_TIMEOUT_NETWORK )) {
            gDC.areWeThereYet();
            return;
         }
         
         var alreadyPrompted = gDC.checkHasEventPref( 'DC_OPTID_WARNNETTIMEOUTPROMPT', gDC.actEventNode );

         gDC.logger.logInfo("DC_OPTID_NETWORKTIMEOUT - Calling promptTimeout");
         // determine how to handle this timeout
         gDC.promptTimeout('DC_OPTID_NETWORKTIMEOUT', 'DC_OPTID_WARNNETTIMEOUT',
            'DC_OPTID_WARNNETTIMEOUTPROMPT', 'dcService_promptNetTimeout',
            gDC.completeNetworkTimeout.bind(gDC, alreadyPrompted));
      } catch ( e ) {
         if (gDC._observerService && !gDC.replayShuttingDown) {
            gDC.logException( e, gDC.DCMODULE+"onNetworkTimeout" );
         }
      }
   },

   /**
    * Complete network timeout handling after asking user how to proceed.
    * @this {!DejaClick.DejaService}
    * @param {boolean} aAlreadyPrompted true if the current event
    *    has already encountered a network timeout.
    * @param {boolean} aDontWait true if we should skip to the next event
    *    or error. false to continue waiting.
    */
   completeNetworkTimeout: function(aAlreadyPrompted, aDontWait) {
      try {
         if (aDontWait) {

            // ::: proceed to the next event...
            if (this.getEventBoolPref('DC_OPTID_FAILONTIMEOUT',
                  this.actEventNode)) {
               // We are configured to handle timeouts as a failure,
               // so terminate script replay.
               this.handleReplayTimeout('dcFailure_networktimeout',
                  constants.STATUS_BROWSER_TIMEOUT_NETWORK);

            } else {
               // We are configured to skip on timeout, so push ahead
               // and optionally repair the issue.
               if ((this.replayedEvents > 0) && !aAlreadyPrompted &&
                     this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
                        this.actEventNode)) {
                  // :: try to repair the issue..

                  // Special-case: Enable the "Skip after user pause
                  // interval" Event Timeout option.
                  // Note: This setting is mostly for dealing with
                  // keep-alive or persistent network connections
                  // where the page continues to load additional
                  // content after the main content has already been
                  // loaded and the user has already started to record
                  // the next event.  There are also cases where
                  // requested documents may contain invalid
                  // content. This option may be disabled via Event
                  // Timeout properties if necessary.  So we set the
                  // default event (skip) timeout to match the
                  // originally recorded user think time (which can be
                  // adjusted) rather than waiting the full 30 secs.
                  this.setEventBoolPref('DC_OPTID_USEPAUSETIMEOUT', true,
                     this.actEventNode);

                  // replay advisor 'fixes' this issue by skipping the
                  // event (don't generate a failure)
                  var eventType = this.actEventNode.getAttribute('type');
                  if (eventType != "navigate") {
                     this.setEventBoolPref('DC_OPTID_FAILONTIMEOUT', false,
                        this.actEventNode);
                  }

                  // special case: Suppress Replay Advisor prompting
                  // for event timeouts on this event.
                  this.setEventBoolPref('DC_OPTID_WARNEVTTIMEOUTPROMPT', false,
                     this.actEventNode);

                  // reset optional auto-shutdown
                  this.setSystemBoolPref('DC_OPTID_AUTOPOWEROFF', false);
                  this.advisorRepairs = true;
               }

               this.handleSkippedEvent('DC_OPTID_WARNNETTIMEOUTPROMPT',
                  'dcWarning_networktimeout');
            }

         } else if (this._runMode !== constants.RUNMODE_STOPPED) {

            // ::: user wants to extend timeout and continue waiting

            this.restartNetworkTimeout();
            // Restart event replay timer to continue processing the recording.
            if (this.replayTimeout == null) {
               this.restartReplayTimeout();
            }
            this._setWaitType( constants.WAITTYPE_NETWORK );
            this.restartReadyTimeout();
         }

      } catch ( e ) {
         if (this._observerService && !this.replayShuttingDown) {
            this.logException( e, this.DCMODULE + 'completeNetworkTimeout' );
         }
      }
   },


   onLocationTimeout : function()
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY || !gDC._observerService || gDC.replayShuttingDown) {
            gDC.stopLocationTimeout();
            return;  // wrong mode - only replay mode may proceed past this point
         }

         if (gDC.pendingLocations === 0) {
            return;  // wrong location count
         }

         if (gDC.thinktimeStop !== 0 || gDC.classifytimeStop !== 0 || gDC.pendingDispatch) {
            gDC.restartLocationTimeout();
            return;  // restart during thinktime or pendingDispatch
         }

         // grab the number of pending locations, since it could change during the notification popup
         var currPendingLocations = gDC.pendingLocations;

         if (this.isExecutionSuspended()) {
            gDC.resetActivity();
            gDC.areWeThereYet();
            return;  // external controller busy
         }

         if (gDC.netActivityCount > 0) {
            for (var i=0; i < gDC.browsersTracked.length; i++) {
               if (gDC.browsersTracked[i].networkActivity > 0) {
                  // refresh the timer and exit unless all tracked browser's throbbers are idle
                  gDC.restartLocationTimeout();
                  return;
               }
            }
         }

         if (gDC.mutationBeginTimeout || gDC.mutationEndTimeout ||
             gDC.navigationTimeout || gDC.responseTimeout) {
            // If any of these other timers are active, let them timeout first.
            gDC.stopNavigationTimeout();  // clear to prevent endless looping
            gDC.restartLocationTimeout();
            return;
         }

         // check if there is a branching rule to handle this timeout
         if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_BROWSER_TIMEOUT_LOCATION )) {
            gDC.areWeThereYet();
            return;
         }
  
         //UXM-6951: Do not fail if we have undergone at least one location change. 
         var locationsNumber = gDC._script.domTreeGetReplayHint(this.actEventNode, gDC.DC_LOCATIONHINT);      
         var recordedLocations = Number(locationsNumber);
         if (recordedLocations > 1 && (recordedLocations - gDC.pendingLocations > 0)) {
            this.logger.logWarning("[Location Timeout] Although we recorded "+recordedLocations+" location changes and we have just detected "+(recordedLocations - gDC.pendingLocations)+ ", we consider location changes as a non-blocking issue. So, let's continue replaying [Recorded_Changes="+recordedLocations+"][Pending_Changes="+gDC.pendingLocations+"]");
            gDC.stopLocationTimeout(); //UXM-11282 - Added "stopLocationTimeout" to be sure that "onEventTimeout" it doesn't think we are waiting on locations.
            gDC.pendingLocations = 0;
            gDC.areWeThereYet();
            return;
         }

         // determine how to handle this timeout
         gDC.logger.logInfo("DC_OPTID_LOCATIONTIMEOUT - Calling promptTimeout");
         gDC.promptTimeout('DC_OPTID_LOCATIONTIMEOUT',
            'DC_OPTID_WARNLOCTIMEOUT', 'DC_OPTID_WARNLOCTIMEOUTPROMPT',
            'dcService_promptLocTimeout',
            gDC.completeLocationTimeout.bind(gDC, currPendingLocations));
      } catch ( e ) {
         if (gDC._observerService && !gDC.replayShuttingDown) {
            gDC.logException( e, gDC.DCMODULE+"onLocationTimeout" );
         }
      }
   },

   /**
    * Complete location timeout handling after asking user how to proceed.
    * @this {!DejaClick.DejaService}
    * @param {integer} aPendingLocations The number of pending location changes.
    * @param {boolean} aDontWait true if we should skip to the next event
    *    or error. false to continue waiting.
    */
   completeLocationTimeout: function (aPendingLocations, aDontWait) {
      try {
         if (aDontWait) {
            // ::: proceed to the next event...

            if (this.getEventBoolPref('DC_OPTID_FAILONTIMEOUT',
                                      this.actEventNode)) {
               // We are configured to handle timeouts as a failure,
               // so terminate script replay.
               this.handleReplayTimeout('dcFailure_locationtimeout',
                   constants.STATUS_BROWSER_TIMEOUT_LOCATION);
               return;

            } else {
               // We are configured to skip on timeout, so push ahead
               // and optionally repair the issue.

               if (!this.checkHasEventPref('DC_OPTID_WARNLOCTIMEOUTPROMPT',
                     this.actEventNode)) {
                  // Always warn unless the event specifically suppresses it.
                  this.handleReplayWarning('dcWarning_locationtimeout');
               }

               if (this.pendingLocations == aPendingLocations) {
                  // Only decrement if same as originally stored value.
                  --this.pendingLocations;
               }

               if (this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
                     this.actEventNode)) {
                  // Try to repair the issue.
                  // Replay advisor 'fixes' this issue by
                  // auto-adjusting this event's number of locations.
                  this._script.domTreeSetReplayHint(this.actEventNode,
                     this.DC_LOCATIONHINT,
                     this._script.domTreeGetReplayHint(this.actEventNode,
                        this.DC_LOCATIONHINT) - 1);

                  // reset optional auto-shutdown
                  this.setSystemBoolPref('DC_OPTID_AUTOPOWEROFF', false);
                  this.advisorRepairs = true;
               }

               this.resetActivity();
            }

         } else if (this._runMode == constants.RUNMODE_STOPPED) {
            return;  // ::: User has stopped replay.

         } else {
            // ::: User wants to extend timeout and continue waiting.

            this.restartLocationTimeout();
            // restart event replay timer to continue processing the recording
            if (this.replayTimeout == null) {
               this.restartReplayTimeout();
            }
            this._setWaitType(constants.WAITTYPE_LOCATIONS);
         }

         this.areWeThereYet();
         return;

      } catch (e) {
         if (this._observerService && !this.replayShuttingDown) {
            this.logException(e, this.DCMODULE + 'completeLocationTimeout');
         }
      }
   },

   onMutationBeginTimeout : function()
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY || !gDC._observerService || gDC.replayShuttingDown) {
            gDC.stopMutationBeginTimeout();
            return;  // wrong mode - only replay mode may proceed past this point
         }

         if (gDC.thinktimeStop !== 0 || gDC.classifytimeStop !== 0 || gDC.pendingDispatch) {
            gDC.restartMutationBeginTimeout();
            return;  // restart during thinktime or pendingDispatch
         }

         if (gDC.mutationsRecorded === 0 && !(gDC.mutationsRequired && gDC.mutationsCount < gDC.mutationsRequired)) {
            gDC.stopMutationBeginTimeout();
            gDC.areWeThereYet();
            return;  // wrong mutation count
         }

         if (gDC.netActivityCount > 0) {
            for (var i=0; i < gDC.browsersTracked.length; i++) {
               if (gDC.browsersTracked[i].networkActivity > 0) {
                  // refresh the timer and exit unless all tracked browser's throbbers are idle
                  gDC.restartMutationBeginTimeout();
                  return;
               }
            }
         }

         // check if there is a branching rule to handle this timeout
         if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_BROWSER_TIMEOUT_MUTATION )) {
            gDC.areWeThereYet();
            return;
         }
         
         var alreadyPrompted = gDC.checkHasEventPref(
            'DC_OPTID_WARNMUTBTIMEOUTPROMPT', gDC.actEventNode);

         gDC.logger.logInfo("DC_OPTID_MUTATIONBEGINTIMEOUT - Calling promptTimeout");
         gDC.promptTimeout('DC_OPTID_MUTATIONBEGINTIMEOUT',
            'DC_OPTID_WARNMUTBTIMEOUT', 'DC_OPTID_WARNMUTBTIMEOUTPROMPT',
            'dcService_promptMutTimeout',
            gDC.completeMutationBeginTimeout.bind(gDC, alreadyPrompted));
      } catch ( e ) {
         if (gDC._observerService && !gDC.replayShuttingDown) {
            gDC.logException( e, gDC.DCMODULE+"onMutationBeginTimeout" );
         }
      }
   },

   /**
    * Complete mutation begin timeout handling after asking user how to proceed.
    * @this {!DejaClick.DejaService}
    * @param {boolean} aAlreadyPrompted true if the current event
    *    has already encountered a mutation begin timeout.
    * @param {boolean} aDontWait true if we should skip to the next event
    *    or error. false to continue waiting.
    */
   completeMutationBeginTimeout: function (aAlreadyPrompted, aDontWait) {
      try {
         // determine how to handle this timeout
         if (aDontWait) {

            // ::: proceed to the next event...

            if (this.getEventBoolPref('DC_OPTID_FAILONTIMEOUT',
                  this.actEventNode)) {
               // We are configured to handle timeouts as a failure,
               // so terminate script replay.
               this.handleReplayTimeout('dcFailure_mutbegintimeout',
                  constants.STATUS_BROWSER_TIMEOUT_MUTATION);
               return;

            } else {
               // We are configured to skip on timeout, so push ahead
               // and optionally repair the issue.

               if (!this.checkHasEventPref('DC_OPTID_WARNMUTBTIMEOUTPROMPT',
                     this.actEventNode)) {
                  // Always warn unless the event specifically suppresses it.
                  this.handleReplayWarning('dcWarning_mutbegintimeout');
               }

               // Note: We must check the mutationsCount value after
               // returning from the prompt, since mutation change
               // events may have occurred while waiting.

               // Reset recorded & required mutations to get past
               // onMutationDelay rule check
               this.mutationsRecorded = 0;
               this.mutationsRequired = 0;
               this.mutationsCount = 1;
               this.mutationsCountLast = this.mutationsCount;

               if (this.replayedEvents > 0 && !aAlreadyPrompted) {
                  if (this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
                        this.actEventNode)) {
                     // :: try to repair the issue..

                     // Replay Advisor 'fixes' this issue by
                     // auto-adjusting this event's "Use Content
                     // Changes" setting.
                     this.setEventBoolPref('DC_OPTID_USEMUTATIONHINTS', false,
                        this.actEventNode);

                     // reset optional auto-shutdown
                     this.setSystemBoolPref('DC_OPTID_AUTOPOWEROFF', false);
                     this.advisorRepairs = true;
                  }
               }

               this.resetActivity();
            }

         } else if (this._runMode === constants.RUNMODE_STOPPED) {
            return;  // ::: User has stopped replay.

         } else {
            // ::: User wants to extend timeout and continue waiting.

            // Wait for mutations, so restart begin-timer.
            this.restartMutationBeginTimeout();
            // Restart event replay timer to continue processing the recording.
            if (this.replayTimeout == null) {
               this.restartReplayTimeout();
            }
            this._setWaitType(constants.WAITTYPE_MUTATIONS);
         }

         this.areWeThereYet();

      } catch (e) {
         if (this._observerService && !this.replayShuttingDown) {
            this.logException(e, this.DCMODULE + 'completeMutationBeginTimeout');
         }
      }
   },

   onMutationEndTimeout : function()
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY || !gDC._observerService || gDC.replayShuttingDown) {
            gDC.stopMutationBeginTimeout();
            return;  // wrong mode - only replay mode may proceed past this point
         }

         if (gDC.mutationsRecorded === 0) {
            gDC.stopMutationEndTimeout();
            gDC.areWeThereYet();
            return;  // wrong mutation count
         }

         if (gDC.thinktimeStop !== 0 || gDC.classifytimeStop !== 0 || gDC.pendingDispatch) {
            gDC.restartMutationEndTimeout();
            return;  // restart during thinktime or pendingDispatch
         }

         if (gDC.netActivityCount > 0) {
            for (var i=0; i < gDC.browsersTracked.length; i++) {
               if (gDC.browsersTracked[i].networkActivity > 0) {
                  // refresh the timer and exit unless all tracked browser's throbbers are idle
                  gDC.restartMutationEndTimeout();
                  return;
               }
            }
         }

         // check if there is a branching rule to handle this timeout
         if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_BROWSER_TIMEOUT_MUTATION )) {
            gDC.areWeThereYet();
            return;
         }
         
         var alreadyPrompted = gDC.checkHasEventPref( 'DC_OPTID_WARNMUTETIMEOUTPROMPT', gDC.actEventNode );

         gDC.logger.logInfo("DC_OPTID_MUTATIONENDTIMEOUT - Calling promptTimeout");
         gDC.promptTimeout('DC_OPTID_MUTATIONENDTIMEOUT',
            'DC_OPTID_WARNMUTETIMEOUT', 'DC_OPTID_WARNMUTETIMEOUTPROMPT',
            'dcService_promptMutTimeout',
            gDC.completeMutationEndTimeout.bind(gDC, alreadyPrompted));

      } catch ( e ) {
         if (gDC._observerService && !gDC.replayShuttingDown) {
            gDC.logException( e, gDC.DCMODULE+"onMutationEndTimeout" );
         }
      }
   },

   /**
    * Complete mutation end timeout handling after asking user how to proceed.
    * @this {!DejaClick.DejaService}
    * @param {boolean} aAlreadyPrompted true if the current event
    *    has already encountered a mutation end timeout.
    * @param {boolean} aDontWait true if we should skip to the next event
    *    or error. false to continue waiting.
    */
   completeMutationEndTimeout: function (aAlreadyPrompted, aDontWait) {
      try {
         // determine how to handle this timeout
         if (aDontWait) {

            // ::: proceed to the next event...

            if (this.getEventBoolPref('DC_OPTID_FAILONTIMEOUT',
                  this.actEventNode)) {
               // We are configured to handle timeouts as a failure,
               // so terminate script replay.
               this.handleReplayTimeout('dcFailure_mutendtimeout',
                  constants.STATUS_BROWSER_TIMEOUT_MUTATION);
               return;

            } else {
               // We are configured to skip on timeout, so push ahead
               // and optionally repair the issue.

               if (!this.checkHasEventPref('DC_OPTID_WARNMUTETIMEOUTPROMPT',
                     this.actEventNode)) {
                  // always warn unless the event specifically suppresses it
                  this.handleReplayWarning('dcWarning_mutendtimeout');
               }

               // Note: We must check the mutationsCount value after
               // returning from the prompt, since mutation change
               // events may have occurred while waiting.

               // Replay anyway, so force-reset recorded mutations to
               // get past onMutationDelay rule check.
               this.mutationsRecorded = 0;
               this.mutationsCountLast = this.mutationsCount;

               if ((this.replayedEvents > 0) && !aAlreadyPrompted &&
                     this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
                        this.actEventNode)) {
                  // :: Try to repair the issue.

                  // Replay Advisor 'fixes' this issue by auto-adjusting
                  // this event's "Use Content Changes" setting.
                  this.setEventBoolPref('DC_OPTID_USEMUTATIONHINTS', false,
                     this.actEventNode);

                  this.setSystemBoolPref( 'DC_OPTID_AUTOPOWEROFF', false);
                  this.advisorRepairs = true;
               }

               this.resetActivity();
            }

         } else if (this._runMode == constants.RUNMODE_STOPPED) {
            return;  // ::: user has stopped replay

         } else {
            // ::: User wants to extend timeout and continue waiting.

            // Wait for mutations, so restart end-timer.
            this.restartMutationEndTimeout();
            // Restart event replay timer to continue processing the recording.
            if (this.replayTimeout == null) {
               this.restartReplayTimeout();
            }
            this._setWaitType(constants.WAITTYPE_MUTATIONS);
         }

         this.areWeThereYet();

      } catch (e) {
         if (this._observerService && !this.replayShuttingDown) {
            this.logException(e, this.DCMODULE + 'completeMutationEndTimeout');
         }
      }
   },

   onNavigationTimeout : function()
   {
      try {
         if (gDC._runMode != constants.RUNMODE_REPLAY || !gDC._observerService || gDC.replayShuttingDown) {
            gDC.stopNavigationTimeout();
            return;  // wrong mode - only replay mode may proceed past this point
         }

         if (gDC.thinktimeStop !== 0 || gDC.classifytimeStop !== 0 || gDC.pendingDispatch) {
            gDC.restartNavigationTimeout();
            return;  // restart during thinktime or pendingDispatch
         }

         if (this.isExecutionSuspended()) {
            //gDC.resetActivity();
            gDC.restartNavigationTimeout();
            gDC.areWeThereYet();
            return;  // external controller busy
         }

         if (gDC.netActivityCount > 0) {
            for (var i=0; i < gDC.browsersTracked.length; i++) {
               if (gDC.browsersTracked[i].networkActivity > 0) {
                  // refresh the timer and exit unless all tracked browser's throbbers are idle
                  gDC.restartNavigationTimeout();
                  return;
               }
            }
         }

         // check if there is a branching rule to handle this timeout
         if (gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_BROWSER_TIMEOUT_NAVIGATE )) {
            gDC.areWeThereYet();
            return;
         }
         
         var alreadyPrompted = this.checkHasEventPref(
            'DC_OPTID_WARNNAVTIMEOUTPROMPT', this.actEventNode);

         // determine how to handle this timeout
         gDC.logger.logInfo("DC_OPTID_NAVIGATIONTIMEOUT - Calling promptTimeout");
         gDC.promptTimeout('DC_OPTID_NAVIGATIONTIMEOUT',
            'DC_OPTID_WARNNAVTIMEOUT', 'DC_OPTID_WARNNAVTIMEOUTPROMPT',
            'dcService_promptNavTimeout',
            gDC.completeNavigationTimeout.bind(gDC, alreadyPrompted));
      } catch ( e ) {
         if (gDC._observerService && !gDC.replayShuttingDown) {
            gDC.logException( e, gDC.DCMODULE+"onNavigationTimeout" );
         }
      }
   },

   /**
    * Complete navigation timeout handling after asking user how to proceed.
    * @this {!DejaClick.DejaService}
    * @param {boolean} aAlreadyPrompted true if the current event
    *    has already encountered a navigation timeout.
    * @param {boolean} aDontWait true if we should skip to the next event
    *    or error. false to continue waiting.
    */
   completeNavigationTimeout: function (aAlreadyPrompted, aDontWait) {
      try {
         if (aDontWait) {
            // ::: proceed to the next event...

            if (this.getEventBoolPref('DC_OPTID_FAILONTIMEOUT',
                                      this.actEventNode)) {
               // We are configured to handle timeouts as a failure,
               // so terminate script replay.
               this.handleReplayTimeout('dcFailure_navigationtimeout',
                   constants.STATUS_BROWSER_TIMEOUT_NAVIGATE);
               return;

            } else {
               // We are configured to skip on timeout, so push ahead
               // and optionally repair the issue.
               if ((this.replayedEvents > 0) && !aAlreadyPrompted &&
                     this.getEventBoolPref('DC_OPTID_REPLAYADVISORREPAIR',
                        this.actEventNode)) {
                  // :: Try to repair the issue..

                  // Replay advisor 'fixes' this issue by skipping the
                  // event (don't generate a failure).
                  var eventType = this.actEventNode.getAttribute('type');
                  if (eventType != "navigate") {
                     this.setEventBoolPref('DC_OPTID_FAILONTIMEOUT', false,
                        this.actEventNode );
                  }

                  // for this event, reduce the next nav timeout in case there are multiple
                  gDC.setEventIntPref( 'DC_OPTID_NAVIGATIONTIMEOUT', 2000, gDC.actEventNode);

                  // Reset optional auto-shutdown.
                  this.setSystemBoolPref('DC_OPTID_AUTOPOWEROFF', false);
                  this.advisorRepairs = true;
               }
               this.handleSkippedEvent('DC_OPTID_WARNEVTTIMEOUTPROMPT',
                  'dcWarning_eventtimeout');
            }

         } else if (this._runMode == constants.RUNMODE_STOPPED) {
            return;  // ::: User has stopped replay.

         } else {
            // ::: User wants to extend timeout and continue waiting.

            this.restartNavigationTimeout();
            // restart event replay timer to continue processing the recording
            if (this.replayTimeout == null) {
               this.restartReplayTimeout();
            }
            this._setWaitType(constants.WAITTYPE_PROCESSING);
         }

         //gDC.areWeThereYet();
         gDC.restartReadyTimeout();
         return;

      } catch (e) {
         if (this._observerService && !this.replayShuttingDown) {
            this.logException(e, this.DCMODULE + 'completeNavigationTimeout');
         }
      }
   },

   //------------------------------------------------
   // handles the checkpoints for the current event
   // returns true if all checkpoints were successfully processed
   // (meaning that we are now ready to replay the next event)
   processCheckpoints : function()
   {
      var lastEventSeq;
        function checkPendingActivity() {

            if (gDC.fullpageObjects) {
               // if the 'Wait for all page objects to load' Network Activity property
               // is enabled, we must observe a variety of additional activity flags
               // before proceeding with our next event.
               var timeToWait = false;

               if (gDC.pendingActivity || gDC.pendingNetwork || gDC.pendingXMLRequest || gDC.netActivityCount > 0 || gDC.isBrowserActive()) {
                  timeToWait = true;
               }

               if (gDC.netActivityCount > 0) {
                  var networkActivityRemaining = false;
                  for (var i=0; i < gDC.browsersTracked.length; i++) {
                     if (gDC.browsersTracked[i].networkActivity > 0) {
                        networkActivityRemaining = true;
                        // we also refresh our network timer unless all tracked browser throbbers are idle
                        if (gDC.networkTimeout==null) { gDC.restartNetworkTimeout(); }
                     }
                  }
                  if (!networkActivityRemaining && !gDC.pendingLocations) {
                     timeToWait = false;
                  }
               }

               if (timeToWait) {
                  if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: browser or network activities are pending (fullpage) - exiting..."); }
                  return true;
               }


            } else {
               // if the 'Wait for all page objects to load' option is NOT enabled,
               // we can zip much faster through pages before they are fully loaded,
               // however, not all pages will be able to handle this advanced setting.
               if (gDC.isBrowserActive()) {
                  if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: browser or network activities are pending (non-fullpage) - exiting..."); }
                  return true;
               }
            }

           return false;  // ok to proceed

         }  // end of checkPendingActivity()

      try {

         var _validationTypes = [ gDC.VALIDATIONTYPE_JAVASCRIPT, gDC.VALIDATIONTYPE_KEYWORD, gDC.VALIDATIONTYPE_IMAGE ];

         // :::::::::::::::::::::::::::::::::::::::::
         // :::  begin processCheckpoints() logic :::
         // :::::::::::::::::::::::::::::::::::::::::

         if (gDC.activeStyleApplied) {
            // Update last targeted dom node style from activated to
            // highlighted (if needed).
            gDC._observerService.notifyDocument(this.lastTargetDocId,
               'dejaclick:applyStyle',
               {
                  searchId: this.lastTargetSearchId,
                  style: gDC.getEventStringPref('DC_OPTID_HIGHLIGHTSTYLE',
                                                gDC.actEventNode)
               });
            this.activeStyleApplied = false;
         }

         if (gDC._runMode != constants.RUNMODE_REPLAY || gDC._waitType == constants.WAITTYPE_STOPPING) {
            gDC.stopReadyTimeout();
            gDC.stopReplayTimeout();
            if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: browser is in non-replay mode - exiting..."); }
            return false;
         }
         if (gDC.replayShuttingDown || gDC.exceptionCount > 0) {
            gDC.stopReadyTimeout();
            gDC.stopReplayTimeout();
            gDC.resetActivity();
            gDC._setWaitType( constants.WAITTYPE_STOPPING );
            if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: browser is shutting down - exiting..."); }
            return false;
         }

         //UXM-10759 - Check if we have downloads pending to be finsihed.
         if ( gDC._runMode == constants.RUNMODE_REPLAY && ( gDC.activeDownloads && gDC.activeDownloads.length > 0 || gDC.expectedDownloads > 0 ) ) {
            gDC.logger.logDebug("Waiting on downloads... Event not done! ["+gDC.activeDownloads.length+"  downloads in progress]["+gDC.expectedDownloads+" downloads not started]");
            gDC.restartReadyTimeout();
            return false;
         }
        
         if (gDC.pendingActValidation || gDC.pendingEvtValidation) {
            gDC.pendingValidate = true;
         }
         else {
            gDC.pendingValidate = false;
         }
         
         var pendingItems="";  // check for misc pending items
         if (gDC.browsersTracked.length === 0) { pendingItems += "(tracked browsers)"; }
         if (gDC.userNavigationEvent === "preload") { pendingItems += "(url preload)"; }
         if (gDC.pendingDialog) { pendingItems += "(dialog processing)"; }
         if (gDC.pendingDispatch) { pendingItems += "(event dispatch)"; }
         if (gDC.pendingPrompt) { pendingItems += "(pending prompt)"; }
         if (gDC.pendingValidate) { pendingItems += "(pending validate)"; }
         if (gDC.pendingResize) {pendingItems += "(pending screen resize)"; }
         if (gDC.pendingCapture) {pendingItems += "(pending capture)"; }
         if (pendingItems) {
            if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: pending items [" + pendingItems + "] - exiting..."); }
            gDC.restartReadyTimeout();
            return false;  // disallow further event processing while these items are still pending
         }
         
         // Disable Page Debug events.
         if (gDC.dialogRules && gDC.dialogRules.length && !gDC.isAuthDialog()) {
            chrome['debugger'].sendCommand({
                  tabId: gDC.lastBrowserObj.tabId
               }, 
               "Page.disable",
               null,
               function(){
               }
            );
         }
         
         var ueClientReplay = false;
/*
         var ueClientReplay = !gDC._serverOperation && gDC.getEventBoolPref( DC_OPTID_REPLAYUE );
         if (ueClientReplay) {
            if (gDC.actEventNum != 0 && checkPendingActivity()) {
               gDC.pendingActivity = false;
               gDC.restartReadyTimeout();
               return false;  // return if we have pending browser or network activity to observe
            }

            if (gDC.pendingLocations > 0) {
               if (!gDC.locationsTimeout) {
                  gDC.restartLocationTimeout();
               }
               if (gDC.logger.debugprocess)  gDC.logger.logDebug("replayNextEvent: location changes are pending (" + gDC.pendingLocations + "), exiting...");
               gDC.restartReadyTimeout();
               return false;
            }
         }
*/

         if (gDC.thinktimeStop > 0 && gDC.actEventNum !== 0) {

            // if user pause intervals setting is on, we are guaranteed to
            // release the processor for at least one cycle, regardless of
            // whether the thinktime interval has already passed.
            var timenow = Date.now();
            if (timenow >= gDC.thinktimeStop) {
               // attach the actual thinktime interval that was observed to the action result attribute
               gDC.resEventNode.setAttribute('thinktime', (timenow - gDC.thinktimeStart)/1000);
               gDC.thinktimeStop = 0;
            }
            if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: thinktime in progress (current: " + timenow + ", thinktimeStop: " + gDC.thinktimeStop + "), exiting..."); }

            gDC._setWaitType( constants.WAITTYPE_THINKTIME );
            if (gDC.lastReadyTimeout < 1000) {
               gDC.lastReadyTimeout += 100;  // important!
            }
            gDC.restartReadyTimeout();
            return false;
         }
/*
         else if (ueClientReplay && gDC.classifytimeStop > 0 && gDC.actEventNum != 0) {

            var timenow = Date.now();
            if (timenow >= gDC.classifytimeStop) {
               gDC.classifytimeStop = 0;
            }

            gDC._setWaitType( constants.WAITTYPE_CLASSIFYTIME );
            if (gDC.lastReadyTimeout < 1000) {
               gDC.lastReadyTimeout += 100;  // important!
            }
            gDC.restartReadyTimeout();
            return false;
         }
*/
         if (!ueClientReplay && !gDC.lastEventSkipped) {
            if (gDC.actEventNum !== 0 && checkPendingActivity()) {
               gDC.pendingActivity = false;
               gDC.restartReadyTimeout();
               return false;  // return if we have pending browser or network activity to observe
            }

            if (gDC.pendingLocations > 0) {
               if (!gDC.locationsTimeout) {
                  gDC.restartLocationTimeout();
               }
               if (gDC.logger.debugprocess) { gDC.logger.logDebug("replayNextEvent: location changes are pending (" + gDC.pendingLocations + "), exiting..."); }
               gDC.restartReadyTimeout();
               return false;
            }
         }

         //  check if we have heard all the matching navigation (tree) events for previously injected events
         //  --------
         if (gDC._navTreeRoot.getElementsByTagName('event').length + gDC.eventsSkipped.length + gDC.eventsBranched.length < gDC.replayedEvents) {
            var len = gDC._navTreeRoot.getElementsByTagName('event').length + gDC.eventsSkipped.length + gDC.eventsBranched.length;

            // popup the Replay Advisor if this situation lasts too long
//            if (!gDC.navigationTimeout) { gDC.restartNavigationTimeout(); }

            if (gDC.logger.debugprocess) {
               gDC.logger.logDebug("replayNextEvent: exiting -- completed events (" +
                  gDC._navTreeRoot.getElementsByTagName('event').length +
                  ") plus skipped events (" + gDC.eventsSkipped.length +
                  ") plus branched events (" + gDC.eventsBranched.length +
                  ") is less than replayed events (" + gDC.replayedEvents +
                  ")");
            }
            gDC.restartReadyTimeout();
            return false;
         }

         gDC.stopNavigationTimeout();
         if (gDC.replayedEvents > 0) {
            if (gDC.mutationsRecorded || (gDC.mutationsRequired && gDC.mutationsCount < gDC.mutationsRequired)) {
               // The Use Mutations setting is enabled, and mutations were recorded for
               // the previous event - or a required minimum number of mutations was set
               // in property settings, so set a timer to wait for them to clear, else
               // popup Replay Advisor if mutations do not begin by required interval.
               gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               gDC.restartMutationBeginTimeout();
               if (gDC.debugprocess) { gDC.logger.logDebug("replayNextEvent: mutation events are pending, exiting..."); }
               if (gDC.lastReadyTimeout < 1000) {
                  gDC.lastReadyTimeout += 100;  // important!
               }
               gDC.restartReadyTimeout();
               return false;
            }
         }
         //  before processing the following checkpoints, see if we are externally suspended
         if (gDC.isExecutionSuspended()) {
            // yes, we're suspended, so fire off a timer to call ourselves
            // again, retrying until the pref option has been deactivated.
            gDC.stopReadyTimeout();
            gDC.stopReplayTimeout();
            gDC.lastSuspendDelay = gDC.lastSuspendDelay ? gDC.lastSuspendDelay : gDC.getSystemIntPref('DC_OPTID_SUSPENDDELAY');
            if (gDC.debugprocess) { gDC.logger.logDebug("replayNextEvent: external activities pending, sleeping for " + Number(gDC.lastSuspendDelay)/1000 + " seconds..." ); }
            gDC._setWaitType( constants.WAITTYPE_ANALYZING );
//            gDC._observerService.notifyLocalObservers("dejaclick:replaypending", null);
            gDC.restartReplayTimeout( gDC.lastSuspendDelay );
            if (gDC.networkTimeout==null) { gDC.restartNetworkTimeout(); }
            return false;
         }

         // get the last event seq number of the current action
         if (gDC.actActionNum) {
            var actionEvents = gDC.actActionNode.getElementsByTagName('event');
            if (actionEvents.length) {
               lastEventSeq = Number(actionEvents[ actionEvents.length-1 ].getAttribute('seq'));
               var firstEventSeq = Number(actionEvents[0].getAttribute('seq'));
            }
         }

         // teardown all timers now (before auto-pause or validation checking)
         gDC.teardownAsyncTimers();

         //  Pause checkpoint
         //  --------
         // check for Event-level pause mode
         if (gDC.actEventNum) {
            if (gDC.lastPausedEvent != gDC.replayedEvents) {
               if (gDC.checkAutoPauseMode( constants.DC_AUTOPAUSE_EVENT )) {
                  return false;
               }
            }
         }
         // check for Action-level pause mode
         if (gDC.actActionNum && gDC.actEventNum == lastEventSeq) {
            if (gDC.lastPausedEvent != gDC.replayedEvents) {
               if (gDC.checkAutoPauseMode( constants.DC_AUTOPAUSE_ACTION )) {
                  return false;
               }
            }
         }

         //  Validation checkpoint
         //  ----------
         if (!gDC.branchingRule) {

               // check for Javscript validations
            if (gDC.validationType == gDC.VALIDATIONTYPE_JAVASCRIPT && gDC.lastValidationEvent != gDC.actEventNum) {
               gDC.pendingEvtValidation = true;
               var evtValReturn = gDC.processValidations( gDC.actEventNode, gDC.VALIDATIONTYPE_JAVASCRIPT);
               var actValReturn = false;
               if (gDC.actActionNum && (gDC.actEventNum == lastEventSeq)) {
                  gDC.pendingActValidation = true;
                  actValReturn = gDC.processValidations( gDC.actActionNode, gDC.VALIDATIONTYPE_JAVASCRIPT);
               }
               if (evtValReturn || actValReturn) {
                  // validation failure or wait-for-validation, restart loop
                  if (gDC.lastReadyTimeout < 1000) {
                     gDC.lastReadyTimeout += 200;  // important!
                  }
                  gDC.restartReadyTimeout();
                  return false;
               }
            }
         }

         if (gDC._serverOperation && gDC.pendingStepTiming && gDC.replayedEvents > 0) {
            gDC.setSystemBoolPref('DC_OPTID_SUSPENDREPLAY', true);
            this._observerService.notifyLocalObservers('dejaclick:stopTiming', {
               script: this._script,
               resultNode: this.resEventNode,
               success: true
            });
            gDC.stopReadyTimeout();
            gDC.stopReplayTimeout();
            gDC.lastSuspendDelay = gDC.lastSuspendDelay ? gDC.lastSuspendDelay : gDC.getSystemIntPref('DC_OPTID_SUSPENDDELAY');
            if (gDC.debugprocess) { gDC.logger.logDebug("replayNextEvent: external activities pending, sleeping for " + Number(gDC.lastSuspendDelay)/1000 + " seconds..." ); }
            gDC._setWaitType( constants.WAITTYPE_ANALYZING );
            gDC.restartReplayTimeout( gDC.lastSuspendDelay );
            return false;
         }

         //  Capture checkpoint
         //  --------
         var captureLevel = gDC.getEventStringPref('DC_OPTID_CAPTURELEVEL', gDC.actEventNode);
         if (captureLevel && !gDC.captureInitiated) {
            // check for Event-level capture
            if (gDC.actEventNum && captureLevel.match(/eve|evt/)) {
               gDC.notifyCaptureData('evt');

               // check for Action-level capture
            } else if (gDC.actActionNum &&
                  (gDC.actEventNum === lastEventSeq) &&
                  captureLevel.match(/act/)) {
               gDC.notifyCaptureData('act');
            }
            if (gDC.captureInitiated) {
               return false;
            }
         }
         
         return true;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"processCheckpoints" );
      }
   },

   /**
    * Notify the replay server to initiate a capture.
    * @this {!DejaClick.DejaService}
    * @param {string} aLevel The cause for the capture (act, evt, or err).
    */
   notifyCaptureData: function(aLevel) {
      if (this._serverOperation) {
         this.captureInitiated = true;
         this.pendingCapture = true;
         gDC.setSystemBoolPref('DC_OPTID_SUSPENDREPLAY', true);
         this._observerService.notifyLocalObservers('dejaclick:capturedata', {
            id: ('000' + this.replayedEvents).slice(-3) + '_' +
               ('00' + this.subscriptNum).slice(-2) + '-' +
               ('000' + this.actEventNum).slice(-3) + '_' + aLevel,
            group: this.getEventStringPref('DC_OPTID_CAPTUREGROUP',
               this.actEventNode)
         });
      }
   },

   initValidator : function(aValidator, aValidationNode)
   {

      try {
         // Get the 'raw' validation text from either the scriptvar or the "matchtext" node
         var strMatchText;
         if (gDC._script.domTreeHasValidateParam(aValidationNode, "varreference")) {         
            var nodeList = gDC._search.processXPath (aValidationNode, "child::validateparams/param[@name='varreference']/text()");
            
            if (!nodeList || nodeList.length < 1) {
               gDC.logger.logWarning(gDC.DCMODULE+"initValidator: no matching validation nodes found");
               return -1;            
            }
            var scriptVarInfo = gDC.getVariableInfo(nodeList[0].data);

            //UXM-11401 - Instead of evaluating the script variable here, we have to do it in the tabs.
            //So, I am including the info at the validation object, so it can be sent to the tab.
            aValidator.scriptVarInfo = scriptVarInfo;
         }
         else {
            strMatchText = gDC._script.domTreeGetValidateParam(aValidationNode, "matchtext");
         }

         if ( ! aValidator.scriptVarInfo && 
            ( !strMatchText || strMatchText.length < 1) )
         {
            return 0;
         }

         aValidator.strMatchText = strMatchText;

         // Build the regex string...
         aValidator.bFixSpaces = gDC._script.domTreeGetValidateParam(aValidationNode, "fixspaces") == "true";
         if (aValidator.bFixSpaces && ! aValidator.scriptVarInfo ) {
            strMatchText = strMatchText.replace(/&nbsp;|[\s\"]+/g, " ");
         }

         aValidator.matchtype = gDC._script.domTreeGetValidateParam(aValidationNode, "matchtype");
         aValidator.matchword = gDC._script.domTreeGetValidateParam( aValidationNode, "matchword" );
         if ( strMatchText ) {
            switch (Number(aValidator.matchtype)) {

               case 1: // Plain text string
                  // escape any characters with special meaning in regular expressions
                  strMatchText = strMatchText.replace(/([\"\^\$\.\*\+\?\=\!\:\|\\\/\(\)\[\]\{\}])(.)/g, "\\$1$2");
   
                  // whole-word is only used in plain-text matches
                  if ( aValidator.matchword == "true" ) {
   
                     // trim any trailing whitespace so whole word match won't fail
                     strMatchText = strMatchText.replace(/([^\s]*)[\s]*$/, "$1");
                     // apply word-boundary delimiters to the suggesting text
                     strMatchText = "\\W" + strMatchText + "\\W";
                  }
                  break;
   
               case 2: // Regular expression
                  break;
   
               default: // Not recognized type
                  return 0;
            }
         }
         
         // ...the Option string...
         var strOptions = gDC._script.domTreeGetValidateParam(aValidationNode, "matchcase") == "true" ? "" : "i";
         strOptions += gDC._script.domTreeGetValidateParam(aValidationNode, "allowwrap") == "true" ? "m" : "";

         // At this point we have a good 'validator' object w/ the params given by [aValidationNode]
         aValidator.oRegExText = strMatchText;
         aValidator.strOptions = strOptions;
         return 1;
      }
      catch ( service_e ) {
         gDC.logException(service_e, gDC.DCMODULE + "initValidator");
      }
      return 0;
   },

   incrementValsSeqNum : function (nodeName)
   {
      if (nodeName == "event") {
         gDC.validatingEvtSeqNum++;
      }
      else {
         gDC.validatingActSeqNum++;
      }
   },
   
   resetValsSeqNum : function (nodeName)
   {
      if (nodeName == "event") {
         gDC.validatingEvtSeqNum = 0;
      }
      else {
         gDC.validatingActSeqNum = 0;
      }
   },
   
   updateValsProcessed : function (nodeName, aProcessValType, aValSeq) {

      // save the seq of the last processed validation of this type
      if (!aProcessValType || aProcessValType == gDC.VALIDATIONTYPE_KEYWORD) {
         if (nodeName=="event") {
            gDC.evtKwValsProcessed = aValSeq+1;
         } else {
            gDC.actKwValsProcessed = aValSeq+1;
         }
      } else if (aProcessValType == gDC.VALIDATIONTYPE_JAVASCRIPT) {
         if (nodeName=="event") {
            gDC.evtJSValsProcessed = aValSeq+1;
         } else {
            gDC.actJSValsProcessed = aValSeq+1;
         }
      } else if (aProcessValType == gDC.VALIDATIONTYPE_IMAGE) {
         if (nodeName=="event") {
            gDC.evtImgValsProcessed = aValSeq+1;
         } else {
            gDC.actImgValsProcessed = aValSeq+1;
         }
      }
   },

   /**
    * Process a response to searching for a keyword in a document.
    * @param {{
    *    id: integer,
    *    strMatchText: string,
    *    keywordFound: boolean
    * }} aResult
    * @param {!chrome.Tab} aTab Details of the tab containing the document
    *    that has been searched.
    * @param {integer} aDocId Id of the document that has been searched.
    */
   keywordSearchComplete : function (aResult, aTab, aDocId)
   {
      function isCVDocFailure(aDocURL, aDocSize, aDocContentType, aMatchText) {

         try {
            if (gDC.contentViews.length > 0) {
               var strViews = gDC.getContentViews(aDocURL, null, aDocSize, aDocContentType, null);
               if (gDC.isSkippedCV(strViews)) {
                  var messageLong = gDC._messageBundle.getMessage("dcWarning_requiredkeywordLong", [aMatchText]);
                  gDC.logger.logWarning( messageLong, false );
                  return true;
               }
            }
         }
         catch ( e ) {
         }
         return false;
      }
      var index, messageLong, statusLogID;
      try {

         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug('keywordSearchComplete(' + aResult.id + ', ' +
               aResult.strMatchText + ', ' + aResult.keywordFound + ', ' +
               aTab.id + ', ' + aDocId + ')');
         }

         if (gDC._runMode != constants.RUNMODE_REPLAY || gDC.replayShuttingDown) {
            gDC.logger.logWarning('keywordSearchComplete - Discarded search result as the replay has finished!');
            return;
         }


         //UXM-11786 -- Special case for the keyword search for triggered subscripts.
         if ( aResult.triggerSearchId != null ) {
            if (gDC.logger.debugprocess) {
               gDC.logger.logDebug("keywordSearchComplete - triggeredSubscriptSearch - Received result! "+JSON.stringify(aResult));
            }

            if ( aResult.keywordFound ) {
               gDC.logger.logInfo("keywordSearchComplete - triggeredSubscriptSearch - Found keyword for triggered subscript "+aResult.triggerSearchId+"! ");

               if ( gDC.checkTriggerCounts(aResult.triggerSearchId) ) {
                  gDC.triggerFired = aResult.triggerSearchId;
               }
            } else {
               if (gDC.logger.debugprocess) {
                  gDC.logger.logDebug("keywordSearchComplete - triggeredSubscriptSearch - NO keyword found for triggered subscript "+aResult.triggerSearchId+"! ");
               }
            }

            if ( gDC.waitingForTriggerKeywordResult !== null ) { 
               gDC.waitingForTriggerKeywordResult.delete(aResult.triggerSearchId);
            }
            return;
         }

         if (!gDC.activeValidations.hasOwnProperty(aResult.id)) {
            // The search is no longer active. Discard the results.
            if (gDC.logger.debugprocess) {
               gDC.logger.logDebug('keywordSearchComplete search inactive');
            }
            return;
         }

         if ( aResult.scriptVarInfo && aResult.scriptVarInfo.sticky && aResult.oRegExText ) {
            gDC.logger.logDebug("Received keyword result with variable sticky value. [var="+aResult.scriptVarInfo.varName+"][Value="+aResult.oRegExText+"]");
            gDC._variables[aResult.scriptVarInfo.varName] = aResult.oRegExText;
         }

         var validationObj = gDC.activeValidations[aResult.id];

         //UXM-10657 - If we have time remaining, let's retry keyword search!
         //Maximum of 2 retries, in other words, 3 search attempts in total.
         //This retry could also resolve UXM-10586
         if ( ! aResult.keywordFound && validationObj.errorType == 1 && ( ! aResult.retries || aResult.retries < 3 ) ) {
            if ( ! aResult.startTS ) {
               aResult.startTS = (new Date()).getTime();
            }
            var timeLeft = gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode);
            var elapsedTime = (new Date()).getTime() - aResult.startTS;
            if ( gDC.validationTimeout !== null || gDC.eventTimeout !== null ) {
               timeLeft = gDC._getTimeoutRemainingTime( ( gDC.validationTimeout !== null ) ? gDC.validationTimeout : gDC.eventTimeout );
               elapsedTime = gDC._getTimeoutElapsedTime( ( gDC.validationTimeout !== null ) ? gDC.validationTimeout : gDC.eventTimeout );
            } else if ( gDC.logger.debugprocess ) {
               gDC.logger.logDebug("keywordSearchComplete - Using DC_OPTID_EVENTTIMEOUT as the timeout for the retries, as the validation timeout is not defined.");
            }
            var sleepTimeForRetry = ( timeLeft > 5000 ) ? 2000: Math.ceil(timeLeft/2);
            
            //Sleep for half of the time remaining and retry.
            if ( timeLeft > 0 ) {
               if ( ! aResult.retries ) {
                  aResult.retries = 1;
               } else {
                  aResult.retries++;
               }
               if ( aResult.retries < 2 || aResult.preferred ) {
                  gDC.logger.logInfo("Keyword not found. Retrying again at document "+aDocId+" [TabID="+(aTab?aTab.id:"N/A")+"] because we have time remaining [Time Remaining before timeout: "+timeLeft+"ms][Search Time Spent: "+elapsedTime+"ms][Sleep Time Before Next Retry: "+sleepTimeForRetry+"ms][SearchID="+aResult.id+"][Retries= "+aResult.retries+"]");
                  setTimeout(
                     function(){
                        //Retry just for the document where it wasn't found, not for all the documents.
                        gDC._observerService.notifyDocument(aDocId, 'dejaclick:keywordsearch', aResult 
                        );},
                     sleepTimeForRetry
                  );
               } else if ( ! gDC.activeValidations[aResult.id].allDocumentsRetryTS 
                     || ( (new Date()).getTime()) > ( gDC.activeValidations[aResult.id].allDocumentsRetryTS + sleepTimeForRetry) ) 
               {
                  gDC.activeValidations[aResult.id].allDocumentsRetryTS = (new Date()).getTime();
                  gDC.logger.logInfo("Keyword not found at already existing documents. Retrying again at all documents because a new document could have been generated [Time Remaining before timeout: "+timeLeft+"ms][Search Time Spent: "+elapsedTime+"ms][Sleep Time Before Next Retry: "+sleepTimeForRetry+"ms][SearchID="+aResult.id+"][Retries= "+aResult.retries+"]");
                  setTimeout(
                     function(){
                           //UXM-11583 - After 2 retries, for the 3rd one, we retry in all documents just in case there is a new document created.
                           gDC._observerService.notifyObservers('dejaclick:keywordsearch', aResult );
                        },
                     sleepTimeForRetry
                  );
               } else if ( gDC.logger.debugprocess ) {
                  gDC.logger.logDebug("Keyword not found at document "+aDocId+" [TabID="+(aTab?aTab.id:"N/A")+"]. But the retry to all documents was already executed.");  
               }
               //Exit keywordSearchComplete, as we have to wait again for the keyword search result.
               return;
            } else {
               gDC.logger.logInfo("keywordSearchComplete - There is not time left for keyword search retries. ");
            }
         } 
         else if ( ! aResult.keywordFound && aResult.retries && aResult.retries > 2 ) {
            var currentElapsedTime = (new Date()).getTime() - aResult.startTS;
            gDC.logger.logInfo("Keyword not found at document "+aDocId+" [TabID="+(aTab?aTab.id:"N/A")+"]. Already tried 3 times. Nothing to do :( . [SearchID="+aResult.id+"][Search Time Spent: "+currentElapsedTime+"ms]");
         }
         

         gDC.stopValidationTimeout();

         var matchText = aResult.strMatchText;
         var seq = validationObj.seq;
         var keywordFound = aResult.keywordFound;
         var nodeName = validationObj.nodeName;
         var nodeSeq = validationObj.eventNum;
         var browserNode = gDC.lastBrowserObj;
         var domNode = null;
         var preferredDoc = validationObj.preferred;
         var docURL = aResult.docURL;
         var docSize = aResult.docSize;
         var docContentType = aResult.docContentType;

         if ( validationObj.alreadyTimedOut ) {
            gDC.logger.logInfo('Keyword - Retry Timeout Search Completed '+
                '[Id='+ aResult.id + '][MatchText='+aResult.strMatchText+']'+
                '[Found='+aResult.keywordFound+'][Tab='+aTab.id+'][DocId='+aDocId+']');
         } else {
            gDC.logger.logInfo('Keyword - Initial Search Completed '+
                '[Id='+ aResult.id + '][MatchText='+aResult.strMatchText+']'+
                '[Found='+aResult.keywordFound+'][Tab='+aTab.id+'][DocId='+aDocId+']');
         }

         // Wait for response from all documents if we are not searching in a preferred document.
         if (!preferredDoc) {
            index = validationObj.validationsLeft.indexOf(aDocId);
            if (index !== -1) {
               validationObj.validationsLeft.splice(index, 1);
            }
            if ((validationObj.validationsLeft.length !== 0) && !keywordFound) {
               // Wait for more responses.
               return;
            }
         }

         domNode = (nodeName == "event") ? gDC.actEventNode : gDC.actActionNode;
         // select validations of the given type (or all validations of any type)
         var xpath = "child::validations/validation";
         var aProcessValType = gDC.VALIDATIONTYPE_KEYWORD;
         if (aProcessValType) {
            xpath += "[@type=" + aProcessValType + "]";
         }

         var validationNodes = gDC._search.processXPath( domNode, xpath );
         var valNode = validationNodes[seq];

         var errorType = gDC._script.domTreeGetValidateParam( valNode, "errortype" );
         errorType = errorType?errorType:1; // use default missing attribute
         var actionType = gDC._script.domTreeGetValidateParam( valNode, "actiontype" );
         actionType = actionType?actionType:1; // use default missing attribute
         if (errorType == 1) { // do action if keyword NOT found
            if (keywordFound) {
               gDC.logger.logInfo("keyword check successful: required keyword item [" + matchText +
                                                          "] was found for KW validation " + Number(Number(seq)+1) + " of " + nodeName + " " + nodeSeq);
            } else {
               // keyword item is missing, perform assigned action
               if (actionType == 1) {

                  if (isCVDocFailure(docURL, docSize, docContentType, matchText)) {
                     gDC.handleReplayWarning( "dcWarning_requiredkeyword", null, true, constants.STATUS_VALIDATION_FAILURE );
                  }
                  else {

                     // check if it can be handled by a matching branching rule
                     if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_VALIDATION_FAILURE )) {
                        gDC.logger.logInfo("Replay failure at Keyword search complete. [errorType='Not Found'][actionType='Fail']");
            
                        // handle as a failure and terminate script replay
                        messageLong = gDC._messageBundle.getMessage("dcFailure_requiredkeywordLong", [matchText]);
                        // log a (localized) formatted message showing the specific keyword error
                        statusLogID = gDC.logger.logFailure( messageLong );
                        gDC.handleReplayFailure( "dcFailure_requiredkeyword", messageLong, constants.STATUS_VALIDATION_FAILURE, statusLogID );
                        return;
                     }
                  }
               } else {
                  if (actionType == 2 && gDC.activeValidations[aResult.id].maxWaitingTime > (new Date()).getTime() ) {
                     //UXM-12107 - The 'Continue waiting' retry will be executed by the onKeywordValidationTimeout function.
                     gDC.logger.logInfo("Keyword configured with 'Continue waiting'. Calling keyword timeout function to restart the retries");
                     gDC.activeValidations[aResult.id].allDocumentsRetryTS = false;
                     gDC.onKeywordValidationTimeout(aResult.id, aResult.strMatchText, aResult.scriptVarInfo, actionType);
                     return;
                  } else if ( actionType == 2 ) {
                     gDC.logger.logInfo("Replay failure at Keyword search complete. [errorType='Not Found'][actionType='Continue waiting']");

                     gDC.logger.logWarning("Keyword configured with 'Continue waiting'. But we have reached Event Timeout!  [maxWaitingTime="+gDC.activeValidations[aResult.id].maxWaitingTime+"] [CurrentTS="+(new Date()).getTime()+"]");
                     delete gDC.activeValidations[aResult.id];
                     let message = gDC._messageBundle.getMessage("dcFailure_eventtimeout_keyword_continuewaiting_long", [matchText]);
                     let logId = gDC.logger.logFailure(message);
                     gDC.handleReplayFailure( "dcFailure_eventtimeout_keyword_continuewaiting", 
                        message, constants.STATUS_BROWSER_TIMEOUT_EVENT, logId );
                     return;
                  } else if (actionType == 3) {
                     gDC.logger.logInfo("Replay failure at Keyword search complete. [errorType='Not Found'][actionType='Custom Error']");

                     //var actionError = gDC._script.domTreeGetValidateParam( valNode, "actionCustomError" );
                
                     messageLong = gDC._messageBundle.getMessage("dcFailure_requiredKeywordCustomErrorLong", [matchText]);
                     // log a (localized) formatted message showing the specific keyword error
                     statusLogID = gDC.logger.logFailure( messageLong );
                     gDC.handleReplayFailure( "dcFailure_requiredKeywordCustomError", messageLong, constants.STATUS_CUSTOM_ERROR, statusLogID );
                     return;
                  }
               }
            }
         } else if (errorType == 2) { // do action if keyword FOUND
            if (keywordFound) {

               // keyword item was found, perform assigned action
               if (actionType == 1) {

                  if (isCVDocFailure(docURL, docSize, docContentType, matchText)) {
                     gDC.handleReplayWarning( "dcWarning_requiredkeyword", null, true, constants.STATUS_VALIDATION_FAILURE );
                  }
                  else {

                     if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_VALIDATION_FAILURE )) {
                        gDC.logger.logInfo("Replay failure at Keyword search complete. [errorType='Found'][actionType='Fail']");

                        // handle as a failure and terminate script replay
                        messageLong = gDC._messageBundle.getMessage("dcFailure_errorkeywordLong", [matchText]);

                        // log a (localized) formatted message showing the specific keyword error
                        statusLogID = gDC.logger.logFailure( messageLong, false );

                        gDC.handleReplayFailure( "dcFailure_errorkeyword", messageLong, constants.STATUS_VALIDATION_FAILURE, statusLogID );

                        return;
                     }
                  }
               } else {
                  if (actionType == 2 && gDC.activeValidations[aResult.id].maxWaitingTime > (new Date()).getTime() ) {

                     var maxWaitingTime = gDC.activeValidations[aResult.id].maxWaitingTime;
                     delete gDC.activeValidations[aResult.id];

                     // Bug Fix : UXM-942. Add a delay between validation checks.
                     gDC.logger.logInfo("Keyword configured with 'Continue waiting'. Calling processValidations function to restart the retries [maxWaitingTime="+maxWaitingTime+"].");
                     gDC._setTimeout( 
                        function(){
                           gDC.processValidations(domNode, gDC.VALIDATIONTYPE_KEYWORD, maxWaitingTime);
                        }, 
                        gDC.DC_OPTVAL_VALIDATIONDELAY );

                     return;
                  } else if ( actionType == 2 ) {
                     gDC.logger.logInfo("Replay failure at Keyword search complete. [errorType='Found'][actionType='Continue Waiting']");

                     gDC.logger.logInfo("Keyword configured with 'Continue waiting'. But we have reached Event Timeout!  [maxWaitingTime="+gDC.activeValidations[aResult.id].maxWaitingTime+"] [CurrentTS="+(new Date()).getTime()+"]");
                     delete gDC.activeValidations[aResult.id];
                     let message = gDC._messageBundle.getMessage("dcFailure_eventtimeout_keyword_found_continuewaiting_long", [matchText]);
                     let logId = gDC.logger.logFailure(message);
                     gDC.handleReplayFailure( "dcFailure_eventtimeout_keyword_found_continuewaiting", 
                        message, constants.STATUS_BROWSER_TIMEOUT_EVENT, logId );
                     return;
                  } else if (actionType == 3) {
                     gDC.logger.logInfo("Replay failure at Keyword search complete. [errorType='Found'][actionType='Custom Error']");

                     //var actionError = gDC._script.domTreeGetValidateParam( valNode, "actionCustomError" );
                
                     messageLong = gDC._messageBundle.getMessage("dcFailure_errorKeywordCustomErrorLong", [matchText]);
                     // log a (localized) formatted message showing the specific keyword error
                     statusLogID = gDC.logger.logFailure( messageLong );
                     gDC.handleReplayFailure( "dcFailure_errorKeywordCustomError", messageLong, constants.STATUS_CUSTOM_ERROR, statusLogID );
                     return;
                  }       
               }
            } else {
               gDC.logger.logInfo("keyword check successful: error keyword item [" + matchText +
                                                          "] was not found for KW validation " + Number(Number(seq)+1) + " of " + nodeName + " " + nodeSeq);
            }
         }

         delete gDC.activeValidations[aResult.id];

         gDC.updateValsProcessed (nodeName, gDC.VALIDATIONTYPE_KEYWORD, seq);
         gDC.incrementValsSeqNum(nodeName);

         gDC.processValidations(domNode, gDC.VALIDATIONTYPE_KEYWORD);
         }
      catch (e) {
         gDC.logException(e, gDC.DCMODULE + "keywordSearchComplete");
      }
   },

   /**
    * @this {!DejaClick.DejaService}
    * @param {integer} aId ID of the keyword validation process.
    * @param {string} aText The text to be matched.
    */
   onKeywordValidationTimeout: function(aId, aText, aScriptVarInfo, aActionType, failOnFound) {
      var message, logId;
      try {
         this.stopValidationTimeout();
         if (!this.activeValidations.hasOwnProperty(aId)) {
            // The validation has already completed.
            return;
         }
      
         if (gDC._runMode != constants.RUNMODE_REPLAY || gDC.replayShuttingDown) {
            gDC.logger.logWarning('keywordSearchComplete - Discarded search result as the replay has finished!');
            return;
         }

         var validationObj = gDC.activeValidations[aId];

         /*
          * UXM-11522 & UXM-11583 - New retry functionality for keyword search timeout.
          */
         if ( aActionType != 2 && validationObj.alreadyTimedOut && 
               ( ( ! validationObj.preferred ) ||  // Just one retry for "All documents" keywords.
                  ( validationObj.preferred && validationObj.alreadyTimedOut > 3 ) ) //Max 3 retries for "Selected document"
               ) 
         { 
            gDC.logger.logWarning("Keyword - Already timed out before ("+validationObj.alreadyTimedOut+"). We cannot retry again.");
         } else if ( aActionType == 2 && validationObj.maxWaitingTime < (new Date()).getTime() ) {
            gDC.logger.logWarning("Keyword - Continue waiting mode - Reached maximum event timeout. We cannot retry again.");
            delete gDC.activeValidations[aId];
         } else { 
            if ( validationObj.alreadyTimedOut ) {
               validationObj.alreadyTimedOut++;
            } else {
               validationObj.alreadyTimedOut = 1;
            }
            
            var timeout = gDC.getEventIntPref('DC_OPTID_DOCKEYWORDVALTIMEOUT', gDC.actEventNode);
            var retriesTimeout = timeout/3;
            if ( validationObj.preferred 
               && validationObj.alreadyTimedOut <= 3 ) //UXM-12107 - At least the last time-out should be retried at all documents, and not at the same one, just in case, the document doesn't exist anymore.
            {
               var oldDocId = validationObj.docId;
               var docId = validationObj.docId;
               if ( validationObj.valNode ) {
                  var navDocNode = gDC.findTargetDocument( validationObj.valNode, 0 );
                  if (navDocNode && navDocNode.hasAttribute('docId')) {
                     docId = Number(navDocNode.getAttribute('docId'));
                     validationObj.docId = docId;
                     if (gDC.logger.debugprocess) {
                        gDC.logger.logDebug("Keyword - DocID updated "+docId);
                     }
                  } else {
                     gDC.logger.logDebug("Keyword - target not found. Trying again with the same document.");
                  }
               }
               
               gDC.logger.logInfo("Keyword - Validation Timeout. Retrying for selected document [PreviousDocId="+oldDocId+"][NewDocId="+docId+"]");
               validationObj.validationsLeft = [validationObj.docId];
               gDC._observerService.notifyDocument(validationObj.docId, 'dejaclick:keywordsearch', validationObj.args );
            } else {
               gDC.logger.logInfo("Keyword - Validation Timeout. Retrying for all active documents"+(validationObj.preferred?" after multiple timeouts at the preferred document.":"."));
               validationObj.validationsLeft = gDC._observerService.notifyObservers('dejaclick:keywordsearch', validationObj.args );
               var timeout = gDC.getEventIntPref('DC_OPTID_SEARCHKEYWORDVALTIMEOUT', gDC.actEventNode);
               retriesTimeout = timeout/2;
            }

            gDC.restartValidationTimeout(gDC.onKeywordValidationTimeout.
                  bind(gDC, validationObj.args.id, validationObj.args.strMatchText, validationObj.args.scriptVarInfo, validationObj.actionType),
                  retriesTimeout);

            return;
         }

         var nodeName = validationObj.nodeName;
         var nodeSeq = validationObj.eventNum;
         var domNode = (nodeName == "event") ? gDC.actEventNode : gDC.actActionNode;
         var seq = validationObj.seq;

        // select validations of the given type (or all validations of any type)
         var xpath = "child::validations/validation";
         var aProcessValType = gDC.VALIDATIONTYPE_KEYWORD;
         if (aProcessValType) {
            xpath += "[@type=" + aProcessValType + "]";
         }
         var validationNodes = gDC._search.processXPath( domNode, xpath );
         var valNode = validationNodes[seq];
         var actionType = gDC._script.domTreeGetValidateParam( valNode, "actiontype" );
         actionType = actionType?actionType:1; // use default missing attribute

         var errorType = gDC._script.domTreeGetValidateParam( valNode, "errortype" );
         errorType = errorType?errorType:1; // use default missing attribute
         if ( errorType == 2 && ( ! failOnFound && actionType == 2 ) ) {
            //UXM-10657 - For keywords that have to fail on found, we are good
            //it is timing out because on one of the retries we couldn't find it, 
            //so we can just continue with playback. This is not a failure.
            return;
         }

         if ( aScriptVarInfo ) {
            message = this._messageBundle.getMessage('dcFailure_keywordScriptVarTimeoutLong', [aScriptVarInfo.varName]);
         } else if ( actionType == 2 ) {
            message = this._messageBundle.getMessage(failOnFound?"dcFailure_eventtimeout_keyword_found_continuewaiting_long":"dcFailure_eventtimeout_keyword_continuewaiting_long", [aText]);
         } else {
            message = this._messageBundle.getMessage('dcFailure_keywordTimeoutLong', [aText]);
         }
         
         logId = this.logger.logFailure(message);
         
         if (actionType == 1) {
            this.logger.logInfo("Replay failure at Keyword validation timeout. [errorType='Not Found'][actionType='Fail']");
            this.handleReplayFailure('dcFailure_keywordTimeout', message,
                    constants.STATUS_VALIDATION_FAILURE, logId);
         } else if ( actionType == 2 ) {
            this.logger.logInfo("Replay failure at Keyword validation timeout. [actionType='Continue waiting']");
            this.handleReplayFailure( failOnFound?"dcFailure_eventtimeout_keyword_found_continuewaiting":"dcFailure_eventtimeout_keyword_continuewaiting", 
                     message, constants.STATUS_BROWSER_TIMEOUT_EVENT, logId );
         } else {
            this.logger.logInfo("Replay failure at Keyword validation timeout. [errorType='Not Found'][actionType='Custome error']");
            this.handleReplayFailure('dcFailure_keywordTimeout', message,
                       constants.STATUS_CUSTOM_ERROR, logId);
         }   

      } catch (e) {
         this.logException(e, this.DCMODULE + 'onKeywordValidationTimeout');
      }
   },

    /**
    * @this {!DejaClick.DejaService}
    * @param {integer} aId ID of the javascript validation process.
    * @param {string} aText The text to be executed.
    */
   onJavascriptValidationTimeout: function(aId, aText) {
      var message, logId;
      try {
         this.stopValidationTimeout();
         if (!this.activeValidations.hasOwnProperty(aId)) {
            // The validation has already completed.
            return;
         }

         this.logger.logInfo("Replay failure at JavaScript validation timeout.");
            
         message = this._messageBundle.getMessage('dcFailure_javascriptTimeoutLong', [aText]);
         logId = this.logger.logFailure(message);
         this.handleReplayFailure('dcFailure_javascriptTimeout', message,
            constants.STATUS_VALIDATION_FAILURE, logId);

      } catch (e) {
         this.logException(e, this.DCMODULE + 'onJavascriptValidationTimeout');
      }
   },

    /**
    * @this {!DejaClick.DejaService}
    * @param {integer} aId ID of the javascript validation process.
    * @param {Array} aResult Result of the javascript execution on every frame.
    */   
   javascriptExecuteComplete: function(aId, aResult) {
      try {
         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug('javascriptExecuteComplete(' + aId + ')');
         }

         if (gDC.replayShuttingDown) {
            return;
         }

         if (!gDC.activeValidations.hasOwnProperty(aId)) {
            // The search is no longer active. Discard the results.
            if (gDC.logger.debugprocess) {
               gDC.logger.logDebug('javascriptExecuteComplete search inactive');
            }
            return;
         }
         
         gDC.stopValidationTimeout();

         var validationObj = gDC.activeValidations[aId];
         var nodeName = validationObj.nodeName;
         var nodeSeq = validationObj.eventNum;
         var domNode = (nodeName == "event") ? gDC.actEventNode : gDC.actActionNode;
         var seq = validationObj.seq;
         var jsText = validationObj.args;
         
        // select validations of the given type (or all validations of any type)
         var xpath = "child::validations/validation";
         var aProcessValType = gDC.VALIDATIONTYPE_JAVASCRIPT;
         if (aProcessValType) {
            xpath += "[@type=" + aProcessValType + "]";
         }         
         var validationNodes = gDC._search.processXPath( domNode, xpath );
         var valNode = validationNodes[seq];

         // Now evaluate the code, using the target as the code's execution context
         var result = null;
         if (!aResult) {
            gDC.logger.logWarning(gDC.DCMODULE+"processValidations: error evaluating JavaScript validation of " +
                                     nodeName + " " + nodeSeq + "...");    
            delete gDC.activeValidations[aId];
            gDC.updateValsProcessed (nodeName, gDC.VALIDATIONTYPE_JAVASCRIPT, seq);
            gDC.incrementValsSeqNum (nodeName);
            gDC.processValidations(domNode, gDC.VALIDATIONTYPE_JAVASCRIPT);
            return;                                     
         }
         for (var i = 0; i < aResult.length; i++) {
            if (aResult[i] !== null) {
               result = aResult[i];
               break;
            }
         }
            
         if (result == null) {
            gDC.logger.logWarning(gDC.DCMODULE+"processValidations: error evaluating JavaScript validation " +
                                 "-- skipping JS validation of " + nodeName + " " + nodeSeq + "...");
            delete gDC.activeValidations[aId];
            gDC.updateValsProcessed (nodeName, gDC.VALIDATIONTYPE_JAVASCRIPT, seq);
            gDC.incrementValsSeqNum (nodeName);
            gDC.processValidations(domNode, gDC.VALIDATIONTYPE_JAVASCRIPT);
            return;
         }

         var errorType = gDC._script.domTreeGetValidateParam( valNode, "errortype" );
         errorType = errorType?errorType:1; // use default missing attribute
         var actionType = gDC._script.domTreeGetValidateParam( valNode, "actiontype" );
         actionType = actionType?actionType:1; // use default missing attribute

         var strResult = typeof result == "string" ? '"' + result + '"': result;
         if (errorType == 1) { // do action if result is false
            if (Boolean(result) == true) {
               if (gDC.logger.debugprocess)  gDC.logger.logDebug("Assertion successful: JavaScript text [" + jsText + "] evaluated to " + strResult +
                                                          " (=> true) for JS validation of " + nodeName + " " + nodeSeq);
            } else {
               // assertion failed, perform assigned action
               if (actionType == 1) {

                  // check if it can be handled by a matching branching rule
                  if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_VALIDATION_FAILURE)) {

                     gDC.logger.logInfo("Replay failure at JavaScript execution [errorType='false'][actionType='Fail']");

                     // handle as a failure and terminate script replay
                     var messageLong = gDC._messageBundle.getMessage("dcFailure_posAssertionLong", [jsText,strResult]);

                     // log a (localized) formatted message showing the specific validation error
                     var statusLogID = gDC.logger.logFailure( messageLong, false );
                     gDC.handleReplayFailure( "dcFailure_posAssertion", messageLong, 5, statusLogID );
                     return;
                  }
               } else if (actionType == 2) {
                  // reset the validation sequence back to its original
                  // value and continue waiting (exit the loop)
                  if (gDC.logger.debugprocess)  gDC.logger.logDebug("wait-for-JavaScript validation pending...");
                  // Bug Fix : UXM-942. Add a delay between validation checks.
                  gDC._setTimeout( function(){gDC.processValidations(domNode, gDC.VALIDATIONTYPE_JAVASCRIPT);}, gDC.DC_OPTVAL_VALIDATIONDELAY );
                  return;

               }
            }
         } else if (errorType == 2) { // do action if result is true
            if (Boolean(result) == true) {
               // assertion failed, perform assigned action
               if (actionType == 1) {

                  // check if it can be handled by a matching branching rule
                  if (!gDC.matchesBranchingRule( constants.CONDITIONTYPE_REPLAYSTATUS, constants.STATUS_VALIDATION_FAILURE )) {
                     gDC.logger.logInfo("Replay failure at JavaScript execution [errorType='true'][actionType='Fail']");

                     // handle as a failure and terminate script replay
                     var messageLong = gDC._messageBundle.getMessage("dcFailure_negAssertionLong", [jsText,strResult]);

                     // log a (localized) formatted message showing the specific validation error
                     var statusLogID = gDC.logger.logFailure( messageLong, false );
                     gDC.handleReplayFailure( "dcFailure_negAssertion", messageLong, 5, statusLogID );
                     return;
                  }
               } else if (actionType == 2) {
                  // reset the validation sequence back to its original
                  // value and continue waiting (exit the loop)
                  if (gDC.logger.debugprocess)  gDC.logger.logDebug("wait-for-JavaScript validation pending...");
                  // Bug Fix : UXM-942. Add a delay between validation checks.
                  gDC._setTimeout( function(){gDC.processValidations(domNode, gDC.VALIDATIONTYPE_JAVASCRIPT);}, gDC.DC_OPTVAL_VALIDATIONDELAY );
                  return;
               }
            } else {
               if (gDC.logger.debugprocess)  gDC.logger.logDebug("Assertion successful: JavaScript text [" + jsText + "] evaluated to " + strResult +
                                                          " (=> false) for JS validation  of " + nodeName + " " + nodeSeq);
            } 
         
         }
         delete gDC.activeValidations[aId];
         gDC.updateValsProcessed (nodeName, gDC.VALIDATIONTYPE_JAVASCRIPT, seq);
         gDC.incrementValsSeqNum (nodeName);
         gDC.processValidations(domNode, gDC.VALIDATIONTYPE_JAVASCRIPT);
      } catch (e) {
         this.logException(e, this.DCMODULE + 'onJavascriptExecuteComplete');
      }
   },
   
    /**
    * @this {!DejaClick.DejaService}
    * @param {string} aText javascript code to be executed.
    * @param {integer} aId ID of the javascript validation process.
    * @param {Array} aTabs The array of tabs to execute the javascript code on.
    */    
   executeJavascript : function(aText, aId, aTabs)
   {
      try {
         if (aTabs && aTabs.length) {
            var tabId = aTabs[0].id;
            var details = {};
            details.code = aText;
            details.allFrames = false;
            chrome.tabs.executeScript(tabId, details, gDC.javascriptExecuteComplete.bind(gDC, aId));            

            gDC.restartValidationTimeout(gDC.onJavascriptValidationTimeout.
               bind(gDC, aId, aText),
               gDC.getEventIntPref('DC_OPTID_DOCJAVASCRIPTVALTIMEOUT',
               gDC.actEventNode));
         }
      } catch (e) {
         this.logException(e, this.DCMODULE + 'executeJavascript');
      }   
   },
   
   // check for, and process any validations.
   // returns false if no validations to process, true otherwise
   processValidations : function( aDomNode, aProcessValType, aMaxWaitingTime)
   {
      var nodeName, lastValSeq, origValSeq, nodeSeq;
         function checkValsProcessed() {
            var valsProcessed = 0;
            // get the seq of the last processed validation of this type
            if (!aProcessValType || aProcessValType == gDC.VALIDATIONTYPE_KEYWORD) {
               if (nodeName=="event") {
                  valsProcessed = gDC.evtKwValsProcessed;
               } else {
                  valsProcessed = gDC.actKwValsProcessed;
               }
            } else if (aProcessValType == gDC.VALIDATIONTYPE_JAVASCRIPT) {
               if (nodeName=="event") {
                  valsProcessed = gDC.evtJSValsProcessed;
               } else {
                  valsProcessed = gDC.actJSValsProcessed;
               }
            } else if (aProcessValType == gDC.VALIDATIONTYPE_IMAGE) {
               if (nodeName=="event") {
                  valsProcessed = gDC.evtImgValsProcessed;
               } else {
                  valsProcessed = gDC.actImgValsProcessed;
               }
            }

            // compare it to the seq of the last validation to be processed now
            if (valsProcessed >= lastValSeq ) {
               if (aProcessValType == gDC.VALIDATIONTYPE_JAVASCRIPT) {
                  if (nodeName=="event") {
                     gDC.evtJSValsProcessed = 0;
                  } else {
                     gDC.actJSValsProcessed = 0;
                  }
               } else if (aProcessValType == gDC.VALIDATIONTYPE_KEYWORD) {
                  // all Action/Event validations of this type have been processed
                  if (nodeName=="event") {
                     gDC.evtKwValsProcessed = 0;
                     gDC.pendingEvtValidation = false;
                  } else {
                     gDC.actKwValsProcessed = 0;
                     gDC.pendingActValidation = false;
                  }
               }
               return false;
            } else if (aProcessValType == gDC.VALIDATIONTYPE_IMAGE) {
               if (nodeName=="event") {
                  gDC.evtImgValsProcessed = 0;
               } else {
                  gDC.actImgValsProcessed = 0;
               }
            }

            // save the seq of the original last processed validation
            // before starting to process the current batch of validations
            origValSeq = valsProcessed;

            return true;
         }


      try {
         nodeName = aDomNode.nodeName;
         nodeSeq = aDomNode.getAttribute('seq');
         var bCVKeywordFailures = false;
         var lastImgValSeqProcessed = 0;
         
         // Bug Fix : UXM-942. Stop validation checks when not replaying or shutting down
         if (gDC._runMode != constants.RUNMODE_REPLAY || gDC.replayShuttingDown) {
            return false;
         }

         if (nodeName == "event") {
            gDC.lastValidationEvent = nodeSeq;
         }
         
         // ::::::::::::::::::::::::::::::::::::::::::
         // :::  begin validation processing logic :::
         // ::::::::::::::::::::::::::::::::::::::::::

         // if we have triggered a branching rule, skip all validations for the current event/action
         // (because the event may not have completely replayed before we jump to the next event)
         if (gDC.branchingRule) { 
            gDC.pendingActValidation = false; 
            gDC.pendingEvtValidation = false;
            gDC.areWeThereYet();    
            return false; 
         }

         // select validations of the given type (or all validations of any type)
         var xpath = "child::validations/validation";
         if (aProcessValType) {
            xpath += "[@type=" + aProcessValType + "]";
         }

         var validationNodes = gDC._search.processXPath( aDomNode, xpath );
         if (!validationNodes.length) {
            // Proceed to Keyword Validation after Javascript Validation
            if ( aProcessValType == gDC.VALIDATIONTYPE_JAVASCRIPT) {
               gDC.resetValsSeqNum(nodeName);
               gDC.validationType = gDC.VALIDATIONTYPE_KEYWORD;
               return gDC.processValidations(aDomNode, gDC.VALIDATIONTYPE_KEYWORD);
            }

            // We have no keyword validation nodes. Reset the javascript
            // validations if none are pending
            if (nodeName == "event") {
               if (!gDC.evtJSValsProcessed) {
                  gDC.pendingEvtValidation = false;
               } 
            } else {
               if (!gDC.actJSValsProcessed) {
                  gDC.pendingActValidation = false;
               }
            }
            gDC.areWeThereYet();
            return false;  // no validations to process
         }

         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug('processValidations(' + nodeName + ' ' +
               aDomNode.getAttribute('seq') + ', ' + aProcessValType + ')');
         }

         lastValSeq = validationNodes.length;

         if (!checkValsProcessed()) {
            
            if ( aProcessValType == gDC.VALIDATIONTYPE_JAVASCRIPT) {
               gDC.resetValsSeqNum(nodeName);
               gDC.validationType = gDC.VALIDATIONTYPE_KEYWORD;
               return gDC.processValidations(aDomNode, gDC.VALIDATIONTYPE_KEYWORD);
            }
            
            gDC.areWeThereYet();
            if (gDC.logger.debugprocess) {
               gDC.logger.logDebug('processValidations returning false after checkValsProcessed');
            }
            return false;
         }
         

         // okay, there are validations to process
         gDC.pendingValidate = true;  // lock replayNextEvent looping until we process our next validation

         gDC.stopReplayTimeout();
 
         gDC._setWaitType( constants.WAITTYPE_VALIDATING );

         var valNode, docNode;
         var docsList = [];

/*
         // keep track of the last successful image validation
         if (aProcessValType == gDC.VALIDATIONTYPE_IMAGE) {
            lastImgValSeqProcessed = origValSeq;
         }
*/

        var validatingSeqNum = (nodeName == "event") ? gDC.validatingEvtSeqNum : gDC.validatingActSeqNum;
        valNode = validationNodes[validatingSeqNum];
        var actionType = gDC._script.domTreeGetValidateParam( valNode, "actiontype" );
        actionType = actionType?actionType:1; // use default missing attribute

        var errorType = gDC._script.domTreeGetValidateParam( valNode, "errortype" );
        errorType = errorType?errorType:1; // use default missing attribute

        var valType = valNode.getAttribute('type');
        // Get unique ID for this search.
        var validationId = gDC.lastValidationId;
        ++validationId;
        if (validationId === 0x100000000) {
           validationId = 0;
        }
       
        if (valType == gDC.VALIDATIONTYPE_KEYWORD ) {
           
           gDC.lastValidationId = validationId;
            
           // Build a regex 'validator' w/ the params given from [valNode]
           // Initialize accounting data for the element search.
           var oValidator = {
               id : validationId,
               strMatchText: null,
               bFixSpaces: false,
               oRegExText: null,
               keywordFound : false,
               preferred : false
            };
            var validationObj = {
               seq : validatingSeqNum,
               eventNum : nodeSeq,
               nodeName : nodeName,
               args : oValidator,
               validationsLeft : [],
               actionType : actionType,
               errorType : errorType
            };
            validationObj.preferred = false;
            validationObj.maxWaitingTime = aMaxWaitingTime;
            gDC.activeValidations[validationId] = validationObj;

            switch (gDC.initValidator(oValidator, valNode)) {
               case 2: //UXM-11401  Send variable info to the tabs
                  gDC.logger.logInfo(gDC.DCMODULE+" processValidations: Sending keyword validation with variable to be evaluated at the active document (Tab).");
                  break;
               case -1: // replay failure (computing scriptvar failed)
                  gDC.logger.logInfo("Replay failure at process validations. Compute of Script var failed.");
                  gDC.handleReplayFailure( "dcFailure_populateScriptVar", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND );
                  return true;
               case 0:  // invalid regex, continue w/ the next "validation" node
                  gDC.logger.logWarning(gDC.DCMODULE+"processValidations: invalid regex " +
                                 "-- skipping keyword validation[" + validatingSeqNum + "] of " + nodeName + " " + aDomNode.getAttribute('seq') + "...");
                  break;
               default: // valid regex, continue w/ the search process
                  break;
            }

            // ...........................
            // process KEYWORD validations
            // ...........................
            xpath = "child::targets/target";
            var targetNodes = gDC._search.processXPath( valNode, xpath );

            // If we have keywording for "Selected Document", search for keyword in the particular document
            // If not, search for keywords in all documents.
            if (targetNodes.length) {
               // this validation has a specific navigation target,
               // so use the associated target data to search for
               // the best-match navigation document node.
               var navDocNode = gDC.findTargetDocument( valNode, 0 );

               if (navDocNode && navDocNode.hasAttribute('docId')) {
                  validationObj.preferred = true;
                  oValidator.preferred = true;
                  var docId = Number(navDocNode.getAttribute('docId'));
                  validationObj.docId = docId;
                  validationObj.valNode = valNode;
                  if (gDC.logger.debugprocess) {
                     gDC.logger.logDebug('processValidations searching for keyword in document ' + docId);
                  }
                  gDC._observerService.notifyDocument(docId, 'dejaclick:keywordsearch', oValidator );
                  validationObj.validationsLeft = [docId];
                  if ( actionType == 2 && ! validationObj.maxWaitingTime ) {
                     validationObj.maxWaitingTime = (new Date()).getTime() + gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode);
                     gDC.logger.logInfo("Keyword - Continue waiting - maxWaitingTime: "+validationObj.maxWaitingTime +"[DC_OPTID_EVENTTIMEOUT="+gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode)+"]");
                  }
                  //UXM-11522 - We change the timeout to be a third of the usual value when we have multiple the
                  //Selected document option, as, sometimes the selected document is not ready yet
                  //and we need to retry.
                  var timeout = gDC.getEventIntPref('DC_OPTID_DOCKEYWORDVALTIMEOUT', gDC.actEventNode);
                  var retriesTimeout = timeout/3;
                  gDC.restartValidationTimeout(gDC.onKeywordValidationTimeout.
                     bind(gDC, oValidator.id, oValidator.strMatchText, oValidator.scriptVarInfo, actionType),
                     retriesTimeout);
                  
               }
               else {
                  if (gDC.logger.debugprocess) {
                     gDC.logger.logDebug('processValidations no document for keyword');
                  }
                  gDC.keywordSearchComplete(oValidator);
               }
            }
            else {
               if (gDC.logger.debugprocess) {
                  gDC.logger.logDebug('processValidations searching for keyword in all documents');
               }
               validationObj.validationsLeft = gDC._observerService.notifyObservers('dejaclick:keywordsearch', oValidator );
               if ( actionType == 2 && ! validationObj.maxWaitingTime ) {
                  validationObj.maxWaitingTime = (new Date()).getTime() + gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode);
                  gDC.logger.logInfo("Keyword - Continue waiting - maxWaitingTime: "+validationObj.maxWaitingTime +"[DC_OPTID_EVENTTIMEOUT="+gDC.getEventIntPref('DC_OPTID_EVENTTIMEOUT', gDC.actEventNode)+"]");
               }
               //UXM-11583 - We change the timeout to be the half of the usual value, as sometimes
               //some pages have multiple redirections and the document where the keyword will appear
               //is not loaded yet. So we have to retry to find it.
               var timeout = gDC.getEventIntPref('DC_OPTID_SEARCHKEYWORDVALTIMEOUT', gDC.actEventNode);
               var retriesTimeout = timeout/2;
               gDC.restartValidationTimeout(gDC.onKeywordValidationTimeout.
                  bind(gDC, oValidator.id, oValidator.strMatchText, oValidator.scriptVarInfo, actionType),
                  retriesTimeout);
               
            }


            return true;

         } 
         else if (valType == gDC.VALIDATIONTYPE_JAVASCRIPT) {
            var jsText, tgtWindow;

            gDC.lastValidationId = validationId;
            
            // @todo : Implement script variables
            if (gDC._script.domTreeHasValidateParam(valNode, "varreference")) {
               gDC.logger.logInfo("Replay failure at process validations. Compute of Script var failed. Returning ST97.");
               gDC.handleReplayFailure( "dcFailure_populateScriptVar", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND );
               return true;
            }
            else {
                jsText = gDC._script.domTreeGetValidateParam(valNode, "jstext");
            }
            
            // @todo :fix this
            if (jsText.length < 1) 
               gDC.processValidations(aDomNode, gDC.VALIDATIONTYPE_JAVASCRIPT);   // invalid JavaScript, continue w/ the next "validation" node
            
            var validationObj = {
               seq : validatingSeqNum,
               eventNum : nodeSeq,
               nodeName : nodeName,
               args : jsText,
               validationsLeft : []
            };
            validationObj.preferred = false;
            gDC.activeValidations[validationId] = validationObj;
            
            // ...........................
            // process JAVASCRIPT validations
            // ...........................
            
            xpath = "child::targets/target";
            var targetNodes = gDC._search.processXPath( valNode, xpath );
            if (targetNodes.length) {
               // this validation has a specific navigation target,
               // so use the associated target data to search for
               // the best-match navigation document node.
               var navDocNode = gDC.findTargetDocument( valNode, 0 );
               if (navDocNode && navDocNode.hasAttribute('tabId') && navDocNode.hasAttribute('urldocument')) {
                  var tabId = Number(navDocNode.getAttribute('tabId'));
                  var urlDocument = navDocNode.getAttribute('urldocument');
                  if (gDC.logger.debugprocess) {
                     gDC.logger.logDebug('processValidations searching for javascript in tab ' + tabId);
                  }
                  
                  // Execute Javascript validation for the matching document.
                  var matchingDoc = "if (window.document.URL === \"" + urlDocument + "\"){\n";
                  var details = {};
                  details.code =  matchingDoc + jsText + "\n}\n";
                  details.allFrames = true;
                  chrome.tabs.executeScript(tabId, details, gDC.javascriptExecuteComplete.bind(gDC, validationId));
                  if (actionType != 2) {
                     gDC.restartValidationTimeout(gDC.onJavascriptValidationTimeout.
                        bind(gDC, validationId, jsText),
                        gDC.getEventIntPref('DC_OPTID_DOCJAVASCRIPTVALTIMEOUT',
                        gDC.actEventNode));
                  }

               }
               else {
                  if (gDC.logger.debugprocess) {
                     gDC.logger.logDebug('processValidations no document for javascript');
                  }
                  gDC.javascriptExecuteComplete(validationId, null);
               }            
            
            } else {
               // No document was selected. So process validation for the default document.
               
               if (gDC.logger.debugprocess) {
                  gDC.logger.logDebug('processValidations executing javascript in default document');
               }
               
               chrome.tabs.query({active : true, windowId : gDC.lastFocusedBrowserObj.windowId}, gDC.executeJavascript.bind(gDC, jsText, validationId));
               if (actionType != 2) {
                  gDC.restartValidationTimeout(gDC.onJavascriptValidationTimeout.
                     bind(gDC, validationId, jsText),
                     gDC.getEventIntPref('DC_OPTID_SEARCHJAVASCRIPTVALTIMEOUT',
                     gDC.actEventNode));
               }

            }
            return true;
         }       
         else {
               // .........................
               // process OTHER validations
               // .........................

         }
         return false;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"processValidations" );
         return null;
      }
   },

   // checks if the given criteria match a branching rule associated with the current event
   
   matchesBranchingRule : function( aConditionType, aValue )
   {
      try {
         if (gDC.actEventNode && gDC.getBranchingRule( gDC.actEventNode, aConditionType, aValue )) {
            return true;
         }

         return false;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"matchesBranchingRule" );
         return false;
      }
   },


   // returns the current branching rule that is pending or one that matches the given criteria
   getBranchingRule : function( aEventNode, aConditionType, aValue )
   {
      try {
         // if we don't already have a branching rule to apply to the event,
         // check for one now and save the result for later reference.
         if (!gDC.branchingRule) {
            gDC.branchingRule = gDC.findBranchingRule( aEventNode, aConditionType, aValue );

            // skip processing for the current event
            // as soon as we know we are going to branch off of it
            if (gDC.branchingRule) {
               var branchName    = gDC._script.domTreeGetBranchParam( gDC.branchingRule, "name" );
               var condition     = gDC._script.domTreeGetBranchParam( gDC.branchingRule, "condition" );
               var target        = gDC._script.domTreeGetBranchParam( gDC.branchingRule, "target" );

               if (gDC.logger.debugprocess) {
                  var branchParent = gDC.branchingRule.parentNode.parentNode;
                     gDC.logger.logDebug( "branching rule '" + branchName + "' of " +
                        branchParent.nodeName + " " + branchParent.getAttribute('seq') +
                        " was triggered by (trigger type=" + aConditionType + ", value=" + aValue + ")" +
                        "\n   (condition: '" + condition + "', target: '" + target + "')" );
               }

               gDC.handleBranchingRuleTriggered();
            }
         }

         return gDC.branchingRule;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"getBranchingRule" );
         return null;
      }
   },


   // checks if the given criteria match a branching rule associated with the given event
   findBranchingRule : function( aEventNode, aConditionType, aValue )
   {
      try {
         var foundRule = null;

         // look for branching rules at each level (first event, then action, then script)
         var nodesToCheck = [ aEventNode, aEventNode.parentNode, gDC.getScriptNode() ];
         for (var n=0; n < nodesToCheck.length; n++) {

            var branchRules = gDC._search.processXPath( nodesToCheck[n], "child::branches/branch" );
            for (var i=0; i < branchRules.length; i++) {
               var branchRule = branchRules[i];

               // for each branching rule found, check if the condition holds true
               var condition = gDC._script.domTreeGetBranchParam( branchRule, "condition" );
               if (gDC.meetsCondition( aConditionType, aValue, condition ) == true) {
                  foundRule = branchRule;
                  break;
               }
            }

            // break out of outer loop once found
            if (foundRule) break;
         }

         return foundRule;

      } catch (e) {
         gDC.logException( e, gDC.DCMODULE+"findBranchingRule" );
         return null;
      }
   },


   // returns true if the given value meets the condition,
   // otherwise returns false.
   meetsCondition : function( aConditionType, aValue, aCondition )
   {
      try {
         var result = false;

         var conditionParts = aCondition.split( constants.DC_DELIM_CONDITION );
         var conditionType = (conditionParts && conditionParts.length) ? Number(conditionParts[0]) : 0;
         var conditionValue = (conditionParts && conditionParts.length > 1) ? Number(conditionParts[1]) : 0;
         switch (conditionType) {
            case constants.CONDITIONTYPE_ALWAYS:
               result = true;
               break;
            case constants.CONDITIONTYPE_NEVER:
               result = false;
               break;
            case constants.CONDITIONTYPE_REPLAYSTATUS:
               result = ((aConditionType == conditionType) && (aValue == conditionValue));
               break;
            case constants.CONDITIONTYPE_REPLAYSTATUS_NOT:
               result = ((aConditionType == constants.CONDITIONTYPE_REPLAYSTATUS) && (aValue != conditionValue));
               break;
            default:
               break;
         }

         return result;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"meetsCondition" );
         return false;
      }
   },
   
   handleBranchingRuleTriggered : function()
   {
      try {
         if (!gDC._observerService) return;  // safety catch for timing issues

         if (gDC._serverOperation) {
            if (!gDC._observerService) return;  // safety catch for timing issues
//            gDC._setTimeout( function(){gDC._observerService.notifyObservers( gDC.resEventNode, "dejaclick:cancelnetwork", "branchtaken" );}, 100 );
         } else {
            // only force-stop all browser activity now when not
            // operating in server mode, else it will be handled
            gDC.stopBrowserActivity();
         }

         // clear these counters to permit the next event to be replayed
         gDC.fixupDomCount = 0;
         gDC.mutationsCount = 0;
         gDC.mutationsRecorded = 0;
         gDC.mutationsRequired = 0;
         gDC.pendingLocations = 0;

         // stop the event response timer if it is still waiting
         gDC.stopResponseTimeout();
         gDC.pendingEvent = null;

         // reset our network activity flags
         gDC.resetActivity();
         // increment the eventsBranched list
         gDC.eventsBranched.push( 'branchtaken' );

         if (gDC.replayTimeout == null) gDC.restartReplayTimeout(1000);

         gDC._setWaitType( constants.WAITTYPE_PROCESSING );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"handleBranchingRuleTriggered" );
         return;
      }
   },

   //------------------------------------------------
   // check and set any necessary replay hints for the last processed event
   setReplayHints : function ( aLastEvent, aHoverObj )
   {
      try {
         if (gDC.actEventNum === 0 || (gDC._runType == constants.RUNTYPE_RECORDAPPEND && gDC.recordedEvents === 0)) {
            // skip if no events recorded yet
            return;
         }

         if (gDC.actEventNum > 0 && !aHoverObj &&
             gDC._script.domTreeGetReplayHint(gDC.actEventNode, gDC.DC_THINKTIMEHINT)==null) {
            // Assign a user pause internal (thinktime) for this event.
            // Optionally cap off excess thinktime to the maximum allowed limit.
            // Note: by default, hover events are not assigned a think time value.
            var thinktime = gDC.getThinkTime();
            var maxthinktime = gDC.getSystemIntPref('DC_OPTID_MAXTHINKTIME');
            var finalthinktime = (thinktime < maxthinktime) ? thinktime : maxthinktime;
            gDC._script.domTreeAddReplayHint( gDC.actEventNode, gDC.DC_THINKTIMEHINT, finalthinktime );
            // reset the event timer
            gDC.eventStartTime = Date.now();
         }

         var eventType = gDC._script.domTreeGetAttribute(gDC.actEventNode, 'type');
         if (eventType === 'tabfocus') {
            gDC.pendingLocations = 0;
         }

         if (gDC.pendingLocations) {
            var locationsPending = gDC._script.domTreeGetReplayHint(gDC.actEventNode, gDC.DC_LOCATIONHINT);
            if (locationsPending == null) {

               // Assign the "wait for location change" attribute to the previous event.
               // This sends a hint to the replay engine to wait for a specified timeout
               // period while the browser automatically handles the location change event.
               gDC._script.domTreeAddReplayHint( gDC.actEventNode, gDC.DC_LOCATIONHINT, gDC.pendingLocations);
            }
            else {
               var totalLocations = gDC.pendingLocations + parseInt(locationsPending, 10);
               gDC._script.domTreeChangeReplayHint(gDC.actEventNode, gDC.DC_LOCATIONHINT, totalLocations);
            }
         }

         if (gDC.checkHasEventPref( 'DC_OPTID_USEKEYSTROKES', gDC.actEventNode ) &&
             gDC._script.domTreeHasReplayHint(gDC.actEventNode, gDC.DC_NETWORKHINT) && !gDC.skipSpeedAdjust) {
            // Putting this here is kindof a hack, but we need a solid place to put a
            // hook for a post-processing condition where the event requires keystroke
            // replay AND there was some network activity during keystroke input.  In
            // such a case, we increase the default sub-event dispatch delay so that
            // any find-as-you-type keystroke entries have time to pull their menu
            // data from the network as would happen in real-time with a real user.
            gDC.setEventIntPref( 'DC_OPTID_DISPATCHDELAY', 600, gDC.actEventNode );
         }

         // reset per-event variables
         gDC.pendingLocations = 0;
         //gDC.mutationsCount = 0;
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"setReplayHints" );
      }
   },

   //------------------------------------------------
   // Check for and optionally process previously recorded event replay hints.
   // A return value of false indicates that the caller (replayNextEvent)
   // should proceed with processing of the next event; a return value of
   // true tells replayNextEvent to terminate (until the next invocation).
   processReplayHints : function( aEventNode )
   {
      try {

         var eventType = aEventNode.getAttribute('type');

         // ---------------------------
         // NOTE: check the following 2 hints only after processing the first event...
         // ---------------------------
         if (gDC.replayedEvents > 0) {

            // check for the scripted content hint (only if not yet processed)
            if (gDC.scriptedHints==null) {
               gDC.scriptedHints='checked';
               if (gDC._script.domTreeGetReplayHint(aEventNode, gDC.DC_SCRIPTINGHINT)) {
                  // DC_SCRIPTINGHINT reminds us that when the event was originally
                  // recorded, the target of the event was a DOM element that had been
                  // inserted AFTER the main web page content was already loaded (as a
                  // result of web page scripting).  So now during replay, we need to
                  // give the web page javascript a bit of extra time to process that
                  // same dynamic content changes BEFORE we fire off the next event,
                  // which may depend on that content being fully rendered.  This is
                  // also related to the fact that the javascript engine itself is
                  // single-threaded, so processing must be shared both by Deja and
                  // any web page scripting.  That is, we must release the main UI
                  // thread briefly to let the web page scripting do its thing.
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
                  // Returning true terminates replayNextEvent early, freeing up the
                  // browser to perform the dynamic content changes for the web page.
//                  gDC.areWeThereYet();
                  return true;
               }
            }

            // check for the network-activity hint (only if not yet processed)
            if (gDC.networkHints==null) {
               gDC.networkHints='checked';
               if (gDC.getEventBoolPref('DC_OPTID_USENETWORKHINTS', aEventNode)) {
                  if (gDC._script.domTreeGetReplayHint(aEventNode, gDC.DC_NETWORKHINT)) {
                     // DC_NETWORKHINT reminds us that when the event was originally
                     // recorded, there was some kind of network activity occurring.
                     // Since we don't know if the activity happened just prior to
                     // the event (via web page scripting) or just after as a result
                     // of the event itself, we choose to play it safe and give the
                     // web page just a bit more time to do any needed processing.
                     gDC._setWaitType( constants.WAITTYPE_NETWORK );
                     // Returning true terminates replayNextEvent early, freeing up the
                     // browser to perform initial networking activity for the web page.
                     return true;
                  }
               }
            }
         }

         // ---------------------------
         // NOTE: all checks after this point should fall through to return false
         // ---------------------------

         // Set logging options for this event, if any, else default to
         // script-level settings or, when none, system level settings.
         var messageOptions = gDC.getEventStringPref('DC_OPTID_LOGMESSAGE', aEventNode);
         if (!messageOptions) {
            messageOptions = gDC._prefs.getDefault('DC_OPTID_LOGMESSAGE');
         }
         if (gDC.lastLogMessage != messageOptions) {  // only update if needed
            gDC.logger.setMessageOptions( messageOptions );
            gDC._observerService.notifyObservers("dejaclick:messageoptions", messageOptions );
            gDC.lastLogMessage = messageOptions;
         }
         var debugOptions = gDC.getEventStringPref('DC_OPTID_LOGDEBUG', aEventNode);
         if (!debugOptions) {
            debugOptions = gDC._prefs.getDefault('DC_OPTID_LOGDEBUG');
         }
         if (gDC.lastLogDebug != debugOptions) {  // only update if needed
            gDC.logger.setDebugOptions( debugOptions );
            gDC._observerService.notifyObservers ("dejaclick:debugoptions", debugOptions );
            gDC.lastLogDebug = debugOptions;
         }

         // @todo Set limit on script runtime (DC_OPTID_MAXSCRIPTRUN)

         if (gDC.getEventBoolPref('DC_OPTID_USEMUTATIONHINTS', aEventNode) 
               && ! eventType.startsWith('tab') ) {
            // This hint tells the replay engine to pay attention to any DOM mutation counts
            // that were originally recorded (or any minimum that was set in the properties)
            // by waiting for the DOM mutations to start after this event has been injected
            // but before the next event in the script is injected.  If DOM mutations do not
            // begin as expected, the Replay Advisor will be displayed asking how to proceed.
            // Each DOM insertion event triggers the onDOMInsert method.  Once the first
            // mutation begins (the total number of mutations doesn't actually matter unless
            // a minumum is set in the properties) and for every DOM mutation thereafter,
            // the onDOMInsert method will restart a mutations timeout clock.  Event replay
            // won't be restarted until this timeout interval has expired (after the last
            // DOM mutation event has occurred).  As mentioned, the user also has the option
            // of setting a "minimum mutations required" threshold, which may be used in
            // special circumstances where a mutations timeout setting is inappropriate or
            // when no mutations were originally recorded but now are needed for replay.
            // The "total number" of DOM mutations often changes during replay for dynamic
            // content which is why we only care when DOM mutations begin and when they end.
            if (!(gDC.mutationsRecorded > 0 || gDC.mutationsRequired > 0)) {
               // only initialize the mutation counter once per event...
               var recordedMutations = gDC._script.domTreeGetReplayHint(aEventNode, gDC.DC_MUTATIONHINT);
               if (recordedMutations) {
                  gDC.mutationsRecorded = Number(recordedMutations);
               }
               if (gDC.getEventBoolPref('DC_OPTID_USEMINMUTATIONS', aEventNode)) {
                  gDC.mutationsRequired = gDC.getEventIntPref('DC_OPTID_MINMUTATIONS', aEventNode);
               } else {
                  gDC.mutationsRequired = 0;
               }
               if (gDC.mutationsRecorded > 0 || gDC.mutationsRequired > 0) {
                  gDC._setWaitType( constants.WAITTYPE_MUTATIONS );
               }
            }

            if (gDC.mutationsRecorded > 0 || gDC.mutationsRequired > 0) {
               gDC._observerService.notifyObservers("dejaclick:mutationconfig", {recorded: gDC.mutationsRecorded, required : gDC.mutationsRequired} );
            }
         } else if ( gDC.getEventBoolPref('DC_OPTID_USEMUTATIONHINTS', aEventNode) 
            && eventType.startsWith('tab')  ) 
         {
            //UXM-12071 - Ignoring mutation hints for tab events.
            gDC.logger.logInfo("processReplayHints - Ignoring 'Mutation Hints' because we are replaying a tab event ("+eventType+").");
         }
/*
         if (gDC.getEventBoolPref('DC_OPTID_USENETWORKHINTS', aEventNode)) {
            if (gDC._script.domTreeGetReplayHint(aEventNode, gDC.DC_NETWORKHINT)) {
               // Any observed network hints (non-fullpage) will briefly stop replay
               // until some network event kicks the replay loop back into action.
               // Replay Advisor will prompt the user if the expected network
               // activity has not occurred by the specified timeout interval.
               gDC._setWaitType( constants.WAITTYPE_NETWORK );  // override any previous
               gDC.stopReplayTimeout();  // onStateChange will restart replay loop
            }
         }
*/

         // Initialize the fullpageObjects flag to indicate if replay should wait
         // for the entire page to load before injecting the next event. Otherwise,
         // injection will occur once the base document contents have been loaded.
         gDC.fullpageObjects = gDC.getEventBoolPref('DC_OPTID_FULLPAGEOBJECTS', aEventNode);
         /** @todo Define assertMinimumVersion
         if (!gDC.fullpageObjects) {
            if (!gDC.assertMinimumVersion("1.0.7.0")) {
               // Note: Prior to version 1.0.7.0, there was a bug that caused the FULLPAGEOBJECTS option
               // (which is associated with the 'Wait for all page objects to load' GUI property) to not
               // work correctly, thus it always loaded all page objects anyway.  In versions 1.0.7.0 or
               // greater the issue was fixed.  However, because the Replay Advisor for onNetworkTimeout
               // previously had a repair feature that automatically disabed the FULLPAGEOBJECTS option
               // when skipping to the next event, the newly-fixed FULLPAGEOBJECTS option may now cause
               // early event injection on pages where network activity is started and stopped several
               // times for the same event.  Thus, we ignore any disabled setting for FULLPAGEOBJECTS
               // for any scripts created (or modified) with deja versions prior to 1.0.7.0 since the
               // newer versions will not automatically disable this setting.
               gDC.fullpageObjects = true;
               gDC.logger.logWarning( "script version does not support disabling FULLPAGEOBJECTS option, ignoring" );
            }
         }
         */

         if (gDC.getEventBoolPref('DC_OPTID_USELOCATIONHINTS', aEventNode) && 
               ! eventType.startsWith('tab') ) {
            var recordedLocations = gDC._script.domTreeGetReplayHint(aEventNode, gDC.DC_LOCATIONHINT);
            
            //Only set pending locations if the total location change count on the script is greater than the total amount that occured
            if (recordedLocations && gDC.validLocationChange()) {
               // Initialize pendingLocations counter with the original number of recorded
               // locations.  For this hint, onLocationChange increments the pendingLocations
               // counter on Record, and decrements the pendingLocations counter on Replay
               // until there are none left to process.  A timeout will occur with optional
               // user prompting for any pending locations not processed.
               gDC.pendingLocations = Number(recordedLocations);
               gDC._setWaitType( constants.WAITTYPE_LOCATIONS );  // override any previous
               // UXM-4451, Reset mutation hints and network hints on location changes
               gDC.mutationsRecorded = 0;
               gDC.mutationsRequired = 0;
               gDC.fullpageObjects = false;


               gDC.stopReplayTimeout();  // onLocationChange will restart replay loop
            }
         } else if ( gDC.getEventBoolPref('DC_OPTID_USELOCATIONHINTS', aEventNode) 
            && eventType.startsWith('tab')  ) 
         {
            //UXM-12071 - Ignoring mutation hints for tab events.
            gDC.logger.logInfo("processReplayHints - Ignoring 'Location Hints' because we are replaying a tab event ("+eventType+").");
         }

         // Thinktime hints, if recorded and enabled, get processed after dispatching the event
         if (gDC.thinktimeStop === 0 && gDC.getEventBoolPref('DC_OPTID_USETHINKTIMEHINTS', aEventNode)) {
            var thinktime = gDC._script.domTreeGetReplayHint(aEventNode, gDC.DC_THINKTIMEHINT);
            if (thinktime) {
               // For this hint, we pause the same number of milliseconds that
               // the user originally paused after the last network stop event.
               gDC.thinktimeStop = Date.now() + parseInt(thinktime, 10);
            }
         }

         var xpath = "child::dynamicobjs/dynamicobj";
         var targetNodes = gDC._search.processXPath( aEventNode, xpath );
         if (targetNodes.length > 0) {
            gDC.dynamicObjs = true;
         }

         return false;  // continue processing the next event

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"processReplayHints" );
         return null;
      }
   },

   validLocationChange : function(){
      //Get all the location change steps from the script 
      let locationChangeSteps = Array.prototype.slice.call(gDC.actEventNodes).filter((step)=>{
         if(gDC._script.domTreeGetReplayHint(step, gDC.DC_LOCATIONHINT) !== null){
            return step;
         }
      });

      //Compare the total amount of location steps against the the total amount of locations that occured
      return locationChangeSteps.length > locationChanges.length;
   },


   checkAutoPauseMode: function( aPauseMode )
   {
      /**
       * currentNode is really a DOM element which may have a boolean
       * breakpoint property.
       * @type {!{breakpoint:boolean}}
       */
      var currentNode = (aPauseMode == constants.DC_AUTOPAUSE_EVENT) ? gDC.actEventNode : gDC.actActionNode;

      // if auto-pause mode is active or a breakpoint was set on the current node, switch to paused mode now
      if ((gDC.getSystemIntPref('DC_OPTID_AUTOREPLAYPAUSE') == aPauseMode) || currentNode.breakpoint) {
         gDC.lastPausedNode = currentNode;         
         if (currentNode.breakpoint && currentNode.breakpointType == constants.BREAKPOINT_RECORD_INSERT) {
            gDC.setSystemBoolPref('DC_OPTID_APPENDMODE', DejaClick.constants.DC_RECORDMODE_INSERT);
         }
         else {
            gDC.setSystemBoolPref('DC_OPTID_APPENDMODE', DejaClick.constants.DC_RECORDMODE_OVERWRITE);
         }
         gDC.setRunMode(constants.RUNMODE_PAUSED);
         gDC.lastPausedEvent = gDC.replayedEvents;
         return true;
      }
      return false;
   },


   //------------------------------------------------
   getThinkTime : function()
   {
      // Note: Use network stop time value as thinktime start if available, else use event starttime.
      // (we don't want network delay being part of thinktime, but there may not always be net activity)
      var thinkStartTime = (gDC.networkStopTime) ? gDC.networkStopTime : gDC.eventStartTime;
      var thinkStopTime  = Date.now();
      gDC.networkStopTime = 0;  // reset any previous load time
      return thinkStartTime?(thinkStopTime - thinkStartTime):0;
   },

   getElementPathValue : function( nodeAElementPath )
   {
      var strReturn = null;
      if (!nodeAElementPath.hasAttribute("varreference")) {
         strReturn = nodeAElementPath.textContent;
         if (strReturn == null) {
            gDC.logger.logInfo("Replay failure at getElementPathValue. Returning ST97.");
            gDC.handleReplayFailure( "dcFailure_targetnotfound", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
         }
      }
      return strReturn;
   },

   convertCrumbsToArray : function(aCrumbs)
   {
      var crumbArray = {};
      crumbArray.crumb = [];
      for (var i = 0; i < aCrumbs.length; i++) {
         var attributes = aCrumbs[i].childNodes[0];
         var attribs = attributes.childNodes;
         var tag = aCrumbs[i].getAttribute("tag");
         var index = aCrumbs[i].getAttribute("index");
         var attrArray = [];
         for (var attrCount = 0; attrCount < attribs.length; attrCount++) {
            var attrName = attribs[attrCount].getAttribute("name");
            var attrText = attribs[attrCount].textContent;
            attrArray.push({"@name" : attrName, "#text" : attrText});
         }
         crumbArray.crumb.push ({"tag" : tag, "index" : index, "attributes" : attrArray});

      }
      return crumbArray;
   },

   updateTreeViews : function( aHashkey, aRefresh )
   {
      try {
         gDC._observerService.notifyLocalObservers("dejaclick:updatetreeview", {hashkey: aHashkey} );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"updateTreeViews" );
      }
   },

   addTreeViewNode : function( aNode, aSubscriptNum, aUpdateViews )
   {
      try {
         // FORNOW just returns the node's hashkey
         return gDC.getHashkey( aNode, aSubscriptNum );

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"addTreeViewNode" );
      }
   },

   getHashkey : function( aNode, aSubscriptNum )
   {
      var nodeType, seq, subNum, subhash;
      var NODENAME_SCRIPT     = 'script';
      var NODENAME_SUBSCRIPT  = 'subscript';
      var ATTRNAME_SEQ        = 'seq';

      function getHashkey() {
         return seq + ":" + nodeType +
            (subhash && nodeType != NODENAME_SUBSCRIPT ? ":" + subhash : "");
      }

      function getSubscriptHashkey() {
         return (subNum > 0) ? subNum + ":" + NODENAME_SUBSCRIPT : "";
      }

      try {
         nodeType = (aNode) ? aNode.nodeName : null;
         seq = (!aNode || nodeType == NODENAME_SCRIPT) ? 1 : aNode.getAttribute( ATTRNAME_SEQ );
         subNum = Number(aSubscriptNum) || 0;
         subhash = getSubscriptHashkey();

         return getHashkey();
      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"getHashkey" );
      }
   },

   // update state on the entire TreeView
   updateTreeViewState : function( aState, aFromState )
   {
      try {
         gDC._observerService.notifyLocalObservers("dejaclick:updatetreeviewstate",
               {state: aState, fromState: aFromState} );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"updateTreeViewState" );
      }
   },

   // update the state of a TreeView data node
   updateTreeViewNodeState : function( aNode, aSubscriptNum, aState, aFromState, aUpdateViews, aEnsureVisible )
   {
      try {
         var hashkey = gDC.getHashkey(aNode, aSubscriptNum);

         gDC._observerService.notifyLocalObservers("dejaclick:updatetreeviewnodestate",
               {hashkey: hashkey, state: aState, fromState: aFromState, ensureVisible: aEnsureVisible } );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"updateTreeViewNodeState" );
      }
   },

   // update the label of an individual TreeView data node
   // represented by the specified script DOM node (aNode)
   updateTreeViewNodeLabel : function( aNode, aSubscriptNum, aLabel )
   {
      try {
         var hashkey = gDC.getHashkey(aNode, aSubscriptNum);
         gDC._observerService.notifyLocalObservers("dejaclick:updatetreeviewnodelabel",
               {hashkey: hashkey, label: aLabel} );
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"updateTreeViewNodeLabel" );
      }
   },

   currentActionNode: function()  { return gDC.actActionNode; },
   currentEventNode: function()   { return gDC.actEventNode; },
   currentActionHashkey: function()  { return (gDC.actActionNum) ? gDC.actActionNum + ":action" + (gDC.subscriptNum ? ":" + gDC.subscriptNum + ":subscript" : "") : ""; },
   currentEventHashkey: function()   { return (gDC.actEventNum) ? gDC.actEventNum + ":event" + (gDC.subscriptNum ? ":" + gDC.subscriptNum + ":subscript" : "") : ""; },

   getScriptNode : function()
   {
      return gDC._domTreeRoot;
   },


   encounteredUrls: function() { return gDC._encounteredUrls; },
   encounteredMimes: function() { return gDC._encounteredMimes; },
  


   // -----------------------------------
   // -----------------------------------
   // -----------------------------------
   // End generic domTree tree primitives
   // -----------------------------------
   // -----------------------------------


   // --------------------------------------------
   // --------------------------------------------
   // Begin customized domTree insertion functions
   // --------------------------------------------
   // --------------------------------------------
   // insert a new DOM tree Action node
   domTreeInsertAction : function (aNode, aType)
   {
      try {
         if (gDC._runType == constants.RUNTYPE_RECORDAPPEND &&
             gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_INSERT) {
            var actionNode = gDC._script.domTreeInsertBefore(aNode, "action", gDC.actActionNum, null, gDC.subscriptNum);

            if (gDC.actActionNode && gDC.lastAppendEvent) {
               var eventToDelete = gDC.lastAppendEvent; 
               var nodesToDelete = [];
               // and by discarding all events that come after the last appended event.
               var eventNodes = gDC.actActionNode.getElementsByTagName('event');
               for (var i=0; i < eventNodes.length; i++) {
                  if (Number(eventNodes[i].getAttribute('seq')) > eventToDelete) {
                     nodesToDelete.push(eventNodes[i]);
                  }
               }

               if (nodesToDelete.length) {
                  gDC.alertUser( "dcMessage_deleteWarning", true, false);
               }            

               var deleteNode;
               for (deleteNode in nodesToDelete) {
                  if (nodesToDelete.hasOwnProperty(deleteNode)) {
                     gDC._script.domTreeRemoveNode(nodesToDelete[deleteNode]);
                  }
               }
          
              gDC.lastAppendEvent = 0;
            }
         }
         else {
            var actionNode = gDC._script.domTreeInsertNode(aNode, "action", null, false);
         }

         actionNode.setAttribute("type", aType);
         actionNode.setAttribute("seq", ++gDC.actActionNum);
         gDC.actActionNode = actionNode;

         gDC._script.domTreeAddAttribute(actionNode, 'actionname', '');
         gDC._script.domTreeAddAttribute(actionNode, 'description', '');

         gDC.actionEvents = 0;  // reset per-event action counter
         gDC._observerService.notifyObservers("dejaclick:resetactioninfo", null);

         if (gDC._runType == constants.RUNTYPE_RECORDAPPEND &&
             gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_INSERT) {
            gDC._script.renumberActions();
         }

         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug( "new DOM tree action node inserted ([" +
               (gDC.subscriptNum ? "subscript " + gDC.subscriptNum :
               "main script") + "] action " + gDC.actActionNum + ")" );
         }
         return actionNode;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertAction", "Error inserting DOM tree action node." );
         return null;
      }
   },


   // insert a new DOM tree Event node
   domTreeInsertEvent : function(aNode, aType)
   {
      try {
         if (gDC.eventStartTime === 0) {
            gDC.eventStartTime = Date.now();
         }
       
         if (gDC._runType == constants.RUNTYPE_RECORDAPPEND &&
             gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_INSERT) {
            var eventNode = gDC._script.domTreeInsertBefore(aNode, "event", gDC.actEventNum, null, gDC.subscriptNum);
            gDC.lastAppendEvent = gDC.actEventNum + 1;
         }
         else {
            var eventNode = gDC._script.domTreeInsertNode(aNode, "event", null, false);
         }
		 
         eventNode.setAttribute("type", aType);
         eventNode.setAttribute("seq", ++gDC.actEventNum);
         gDC.actEventNode = eventNode;
         
         // Insert the Authorization Dialog Information if it exists
         if (gDC.authUserCredentials) {
            gDC.onAddDialogParams (gDC.authUserCredentials);
            gDC.authUserCredentials = null;
         }
         
         gDC.recordedEvents++;
         gDC.actionEvents++;
       
         if (gDC._runType == constants.RUNTYPE_RECORDAPPEND &&
            gDC.getSystemIntPref('DC_OPTID_APPENDMODE') == constants.DC_RECORDMODE_INSERT) {
            gDC._script.renumberEvents();
         }

/*
         if (aType == "navigate") {
            gDC._observerService.notifyObservers("dejaclick:reseteventinfo", {eventsCaptured : gDC.eventsCaptured});
         }

         gDC.eventDialogs = 0;  // reset the event dialog counter
         gDC.skipSpeedAdjust = false;
*/
         if (gDC.logger.debugprocess) {
            gDC.logger.logDebug( "new DOM tree event node inserted ([" +
               (gDC.subscriptNum ? "subscript " + gDC.subscriptNum :
               "main script") + "] event " + gDC.actEventNum + ")" );
         }
         return eventNode;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertEvent", "Error inserting DOM tree event node." );
         return null;
      }
   },


   // Insert a new DOM tree targets section under the given DOM node (aNode)
   // for each target in aTargets.  The aTargets parameter should be an array
   // of objects, each containing both 'domNode' and 'searchType' attributes.
   // Current target search types include: document, element, and keyword.
   // Multiple target objects may be specified to allow serialized searching
   // (currently only used for 'element' search types).  Search information
   // (i.e., fingerprint, elementpath, breadcrumbs) is also inserted for each
   // target object, and is used to locate the associated target node is upon
   // replay.  Note, the search information added depends on the search type.
   domTreeInsertTargets : function(aNode, aTargets)
   {
      try {
         var eventTargetsNode = gDC._script.domTreeInsertNode(aNode, "targets", null, false);
         var targetNode, domNode, searchType;

         for (var i=0; i < aTargets.length; i++) {
            domNode = aTargets[i].domNode;
            searchType = aTargets[i].searchType;

            // insert a new target subsection under our new 'targets' node
            targetNode = gDC._script.domTreeInsertNode(eventTargetsNode, "target", null, false);
            targetNode.setAttribute("type", searchType);

            // insert a fingerprint for this target
            var fingerprint = gDC._search.createFingerprint( domNode );
            if (fingerprint && fingerprint!="1") {
               gDC._script.domTreeInsertNode(targetNode, "fingerprint", fingerprint, true);
               if (gDC.logger.debugprocess) { gDC.logger.logDebug( "fingerprint for event target inserted" ); }
            } else {
               gDC.logger.logWarning( "Unable to generate fingerprint for event target: " + domNode.nodeName );
               return false;
            }

            if (searchType == 'element') {
               // insert optimized element xpath for this target ('element' search types only)
               var elementpath = gDC._search.getXPath( domNode, true);
               if (elementpath) {
                  gDC._script.domTreeInsertNode(targetNode, "elementpath", elementpath, true);
                  if (gDC.logger.debugprocess) { gDC.logger.logDebug( "elementpath for event target inserted" ); }
               }
            
               // insert element full xpath for this target ('element' search types only)
               var elementfullxpath = gDC._search.getXPath( domNode, false );
               if (elementfullxpath) {
                  gDC._script.domTreeInsertNode(targetNode, "elementfullxpath", elementfullxpath, true);
                  if (gDC.logger.debugprocess) { gDC.logger.logDebug( "elementfullxpath for event target inserted" ); }
               }
            }

            // insert a breadcrumbs trail for this target
            var breadcrumbs = gDC._search.leaveBreadcrumbs( domNode );
            if (breadcrumbs && breadcrumbs.length) {
               gDC.domTreeInsertBreadcrumbs( targetNode, breadcrumbs );
               if (gDC.logger.debugprocess) { gDC.logger.logDebug( "breadcrumbs for event target inserted" ); }
            } else {
               gDC.logger.logWarning( "Unable to generate breadcrumbs for event target: " + domNode.nodeName );
               return false;
            }
         }
         return true;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertTargets" );
         return false;
      }
   },


   // insert a new DOM tree breadcrumbs target section
   domTreeInsertBreadcrumbs : function( aNode, aBreadcrumbs )
   {
      try {
         // insert the breadcrumb subtree nodes
         var breadcrumbsNode = gDC._script.domTreeInsertNode(aNode, "breadcrumbs", null, false);
         var crumbNode, attributesNode, attribNode;
         for (var n=0, crumb=null; aBreadcrumbs && n < aBreadcrumbs.length; n++) {
            crumb = aBreadcrumbs[n];
            crumbNode = gDC._script.domTreeInsertNode(breadcrumbsNode, "crumb", null, false);
            crumbNode.setAttribute("tag", crumb.tag);
            crumbNode.setAttribute("index", crumb.index);
            for (var attrib in crumb.attribs) {
               if (crumb.attribs.hasOwnProperty(attrib)) {
                  gDC._script.domTreeAddAttribute(crumbNode, attrib, crumb.attribs[attrib]);
               }
            }
         }
         return;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertBreadcrumbs", "Error inserting breadcrumbs event target." );
      }
   },


   // insert a new DOM tree Dialog node
   domTreeInsertDialog : function( aNode, aType )
   {
      try {
         var dialogsRootNode;
         var nodeList = aNode.getElementsByTagName("dialogs");
         if (nodeList.length) {
            // use the existing dialogs root node...
            dialogsRootNode = nodeList[0];
         } else {
            // create a dialogs root structure...
            dialogsRootNode = gDC._script.domTreeInsertNode(aNode, "dialogs", null, false);
         }

         var dialogNode = gDC._script.domTreeInsertNode(dialogsRootNode, "dialog", null, false);
           dialogNode.setAttribute("type", aType);
           dialogNode.setAttribute("seq", ++gDC.actDialogNum); // bump the script dialog counter
           dialogNode.setAttribute("ordinal", ++gDC.eventDialogs); // bump the event dialog counter

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "new DOM tree dialog node inserted (" + gDC.actDialogNum + ")" ); }
         return dialogNode;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertDialog", "Error inserting DOM tree dialog node." );
         return null;
      }
   },


   // insert a new DOM navigation subtree element
   domTreeInsertNavElement : function( aNode, aName, aType, aSeq )
   {
      try {
         var newNode = gDC._script.domTreeInsertNode(aNode, aName, null, false);
         newNode.setAttribute("type", aType);
         newNode.setAttribute("seq", aSeq);

         // always attach the subscript num to navigation nodes,
         // even for the main script where gDC.subscriptNum = 0
         newNode.setAttribute('subscript', gDC.subscriptNum);
         newNode.setAttribute('action', (gDC.actActionNum) ? gDC.actActionNum : 1);
         newNode.setAttribute('event', (gDC.actEventNum) ? gDC.actEventNum : 1);

         newNode.setAttribute('naveventseq', (gDC.navEventNum) ? gDC.navEventNum : 1);

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "new DOM tree navigation element inserted (" + aName + ")" ); }
         return newNode;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertNavElement", "Error inserting DOM navigation tree element (" + aName + ")" );
         return null;
      }
   },


   // insert a new DOM results tree element
   domTreeInsertResElement : function( aNode, aName, aType, aSeq )
   {
      try {
         var newNode = gDC._script.domTreeInsertNode(aNode, aName, null, false);
         newNode.setAttribute("type", aType);
         newNode.setAttribute("seq", aSeq);

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "new DOM tree results element inserted (" + aName + ")" ); }
         return newNode;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertResElement", "Error inserting DOM results tree element (" + aName + ")" );
         return null;
      }
   },


   domTreeInsertSubscript : function( aNode )
   {
      try {
         var subscriptsRootNode;
         var nodeList = aNode.getElementsByTagName("subscripts");
         if (nodeList.length) {
            // use the existing subscripts root node...
            subscriptsRootNode = nodeList[0];
         } else {
            // create a subscripts root structure...
            subscriptsRootNode = gDC._script.domTreeInsertNode(aNode, "subscripts", null, false);
         }

         var subscriptNode = gDC._script.domTreeInsertNode(subscriptsRootNode, "subscript", null, false);
         gDC.subscriptNum = gDC._actTreeRoots.length;
         subscriptNode.setAttribute("seq", gDC.subscriptNum);
         gDC.subscriptNode = subscriptNode;

         // update current action tree root
         gDC.actTreeRoot = gDC._script.domTreeCreateRoot( subscriptNode, "actions", "record" );
         gDC.actEventNodes = [];

         // reset replay/record vars and refs to the new subscript
         gDC.actEventNum = gDC.actActionNum = 0;
         gDC.actEventNode = gDC.actActionNode = null;
         gDC.actionEvents = 0;

         if (gDC.logger.debugprocess) { gDC.logger.logDebug( "new DOM tree subscript node inserted (" + gDC.subscriptNum + ")" ); }
         return subscriptNode;

      } catch ( e ) {
         gDC.logException( e, gDC.DCMODULE+"domTreeInsertSubscript", "Error inserting DOM tree subscript node." );
         return null;
      }
   },
   
   getVariableInfo : function (aVarName) {

      var strVarValue = null; // the values of the var from the DOM tree
      var nStickyValue = -1;
      var strVarText;
      // Get the variable from the DOM tree
      var nodeList = gDC._search.processXPath (gDC._domTreeRoot, "child::variables/variable[@type='1']/varparams/param[@name='varname' and text() ='" + aVarName + "']");
      if (nodeList.length && nodeList[0].parentNode) {
         // We found a variable w/ that name in the DOM tree,
         // so lets see if we have already a (text)value for it
         var bKnownVar = gDC._variables[aVarName] != null;
         if (bKnownVar && gDC._variables[aVarName].length) {
         
            // Yes, so use this -sticky- (text)value instead to calculate it once again
            strVarText = gDC._variables[aVarName];
            if (gDC.logger.debugprocess) {
               gDC.logger.logDebug("variable substitution: using " + aVarName + " (" + strVarText + ")");
            }
            return {varText : strVarText, sticky : 1, varName : aVarName, varValue : null};
         }
         else {
            var nodeParent = nodeList[0].parentNode;
            nodeList = gDC._search.processXPath(nodeParent, "child::param[@name='vartext']/text()");
            if (nodeList.length) {

               // We got a non empty value...
               strVarValue = nodeList[0].data;
               // ...so check addl. (if we didn't do that before) if this is a sticky var
               if (!bKnownVar) {
                  nodeList = gDC._search.processXPath(nodeParent, "child::param[@name='sticky']/text()");
                  nStickyValue = nodeList.length && nodeList[0].data == "true" ? 1 : 0;
               }
            }
         }
      }
         
      if (!strVarValue || !strVarValue.length) {
         throw new Error("Error getting script variable (" + aVarName + ") data");
      }
      return {varText : strVarText, sticky : nStickyValue, varName : aVarName, varValue : strVarValue}; 
   },
   
   /**
    * Get the information on the script variable(if any) for the specified elementpath node
    * @this {!DejaClick.DejaService}
    * @param {!Element} nodeAElementPath Elementpath Node in the dom tree
    * @return {Object.<string, number, string, string>} 
    */
   retrieveElementpathVariableInfo : function( nodeAElementPath)
   {
      var varName = null;
      var strVarText = null;  // the computed text of the var
      if (nodeAElementPath.hasAttribute("varreference") && nodeAElementPath.getAttribute("varreference")) {
         varName = nodeAElementPath.textContent;
         if (!varName || !varName.length) {
            throw new Error("Empty script variable name");
         }
      }
      return gDC.getVariableInfo(varName);      
   },
   
   /**
    * Get the information of the script variable(if any) for the specified event node
    * @this {!DejaClick.DejaService}
    * @param {!Element} nodeAEvent Event Node in the dom tree
    * @return {Object.<string, number, string, string>} 
    */
   retrieveEventVariableInfo : function( nodeAEvent)
   {
      var varName = null;
      if (gDC._script.domTreeHasEventParam(nodeAEvent, "varreference")) {
         varName = gDC._script.domTreeGetEventParam(nodeAEvent, "varreference");
         if (!varName || !varName.length) {
            throw new Error("Empty script variable name");
         }
         return gDC.getVariableInfo(varName);     
      }
      return {varText : null, sticky : 0, varName : null, varValue : null };
   },

   /**
    * Get the information of the MFA configuration (if any) for the specified event node
    * 
    * UXM-11786
    * 
    * @this {!DejaClick.DejaService}
    * @param {!Element} nodeAEvent Event Node in the dom tree
    * @return {Object.<string, number, string, string>} 
    */
   retrieveEventMfaInfo : function( nodeAEvent )
   {
      let result = null;
      if (gDC._script.domTreeHasEventParam(nodeAEvent, "mfareference")) {
         var mfaType = gDC._script.domTreeGetEventParam(nodeAEvent, "mfareference");
         if (!mfaType || !mfaType.length) {
            throw new Error("Empty MFA reference name");
         }
         //TODO Implement support for more MFA options
         switch (mfaType) {
            case 'securityquestions':
               if ( gDC._mfaInfo && gDC._mfaInfo.securityquestions && gDC._mfaInfo.securityquestions.length > 0 ) {
                  result = {
                     type: 'securityquestions',
                     value: gDC._mfaInfo.securityquestions
                  };
               } else {
                  gDC.logger.logFailure("MFA Security questions not defined!!");
                  throw new Error("MFA Security questions not defined!!");
               }
               break;
            default:
               gDC.logger.logWarning("Invalid MFA reference for change event [mfareference="+mfaType+"]");
               break;
         }
      }
      return result;
   },

   /**
    * Get the event parameter value for the specified event node.
    *   If the node has a script variable, the value is the computed value
    *    of the variable, If not, it is the value in the dom tree.
    * @this {!DejaClick.DejaService}
    * @param {!Element} nodeAEvent Event Node in the dom tree
    * @param {string} strAParamName Event Parameter name
    * @return {string} 
    */   
   retrieveEventParamValue : function( nodeAEvent, strAParamName, aCallback )
   {
      var strReturn = null;
      var varInfo = gDC.retrieveEventVariableInfo(nodeAEvent);
      if (varInfo.varName ) {
         if (!varInfo.varText) {
            gDC._variable.computeScriptVariableAsync(varInfo.varName, varInfo.varValue, gDC.processScriptVariableResult.bind(gDC, varInfo, aCallback));
            return;
         }
         else {
            strReturn = varInfo.varText;
         }
      }
      else {
         strReturn = gDC._script.domTreeGetEventParam(nodeAEvent, strAParamName);
         if (strReturn == null) {
            gDC.logger.logInfo("Replay failure at retrieveEventParamValue. Returning ST97.");
            gDC.handleReplayFailure( "dcFailure_targetnotfound", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
         }
      }
      aCallback(strReturn, null);
   },

   /**
    * UXM-11607
    * 
    * Intermediate function to recieve the result of calculating the script
    * variable result in a tab.
    * 
    * This function was included to be sure that the sticky value is always stored,
    * no matter if the script variable is used for a change, keyword or navigation event.
    * 
    * TODO - We could need to check if this should be used by Keyword validations too.
    * 
    * @param {*} varInfo 
    * @param {*} aCallback 
    * @param {*} aResponse 
    */
   processScriptVariableResult : function(varInfo, aCallback, aResponse ) {
      try {
         if ( aResponse && varInfo && varInfo.sticky ) {
            gDC.logger.logInfo("Stored sticky value for variable "+varInfo.varName+": "+aResponse);
            gDC._variables[varInfo.varName] = aResponse;
         } else {
            gDC.logger.logInfo("Received new value for variable "+varInfo.varName+": "+aResponse);
         }
         aCallback(aResponse);
      } catch( e ) {
         gDC.logException(e, gDC.DCMODULE + "processScriptVariableResult")
      }
   },

   /**
    * Add any http custom headers to all outgoing requests
    * @param aDetails - a container for the HTTP request headers.
    */
   addHeadersToHttpChannel: function (aDetails) {
      try {
         // for each header in the preloaded obj array, add its
         // headername and headertext to the http channel request
         var headerObj,
            doMerge,
            isMerged;

         for (var i = 0; i < gDC.customHeaders.length; i++) {
            headerObj = gDC.customHeaders[i];
            isMerged = false;

            if (headerObj.headerType === constants.HEADERTYPE_REQUEST) {
               doMerge = (headerObj.mergeType == constants.HEADER_MERGE);

               // ignore error if unable to set a request header for this channel
               try {
                  if (aDetails.requestHeaders.length && doMerge) {
                     for (var j = 0; j < aDetails.requestHeaders.length; j++) {
                        if (headerObj.headerName == aDetails.requestHeaders[j].name) {
                           aDetails.requestHeaders[j].value = [aDetails.requestHeaders[j].value, headerObj.headerText].join(',');
                           isMerged = true;
                           break;
                        }
                     }
                  }

                  if (!isMerged) {
                     aDetails.requestHeaders.push({
                        name: headerObj.headerName,
                        value: headerObj.headerText
                     });
                  }
               } catch (ex) {
               }
            }
         }
         return;

      } catch (e) {
         gDC.logException(e, gDC.DCMODULE + "addHeadersToHttpChannel");
      }
   },

   /*
    *  custom pref option wrappers
   */
   checkHasEventPref    : function( aOptionID, aEventNode ) { return gDC._prefs.hasPrefOption( aOptionID, gDC._script, aEventNode); },

   getSystemBoolPref    : function( aOptionID ) { return gDC._prefs.getPrefOption( aOptionID); },
   getSystemIntPref     : function( aOptionID ) { return gDC._prefs.getPrefOption( aOptionID); },
   getSystemStringPref  : function( aOptionID ) { return gDC._prefs.getPrefOption( aOptionID); },
   getScriptBoolPref    : function( aOptionID ) { return gDC._prefs.getPrefOption( aOptionID, gDC._script); },
   getScriptIntPref     : function( aOptionID ) { return gDC._prefs.getPrefOption( aOptionID, gDC._script); },
   getScriptStringPref  : function( aOptionID ) { return gDC._prefs.getPrefOption( aOptionID, gDC._script); },
   getEventBoolPref     : function( aOptionID, aEventNode ) { return gDC._prefs.getPrefOption( aOptionID,  gDC._script, aEventNode ); },
   getEventIntPref      : function( aOptionID, aEventNode ) { return gDC._prefs.getPrefOption( aOptionID,  gDC._script, aEventNode ); },
   getEventStringPref   : function( aOptionID, aEventNode ) { return gDC._prefs.getPrefOption( aOptionID,  gDC._script, aEventNode ); },

   resetSystemBoolPref   : function( aOptionID ) { return gDC._prefs.resetPrefOption( aOptionID); },
   resetSystemIntPref    : function( aOptionID ) { return gDC._prefs.resetPrefOption( aOptionID); },
   resetSystemStringPref : function( aOptionID ) { return gDC._prefs.resetPrefOption( aOptionID); },
   resetScriptBoolPref   : function( aOptionID ) { return gDC._prefs.resetPrefOption( aOptionID,  gDC._script); },
   resetScriptIntPref    : function( aOptionID ) { return gDC._prefs.resetPrefOption( aOptionID,  gDC._script); },
   resetScriptStringPref : function( aOptionID ) { return gDC._prefs.resetPrefOption( aOptionID,  gDC._script); },
   resetEventBoolPref    : function( aOptionID, aEventNode ) { return gDC._prefs.resetPrefOption( aOptionID,  gDC._script, aEventNode ); },
   resetEventIntPref     : function( aOptionID, aEventNode ) { return gDC._prefs.resetPrefOption( aOptionID,  gDC._script, aEventNode ); },
   resetEventStringPref  : function( aOptionID, aEventNode ) { return gDC._prefs.resetPrefOption( aOptionID,  gDC._script, aEventNode ); },

   setSystemBoolPref    : function( aOptionID, aOptionValue ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue); },
   setSystemIntPref     : function( aOptionID, aOptionValue ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue); },
   setSystemStringPref  : function( aOptionID, aOptionValue ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue); },
   setScriptBoolPref    : function( aOptionID, aOptionValue ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue,  gDC._script); },
   setScriptIntPref     : function( aOptionID, aOptionValue ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue,  gDC._script); },
   setScriptStringPref  : function( aOptionID, aOptionValue ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue,  gDC._script); },
   setEventBoolPref     : function( aOptionID, aOptionValue, aEventNode ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue,  gDC._script, aEventNode ); },
   setEventIntPref      : function( aOptionID, aOptionValue, aEventNode ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue,  gDC._script, aEventNode ); },
   setEventStringPref   : function( aOptionID, aOptionValue, aEventNode ) { return gDC._prefs.setPrefOption( aOptionID, aOptionValue,  gDC._script, aEventNode ); },

   // -------------------------------------------
   // -------------------------------------------
   // End  customized domTree insertion functions
   // -------------------------------------------
   // -------------------------------------------

   // ============================
   // timer utilities
   // ============================


   /**
    * @this {!DejaClick.DejaService}
    * @param {!function()} aCallback
    * @param {integer} aMsec
    * @param {boolean=} aPersistent
    */
   _setTimeout: function( aCallback, aMsec, aPersistent )
   {
      var nID = setTimeout (aCallback, aMsec);
      // Create a new timer...
      if (!aPersistent) {
         this._timers.push(
            {
               id: nID,
               startTimeMS: (new Date()).getTime(),
               endTimeMS: ((new Date()).getTime()+aMsec)
            }
          );
      }
      return (this._timers.length - 1);
   },

   _getTimeoutElapsedTime: function( aTimerID ) {
      if (aTimerID == null || isNaN(aTimerID) || !this._timers[aTimerID]) { 
         return -1; 
      }
      var timeout = this._timers[aTimerID];
      
      return (new Date()).getTime() - timeout.startTimeMS;
   },

   _getTimeoutRemainingTime: function( aTimerID ) {
      if (aTimerID == null || isNaN(aTimerID) || !this._timers[aTimerID]) { 
         return -1; 
      }
      var timeout = this._timers[aTimerID];
      
      return timeout.endTimeMS-(new Date()).getTime();
   },

   _clearTimeout: function( aTimerID )
   {
      if (aTimerID == null || isNaN(aTimerID) || !this._timers[aTimerID]) { return; }
      clearTimeout(this._timers[aTimerID].id);
      this._timers[aTimerID] = null;
   },

   _clearAll: function()
   {
      var id=null;
      // clear all in-use timer objects
      for (var i=0; i < this._timers.length; i++) {
         this._clearTimeout(i);
      }
      this._timers = [];  // XXX for now, we always wipe the array...
   },

   _setLocation : function (aValue)
   {
      try {
         gDC.replayLocation = aValue && aValue.length ? aValue : 0;
      }
      catch ( e ) {
         gDC.logException(e, gDC.DCMODULE + "_setLocation");
      }
   }
};

//////////////////////////////////////////////////
// end private scope
}());
//////////////////////////////////////////////////


