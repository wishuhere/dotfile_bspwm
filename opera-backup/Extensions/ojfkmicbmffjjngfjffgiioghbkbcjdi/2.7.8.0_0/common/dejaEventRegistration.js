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

'use strict';

/*global DejaClick*/



/**
 * EventRegistration encapsulates the association between Events and
 * EventListeners. It facilitates defining a member function as an
 * EventListener by binding the method to a context. It also makes
 * deregistration easier by remembering which registrations exist.
 * @constructor
 * @implements {DejaClick.Closable}
 */
DejaClick.EventRegistration = function () {
   /**
    * List of known DOM events and handlers.
    * @type {!Array.<{
    *    target: !EventTarget,
    *    event: string,
    *    capture: boolean,
    *    listener: function(Event),
    *    method: function(!Event),
    *    context: ?Object
    * }>}
    */
   this.m_domListeners = [];
   /**
    * List of known Chrome events and handlers.
    * @type {!Array.<{
    *    event: !chrome.Event,
    *    listener: !chrome.EventListener,
    *    method: !chrome.EventListener,
    *    context: ?Object
    * }>}
    */
   this.m_chromeListeners = [];
   /**
    * List of known DejaClick topics and handlers.
    * @type {!Array.<{
    *    collector: !DejaClick.ObserverCollector,
    *    topic: string,
    *    listener: function(*, integer, function(*)),
    *    method: function(*, integer),
    *    context: ?Object
    * }>}
    */
   this.m_dejaListeners = [];

   /**
    * List of mutation observers
    */
   this.m_mutationObservers = [];

   /**
    * Whether the listeners are attached to the events or not.
    * @type {boolean}
    */
   this.m_enabled = true;
};

