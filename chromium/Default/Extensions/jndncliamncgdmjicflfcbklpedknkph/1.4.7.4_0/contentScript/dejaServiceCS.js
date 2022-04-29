/*
* DejaClick for Chrome by SmartBear.
* Copyright (C) 2013 SmartBear.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

/*global DejaClick,DejaClickCs,window,document,HTMLInputElement,HTMLTextAreaElement,SVGDocument,XMLSerializer,setTimeout,clearTimeout */
'use strict';
//(function() {

var constants = DejaClick.constants;

/** @constructor */
DejaClick.DejaServiceCS = function (){
};

DejaClick.DejaServiceCS.prototype = {

   DOM_VK_C : 67,
   DOM_VK_V : 85,
   DOM_VK_TAB : 9,
   DOM_VK_RETURN  : 13,
   DOM_VK_ENTER   : 13,
   DOM_VK_SPACE   : 32,
   DOM_VK_LEFT    : 37,
   DOM_VK_UP      : 38,
   DOM_VK_RIGHT   : 39,
   DOM_VK_DOWN    : 40,
   DOM_VK_PAUSE   : 19,
   UNPRINTABLE_CHAR_RANGE : 47,

   DC_OPTID_USEMUTATIONHINTS : "usemutationhints",
   DC_OPTID_USEMATCHTYPES : "usematchtypes",
   DC_OPTID_USEKEYSTROKES : "usekeystrokes",
   DC_OPTVAL_MUTATIONDELAY : 100,

   DCMODULE : "DejaClick.DejaServiceCS.",
   
   IGNORE_TIMEDIFF : 300,

   BUTTON_CLICKED_ATTR : "dcclicked",
   
   DEJA_DIALOG_ID: "dejaclickJSDialog",
   DEJA_OVERRIDE_FUNC_ID: "dejaclickJSOverRideFunc",
   DEJA_SINGLE_PAGE_APP_ID: "dejaclickSinglePageAppDetect",

   TIMING_PROPERTIES: ['navigationStart', 'unloadEventStart', 'unloadEventEnd',
      'redirectStart', 'redirectEnd', 'fetchStart',
      'domainLookupStart', 'domainLookupEnd',
      'connectStart', 'connectEnd', 'secureConnectionStart',
      'requestStart', 'responseStart', 'responseEnd',
      'domLoading', 'domInteractive', 'domComplete',
      'domContentLoadedEventStart', 'domContentLoadedEventEnd',
      'loadEventStart', 'loadEventEnd'],

   RESOURCE_TIMING_PROPERTIES: ['name', 'startTime', 'duration',
      'redirectStart', 'redirectEnd', 'fetchStart',
      'domainLookupStart', 'domainLookupEnd',
      'connectStart', 'secureConnectionStart', 'connectEnd',
      'requestStart', 'responseStart', 'responseEnd'],

   init : function () {
      this._runMode = constants.RUNMODE_INACTIVE;
      this.pendingKeystrokes = false;
      this.bypassKeystrokes = false;
      this.keystrokeCount = 0;
      this.checkboxWasClicked = false;
      this.bufferedKeycodes = null;
      this.eventsEnabled = true;
      this.screenModeActive = false;
      this.recordFocusEvents = false;
      this.actEventNode = null;
      this.fixupThreshold = 0;
      this.mutationsRecorded = 0;
      this.mutationsRequired = 0;
      this.server = false;
      this.mutationsCount = 0;
      this.mutationsCountLast = 0;
      this.eventsCaptured = [] ;
      this.hoverEvents = [];
      this.hoverObjects = [];
      this.targetElements = {};
      this.docRoot = null;
      this.dispatchState = null;
      this.pendingEvent = null;
      this.lastScrollTarget = null;
      this.stickyValue = null; 
      this.varName = null;
      this.logger = DejaClickCs.logger;
      this.search = new DejaClick.Search(this.logger);
      this.observerService = DejaClickCs.observerService;
      this.stateListeners = null;
      this.inputListeners = null;
      this.contentListeners = null;
      this.onDOMInsertListeners = null;
      this.visibilityChangeListeners = null;
      this._timers = [];
      this.mutationsDelay = null;
      this.useMutationHints = false;
      this.submitWasClicked = false;
      this.pendingMousemove = false;
      this.pendingMousedrag = false;
      this.firstHoverTarget = null;
      this.lastHoverEvent = -1;
      this.activePage = true;
      this.submitObj = null;
      this.domLoadTimestamp = 0;
      this.attachStateListeners();
      this.observerService.notifyObservers("dejaclick:getrunmode", null);
   },

   halt : function () {
      this._runMode = constants.RUNMODE_INACTIVE;
      this.pendingKeystrokes = false;
      this.bypassKeystrokes = false;
      this.keystrokeCount = 0;
      this.checkboxWasClicked = false;
      this.bufferedKeycodes = null;
      this.eventsEnabled = true;
      this.actEventNode = null;
      this.eventsCaptured = null;
      this.hoverEvents = null;
      this.hoverObjects = null;
      this.targetElements = {};
      this.docRoot = null;
      this.dispatchState = null;
      this.pendingEvent = null;
      this.lastScrollTarget = null;
      this.submitObj = null;
      //this.removeStateListeners();
      this.teardownInputListeners();
      this.teardownContentListeners();
      this.teardownReplayListeners();
      this.teardownAsyncTimers();
   },

   isSinglePageApp : function () {
	  try {
             var loadDejaCheckSinglePageApp = function() {

                var SPA="none";
                //try {if (typeof(app)=="object") SPA = "unknown";}catch(ex){}

                if (window.hasOwnProperty('require')) {
                   if(window.require.hasOwnProperty('defined')){
                      if(window.require.defined('troopjs-compose/decorator')) SPA = "troop";
                      if(window.require.defined('flight/lib/component')) SPA = "flight";
                   }
                }
                try {if (typeof(window.Polymer)=="function") SPA = "polymer";}catch(ex){}
                try {if (typeof(window.React)=="object") SPA = "react";}catch(ex){}
                try {if (typeof(window.Vue)=="function") SPA = "vue";}catch(ex){}
                try {if (typeof(window.aureliaDatabase)=="object") SPA = "aurelia";}catch(ex){}
                try {if (typeof(window.angular)=="object") SPA = "angular";}catch(ex){}
                try {if (typeof(window.ko)=="object") SPA = "knockout";}catch(ex){}
                try {if (typeof(window.Backbone)=="object") SPA = "backbone";}catch(ex){}
                try {if (typeof(window.ko)=="object" && typeof(window.Backbone)=="object") SPA = "knockback";}catch(ex){}
                try {if (typeof(window.dojo)=="object") SPA = "dojo";}catch(ex){}
                try {if (typeof(window.can)=="object") SPA = "can";}catch(ex){}
                try {if (typeof(window.ampersand)=="object") SPA = "ampersand";}catch(ex){}

                if (window.hasOwnProperty('m')) {
                   if (window.m.hasOwnProperty('render')) {
                      if (typeof(window.m.render)=="function") SPA = "mithril";
                   }
                }

                if (SPA !== "none") {
                   var isSinglePage = document.createElement('div');
                   isSinglePage.id = 'dejaclick-is-singlepage';
                   document.documentElement.appendChild(isSinglePage);
	        }

	     }
	     window.addEventListener('load', loadDejaCheckSinglePageApp);
          }
	  catch (e) {
	  }
   },
   
   overRideFunc : function () {
      var orig_alert = window.alert;
      window.alert = function (args) {
         orig_alert(args);
         var dialogObj = {type: 3, action: 1, repeat: 1};
         var jsDialogElem = document.getElementById("dejaclickJSDialog");
         if (jsDialogElem) {
            var oldValue = JSON.parse(jsDialogElem.value);
            var newValue = oldValue;
            newValue[oldValue.length] = dialogObj;
            jsDialogElem.value = JSON.stringify(newValue);            
         }
         else {
            var dialogObjs = {};
            dialogObjs[0] = dialogObj;
            var newNode = document.createElement("input");
            newNode.value = JSON.stringify(dialogObjs);
            newNode.setAttribute("id", "dejaclickJSDialog");
            newNode.setAttribute("type", "hidden");
            document.documentElement.appendChild(newNode);
         }
         return;
      };

      var orig_prompt = window.prompt;
      window.prompt = function (args) {
         var ret = orig_prompt(args);
         var dialogObj = {type: 2, action: 1, repeat: 1, input1: ret};
         var jsDialogElem = document.getElementById("dejaclickJSDialog");
         if (jsDialogElem) {
            var oldValue = JSON.parse(jsDialogElem.value);
            var newValue = oldValue;
            newValue[oldValue.length] = dialogObj;
            jsDialogElem.value = JSON.stringify(newValue);  
         }
         else {
            var dialogObjs = {};
            dialogObjs[0] = dialogObj;
            var newNode = document.createElement("input");
            newNode.value = JSON.stringify(dialogObjs);
            newNode.setAttribute("id", "dejaclickJSDialog");
            newNode.setAttribute("type", "hidden");
         }
         document.documentElement.appendChild(newNode);
         return ret;
      };

      var orig_confirm = window.confirm;
      window.confirm = function (args) {
         var ret = orig_confirm(args);
         var jsDialogElem = document.getElementById("dejaclickJSDialog");
         var action;
         action = ret ? 1 : 2;
         var dialogObj = {type: 3, action: action, repeat: 1};
         if (jsDialogElem) {
            var oldValue = JSON.parse(jsDialogElem.value);
            var newValue = oldValue;
            newValue[oldValue.length] = dialogObj;
            jsDialogElem.value = JSON.stringify(newValue);  
         }
         else {
            var dialogObjs = {};
            dialogObjs[0] = dialogObj;
            var newNode = document.createElement("input");
            newNode.setAttribute("id", "dejaclickJSDialog");
            newNode.setAttribute("type", "hidden");
            newNode.value = JSON.stringify(dialogObjs);
            document.documentElement.appendChild(newNode);
         }
         return ret;
         
      };
   },

   begin : function () {
      try {

         this.mutationsCount = 0;
         this.mutationsRecorded = 0;
         this.mutationsRequired = 0;
         this.mutationsCount = 0;
         this.mutationsCountLast = 0;
         this.domLoadTimestamp = 0;

         this.attachContentListeners();
         this.attachInputListeners();
         if (this._runMode == constants.RUNMODE_RECORD) {
            this.eventsEnabled = true;
            this.actEventNode = {};
            // Check whether the rendered document is XML.
            if (!document.xmlVersion) {
               var script = document.createElement('script');
               script.id = "dejaclickJSOverRideFunc";
               script.appendChild(document.createTextNode('('+ this.overRideFunc +')();'));
               document.documentElement.appendChild(script);

               //var scr = document.createElement('script');
               //scr.id = "dejaclickSinglePageAppDetect";
               //scr.appendChild(document.createTextNode('('+ this.isSinglePageApp +')();'));
               //document.documentElement.appendChild(scr);
            }
         }
         else if (this._runMode == constants.RUNMODE_REPLAY) {
            this.targetElements = {};
            this.dispatchState = null;
            this.actEventNode = null;
            this.pendingEvent = null;
            this.stickyValue = null; 
            this.varName = null;
            this.lastScrollTarget = null;
            this.attachReplayListeners();
         }
      } catch (e) {
         this.reportException( e, this.DCMODULE+"begin" );
      }
   },

   attachStateListeners : function () {
      try {

         this.stateListeners = new DejaClick.EventRegistration().
         addDomListener(window, "DOMContentLoaded", true, this.onDOMContentLoaded, this).
         addDomListener(window, "load", true, this.onLoaded, this).
         addDomListener(window, "unload", true, this.onUnloaded, this).
         addDejaListener(this.observerService, 'dejaclick:markinactive', this.markInactive, this).
         addDejaListener(this.observerService, 'dejaclick:resetactioninfo', this.resetActionInfo, this).
         addDejaListener(this.observerService, 'dejaclick:reseteventinfo', this.resetEventInfo, this).
         addDejaListener(this.observerService, 'dejaclick:runmode', this.onRunMode, this).
         addDejaListener(this.observerService, 'dejaclick:servicehalted', this.onServiceHalted, this).
         addDejaListener(this.observerService, 'dejaclick:elementsearch', this.elementSearch, this).
         addDejaListener(this.observerService, 'dejaclick:dispatchevent', this.processEvents, this).
         addDejaListener(this.observerService, 'dejaclick:messageoptions', this.setMessageOptions, this).
         addDejaListener(this.observerService, 'dejaclick:debugoptions', this.setDebugOptions, this).
         addDejaListener(this.observerService, 'dejaclick:stopactivity', this.stopBrowserActivity, this);

      } catch (e) {
         this.reportException( e, this.DCMODULE+"attachStateListeners" );
      }
   },

   removeStateListeners : function () {
      try {
         if (this.stateListeners) {
            this.stateListeners.close();
            this.stateListeners = null;
         }

      } catch (e) {
         this.reportException( e, this.DCMODULE+"removeStateListeners" );
      }
   },

   //------------------------------------------------
   // attach "Input event" listeners to a specific browser DOM node
   attachInputListeners : function()
   {
      try {

         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            return;
         }

         // Do not attach listeners until the dom load is complete
         if (document.readyState == "loading") {
            return;
         }

         if (this.inputListeners) {
            return;
         }

         if (!this.activePage) {
            this.inputListeners = new DejaClick.EventRegistration();
            if (this._runMode === constants.RUNMODE_RECORD) {
               // Add handlers to alert users of events that will not
               // be recorded. Do not listen for mouseover or focus
               // events because these are too easy to generate.
               this.inputListeners.
                  addDomListener(document, 'keyup', true, this.reportInvalidEvent, this).
                  addDomListener(document, 'keypress', true, this.reportInvalidEvent, this).
                  addDomListener(document, 'keydown', true, this.reportInvalidEvent, this).
                  addDomListener(document, 'click', true, this.reportInvalidEvent, this).
                  addDomListener(document, 'change', true, this.reportInvalidEvent, this).
                  addDomListener(document, 'submit', true, this.reportInvalidEvent, this).
                  addDomListener(document, 'mousedown', true, this.reportInvalidEvent, this);
            }
            return;
         }

         this.inputListeners = new DejaClick.EventRegistration().
                  addDomListener(document, "keyup", true, this.onBrowserKeypress, this).
                  addDomListener(document, "keypress", true, this.onBrowserKeypress, this).
                  addDomListener(document, "keydown", true, this.onBrowserKeypress, this).
                  addDomListener(document, "click", true, this.onClick, this).
                  addDomListener(document, "change", true, this.onChange, this).
                  addDomListener(document, "submit", true, this.onSubmit, this).
                  addDomListener(document, "focus", true, this.onFocus, this).
                  addDomListener(document, "mouseover", true, this.onMouseOver, this);

         if (this._runMode === constants.RUNMODE_RECORD) {
            this.inputListeners.addDomListener(document, 'mousedown', true,
               this.onMouseDown, this);
         }

         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"attachInputListeners" );
      }
   },

   attachReplayListeners : function ()
   {
      try {
         if (this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            return;
         }

         if (this.replayListeners == null) {
           this.replayListeners = new DejaClick.EventRegistration().
              addDejaListener(this.observerService, 'dejaclick:applyStyle', this.applyStyleToTarget, this).
              addDejaListener(this.observerService, 'dejaclick:keywordsearch', this.keywordSearch, this).
              addDejaListener(this.observerService, 'dejaclick:mutationconfig', this.mutationConfig, this).
              addDejaListener(this.observerService, 'dejaclick:mutationstop', this.mutationStop, this);
         }
      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"attachReplayListeners" );
      }
   },

   teardownInputListeners : function ()
   {
      try {
         if (this.inputListeners) {
            this.inputListeners.close ();
            this.inputListeners = null;
         }
         if (this.onDOMInsertListeners) {
            this.onDOMInsertListeners.close ();
            this.onDOMInsertListeners = null;
         }
         if (this.visibilityChangeListeners) {
            this.visibilityChangeListeners.close ();
            this.visibilityChangeListeners = null;
         }

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"teardownInputListeners" );
      }
   },

   attachContentListeners : function () {
      try {
         if (this.contentListeners) {
            return;
         }

         this.contentListeners = new DejaClick.EventRegistration().
                  addDomListener(window, "click", true, this.onContentEvent, this);
      } catch (e) {
         this.reportException( e, this.DCMODULE+"attachContentListeners" );
      }
   },

   teardownContentListeners : function () {
      try {
         if (this.contentListeners) {
            this.contentListeners.close();
            this.contentListeners = null;
         }
      } catch (e) {
         this.reportException( e, this.DCMODULE+"teardownContentListeners" );
      }
   },

   teardownReplayListeners : function ()
   {
      try {
         if (this.replayListeners) {
            this.replayListeners.close();
            this.replayListeners = null;
         }
      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"teardownReplayListeners" );
      }
   },

   //------------------------------------------------
   teardownAsyncTimers : function()
   {
      try {
         if (this.logger.debugprocess) { this.logger.logDebug("clearing all async timers and timeouts..."); }
/*
         // restore all browser windows to their original sizes/positions now
         // since we are about to kill the timer that would have done it later.
         if (gDC.restoreDeferred) {
            gDC.restoreDeferred = false;
            gDC.restoreBrowserWindows();
         }
*/
         this._clearAll();

         this.mutationsDelay = null;

         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"teardownAsyncTimers" );
      }
   },
   
   injectDejaDOM: function(aEvent){
      var isInstalledNode = document.createElement('div');
      isInstalledNode.id = 'dejaclick-is-installed';
      document.body.appendChild(isInstalledNode);
   },
    
   setDebugOptions : function (aOption) {
      if (aOption !== undefined) {
         this.logger.setDebugOptions(aOption);
      }
   },

   setMessageOptions : function (aOption) {
      if (aOption !== undefined) {
         this.logger.setMessageOptions(aOption);
      }
   },

   stopBrowserActivity : function () {
      window.stop();
   },

   /**
    * Log an exception and (if we are recording or replaying) report it
    * to the background service.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Error} aError The exception object.
    * @param {string} aContext Where the exception was caught.
    */
   reportException: function(aError, aContext) {
      var message = this.logger.logException(aError, aContext);
      if ((this._runMode === constants.RUNMODE_REPLAY) ||
          (this._runMode === constants.RUNMODE_RECORD)) {
         this.observerService.notifyObservers('dejaclick:exception', message);
      }
   },

   /**
    * Configure the mutation hints information for replay.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!{
    *    recorded: integer,
    *    required: integer
    * }} aData The expected mutations.
    */
   mutationConfig : function (aData) {
      if (!this.activePage) {
         return;
      }
      this.mutationsRecorded = aData.recorded;
      this.mutationsRequired = aData.required;

      if (this.mutationsCount > 0) {
         this.observerService.notifyObservers( "dejaclick:mutationstarted", null);
         this.onMutationDelay();
      }
   },

   mutationStop : function () {
      if (!this.activePage) {
         return;
      }
      this.stopMutationDelay();
      this.mutationsRecorded = 0;
      this.mutationsRequired = 0;
      this.mutationsCount = 0;
      this.mutationsCountLast = 0;
   },

   getBaseDocument : function( evt )
   {
      return document;
   },

   //------------------------------------------------
   // Return a handle to the documentElement node of the specified document
   getDocumentElement : function(  )
   {
      try {
/*
         if (aDocument instanceof HTMLIFrameElement) {
            if (aDocument.contentDocument) {
               if (aDocument.contentDocument.documentElement) {
                  return aDocument.contentDocument.documentElement;  // found it
               }
            }
         }
*/
         return document.documentElement;  // found it


         // if we can't find it, its bad news...throw an error if we're not shutting down already
//         if (!gDC.replayShuttingDown) {
//            throw new Error("Could not find documentElement node for specified document object.");
//         }

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"getDocumentElement" );
      }
      return null;
   },

   // Try to get the target DOM node of the event
   getTargetElement : function ( evt )
   {
      try {
         var eventTarget = null;

         // Try to get the target from the event itself
         if (evt) {
            eventTarget = evt.target;

            if (!eventTarget) {
               eventTarget = evt.srcElement;
            }
            if (!eventTarget) {
               eventTarget = evt.toElement;
            }
         }

         // Did we get one?
         if (eventTarget) {
            return eventTarget; // Yep, so return it
         }

         // No, we can't locate our own target element, so ignore this event.
         // Web page javascript may also be injecting events out of our control.
         if (this.logger.debugprocess) {
            this.logger.logDebug("getTargetElement - no event target found ... webpage injected event?");
         }
      }
      catch ( e ) {
         this.reportException( e, this.DCMODULE+"getTargetElement" );
      }
      return null;
   },

   // Traverse the DOM fragment from the root node and enact custom fixes
   // and mark matching nodes with special attributes for later processing.
   // Note: this performs many of the same fixes as fixupAllDomNodes, however
   // the traversal approach is optimized to operate on a small path of
   // dynamically inserted nodes, and is much quicker than if we tried to
   // run hundreds of sets of xpath queries to access the same nodes.
   // So while there is some redundancy, this optimization is well worth
   // it and can be quite noticeable when hovering over dynamic menus.
   fixupDomNode : function( aRootNode )
   {
      try {
/*
         if (this.fixupThreshold && ++this.fixupDomCount > this.fixupThreshold) {
            // If the optional DOM fixup threshold is in use and has been exceeded,
            // then automatically switch to 'delay mode' for DOM fixup processing.
            // This speeds things up on dynamic pages that do massive DOM updates,
            // but it may also prevent proper hover trail recording on some pages.
            var docElement = null;
            try { docElement = aRootNode.ownerDocument.documentElement; } catch(ex){}
            if (docElement) {
               this.restartDomFixupTimeout( docElement );
            }

            // continue bumping mutations counter to track content changes
            if (!this.screenModeActive) this.mutationsCount++;

            return;
         }
*/
         var skipList = "|#cdata-section|head|meta|title|link|style|script|";
         var node = aRootNode;

         if (node.nodeType == 1) {  // only accept ELEMENT types
            var nodeTag = node.tagName.toLowerCase();
            if (skipList.indexOf('|'+ nodeTag +'|') == -1) {  // skip nodes we don't care about

               // IMPORTANT: We must increment the mutations counter now to track
               // the fact that a DOM node has been added after the main content
               // of the page has already loaded.  It doesn't matter whether any
               // of the fixup procedures below are used, we must still increment.
               // On replay, this will be used as a hint to know that we need to
               // wait for post-page-load DOM mutations to begin.
               if (!this.screenModeActive) { this.mutationsCount++; }

/*
               if (nodeTag == 'embed' || nodeTag == 'object' || nodeTag == 'applet') {

                  if (this._runMode == constants.RUNMODE_RECORD) {
                     this.setScreenEventHooks( node, aRootNode );
                  }

                  if (node.hasAttribute('type') && node.getAttribute('type') == "application/x-shockwave-flash") {
                     // check/set flash object visibility
                     this.setFlashVisibility( node, aRootNode );

                     if (!node.hasAttribute( constants.DC_WMODEFIXUP )) {
                        // check/set flash object wmode (if option is configured)
                        this.setFlashWmode( node, false );
                     }
                  }
               }
*/
               if (nodeTag == 'input' && node.hasAttribute('value') && node.getAttribute('type')!='hidden') {
                  // Special case: copy any default FORM INPUT values to a new attribute name
                  // because the original value may get munged before the onChange event fires,
                  // and we need to reference the original INPUT value when we go to record our
                  // breadcrumbs after the onChange event occurs.
                  node.setAttribute( constants.DC_INPUTVAL, node.getAttribute('value') );
               }

               if (this._runMode == constants.RUNMODE_RECORD) {  // only needed while recording...
                  if (node.hasAttribute('onmouseover') ||
                      node.hasAttribute('onmouseout')  ||
                      node.hasAttribute('onmousemove')) {
                     // We attach a special attribute to the DOM node if the node has mouse
                     // movement-related event handlers assigned, as these functions may
                     // trigger additional DOM element injections that can affect playback if
                     // not re-enacted.  While recording, any clicked HTML element that has
                     // our special DC_HOVERCONTENT attribute assigned will automatically
                     // generate a set of mouse hover events from the onMouseOver queue.
                     node.setAttribute( constants.DC_HOVERCONTENT, null );
                  }

                  // We attach a special attribute to the DOM node if the element was inserted
                  // after the initial page content was loaded during a recording.  This way,
                  // if any of these tagged DOM nodes become the target of a click or change
                  // event, we will be able to set a replay hint to allow for proper handling
                  // of the dynamic content upon playback.
                  node.setAttribute( constants.DC_SCRIPTEDCONTENT, null );

                  if (!this.screenModeActive && this.lastHoverEvent != -1 && this.hoverObjects.length && this.hoverEvents.length) {
                     var hoverObj = this.hoverObjects[ this.hoverEvents[ this.lastHoverEvent ] ];
                     if (hoverObj) {
                        // We also attach an additional attribute to the DOM node indicating
                        // a reference ID (index) to the most recent (onMouseOver) hover event
                        // object we have queued up, so that if this DOM element is targeted
                        // in a click event, we can record all of the important mouseover
                        // events that led to this DOM element's dynamic creation.
                        node.setAttribute( constants.DC_HOVEREVENTID, this.lastHoverEvent );
                        hoverObj.mutations++;
                        // decrement to nullify the above increment, since we can presume
                        // that this mutation was not created by webpage javascript.
                        this.mutationsCount--;
                     }
                  }
               }
            }
         }

         if (node.hasChildNodes()) {
            // fixup all child nodes as well
            for (var n=node.firstChild; n != null; n=n.nextSibling) {
               this.fixupDomNode( n );
            }
         }

         return;

      } catch( e ) {
         this.reportException( e, this.DCMODULE+"fixupDomNode" );
      }
   },


   // Query the DOM for node/attribute combinations to enact custom fixes
   // and to mark matching nodes with special attributes for later processing.
   // Note: we use xpath to scan the DOM because using javascript to loop over
   // a very large DOM is horribly slow, and is orders of magnitude slower
   // on Linux implementations.  (For reference material on this, please see
   // comment #64 from https://bugzilla.mozilla.org/show_bug.cgi?id=40988, as
   // well as bugs: 305898, 117611, 118933, 40988, 64516 to name a few).
   fixupAllDomNodes : function( aRootNode )
   {
      try {
         var i, node, pnode, nodeList, xpath;
/*
         // attach screen event listeners to all plugins, including
         // java-style applets, embeds, or objects having no embed
         // child element (to prevent attaching duplicate listeners)
         xpath = "//OBJECT[not(child::EMBED)] | //EMBED | //APPLET";
         nodeList = gDC.processXPath( aRootNode, xpath );
         for (i in nodeList) {
            node = nodeList[i];
            if (gDC._runMode == constants.RUNMODE_RECORD) {
               gDC.setScreenEventHooks( node, aRootNode );
            }

            if (node.hasAttribute('type') && node.getAttribute('type') == "application/x-shockwave-flash") {
               // check/set flash object visibility (if option is configured)
               gDC.setFlashVisibility( node, aRootNode );

               // check/set flash object wmode (if option is configured)
               gDC.setFlashWmode( node, true );
            }
         }

         // attach a screen event listener to the root node
         // to capture events before they can reach and affect the plugin
         if (nodeList && (gDC._runMode == constants.RUNMODE_RECORD)) {
            aRootNode.addEventListener('mouseover', gDC.captureLastObjectSize, true);
         }
*/
         // Special case: copy any default FORM INPUT values to a new attribute name
         // because the original value may get munged before the onChange event fires,
         // and we need to reference the original INPUT value when we go to record our
         // breadcrumbs after the onChange event occurs.
         //xpath = "//INPUT[@value and @type!='hidden']";
         xpath = "//INPUT[@type!='hidden' or not(@type)]";
         nodeList =  this.search.processXPath( aRootNode, xpath );
         for (var inputIndex = 0; inputIndex < nodeList.length; inputIndex++) {
            node = nodeList[inputIndex];
            if (node.hasAttribute('value')) {
               node.setAttribute(constants.DC_INPUTVAL, node.getAttribute('value'));
            } else {
               node.setAttribute(constants.DC_INPUTVAL, '');
            }
         }

         if (this._runMode == constants.RUNMODE_RECORD) {  // only needed while recording...
            // We attach a custom attribute to the DOM node if the node has mouse
            // movement-related event handlers assigned, as these functions may
            // trigger additional DOM element injections that can affect playback if
            // not re-enacted.  While recording, any clicked HTML element that has
            // our special constants.DC_HOVERCONTENT attribute assigned will automatically
            // generate a set of mouse movement events from the onMouseOver queue.
            xpath = "//*[@onmouseover|@onmouseout|@onmousemove]";
            nodeList =  this.search.processXPath( aRootNode, xpath );
            for (var hoverIndex = 0; hoverIndex < nodeList.length; hoverIndex++) {
               node = nodeList[hoverIndex];
               node.setAttribute( constants.DC_HOVERCONTENT, null );
            }
         }

         return;

      } catch( e ) {
         this.reportException( e, this.DCMODULE+"fixupAllDomNodes" );
      }
   },

   checkOnClick : function ( aTarget ) {
      if (!aTarget.hasAttribute('onclick') && !aTarget.hasAttribute('ng-click')) {
         if (this.logger.debugprocess) { this.logger.logDebug( "useless click event target (" + aTarget.nodeName + "), using alternate" ); }
         return true;
      }
      return false;
   },

   checkOnMouse : function ( aTarget ) {
      if (!aTarget.hasAttribute('onmouseover') &&
            !aTarget.hasAttribute('onmouseout') &&
            !aTarget.hasAttribute('onmousemove')) {
         if (this.logger.debugprocess) { this.logger.logDebug( "useless hover event target (" + aTarget.nodeName + "), ignoring" ); }
         return true;
      }
      return false;
   },

   //------------------------------------------------
   // check for useless event target elements
   isUselessTargetType : function( aTarget, aEventType )
   {

      try {

         // We do post-processing of Hover events, hence FF15+ might have already discarded the compartment,
         // thus flag the event as "useless" if that happens
         try {
            if (aEventType == 'hover' && !aTarget.parentNode) {
               return true;
            }
         }
         catch ( exx ) {
            return true;
         }

         if (aEventType=='click' && aTarget.hasAttribute && !aTarget.hasAttribute('onclick') && !aTarget.hasAttribute('ng-click')) {
            // child elements of an 'Anchor' tag ancestor (having an href attrib)
            // are considered useless, provided the target element has no onclick.
            var nodeList =  this.search.processXPath(aTarget, "ancestor::A[@href]");
            if (nodeList.length > 0) {
               return true;
            }
         }

         var strTargetName = aTarget.nodeName;
         if (strTargetName) {
            strTargetName = strTargetName.toUpperCase();
         }
         // this list is likely to need further tweaking
         switch (strTargetName) {
         case 'SELECT':
         case 'OPTION':
            // see special handling for scrolling list-type SELECT elements in onClick above
            if (aEventType=='click') {
               var selectNode = (strTargetName=='SELECT') ? aTarget : aTarget.parentNode;
               var processOptionClick = (selectNode.hasAttribute('size') && Number(selectNode.getAttribute('size')) > 1);
               if (processOptionClick) {
                  return false;
               }
            }
            //break;
            /*falls through*/
         case 'P':
         case 'B':
         case 'I':
         case 'U':
         case 'UL':
         case 'EM':
         case 'FONT':
         case 'TABLE':
         case 'FRAME':
         case 'STRONG':
         case 'BROWSER':
         case 'FIELDSET':
            if (aEventType=='click') {
               return this.checkOnClick( aTarget );
            } else if (aEventType=='hover') {
               return this.checkOnMouse( aTarget );
            }
            break;
         case 'BODY':
         case 'FORM':
         case 'INPUT':
         case 'EMBED':
            if (aEventType=='hover') {
               return this.checkOnMouse( aTarget );
            }
            break;
         case '#TEXT':
            return true;
         default: break;
         }

         return false;  // the main fallthrough

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"isUselessTargetType" );
         return false;
      }
   },


   /**
    * Search the document for an element that matches the target information.
    * Return the matching element (if any) via a dejaclick:searchComplete event.
    * @param {!{
    *    searchId: integer,
    *    breadcrumbs: ?Array.<!{
    *       tag: string,
    *       index: string,
    *       numAttributes: integer,
    *       attributes: Object.<string,string>
    *    }>,
    *    fingerprint: (string|undefined),
    *    elementpath: (string|undefined),
    *    matchTypes: string,
    *    ignoreNamedAttr: boolean,
    *    optimizedMatch: boolean
    * }} aArgs
    */
   elementSearch: function (aArgs) {
      var result;
      try {
         if (!this.activePage) {
            this.observerService.notifyObservers('dejaclick:searchcomplete', {
               searchId: aArgs.searchId,
               targetScore: 0,
               targetSelected: 'none',
               targetMethods: 'allfailed',
               targetFound: false,
               searchResults: []
            });
            return;
         }

         if (this.logger.debugsearch) {
            this.logger.logDebug("performing elementSearch...");
         }

         delete this.targetElements[aArgs.searchId];
         if (aArgs.scriptVarInfo) {
            var scriptVarInfo = aArgs.scriptVarInfo;
            var variable = new DejaClick.Variable(this.logger, scriptVarInfo.replayCount, scriptVarInfo.replayLocation); 
            var strText = variable.computeScriptVariable(scriptVarInfo.varName, scriptVarInfo.varValue);
            if (strText) {
               aArgs.elementpath = strText;
            }     
         }

         result = this.search.searchForTargetNode(
            document,
            (aArgs.fingerprint == null) ? null : aArgs.fingerprint,
            (aArgs.elementpath == null) ? null : aArgs.elementpath,
            aArgs.breadcrumbs,
            aArgs.matchTypes,
            aArgs.ignoreNamedAttr,
            aArgs.optimizedMatch);

         if (result.targetNode !== null) {
            this.targetElements[aArgs.searchId] = result.targetNode;
         }

         this.observerService.notifyObservers('dejaclick:searchcomplete', {
            searchId: aArgs.searchId,
            targetScore: result.targetScore,
            targetSelected: result.selected,
            targetMethods: result.methods,
            targetFound: (result.targetNode !== null),
            searchResults: result.methodResults
         });

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"elementSearch" );
      }
   },

   jsObjInsertTargets : function(aNode, aTargets)
   {
      try {
         var eventTargetsNode = [];

         var targetNode, domNode, searchType;

         domNode = aTargets.domNode;
         searchType = aTargets.searchType;

         targetNode = {};
         targetNode.type = searchType;

         // insert a fingerprint for this target
         var fingerprint = this.search.createFingerprint( domNode );
         if (fingerprint && fingerprint!="1") {
            targetNode.fingerprint = fingerprint;
               if (this.logger.debugprocess) { this.logger.logDebug( "fingerprint for event target inserted" ); }
         } else {
               this.logger.logWarning( "Unable to generate fingerprint for event target: " + domNode.nodeName );
            return null;
         }

         // insert an elementpath for this target ('element' search types only)
         var elementpath = this.search.getXPath( domNode );
         if (elementpath) {
            targetNode.elementpath = elementpath;
           if (this.logger.debugprocess) { this.logger.logDebug( "elementpath for event target inserted" ); }
         }

         var doNotSkipDiv = document.getElementById("dejaclick-is-singlepage") ? true: false;

         // insert a breadcrumbs trail for this target
         var breadcrumbs = this.search.leaveBreadcrumbs( domNode, doNotSkipDiv );
         if (breadcrumbs && breadcrumbs.length) {
            targetNode.breadcrumbs = breadcrumbs;
            if (this.logger.debugprocess) { this.logger.logDebug( "breadcrumbs for event target inserted" ); }
         } else {
            this.logger.logWarning( "Unable to generate breadcrumbs for event target: " + domNode.nodeName );
            return null;
         }

         return targetNode;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"jsObjInsertTargets" );
         return null;
      }
   },

   addElementSearchTargets : function( aParentNode, aElemTarget )
   {
      return this.jsObjInsertTargets( aParentNode, { domNode: aElemTarget, searchType: "element" } );

   },

   // halt event propagation
   blockEvent: function ( aEvent )
   {
      try { aEvent.preventDefault(); } catch(ex) {}
      try { aEvent.preventCapture(); } catch(ex2) {}
      try { aEvent.stopImmediatePropagation(); } catch(ex3) {}
   },


   /**
    * Record an event and return it to the background.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Event} aEvent The DOM event that was captured.
    * @param {!Element} aElemTarget The target of the event.
    * @param {string} aActionType The type of event to record.
    * @param {integer=} aMutationCount The number of DOM mutations.
    */
   captureEvent : function( aEvent, aElemTarget, aActionType, aMutationCount )
   {
      try {
         // :: start of captureEvent processing ::
/*
         if (aMutationCount || this.mutationsCount > 0) {
            this.scriptedContent = true;
         }
*/
         var elemTarget = aElemTarget;
         // determine if this event requires waiting for scripted content
         if (elemTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT )) {
            this.scriptedContent = true;
         }

         var haveNodeName = true;
         try {
            if (!elemTarget.nodeName) {
               haveNodeName = false;
            }
         }
         catch (exx) {
            haveNodeName = false;
         }
         if (!haveNodeName) {
            if (this.logger.debugprocess) { this.logger.logDebug( "captureEvent - unable to get nodeName for for event target...ignoring"); }
            return false;
         }
         var docTarget = null;

         if (this.submitObj && this.actEventNode) {
            this.jsObjAddEventParam( this.actEventNode, "value", this.submitObj.target.value );
            this.observerService.notifyObservers("dejaclick:addKeyPressParams", this.actEventNode);
         }
         
         this.submitObj = null;

         if (this.actEventNode && this.actEventNode.type != 'hover') {
            // take care of some housekeeping for the previous event
            this.setReplayHints( false );
         }

         // track the new event for display and replay handling
         this.eventsCaptured.push( aActionType );

         // create a new event element
         var eventNode = this.actEventNode;
         eventNode.type = aActionType;
         // attach event parameters
         if (aEvent.button && aEvent.button !== undefined) {
            this.jsObjAddEventParam(eventNode, "button",  aEvent.button);
         }
         if (aEvent.detail && aEvent.detail !== undefined) {
            this.jsObjAddEventParam(eventNode, "detail",  aEvent.detail);
         }
         if (aEvent.screenX && aEvent.screenX !== undefined) {
            this.jsObjAddEventParam(eventNode, "screenX", aEvent.screenX);
         }
         if (aEvent.screenY && aEvent.screenY !== undefined) {
            this.jsObjAddEventParam(eventNode, "screenY", aEvent.screenY);
         }
         if (aEvent.clientX && aEvent.clientX !== undefined) {
            this.jsObjAddEventParam(eventNode, "clientX", aEvent.clientX);
         }
         if (aEvent.clientY && aEvent.clientY !== undefined) {
            this.jsObjAddEventParam(eventNode, "clientY", aEvent.clientY);
         }
         if (aActionType=='click' && elemTarget instanceof HTMLInputElement && elemTarget.type.toLowerCase()=='image') {
            if (aEvent.offsetX && aEvent.offsetX !== undefined) {
               this.jsObjAddEventParam(eventNode, "offsetX", aEvent.offsetX);
            }
            if (aEvent.offsetY && aEvent.offsetY !== undefined) {
               this.jsObjAddEventParam(eventNode, "offsetY", aEvent.offsetY);
            }
         }
         if (aEvent.altKey && aEvent.altKey !== undefined) {
            this.jsObjAddEventParam(eventNode, "altKey",  aEvent.altKey);
         }
         if (aEvent.ctrlKey && aEvent.ctrlKey !== undefined) {         
            this.jsObjAddEventParam(eventNode, "ctrlKey", aEvent.ctrlKey);
         }
         if (aEvent.metaKey && aEvent.metaKey !== undefined) {
            this.jsObjAddEventParam(eventNode, "metaKey", aEvent.metaKey);
         }
         if (aEvent.shiftKey && aEvent.shiftKey !== undefined) {
            this.jsObjAddEventParam(eventNode, "shiftKey",aEvent.shiftKey);
         }

         // also attach the current cursor position or selection range if the target is a textbox or textarea
         var textInputTarget = ((elemTarget instanceof HTMLInputElement && (elemTarget.type == "text" || elemTarget.type == "password")) ||
                                 elemTarget instanceof HTMLTextAreaElement);
         if (aActionType=='click' && textInputTarget) {
            if (aEvent.selectionStart && aEvent.selectionStart !== undefined) {
               this.jsObjAddEventParam(eventNode, "selectionStart", elemTarget.selectionStart);
            }
            if (aEvent.selectionEnd && aEvent.selectionEnd !== undefined) {
               this.jsObjAddEventParam(eventNode, "selectionEnd", elemTarget.selectionEnd);
            }
         }

         // attach document and element search targets to this event node
         var searchTargets = this.addElementSearchTargets( eventNode, elemTarget);

         if (!searchTargets) {
            // In rare cases, if we are unable to insert our targets,
            // it may lead to displaying <???> as the event target in
            // the sidebar, which cannot be replayed.  So we block
            // the event and undo the entire event insertion sequence.
            return false;
         }
         eventNode.targets = searchTargets;
         eventNode.docURL = document.URL;
         eventNode.docTitle = document.title;
         
         var descrip = this.getTruncatedDescription (elemTarget, eventNode.type);
         if (descrip) {
             this.jsObjAddEventAttribute(eventNode, "description", descrip);
         }
		 
	 //if(document.getElementById("dejaclick-is-singlepage")||elemTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT )) {
	 //    this.jsObjAddEventAttribute(eventNode, "optimizedmatch", "false");
          //   this.jsObjAddEventAttribute(eventNode, this.DC_OPTID_USEMATCHTYPES, "ep");
         //}
		 
         this.observerService.notifyObservers("dejaclick:addEvent", eventNode);
         this.actEventNode = {};
         return true;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"captureEvent" );
         return false;
      }
   },

   //------------------------------------------------
   // NOTICE:  Make sure you know what you are doing before attempting
   // to modify this method.  It is highly optimized and very fragile!
   // While it would be nice to trim or filter even more hover events
   // from the injection stream, this approach is needed because many
   // DHTML websites recreate new DOM objects each time an element is
   // moused-over.  So we can't just replay events from the initial or
   // last mouseover event on a given element, otherwise DOM elements
   // that get created on each rollover pass while recording will not
   // get created during replay without the same number of rollovers,
   // and thus will not be available for target element searching.
   addHoverEvents : function( aDocument, aHoverEventID )
   {
      try {
         if (!aDocument) { return; }

         var i, id, hoverObj, sourceID = 0;

         //   ::::  STEP 1  ::::
         // Traverse back through the set of ancestor IDs for the target
         // element, and set sourceID to the first originating parent ID.
         if (aHoverEventID==null) {
            // when no parent id is available, just use last queued event
            aHoverEventID = this.lastHoverEvent;
         } else {
            hoverObj = this.hoverObjects[ this.hoverEvents[aHoverEventID] ];
            for (id=aHoverEventID; id != -1 && hoverObj && id != hoverObj.hoverevent; id=hoverObj.hoverevent) {
               sourceID = id;
               hoverObj = this.hoverObjects[ this.hoverEvents[id] ];
               if (!hoverObj) { break; }
            }
         }

         //   ::::  STEP 2  ::::
         // Continue rolling back the event chain until we find the first
         // event that either spawned the creation of multiple DOM nodes,
         // or the related target element had mouse-movement trigger
         // functions assigned as HTML attributes.
         for (i=sourceID; i >= 0; i--) {
            hoverObj = this.hoverObjects[ this.hoverEvents[i] ];
            if (!hoverObj) { break; }
            if (hoverObj.mutations > 1 || hoverObj.onmouse) {
               sourceID = i;
            }
         }

         //   ::::  STEP 3  ::::
         // Starting with sourceID obtained from steps 1 & 2, we now
         // inject mouseover events into the recorded script for each
         // event in the chain (skipping any nodes as described below),
         // and stop just before we get to the aHoverEventID event.
         var lastHoverObjTarget = null;
         for (i=sourceID; i < aHoverEventID; i++) {
            hoverObj = this.hoverObjects[ this.hoverEvents[i] ];
            if (!hoverObj || hoverObj.target == lastHoverObjTarget) {
               continue;  // coalesce duplicate hover events
            }
            if (hoverObj.mutations === 0) {
               // skip the event if this hover event targets a non-scripted
               // (static) DOM element which doesn't have any mouse-related
               //  event handlers assigned.
               continue;
            }
            if (this.isUselessTargetType( hoverObj.target, 'hover' )) {
               continue;  // don't inject a hover event for unresponsive types
            }
            if (this.firstHoverTarget == null) {
               this.firstHoverTarget = hoverObj.target;
            }
            if (!this.captureEvent( hoverObj, hoverObj.target, 'hover', hoverObj.mutations )) {
               continue;  // don't inject a hover event if unable to capture
            }
            this.setReplayHints( false, hoverObj );  // cap off last hover event replay hints
            lastHoverObjTarget = hoverObj.target;
         }

         //   ::::  STEP 4  ::::
         // Same as Step 3, except that we start injecting ALL mouseover events
         // beginning with the aHoverEventID event to the end of the event queue,
         // skipping no events except duplicate sequential nodes.  Note: step 3
         // is an attempt to weed out unnessesary hover events prior, while this
         // step ensures all remaining events are injected because of the quirky
         // behavior of many DHTML implementations that require it.
         lastHoverObjTarget = null;
         for (i=aHoverEventID; i < this.hoverEvents.length; i++) {
            hoverObj = this.hoverObjects[ this.hoverEvents[i] ];
            if (!hoverObj || hoverObj.target == lastHoverObjTarget) {
               continue;  // coalesce duplicate hover events
            }
            if (hoverObj.mutations === 0 && i < this.hoverEvents.length-2) {
               // skip the event if this hover event targets a non-scripted
               // (static) DOM element which doesn't have any mouse-related
               //  event handlers assigned.
               continue;
            }
            if (this.isUselessTargetType( hoverObj.target, 'hover' )) {
               continue;  // don't inject a hover event for unresponsive types
            }
            if (this.firstHoverTarget == null) {
               this.firstHoverTarget = hoverObj.target;
            }
            if (!this.captureEvent( hoverObj, hoverObj.target, 'hover', hoverObj.mutations )) {
               continue;  // don't inject a hover event if unable to capture
            }
            this.setReplayHints( false, hoverObj );  // cap off last hover event replay hints
            lastHoverObjTarget = hoverObj.target;
         }
         this.scriptedContent = true;
         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"addHoverEvents" );
      }
   },


   //------------------------------------------------
   // check and process any hover trails (required mouseover content)
   processHoverTrail : function( aDocRoot, aTarget )
   {
      try {
         // bug #5622 - check both target and ancestor elements for hoverContent since
         // ancestor may have an onmouse* function that unhides child target elements
         var nodeList = this.search.processXPath(aTarget, "ancestor-or-self::*[@"+constants.DC_HOVERCONTENT+"]");
         var hasHoverContent = (nodeList.length > 0);

         var hasScriptedContent = aTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT );
         var hasHoverEventID = aTarget.hasAttribute( constants.DC_HOVEREVENTID );

         if (hasScriptedContent || hasHoverContent) {

            this.setReplayHints( false );

            if (this.hoverObjects.length && this.hoverEvents.length && this.lastHoverEvent != -1) {

               var saveEventNode = this.actEventNode;

               if (hasHoverContent && !hasScriptedContent) {   // element has onmouse-related function attributes
                  this.addHoverEvents( aDocRoot, null );

               } else if (hasHoverEventID) {  // element has a mouse hover ID assigned
                  var myHoverEvent = aTarget.getAttribute( constants.DC_HOVEREVENTID );
                  this.addHoverEvents( aDocRoot, myHoverEvent );

               } else {  // element created via scripted content, (but not via mouseover event)
                  this.addHoverEvents( aDocRoot, null );
               }


               // XXX hook this into the automatic-mode for Content Changes property setting
               if (this.useMutationHints) {
//                  this.setEventBoolPref( DC_OPTID_USEMUTATIONHINTS, true, saveEventNode );
                  this.jsObjAddEventAttribute( saveEventNode, this.DC_OPTID_USEMUTATIONHINTS, true );
               }

            }
            this.scriptedContent = true;
         }

         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"processHoverTrail" );
         return false;
      }
   },

   /**
    * @this {!DejaClick.DejaServiceCS}
    * @param {boolean} aLastEvent Always false at this time.
    * @param {Object=} aHoverObj Optional object being hovered over.
    */
   //------------------------------------------------
   // check and set any necessary replay hints for the last processed event
   setReplayHints : function ( aLastEvent, aHoverObj )
   {
      try {
/*
         if (gDC.actEventNum === 0 || (gDC._runType == RUNTYPE_RECORDAPPEND && gDC.recordedEvents === 0)) {
            // skip if no events recorded yet
            return;
         }
*/

         // This is commented for now and is different from the way it works on DejaClick
         // It seems like adding a scripting hint and mutation hint for whenever there
         // have been dom insert is an overkill. This might be causing some the browser
         // timeouts. So, commenting it for now and only adding the hint when the node
         // target was inserted after the dom load
//         if ((this.mutationsCount || this.scriptedContent) &&
         if (this.scriptedContent &&
             this.jsObjGetReplayHint(this.actEventNode, constants.DC_SCRIPTINGHINT)==null) {
            // Assign the "wait for scripted content" attribute to the previous event.
            // This sends a hint to the replay engine to wait an additional bit of time
            // before replaying the next event and also to release any lock it may have
            // on the main UI thread so the browser (webpage javascript) has time to
            // render any dynamic content changes during replay.  The main difference
            // between this hint and the DC_MUTATIONHINT hint is that this hint permits
            // extra processing time BEFORE the event is injected, while DC_MUTATIONHINT
            // controls how long the replay engine should wait AFTER event injection.
            this.jsObjAddReplayHint( this.actEventNode, constants.DC_SCRIPTINGHINT, "true" );

            // Special Case: force ON the "Use Recorded Content Change Hints" option
            // (which is normally off by default) whenever an event has DOM mutations.
            if (this.mutationsCount) {
               this.actEventNode.useMutationHint = "true";
//               this.jsObjAddEventAttribute( this.actEventNode, this.DC_OPTID_USEMUTATIONHINTS, true );
            }
         }
/*
         if (this.embeddedObjectEvent != null ||
             (this.domTreeHasReplayHint(this.actEventNode, constants.DC_NETWORKHINT) &&
              (this.domTreeHasReplayHint(this.actEventNode, constants.DC_SCRIPTINGHINT) || aLastEvent))) {
            // Special Case: force ON the fullpage option to wait for all page objects to load if:
            //    1. the user has clicked on an embedded object
            //    2. this event has a scripting hint and there was network activity
            //    3. this is the final recorded event and there was network activity
            this.setEventBoolPref(DC_OPTID_FULLPAGEOBJECTS, true, this.actEventNode);
         }
*/
         if (((aHoverObj && aHoverObj.mutations > 0) || this.mutationsCount) &&
             this.jsObjGetReplayHint(this.actEventNode, constants.DC_MUTATIONHINT)==null) {
            // Assign the "wait for mutation activity" attribute to the previous event.
            // This sends a hint to the replay engine to wait for a short timeout period
            // after the last DOM mutation event before replaying the next event so the
            // browser has time to perform its (javascript) updates upon playback.  The
            // mutationsCount value only matters if DC_OPTID_USEMUTATIONHINTS is set,
            // which is user-configurable, and is normally automatically set by Deja.

            if (aHoverObj != null) {
               // override current event's mutationsCount with hover event mutations if available...
               if (aHoverObj.mutations > 0) {
                  // ...but only add the hint if our hover-event mutations count is > 0.
                  // (Note: we do all this because there may be 0 normal mutations for the
                  // final event (e.g., 'click') following a hover trail, and so would end
                  // up not having any mutation hint assigned.  However, if mutations were
                  // generated during the hover events themselves [as happens on DHTML menus]
                  // we definitely will want to set the mutations hint on the final event
                  // since 'hover trail' events are pre-generated by Deja only as-needed.)
                  this.jsObjAddReplayHint( this.actEventNode, constants.DC_MUTATIONHINT, aHoverObj.mutations );
               }

               if (this.firstHoverTarget == aHoverObj.target && aHoverObj.mutations === 0) {
                  this.useMutationHints = true;  // this flag is checked in processHoverTrail
               }

            } else {
               // no hover override available, so set this event's mutation hint to its own mutationsCount
               this.jsObjAddReplayHint( this.actEventNode, constants.DC_MUTATIONHINT, this.mutationsCount );
            }

            this.fixupDomCount = 0;
            if (this.mutationsCount) { this.mutationsCount = 0; }  // count already assigned, so reset the counter
         }
/*
         if (this.actEventNum && this.dialogRules.length &&
             this.dialogRules.length > this.actEventNode.getElementsByTagName("dialog").length) {
            // Putting this here is kindof a hack, but we needed a solid place to put a
            // hook for post-processing any dialog interaction data we may have recorded
            // for the event, and this function was being called in all the right places.
            this.insertDialogData();
         }

*/
         // reset per-event variables
         this.scriptedContent = false;
         this.pendingLocations = 0;
         //this.mutationsCount = 0;
         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"setReplayHints" );
      }
   },

   getTruncatedDescription: function (element, eventType) {
	   try {
		   var elemDescrip = this.getElementDescription(element, eventType);
		   elemDescrip = elemDescrip.replace(/\n/g, " ");
		   elemDescrip = elemDescrip.replace(/\r/g, " ");
		   return elemDescrip;
	   } catch ( e ) {
         this.reportException( e, this.DCMODULE+"getTruncatedDescription" );
      }		   	   
   },
   
   getElementDescription: function(element, eventType) {
      try {
         var labels = [], preDescrip = '';
         var id = element.id;
         var strTargetName = element.nodeName;
         if (strTargetName) {
            preDescrip = eventType.charAt(0).toUpperCase() + eventType.slice(1) + " on <" + strTargetName.toUpperCase() + "> ";
         }
		 
		 // Handle Labels for HTML Input Element
         if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
            if (element.labels && element.labels.length) {
               var labelChildren = element.labels[0].children ? element.labels[0].children.length : 0;
               if (labelChildren) {
                  for (var i = 0; i < labelChildren; i++) {
                     var labelChild = element.labels[0].children[i];
                     var tagName = labelChild.tagName.toLowerCase();
                     if (tagName !== "script" && tagName !== "style" && labelChild.innerHTML) {
                        return preDescrip + labelChild.innerHTML;
                     } 
                  }
               }
               return preDescrip + element.labels[0].innerHTML;
            }

            id && Array.prototype.push.apply(labels, document.querySelector("label[for='" + id + "']"));

            if (labels.length > 0) {
               return preDescrip + labels[0].innerHTML;
	    }
			
            if (element.type == "submit" && element.value) {
               return preDescrip + element.value;
            }
	 }
		
		// Handle Anchor Element
	 if (element instanceof HTMLAnchorElement) {
	    if (element.innerText) {
	       return preDescrip + element.innerText;
            }	
            else {
	       var numAnchorChildren = element.children ? element.children.length : 0;
	       for (var anchorIter = 0; anchorIter < numAnchorChildren; anchorIter++) {
	          var anchorChild = element.children[anchorIter];
		  var anchorChildTagName = anchorChild.tagName.toLowerCase();
		  if (anchorChildTagName === "img" && anchorChild.getAttribute('alt')) {
		     return preDescrip + anchorChild.getAttribute('alt');
		  }
		  if (anchorChild.innerHTML) {
		     return preDescrip + anchorChild.innerHTML;
		  }
               }
			   
	       if (element.href) {
                  return preDescrip + element.href;
	       }
            }			   
         }
		 
		 
	 if (element instanceof HTMLPictureElement) {
	    if (element.innerText) {
	       return preDescrip + element.innerText;
            }	
            else {
	       var numPicChildren = element.children ? element.children.length : 0;
	       for (var picIter = 0; picIter < numPicChildren; picIter++) {
	          var picChild = element.children[picIter];
		  var picChildTagName = picChild.tagName.toLowerCase();
		  if (picChildTagName === "img" && picChild.getAttribute('alt')) {
	             return preDescrip + picChild.getAttribute('alt');
		  }
               }
            }					 
	 }
		 
		// Handle Button Element
         if (element instanceof HTMLButtonElement) {
	    if (element.innerText) {
	       return preDescrip + element.innerText;
            }	
            else {
	       var numButtonChildren = element.children ? element.children.length : 0;
	       for (var buttonIter = 0; buttonIter < numButtonChildren; buttonIter++) {
		  var buttonChild = element.children[buttonIter];
		  var buttonChildTagName = buttonChild.tagName.toLowerCase();
		  if (buttonChildTagName !== "script" && buttonChildTagName !== "style" && buttonChild.innerText) {
	    	     return preDescrip + buttonChild.innerText;
		  }
               }			  
            }			   
         }
		 
	 if (element instanceof HTMLImageElement) {
	    if (element.getAttribute('alt')) {
	       return preDescrip + element.getAttribute('alt');
	    }
	 }
		 
	 if (element instanceof HTMLDivElement) {
            var numDivChildren = element.children ? element.children.length : 0;
            if (numDivChildren) {
                for (var divIter = 0; divIter < numDivChildren; divIter++) {
                   var divChild = element.children[divIter];
                   var divChildTagName = divChild.tagName.toLowerCase();
                   if (divChildTagName !== "script" && divChildTagName !== "style" && divChild.innerText) {
                      return preDescrip + divChild.innerText;
                   }
                }				   
             }			   
          }	
		       
          if (element.getAttribute('aria-labelledby')) {
             return preDescrip + element.getAttribute('aria-labelledby');
          }
		 
          if (element.getAttribute('aria-label')) {
             return preDescrip + element.getAttribute('aria-label');
          }
		 
          if (element.innerText) {
             return preDescrip + element.innerText;
          }	
		 
          if (element.name) {
             return preDescrip + element.name; 
          }
		 
          return '';
		 
      } catch (e) {
         this.reportException( e, this.DCMODULE+"getElementDescription" );
      }
   },
   
   //----------------------------------------------------------------------
   // =======================
   // UI Event handlers
   // =======================
   //------------------------------------------------

   /**
    * Report a user event on a pre-existing page while recording.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Event} event The user event.
    */
   reportInvalidEvent: function(event) {
      try {
         this.observerService.notifyObservers('dejaclick:invalidevent',
                                              event.type);
         this.blockEvent(event);
      } catch (e) {
         this.logger.logException(e);
      }
   },

   // WARNING: the DOM_VK_ items used below are pre-defined CONSTANTS at the top of this source file!
   // Note that we must subtract numeric 32 from evt.which to get the lowercase keystroke equivalent.
   // Also, this handler is hooked in at the browser window level, not at the document level, which
   // is required to catch events that occur before javascript code on the web page can mess with it.
   onBrowserKeypress : function( evt )
   {
      try {

/*
         if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
            try {
               var keyTarget = evt.target;
               if (keyTarget) {
                  var nodeList = this.search.processXPath( keyTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
                  if (nodeList.length) {
                     return;  // exit now if target or ancestor node is a deja note
                  }
               }
            } catch(ex) {}
         }
*/

         if (!this.eventsEnabled) {
            if (!(evt.ctrlKey && ((evt.which-32) == this.DOM_VK_C || (evt.which-32) == this.DOM_VK_V))) {
               // allow cutting & pasting text to the buffer;
               // block anything else during keystrokes mode
               this.blockEvent( evt );
            }
         }

         this.lastBrowserKeypress = evt.which;
         var recordKeystrokes = false;
         var emitEnterKey = false;
         if (this._runMode == constants.RUNMODE_RECORD) {
/*
            if (this._eventsService) {
               if (evt.type == 'keypress') {
                  // check if the screen events hotkey was pressed
                  var hotKeyPressed = false;
                  var keyObj = this.screenHotkeyObj;
                  hotKeyPressed = ( evt.keyCode  == keyObj.keyCode  &&
                                    evt.charCode == keyObj.charCode &&
                                    evt.ctrlKey  == keyObj.ctrlKey  &&
                                    evt.altKey   == keyObj.altKey   &&
                                    evt.shiftKey == keyObj.shiftKey &&
                                    evt.metaKey  == keyObj.metaKey );

                  if (hotKeyPressed) {  // toggle screen events mode if hotkey pressed
                     var contentType;
                     try { contentType = evt.target.contentType; } catch(ex){}
                     if (contentType != "image/svg+xml" && contentType != "application/vnd.mozilla.xul+xml") {
                        if (!this.screenModeActive) {
                           if (this.logger.debugprocess)  this.logger.logDebug( "onBrowserKeypress - screen event mode activated using hotkey" );
                           // force a simulated mouseover event to trigger screen event record mode
                           this.screenHasFocus = true;
                           this.hotkeyModeActive = true;
                           this.onMouseOverScreen( evt );
                        } else {
                           this.deactivateScreenCapture();
                        }
                        return;
                     }
                  }
               }
            }

            if (this.screenModeActive) {
               // jump out now if screen events mode is enabled
               if (this.logger.debugprocess)  this.logger.logDebug( "onBrowserKeypress - screen event pending, ignoring this event" );
               return;
            }
*/
            if (this.eventsCaptured && this.eventsCaptured.length === 0) {
               return;  // bad state, should have at least one event, just exit
            }

            var keyTarget = evt.target;
            if (keyTarget.type == "radio") {
               // force keystroke playback for radio buttons (to handle arrow key
               // selection) and block the recording of any firefox-injected click
               // events upon radio button selection.
               recordKeystrokes = true;  // force keystroke recording on

               // onClick and onChange will always reset pendingKeystrokes to false.
               // This will end up creating a new Deja input event for all three
               // keydown/keypress/keyup browser events after the firefox-injected
               // click event occurs when using up/down arrow keys on radio buttons.
               // So in order to keep the entire keydown/keypress/keyup sequence
               // under one Deja input event, we reset the pendingKeystrokes flag.
               this.pendingKeystrokes = true;
            }

            if (evt.keyCode == this.DOM_VK_TAB && evt.type == 'keyup') {
               if (this.lastKeyCode == this.DOM_VK_TAB && !this.recordFocusEvents) {
                  // Special case: we want to record a TAB keyup event as a new Deja 'focus' event
                  // so that we can use it to set focus on the next HTML element in the tab focus
                  // ring.  The new focus event will always be associated with the 'next' DOM node
                  // element, not the previous one begin blurred - exactly what we want to focus.
                  // Note: lastKeyCode will only be set to DOM_VK_TAB if we just recorded a tab
                  // keypress event on an HTMLInputElement text input or HTMLTextAreaElement field,
                  // which helps to prevent automatically recording focus events unless they are
                  // preceeded by tabbing out of a text input field.  Also, if RECORDFOCUSEVENTS
                  // option is enabled, skip this call altogether since it will already be handled.
                  this.onFocus( evt, true );  // force a new focus event
               }
               return;
            }

            var textInputTarget = ((keyTarget instanceof HTMLInputElement && 
                                  (keyTarget.type == "text" || keyTarget.type == "password" || 
                                   keyTarget.type == "search" || keyTarget.type == "tel" || 
                                   keyTarget.type == "date" || keyTarget.type == "datetime" || keyTarget.type == "datetime-local" || keyTarget.type == "month" ||
                                   keyTarget.type == "number" || keyTarget.type == "range" ||
                                   keyTarget.type == "time" || keyTarget.type == "url" || keyTarget.type == "week")) ||
                                   keyTarget instanceof HTMLTextAreaElement);

            // Commenting this for Chrome. The keyTarget when the Enter Key is pressed on the text input
            // on google.com does not have a keyTarget that is a HTMLInputElement.
//            var enterKeyPressed = ((evt.keyCode == this.DOM_VK_RETURN || evt.keyCode == this.DOM_VK_ENTER) &&
//                                   (keyTarget instanceof HTMLHtmlElement || keyTarget instanceof HTMLInputElement));
            var enterKeyPressed = (evt.keyCode == this.DOM_VK_RETURN || evt.keyCode == this.DOM_VK_ENTER);
            if (enterKeyPressed) {
               if (evt.type == 'keyup') {
                  if (this.bufferedKeycodes) {
                     // buffered key codes have not been cleared, so force
                     // keystroke recording ON and emit the the enter key.
                     this.pendingKeystrokes = true;
                     recordKeystrokes = true;
                     emitEnterKey = true;

                  } else {
                     return;  // otherwise, don't record enter key, just return
                  }
/*
               } else {  // enter keydown or keypress
                  if (!this.domTreeHasReplayHint(this.actEventNode, constants.DC_NETWORKHINT)) {
                     // Special case: if we are emitting the enter keystroke, but we have not yet
                     // seen any network activity in prior recorded keystrokes, then set a special
                     // flag to prevent assigning the super-slow replay speed to this input event.
                     this.skipSpeedAdjust = true;
                  }
*/
               }
            }

            if (enterKeyPressed) {

               // Special case: handle a moz bug with FORM submits that occur when the Enter key
               // is pressed on a form INPUT field and there are no input elements (for any form
               // on the page) that have a 'type' attribute value set to "submit" (e.g., mac.com).
               // The normal FF behavior for enter-key-submission is to arbitrarily pick the first
               // form input element of type submit, and then send a click event to it to simulate
               // the user doing the same.  However, when no submit input elements exist, it will
               // call the submit method on the form directly (no click event), and also will not
               // generate a 'change' event for the input field or a 'submit' event for the form.
               // To fix, we check for any form input no des anywhere on the page with a type attrib
               // of 'submit' or 'image' and if none, enable keystroke replay for this event and
               // permit the Enter/Return keystroke to be recorded so FF can submit the form.
               var nodeList =  this.search.processXPath( keyTarget, "//form//input[@type='submit' or @type='image']" );
               var missingSubmit = (nodeList && nodeList.length === 0) ? true : false;

               // Special case for sites like google.com where the "enter" key does not trigger a
               // a form submit. Unlike "Firefox", "Chrome" is unable to replay keystokes for "enter"
               // In such a scenario, we force a "click" capture during recording.
               if (keyTarget.form) {
                  for (var i = 0; i < keyTarget.form.elements.length; i++) {
                     if (/submit/i.test(keyTarget.form.elements[i].type)) {
                        this.submitObj = {elem: keyTarget.form.elements[i], target: keyTarget};
                        this.jsObjAddEventParam( this.actEventNode, "value", keyTarget.value );
                        this.observerService.notifyObservers("dejaclick:addKeyPressParams", this.actEventNode);
                        return;
                     }
                  }                  
               }

               if (missingSubmit) {
                  this.pendingKeystrokes = true;
                  recordKeystrokes = true;  // force keystroke recording on
                  emitEnterKey = true;
               }
            }

            if (textInputTarget || recordKeystrokes) {

               var eventNode = this.actEventNode;

               // Special case: check if the target input element has onkey-up/down/press
               // event listener attribs and if so, set keystroke replay property setting.
               // Likewise, check if any ancestors of the node have these event listeners
               // so we may also trigger keystroke recording.
               var nodelist =  this.search.processXPath( keyTarget, "ancestor-or-self::input[@onkeydown|@onkeypress|@onkeyup]" );
               if (nodelist.length > 0) {
                  recordKeystrokes = true;  // force keystroke recording on
               }

               // Note: if a ctrl-key sequence is inputted, we do not record its keycodes.
               // This is because ctrl-key sequences typically do not map to printable chars
               // but to functions whose effect on the current input event might not be
               // the same each time (e.g. the effect of a Ctrl+V key sequence (paste)
               // depends on the current system clipboard contents).
               // Instead deja will capture the input text from the final 'value' of the
               // event target in onChange.
               // In addition, we clear any keycodes already recorded for the event
               // (and set a special flag to bypass recording any further keycodes)
               // because they would no longer be in sync with the recorded input text.

               // XXX for now, we don't record ANY control-key sequences (e.g. cut/paste)
               // however, we may want to consider this option in the future if needed.
               //if (evt.ctrlKey && ((evt.which-32) == DOM_VK_C || (evt.which-32) == DOM_VK_V)) ....
               if (evt.ctrlKey || this.bypassKeystrokes) {

                  if (this.jsObjHasEventParam( eventNode, "keycodes" )) {
                     this.jsObjDelEventParam( eventNode, "keycodes" );
                  }

                  this.bypassKeystrokes = true;
                  return;  // don't record this or any further keystrokes
               }

               if (recordKeystrokes) {
                  // conditions met, force keystrokes replay
                  this.jsObjAddEventAttribute( eventNode, this.DC_OPTID_USEKEYSTROKES, true );
               }

               if (textInputTarget) {
                  this.lastKeyCode = evt.keyCode;
               }

               var keyCode = evt.which;
               if (!this.pendingKeystrokes && !(enterKeyPressed && evt.type == 'keyup')) {
                  this.onChange( evt );  // force a new change event at first keystroke
                  if (!(evt.keyCode == this.DOM_VK_TAB && evt.type == 'keyup')) {
                     // always set flag, except when processing a tab keyup event
                     this.pendingKeystrokes = true;
                  }
               }

               if (evt.which != evt.charCode) {
                  // Brackets force special replay handling for keyCodes vs. charCodes.
                  // Basically, for key codes, we must wrap the keyCode in brackets
                  // to indicate the type of key event that was recorded (keyCode vs.
                  // charCode) for proper keystroke injection  inside replayNextEvent.
                  if (evt.keyCode == this.DOM_VK_TAB && evt.type == 'keyup') {
                     keyCode = "[" + this.DOM_VK_PAUSE + "]";
                  } else {
                     keyCode = "[" + evt.keyCode + "]";
                  }
               }

               if (evt.type == 'keypress') {
                  // get the (printable) char for the key that was pressed
                  var nextChar = (evt.charCode !== 0) ? String.fromCharCode(evt.charCode) : "";

                  // insert the new char into the current text value of the input field, replacing any selected text
                  var oldValue = keyTarget.value;
                  var ok = /text|password|search|tel|url/.test(keyTarget.type);
                  var newValue;
                  if (ok) {
                     newValue = (!nextChar) ? oldValue : oldValue.substring(0, keyTarget.selectionStart) + nextChar + oldValue.substring(keyTarget.selectionEnd);
                  }
                  else {
                     newValue = oldValue + nextChar;
                  }
                  this.jsObjAddEventParam( eventNode, "value", newValue );
               }
               else if (evt.type == 'keyup' && evt.which < this.UNPRINTABLE_CHAR_RANGE) {
                  this.jsObjAddEventParam( eventNode, "value", keyTarget.value );
               }

               // record the next keyCode set (event-type/key-code/key-modifiers)
               var keyModifiers = "";
               if (evt.ctrlKey)  { keyModifiers += "ctrlKey "; }
               if (evt.altKey)   { keyModifiers += "altKey "; }
               if (evt.shiftKey) { keyModifiers += "shiftKey "; }
               if (evt.metakey)  { keyModifiers += "metakey "; }

               var nextKeyCode = evt.type + ":" + keyCode + ":" + keyModifiers;

               if (enterKeyPressed) {
                  // Normally, hitting the enter key on a form field will cause Firefox
                  // to inject a click event on the form's submit button or to invoke the
                  // default submit action directly on the form element.  So we don't want
                  // to record the enter key sequence on an input form field (textarea
                  // is ok though) if deja has already heard and recorded a click or a
                  // submit event that Firefox injected while processing the enter key.
                  // Yet, there are some sites that mess with events badly and prevent
                  // event propagation (like google.com) which ends up preventing firefox
                  // from injecting either the click or submit events.  So in those odd
                  // cases, we actually do need to record the enter keystroke sequence.
                  // However, we don't actually know whether we should record the enter
                  // keystroke sequence or not until AFTER the enter keydown & keypress
                  // keystroke events have occurred, but before the keyup.  Hence, we
                  // need to buffer the enter keystrokes events until we know for sure
                  // if we need to emit them all or not.  Isn't life grand? :)
                  if (evt.type == 'keyup') {
                     if (!emitEnterKey) {
                        // clear buffered keycodes and return if not emitting enter key
                        this.bufferedKeycodes = "";
                        return;
                     }
                     // else, fall-through and append the entire (buffered) key sequence

                  } else { // buffer any keydown/keypress keycodes and just return
                     if (this.bufferedKeycodes) {
                        this.bufferedKeycodes += "|" + nextKeyCode;
                     } else {
                        this.bufferedKeycodes = nextKeyCode;
                     }
                     return;
                  }
               }

               if (this.bufferedKeycodes == null) { this.bufferedKeycodes = ""; }

               if (this.bufferedKeycodes.length) {
                  this.jsObjAddEventParam( eventNode, "keycodes", this.bufferedKeycodes + "|" + nextKeyCode );
               }
               else {
                  this.jsObjAddEventParam( eventNode, "keycodes", nextKeyCode );
               }

               this.observerService.notifyObservers("dejaclick:addKeyPressParams", eventNode);
               this.actEventNode = {};

               return;
            }
         } else if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED) {

            if (this.screenModeActive) {
               if (this.logger.debugprocess) { this.logger.logDebug( "onBrowserKeypress - screen event pending, ignoring this event" ); }
               return;
            }

            if (this.pendingKeystrokes && this.keystrokeCount === 0) {
               this.pendingKeystrokes = false;
               this.onChange( evt );  // trigger onChange action only after last dispatched keystroke event
               return;
            }
         }

         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"onBrowserKeypress" );
         return false;
      }
   },


   //------------------------------------------------
   // called for both replay and record
   onClick : function( evt )
   {
      try {
/*

         if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
            try {
               var mouseTarget = (evt.explicitOriginalTarget) ? evt.explicitOriginalTarget : evt.originalTarget;
               var nodeList = this.search.processXPath( mouseTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
               if (nodeList.length) {
                  return;  // ignore if target or ancestor node is a deja note
               }
            } catch(ex) {}
         }

         if (this.screenModeActive) {
            // deactivate screen keystroke capture mode
            this.pendingKeystrokes = false;
            return;
         }

         if (this.screenHasFocus) {
            // linux hack: clear embedded object focus flag now if not yet cleared
            this.onMouseBlurScreen();
            this.pendingKeystrokes = false;
         }
*/

         if (!this.docRoot) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onClick - Unable to get docRoot object, ignoring this event" ); }
            return;  // ignore this event
         }

         if (this.docRoot.baseURI.match(/about:/) || this.docRoot.baseURI.match(/chrome:/)) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onClick - no baseURI, ignoring this event" ); }
            return;  // ignore this event
         }


         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onClick - invalid runMode (1), ignoring this event" ); }
            if (!this.eventsEnabled) {
               if (!(evt.type=='click' && evt.which==3)) {  // allow right clicking for context menu
                  this.blockEvent( evt );
               }
            }
            return;
         }



         if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED) {
            if (this.screenModeActive) {
               if (this.logger.debugprocess) { this.logger.logDebug( "onClick - screen event pending, ignoring this event" ); }
               return;  // ignore click event during screen event dispatch
            }
            if (!this.pendingEvent || this.pendingEvent != "click") {
                if (this.logger.debugprocess) { this.logger.logDebug( "onClick - no pending click event, ignoring" ); }
                return;  // ignore this event
            }
            // otherwise...
            // @todo Define stopResponseTimeout
            //this.stopResponseTimeout();  // reset the event response timeout
            this.pendingEvent = null;
         }


         if (this.pendingKeystrokes && (this.lastKeyCode == this.DOM_VK_UP || this.lastKeyCode == this.DOM_VK_DOWN)) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onClick - keystrokes pending, ignoring this event" ); }
            this.pendingKeystrokes = false;
            return;  // ignore click event if keystrokes have been recorded
         }

         var elemTarget = this.getTargetElement( evt );
         if (elemTarget == null) {
//            this.eventsSkipped.push( 'skipped' );
            return;
         }

         // return, if we captured a click for the button
         if (this._runMode == constants.RUNMODE_RECORD && elemTarget.hasAttribute(this.BUTTON_CLICKED_ATTR)) {
            return;
         }

         var strTargetName = elemTarget.nodeName;
         if (strTargetName) {
            strTargetName = strTargetName.toUpperCase();
         }
         
         // Fix for Bug UXM-859. The "click" event on a span node triggers an additional submit
         // This causes replay to fail since the click causes the page to navigate to a new location
         // and the submit after that fails to locate the element on this new page. To get around 
         // this, added a check for the parent element for the span node. If it is a "button" element
         // then record the click on the button instead of the span. This causes the submit event
         // to not be recorded and the replay works
         if (strTargetName.toUpperCase() == "SPAN" && this._runMode == constants.RUNMODE_RECORD) {
            var parentNode = elemTarget.parentElement;
            while (parentNode.nodeName.toUpperCase() == "SPAN") {
               parentNode = parentNode.parentElement;
            }
            if (parentNode && parentNode.nodeName.toUpperCase() == "BUTTON") {
               elemTarget = parentNode;
               strTargetName = "BUTTON";
            }
         }
         
         // Ignore these non-interesting click events
         if ( strTargetName == 'HTML' ||
              strTargetName == 'BODY' ||
              strTargetName == 'TABLE') {
//              (elemTarget.ownerDocument instanceof ImageDocument && (strTargetName == 'BODY' || strTargetName == 'IMG'))) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onClick - ignoring non-interesting click event (" + elemTarget.nodeName + ")" ); }
            return;
         }

         // We also ignore any OPTION click events for the SELECT element because
         // of mozilla bug (#299961) which does not permit selection of multiple
         // OPTION items purely by using recreated mouse click events.  Instead, we
         // capture the onChange event that gets generated by the SELECT element,
         // then use special logic to recreate the selection state of each OPTION
         // item at the time the onChange event fired for the SELECT element.
         if (strTargetName == 'OPTION' || strTargetName == 'SELECT') {

            var selectNode = (strTargetName=='SELECT') ? elemTarget : elemTarget.parentNode;
            // AS Bug 6137: don't ignore if the outer SELECT element has a 'size'
            // attribute > 1 since some sites actually need to hear click events
            // on the select option list elements to trigger dynamic page changes.
            // And if the select list size is > 1, the browser will display it as
            // a scrolling list (not a drop menu), which is better able to handle
            // the individual click events properly.
            var processOptionClick = (selectNode.hasAttribute('size') && Number(selectNode.getAttribute('size')) > 1);

            if (selectNode.hasAttribute('multiple') || !processOptionClick) {
               if (this.logger.debugprocess) { this.logger.logDebug( "onClick - ignoring OPTION click" ); }
               return;
            }
         }

