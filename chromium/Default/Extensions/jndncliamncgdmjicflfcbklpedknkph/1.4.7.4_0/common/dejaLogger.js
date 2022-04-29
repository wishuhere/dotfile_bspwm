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

/*global DejaClick*/


/**
 * Utility to write messages to a log.
 * @implements {chrome.Event}
 * @constructor
 * @param {Console} aListener Console object to which messages
 *    should be logged.
 */
DejaClick.Logger = function (aListener) {
   var messageCount, messageOptions, debugOptions, LINE_END_REGEXP,
      /** @type {!DejaClick.Logger} */ self;

   messageCount = 0;
   messageOptions = '';
   debugOptions = '';

   LINE_END_REGEXP = /\r\n|\r|\n/g;
   self = this;
   /** @type {!Array.<function(string)>} */
   this.m_sinks = [];
   this.m_consoleEnabled = true;
   /**
    * Flag indicating whether debug messages for general processing activity
    * should be logged.
    * @type {boolean}
    */
   this.debugprocess = false;
   /**
    * Flag indicating whether debug messages for HTTP activity should
    * be logged.
    * @type {boolean}
    */
   this.debugactivity = false;
   /**
    * Flag indicating whether debug messages for network activity should
    * be logged.
    * @type {boolean}
    */
   this.debugnetwork = false;
   /**
    * Flag indicating whether debug messages for pending activity should
    * be logged.
    * @type {boolean}
    */
   this.debugpending = false;
   /**
    * Flag indicating whether debug messages related to screen events should
    * be logged.
    * @type {boolean}
    */
   this.debugscreen = false;
   /**
    * Flag indicating whether debug messages related to DOM search should
    * be logged.
    * @type {boolean}
    */
   this.debugsearch = false;
   /**
    * Flag indicating whether debug messages for URL blocking should
    * be logged.
    * @type {boolean}
    */
   this.debugurlmask = false;
   /**
    * Flag indicating whether debug messages for collecting HTTP
    * headers should be logged.
    * @type {boolean}
    */
   this.debugheaders = false;
   /**
    * Flag indicating whether debug messages for collecting network
    * timings should be logged.
    * @type {boolean}
    */
   this.debugtimings = false;
   /**
    * Flag indicating whether informational messages should be logged.
    * @type {boolean}
    */
   this.messageinfo = false;
   /**
    * Flag indicating whether warning messages should be logged.
    * @type {boolean}
    */
   this.messagewarn = false;
   /**
    * Flag indicating whether failure messages should be logged.
    * @type {boolean}
    */
   this.messagefail = false;

   /**
    * Set which types of messages are logged.
    * @param {string} aOptions String describing which types of
    *    messages should be logged.
    */
   this.setMessageOptions = function (aOptions) {
      messageOptions = aOptions;
      if (/all/i.test(aOptions)) {
         self.messageinfo = self.messagewarn = self.messagefail = true;
      } else {
         self.messageinfo = /info/i.test(aOptions);
         self.messagewarn = /warn/i.test(aOptions);
         self.messagefail = /fail/i.test(aOptions);
      }
   };

   /**
    * Get a string describing which types of messages are being logged.
    * @return {string} The string.
    */
   this.getMessageOptions = function () {
      return messageOptions;
   };

   /**
    * Set which types of debug messages are logged.
    * @param {string} aOptions String describing which types of
    *    debug messages should be logged.
    */
   this.setDebugOptions = function (aOptions) {
      debugOptions = aOptions;
      if (/all/i.test(aOptions)) {
         self.debugactivity = true;
         self.debugnetwork  = true;
         self.debugpending  = true;
         self.debugprocess  = true;
         self.debugscreen   = true;
         self.debugsearch   = true;
         self.debugurlmask  = true;
         self.debugheaders  = true;
         self.debugtimings  = true;
      } else {
         self.debugactivity = /act/i.test(aOptions);  //http activity
         self.debugnetwork  = /net/i.test(aOptions);  //http network
         self.debugpending  = /pen/i.test(aOptions);  //http network
         self.debugprocess  = /pro/i.test(aOptions);  //processing
         self.debugscreen   = /scr/i.test(aOptions);  //screen events
         self.debugsearch   = /sea/i.test(aOptions);  //DOM search
         self.debugurlmask  = /url/i.test(aOptions);  //url masks
         self.debugheaders  = /hea/i.test(aOptions);  //http headers
         self.debugtimings  = /tim/i.test(aOptions);  //http timings
      }
   };

   /**
    * Get a string describing which types of debug messages are being logged.
    * @return {string} The string.
    */
   this.getDebugOptions = function () {
      return debugOptions;
   };

   /**
    * Log a message.
    * @param {string} aType String identifying the type of the message.
    * @param {string} aMessage The message to be logged.
    * @param {string} opt_method Name of method on aListener with which to
    *    log the message. Defaults to log.
    * @return {string} aMessage.
    */
   this.logMessage = function (aType, aMessage, opt_method) {
      var id, method, prefix, index, message;

      try {
         ++messageCount;
         id = String(messageCount);
         id = (new Date()).toISOString() + '-' +
            '000000'.substring(id.length) + id;
         method = (opt_method == null) ? 'log' : opt_method;
         prefix = aType + '|' + id + '|';

         if (self.m_consoleEnabled) {
            aListener[method](prefix + aMessage);
         }
         index = self.m_sinks.length;
         if (index !== 0) {
            message = prefix +
               aMessage.trim().replace(LINE_END_REGEXP, '\n' + prefix) +
               '\n';
            while (index !== 0) {
               --index;
               self.m_sinks[index](message);
            }
         }
      } catch (ex) {
         // Ignore logging errors.
      }
      return aMessage;
   };

   /**
    * Log a debug message (if debugProcess is true).
    * @param {string} aMessage The message to be logged.
    * @return {string} aMessage.
    */
   this.logDebug = function (aMessage) {
      self.logMessage('D', aMessage, 'debug');
      return aMessage;
   };

   /**
    * Log an informational message (if messageInfo is true).
    * @param {string} aMessage The message to be logged.
    * @return {string} aMessage.
    */
   this.logInfo = function (aMessage) {
      if (self.messageinfo) {
         self.logMessage('I', aMessage, 'info');
      }
      return aMessage;
   };

   /**
    * Log a warning message (if messageWarn is true).
    * @param {string} aMessage The message to be logged.
    * @return {string} aMessage.
    */
   this.logWarning = function (aMessage) {
      if (self.messagewarn) {
         self.logMessage('W', aMessage, 'warn');
      }
      return aMessage;
   };

   /**
    * Log a failure message (if messageFail is true).
    * @param {string} aMessage The message to be logged.
    * @return {string} aMessage.
    */
   this.logFailure = function (aMessage) {
      if (self.messagefail) {
         self.logMessage('F', aMessage, 'error');
      }
      return aMessage;
   };

   /**
    * Log a message describing an exception (if messageFail is true).
    * @param {!Error} aError The exception.
    * @param {string=} opt_function The name of the function where the
    *    exception was caught.
    * @param {string=} opt_message Additional text to be logged with
    *    the exception.
    * @return {string} The logged message, including the exception details.
    */
   this.logException = function (aError, opt_function, opt_message) {
      var message = '';
      try {
         if ((opt_function !== undefined) && (opt_function !== '')) {
            message += 'Exception encountered in ' + opt_function + '()\n';
         }
         if ((opt_message !== undefined) && (opt_message !== '')) {
            message += opt_message + '\n';
         }
         if (aError instanceof Error) {
            message += aError.stack;
         }
         else if (typeof aError === 'string') {
            message += aError;
         }
         self.logFailure(message);
      } catch (ex) {
         // Ignore exceptions during logging.
      }
      return message;
   };
};

