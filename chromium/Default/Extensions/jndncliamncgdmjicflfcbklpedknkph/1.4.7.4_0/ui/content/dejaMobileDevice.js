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

/**
 * Preferred width of the add/edit mobile device dialog.
 * @const
 */
var preferredWidth = 400;

/**
 * Preferred height of the add/edit mobile device dialog.
 * @const
 */
var preferredHeight = 550;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = null;

/**
 * Class to encapsulate the functionality of adding/editing mobile devices
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {{ device: !Object,
 *    deviceManager: {isNameExist: Function}
 * }} aOptions The options passed to the dialog.
 * @param {!Element} aRootElement The parent element of the page's UI.
 *    This is typically the documentElement.
 * @param {!Window} aWindow The window object.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {
 *    function(new:DejaClick.DialogWindow,
 *       string,
 *       *,
 *       function(!DejaClick.DialogWindow),
 *       function(*),
 *       !DejaClick.Logger)
 * } ADialogWindow  The DialogWindow constructor.
 */

DejaClickUi.MobileDevice = function (aOptions, aRootElement,
                                 aWindow, aConstants, aUtils, ADialogWindow) {
   var root;

   aWindow.returnValue = null;

   this.device = aOptions.device;
   this.deviceManager = aOptions.deviceManager;
   this.window = aWindow;
   this.constants = aConstants;
   this.utils = aUtils;
   this.DialogWindow = ADialogWindow;

   /**
    * The "modal" dialog window opened by this page.
    * @type {?DejaClick.DialogWindow}
    */
   this.dialog = null;

   // Find/create UI elements.
   root = $(aRootElement);
   this.elements = {
      title: root.find('title'),

      deviceName: root.find('#deviceName'),
      userAgent: root.find('#userAgent'),

      deviceWidth: root.find('#deviceWidth'),
      deviceHeight: root.find('#deviceHeight'),

      supportsFlash: root.find('#supportsFlash'),
      supportsXhtml: root.find('#supportsXhtml'),

      apply: root.find('#apply'),
      cancel: root.find('#cancel'),

      allInputs: root.find('input'),
      allButtons: root.find('button')
   };

   // Initialize buttons.
   this.elements.allButtons.button();

   // Initialize event handlers.
   this.elements.cancel.on('click', this.cancel.bind(this));
   this.elements.apply.on('click', this.apply.bind(this));

   this.elements.allInputs.on('change input', this.enableControls.bind(this));

   // Display initial values in UI.
   aUtils.localizeTree(aRootElement, 'deja_');
   this.init();

};