/*
         this.userNavigationEvent=null;
         this._setWaitType( WAITTYPE_PROCESSING );
*/
         // Handle special cases for clicked INPUT elements
         if (strTargetName=='INPUT' || strTargetName=='BUTTON') {
            var inputType = elemTarget.type.toLowerCase();

            // UXM-7329- Do not record submit if click was already recorded
            if(this._runMode == constants.RUNMODE_RECORD && inputType == 'submit' && elemTarget.form) {
                elemTarget.form.setAttribute(this.BUTTON_CLICKED_ATTR, 'true');
            }

            if ((evt.detail==1 && inputType=='checkbox') || (evt.detail==1 && inputType=='radio')) {
               // Set a flag to suppress capturing any followup onchange event whenever the target
               // element is a form input element, -AND- the user clicked the left mouse button
               // (evt.detail==1) on a checkbox or radio input element type, -OR- no mouse button
               // was clicked (evt.detail === 0) but the Space key was pressed (which means the browser
               // injected this click event automatically to trigger the checkbox/radio change event).
               // We set this flag because on replay this captured event will do the form input change
               // for us, so there's no need to separately capture and replay the onChange event.
               this.checkboxWasClicked = true;
            }

            if ((evt.detail === 0 || evt.detail==1) && (inputType=='submit' || inputType=='image')) {
               // We set a flag to suppress capturing any followup onsubmit event whenever the target element
               // is a form input element, -AND- the user clicked the left mouse button (evt.detail==1)
               // -OR- no mouse button was clicked (evt.detail === 0) on either a 'submit' or 'image'
               // input element type because on replay this captured event will do the form submission
               // for us, so there's no need to separately capture and replay the onSubmit event.
               this.submitWasClicked = true;
            }

            try {
               if (this.lastTargetElement && this.lastTargetElement.href && this.lastTargetElement.href.match(/javascript:.*\.submit\(\)/i)) {
                  // We suppress handling this click event entirely if the last event was a click
                  // and its href is a javascript call to the form submit function because webpage
                  // javascript (or the browser) may be injecting this click event programmatically
                  // to trigger form submission, but we already have captured the triggering event.
                  return;
               }
            }
            catch ( exx ) {
               // Ignore FF15+ memory destruction exception (a.k.a. hueyfix), and proceed w/ normal OnClick handling
               this.lastTargetElement = null;
            }

            if (this._runMode == constants.RUNMODE_RECORD && evt.detail === 0 && inputType=='checkbox' &&
                this.lastBrowserKeypress==this.DOM_VK_SPACE) {
               // We set a flag to suppress capturing any followup onchange events whenever the target element
               // is a form input element, -AND- the user clicked the left mouse button (evt.detail==1)
               // on a 'checkbox' input element type, -OR- no mouse button was clicked (evt.detail === 0)
               // but the Space key was pressed (which means the browser injected this click event
               // automatically to trigger the checkbox change event).  We set this flag because on
               // replay this captured event will do the checkbox change for us, so there's no need
               // to separately capture and replay the onChange event.
               this.checkboxWasClicked = true;
            }

            if (this._runMode == constants.RUNMODE_RECORD && evt.detail === 0 && inputType == 'image' &&
                (this.lastBrowserKeypress==this.DOM_VK_ENTER || this.lastBrowserKeypress==this.DOM_VK_RETURN || this.lastBrowserKeypress==this.DOM_VK_SPACE)) {
               this.submitWasClicked = true;
            }

            if (this._runMode == constants.RUNMODE_RECORD && evt.detail === 0 && inputType != 'image' && inputType != 'checkbox' &&
                (this.lastBrowserKeypress==this.DOM_VK_ENTER || this.lastBrowserKeypress==this.DOM_VK_RETURN || this.lastBrowserKeypress==this.DOM_VK_SPACE)) {
               // Major suckage...
               // When the enter key is pressed from inside a FORM, the browser automatically injects
               // a click event on the user's behalf targeting the input element with a type of submit.
               // However, when recording, there is sometimes an issue with the browser targeting the
               // correct INPUT element related to mozilla bug #260967.  In such cases, we must find
               // the correct target element to record in the script for proper playback.  Note: if the
               // input element is of type 'image' this is unnecessary because we are already positioned
               // on the correct input submission element.

               // ...first we get the parent FORM node...
               var formNode = elemTarget;
               var strNodeName = strTargetName;
               while (strNodeName != 'FORM' && strNodeName != 'BODY' && strNodeName != 'FRAMESET') {
                  formNode = formNode.parentNode;
                  strNodeName = formNode.nodeName;
                  if (strNodeName) {
                     strNodeName = strNodeName.toUpperCase();
                  }
               }
               if (strNodeName == 'BODY' || strNodeName == 'FRAMESET') {
                  // drat! mozilla bug #260967 - just grab the first form element and hope for the best.
                  var rootNode = formNode;
                  formNode = rootNode.getElementsByTagName('FORM')[0];
               }
               // ...now get the first child INPUT element with a type of submit or image
               // and hope for the best, given that we got at least one FORM element
               if (formNode) {
                  var newTarget = null;
                  var nodeList = formNode.getElementsByTagName('INPUT');
                  for (var t=0; t < nodeList.length; t++) {
                     inputType = nodeList[t].type.toLowerCase();
                     if (inputType=='submit') {
                        newTarget = nodeList[t];
                        break;
                     }
                  }

                  // update the target element (or keep the old one if invalid html with no submit/image inputs)
                  if (newTarget) {
                     elemTarget = newTarget;
                  }

                  this.submitWasClicked = true;
               }
            }
         }

         if (this._runMode == constants.RUNMODE_RECORD) {

            // Block any clicks, before the dom content load. Initially, this check on llbean.com caused
            // a spurious click event to be recorded. This was changed to wait for the document to complete.
            // However, on sites like www.news.com this was causing the record to wait a very long time.
            // Changed it back to check for loading, and it works for both scenarios
            if (document.readyState == "loading") {
               this.blockEvent( evt );
               return;
            }


            // Ignore any click event from the target whose id is "jsShowSourceButton"
            if (elemTarget.id === "jsShowSourceButton" && elemTarget.value === "Tag Found") {
               return;
            }
         
            // Ignore any spurious clicks after the dom load event.
            if (evt.timeStamp - this.domLoadTimestamp < this.IGNORE_TIMEDIFF ) {
               return;
            }
            
            // Some HTML tags don't seem to bubble their events up the propagation chain,
            // perhaps due to a bug/conflict with their surrounding tag.  So unless there
            // is a specific onclick event handler, we look for an alternate predecessor
            // node to target for the recording so that event replay doesn't hang.
            while (strTargetName!='BODY' &&
                   strTargetName!='FRAMESET' &&
                   this.isUselessTargetType( elemTarget, 'click' )) {
               elemTarget = elemTarget.parentNode;
            }

            var nodeName = elemTarget.nodeName.toUpperCase();
               if (nodeName == 'INPUT' || nodeName=='BUTTON') {
                  var inputType = elemTarget.type.toLowerCase();
		
                  if(inputType == 'submit' && elemTarget.form) {
                     elemTarget.form.setAttribute(this.BUTTON_CLICKED_ATTR, 'true');
                   }
                }
            // process hover trail if needed
            this.processHoverTrail( this.docRoot, elemTarget );
            // create the new 'click' mouse event
            if (!this.captureEvent( evt, elemTarget, 'click' )) {
               this.blockEvent( evt );
               return;  // exit now if unable to capture event
            }
            this.lastTargetElement = elemTarget;

            // clear any buffered keycodes to prevent Enter keystroke injection
            // (the click event will take care of any form submissions here)
            this.bufferedKeycodes = null;

            // clear any hover events and objects tracked for this event
            this.hoverEvents = [];
            this.hoverObjects = [];
            this.screenEvents = [];
            this.useMutationHints = false;
            this.pendingKeystrokes = false;
            this.pendingMousemove = false;
            this.pendingMousedrag = false;
            this.firstHoverTarget = null;
            this.lastHoverEvent = -1;

         } else {  // constants.RUNMODE_REPLAY or constants.RUNMODE_PAUSED

            // restore the recorded final cursor position or selection range of a textbox or textarea
            var textInputTarget = ((elemTarget instanceof HTMLInputElement && (elemTarget.type == "text" || elemTarget.type == "password")) ||
                                   elemTarget instanceof HTMLTextAreaElement);
            if (textInputTarget) {
               if (elemTarget.value) {
                  var selectionStart, selectionEnd;
                  selectionStart = this.actEventNode.eventparams.selectionStart;
                  if (selectionStart != null) {
                     selectionEnd = this.actEventNode.eventparams.selectionEnd;
                  } else {
                     // If no cursor/selection information was recorded,
                     // position the cursor at the end of the text.
                     selectionStart = selectionEnd = elemTarget.value.length;
                  }
                  try {
                     elemTarget.setSelectionRange(selectionStart, selectionEnd);
                  } catch(ex2) {}
               }
            }

            // track the event for display and replay handling
            this.eventsCaptured.push( 'click' );

         }

