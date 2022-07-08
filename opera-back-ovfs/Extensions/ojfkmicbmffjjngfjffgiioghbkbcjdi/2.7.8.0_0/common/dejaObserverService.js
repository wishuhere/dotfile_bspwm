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

/*global DejaClick*/

'use strict';

/**
 * ObserverService allows the background page or a UI page to send
 * messages to content scripts and other observers in the background.
 * @constructor
 * @implements {DejaClick.ObserverCollector}
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.Logger} aLogger Means of logging messages.
 * @param {!chrome.RuntimeApi} aRuntimeApi Either chrome.runtime
 *    or chrome.extension (for older versions of Chrome).
 * @param {!Window} aWindow The JavaScript global window object.
 */
DejaClick.ObserverService = function (aLogger, aRuntimeApi, aWindow) {
   this.m_logger = aLogger;
   this.m_window = aWindow;

   /** @type {!Object.<string, !Array.<function(*, ?chrome.Tab, ?integer)>>} */
   this.m_observers = {};

   /** @type {!Object.<(integer|string), !chrome.Port>} */
   this.m_ports = {};
   this.m_lastDocumentId = 0;

   this.m_events = new DejaClick.EventRegistration().
      addChromeListener(aRuntimeApi.onConnect, this.handleConnection, this).
      enable(true);
};


