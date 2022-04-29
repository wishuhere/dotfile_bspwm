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

/*global DejaClick,chrome,window,console*/

(function () {
   /**
    * Update the browser action icon to reflect the current run mode.
    * @param {!{runMode: integer}} aData The new run mode.
    */
   function updateBrowserAction(aData) {
      var text;
      try {
         // @todo Change icon when we have appropriate icons.
         text = 'ON';
         switch (aData.runMode) {
         case DejaClick.constants.RUNMODE_INACTIVE:
            text = '';
            break;
         case DejaClick.constants.RUNMODE_RECORD:
            text = 'REC';
            break;
         case DejaClick.constants.RUNMODE_REPLAY:
            text = 'PLAY';
            break;
         case DejaClick.constants.RUNMODE_PAUSED:
            text = 'PAUS';
            break;
         }
         chrome.browserAction.setBadgeText({ text: text });
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   function notifyUnion(aCloseDejaTab, aTabId){
      try {
         var xmlhttp = new XMLHttpRequest();
         xmlhttp.open("POST", DejaClick.utils.autoUploadUrl, true);
         xmlhttp.setRequestHeader("Content-type", "application/text");
         xmlhttp.send("close");

         if(aCloseDejaTab) {
            // Remove the current recording tab, to assure the integrated mode page is closed.
            chrome.tabs.remove(DejaClick.tabId);
         }else{
            // Remove current only if integrated mode was started tab be sure we close the recording page.
            if (aTabId) {
               chrome.tabs.remove(aTabId);
            }
         }
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }
   /**
    * Discard the global reference to the sidebar controller.
    * This is called when a sidebar is closed.
    * @param {*} aReturnValue The return value from the sidebar.
    */
   function discardSidebarWindow(aReturnValue) {
      try {
         DejaClick.sidebarWindow = null;
         if (DejaClick.service) {
            DejaClick.service.halt();
         }

         if (DejaClick.resizeToOriginal) {
            chrome.windows.update(DejaClick.service.windowId, DejaClick.resizeToOriginal);
         }

         DejaClick.resizeToOriginal = null;

         //  Notify union the window is been closed
         if (DejaClick.utils.autoUploadUrl!=null) {
            notifyUnion(true, null);
         }

         DejaClick.utils.autoUploadUrl = null;
         DejaClick.service = null;

         updateBrowserAction({runMode: DejaClick.constants.RUNMODE_INACTIVE});

         // Don't close the utils object here. It may still be needed
         // by the options page or to close the sidebar and its frames.
         // This page is also registered with the observer service.



      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
         window.alert("Exception " + ex);
      }
   }

   /**
    * Attach the sidebar to the specified window.
    * @param {!chrome.Tab} aTab Details of the tab in which the
    *    browser action was clicked. The sidebar window will be docked
    *    to the left side of the tab's window.
    * @param {!DejaClick.DialogWindow} aNewSidebar The sidebar popup.
    */
   function attachSidebarWindow(aTab, aNewSidebar) {
      var view;
      DejaClick.tabId = aTab.id;

       try {
         DejaClick.sidebarWindow.dock(aTab.windowId, 'left');
         view = DejaClick.sidebarWindow.getView();
         if (view !== null) {
            view.dialogArguments = aTab;
         }
	 var xmlBodyElem = document.getElementById("xml_body");
         if (xmlBodyElem && xmlBodyElem.value) {
            DejaClick.utils.notifyObservers("dejaclick:loginresponse", {
               response: xmlBodyElem.value
            });
         }
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Display welcome splash screen when the extension is first installed.
    * Called when the extension is installed or updated.
    * @param {!{reason: string}} aDetails The reason this function was
    *    called. Either 'install', 'update', or 'chrome_update'.
    */
   function displayWelcome(aDetails) {
      var version, url;
      try {
         if (aDetails.reason == "install") {
            version = DejaClick.utils.versionInfo.extension;
            url = 'http://www.dejaclick.com/chrome/welcome.html?version=' +
               version.version + '&buildid=' + version.buildid;
            // Avoid opening a new Tab when installed
            // chrome.tabs.create({ url: url });
         }
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Resize main window to fit the sidebar
    * @param {!chrome.Tab} aTab The tab in which the browser action was clicked.
    */
   function resizeMainWindow(aTab) {
      var windowId = null, offset = null, updateObj = null,
         screenWidth, screenAvailWidth, screenAvailLeft, left, width;

      try {
         aTab && (windowId = aTab.windowId);
         DejaClick.constants && (offset = DejaClick.constants.SIDEBAR_WIDTH);

         if (windowId !== null && offset !== null) {
            screenWidth = window.screen.width;
            screenAvailWidth = window.screen.availWidth;
            screenAvailLeft = window.screen.availLeft || 0;

            width = Math.round(screenAvailWidth - offset);
            left = Math.round(screenAvailLeft + offset);

            chrome.windows.get(windowId, {}, function(aWindow) {
               if (aWindow) {
                  // Change the state to normal in non-Windows OS-es 
                  if (aWindow.state !== 'normal' && navigator.appVersion.indexOf("Win")=== -1) {
                     updateObj = {
                        state: 'normal',
                        width: width,
                        left: left
                     }
                  }
                  else if (aWindow.left < left) {
                     updateObj = {
                        width: width,
                        left: left
                     }
                  }

                  if (updateObj !== null) {
                     DejaClick.resizeToOriginal = {width : aWindow.width, left : aWindow.left};
                     chrome.windows.update(windowId, updateObj);
                  }
               }
            });
         }
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Resize main window to fit the sidebar
    * @param {!chrome.Tab} aTab The tab in which the browser action was clicked.
    */
   //function resizeMainWindowNew(aTab) {
   //   var windowId = null, offset = null, minWidth = null, updateObj = {}, left, width;
   //
   //   try {
   //      aTab && (windowId = aTab.windowId);
   //      DejaClick.constants && (offset = DejaClick.constants.SIDEBAR_WIDTH);
   //      DejaClick.constants && (minWidth = DejaClick.constants.WINDOW_RESIZE_MIN_WIDTH);
   //
   //      if (windowId !== null && offset !== null) {
   //         chrome.windows.get(windowId, {}, function(aWindow) {
   //            if (aWindow) {
   //               left = Math.round(aWindow.left + offset);
   //               width = Math.round(aWindow.width - offset);
   //
   //               if (minWidth && width < minWidth) {
   //                  width = minWidth;
   //               }
   //
   //               updateObj = {
   //                  width: width,
   //                  left: left
   //               };
   //
   //               if (aWindow.state !== 'normal') {
   //                  updateObj.state = 'normal';
   //               }
   //
   //               chrome.windows.update(windowId, updateObj);
   //            }
   //         });
   //      }
   //   } catch (ex) {
   //      DejaClick.utils.logger.logException(ex);
   //   }
   //}
   
   /**
    * Open and attach the sidebar window to the current browser window.
    * Called in response to clicking on the extension's browser action icon.
    * @param {!chrome.Tab} aTab The tab in which the browser action was clicked.
    */
   function handleBrowserAction(aTab) {
      try {
         if (DejaClick.sidebarWindow === null) {
            // Ensure that the DejaClick utilities object has been created.
            DejaClick.getUtils();
            
            if (!DejaClick.search) {
               DejaClick.search = new DejaClick.Search(DejaClick.utils.logger);
            }
            
            if (!DejaClick.service) {
               DejaClick.service = new DejaClick.DejaService();
            }
            
            if (!DejaClick.service.isInitialized()) {
               DejaClick.service.init(aTab.windowId,
                  DejaClick.utils,
                  DejaClick.search);
            } else {
               DejaClick.service.windowId = aTab.windowId
            }

            updateBrowserAction({ runMode: DejaClick.service.getRunMode() });

            resizeMainWindow(aTab);

            setTimeout(function() {
               DejaClick.sidebarWindow = new DejaClick.DialogWindow(
                  'ui/content/dejaSidebar.html',
                  aTab,
                  attachSidebarWindow.bind(null, aTab),
                  discardSidebarWindow);
            }, 100);

         } else {
            DejaClick.service.windowId = aTab.windowId;
            attachSidebarWindow(aTab, DejaClick.sidebarWindow);
         }
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }
   
   function onDejaIntegratedModeDetected(aDetails) {

      if (aDetails.url.indexOf("/cgi-bin/gologin?state=source%3Dintegrated_deja") == -1) {
         return;
      }

      // Open the sidebar to turn on DejaClick and set it to the integrated mode
      if( DejaClick.sidebarWindow  == null) {
         chrome.tabs.get(aDetails.tabId, handleBrowserAction);

      } else {
          // Handle Sidebar Already Open scenario
          window.alert(DejaClick.utils.getMessage("dcMessage_classicModeAlreadyOpen") );
      }
   }

   try {
   
      chrome.browserAction.setBadgeText({ text: '' });

      /** @type {?DejaClick.DialogWindow} */
      DejaClick.sidebarWindow = null;

      /** @type {?DejaClick.Script} */
      DejaClick.script = null;

      /** @type {?DejaClick.DejaService} */
      DejaClick.service = null;

      DejaClick.resizeToOriginal = null;
      
      /** @type {!DejaClick.Utils} */
      DejaClick.utils = new DejaClick.Utils(false, chrome.runtime, chrome.i18n,
           chrome.cookies,
           window, window.console, window.localStorage,
           DejaClick.ObserverService, DejaClick.DialogWindow);
      DejaClick.utils.observerService.addObserver('dejaclick:runmode',
           updateBrowserAction);

      /**
       * Get the DejaClick utilities object. Create it if necessary.
       * @return {!DejaClick.Utils}
       */
      DejaClick.getUtils = function () {
         return DejaClick.utils;
      };

      /**
       * Function interface for accessing the current script.  This
       * has the benefit that it can be injected into an object to
       * allow the object access to the initial script value as well
       * as any future value, without requiring the object to know
       * the global location of the script.
       * @return {?DejaClick.Script}
       */
      DejaClick.getScript = function () {
         return DejaClick.script;
      };

      /**
       * Preliminary interface for updating the current script.
       * @param {?DejaClick.Script} script The new script.
       */
      DejaClick.setScript = function (script) {
         // @todo importScript.cleanUp(),
         // @todo Set run type and wait type
         DejaClick.script = script;
         DejaClick.utils.observerService.notifyLocalObservers(
            'dejaclick:newscript', null);
         DejaClick.utils.observerService.notifyLocalObservers(
            'dejaclick:updatetreeview', null);
      };

      chrome.browserAction.onClicked.addListener(handleBrowserAction);
      chrome.runtime.onInstalled.addListener(displayWelcome);
         
      // Enable popups from smartbear.com
      chrome.contentSettings.popups.set({
         primaryPattern: '*://*.alertsite.com/*',
         setting: 'allow'
         }, null); 
         
      chrome.webNavigation.onBeforeNavigate.addListener(onDejaIntegratedModeDetected);

   } catch (ex) {
      console.error(ex.stack);
   }
}());