//         this.areWeThereYet();

         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"onClick" );
         return;
      }
   },


   //------------------------------------------------
   // called for both replay and record
   onChange : function( evt )
   {
      var eventNode;
      try {
/*
         if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
            try {
               var mouseTarget = (evt.explicitOriginalTarget) ? evt.explicitOriginalTarget : evt.originalTarget;
               var nodeList = this.search.processXPath( mouseTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
               if (nodeList.length) {
                  return;  // ignore if target or ancestor node is a deja note
               }
            } catch(ex) {}
         }

         if (this.screenModeActive) {
            // deactivate screen keystroke capture mode
            this.pendingKeystrokes = false;
            return;
         }
*/

         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onChange - invalid runMode (1), ignoring this event" ); }
            if (!this.eventsEnabled) {
               this.blockEvent( evt );
            }
            return;
         }
         
         // Fix for Bug-253. The actual text input value for an earlier keypress event
         // is recorded.
         if (this._runMode == constants.RUNMODE_RECORD && this.submitObj && this.actEventNode) {
            this.jsObjAddEventParam( this.actEventNode, "value", this.submitObj.target.value );
            this.observerService.notifyObservers("dejaclick:addKeyPressParams", this.actEventNode);
         }
         
         if (this.pendingKeystrokes) {
            if (this.bypassKeystrokes) {

               if (this.logger.debugprocess) { this.logger.logDebug( "onChange - keystroke recording was bypassed, capturing final event value here" ); }
               this.jsObjSetEventParam(this.actEventNode, "value", evt.target.value);

               this.actEventNode.value = evt.target.value;
               this.bypassKeystrokes = false;
            } else {
               if (this.logger.debugprocess) { this.logger.logDebug( "onChange - keystrokes already recorded, ignoring this event" ); }
            }
          
            // Fix for Bug Deja-233. The click on the form element was recorded, even the user wasnt submitting the form.
            // Recording the click event only when the enter key was pressed and the onchange was received following that.
            if (this._runMode == constants.RUNMODE_RECORD) {
               if (this.submitObj && !this.submitObj.elem.hasAttribute(this.BUTTON_CLICKED_ATTR) && !this.submitWasClicked) {
                  this.submitWasClicked = true;
                  this.submitObj.elem.setAttribute(this.BUTTON_CLICKED_ATTR, 'true');
                  this.captureEvent( evt, this.submitObj.elem, 'click' );
                  this.submitObj = null;
                  return;
               }
            }
            
            this.pendingKeystrokes = false;
            return;  // ignore change event if keystrokes have been recorded
         }
 
         if (this.logger.debugprocess) { this.logger.logDebug( "processing onChange event" ); }

         if (!this.docRoot) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onChange - Unable to get docRoot object, ignoring this event" ); }
            return;  // ignore this event
         }

         if (this.docRoot.baseURI.match(/about:/)) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onChange - no baseURI, ignoring this event" ); }
            return;  // ignore this event
         }
         if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED) {
            if (this.screenModeActive) {
               if (this.logger.debugprocess) { this.logger.logDebug( "onChange - screen event pending, ignoring this event" ); }
               return;  // ignore change event during screen event dispatch
            }
            if (!this.pendingEvent || this.pendingEvent != "change") {
               if (this.logger.debugprocess) { this.logger.logDebug( "onChange - no pending change event, ignoring" ); }
               // @todo Define areWeThereYet
               //this.areWeThereYet();
               return;  // ignore this event
            }
            // otherwise...
            // @todo Define stopResponseTimeout
            //this.stopResponseTimeout();  // reset the event response timeout
            this.pendingEvent = null;
         }