DejaClickUi.MobileDevice.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.MobileDevice,

   /**
    * Initialize the UI
    * @this {!DejaClickUi.MobileDevice}
    */
   init: function() {
      var d, height, width;

      try {
         d = this.device;
         height = d && d.size && d.size.height || this.constants.MOBILEDEVICE_HEIGHT_MIN;
         width = d && d.size && d.size.width || this.constants.MOBILEDEVICE_WIDTH_MIN;

         this.elements.title.text(this.utils.getMessage('deja_device_title'));

         this.elements.deviceName.val(d && d.name || '');
         this.elements.userAgent.val(d && d.userAgent || '');

         this.elements.deviceWidth
            .prop('min', this.constants.MOBILEDEVICE_WIDTH_MIN)
            .prop('max', this.constants.MOBILEDEVICE_WIDTH_MAX)
            .prop('placeholder', this.constants.MOBILEDEVICE_WIDTH_MIN)
            .val(width);
         this.elements.deviceHeight
            .prop('min', this.constants.MOBILEDEVICE_HEIGHT_MIN)
            .prop('max', this.constants.MOBILEDEVICE_HEIGHT_MAX)
            .prop('placeholder', this.constants.MOBILEDEVICE_HEIGHT_MIN)
            .val(height);

         this.elements.supportsFlash
            .prop('checked', d && d.FlashSupport);
         this.elements.supportsXhtml
            .prop('checked', d && d.XHTMLSupport);

         this.enableControls();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * page.
    * @this {!DejaClickUi.MobileDevice}
    */
   close: function () {
      try {
         if (this.hasOwnProperty('elements')) {
            this.elements.allInputs.off('change input');
            this.elements.allButtons.off('click').button('destroy');
         }

         if (this.hasOwnProperty('dialog') && (this.dialog !== null)) {
            this.dialog.close();
            this.dialog = null;
         }

         delete this.elements;
         delete this.dialog;
         delete this.DialogWindow;
         delete this.utils;
         delete this.constants;
         delete this.window;
         delete this.deviceManager;
         delete this.device;
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Apply the changes to this mobile device. Close the window.
    * @this {!DejaClickUi.MobileDevice}
    * @param {!Event} aEvent A jQuery click event on the apply button.
    */
   apply: function (aEvent) {
      var win, device, deviceName;

      try {
         deviceName = this.elements.deviceName.val();

         if (this.deviceManager.isNameExist(deviceName) == false || this.device && this.device.name === deviceName) {
            device = {
               name: this.elements.deviceName.val(),
               isActive: true,
               userAgent: this.elements.userAgent.val(),
               XHTMLSupport: this.elements.supportsXhtml.prop('checked'),
               FlashSupport: this.elements.supportsFlash.prop('checked'),
               size: {
                  height: +this.elements.deviceHeight.val(),
                  width: +this.elements.deviceWidth.val()
               }
            };

            this.window.returnValue = device;

            win = this.window;
            this.close();
            win.close();
         } else {
            this.utils.promptService.notifyUser('deja_device_deviceNameExists', true);
         }
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Close the dialog, discarding any changes.
    * @this {!DejaClickUi.MobileDevice}
    * @param {!Event} aEvent A jQuery click event on the cancel button.
    */
   cancel: function (aEvent) {
      var win;

      try {
         win = this.window;
         this.close();
         win.close();
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the controls in this dialog.
    * @this {!DejaClickUi.MobileDevice}
    */
   enableControls: function () {
      var width, height, isNameEmpty, isUserAgentEmpty, isWidthInvalid,
         isHeightInvalid;

      try {
         width = this.elements.deviceWidth.val();
         height = this.elements.deviceHeight.val();

         isNameEmpty = this.elements.deviceName.val().length === 0;
         isUserAgentEmpty = this.elements.userAgent.val().length === 0;

         isWidthInvalid = width.length === 0 || isNaN(width) ||
            +width < this.constants.MOBILEDEVICE_WIDTH_MIN ||
            +width > this.constants.MOBILEDEVICE_WIDTH_MAX;

         isHeightInvalid = width.length === 0 || isNaN(height) ||
            +height < this.constants.MOBILEDEVICE_HEIGHT_MIN ||
            +height > this.constants.MOBILEDEVICE_HEIGHT_MAX;

         this.elements.apply.button('option', 'disabled',
               isNameEmpty || isUserAgentEmpty || isWidthInvalid || isHeightInvalid);
      } catch (ex) {
         this.utils.logger.logException(ex);
      }
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} aEvent A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('mobileDevice')) {
            DejaClickUi.mobileDevice.close();
            delete DejaClickUi.mobileDevice;
         }

         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   /**
    * Create and initialize the MobileDevice instance once the
    * page is loaded and the dialog arguments are available.
    */
   function initialize() {
      try {
         DejaClickUi.mobileDevice = new DejaClickUi.MobileDevice(
            window.dialogArguments,
            document.documentElement,
            window,
            DejaClick.constants,
            DejaClick.utils,
            DejaClick.DialogWindow);
         $(window).on('unload', unload);
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      if (window.hasOwnProperty('dialogArguments')) {
         initialize();
      } else {
         window.onDialogArguments = initialize;
      }
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});