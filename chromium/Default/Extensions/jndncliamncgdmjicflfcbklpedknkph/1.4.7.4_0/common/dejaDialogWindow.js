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

/*global DejaClick,chrome,window*/


/**
 * DialogWindow facilitates creating a dialog window and communicating
 * with it. DialogWindow provides the following features:
 * - A callback may be invoked when the window is opened.
 *    The signature of the callback is function(DejaClick.DialogWindow).
 * - A callback may be invoked when the window is closed.
 *    The signature of the callback is function(*)
 * - An argument (of any type) may be passed to the window. The
 *    argument is placed in the dialogArguments property of the global
 *    window object in the context of the new dialog window.
 * - A value (of any type) may be returned from the window. The
 *    returnValue property of the global window object in the context
 *    of the dialog window will be passed to the callback function
 *    invoked when the window is closed. If any problem occurs when
 *    opening the window, a value of null will be passed.
 * - Access to the tab id, window id, and global window object of the
 *    dialog window is provided.
 * - The dialog window may be docked to the side of another window
 *    or centered over a window.
 *
 * NOTE: DialogWindow may not be able to set the dialogArguments
 * property before the scripts on the dialog page are executed. If a
 * script needs to know when the dialog arguments are available, it
 * can assign a function to window.onDialogArguments. That function
 * will be called when the dialogArguments property has been set.
 *
 * NOTE: The dialog window's unload event may occur before OR after
 * the DialogWindow object detects that the window is closing. The
 * dialog's returnValue property, if any, should be set prior to
 * whatever causes the window to be closed.
 *
 * The windows created by DialogWindow are NOT modal.
 *
 * This class was created for a few reasons.
 * - showModalDialog creates a window and allows the opener to pass
 *   and retrieve a value from the dialog window in a single
 *   synchronous call. However, the dialog window does not have direct
 *   access to the chrome.* APIs. Additionally, asynchronous events
 *   started by the dialog in the background page (e.g., setTimeout,
 *   XMLHttpRequest) do not ever complete.
 * - Access to the JavaScript context of a window opened via
 *   chrome.windows.create is non-trivial. The logic is now
 *   encapsulated in this class.
 *
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {string} aUrl URL (relative to extension directory) to be
 *    opened as a dialog window.
 * @param {*=} opt_argument Argument to pass to the dialog window.
 * @param {?function(!DejaClick.DialogWindow)=} opt_createdCb Optional
 *    function to invoke when the dialog window is opened.
 * @param {?Function=} opt_closedCb Optional function to invoke when
 *    the dialog window has been closed. The result, if any, is passed
 *    to this function.
 * @param {!DejaClick.Logger=} opt_logger Means of logging messages.
 * @param {!chrome.WindowsApi=} opt_windowsApi The chrome.windows API.
 * @param {!chrome.ExtensionApi=} opt_extensionApi The chrome.extension API.
 */
DejaClick.DialogWindow = function (aUrl, opt_argument, opt_createdCb,
      opt_closedCb, opt_logger, opt_windowsApi, opt_extensionApi) {
   var tabs, extension, url;

   this.m_callback = (opt_closedCb == null) ? null : opt_closedCb;
   this.m_logger = (opt_logger == null) ? DejaClick.utils.logger : opt_logger;
   this.m_windows = (opt_windowsApi == null) ? chrome.windows : opt_windowsApi;
   this.m_events = new DejaClick.EventRegistration().
      addChromeListener(this.m_windows.onRemoved, this.endDialog, this);

   /**
    * ID of window in which the dialog page is displayed.
    * @type {?integer}
    */
   this.m_windowId = null;
   /**
    * ID of tab in which the dialog page is displayed.
    * @type {?integer}
    */
   this.m_tabId = null;
   /**
    * Global object (window) for the dialog page.
    * @type {?Window}
    */
   this.m_view = null;

   this.m_positioned = false;

   extension = (opt_extensionApi == null) ? chrome.extension : opt_extensionApi;
   url = extension.getURL(aUrl);
   this.m_windows.create({
      url: url,
      focused: true,
      incognito: false,
      type: 'popup'
   }, this.setWindow.bind(this, url,
         ((opt_argument == null) ? null : opt_argument),
         ((opt_createdCb == null) ? null : opt_createdCb),
         this.m_windows,
         extension));
};