/*
         // @todo Handle events that should be ignored based on the attributes of the previous event.
         if (this._runMode == constants.RUNMODE_RECORD && this.actEventNode.getAttribute('type') == 'click' && this.getThinkTime() < 250) {
            // Special Case:  If a click event was recorded just prior to our hearing a
            // change event (within a quarter sec) then ignore (don't record) the change
            // event because it will be injected by the browser automatically as a result of
            // replaying the click event (that is, it's safe to assume that the detected
            // change event happened too quickly for a user to have done it manually).
            return;
         }
*/

         this.userNavigationEvent=null;
         this.embeddedObjectEvent=null;
         this.submitObj = null;

         var elemTarget = this.getTargetElement( evt );
         if (elemTarget == null) {
            this.eventsSkipped.push( 'skipped' );
            return;
         }
         
         var inputType = elemTarget.type.toLowerCase();
         if (this._runMode == constants.RUNMODE_RECORD && this.checkboxWasClicked && inputType == 'checkbox') {
            // must exit now (don't record event) if checkbox input element was previously clicked
            this.checkboxWasClicked = false;  // reset the value
            return;
         }

         if (this._runMode == constants.RUNMODE_RECORD) {

            if (document.readyState == "loading") {
               this.blockEvent( evt );
               return;
            }

            // Unlike Firefox, we get a change event for radio button click.
            // Ignore these. Note : The arrow and tab on radio buttons is not
            // supported on Chrome
            if (inputType == 'radio') {
               return;
            }

            // determine if this event requires waiting for scripted content
            if (elemTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT )) {
               this.scriptedContent = true;
            }

            // Take care of a little final housekeeping for the previous event
            this.setReplayHints( false );