DejaClick.ObserverService.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.ObserverService,

   /**
    * Shut down the observer service, releasing all references to
    * external objects and removing all observers. The observer service
    * is no longer usable.
    * @this {!DejaClick.ObserverService}
    */
   close: function () {
      /** @type {string} */
      var docId;
      if (this.hasOwnProperty('m_events')) {
         this.m_events.close();
         delete this.m_events;
      }
      for (docId in this.m_ports) {
         if (this.hasOwnProperty.call(this.m_ports, docId)) {
            this.m_ports[docId].disconnect();
         }
      }

      delete this.m_lastDocumentId;
      delete this.m_ports;
      delete this.m_observers;
      delete this.m_window;
      delete this.m_logger;
   },

   /**
    * Register an observer for a particular topic or event.
    * @this {!DejaClick.ObserverService}
    * @param {string} aTopic The type of event to be observed.
    * @param {!Function} aObserver Function to call when an event of
    *    the specified type occurs.  The actual signature of an
    *    observer should be {function(*, ?chrome.Tab, ?integer)}.
    *
    * The arguments passed to an observer are:
    * - the details of the event (from notifyObservers),
    * - a chrome.Tab object describing the source of the event (or null
    *   if the event came from the background),
    * - and a unique identifier for the document that generated the event
    *   (or null if from the background). This id may be passed to
    *   notifyDocument to send a message directly to the source of the event.
    */
   addObserver: function (aTopic, aObserver) {
      if (!this.m_observers.hasOwnProperty(aTopic)) {
         this.m_observers[aTopic] = [];
      }
      this.m_observers[aTopic].push(aObserver);
   },

   /**
    * Remove an observer for a particular topic or event.
    * @this {!DejaClick.ObserverService}
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
    * Notify local observers (i.e., in the background
    * or UI pages) of an event.
    * @this {!DejaClick.ObserverService}
    * @param {string} aTopic Identifier of observers to be notified.
    * @param {*} aData Details of the event that has occurred.
    *    This is passed as the first argument to the observers.
    */
   notifyLocalObservers: function (aTopic, aData) {
      this.handleMessage(null, null, { topic: aTopic, data: aData });
   },

   /**
    * Notify local observers and all content scripts of
    * an event. Observers in content scripts will be notified asynchronously.
    * @this {!DejaClick.ObserverService}
    * @param {string} aTopic Identifier of the event that has occurred.
    * @param {*} aData Details of the event. This will be passed as the
    *    first argument to any observer for the event. The value
    *    must be serializable (e.g., JSON encodable).
    * @return {!Array.<integer>} The document IDs of the content scripts
    *    to which the event has been dispatched.
    */
   notifyObservers: function (aTopic, aData) {
      var message, /** @type {!Array.<integer>} */ docs,
         /** @type {string} */ docId;
      message = { topic: aTopic, data: aData };
      docs = [];
      for (docId in this.m_ports) {
         if (this.m_ports.hasOwnProperty(docId)) {
            this.m_ports[docId].postMessage(message);
            docs.push(Number(docId));
         }
      }
      this.notifyLocalObservers(aTopic, aData);
      return docs;
   },

   /**
    * Send an asynchronous message to a single content script (document).
    * @this {!DejaClick.ObserverService}
    * @param {integer} aDocumentId Unique identifier for the document.
    *    This is acquired by receiving an notification from the document.
    * @param {string} aTopic The type of message to be sent.
    * @param {*} aData Details of the message to be sent. The value
    *    must be serializable (e.g., JSON encodable).
    * @return {boolean} true if the message was sent.
    */
   notifyDocument: function (aDocumentId, aTopic, aData) {
      if (this.m_ports.hasOwnProperty(aDocumentId)) {
         this.m_ports[aDocumentId].postMessage({
            topic: aTopic,
            data: aData
         });
         return true;
      }
      return false;
   },

   /**
    * Register to receive messages from a new connection with a
    * content script. Called in response to the
    * chrome.runtime.onConnect event.
    * @private
    * @this {!DejaClick.ObserverService}
    * @param {!chrome.Port} aPort The newly established port.
    */
   handleConnection: function (aPort) {
      var docId;
      try {
         docId = this.m_lastDocumentId;
         do {
            ++docId;
            if (docId === 0x100000000) {
               docId = 0;
            }
         } while (this.m_ports.hasOwnProperty(docId));
         this.m_lastDocumentId = docId;
         this.m_ports[docId] = aPort;
         this.m_events.addChromeListener(aPort.onDisconnect,
            this.handleDisconnect, this, docId, aPort);
         this.m_events.addChromeListener(aPort.onMessage,
            this.handleMessage, this, docId, aPort);
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Dispatch an event to local observers. Called in response to a
    * port.onMessage event, or asynchronously from
    * notifyLocalObservers.
    * @private
    * @this {!DejaClick.ObserverService}
    * @param {?integer} aDocId Unique id (within this observer
    *    service) of the document from which the message
    *    originated. Null if it came from notifyLocalObservers.
    * @param {?chrome.Port} aPort The port from which the message was received.
    * @param {!{topic: string, data: *}} aMessage The message to be
    *    dispatched.
    */
   handleMessage: function (aDocId, aPort, aMessage) {
      var data, tab, observers, index, frameId;
      try {
         if (this.hasOwnProperty('m_observers') &&
               this.m_observers.hasOwnProperty(aMessage.topic)) {
            data = aMessage.data;
            if ((aPort !== null) && aPort.hasOwnProperty('sender')) {
               tab = aPort.sender.tab;
               frameId = aPort.sender.frameId;
            }
            if (tab == null) {
               tab = null;
            }
            if ( frameId == null ) {
               frameId = 0; //   Assuming main frame.
            }
            observers = this.m_observers[aMessage.topic];
            index = observers.length;
            while (index !== 0) {
               --index;
               try {
                  observers[index](data, tab, aDocId, frameId);
               } catch(e) {
                  //TODO Firefox Quantum UXM-11026 - This seems to be affecting at Firefox but not at Chrome
                  //TODO Should we remove observer from array?
                  this.m_logger.logWarning("Is the observer dead? "+e.message);
               }
            }
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Clean up after a disconnected port. Called in reponse to a
    * port.onDisconnect event.
    * @private
    * @this {!DejaClick.ObserverService}
    * @param {integer} aDocId The unique id (within this observer service)
    *    of the port that has been disconnected.
    * @param {!chrome.Port} aPort The port that has been disconnected.
    */
   handleDisconnect: function (aDocId, aPort) {
      try {
         delete this.m_ports[aDocId];

         this.m_events.removeChromeListener(aPort.onDisconnect).
            removeChromeListener(aPort.onMessage);

         this.handleMessage(aDocId, aPort, {
            topic: 'dejaclick:disconnect',
            data: null
         });
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   }
};