DejaClick.DialogWindow.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.DialogWindow,

   /**
    * Close the DialogWindow object. This closes the dialog window if it is
    * still open. It also releases any references to external objects.
    * No callbacks are made.
    * @this {!DejaClick.DialogWindow}
    */
   close: function () {
      if (this.hasOwnProperty('m_events')) {
         this.m_events.close();
      }
      if (this.hasOwnProperty('m_windowId') &&
            (this.m_windowId !== null) &&
            this.hasOwnProperty('m_windows')) {
         this.m_windows.remove(this.m_windowId);
      }
      delete this.m_view;
      delete this.m_tabId;
      delete this.m_windowId;
      delete this.m_events;
      delete this.m_windows;
      delete this.m_logger;
      delete this.m_callback;
   },

   /**
    * Get the id of the window containing the document.
    * @this {!DejaClick.DialogWindow}
    * @return {?integer} The id of the window. May be null if the window
    *    has not yet been created.
    */
   getWindowId: function () {
      return this.m_windowId;
   },

   /**
    * Get the id of the tab containing the document.
    * @this {!DejaClick.DialogWindow}
    * @return {?integer} The id of the tab. May be null if the window
    *    has not yet been created.
    */
   getTabId: function () {
      return this.m_tabId;
   },

   /**
    * Get the JavaScript context (i.e., the global window object) for
    * the document.
    * @this {!DejaClick.DialogWindow}
    * @return {?Window} The global object for the document. May be null
    *    if the document has not yet been created.
    */
   getView: function () {
      return this.m_view;
   },

   /**
    * Name of property on dialog window's view containing the
    * preferred width of the dialog (in pixels).
    * @const
    */
   WIDTH: 'preferredWidth',

   /**
    * Name of property on dialog window's view containing the
    * preferred height of the dialog (in pixels).
    * @const
    */
   HEIGHT: 'preferredHeight',

   /**
    * Name of property on dialog window's view in which to store
    * a function to position the dialog.
    * @const
    */
   POSITION: 'positionDialog',

   /**
    * Center the dialog window on another window. The dimensions of
    * the dialog window are taken from the preferredWidth and
    * preferredHeight properties of the dialog window's view (i.e.,
    * JavaScript window object). If these are not available at the
    * time of this call, a function to perform the repositioning is
    * placed in the positionDialog property of the dialog window's
    * view. If this property exists when the dialog script is loaded,
    * then the dialog script should call this function, passing the
    * desired width and height of the window as arguments.
    *
    * @this {!DejaClick.DialogWindow}
    * @param {!Window} aWindow The JavaScript global object for the
    *    window on which to center the dialog.
    * @return {!DejaClick.DialogWindow} this
    */
   centerOn: function (aWindow) {
      if (this.m_positioned) {
         // Use current dialog dimensions.
         this.centerOnWindow(aWindow, this.m_view.outerWidth,
            this.m_view.outerHeight);

      } else if (this.hasOwnProperty.call(this.m_view, this.WIDTH) &&
            this.hasOwnProperty.call(this.m_view, this.HEIGHT)) {
         // Use preferred dialog window dimensions.
         this.centerOnWindow(aWindow, this.m_view[this.WIDTH],
            this.m_view[this.HEIGHT]);

      } else {
         // Defer positioning until preferred dimensions are loaded.
         // It is now the responsibility of the dialog window to
         // call window.positionDialog(width, height).
         this.m_view[this.POSITION] = this.centerOnWindow.bind(this, aWindow);
      }
      return this;
   },

   /**
    * Center the dialog window on another window.
    * Called either from centerOn or the dialog window itself once
    * its preferred dimensions are loaded.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {!Window} aWindow The window on which to center the dialog.
    * @param {integer} aWidth The desired width of the dialog window.
    * @param {integer} aHeight The desired height of the dialog window.
    */
   centerOnWindow: function (aWindow, aWidth, aHeight) {
      var left, top;

      if ((this.m_windows == null) || (this.m_windowId == null)) {
         // The DialogWindow has been closed.
         return;
      }

      left = aWindow.screenX + (aWindow.outerWidth - aWidth) / 2;
      left = (left < 0) ? 0 : Math.floor(left);
      top = aWindow.screenY + (aWindow.outerHeight - aHeight) / 2;
      top = (top < 0) ? 0 : Math.floor(top);
      this.m_windows.update(this.m_windowId, {
         left: left,
         top: top,
         width: aWidth,
         height: aHeight,
         focused: true,
         state: 'normal'
      });
      this.m_positioned = true;
   },

   /**
    * Center the dialog window on the screen. The dimensions of the
    * dialog window are taken from the preferredWidth and
    * preferredHeight properties of the dialog window's view (i.e.,
    * JavaScript window object). If these are not available at the
    * time of this call, a function to perform the repositioning is
    * placed in the positionDialog property of the dialog window's
    * view. If the property exists when the dialog script is loaded,
    * then the dialog script should call this function, passing the
    * desired width and height of the window as arguments.
    * @this {!DejaClick.DialogWindow}
    * @return {!DejaClick.DialogWindow} this
    */
   center: function () {
      if (this.m_positioned) {
         // Use current dialog dimensions.
         this.centerOnScreen(this.m_view.outerWidth, this.m_view.outerHeight);
      } else if (this.hasOwnProperty.call(this.m_view, this.WIDTH) &&
            this.hasOwnProperty.call(this.m_view, this.HEIGHT)) {
         // Use preferred dialog window dimensions.
         this.centerOnScreen(this.m_view[this.WIDTH], this.m_view[this.HEIGHT]);
      } else {
         // Defer positioning until preferred dimensions are loaded.
         // It is now the responsibility of the dialog window to
         // call window.positionDialog(width, height).
         this.m_view[this.POSITION] = this.centerOnScreen.bind(this);
      }
      return this;
   },

   /**
    * Center the dialog on the screen.
    * Called from either center or the dialog window itself once its
    * preferred dimensions have been loaded.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {integer} aWidth The desired width of the dialog window.
    * @param {integer} aHeight The desired height of the dialog window.
    */
   centerOnScreen: function (aWidth, aHeight) {
      var screen, left, top;

      if ((this.m_windows == null) ||
            (this.m_windowId == null) ||
            (this.m_view == null)) {
         // The DialogWindow has been closed.
         return;
      }

      screen = this.m_view.screen;
      left = screen.availLeft + (screen.availWidth - aWidth) / 2;
      left = (left < 0) ? 0 : Math.floor(left);
      top = screen.availTop + (screen.availHeight - aHeight) / 2;
      top = (top < 0) ? 0 : Math.floor(top);
      this.m_windows.update(this.m_windowId, {
         left: left,
         top: top,
         width: aWidth,
         height: aHeight,
         focused: true,
         state: 'normal'
      });
      this.m_positioned = true;
   },

   /**
    * Position the dialog window next to an existing window. The
    * dimensions of the dialog window are taken from the
    * preferredWidth and preferredHeight properties of the dialog
    * window's view (i.e., JavaScript window object). If these are not
    * available at the time of this call, a function to perform the
    * repositioning is placed in the positionDialog property of the
    * dialogs window's view. If this property exists when the dialog
    * script is loaded, then the dialog script should call this
    * function.
    *
    * @this {!DejaClick.DialogWindow}
    * @param {integer} aWindowId The id of the window to anchor the popup.
    * @param {string} aSide The side of the window on which the popup
    *    should be placed, either 'top', 'bottom', 'left', or 'right'.
    * @return {!DejaClick.DialogWindow} this
    */
   dock: function (aWindowId, aSide) {
      this.m_windows.get(aWindowId, {},
         this.placeWindow.bind(this, aSide));
      return this;
   },

   /**
    * Position the dialog window next to an existing window.
    * Called asynchronously in response to completion of chrome.windows.get.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {string} aSide The side of the window on which the popup
    *    should be placed, either 'top', 'bottom', 'left', or 'right'.
    * @param {!chrome.Window=} opt_window Details of the window to
    *    anchor the popup.
    */
   placeWindow: function (aSide, opt_window) {
      var dockFunc, currWidth, currHeight, updateInfo;
      try {
         if ((opt_window == null) ||
               (this.m_windows == null) ||
               (this.m_windowId == null)) {
            // Either the supplied window id was invalid or the
            // DialogWindow has been closed.
            return;
         }

         switch (aSide) {
         case 'top':
            dockFunc = this.dockToTop;
            break;
         case 'bottom':
            dockFunc = this.dockToBottom;
            break;
         case 'left':
            dockFunc = this.dockToLeft;
            break;
         case 'right':
            dockFunc = this.dockToRight;
            break;
         default:
            throw new Error('Invalid dock side: ' + aSide);
         }

         if (this.m_positioned) {
            // Use current dialog window dimensions.
            dockFunc.call(this, opt_window,
               this.m_view.outerWidth, this.m_view.outerHeight);

         } else if (this.hasOwnProperty.call(this.m_view, this.WIDTH) &&
               this.hasOwnProperty.call(this.m_view, this.HEIGHT)) {
            // Use preferred dialog window dimensions.
            dockFunc.call(this, opt_window, this.m_view[this.WIDTH],
               this.m_view[this.HEIGHT]);

         } else {
            // Defer positioning until preferred dimensions are loaded.
            // It is now the responsibility of the dialog window to
            // call window.positionDialog(width, height).
            this.m_view[this.POSITION] = dockFunc.bind(this, opt_window);
         }

      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Dock the dialog window to the top side of another window.
    * Called either from placeWindow or the dialog window itself once
    * its preferred dimensions are loaded.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {!chrome.Window} aWindow The window to which to dock the dialog.
    * @param {integer} aWidth The desired width of the dialog window.
    * @param {integer} aHeight The desired height of the dialog window.
    */
   dockToTop: function (aWindow, aWidth, aHeight) {
      var top;

      if ((this.m_windows == null) || (this.m_windowId == null)) {
         // The DialogWindow has been closed.
         return;
      }
      top = aWindow.top - aHeight;
      if (top < 0) {
         top = 0;
      }
      this.m_windows.update(this.m_windowId, {
         left: aWindow.left,
         top: top,
         width: aWindow.width,
         height: aHeight,
         focused: true,
         state: 'normal'
      });
      this.m_positioned = true;
   },

   /**
    * Dock the dialog window to the bottom side of another window.
    * Called either from placeWindow or the dialog window itself once
    * its preferred dimensions are loaded.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {!chrome.Window} aWindow The window to which to dock the dialog.
    * @param {integer} aWidth The desired width of the dialog window.
    * @param {integer} aHeight The desired height of the dialog window.
    */
   dockToBottom: function (aWindow, aWidth, aHeight) {
      if ((this.m_windows == null) || (this.m_windowId == null)) {
         // The DialogWindow has been closed.
         return;
      }
      this.m_windows.update(this.m_windowId, {
         left: aWindow.left,
         top: aWindow.top + aWindow.height,
         width: aWindow.width,
         height: aHeight,
         focused: true,
         state: 'normal'
      });
      this.m_positioned = true;
   },

   /**
    * Dock the dialog window to the left side of another window.
    * Called either from placeWindow or the dialog window itself once
    * its preferred dimensions are loaded.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {!chrome.Window} aWindow The window to which to dock the dialog.
    * @param {integer} aWidth The desired width of the dialog window.
    * @param {integer} aHeight The desired height of the dialog window.
    */
   dockToLeft: function (aWindow, aWidth, aHeight) {
      var left;

      if ((this.m_windows == null) || (this.m_windowId == null)) {
         // The DialogWindow has been closed.
         return;
      }
      left = aWindow.left - aWidth;
      if (left < 0) {
         left = 0;
      }
      this.m_windows.update(this.m_windowId, {
         left: left,
         top: aWindow.top,
         width: aWidth,
         height: aWindow.height,
         focused: true,
         state: 'normal'
      });
      this.m_positioned = true;
   },

   /**
    * Dock the dialog window to the right side of another window.
    * Called either from placeWindow or the dialog window itself once
    * its preferred dimensions are loaded.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {!chrome.Window} aWindow The window to which to dock the dialog.
    * @param {integer} aWidth The desired width of the dialog window.
    * @param {integer} aHeight The desired height of the dialog window.
    */
   dockToRight: function (aWindow, aWidth, aHeight) {
      if ((this.m_windows == null) || (this.m_windowId == null)) {
         // The DialogWindow has been closed.
         return;
      }
      this.m_windows.update(this.m_windowId, {
         left: aWindow.left + aWindow.width,
         top: aWindow.top,
         width: aWidth,
         height: aWindow.height,
         focused: true,
         state: 'normal'
      });
      this.m_positioned = true;
   },

   /**
    * Time to wait (in milliseconds) between attempts to find the
    * JavaScript window object of the dialog window.
    * @const
    */
   POLL_INTERVAL: 50,

   /**
    * Maximum time (in milliseconds) permitted for finding the
    * JavaScript window object of the dialog window.
    * @const
    */
   MAX_POLL_TIME: 1000,

   /**
    * Name of the optional function in the dialog window to be called
    * when the dialog arguments are available.
    * @const
    */
   argumentHandler: 'onDialogArguments',

   /**
    * Record the window and tab details of the dialog. Find the global
    * object (view) for the dialog page and pass the argument to the
    * dialog. Invoke the "onCreated" callback. Called when the dialog
    * window is created.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {string} aUrl The absolute URL of the dialog.
    * @param {*} aArgument Argument to pass to the dialog window.
    * @param {?function(!DejaClick.DialogWindow)} aCreatedCb Optional
    *    function to invoke when the dialog window is opened.
    * @param {!chrome.WindowsApi} aWindowsApi The chrome.windows API.
    *    This is only needed in the event that the DialogWindow object
    *    has been closed before this callback occurs.
    * @param {!chrome.ExtensionApi} aExtensionApi The chrome.extension API.
    * @param {!chrome.Window} aWindow Details of the dialog window.
    */
   setWindow: function (aUrl, aArgument, aCreatedCb,
         aWindowsApi, aExtensionApi, aWindow) {
      var index, tab, callback, triesRemaining,
         /** @type {!DejaClick.DialogWindow} */ self;

      /**
       * Search for the global JavaScript object (e.g., window) of the
       * dialog window. This may not be available yet when the
       * window.onCreated event is received, so poll for a bit to find
       * them.
       */
      function findView() {
         var views, index, callback;

         try {
            if (self.m_logger == null) {
               // Presumably, the DialogWindow was already closed.
               return;
            }

            views = aExtensionApi.getViews({ windowId: aWindow.id });
            index = views.length;
            while (index !== 0) {
               --index;
               if (views[index].location == null) {
                  // No location. Cannot match.
               } else if (views[index].location.href === aUrl) {
                  self.m_view = views[index];
                  self.m_view.dialogArguments = aArgument;
                  if (self.m_view.hasOwnProperty(self.argumentHandler)) {
                     self.m_view[self.argumentHandler]();
                  }
                  if (aCreatedCb !== null) {
                     aCreatedCb(self);
                  }
                  return;
               }
            }

            triesRemaining -= 1;
            if (triesRemaining <= 0) {
               self.m_logger.logFailure('Could not find view for ' + aUrl);
               callback = self.m_callback;
               self.close();
               if (callback !== null) {
                  callback(null);
               }
            } else {
               window.setTimeout(findView, 50);
            }

         } catch (/** @type {!Error} */ ex) {
            self.m_logger.logException(ex);
         }
      }

      try {
         if (this.m_logger == null) {
            // Presumably, the DialogWindow object was already closed.
            // Close the window.
            aWindowsApi.remove(aWindow.id);
            return;
         }

         this.m_windowId = aWindow.id;

         index = aWindow.tabs.length;
         while (index !== 0) {
            --index;
            tab = aWindow.tabs[index];
            //UXM-10769 - It seems that Chrome 79 has changed when the "tab.url" field is defined,
            //as the url field is empty but "pendingUrl" has the expected value.
            //So, adding an OR to consider both options as valid.
            if (tab.url === aUrl || tab.pendingUrl === aUrl ) {
               this.m_tabId = tab.id;
               break;
            }
         }

         if (this.m_tabId == null) {
            this.m_logger.logFailure('Could not find tab for window ' + aUrl);
            callback = this.m_callback;
            this.close();
            if (callback !== null) {
               callback(null);
            }
         }

         self = this;
         triesRemaining = this.MAX_POLL_TIME / this.POLL_INTERVAL;
         findView();

      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Detect the closing of the dialog window. Forward the return
    * value to the opener and close the DialogWindow object.
    * @private
    * @this {!DejaClick.DialogWindow}
    * @param {integer} aWindowId Id of the window that was closed.
    */
   endDialog: function (aWindowId) {
      var value, callback;

      try {
         if (aWindowId === this.m_windowId) {
            value = (this.m_view == null) ? null : this.m_view.returnValue;
            callback = this.m_callback;
            this.m_windowId = null;
            this.close();

            if (callback !== null) {
               callback(value);
            }
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   }
};