/*
            // Create a new action element if the current user action has no previous events
            // but only when there is at least one recorded event (see onContentLoaded)
            // or when appending to an existing recording.
            if (this.actionEvents === 0 && this.eventsCaptured && this.eventsCaptured.length != 0) {
               var actionNode = this.domTreeInsertAction(this.actTreeRoot, "browser");
               // add a new treeview action node
               this.updateTreeViews( this.addTreeViewNode( actionNode, this.subscriptNum, true ) );
            }
*/
            // process hover trail if needed
            this.processHoverTrail( this.docRoot, elemTarget );

            eventNode = this.actEventNode;
            eventNode.type = "change";
            var strTargetName = elemTarget.nodeName;
            if (strTargetName) {
               strTargetName = strTargetName.toUpperCase();
            }
            if ( strTargetName == 'SELECT' ) {
               // For SELECT elements, we save the state of each associated OPTION value
               // so we can reset its state upon replay.  This is due to an unfortunate
               // bug in mozilla (299961) whereby injected click events cannot recreate
               // the range-select or multi-select list behavior that happens interactively.
               // Note: we save the selection state of each indexed list item in 3 parts:
               // the 1st part is the selected/unselected state (boolean) of the list item
               // which becomes the actual value of the param itself; the 2nd part is the
               // displayed label (itemname) for the list item which is attached as an
               // attribute; the 3rd part is the actual value (itemval) associated with
               // the item.  During replay its possible that the itemname and itemval
               // could change on the website.  Also, all three data items may appear
               // more than once in the droplist, so during replay a user-selected pref
               // setting is checked to determine which type of selection is desired by
               // default.  Note also that older versions only recorded the true/false
               // state of each item, yet they may still be replayed in newer versions.
               eventNode.options = [];
               for (var i=0; i < elemTarget.length; i++) {

                  var paramNodeItem = this.jsObjAddEventParam(eventNode, "option" + i, elemTarget.options[i].selected);
                  var paramNodes = eventNode.eventparams.param;
                  var paramNode = paramNodes[paramNodeItem];
                  paramNode["@itemname"] = elemTarget.options[i].textContent;
                  paramNode["@itemval"] = elemTarget.options[i].value;
               }

            } else {
/*
               // For file INPUT elements, we save the contents of
               // the selected file(s) so we can recreate them on replay.
               // This requires the HTML5 File API (implemented in FF 3.6+)
               if ( strTargetName == 'INPUT' ) {
                  var inputType = elemTarget.type.toLowerCase();
                  if ( inputType == 'file' ) {

                     var inputFiles = elemTarget.files;
                     if (inputFiles && CI.nsIDOMFileReader) {

                        // warn the user that recording file inputs can increase
                        // the script size beyond the upload limit of 10MB
                        this.promptFileInputChanged();

                        var filelistid = this.importFileList( inputFiles, constants.DC_UPLOAD_FILELIST_PREFIX );
                        if (!filelistid) {
                           if (this.logger.debugprocess)  this.logger.logDebug( "onChange - unable to import file list" );
                           return;
                        }

                        // the event can now reference the newly created filelist
                        this.domTreeAddEventParam( eventNode, "filelistref", filelistid );
                     }
                  }
               }

               // otherwise, we just save the target element's value
               this.actEventNode.value =  elemTarget.value;
*/
               this.jsObjAddEventParam(eventNode, "value", elemTarget.value);
            }

            var searchTargets = this.addElementSearchTargets( eventNode, elemTarget );
            // attach element search targets to this event node
            if (!searchTargets) {
               // In rare cases, if we are unable to insert our targets,
               // it may lead to displaying <???> as the event target in
               // the sidebar, which cannot be replayed.  So just block.
               this.blockEvent( evt );

               if ( strTargetName != 'SELECT' ) {
                  // reset element value to force user to reenter it
                  elemTarget.value = "";
               }
/*
               // remove the inserted event element
               this.actActionNode.removeChild( eventNode );

               this._observerService.notifyObservers( evt, "dejaclick:eventblocked", "change" );
*/
               return;
            }

            eventNode.targets = searchTargets;
            eventNode.docURL = document.URL;
            eventNode.docTitle = document.title;
            eventNode.eventsSkipped = this.eventsSkipped;
            var descrip = this.getTruncatedDescription (elemTarget, eventNode.type);
            if (descrip) {
               this.jsObjAddEventAttribute(eventNode, "description", descrip);
            }
            if(document.getElementById("dejaclick-is-singlepage")|| elemTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT )) {
               this.jsObjAddEventAttribute(eventNode, "optimizedmatch", "false");
               this.jsObjAddEventAttribute(eventNode, this.DC_OPTID_USEMATCHTYPES, "ep");
            }
            this.observerService.notifyObservers("dejaclick:addEvent", eventNode);
            this.actEventNode = {};

            // clear any hover events and objects tracked for this event
            this.hoverEvents = [];
            this.hoverObjects = [];
            this.screenEvents = [];
            this.useMutationHints = false;
            this.pendingKeystrokes = false;
            this.pendingMousemove = false;
            this.pendingMousedrag = false;
            this.firstHoverTarget = null;
            this.lastHoverEvent = -1;


         } else {  // constants.RUNMODE_REPLAY or constants.RUNMODE_PAUSED
/*
            if (this.mutationsRecorded) {
               this._setWaitType( WAITTYPE_MUTATIONS );
            }
            if (this.pendingLocations) {
               this._setWaitType( WAITTYPE_LOCATIONS );
            }

            // give focus to this browser's window now
            // get the browser node associated with the currently focused tab
            if (browserNode != this.lastFocusedBrowser) {
               this.setBrowserWindowFocus( browserNode );
            }
*/
         }

         // @todo Define areWeThereYet
         //this.areWeThereYet();
         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"onChange" );
         return;
      }
   },


   /**
    * Handler for focus events.
    * Called for both replay and record
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Event} evt A focus event.
    * @param {boolean=} aForceRecording If true, record the event
    *    regardless of focus event preference settings.
    */
   onFocus : function( evt, aForceRecording )
   {
      try {
/*
         if (this.screenModeActive) {
            // deactivate screen keystroke capture mode
            this.pendingKeystrokes = false;
            return;
         }
*/

         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            return;  // bad run mode, just exit quietly
         }

         if (this._runMode == constants.RUNMODE_RECORD && !aForceRecording && !this.recordFocusEvents) {
            return;  // skip recording this focus event
         }

         if (this.logger.debugprocess) { this.logger.logDebug( "processing onFocus event" ); }


         if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED) {
            if (!this.pendingEvent || this.pendingEvent != "focus") {
               if (this.logger.debugprocess) { this.logger.logDebug( "onFocus - no pending focus event, ignoring" ); }
               // @todo Define areWeThereYet
               //this.areWeThereYet();
               return;  // ignore this event
            }
            // otherwise...
            // @todo Define stopResponseTimeout
            //this.stopResponseTimeout();  // reset the event response timeout
            this.pendingEvent = null;
         }

         if (this._runMode == constants.RUNMODE_RECORD && this.eventsCaptured && this.eventsCaptured.length === 0) {
            // Special Case:  If this is the first event and it occurs on an already loaded
            // page, just exit.  The first recorded event should not be a focus event.
            return;
         }

         var eventNode = {};

/*
         // If the event is a Window Focus event, we add the tabfocus event
         // and send the message to the service.
         if (this._runMode == constants.RUNMODE_RECORD && evt.target instanceof Window) {
            eventNode.type = "tabfocus";
            eventNode.docURL = document.URL;
            eventNode.docTitle = document.title;
            this.observerService.notifyObservers("dejaclick:addEvent", eventNode);
            return;
         }
*/
         if (!this.docRoot) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onFocus - Unable to get docRoot object, ignoring this event" ); }
            return;  // ignore this event
         }

         if (this.docRoot.baseURI.match(/^about:|^chrome:/)) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onFocus - no baseURI, ignoring this event" ); }
            return;  // ignore this event
         }

         var elemTarget = this.getTargetElement( evt );
         if (elemTarget == null) {
            this.eventsSkipped.push( 'skipped' );
            return;
         }

         var strTargetName = elemTarget.nodeName;
         if (strTargetName) {
            strTargetName = strTargetName.toUpperCase();
         }

         // Ignore these non-interesting focus events
         if ( strTargetName == '#DOCUMENT' ||
              strTargetName == 'HTML' ||
              strTargetName == 'BODY' ||
              strTargetName == 'TABLE') {
//              (elemTarget.ownerDocument instanceof ImageDocument && (strTargetName == 'BODY' || strTargetName == 'IMG'))) {
            if (this.logger.debugprocess) { 
               this.logger.logDebug( "onFocus - ignoring non-interesting focus event (" + elemTarget.nodeName + ")" ); 
            }

            if (this._runMode == constants.RUNMODE_REPLAY) {
               this.eventsSkipped.push( 'skipped' );  // safety feature
//               this.areWeThereYet();
            }
            return;
         }

         // We also ignore any OBJECT or EMBED focus events, as they cannot be properly
         // recorded (they run inside a separate OS process), but we also prompt the user
         // the first time, before continuing.

         var isSVGDoc=false;  // ignore any instanceof check errors here
         try {
            isSVGDoc = (elemTarget.ownerDocument instanceof SVGDocument);
         } catch(ex) {}

         if ( strTargetName == 'EMBED' || strTargetName == 'OBJECT' || isSVGDoc ) {
            if (this._runMode == constants.RUNMODE_REPLAY) {
               this.eventsSkipped.push( 'skipped' );  // safety feature
//               this.areWeThereYet();
            }
            return;  // ignore the event
         }

         // check for and ignore any focus events occurring on a deja note
         // Note: this block was moved from the top since we can get focus events
         // coming in from a number of sources, including setting browser window
         // focus after an injected event, so we let the filters above hit first.
/*
         if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
            try {
               var mouseTarget = (evt.explicitOriginalTarget) ? evt.explicitOriginalTarget : evt.originalTarget;
               var nodeList = this.search.processXPath( mouseTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
               if (nodeList.length) {
                  return;  // ignore if target or ancestor node is a deja note
               }
            } catch(ex) {}
         }

         this.embeddedObjectEvent=null;
         this._setWaitType( WAITTYPE_PROCESSING );
*/
         // track the event for display and replay handling
         this.eventsCaptured.push( 'focus' );

         if (this._runMode == constants.RUNMODE_RECORD) {

            // determine if this event requires waiting for scripted content
            if (elemTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT )) {
               this.scriptedContent = true;
            }

            // Take care of a little final housekeeping for the previous event
            this.setReplayHints( false );

            var searchTargets = this.addElementSearchTargets( eventNode, elemTarget );
            // attach document and element search targets to this event node
            if (!searchTargets) {
               // In rare cases, if we are unable to insert our targets,
               // it may lead to displaying <???> as the event target in
               // the sidebar, which cannot be replayed.  So just block.
               this.blockEvent( evt );
/*
               // remove the inserted event element
               this.actActionNode.removeChild( eventNode );

               this._observerService.notifyObservers( evt, "dejaclick:eventblocked", "focus" );
*/
               return;
            }
            eventNode.type = "focus";
            eventNode.targets = searchTargets;
            eventNode.docURL = document.URL;
            eventNode.docTitle = document.title;

            if(document.getElementById("dejaclick-is-singlepage")) {
               this.jsObjAddEventAttribute(eventNode, "optimizedmatch", "false");
               this.jsObjAddEventAttribute(eventNode, this.DC_OPTID_USEMATCHTYPES, "ep");
            }
            this.observerService.notifyObservers("dejaclick:addEvent", eventNode);
            this.lastTargetElement = elemTarget;
            this.actEventNode = {};

            // clear any hover events and objects tracked for this event
            this.hoverEvents = [];
            this.hoverObjects = [];
            this.screenEvents = [];
            this.useMutationHints = false;
            this.pendingKeystrokes = false;
            this.pendingMousemove = false;
            this.pendingMousedrag = false;
            this.firstHoverTarget = null;
            this.lastHoverEvent = -1;


         } else {  // constants.RUNMODE_REPLAY or constants.RUNMODE_PAUSED
/*
            if (this.pendingMutations ) {
               this._setWaitType( WAITTYPE_MUTATIONS );
            }
            if (this.pendingLocations) {
               this._setWaitType( WAITTYPE_LOCATIONS );
            }

            // give focus to this browser's window now
            // get the browser node associated with the currently focused tab
            if (browserNode != this.lastFocusedBrowser) {
               this.setBrowserWindowFocus( browserNode );
            }
*/
         }
/*

         this.areWeThereYet();
*/
         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"onFocus" );
         return;
      }
   },


   /**
    * Handler for submit events.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Event} evt A submit event.
    * @param {boolean=} aDirectMode ???.
    */
   onSubmit : function( evt, aDirectMode )
   {
      try {

/*
         if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
            try {
               var mouseTarget = (evt.explicitOriginalTarget) ? evt.explicitOriginalTarget : evt.originalTarget;
               var nodeList = this.search.processXPath( mouseTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
               if (nodeList.length) {
                  return;  // ignore if target or ancestor node is a deja note
               }
            } catch(ex) {}
         }

         if (this.screenModeActive) {
            // deactivate screen keystroke capture mode
            this.pendingKeystrokes = false;
            return;
         }
*/
         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onSubmit - invalid runMode (1), ignoring this event" ); }
            if (!this.eventsEnabled) {
               this.blockEvent( evt );
            }
            return;
         }

         if (this.logger.debugprocess) { this.logger.logDebug( "processing onSubmit event" ); }

         if (!this.docRoot) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onSubmit - Unable to get docRoot object, ignoring this event" ); }
            return;  // ignore this event
         }

         if (this.docRoot.baseURI.match(/about:/)) {
            if (this.logger.debugprocess) { this.logger.logDebug( "onSubmit - no baseURI, ignoring this event" ); }
            return;
         }

/*
         // This is part of an ugly hack to get around mozilla bug #282266.
         // The offsetX and offsetY params are used by modifyHttpPostRequest
         // to correct a nasty post data bug during an HTTP POST on replay.
         // Note: only load up submitOffsetCoords if not yet loaded, which
         // may happen in the onClick event handler first.
         if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED && this.submitOffsetCoords == null) {
            var offsetX = this.domTreeGetEventParam(this.actEventNode, "offsetX");
            var offsetY = this.domTreeGetEventParam(this.actEventNode, "offsetY");
            if (offsetX != null) {
               this.submitOffsetCoords = { 'offsetX' : offsetX,
                                          'offsetY' : offsetY };
            }
         }

         this.userNavigationEvent=null;
         this.embeddedObjectEvent=null;

         // note: for onSubmit, the above actions must come before the following pendingEvent check

         if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED) {
            if (this.screenModeActive) {
               if (this.logger.debugprocess)  this.logger.logDebug( "onSubmit - screen event pending, ignoring this event" );
               return;  // ignore submit event during screen event dispatch
            }
            if (!this.pendingEvent || this.pendingEvent != "submit") {
                if (this.logger.debugprocess)  this.logger.logDebug( "onSubmit - no pending submit event, ignoring" );
                return;  // ignore this event
            }
            // otherwise...
            this.stopResponseTimeout();  // reset the event response timeout
            this.pendingEvent = null;
         }
*/

         if (this._runMode == constants.RUNMODE_RECORD) {

            if (document.readyState == "loading") {
               this.blockEvent( evt );
               return;
            }

/*
            if (this.actEventNode.getAttribute('type') == 'click' && this.getThinkTime() < 250) {
               // Special Case:  If a click event was recorded just prior to our hearing a
               // submit event (within a quarter sec) then ignore (don't record) the submit
               // event because it will be injected by Firefox automatically as a result of
               // replaying the click event (that is, it's safe to assume that the original
               // click event had happened too quickly for a user to have done it manually).
               return;
            }
*/
         }


         var elemTarget = this.getTargetElement( evt );
         if (elemTarget == null) {
            this.eventsSkipped.push( 'skipped' );
            return;
         }

         if (this._runMode == constants.RUNMODE_RECORD) {			
            // Do not record submit if click was already recorded
            if (elemTarget.hasAttribute(this.BUTTON_CLICKED_ATTR)) {
               return;
            }
         }

         if (this.submitWasClicked) {
            // must exit now (don't record the event) if a submit input element or image was
            // previously clicked (either by the user or automatically injected by the browser).
            // Thus, we only record the actual submit event when the submit is performed via
            // web page code.
            //this.submitWasClicked = false;
            return;
         }
