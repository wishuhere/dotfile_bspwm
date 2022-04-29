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
 * Dialog to display version information about the DejaClick extension.
 * There are no inputs or outputs.
 */

/*global window,DejaClickUi,$,DejaClick,document*/

'use strict';

/**
 * Preferred width of the About DejaClick dialog.
 * @const
 */
var preferredWidth = 315;
/**
 * Preferred height of the About DejaClick dialog.
 * @const
 */
var preferredHeight = 480;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}


/**
 * Manage the About DejaClick dialog window.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 */
DejaClickUi.About = function (aRootElement, aWindow, aUtils) {
   var root, version, buildId;

   this.window = aWindow;
   this.logger = aUtils.logger;

   // Initialize the UI.
   aUtils.localizeTree(aRootElement, 'deja_');

   root = $(aRootElement);

   this.elements = {
      root: root,
      toggle: root.find('.toggle')
   };
   root.find('.sysInfo').hide();

   root.find('.toggleButton').button().
      on('click', this.toggleDisplay.bind(this));
   root.find('#okButton').button().on('click', this.closeWindow.bind(this));

   // Fill in version info.
   version = aUtils.versionInfo;
   root.find('#extVersion').text(version.extension.version);
   buildId = version.extension.buildid;
   root.find('#extBuildId').text(buildId);
   root.find('#extName').prop('value', version.extension.name);
   root.find('#extVersionInput').prop('value', version.extension.version);
   root.find('#extBuildIdInput').prop('value', buildId);
   root.find('#appName').prop('value', version.application.name);
   root.find('#appVersion').prop('value', version.application.version);
   root.find('#platformName').prop('value', version.platform.name);
   root.find('#platformVersion').prop('value', version.platform.version);
   root.find('#ostype').prop('value', aWindow.navigator.platform);
};

DejaClickUi.About.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.About,

   /**
    * Shut down the dialog, releasing all references to external objects
    * and unregistering all event handlers.
    * @this {!DejaClickUi.About}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.root.find('button').off('click').button('destroy');
      }
      delete this.elements;
      delete this.logger;
      delete this.window;
   },

   /**
    * Switch the display from general about DejaClick information
    * to detailed system information.
    * @this {!DejaClickUi.About}
    * @param {!Event} aEvent A jQuery click event on either the system info
    *    or about info buttons.
    */
   toggleDisplay: function (aEvent) {
      try {
         this.elements.toggle.toggle();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window.
    * @this {!DejaClickUi.About}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   closeWindow: function (aEvent) {
      try {
         this.window.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('about')) {
            DejaClickUi.about.close();
            delete DejaClickUi.about;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   // Create and initialize the About instance once the page is loaded.
   try {
      DejaClickUi.about = new DejaClickUi.About(
         document.documentElement,
         window,
         DejaClick.utils);
      $(window).on('unload', unload);
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
