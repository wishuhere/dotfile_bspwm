/* -*- Mode: Javascript; tab-width: 3; indent-tabs-mode: nil; c-basic-offset: 3 -*- */
/*
* DejaClick by SmartBear Software.
* Copyright (C) 2006-2022 SmartBear Software.  All Rights Reserved.
*
* The contents of this file are subject to the End User License Agreement.
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*/

/*
 * Dialog to select the REST endpoint selection.
 * Input: {} None
 * Output: {string} The selected REST endpoint.
 */

/*global window,DejaClickUi,$,document,DejaClick*/

'use strict';

/**
 * Preferred width of the connection dialog.
 * @const
 */
var preferredWidth = 425;
/**
 * Preferred height of the connection dialog.
 * @const
 */
var preferredHeight = 160;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = '';

/**
 * Class to encapsulate the functionality of the dialog to select the
 * AlertSite REST endpoint.
 * @constructor
 * @param {!DejaClick.Utils} The background page's utilities object.
 */
DejaClickUi.Connect = function (aUtils) {
   // Get references to frequently used background objects.
   this.logger = aUtils.logger;
   this.prefService = aUtils.prefService;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;

   window.returnValue = this.prefService.getPrefOption('DC_OPTID_RESTENDPOINT');

   // Initialize UI.
   this.elements = {
      connectionInput: $('#connectionInput'),
      okButton: $('#okButton'),
      cancelButton: $('#cancelButton'),
      allButtons: $('button')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   this.buildComboBox();
   this.elements.allButtons.button();
   this.elements.okButton.on('click', this.selectEndpoint.bind(this));
   this.elements.cancelButton.on('click', this.cancelDialog.bind(this));

   this.elements.connectionInput.focus();
};

DejaClickUi.Connect.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.Connect,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * dialog.
    * @this {!DejaClickUi.Connect}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.allButtons.off('click').button('destroy');
         this.elements.connectionInput.autocomplete('destroy');
      }

      delete this.elements;
      delete this.getMessage;
      delete this.restApi;
      delete this.prefService;
      delete this.logger;
   },

   /**
    * Determine the set of possible REST endpoints and create a combo
    * box with these choices.
    * @this {!DejaClickUi.Connect}
    */
   buildComboBox: function () {
      var endpoints, endpoint, selected, index, selectElt, optionElt;

      endpoints = this.prefService.getPrefOption('DC_OPTID_RESTENDPOINTS').
         slice();

      endpoint = this.prefService.getPrefOption('DC_OPTID_RESTENDPOINT');
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
      this.prefService.setPrefOption('DC_OPTID_RESTENDPOINTS', endpoints);

      this.elements.connectionInput.autocomplete({
         source: endpoints,
         minLength: 0
      }).val(selected);
   },

   /**
    * Select a new endpoint. Validate it and update the current
    * endpoint preference setting. Also ensure that the new endpoint
    * is in the list of known endpoints. Close the window if successful.
    * @this {!DejaClickUi.Connect}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   selectEndpoint: function (aEvent) {
      var endpoint, endpoints;

      try {
         endpoint = this.elements.connectionInput.val();
         if (endpoint.length === 0) {
            window.alert(this.getMessage('deja_connect_missingendpoint'));

         } else {
            this.prefService.setPrefOption('DC_OPTID_RESTENDPOINT', endpoint);

            endpoints = this.prefService.
               getPrefOption('DC_OPTID_RESTENDPOINTS').slice();
            if (endpoints.indexOf(endpoint) === -1) {
               endpoints.push(endpoint);
               endpoints.sort();
               this.prefService.setPrefOption('DC_OPTID_RESTENDPOINTS',
                  endpoints);
            }
            window.returnValue = endpoint;
            window.close();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window.
    * @this {!DejaClickUi.Connect}
    * @param {!Event} aEvent A click event on the Cancel button.
    */
   cancelDialog: function (aEvent) {
      try {
         window.close();
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
         if (DejaClickUi.hasOwnProperty('connect')) {
            DejaClickUi.connect.close();
            delete DejaClickUi.connect;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      DejaClickUi.connect = new DejaClickUi.Connect(DejaClick.utils);
      $(window).on('unload', unload);
   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