DejaClick.EventRegistration.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.EventRegistration,

   /**
    * Close an EventRegistration. Remove all listeners from all
    * events. Remove any references to external objects.
    * The EventRegistration may be reused, however.
    * @this {!DejaClick.EventRegistration}
    */
   close: function () {
      this.enable(false);
      this.m_dejaListeners = [];
      this.m_chromeListeners = [];
      this.m_domListeners = [];
      this.m_mutationObservers = [];
   },

   /**
    * Associate a listener with a DOM event on a particular target.
    * If the EventRegistration is currently enabled, register the
    * listener to be called when the event occurs.
    * @this {!DejaClick.EventRegistration}
    * @param {!EventTarget} aTarget A DOM event target.
    * @param {string} aEvent The name of the event (e.g., click, mouseover).
    * @param {boolean} aCapture If true, handle the event in the capture phase.
    * @param {!function(!Event)} aListener The function to be called
    *    when the event occurs.
    * @param {Object=} opt_context Optional value to use as the value
    *    of the this keyword when aListener is invoked.
    * @param {...*} var_args Optional initial arguments to be passed to
    *    aListener when it is invoked.
    * @return {!DejaClick.EventRegistration} this.
    */
   addDomListener: function (aTarget, aEvent, aCapture, aListener,
         opt_context, var_args) {
      var details = {
         target: aTarget,
         event: aEvent,
         capture: aCapture,
         listener: aListener,
         method: aListener,
         context: (opt_context == null) ? null : opt_context
      };
      if (arguments.length > 4) {
         details.listener = aListener.bind.apply(aListener,
            Array.prototype.slice.call(arguments, 4));
      }
      if (this.m_enabled) {
         aTarget.addEventListener(aEvent, details.listener, aCapture);
      }
      this.m_domListeners.push(details);
      return this;
   },

   /**
    * Remove all associations with DOM events that match the specified
    * criteria. If the event listener is specified, it and the context
    * must match each association to be removed. If the capture flag
    * is specified, it must match each association to be removed.
    * The target and event must always match. Additional arguments
    * passed to the listener are not considered during matching.
    *
    * @this {!DejaClick.EventRegistration}
    * @param {!EventTarget} aTarget A DOM event target.
    * @param {string} aEvent The name of the event (e.g., click, mouseover).
    * @param {boolean=} opt_capture The capture phase of the association
    *    to discard, if specified.
    * @param {!function(!Event)=} opt_listener If specified, the listener
    *    for the association(s) to be discarded.
    * @param {!Object=} opt_context If opt_listener is specified, this must
    *    match the context of any associations to be removed.
    * @return {!DejaClick.EventRegistration} this.
    */
   removeDomListener: function (aTarget, aEvent, opt_capture, opt_listener,
         opt_context) {
      var context, index, details;
      context = (opt_context == null) ? null : opt_context;
      index = this.m_domListeners.length;
      while (index !== 0) {
         --index;
         details = this.m_domListeners[index];
         if ((details.target === aTarget) &&
               (details.event === aEvent) &&
               ((opt_capture == null) || (details.capture === opt_capture))) {
            if ((opt_listener == null) ||
                  ((details.method === opt_listener) &&
                     (details.context === context))) {
               if (this.m_enabled) {
                  details.target.removeEventListener(details.event,
                     details.listener, details.capture);
               }
               this.m_domListeners.splice(index, 1);
            }
         }
      }
      return this;
   },

   /**
    * Creates a new MutationObserver.
    * 
    * @this {!DejaClick.EventRegistration}
    * @param {!EventTarget} aTarget A DOM event target.
    * @param {!function(!Event)} aListener The function to be called
    *    when the event occurs.
    * @param {Object=} opt_context Optional value to use as the value
    *    of the this keyword when aListener is invoked.
    * @return {!DejaClick.EventRegistration} this.
    */
   addMutationObserver: function (aTarget, aListener, opt_context) {
      var details = {
         target: aTarget,
         listener: aListener,
         method: aListener,
         context: (opt_context == null) ? null : opt_context,
         observer: null
      };

      if (arguments.length > 2) {
         details.listener = aListener.bind.apply(aListener,
            Array.prototype.slice.call(arguments, 2));
      }
      details.observer = new MutationObserver(details.listener);
      if (this.m_enabled) {
         details.observer.observe(aTarget, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          });
      }
      
      this.m_mutationObservers.push(details);
      return this;
   },

   /**
    * Disconnects and removes the MutationObserver.
    *
    * @this {!DejaClick.EventRegistration}
    * @param {!EventTarget} aTarget A DOM event target.
    * @param {!function(!Event)=} aListener .
    * @return {!DejaClick.EventRegistration} this.
    */
   removeMutationObserver: function (aTarget, aListener) {
      index = this.m_mutationObservers.length;
      while (index !== 0) {
         --index;
         details = this.m_mutationObservers[index];
         if (( details.target === aTarget) && details.method === aListener ) {
            if (this.m_enabled) {
               details.observer.disconnect();
            }
            this.m_mutationObservers.splice(index, 1);
         }
      }
      return this;
   },

   /**
    * Disconnect and removes all the observers.
    */
   removeAllMutationObserver: function() {
      var index, details;
      index = this.m_mutationObservers.length;
      while (index !== 0) {
         --index;
         details = this.m_mutationObservers[index];
         details.observer.disconnect();
         this.m_mutationObservers.splice(index, 1);
      }
      return this;
   },
   
   /**
    * Associate a listener with a Chrome event. If the
    * EventRegistration is currently enabled, register the listener to
    * be called when the event occurs.
    * @this {!DejaClick.EventRegistration}
    * @param {!chrome.Event} aEvent The event.
    * @param {!chrome.EventListener} aListener The function to be called
    *    when the event occurs.
    * @param {Object=} opt_context Optional value to use as the value of
    *    the this keyword when aListener is invoked.
    * @param {...*} var_args Optional initial arguments to be passed to
    *    aListener when it is invoked.
    * @return {!DejaClick.EventRegistration} this.
    */
   addChromeListener: function (aEvent, aListener, opt_context, var_args) {
      var details = {
         event: aEvent,
         listener: aListener,
         method: aListener,
         context: (opt_context == null) ? null : opt_context
      };
      if (arguments.length > 2) {
         details.listener = aListener.bind.apply(aListener,
            Array.prototype.slice.call(arguments, 2));
      }
      if (this.m_enabled) {
         aEvent.addListener(details.listener);
      }
      this.m_chromeListeners.push(details);
      return this;
   },

   /**
    * Remove all associations with Chrome events that match the
    * specified criteria. If the event listener is specified, it and
    * the context must match each association to be deleted. The
    * Chrome event must always match the associations to be deleted.
    *
    * @this {!DejaClick.EventRegistration}
    * @param {!chrome.Event} aEvent The event of associations to be deleted.
    * @param {!chrome.EventListener=} opt_listener If specified, the
    *    event handler function for associations to be deleted.
    * @param {Object=} opt_context If specified, this must match the context
    *    of any association to be deleted.
    * @return {!DejaClick.EventRegistration} this.
    */
   removeChromeListener: function (aEvent, opt_listener, opt_context) {
      var context, index, details;
      context = (opt_context == null) ? null : opt_context;
      index = this.m_chromeListeners.length;
      while (index !== 0) {
         --index;
         details = this.m_chromeListeners[index];
         if (details.event === aEvent) {
            if ((opt_listener == null) ||
                  ((details.method === opt_listener) &&
                     (details.context === context))) {
               if (this.m_enabled) {
                  details.event.removeListener(details.listener);
               }
               this.m_chromeListeners.splice(index, 1);
            }
         }
      }
      return this;
   },

   /**
    * Associate a listener with a topic in the DejaClick observer
    * service. If the EventRegistration is currently enabled, register
    * the listener to be called when the event occurs.
    * @this {!DejaClick.EventRegistration}
    * @param {!DejaClick.ObserverCollector} aCollector The DejaClick
    *    observer service to which the association applies.
    * @param {string} aTopic The topic to be associated with a listener
    * @param {!Function} aListener The function to invoke when the topic
    *    is triggered. Actual arguments are (*, integer, function(*)).
    * @param {Object=} opt_context Optional value to use as the value
    *    of the this keyword when aListener is invoked.
    * @param {...*} var_args Optional initial arguments to be passed to
    *    aListener when it is invoked.
    * @return {!DejaClick.EventRegistration} this.
    */
   addDejaListener: function (aCollector, aTopic, aListener, opt_context,
         var_args) {
      var details = {
         collector: aCollector,
         topic: aTopic,
         listener: aListener,
         method: aListener,
         context: (opt_context == null) ? null : opt_context
      };
      if (arguments.length > 3) {
         details.listener = aListener.bind.apply(aListener,
            Array.prototype.slice.call(arguments, 3));
      }
      if (this.m_enabled) {
         aCollector.addObserver(aTopic, details.listener);
      }
      this.m_dejaListeners.push(details);
      return this;
   },

   /**
    * Remove all associations with DejaClick events that match the
    * specified criteria. If the event listener is specified, it and
    * the context must match each association to be removed. The
    * observer service and topic must always match each association to
    * be removed. Additional arguments passed to the listener are not
    * considered during matching.
    *
    * @this {!DejaClick.EventRegistration}
    * @param {!DejaClick.ObserverCollector} aCollector The DejaClick observer
    *    service of the associations to be removed.
    * @param {string} aTopic The topic of the associations to be removed.
    * @param {!Function=} opt_listener If specified, the listener for
    *    the association(s) to be discarded.
    * @param {!Object=} opt_context If opt_listener is specified, this must
    *    match the context of any associations to be removed.
    * @return {!DejaClick.EventRegistration} this.
    */
   removeDejaListener: function (aCollector, aTopic, opt_listener,
         opt_context) {
      var context, index, details;
      context = (opt_context == null) ? null : opt_context;
      index = this.m_dejaListeners.length;
      while (index !== 0) {
         --index;
         details = this.m_dejaListeners[index];
         if ((details.collector === aCollector) && (details.topic === aTopic)) {
            if ((opt_listener == null) ||
                  ((details.method === opt_listener) &&
                     (details.context === context))) {
               if (this.m_enabled) {
                  details.collector.removeObserver(details.topic,
                     details.listener);
               }
               this.m_dejaListeners.splice(index, 1);
            }
         }
      }
      return this;
   },

   /**
    * Add or remove all listeners from their corresponding events.
    * @this {!DejaClick.EventRegistration}
    * @param {boolean} enable If true, add all listeners to their
    *    corresponding events. Otherwise, remove them.
    * @return {!DejaClick.EventRegistration} this.
    */
   enable: function (enable) {
      var index, entry;
      if (this.m_enabled !== Boolean(enable)) {
         this.m_enabled = Boolean(enable);

         index = this.m_domListeners.length;
         while (index !== 0) {
            --index;
            entry = this.m_domListeners[index];
            if (enable) {
               entry.target.addEventListener(entry.event,
                  entry.listener, entry.capture);
            } else {
               entry.target.removeEventListener(entry.event,
                  entry.listener, entry.capture);
            }
         }

         index = this.m_chromeListeners.length;
         while (index !== 0) {
            --index;
            entry = this.m_chromeListeners[index];
            if (enable) {
               entry.event.addListener(entry.listener);
            } else {
               entry.event.removeListener(entry.listener);
            }
         }

         index = this.m_dejaListeners.length;
         while (index !== 0) {
            --index;
            entry = this.m_dejaListeners[index];
            if (enable) {
               entry.collector.addObserver(entry.topic, entry.listener);
            } else {
               entry.collector.removeObserver(entry.topic, entry.listener);
            }
         }
      }

      index = this.m_mutationObservers.length;
      while (index !== 0) {
         --index;
         entry = this.m_mutationObservers[index];
         if (enable) {
            entry.observer.observe(entry.target, {
               childList: true,
               subtree: true,
               attributes: false,
               characterData: false,
             });
         } else {
            entry.observer.disconnect();
         }
      }

      return this;
   },

   /**
    * Determine whether the contained listeners are attached to the events.
    * @this {!DejaClick.EventRegistration}
    * @return {boolean} true iff the listeners are registered.
    */
   isEnabled: function () {
      return this.m_enabled;
   }
};
