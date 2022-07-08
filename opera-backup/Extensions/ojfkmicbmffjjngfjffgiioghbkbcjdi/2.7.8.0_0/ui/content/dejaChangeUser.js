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
 * Dialog to change the effective user of the current session with AlertSite.
 * Input: {} None
 * Output: {boolean} true if the effective user was changed, false if not.
 */

/*global window,DejaClickUi,$,document,DejaClick*/

'use strict';

/**
 * Preferred width of the change user dialog.
 * @const
 */
var preferredWidth = 450;
/**
 * Preferred height of the change user dialog.
 * @const
 */
var preferredHeight = 280;

if (window.hasOwnProperty('positionDialog')) {
   window.positionDialog(preferredWidth, preferredHeight);
}

window.returnValue = false;

/**
 * Class to encapsulate the functionality of the AlertSite change user dialog.
 * @constructor
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.ChangeUser = function (aUtils, AEventRegistration) {
   // Get references to frequently used background objects.
   this.logger = aUtils.logger;
   this.restApi = aUtils.restApi;
   this.getMessage = aUtils.getMessage;
   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:restapi',
         this.restActivity, this);

   this.state = {
      submitting: false
   };

   // Initialize UI.
   this.elements = {
      userNameCurrent: $('#userNameCurrent'),
      customerIdCurrent: $('#customerIdCurrent'),
      customerNameCurrent: $('#customerNameCurrent'),
      userIdInput: $('#userIdInput'),
      customerIdInput: $('#customerIdInput'),
      okButton: $('#okButton'),
      cancelButton: $('#cancelButton'),
      allInputs: $('input'),
      allButtons: $('button')
   };

   aUtils.localizeTree(document.documentElement, 'deja_');

   this.elements.userNameCurrent.text(this.restApi.getLogin());
   this.elements.customerIdCurrent.text(this.restApi.getCustomerId());
   this.elements.customerNameCurrent.text(this.restApi.getCompany());

   this.elements.allInputs.on('input', this.handleNewInput.bind(this));
   this.elements.okButton.button().
      on('click', this.changeUser.bind(this));
   this.elements.cancelButton.button().
      on('click', this.cancelDialog.bind(this));

   this.elements.userIdInput.focus();
   this.enableControls();
};

DejaClickUi.ChangeUser.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.ChangeUser,

   /**
    * Shut down the dialog in response to the window being closed.
    * Abort any asynchronous activities and dialogs started by this
    * window and release all references to objects external to this
    * dialog.
    * @this {!DejaClickUi.ChangeUser}
    */
   close: function () {
      if (this.hasOwnProperty('state') &&
            this.state.submitting &&
            this.hasOwnProperty('restApi')) {
         this.state.submitting = false;
         this.restApi.abortRequest();
      }

      if (this.hasOwnProperty('elements')) {
         this.elements.allInputs.off('input');
         this.elements.allButtons.off('click').button('destroy');
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.elements;
      delete this.state;
      delete this.events;
      delete this.getMessage;
      delete this.restApi;
      delete this.logger;
   },

   /**
    * Detect and respond to REST API activity.
    * Called in response to the dejaclick:restapi event.
    * @this {!DejaClickUi.ChangeUser}
    * @param {!{active:boolean, connected:boolean}} aData Whether the
    *    REST API is active and connected.
    */
   restActivity: function (aData) {
      try {
         if (!aData.connected) {
            window.close();
         } else {
            this.enableControls();
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the UI controls in reaction to entering some data in the
    * text fields.
    * @this {!DejaClickUi.ChangeUser}
    * @param {!Event} aEvent A jQuery input event on an input element.
    */
   handleNewInput: function (aEvent) {
      try {
         this.enableControls();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Asynchronously change the effective user of the current AlertSite session.
    * @this {!DejaClickUi.ChangeUser}
    * @param {!Event} aEvent A jQuery click event on the OK button.
    */
   changeUser: function (aEvent) {
      var userId, customerId, error;
      try {
         userId = this.elements.userIdInput.val();
         customerId = this.elements.customerIdInput.val();
         if ((userId.length === 0) && (customerId.length === 0)) {
            window.alert(this.getMessage('deja_changeuser_invalidInput'));

         } else {
            error = this.restApi.changeUser(userId, customerId,
               this.completeChangeUser.bind(this));
            if (error.length !== 0) {
               window.alert(error);
            } else {
               this.state.submitting = true;
              
            }
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Complete an asynchronous change user operation.
    * Closes the dialog.
    * @this {!DejaClickUi.ChangeUser}
    * @param {string} aError The empty string if successful. A description
    *    of the error if not.
    */
   completeChangeUser: function (aError) {
      try {
         this.state.submitting = false;
         if (aError.length !== 0) {
            window.alert(aError);

         } else {
            window.returnValue = true;
            window.alert(this.getMessage('deja_changeuser_successful',
               [ this.restApi.getLogin(), this.restApi.getCustomerId() ]));
         }
         DejaClick.service.__modal.close(window.returnValue);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Close the window.
    * @this {!DejaClickUi.ChangeUser}
    * @param {!Event} aEvent A jQuery click event on the Cancel button.
    */
   cancelDialog: function (aEvent) {
      try {
      //    window.close();
         DejaClick.service.__modal.close();
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Enable or disable the OK button based upon the state of
    * the REST API and the current input values.
    * Called when the dejaclick:restapi event or the input element
    * change events are triggered.
    * @this {!DejaClickUi.ChangeUser}
    */
   enableControls: function () {
      this.elements.okButton.button('option', 'disabled',
         this.restApi.isActive() ||
            ((this.elements.userIdInput.val().length === 0) &&
               (this.elements.customerIdInput.val().length === 0)));
   }
};

$(function () {
   /**
    * Clean up when the page is unloaded.
    * @param {!Event} A jQuery unload event on the window.
    */
   function unload(aEvent) {
      try {
         if (DejaClickUi.hasOwnProperty('changeUser')) {
            DejaClickUi.changeUser.close();
            delete DejaClickUi.changeUser;
         }
         $(window).off('unload');
      } catch (ex) {
         DejaClick.utils.logger.logException(ex);
      }
   }

   try {
      DejaClickUi.changeUser = new DejaClickUi.ChangeUser(DejaClick.utils,
         DejaClick.EventRegistration);
      $(window).on('unload', unload);
      DejaClick.service.__modal.resizeModal($('body').outerHeight() + 50);
      DejaClick.service.__modal.setTitle('deja_sidebar_changeUserItem');

   } catch (ex) {
      DejaClick.utils.logger.logException(ex);
   }
});