/*
         this._setWaitType( WAITTYPE_PROCESSING );
*/
         // track the event for display and replay handling
         this.eventsCaptured.push( 'submit' );
/*
         // get the index number of the associated browser (must occur before action insert)
         var browserNode = this.getBrowserNodeFromDocNode( docRoot );
         var browserIndex = this.getBrowserIndex( browserNode );
*/
         if (this._runMode == constants.RUNMODE_RECORD) {

            // determine if this event requires waiting for scripted content
            if (elemTarget.hasAttribute( constants.DC_SCRIPTEDCONTENT )) {
               this.scriptedContent = true;
            }

            // Take care of a little final housekeeping for the previous event
            this.setReplayHints( false );


            // process hover trail if needed
            this.processHoverTrail( this.docRoot, elemTarget );

            // create a new event element
            var eventNode = this.actEventNode;
            eventNode.type = "submit";
/*
            this._updateRunState();  // let observers update their recorded event
*/
            // save the target element's value
            this.jsObjAddEventParam(eventNode, "value", elemTarget.value);

            if (aDirectMode) {
               // performs a direct submit() call on the form element during replay
               this.jsObjAddEventParam(eventNode, "submitmode", "direct");
            } else {
               // injects a submit event using the target node during replay
               this.jsObjAddEventParam(eventNode, "submitmode", "event");
            }

            var searchTargets = this.addElementSearchTargets( eventNode, elemTarget );
            // attach document and element search targets to this event node
            if (!searchTargets) {
               // In rare cases, if we are unable to insert our targets,
               // it may lead to displaying <???> as the event target in
               // the sidebar, which cannot be replayed.  So just block.
               this.blockEvent( evt );
/*
               // remove the inserted event element
               this.actActionNode.removeChild( eventNode );

               this._observerService.notifyObservers( evt, "dejaclick:eventblocked", "submit" );
*/
               return;
            }

            eventNode.targets = searchTargets;
            eventNode.docURL = document.URL;
            eventNode.docTitle = document.title;
            if(document.getElementById("dejaclick-is-singlepage")) {
               this.jsObjAddEventAttribute(eventNode, "optimizedmatch", "false");
               this.jsObjAddEventAttribute(eventNode, this.DC_OPTID_USEMATCHTYPES, "ep");
            }
            this.observerService.notifyObservers("dejaclick:addEvent", eventNode);
            this.actEventNode = {};

            this.lastTargetElement = elemTarget;

            // clear any buffered keycodes to prevent Enter keystroke injection
            // (the submit event will take care of any form submissions here)
            this.bufferedKeycodes = null;

            // clear any hover events and objects tracked for this event
            this.hoverEvents = [];
            this.hoverObjects = [];
            this.screenEvents = [];
            this.useMutationHints = false;
            this.pendingKeystrokes = false;
            this.pendingMousemove = false;
            this.pendingMousedrag = false;
            this.firstHoverTarget = null;
            this.lastHoverEvent = -1;
/*

         } else {  // constants.RUNMODE_REPLAY or constants.RUNMODE_PAUSED

            if (this.mutationsRecorded) {
               this._setWaitType( WAITTYPE_MUTATIONS );
            }
            if (this.pendingLocations) {
               this._setWaitType( WAITTYPE_LOCATIONS );
            }
            // give focus to this browser's window now
            this.setBrowserWindowFocus( browserNode );

            //this.replayNextEvent();
*/
         }