/**
 * Enable or disable logging to console.
 * @this {!DejaClick.Logger}
 * @param {boolean} aEnable If true, enable logging to console.
 *    Disable it otherwise.
 */
DejaClick.Logger.prototype.enableConsole = function (aEnable) {
   this.m_consoleEnabled = aEnable;
};

/**
 * Add a sink for log messages.
 * @this {!DejaClick.Logger}
 * @param {function(string)} aSink Function to process messages that
 *    have been logged.
 * @return {!DejaClick.Logger} this.
 */
DejaClick.Logger.prototype.addListener = function (aSink) {
   this.m_sinks.push(aSink);
   return this;
};

/**
 * Remove a sink for log messages.
 * @this {!DejaClick.Logger}
 * @param {function(string)} aSink Function that will no longer
 *    process messages that have been logged.
 * @return {!DejaClick.Logger} this.
 */
DejaClick.Logger.prototype.removeListener = function (aSink) {
   var index = this.m_sinks.indexOf(aSink);
   if (index !== -1) {
      this.m_sinks.splice(index, 1);
   }
   return this;
};

/**
 * Check whether a function is registered as a sink for the logger.
 * @this {!DejaClick.Logger}
 * @param {function(string)} aSink Function that may be processing
 *    messages that have been logged.
 * @return {boolean} true if aSink is registered as a listener for
 *    the logger.
 */
DejaClick.Logger.prototype.hasListener = function (aSink) {
   return this.m_sinks.indexOf(aSink) !== -1;
};

/**
 * Determines whether any sinks are registered with the logger.
 * @return {boolean} true if the logger has any registered sinks.
 */
DejaClick.Logger.prototype.hasListeners = function () {
   return this.m_sinks.length !== 0;
};
