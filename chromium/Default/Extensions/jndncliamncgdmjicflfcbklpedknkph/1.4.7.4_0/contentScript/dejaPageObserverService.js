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

/*global DejaClick*/

'use strict';

/**
 * PageObserverService allows a content script to send messages to the
 * background page and UI pages.
 * @constructor
 * @implements {DejaClick.ObserverCollector}
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.Logger} aLogger Means of logging messages.
 * @param {!chrome.RuntimeApi} aRuntimeApi Either chrome.runtime
 *    or chrome.extension (for older versions of Chrome).
 */
DejaClick.PageObserverService = function (aLogger, aRuntimeApi) {
   this.m_logger = aLogger;
   this.m_runtime = aRuntimeApi;

   /** @type {!Object.<string, !Array.<function(*)>>} */
   this.m_observers = {};
   /** @type {?chrome.Port} */
   this.m_port = null;
   this.m_events = new DejaClick.EventRegistration();
};


DejaClick.PageObserverService.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PageObserverService,

   /**
    * Shut down the observer service, releasing all references to
    * external objects and removing all observers. The observer service
    * is no longer usable.
    * @this {!DejaClick.PageObserverService}
    */
   close: function () {
      if (this.hasOwnProperty('m_events')) {
         this.m_events.close();
         delete this.m_events;
      }
      if (this.m_port != null) {
         this.m_port.disconnect();
      }
      delete this.m_port;
      delete this.m_observers;
      delete this.m_runtime;
      delete this.m_logger;
   },

   /**
    * Register an observer for a particular topic or event.
    * @this {!DejaClick.PageObserverService}
    * @param {string} aTopic The type of event to be observed.
    * @param {!Function} aObserver Function to call when an event of the
    *    specified type occurs. The details of the event are passed
    *    to the observer as its only argument.
    */
   addObserver: function (aTopic, aObserver) {
      if (!this.m_observers.hasOwnProperty(aTopic)) {
         this.m_observers[aTopic] = [];
      }
      this.m_observers[aTopic].push(aObserver);
   },

   /**
    * Remove an observer for a particular topic or event.
    * @this {!DejaClick.PageObserverService}
    * @param {string} aTopic The type of event affected.
    * @param {!Function} aObserver Function not to call when an event
    *    of the specified type occurs.
    */
   removeObserver: function (aTopic, aObserver) {
      var index;
      if (this.m_observers.hasOwnProperty(aTopic)) {
         index = this.m_observers[aTopic].indexOf(aObserver);
         if (index !== -1) {
            this.m_observers[aTopic].splice(index, 1);
         }
      }
   },

   /**
    * Send an event to observers in the background page (or extension
    * UI pages).
    * @this {!DejaClick.PageObserverService}
    * @param {string} aTopic The type of event to be sent.
    * @param {*} aData Details of the event.
    */
   notifyObservers: function (aTopic, aData) {
      var port;
      if (this.m_port == null) {
         if (this.m_runtime && this.m_runtime !== undefined) {
            this.m_port = port = this.m_runtime.connect();
            this.m_events.enable(true).
               addChromeListener(port.onDisconnect, this.handleDisconnect, this).
               addChromeListener(port.onMessage, this.handleMessage, this);
         }
      }
      this.m_port.postMessage({
         topic: aTopic,
         data: aData
      });
   },

   /**
    * Handle a message from the background page (or an extension UI page).
    * Dispatch it to all registered observers.
    * @private
    * @this {!DejaClick.PageObserverService}
    * @param {!{ topic: string, data: * }} aMessage Details of the event
    *    to be dispatched. topic identifies the observers to be notified.
    *    data is passed to each observer.
    */
   handleMessage: function (aMessage) {
      var data, observers, index;
      try {
         if (this.m_observers.hasOwnProperty(aMessage.topic)) {
            observers = this.m_observers[aMessage.topic];
            data = aMessage.data;
            index = observers.length;
            while (index !== 0) {
               --index;
               observers[index](data);
            }
         }
      } catch (ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Discard the connected port.
    * @private
    * @this {!DejaClick.PageObserverService}
    */
   handleDisconnect: function () {
      try {
         this.m_events.close();
         this.m_port = null;
      } catch (ex) {
         this.m_logger.logException(ex);
      }
   }
};