/*

         this.areWeThereYet();
*/
         return;

      } catch( e ) {
         this.blockEvent( evt );
         this.reportException( e, this.DCMODULE+"onSubmit" );
         return;
      }
   },


   //------------------------------------------------
   onMouseOver : function( evt )
   {
      try {

         if (this.logger.debugprocess) {
            this.logger.logDebug( "onMouseOver - Processing" );
         }

/*
         if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
            try {
               var mouseTarget = (evt.explicitOriginalTarget) ? evt.explicitOriginalTarget : evt.originalTarget;
               var nodeList = this.search.processXPath( mouseTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
               if (nodeList.length) {
                  return;  // ignore if target or ancestor node is a deja note
               }
            } catch(ex) {}
         }
*/
         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            if (!this.eventsEnabled) {
               this.blockEvent( evt );
            }
            return;
         }

         var elemTarget = this.getTargetElement( evt );

         // force lowercase due to Moz bug fix 468692
         //if ( elemTarget == null || elemTarget.localName == 'HTML') {
         if ( elemTarget == null || elemTarget.localName.toLowerCase() == "html") {
            return;
         }

         // lookup the object in our hoverObjects list
         var found=false, hoverObjIndex, hObj;
         for (var i=0; i < this.hoverObjects.length; i++) {
            hObj = this.hoverObjects[i];
            // only process matching elemTarget once, since web sites may be trying to
            // inject their own mouseover events on the same element at the same time
            if (hObj.target==elemTarget && !hObj.processed) {
               hObj.processed = true;
               hoverObjIndex = i;
               found=true;
               break;
            }
         }
         if (this._runMode == constants.RUNMODE_RECORD) {

            if (document.readyState == "loading") {
               this.blockEvent( evt );
               return;
            }

            if (!found) {
               // hover object not found in list, so add it now (we don't want dupes)
               var hoverEventID = (elemTarget.hasAttribute(constants.DC_HOVEREVENTID)) ? elemTarget.getAttribute(constants.DC_HOVEREVENTID) : -1;
               var hoverObj = {  target     : elemTarget,
                                 onmouse    : elemTarget.hasAttribute( constants.DC_HOVERCONTENT ),
                                 hoverevent : Number(hoverEventID),
                                 mutations  : 0,
                                 button     : (evt.button !== undefined) ? evt.button : 0,
                                 detail     : (evt.detail !== undefined) ? evt.detail : 0,
                                 screenX    : (evt.screenX !== undefined) ? evt.screenX : 0,
                                 screenY    : (evt.screenY !== undefined) ? evt.screenY : 0,
                                 clientX    : (evt.clientX !== undefined) ? evt.clientX : 0,
                                 altKey     : evt.altKey,
                                 ctrlKey    : evt.ctrlKey,
                                 metaKey    : evt.metaKey,
                                 shiftKey   : evt.shiftKey };
               // store the hover object
               this.hoverObjects.push( hoverObj );
               hoverObjIndex = this.hoverObjects.length-1;

               // store the event reference
               this.hoverEvents.push( hoverObjIndex );
               this.lastHoverEvent = this.hoverEvents.length-1;

            } else {

               this.hoverEvents.push( hoverObjIndex );
               this.lastHoverEvent = this.hoverEvents.length-1;
            }

         } else {  // constants.RUNMODE_REPLAY or constants.RUNMODE_PAUSED mode
            if (found) {
               // we only process the event if its one of our own replayed
               // events, where the object was created via replayNextEvent
               this.eventsCaptured.push( 'hover' );
/*
               if (this.mutationsRecorded) {
                  this._setWaitType( WAITTYPE_MUTATIONS );
               }
               if (this.pendingLocations) {
                  this._setWaitType( WAITTYPE_LOCATIONS );
               }

               this.replayNextEvent();
*/
            }
         }
/*
         this.areWeThereYet();
*/
         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"onMouseOver" );
         return;
      }
   },


   /**
    * Handle a mouse down event. This is only used for embedded objects,
    * because click events on embedded objects do not bubble in Chrome.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Event} evt A mousedown event.
    */
   onMouseDown: function (evt) {
      var target, tag;
      try {
         if ((this.docRoot !== null) &&
               (this._runMode === constants.RUNMODE_RECORD)) {
            target = this.getTargetElement(evt);
            if (target !== null) {
               tag = target.tagName;

               var isSVGDoc = false;
               try {
                  // ignore any errors from this check
                  isSVGDoc = (this.docRoot instanceof SVGDocument);
               } catch (ex1) {}

               if ((tag === 'EMBED') ||
                     (tag === 'OBJECT') ||
                     isSVGDoc) {
                  this.observerService.notifyObservers('dejaclick:objectClick',
                     null);
               }
            }
         }
      } catch (ex) {
         this.reportException(ex, this.DCMODULE + 'onMouseDown');
      }
   },


   /**------------------------------------------------
    * Process events for replay.
    * Called in response to a dejaclick:dispatchevent notification.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!{
    *     searchId: integer,
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEventInfo Details of the event to be replayed.
    */
   processEvents : function( aEventInfo )
   {
      var targetElement;
      try {

         if (this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            return;
         }

         // if we dont have a target node to dispatch to, return;
         if (!this.targetElements.hasOwnProperty(aEventInfo.searchId)) {
            return;
         }
         targetElement = this.targetElements[aEventInfo.searchId];

         if (this.logger.debugprocess) {
            this.logger.logDebug( "Processing Events" );
         }

         this.teardownAsyncTimers();
         this.mutationsCount = 0;
         this.mutationsCountLast = 0;

         if (aEventInfo.attributes.hasOwnProperty('highlight')) {
            this.applyElementStyle(targetElement,
               aEventInfo.attributes.highlight);
         }
         this.actEventNode = aEventInfo;

         switch (aEventInfo.type) {
         case 'click':
         case 'move':
         case 'drag':
            this.replayClickEvent(targetElement, aEventInfo);
            break;

         case 'change':
            this.replayChangeEvent(targetElement, aEventInfo);
            break;

         case 'focus':
            this.replayFocusEvent(targetElement, aEventInfo);
            break;

         case 'submit':
            this.replaySubmitEvent(targetElement, aEventInfo);
            break;

         case 'hover':
            this.replayHoverEvent(targetElement, aEventInfo);
            break;

         default:
            this.logger.logFailure('Attempt to replay unknown event type: ' +
               aEventInfo.type);
            break;
         }

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"processEvents" );
      }
   },

   /**
    * Apply a new style to the target element. This only applies if a
    * target element on this page has already been highlighted during
    * replay.
    * @this {!DejaClick.DejaServiceCS}
    * @param {{ searchId: integer, style: string }} aDetails
    *    Identifier of the target to be styled and the style to apply to it.
    */
   applyStyleToTarget: function (aDetails) {
      try {
         if (this.targetElements.hasOwnProperty(aDetails.searchId)) {
            this.applyElementStyle(this.targetElements[aDetails.searchId],
               aDetails.style);
         }
      } catch (ex) {
         this.reportException(ex, this.DCMODULE + 'applyStyleToTarget');
      }
   },

   /**
    * Name of attribute in which to store original value of style attribute.
    * @const
    */
   PREVIOUS_STYLE_ATTR: 'dcprevstyle',

   /**
    * Add style to an element with which DejaClick is interacting.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aElement The element to be styled.
    * @param {string} aStyle The style to add to the element. If
    *    aStyle is empty, this will revert the element to the style it
    *    had before DejaClick made any modifications.
    */
   applyElementStyle: function (aElement, aStyle) {
      var prevStyle;
      if ((aElement.tagName === 'EMBED') || (aElement.tagName === 'OBJECT')) {
         // Do not highlight plugins.
         return;
      }

      if (aStyle.length !== 0) {
         // Add the new styling to the original (non-DejaClick) style.
         if (aElement.hasAttribute(this.PREVIOUS_STYLE_ATTR)) {
            prevStyle = aElement.getAttribute(this.PREVIOUS_STYLE_ATTR);
         } else if (aElement.hasAttribute('style')) {
            prevStyle = aElement.getAttribute('style');
         } else {
            prevStyle = '';
         }
         // Save a copy of the original style.
         aElement.setAttribute(this.PREVIOUS_STYLE_ATTR, prevStyle);
         if ((prevStyle.length !== 0) &&
               (prevStyle[prevStyle.length - 1] !== ';')) {
            prevStyle += ';';
         }
         aElement.setAttribute('style', prevStyle + aStyle);

      } else if (aElement.hasAttribute(this.PREVIOUS_STYLE_ATTR)) {
         // No new style. Revert to previous styling.
         prevStyle = aElement.getAttribute(this.PREVIOUS_STYLE_ATTR);
         aElement.removeAttribute(this.PREVIOUS_STYLE_ATTR);
         if (prevStyle.length === 0) {
            aElement.removeAttribute('style');
         } else {
            aElement.setAttribute('style', prevStyle);
         }
      }
   },

   /**
    * List of element tags that do not require a mouseover event when
    * replaying a click, move or drag.
    * @const
    */
   NON_MOUSEOVER_ELEMENTS: {
      A: true,
      AREA: true,
      FONT: true,
      IMG: true,
      INPUT: true,
      SPAN: true
   },

   /**
    * Initiate replay of a click, move or drag DejaClick event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be clicked, moved or dragged.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    */
   replayClickEvent: function (aTarget, aEvent) {
      // @todo Push aTarget onto eventsTracked?
      // @todo Inject different DOM events for screen events.
      var queue, attrs;
      queue = [
         this.createMouseEvent('mousedown', aEvent),
         this.createFocusEvent('focus', aEvent),
         this.createMouseEvent('mouseup', aEvent),
         this.createMouseEvent('click', aEvent)
      ];
      if (!this.NON_MOUSEOVER_ELEMENTS.hasOwnProperty(aTarget.nodeName)) {
         // This is a bit of an experiment...  Some click-event
         // targets want to receive a mouseover event just before the
         // mousedown + click events, while others do not.  At the
         // moment, through trial and error, we only dispatch a
         // mouseover event if the target element is NOT one of the
         // above element types.
         queue.unshift(this.createMouseEvent('mouseover', aEvent));
      }
      /** Cast type of attributes object to silence a Closure warning.
       * @type {!{dispatchDelay: integer}}
       */
      (attrs = aEvent.attributes);
      this.dispatchState = {
         target: aTarget,
         event: aEvent,
         queue: queue,
         initialQueueLength: queue.length,
         delay: attrs.hasOwnProperty('dispatchDelay') ? attrs.dispatchDelay : 0
      };
      this._setTimeout(this.dispatchEvents.bind(this), this.dispatchState.delay);
   },

   /**
    * Initiate replay of a focus DejaClick event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be focused.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    */
   replayFocusEvent: function (aTarget, aEvent) {
      // @todo Push aTarget onto eventsTracked?
      var delay = aEvent.attributes.dispatchDelay;
      this.dispatchState = {
         target: aTarget,
         event: aEvent,
         queue: [this.createFocusEvent('focus', aEvent)],
         initialQueueLength: 1,
         delay: delay
      };
      this._setTimeout(this.dispatchEvents.bind(this), delay);
   },

   /**
    * Initiate replay of a submit DejaClick event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be submitted.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    */
   replaySubmitEvent: function (aTarget, aEvent) {
      // @todo Push aTarget onto eventsTracked?
      var delay = aEvent.attributes.dispatchDelay;
      this.dispatchState = {
         target: aTarget,
         event: aEvent,
         queue: [this.createHtmlEvent('submit', aEvent)],
         initialQueueLength: 1,
         delay: delay
      };
      this._setTimeout(this.dispatchEvents.bind(this), delay);
   },

   /**
    * Initiate replay of a hover DejaClick event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be hovered over.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    */
   replayHoverEvent: function (aTarget, aEvent) {
      // @todo Push aTarget onto eventsTracked?
      var delay, params;
      delay = aEvent.attributes.dispatchDelay;
      this.dispatchState = {
         target: aTarget,
         event: aEvent,
         queue: [
            this.createMouseEvent('mousemove', aEvent),
            this.createMouseEvent('mouseover', aEvent)
         ],
         initialQueueLength: 2,
         delay: delay
      };
      params = aEvent.eventparams;
      this.hoverObjects.push({
         target     : aTarget,
         button     : params.button,
         detail     : ((params.detail !== undefined) && (params.detail !== 'undefined')) ? params.detail : 0,
         screenX    : ((params.screenX !== undefined) && (params.screenX !== 'undefined')) ? params.screenX : 0,
         screenY    : ((params.screenY !== undefined) && (params.screenY !== 'undefined')) ? params.screenY : 0,
         clientX    : ((params.clientX !== undefined) && (params.clientX !== 'undefined')) ? params.clientX : 0,
         clientY    : ((params.clientY !== undefined) && (params.clientY !== 'undefined')) ? params.clientY : 0,
         altKey     : params.altKey,
         ctrlKey    : params.ctrlKey,
         metaKey    : params.metaKey,
         shiftKey   : params.shiftKey
      });
      this._setTimeout(this.dispatchEvents.bind(this), delay);
   },

   /**
    * Initiate replay of a DejaClick change event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be changed.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    */
   replayChangeEvent: function (aTarget, aEvent) {
      // @todo Push aTarget onto eventsTracked?
      var queue, params, attrs;

      // @todo Inject different DOM events for screen events.
      var screenEvent = false;

      queue = [];
      params = /** @type !{
                      keycodes: string,
                      varreference: string,
                      value: string,
                      tabkey: string
                   } */ (aEvent.eventparams);
      attrs = /** @type !{
                     dispatchDelay: integer,
                     usekeystrokes: boolean,
                     responsetimeout: integer,
                     useeventspeed: boolean,
                     eventspeed: string
                  } */ (aEvent.attributes);

      var dispatchDelay = (attrs.hasOwnProperty('dispatchDelay')) ? attrs.dispatchDelay : 0;

      // Remap the event type based on the event details.
      aEvent.type = this.getChangeType(aTarget, aEvent);
      if (aEvent.type == null) {
         // terminate replay if we were unable to get the change type
         this.logger.logFailure('dcFailure_targetnotfound');
         this.handleReplayFailure( "dcFailure_targetnotfound", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND );
         return;
      }

      if (!screenEvent) {
         queue.push(this.createFocusEvent('focus', aEvent));
      }

      if ((aEvent.type == "changetext") || (aEvent.type == "changehtml")) {
         // ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
         // :: handle form-input text fields and contenteditable elements ::
         // ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
         if (attrs.usekeystrokes) {
            // Enter form-input field text using individual keystroke events.
            // This special setting helps 'find-as-you-type' javascript style
            // input fields to work properly during replay, as well as input
            // fields that have on key-up/down/press event listeners assigned.
            // Note: keycodes are ignored if a variable reference is assigned.
            // For deja screen key-related events, keycodes are always replayed.
            var keyCodes, textValue, tabRequired;
            keyCodes = textValue = tabRequired = null;
            if (params.keycodes && !params.varreference) {

               keyCodes = params.keycodes.split('|');

            } else {
               textValue = params.value;
               tabRequired = params.tabkey;
               if (textValue == null) {
                  return;
               }
            }

            var eventTimeout, eventSpeed;
            eventTimeout = attrs.responsetimeout;

            if (attrs.useeventspeed) {
               // get sub-event replay speed factor (a percentage of originally recorded speed)
               eventSpeed = parseFloat(attrs.eventspeed);
               eventSpeed = (eventSpeed > 0) ? eventSpeed : 1;  // fixup any bogus values
            } else {
               // user wants to use straight event dispatch delay (which is adjustable)
               eventSpeed = 0;  // zero triggers use of dispatchDelay value
            }

            this.pendingKeystrokes = true;
            aEvent.type = "keystrokes";  // override the eventType
            var nextKeyCode, parts, eventName, keyCode, keyModifiers,
                eventDuration, eventDelay;
            var numKeyCodes = (keyCodes) ? keyCodes.length : textValue.length;

            for (var i=0; i < numKeyCodes; i++) {
               // Get the next keycode from the keycodes event param array if available,
               // else get from the stored event-target text value (or variable reference).
               // Note: keycodes are only replayed when the input field has keystroke event
               // handlers or if Replay-Using-Keystroke option is enabled.  Any recorded
               // keycodes will get wiped if the user manually changes the Event Input text
               // value property via the Deja sidebar.  Also, older scripts created with
               // versions of Deja prior to 1.2.0.0 will not have a keycodes event param,
               // so we must use the recorded text value instead.  Additionally, scripts
               // recorded in versions of Deja prior to 1.3.0.0 use an older-style keycodes
               // format with less fidelity, but nevertheless must still be supported.
               // For deja screen key-related events, keycodes are always replayed.
               if (keyCodes) {
                  nextKeyCode = keyCodes[i];
                  parts = nextKeyCode.split(':');
                  if (parts.length > 1) {
                     // use new keycodes format
                     eventName     = parts[0];
                     keyCode       = parts[1];
                     keyModifiers  = parts[2];
                     eventDuration = (parts.length >= 3) ? parts[3] : null;  // newer scripts only
                     eventDelay    = (parts.length >= 4) ? parts[4] : null;  // newer scripts only

                     if (eventDelay!=null && eventSpeed!==0) {
                        eventDelay = Math.round(eventDelay / eventSpeed);  // factor in speed adjustment
                     } else {
                        eventDelay = dispatchDelay;  // user wants to use straight dispatch delay
                     }

                     queue.push(this.createKeyboardEvent(eventName, aEvent, keyCode, keyModifiers));
                     if (!screenEvent) {
                        // a tab keystroke will take focus off current html element,
                        // so we handle this special case by injecting a blur event.
                        if (eventName=='keypress' && keyCode=="["+this.DOM_VK_TAB+"]") {
                           queue.push(this.createFocusEvent('blur', aEvent));
                        }
                     }
                     this.keystrokeCount += 1;  // increment once for new keycodes format

                  } else {
                     // support legacy keycodes format
                     queue.push(this.createKeyboardEvent('keydown', aEvent, nextKeyCode));
                     queue.push(this.createKeyboardEvent('keypress', aEvent, nextKeyCode));
                     queue.push(this.createKeyboardEvent('keyup', aEvent, nextKeyCode));
                     this.keystrokeCount += 3;
                  }

               } else {
                  // no keycodes available, so inject chars from recorded textValue
                  nextKeyCode = String(textValue.charCodeAt(i));
                  if (screenEvent) {
                     // "screen" keyboard events are platform-specific, so we must send a logical keypress
                     queue.push(this.createKeyboardEvent('keypress', aEvent, nextKeyCode));
                     this.keystrokeCount += 1;
                  } else {
                     queue.push(this.createKeyboardEvent('keydown', aEvent, nextKeyCode));
                     queue.push(this.createKeyboardEvent('keypress', aEvent, nextKeyCode));
                     queue.push(this.createKeyboardEvent('keyup', aEvent, nextKeyCode));
                     this.keystrokeCount += 3;
                  }
               }
            }

            if (!keyCodes && screenEvent && tabRequired) {
               // add an additional tab keystroke if we are replaying straight input text
               // (non-keycodes) and the original recording indicates a tab was recorded
               queue.push(this.createKeyboardEvent('keypress', aEvent, "["+this.DOM_VK_TAB+"]"));
               this.keystrokeCount += 1;
            }

         } else {           
            // Enter form-input field text as a single 'change' event.
            // Note: form input field changes also used to get a key-down/press/up sequence
            // (just one set) to ensure we trigger any important web page script
            queue.push(this.createKeyboardEvent('keydown', aEvent, '['+this.DOM_VK_PAUSE+']'));		
            queue.push(this.createKeyboardEvent('keypress', aEvent, '['+this.DOM_VK_PAUSE+']'));            
            queue.push(this.createHtmlEvent('change', aEvent));
            queue.push(this.createKeyboardEvent('keyup', aEvent, '['+this.DOM_VK_PAUSE+']'));
            queue.push(this.createFocusEvent('blur', aEvent));
         }
      } else if (aEvent.type == "changeoption") {
         // :::::::::::::::::::::::::::::::::::::
         // :: handle form-input option fields ::
         // :::::::::::::::::::::::::::::::::::::
         queue.push(this.createHtmlEvent('change', aEvent));
         queue.push(this.createFocusEvent('blur', aEvent));
      }

      this.dispatchState = {
         target: aTarget,
         event: aEvent,
         queue: queue,
         initialQueueLength: queue.length,
         delay: dispatchDelay
      };
      this._setTimeout(this.dispatchEvents.bind(this), this.dispatchState.delay);
   },

   /**
    * Get the type of a DejaClick change event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be changed.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    */
   getChangeType: function (aTarget, aEvent) {
      try {
         // first, determine if this is a simple target element or a list of option items
         var params = /** @type {{option0: string}} */ (aEvent.eventparams);
         if (params && params.option0) {  // just grab first one
            if (aTarget.options && aTarget.options.length) {
               return "changeoption";
            } else {
               return null;  // mismatched target!
            }
         }
         if (aTarget.options && aTarget.options.length) {
            return null;  // mismatched target!
         }

         return 'changetext';
      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"getChangeType" );
         return null;
      }
   },

   /**
    * Create a Focus event (i.e., blur or focus) to be injected.
    * @this {!DejaClick.DejaServiceCS}
    * @param {string} aType The type of event to create.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    * @return {!Event} The new DOM Event.
    */
   createFocusEvent: function (aType, aEvent) {
      return this.addDejaProperties(
         new window./*Focus*/Event(aType, { bubbles: true, cancelable: true }),
         aEvent.eventparams);
   },

   /**
    * Create an HTML event (i.e., change or submit) to be injected.
    * @this {!DejaClick.DejaServiceCS}
    * @param {string} aType The type of event to create.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    * @return {!Event} The new DOM Event.
    */
   createHtmlEvent: function (aType, aEvent) {
      return this.addDejaProperties(
         new window.Event(aType, { bubbles: true, cancelable: true }),
         aEvent.eventparams);
   },

   /**
    * Create a mouse event (e.g., click, mouseover, mousedown, mouseup)
    * to be injected.
    * @this {!DejaClick.DejaServiceCS}
    * @param {string} aType The type of event to create.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    * @return {!Event} The new MouseEvent.
    */
   createMouseEvent: function (aType, aEvent) {
      var parms, domEvent;
      parms = aEvent.eventparams;
      domEvent = new window.MouseEvent(aType, {
         bubbles: true,
         cancelable: true,
         detail: (parms.hasOwnProperty('detail') && parms.detail !== 'undefined')  ? Number(parms.detail) : 0,
         screenX: (parms.hasOwnProperty('screenX') && parms.screenX !== 'undefined') ? Number(parms.screenX) : 0,
         screenY: (parms.hasOwnProperty('screenY') && parms.screenY !== 'undefined') ? Number(parms.screenY) : 0,
         clientX: (parms.hasOwnProperty('clientX') && parms.clientX !== 'undefined') ? Number(parms.clientX) : 0,
         clientY: (parms.hasOwnProperty('clientY') && parms.clientY !== 'undefined') ? Number(parms.clientY) : 0,
         ctrlKey: parms.ctrlKey === 'true',
         altKey: parms.altKey === 'true',
         shiftKey: parms.shiftKey === 'true',
         metaKey: parms.metaKey === 'true',
         button: (parms.hasOwnProperty('button') && parms.button !== 'undefined') ? Number(parms.button) : 0
      });
      // offsetX and offsetY are initialized to clientX and clientY.
      return this.addDejaProperties(domEvent, parms);
   },

   /**
    * Create a keyboard event (i.e., keydown, keypress, keyup) to be injected.
    * @this {!DejaClick.DejaServiceCS}
    * @param {string} aType The type of event to create.
    * @param {!{
    *     type: string,
    *     variables: !Object.<string,number,string,string>,
    *     replayCount: number,
    *     replayLocation: number,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !Object.<string,(boolean|integer|string)>
    * }} aEvent Details of the event to be replayed.
    * @param {string} aKeyCode The key code for the event.
    * @param {string=} opt_keyModifiers Optional list of modifier keys
    *    to be applied to the event.
    * @return {!Event} The new KeyboardEvent.
    */
   createKeyboardEvent: function (aType, aEvent, aKeyCode, opt_keyModifiers) {
      var mods, match, domEvent;
      mods = (opt_keyModifiers == null) ? '' : opt_keyModifiers;
      match = /\[(.*)\]/.exec(aKeyCode);
      var keyCode, charCode, which;
      if (match == null) {
         charCode = Number(aKeyCode);
         keyCode = charCode;
         which = charCode;
      } else {
         charCode = 0;
         keyCode = Number(match[1]);
         which = keyCode;
      }
      
      domEvent = new window.KeyboardEvent(aType, {
         bubbles: true,
         cancelable: true,
         ctrlKey: mods.indexOf('ctrlKey') !== -1,
         altKey: mods.indexOf('altKey') !== -1,
         shiftKey: mods.indexOf('shiftKey') !== -1,
         metaKey: mods.indexOf('metaKey') !== -1,
         view: window
      });

      // Chromium Hack. With Chrome 43, we setting of keycode and
      // charcode was deprecated.
      Object.defineProperty(domEvent, 'keyCode', {
                get : function() {
                    return this.keyCodeVal;
                }
      });     
      Object.defineProperty(domEvent, 'which', {
                get : function() {
                    return this.whichVal;
                }
      });           
      Object.defineProperty(domEvent, 'charCode', {
                get : function() {
                    return this.charCodeVal;
                }
      });

      domEvent.charCodeVal = charCode;
      domEvent.keyCodeVal = keyCode;
      domEvent.whichVal = which;
      return this.addDejaProperties(domEvent, aEvent.eventparams);
   },

   /**
    * Add DejaClick specific properties to the DOM event.
    * @param {!Event} aDomEvent A DOM Event.
    * @param {!Object.<string, (Object|string)>} aParams Parameters for the
    *    DejaClick event being replayed.
    * @return {!Event} The DOM Event.
    */
   addDejaProperties: function (aDomEvent, aParams) {
      // @todo Attach target if necessary.
      if (aParams.hasOwnProperty('offsetX')) {
         aDomEvent.dejaOffsetX = aParams.offsetX;
      }
      if (aParams.hasOwnProperty('offsetY')) {
         aDomEvent.dejaOffsetY = aParams.offsetY;
      }
      return aDomEvent;
   },

   /**
    * Replay the next DOM event from the queue (this.dispatchState).
    * @this {!DejaClick.DejaServiceCS}
    * @todo Disable popup blocker while dispatching non-hover events.
    */
   dispatchEvents: function () {
      var target, queue, dejaEvent, params, domEvent, eltList, dispatchDetails;
      try {
         if ((this.dispatchState == null) ||
               (this._runMode !== constants.RUNMODE_REPLAY && this._runMode !== constants.RUNMODE_PAUSED)) {
            return;
         }

         queue = this.dispatchState.queue;
         if (queue.length === 0) {
            // Inform background that event dispatching is complete.
            dispatchDetails = {mutationsCountLast : this.mutationsCountLast, stickyValue: this.stickyValue, varName : this.varName};
            this.observerService.notifyObservers('dejaclick:dispatchComplete', dispatchDetails);
            this.stickyValue = null; 
            this.varName = null;
            return;
         }
         target = this.dispatchState.target;
         dejaEvent = this.dispatchState.event;
         params = /** @type {!{value:string,submitmode:string}} */
            (dejaEvent.eventparams);
         domEvent = queue.shift();
         this.pendingEvent = dejaEvent.type;

         if (dejaEvent.attributes.scrollToActive) {
            this.scrollToNode(target,
               domEvent.dejaOffsetX,
               domEvent.dejaOffsetY);
         }
         // @todo Calculate absolute screen coordinates for TrueScreen events.
         // Change properties of target element before dispatching
         // change events.
         if (domEvent.type == 'change' && dejaEvent.type == 'changetext') {
            this.pendingEvent = 'change';
            var varInfo = dejaEvent.variables;
            var replayCount = dejaEvent.replayCount;
            var replayLocation = dejaEvent.replayLocation;
            var strText = null;
            if (varInfo.varName) {
               if (varInfo.varText) {
                  strText = varInfo.varText;
               }
               else {
                  var variable = new DejaClick.Variable(this.logger, replayCount, replayLocation);
                  strText = variable.computeScriptVariable(varInfo.varName, varInfo.varValue);
                  if (strText == null) {
                     this.logger.logFailure('dispatchEvents: invalid value of script variable ' + varInfo.varName);                     
                     this.handleReplayFailure("dcFailure_populateScriptVar", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND);
                     return;
                  }
                  this.stickyValue = varInfo.sticky > 0 ? strText : null;
               }
               this.varName = varInfo.varName;
            }
            else {
               strText = params.value;
            }
            if (strText == null) {
               return;
            }
            target.value = strText;
         } else if (domEvent.type == "change" && dejaEvent.type == "changeoption") {  // change the Form Options
            this.pendingEvent = 'change';
            if (this.changeOptionValue( target, dejaEvent ) === 0) {
               this.logger.logFailure('dcFailure_targetnotfound');
               this.handleReplayFailure( "dcFailure_targetnotfound", null, constants.STATUS_TARGET_ELEMENT_NOT_FOUND );
               return;  // terminate replay if unable to change any value(s)
            }

         } else if (domEvent.type.match(/^key/) &&
               (dejaEvent.type=="keystrokes" || dejaEvent.type=="keypress")) {  // change Input value
              
            // Manually insert the char on keypress, as Chrome blocks
            // "synthetic keyboard events" even from extensions, for security reasons.
            // re: https://bugs.webkit.org/show_bug.cgi?id=28986#c2
            if ((domEvent.type == "keypress") && domEvent.charCode) {
               var ok = /text|password|search|tel|url/.test(target.type);
               var oldValue = target.value;
               var newChar = String.fromCharCode(domEvent.charCode);
               var newValue;
               if (ok) {
                  newValue = oldValue.substring(0, target.selectionStart) + newChar + oldValue.substring(target.selectionEnd);
               }
               else {
                  newValue = oldValue + newChar;
               }                  
               target.value = newValue;
            }

            // Manually trigger any key[down|press|up] handlers on the element
            // or on its ancestors, for the same reason as above.
            var eventHandler = "on" + domEvent.type;
            var nodelist =  this.search.processXPath( target,
                  "ancestor-or-self::*[@" + eventHandler + "]" );
            for (var i=0; i<nodelist.length; i++) {
               var node = nodelist[i];
               var handler = node[eventHandler];
               // Check for null to avoid an exception in Chrome 30.
               if (handler) {
                  handler(domEvent);
               }
            }

            this.pendingEvent = 'change';
            if (this.keystrokeCount > 0) { --this.keystrokeCount; }
         }

         if (domEvent.type === 'focus') {
            target.focus();
         } else if (domEvent.type === 'blur') {
            target.blur();
         }
         target.dispatchEvent(domEvent);
         if ((domEvent.type === 'submit') && (params.submitmode === 'direct')) {
            // We need to submit the enclosing form directly.
            eltList = this.search.processXPath(target, 'ancestor-or-self::form');
            if (eltList.length !== 0) {
               eltList[0].submit();
            }
         }

         // @todo If event.type === 'submit',
         //       invoke submit on parent form element.

         if (queue.length !== 0) {
            // Dispatch the next DOM event after a delay.
            this._setTimeout(this.dispatchEvents.bind(this),
               this.dispatchState.delay);

         } else {
            // Inform background that event dispatching is complete.
            this.dispatchState = null;
            dispatchDetails = {mutationsCountLast : this.mutationsCountLast, stickyValue: this.stickyValue, varName : this.varName};
            this.observerService.notifyObservers('dejaclick:dispatchComplete', dispatchDetails);
            this.stickyValue = null; 
            this.varName = null;
         }

      } catch (ex) {
         this.reportException(ex, this.DCMODULE + 'dispatchEvents');
      }
   },

   /**
    * Scroll the window to display the specified node.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Node} aNode The node to which to scroll.
    * @param {integer=} opt_offsetX Optional horizontal position within
    *     the node.
    * @param {integer=} opt_offsetY Optional vertical position within the node.
    */
   scrollToNode: function (aNode, opt_offsetX, opt_offsetY) {
      var obj, left, top, right, bottom, doScroll, margin, scrollX, scrollY;
      if ((this.lastScrollTarget == null) ||
            (this.lastScrollTarget.node !== aNode) ||
            (this.lastScrollTarget.offsetX !== opt_offsetX) ||
            (this.lastScrollTarget.offsetY !== opt_offsetY)) {
         this.lastScrollTarget = {
            node: aNode,
            offsetX: opt_offsetX,
            offsetY: opt_offsetY
         };
         obj = aNode;
         left = 0;
         top = 0;
         while (obj.offsetParent !== null) {
            left += obj.offsetLeft;
            top += obj.offsetTop;
            obj = obj.offsetParent;
         }

         // If given the element-relative offset params (opt_offsetX,
         // opt_offsetY), apply them to get the coordinates of the
         // area to be scrolled into view.
         if (opt_offsetX !== undefined) {
            left += opt_offsetX;
         }
         if (opt_offsetY !== undefined) {
            top += opt_offsetY;
         }
         right = left + aNode.offsetWidth;
         bottom = top + aNode.offsetHeight;

         doScroll = false;
         margin = 10;
         if (left < window.pageXOffset) {
            // Scroll right.
            scrollX = left - margin;
            doScroll = true;
         } else if (window.innerWidth + window.pageXOffset - margin < right) {
            // Scroll left.
            scrollX = right - window.innerWidth + margin;
            doScroll = true;
         } else {
            scrollX = window.pageXOffset;
         }
         if (top < window.pageYOffset) {
            // Scroll up.
            scrollY = top - margin;
            doScroll = true;
         } else if (window.innerHeight + window.pageYOffset - margin < bottom) {
            // Scroll down.
            scrollY = bottom - window.innerHeight + margin;
            doScroll = true;
         } else {
            scrollY = window.pageYOffset;
         }
         if (doScroll) {
            window.scrollTo(scrollX, scrollY);
         }
      }
   },

   /**
    * Set the selection state of the option sub-elements of
    * a select element for a DejaClick change event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {!Element} aTarget The DOM element to be changed.
    * @param {!{
    *     type: string,
    *     eventparams: !Object.<string,(string|!Object)>,
    *     replayhints: !Object.<string,string>,
    *     attributes: !{selectType: string}
    * }} aEvent Details of the event to be replayed.
    */
   // set the option (droplist) values...
   // Note: we break from using the cleaner domTreeGetEventParam interface
   // due to the special case handling required for dealing with variable numbers
   // of similarly named options that multi-select FORM INPUTs can generate.
   changeOptionValue : function( aTarget, aEvent )
   {
      var numOptionsSet = 0;
      try {
         var i, paramValue, paramItem, currParam, currOption, optionhash;
         var params = aEvent.eventparams, attrs = aEvent.attributes;

         // get our preferred selection type (by item, value, or index)
         var selectType = attrs.selectType;
         if (selectType=='itemname') {
            // create and initialize our option hash
            optionhash = {};
            for (i=0; i < aTarget.options.length; i++) {
               currOption = aTarget.options[i];
               optionhash[currOption.textContent] = false;
            }
            // loop over all script event params looking for a matching name
            for (i in params) {
             if (this.hasOwnProperty.call(params, i)) {
               currParam = params[i];
               // check for itemname attrib (note: only scripts created using version 1.0.5.0 or later will have this)
               paramItem = currParam.itemname || null;
               if (paramItem && optionhash[paramItem]!="undefined") {
                  // match found -- use param value to set selected state of the hashed option
                  paramValue = currParam.text || "";
                  optionhash[paramItem] = (paramValue=='true') ? true : false;
               }
             }
            }
            // loop over option target elements, setting their selection state based on hashed values
            for (i=0; i < aTarget.options.length; i++) {
               currOption = aTarget.options[i];
               currOption.selected = optionhash[currOption.textContent];
               if (currOption.selected) { numOptionsSet++; }
            }

         } else if (selectType=='itemval') {
            // create and initialize our option hash
            optionhash = {};
            for (i=0; i < aTarget.options.length; i++) {
               currOption = aTarget.options[i];
               optionhash[currOption.value] = false;
            }
            // loop over all script event params looking for a matching value
            for (i in params) {
             if (this.hasOwnProperty.call(params, i)) {
               currParam = /** @type {!{itemname: ?string, text: ?string}} */ (params[i]);
               // check for itemval attrib (note: only scripts created using v1.0.5.0 or later will have this)
               paramItem = currParam.itemname || null;
               if (paramItem && optionhash[paramItem]!="undefined") {
                  // match found -- use param value to set selected state of the hashed option
                  paramValue = currParam.text || "";
                  optionhash[paramItem] = (paramValue=='true') ? true : false;
               }
             }
            }
            // loop over option target elements, setting their selection state based on hashed values
            for (i=0; i < aTarget.options.length; i++) {
               currOption = aTarget.options[i];
               currOption.selected = optionhash[currOption.value];
               if (currOption.selected) { numOptionsSet++; }
            }

         } else { // itemindex option selection type (default)

            // loop over all script event params, setting selected state of matching option list items
            // note: this (default) method uses straight list item indexing and ignores names and values
            var selectedState;
            for (var option in params) {
             if (this.hasOwnProperty.call(params, option)) {
               currParam = params[option];
               paramValue = currParam.text || "";
               i = Number(option.substring(6));
               if (i < aTarget.options.length) {
                  selectedState = (paramValue=='true') ? true : false;
                  aTarget.options[i].selected = selectedState;
                  if (selectedState) { numOptionsSet++; }

               } else {
                  // Oops - the option item count is now smaller than what was recorded.
                  // Dynamic data lists sometimes change, so what was a list of 7 items
                  // when recorded could now be a list of 4.  So we have extra recorded
                  // item values with no place to go.  Just ignore them, and let the
                  // numOptionsSet check below complain if we don't have at least one
                  // option selected from the list after all value assignments are made.
                  continue;
               }
             }
            }
         }
      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"changeOptionValue" );
      }
      return numOptionsSet;
   },

   /**
    * Search for matching text within this document.
    * Return the result via the dejaclick:keywordsearchcomplete event.
    * @this {!DejaClick.DejaServiceCS}
    * @param {{
    *    id: integer,
    *    strMatchText: ?string,
    *    bFixSpaces: boolean,
    *    oRegExText: ?string,
    *    strOptions: string
    * }} aValidator Details of the text for which to search.
    */
   keywordSearch : function (aValidator)
   {
      // search for the specified keyword item according to configured rules
      // Note: just in case there isn't a innerHtml (e.g FF error msg) try...catch
      //       the whole thing

      try {
         var keywordFound = false;

         if (this.activePage) {
            var strHtmlText = aValidator.bFixSpaces ?
               this.getDocumentElement().innerHTML.replace(/&nbsp;|[\s\"]+/g, " ") :
               this.getDocumentElement().innerHTML;

            // ...and finally the regex object
            var oRegEx = null;
            // quietly catch any syntactic errors in the expression,
            // since the user may have crafted something foul.
            try { oRegEx = new RegExp(aValidator.oRegExText, aValidator.strOptions); } catch (err) {}

            if (oRegEx.test(strHtmlText)) {
               keywordFound = true; // keyword found, exit doc search loop
            }
         }

         aValidator.keywordFound = keywordFound;
         aValidator.docURL = document.URL;
         aValidator.docSize = this.getDocumentElement().innerHTML.length;
         aValidator.docContentType = this.getDocumentElement().contentType;
      }
      catch ( e ) {
      }
      this.observerService.notifyObservers("dejaclick:keywordsearchcomplete", aValidator);

   },

   //----------------------------------------------------------------------
   // =======================
   // State handlers
   // =======================
   //----------------------------------------------------------------------

   markInactive: function () {
      this.activePage = false;
   },

   // ----------------------------------------------------
   // Clear out refs/variables when we insert a new action on dejaService
   resetActionInfo : function ()
   {
      this.hoverEvents = [];
      this.hoverObjects = [];
      this.useMutationHints = false;
      this.submitWasClicked = false;
      this.pendingMousemove = false;
      this.pendingMousedrag = false;
      this.firstHoverTarget = null;
      this.lastHoverEvent = -1;
   },

   resetEventInfo : function (aDetails)
   {

      this.eventsCaptured = aDetails.eventsCaptured;
      this.pendingMousedrag = false;
      this.bypassKeystrokes = false;
      this.skipSpeedAdjust = false;
      this.bufferedKeycodes = null;
      this.lastKeyCode = null;
      this.fixupThreshold = 0;
      this.actEventNode = {};
   },

   onServiceHalted : function () {
      try {
         this.halt ();
      } catch (e) {
      }
   },

   /**
    * Inform the content script about some global settings.
    * @param {!{
    *    runMode: integer,
    *    eventsCaptured: !Array.<string>,
    *    messageOptions: string,
    *    debugOptions: string,
    *    recordFocusEvents: boolean,
    *    fixupThreshold: integer,
    *    mutationsRecorded: integer,
    *    mutationsRequired: integer
    * }} data
    */
   onRunMode : function(data) {
      try {

         if (!data || data.runMode == this._runMode) {
            return;
         }

         if (this._runMode == constants.RUNMODE_SUSPEND) {
            // if currently in suspend mode, any mode change will first resume normal activities
            this.eventsEnabled = true;
         }

         // Set System Preferences
         this.fixupThreshold = data.fixupThreshold;
         this.recordFocusEvents = data.recordFocusEvents;
         this.mutationsRecorded = data.mutationsRecorded;
         this.mutationsRequired = data.mutationsRequired;
         this.server = data.server;
         this.setMessageOptions(data.messageOptions);
         this.setDebugOptions(data.debugOptions);

         var lastRunMode = this._runMode;
         this._runMode = data.runMode;
         switch (this._runMode) {
            case constants.RUNMODE_RECORD:
               this.begin();
               break;
            case constants.RUNMODE_REPLAY:
               if (lastRunMode == constants.RUNMODE_PAUSED) {
                  return;
               }
               this.begin();
               break;
            case constants.RUNMODE_STOPPED:
               this.pendingKeystrokes = false;
               this.bypassKeystrokes = false;
               this.checkboxWasClicked = false;
               this.bufferedKeycodes = null;
               this.actEventNode = {};
               this.eventsCaptured = [];
               this.eventsEnabled = false;
               this.teardownInputListeners();
               this.teardownContentListeners();
               this.activePage = true;
               break;
            case constants.RUNMODE_INACTIVE:
               this.activePage = true;
               break;
            case constants.RUNMODE_SUSPEND:
               this.eventsEnabled = false;
               break;
         }

      } catch (e) {
         this.reportException( e, this.DCMODULE+"onRunMode" );
      }
   },

   //------------------------------------------------
   // DOM mutation event handler, called when a new DOM element is added.
   // Any new DOM elements created after the DOMContentLoaded event are considered
   // to be dynamically injected by the web page content.  We must target and tag
   // these additional nodes (i.e., nodes resulting from DHTML menus, mouseovers,
   // and other such things) with special attributes so that if they become the
   // target of a recorded click event, we will use wait timers during playback
   // to ensure proper event replay.  For every mutation event that occurs during
   // replay, we restart the mutation delay timer so that the last DOM mutation
   // (before any timeout expiration) will trigger a brief delay prior to restarting
   // event playback.  This gives us a good shot at having all the DOM nodes available
   // that we may need to inject events into upon replay.  We also start separate
   // timers to guard against waiting forever for mutations to begin or end (due to
   // poor scripting) and let the user decide if they should end the script or wait.
   onDOMInsert : function( evt )
   {

      if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
         return;
      }
      
      // Ignore any DejaClick Dialog related DOM Inserts.
      // In addition, send the insert dialog data for 
      // the dejaService to process.
      if (evt.target && this._runMode == constants.RUNMODE_RECORD ) {
         if (evt.target.id == this.DEJA_DIALOG_ID) {
            var value = JSON.parse(evt.target.value);            
            var jsDialogElem = document.getElementById(this.DEJA_DIALOG_ID);
            if (jsDialogElem) {
               jsDialogElem.parentNode.removeChild(jsDialogElem);
            }
            this.observerService.notifyObservers("dejaclick:insertdialogdata", {
               data: value
            });
            return;

         }
         else if (evt.target.id == this.DEJA_OVERRIDE_FUNC_ID) {
            return;
         } 
         else if (evt.target.id == this.DEJA_SINGLE_PAGE_APP_ID) {
             return;
	 }
      }

/*
      if (this._noteStack && this._noteStack.noteStack.length) { // short-circuit - only when notes exist on page
         try {
            var mouseTarget = (evt.explicitOriginalTarget) ? evt.explicitOriginalTarget : evt.originalTarget;
            var nodeList = this.search.processXPath( mouseTarget, "ancestor-or-self::*[starts-with(@id,'dcNote')]" );
            if (nodeList.length) {
               return;  // ignore if target or ancestor node is a deja note
            }
         } catch(ex) {}
      }
*/
      if (this.fixupThreshold && ++this.fixupDomCount > this.fixupThreshold) {
/*
         // If the optional DOM fixup threshold is in use and has been exceeded,
         // then automatically switch to 'delay mode' for DOM fixup processing.
         // This speeds things up on dynamic pages that do massive DOM updates,
         // but it may also prevent proper hover trail recording on some pages.
         var docElement = null;
         try { docElement = aRootNode.ownerDocument.documentElement; } catch(ex){}
         if (docElement) {
            this.restartDomFixupTimeout( docElement );
         }
*/
         // continue bumping mutations counter to track content changes
         if (!this.screenModeActive) { this.mutationsCount++; }

         return;
      }
/*
      var browserNode = this.getBrowserNodeFromDocNode( evt.target.ownerDocument );
      var browserObj = this.getBrowserObjFromBrowserNode( browserNode );
*/
      var mutationsCountBeforeAssignID = this.mutationsCount;
      if (evt.target.nodeType == 3) {  // if text target, bump up to parent
         var newTarget;
         try { newTarget = evt.target.parentNode; } catch(ex) {}
         if (newTarget && newTarget.nodeType == 1) {  // only retarget if an ELEMENT type
            this.fixupDomNode( newTarget );
         }
      } else {
         this.fixupDomNode( evt.target );
      }

      this.mutationsCountLast = this.mutationsCount;

      if (this._runMode == constants.RUNMODE_REPLAY || this._runMode == constants.RUNMODE_PAUSED) {
         if (this.mutationsRecorded > 0) {
            // we only restart the mutation end timer if this is the first mutation for
            // this page AND the mutationsCounter was bumped after fixing up dom nodes
            if (mutationsCountBeforeAssignID === 0 && this.mutationsCount > 0) {
//               this._setWaitType( WAITTYPE_MUTATIONS );
//               this.stopMutationBeginTimeout();
//               this.restartMutationEndTimeout();
               this.observerService.notifyObservers( "dejaclick:mutationstarted", null);

            } else {
               if (mutationsCountBeforeAssignID != this.mutationsCount || this.mutationsCount === 0) {
                  // DOM mutations have not started or are still occurring, keep waiting
                  this.restartMutationDelay();
               } else {
                  this.stopMutationDelay();
                  // force a little extra delay before restarting replay to
                  // allow time for any javascript inserted logic to kick in
 //                 if (this.replayTimeout == null) this.restartReplayTimeout(this.lastReadyTimeout);
               }
            }

         } else {
            this.stopMutationDelay();
            // force a little extra delay before restarting replay to
            // allow time for any javascript inserted logic to kick in
//            if (this.replayTimeout == null) this.restartReplayTimeout(this.lastReadyTimeout);
         }
      }
/*
      if (this._runMode == constants.RUNMODE_RECORD || this._runMode == constants.RUNMODE_SUSPEND) {
         this.restartStatusTimeout();
      }
*/
   },

   onContentEvent : function(evt) {
      try {

         if (this._runMode != constants.RUNMODE_RECORD && this._runMode != constants.RUNMODE_REPLAY && this._runMode != constants.RUNMODE_PAUSED) {
            if (!this.eventsEnabled) {
               if (!(evt.type=='click' && evt.which==3)) {  // allow right clicking for context menu
                  this.blockEvent( evt );
                  if (evt.type=='click') {
                     var clickType = (evt.ctrlKey) ? 'suspend-ctrl-click' : 'suspend-click';  // determine the click type
                     // notify listeners that a click event occurred during suspend mode (for validate and dejanotes)
                     var eventProps = {};
                     eventProps.eventType = clickType;

                     if (DejaClickCs.validation.state.validationtype == 'keyword') {
                        // look for any user-selected page text
                        var selectedText = DejaClickCs.validation.getMatchTextSource();
                        if (selectedText) {
                           eventProps.selectedText = selectedText;
                        } else {
                           // include the current keyword suggestion if any
                           eventProps.suggestedText = DejaClickCs.validation.state.suggestedText;
                        }
                     }

                     eventProps.docURL = evt.target.ownerDocument.URL;
                     this.observerService.notifyObservers( "dejaclick:eventblocked", eventProps );

                     // clear any page text selection
                     DejaClickCs.validation.clearSelection();
                  }
               }
            }
            return;
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"onContentEvent" );
      }

   },

   getDocSource : function() {
      var docSource = "";
      try {
         docSource = new XMLSerializer().serializeToString(document);
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"getDocSource" );
      }
      return docSource;
   },

   LOGIN_RESPONSE_URL: "goalert?source=login_deja",
   INTEGRATED_MODE_URL: "goalert?source=integrated_deja",

   onDOMContentLoaded : function(aEvent) {
      try {
         var newdoc;
         if (this.logger.debugprocess) {
            this.logger.logDebug( "onDOMContentLoaded - Processing for " + document.URL);
         }
		 
         newdoc = this.getBaseDocument( aEvent );
         if (!newdoc) {
//            gDC._setWaitType( WAITTYPE_STOPPED );
            return;  // ignore this doc load
         }

         // Check if we got a response for the browser login.
         // If we did, send the response over to the background thread for further processing.
         if ((document.URL.indexOf(this.LOGIN_RESPONSE_URL) !== -1) ||
 		     (document.URL.indexOf(this.INTEGRATED_MODE_URL) !== -1)){
            var xmlBodyElem = document.getElementById("xml_body");
            if (xmlBodyElem && xmlBodyElem.value) {
               this.observerService.notifyObservers("dejaclick:loginresponse", {
                  response: xmlBodyElem.value
               });
            }
         }

         this.docRoot = newdoc;
         var docElement = this.getDocumentElement();
         this.mutationsCount = 0;
         this.mutationsCountLast = 0;
//         this.fixupDomCount = 0;

         this.fixupAllDomNodes( docElement );
         this.domLoadTimestamp =  aEvent.timeStamp;
         this.onDOMInsertListeners = new DejaClick.EventRegistration().
                  addDomListener(document, "DOMNodeInserted", true, this.onDOMInsert, this);

         var isFrame = true;
         if (window.self == window.top) {
            isFrame = false;
         }

         // Chrome pre-renders the page, even though the user hasnt selected the URL to navigate to.
         // Hence, we might record spurious navigates even when the user hasn't navigated to the site.
         // To get around this issue, we record domcontentloaded for the main page only after
         // the visibility state is set to "visible".
         var isVisible = (document.webkitVisibilityState == "visible") ? true  : false;
         if (!isVisible && !isFrame) {
            this.visibilityChangeListeners = new DejaClick.EventRegistration().
                  addDomListener(document, "webkitvisibilitychange", true, this.handleVisibilityChange, this);
         }

         if (!this.isNewTabURL(document.URL)) {
            this.observerService.notifyObservers("dejaclick:onDOMContentLoaded", {
               url: document.URL,
               title: document.title,
               isFrame: isFrame,
               isVisible: isVisible
            });
            this.attachInputListeners();
            this.attachReplayListeners();
         }

      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"onDOMContentLoaded" );
      }

   },

   handleReplayFailure : function (aMessageId, aMessageString,
         aStatusCode, opt_statusLogId) {
      try {
         var message = {};
         message.messageId = aMessageId;
         message.messageString = aMessageString;
         message.statusCode = aStatusCode;
         message.statusLogId = opt_statusLogId;
         this.observerService.notifyObservers("dejaclick:replayfailure", message);         
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"handleReplayFailure" );
      }
   },
   
   handleVisibilityChange : function () {
      try {
         if (document.webkitVisibilityState == "visible") {
            this.observerService.notifyObservers("dejaclick:onDOMContentLoaded",
               {
                  url: document.URL,
                  title: document.title,
                  isFrame: false,
                  isVisible: true
               });

         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"handleVisibilityChange" );
      }
   },

   onLoaded : function(aEvent) {
      this._setTimeout(this._onLoaded.bind(this, aEvent), 100);
   },

   _onLoaded : function(aEvent) {
      var v_timings = {}, v_resources = [];
      try {
         if(this.runMode!=constants.RUNMODE_RECORD && this.runMode!=constants.RUNMODE_REPLAY) {
             if (/(http[s]?:\/\/[^\/]*smartbear\.com|http[s]?:\/\/[^\/]*alertsite\.com)/.test(document.URL)) {
                 this.injectDejaDOM(aEvent);
             }			 
         }
		 
         
         if (this.logger.debugprocess) {
            this.logger.logDebug( "onLoaded - Processing for " + document.URL);
         }

         // Send the onLoaded for base document
         if (!this.isNewTabURL(document.URL) && window.self == window.top) {
            this.observerService.notifyObservers("dejaclick:onloaded", {
               frameId : 0,
               url: document.URL,
               title: document.title
            });
         }

         // Collect those standardized w3c timing attributes only
         this.TIMING_PROPERTIES.forEach(function(name) {
           v_timings[name] = window.performance.timing[name];
         });
         window.performance.getEntries().forEach(function(entry) {
           var resource = {};
           this.RESOURCE_TIMING_PROPERTIES.forEach(function(name) {
               resource[name] = entry[name];
           });
           v_resources.push(resource);
         }, this);

         this.observerService.notifyObservers('dejaclick:w3ctimings', {
               url: document.URL,
               timings: v_timings,
               resourceTimings: v_resources
            });
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"onLoaded" );
      }
   },

   onUnloaded : function(aEvent) {
      try {
         // Send the onUnloaded for base document
         if (window.self == window.top && !this.isNewTabURL(document.URL)) {
            this.observerService.notifyObservers("dejaclick:onunloaded", {
               url: document.URL,
               title: document.title
            });
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"onUnloaded" );
      }
   },

   /**
    * Determine whether a URL is a New Tab URL.
    * @this {!DejaClick.DejaServiceCS}
    * @param {string} aURL A URL.
    * @return {boolean} true if the URL is a New Tab URL.
    */
   isNewTabURL : function (aURL) {
      // The New Tab URL is chrome://newtab/
      // (but for Chrome v28+ can be chrome-search://local-ntp/local-ntp.html).
      return (aURL == "chrome://newtab/" ||
            aURL == "chrome-search://local-ntp/local-ntp.html");
   },

   // -----------------------------------
   // -----------------------------------
   // -----------------------------------
   //  Generic Javascript Object primitives
   // -----------------------------------
   // -----------------------------------

   jsObjHasEventParam : function (aObject, aName) {
      try {
         if (!aObject.eventparams || !aObject.eventparams.param) {
            return false;
         }

         var params = aObject.eventparams.param;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               return true;
            }
         }
         return false;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjHasEventParam" );
      }
   },

   jsObjDelEventParam : function (aObject, aName) {
      try {
         if (!aObject.eventparams || !aObject.eventparams.param) {
            return;
         }

         var params = aObject.eventparams.param;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               params.splice(i, 1);
               break;
            }
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjDelEventParam" );
      }
   },

   jsObjGetEventParam : function (aObject, aName) {
      try {
         if (!aObject.eventparams || !aObject.eventparams.param) {
            return null;
         }

         var params = aObject.eventparams.param;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               return param["#text"];
            }
         }
         return null;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjGetEventParam" );
      }
   },

   jsObjSetEventParam : function (aObject, aName, aValue) {
      try {
         if (!aObject.eventparams || !aObject.eventparams.param) {
            return;
         }

         var params = aObject.eventparams.param;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               param["#text"] = aValue;
               break;
            }
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjSetEventParam" );
      }
   },

   jsObjAddEventParam : function (aObject, aName, aValue) {
      try {
         if (!aObject.eventparams) {
            aObject.eventparams = {};
            aObject.eventparams.param = [];
         }
         aObject.eventparams.param.push({"@name" : aName, "#text" : aValue});
         return aObject.eventparams.param.length-1;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjAddEventParam" );
      }
   },

   jsObjDelEventAttribute : function (aObject, aName) {
      try {
         if (!aObject.attributes || !aObject.attributes.attrib) {
            return;
         }

         var params = aObject.attributes.attrib;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               param.splice(i, 1);
               break;
            }
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjDelEventAttribute" );
      }
   },

   jsObjGetEventAttribute : function (aObject, aName) {
      try {
         if (!aObject.attributes || !aObject.attributes.attrib) {
            return null;
         }

         var params = aObject.attributes.attrib;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               return param["#text"];
            }
         }
         return null;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjGetEventAttribute" );
      }
   },

   jsObjSetEventAttribute : function (aObject, aName, aValue) {
      try {
         if (!aObject.attributes || !aObject.attributes.attrib) {
            return;
         }

         var params = aObject.attributes.attrib;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               param["#text"] = aValue;
               break;
            }
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjSetEventAttribute" );
      }
   },

   jsObjAddEventAttribute : function (aObject, aName, aValue) {
      try {
         if (!aObject.attributes) {
            aObject.attributes = {};
            aObject.attributes.attrib = [];
         }
         aObject.attributes.attrib.push({"@name" : aName, "#text" : aValue});
         return aObject.attributes.attrib.length-1;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjAddEventAttribute" );
      }
   },

   jsObjDelReplayHint : function (aObject, aName) {
      try {
         if (!aObject.replayhints || !aObject.replayhints.hint) {
            return;
         }

         var params = aObject.replayhints.hint;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               params.splice(i, 1);
               break;
            }
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjDelReplayHint" );
      }
   },

   jsObjGetReplayHint : function (aObject, aName) {
      try {
         if (!aObject.replayhints || !aObject.replayhints.hint) {
            return null;
         }

         var params = aObject.replayhints.hint;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               return param["#text"];
            }
         }
         return null;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjGetReplayHint" );
      }
   },

   jsObjSetReplayHint : function (aObject, aName, aValue) {
      try {
         if (!aObject.replayhints || !aObject.replayhints.hint) {
            return;
         }

         var params = aObject.replayhints.hint;
         for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (param["@name"] == aName) {
               param["#text"] = aValue;
               break;
            }
         }
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjSetReplayHint" );
      }
   },

   jsObjAddReplayHint : function (aObject, aName, aValue) {
      try {
         if (!aObject.replayhints) {
            aObject.replayhints = {};
            aObject.replayhints.hint = [];
         }
         aObject.replayhints.hint.push({"@name" : aName, "#text" : aValue});
         return aObject.replayhints.hint.length-1;
      }
      catch (e) {
         this.reportException( e, this.DCMODULE+"jsObjAddReplayHint" );
      }
   },

   /**
    * @this {!DejaClick.DejaServiceCS}
    * @param {!function()} aCallback
    * @param {integer} aMsec
    * @param {boolean=} aPersistent
    */
   _setTimeout: function( aCallback, aMsec, aPersistent )
   {
      var nID = setTimeout (aCallback, aMsec);
      // Create a new timer...
      if (!aPersistent) {
         this._timers.push(nID);
      }
      return (this._timers.length - 1);
   },

   restartMutationDelay : function( )
   {
      this.stopMutationDelay();
/*
      if (this.replayShuttingDown == true) {
         if (!gDC.shutdownTimeout) {
            gDC.restartShutdownTimeout(2000);
            gDC._setWaitType( WAITTYPE_STOPPING );
         }
         return;
      }
*/
      var timeoutDelay = this.DC_OPTVAL_MUTATIONDELAY;
      this.mutationsDelay = this._setTimeout( this.onMutationDelay.bind(this), timeoutDelay );
   },

   stopMutationDelay : function()
   {
      this._clearTimeout( this.mutationsDelay ); this.mutationsDelay = null;
   },

   onMutationDelay : function( )
   {
      try {
//         gDC.stopMutationEndTimeout();
         this.stopMutationDelay();
/*
         if (gDC.actEventNum < 1) {
            gDC.mutationsRecorded=0;
            gDC.areWeThereYet();
            return;
         }
*/
         if (!(this.mutationsRequired && this.mutationsCount < this.mutationsRequired)) {
            if (this.mutationsCountLast == this.mutationsCount && this.mutationsCount !== 0) {
               // At this point, the page's content changes (DOM mutations) have started,
               // but have temporarily ceased.  Since we are currently only interested
               // in the first "dom burst" after the document contents have loaded, we
               // now clear the mutationsRecorded value now to proceed with replay.
               this.mutationsRecorded=0;

               // Send a notification indicating the burst is done
               this.observerService.notifyObservers("dejaclick:mutationcomplete", null);
            }
         }

         if (this.mutationsRecorded) {
            this.restartMutationDelay();
         }
         return;

      } catch ( e ) {
         this.reportException( e, this.DCMODULE+"onMutationDelay" );
      }
   },

   _clearTimeout: function( aTimerID )
   {
      if (aTimerID == null || isNaN(aTimerID) || !this._timers[aTimerID]) { return; }
      clearTimeout(this._timers[aTimerID]);
      this._timers[aTimerID] = null;
   },

   _clearAll: function()
   {
      var id=null;
      // clear all in-use timer objects
      for (var i=0; i < this._timers.length; i++) {
         this._clearTimeout(i);
         //if (this._timers[i].inuse) {
         //   this._timers[i].reset();
         //}
      }
      this._timers = [];  // XXX for now, we always wipe the array...
   }

};

try {
   var djCS = new DejaClick.DejaServiceCS();
   djCS.init();
}
catch (e) {
   window.console.error("Exception in DejaClick.DejaServiceCS(): " + e);
}


//////////////////////////////////////////////////
// end private scope
//})();
//////////////////////////////////////////////////


