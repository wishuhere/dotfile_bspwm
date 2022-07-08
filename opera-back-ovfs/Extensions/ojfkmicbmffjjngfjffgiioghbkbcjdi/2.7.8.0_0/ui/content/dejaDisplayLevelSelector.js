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

/*global DejaClickUi,$*/

'use strict';

/**
 * DisplayLevelSelector inserts a UI into an element that allows users
 * to see and to change the display level of the extension. The client
 * that constructs the selector may also be notified when the display
 * level changes.
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {string} aNamespace Prefix to allow the ids of contained
 *    elements to be unique.
 * @param {!Element} aParent The DOM element within which the UI will
 *    be created.
 * @param {?function(integer)} aNotify Optional callback invoked
 *    whenever the display level is changed.
 * @param {!Object.<string,*>} aConstants The global set of constants
 *    from the background page.
 * @param {!DejaClick.Utils} aUtils The background page's utilities object.
 * @param {function(new:DejaClick.EventRegistration)} AEventRegistration
 *    The event registration constructor.
 */
DejaClickUi.DisplayLevelSelector = function (aNamespace, aParent, aNotify,
      aConstants, aUtils, AEventRegistration) {
   var selectId, doc;

   this.notify = (aNotify == null) ? null : aNotify;
   this.constants = aConstants;
   this.logger = aUtils.logger;
   this.prefService = aUtils.prefService;

   // Listen for preference changes.
   this.events = new AEventRegistration().
      addDejaListener(aUtils.observerService, 'dejaclick:preferences',
         this.displayPreferenceChange, this);

   // Create the UI.
   selectId = aNamespace + '.displayLevel';
   doc = aParent.ownerDocument;
   this.elements = {
      label: $(doc.createElement('label')).
         attr('for', selectId).
         text(aUtils.getMessage('deja_global_displayLevel')),
      select: $(doc.createElement('select')).attr('id', selectId),
      basic: $(doc.createElement('option')).
         text(aUtils.getMessage('deja_global_displayLevel_basic')).
         attr('value', 'DISPLAYLEVEL_BASIC'),
      advanced: $(doc.createElement('option')).
         text(aUtils.getMessage('deja_global_displayLevel_advanced')).
         attr('value', 'DISPLAYLEVEL_ADVANCED'),
      diagnostic: null
   };

   this.elements.select.append(this.elements.basic);
   this.elements.select.append(this.elements.advanced);
   if (this.prefService.getPrefOption('DC_OPTID_DIAGNOSTICMODE')) {
      this.elements.diagnostic = $(doc.createElement('option')).
         text(aUtils.getMessage('deja_global_displayLevel_diagnostic')).
         attr('value', 'DISPLAYLEVEL_DIAGNOSTIC');
      this.elements.select.append(this.elements.diagnostic);
   }
   $(aParent).append([ this.elements.label, this.elements.select ]);

   this.elements.select.on('change', this.setDisplayLevel.bind(this));

   this.displayLevel(this.prefService.getPrefOption('DC_OPTID_DISPLAYLEVEL'));
};

DejaClickUi.DisplayLevelSelector.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClickUi.DisplayLevelSelector,

   /**
    * Clean up the JavaScript objects used by the selector.
    * @this {!DejaClickUi.DisplayLevelSelector}
    */
   close: function () {
      if (this.hasOwnProperty('elements')) {
         this.elements.select.off('change');
      }

      if (this.hasOwnProperty('events')) {
         this.events.close();
      }

      delete this.elements;
      delete this.events;
      delete this.prefService;
      delete this.logger;
      delete this.constants;
      delete this.notify;
   },

   /**
    * Change the extension's display level in response to a change in the UI.
    * @private
    * @this {!DejaClickUi.DisplayLevelSelector}
    * @param {!Event} aEvent A jQuery change event on the display level
    *    select element.
    */
   setDisplayLevel: function (aEvent) {
      try {
         this.prefService.setPrefOption('DC_OPTID_DISPLAYLEVEL',
            this.constants[this.elements.select.val()]);
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the UI in response to a changed preference item.
    * @private
    * @this {!DejaClickUi.DisplayLevelSelector}
    * @param {!{key:string, newValue:*, oldValue:*}} aData Details of the
    *    modified preference value.
    */
   displayPreferenceChange: function (aData) {
      try {
         if (aData.key === 'DC_OPTID_DISPLAYLEVEL') {
            this.displayLevel(aData.newValue);
         }
      } catch (ex) {
         this.logger.logException(ex);
      }
   },

   /**
    * Update the UI to show the current display level.
    * @private
    * @this {!DejaClickUi.DisplayLevelSelector}
    * @param {integer} aLevel The current display level.
    */
   displayLevel: function (aLevel) {
      if (aLevel === this.constants.DISPLAYLEVEL_ADVANCED) {
         this.elements.advanced.prop('selected', true);
      } else if (aLevel === this.constants.DISPLAYLEVEL_BASIC) {
         this.elements.basic.prop('selected', true);
      } else if (this.elements.diagnostic == null) {
         aLevel = this.constants.DISPLAYLEVEL_BASIC;
         this.prefService.setPrefOption('DC_OPTID_DISPLAYLEVEL', aLevel);
         this.elements.basic.prop('selected', true);
      } else {
         aLevel = this.constants.DISPLAYLEVEL_DIAGNOSTIC;
         this.elements.diagnostic.prop('selected', true);
      }
      if (this.notify !== null) {
         this.notify(aLevel);
      }
   },

   enableControls: function (aEnable) {
      if (aEnable) {
         this.elements.select.removeAttr('disabled');
      } else {
         this.elements.select.attr('disabled', 'true');
      }
   }
};
