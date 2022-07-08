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
 * Interface for temporarily hiding existing cookies.
 * @constructor
 * @param {!DejaClick.Logger} aLogger Means of logging messages.
 * @param {!chrome.CookiesApi} aCookiesApi The chrome.cookies API.
 * @param {!Window} aWindow The global window object (for setTimeout).
 * @param {Storage} aStorage The extension's localStorage object.
 */
DejaClick.CookieManager = function(aLogger, aCookiesApi, aWindow, aStorage) {
   var cookies, ary;
   this.m_logger = aLogger;
   this.m_cookiesApi = aCookiesApi;
   this.m_window = aWindow;
   this.m_storage = aStorage;
   /** @type {!Array.<!chrome.Cookie>} */
   this.m_cookieList = [];
   this.m_customCookiesBackup = new Map();

   // Crash recovery.
   // Restore previously hidden cookies from persistent storage.
   cookies = aStorage.getItem(this.COOKIES_ITEM);
   if (cookies !== null) {
      ary = JSON.parse(cookies);
      if (Array.isArray(ary)) {
         this.m_cookieList = /** @type {!Array.<!chrome.Cookie>} */ (ary);
         this.revealCookies();
      } else {
         aStorage.removeItem(this.COOKIES_ITEM);
      }
   }
};

DejaClick.CookieManager.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.CookieManager,

   /** Name of item holding hidden cookies in localStorage. */
   COOKIES_ITEM: 'cookies',

   /**
    * Close the CookieManager, restoring any hidden cookies.
    * @this {DejaClick.CookieManager}
    */
   close: function() {
      try {
         this.revealCookies();
      } catch (ignore) { }
      delete this.m_cookieList;
      delete this.m_storage;
      delete this.m_window;
      delete this.m_cookiesApi;
      delete this.m_logger;
   },

   /**
    * Remove all cookies from all cookie stores. Remember them
    * so that they may be restored later.
    * @this {!DejaClick.CookieManager}
    * @param {function()=} opt_callback Optional callback to invoke when
    *    all cookies have been hidden.
    */
   hideCookies: function(opt_callback) {
      this.m_cookiesApi.getAllCookieStores(this.hideAllCookieStores.bind(this,
          (opt_callback == null) ? null : opt_callback));
   },

   /**
    * Iterate through the list of cookie stores and remove all cookies
    * in each of them.
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {?function()} aCallback Callback to invoke when all cookies
    *    have been hidden.
    * @param {!Array.<chrome.CookieStore>} aStores List of the known
    *    cookie stores.
    */
   hideAllCookieStores: function(aCallback, aStores) {
      var numStores, count, hideCookies, i;
      try {
         numStores = aStores.length;
         if (numStores !== 0) {
            count = { count: numStores };
            hideCookies = this.hideStoreCookies.bind(this, count, aCallback);
            for (i = 0; i < numStores; ++i) {
               this.m_cookiesApi.getAll({ storeId: aStores[i].id },
                  hideCookies);
            }
         } else if (aCallback !== null) {
            // No stores to hide. Make the callback.
            aCallback();
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Hide all of the cookies in a single cookie store.
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {!{ count: integer }} aStoreCount The number of stores to
    *    be hidden.
    * @param {?function()} aCallback Callback to be invoked when all the
    *    cookies are hidden.
    * @param {!Array.<!chrome.Cookie>} aCookies List of cookies in a
    *    single cookie store.
    */
   hideStoreCookies: function(aStoreCount, aCallback, aCookies) {
      var numCookies, cookieCount, hideCookie, i, cookie;
      try {
         numCookies = aCookies.length;
         if (numCookies !== 0) {
            this.m_cookieList = this.m_cookieList.concat(aCookies);
            this.m_storage.setItem(this.COOKIES_ITEM,
               JSON.stringify(this.m_cookieList));
            cookieCount = { count: numCookies };
            hideCookie = this.countRemovedCookie.bind(this, aStoreCount,
               cookieCount, aCallback);
            for (i = 0; i < numCookies; ++i) {
               cookie = aCookies[i];
               this.m_cookiesApi.remove({
                  url: this.getCookieUrl(cookie),
                  name: cookie.name,
                  storeId: cookie.storeId
               }, hideCookie);
            }
         } else {
            // No cookies in this store.
            // Make the callback if it is the last store.
            --aStoreCount.count;
            if ((aStoreCount.count === 0) && (aCallback !== null)) {
               aCallback();
            }
         }
      } catch (ex) {
      }
   },

   /**
    * Account for the removal of a cookie. If this is the last cookie
    * of the last cookie store to be removed, invoke the callback.
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {!{count: integer}} aStoreCount The number of stores from which
    *    cookies are being removed.
    * @param {!{count: integer}} aCookieCount The number of cookies being
    *    removed from this cookie store.
    * @param {?function()} aCallback Optional callback to invoke when all
    *    the cookies have been removed.
    * @param {?{url: string, name: string, storeId: string}} aInfo
    *    Details of the cookie that was removed. Null if the removal failed.
    */
   countRemovedCookie: function(aStoreCount, aCookieCount, aCallback, aInfo) {
      try {
         // TODO: Log error if cookie removal failed?
         --aCookieCount.count;
         if (aCookieCount.count === 0) {
            --aStoreCount.count;
            if ((aStoreCount.count === 0) && aCallback) {
               aCallback();
            }
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * If any cookies have been hidden, hide all new cookies, then
    * restore all of the hidden cookies. This is an asynchronous
    * operation.
    * @this {!DejaClick.CookieManager}
    * @param {function()=} opt_callback Optional callback to invoke when
    *    the cookies have been restored.
    */
   revealCookies: function(opt_callback) {
      var callback = (opt_callback == null) ? null : opt_callback;
      if (this.m_cookieList.length !== 0) {
         this.hideCookies(this.revealAllCookies.bind(this, callback));

      } else if (callback !== null) {
         // Nothing to restore. Invoke the callback.
         this.m_window.setTimeout(callback, 0);
      }
   },

   /**
    * Asynchronously restore all of the hidden cookies.
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {?function()} aCallback Optional callback to invoke when
    *    all of the hidden cookies have been restored.
    */
   revealAllCookies: function(aCallback) {
      var numCookies, count, countCookie, i, cookie, details;
      try {
         numCookies = this.m_cookieList.length;
         count = {
            count: numCookies
         };
         countCookie = this.countRestoredCookie.bind(this, count, aCallback);
         for (i = 0; i < numCookies; ++i) {
            cookie = this.m_cookieList[i];
            details = {
               url: this.getCookieUrl(cookie),
               name: cookie.name,
               value: cookie.value,
               path: cookie.path,
               secure: cookie.secure,
               httpOnly: cookie.httpOnly,
               storeId: cookie.storeId
            };
            if (!cookie.hostOnly) {
               details.domain = cookie.domain;
            }
            if (!cookie.session) {
               details.expirationDate = cookie.expirationDate;
            }
            this.m_cookiesApi.set(details, countCookie);
         }
         this.m_cookieList.length = 0;
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Account for the restoration of a cookie. Invoke the callback if
    * all cookies have been restored.
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {!{count: integer}} aCount The number of cookies to be restored.
    * @param {?function()} aCallback Optional callback to inform
    *    the client that all cookies have been restored.
    * @param {?chrome.Cookie} aCookie The restored cookie, or null if
    *    an error occurred.
    */
   countRestoredCookie: function(aCount, aCallback, aCookie) {
      try {
         // TODO: Report error if set cookie failed?
         --aCount.count;
         if (aCount.count === 0) {
            this.m_storage.removeItem(this.COOKIES_ITEM);
            if (aCallback !== null) {
               aCallback();
            }
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Get the URL for a cookie.
    * @this {!DejaClick.CookieManager}
    * @param {!chrome.Cookie} aCookie The cookie in question.
    * @return {string} The URL for the cookie.
    */
   getCookieUrl: function(aCookie) {
      return (aCookie.secure ? 'https://' : 'http://') +
                  aCookie.domain + aCookie.path;
   },

   /**
    * Just returns a string with URL+name of cookie as the unique identifier.
    * 
    * @param {object} aCookie 
    */
   getCookieId: function(aCookie) {
      if ( aCookie )
         return aCookie.url+"_"+aCookie.name;
      else 
         return null;
   },

   /**
    * Get all the stores of cookies, and sets the new cookie value at all of them.
    * 
    * Before setting the value, it saves the existing value, so we can restore the existing value after replay/record.
    * 
    * @param {object} aCookieInfo 
    */
   setCookieAllTabs: function(aCookieInfo) {
      try {
         //Initialyze backup
         this.m_customCookiesBackup.set(
            this.getCookieId(aCookieInfo), 
            {
               storeIds: [], //Store IDs where the cookie was created (so we have to remove it after replay/record)
               backup: [] //Backup of previously existing cookies.
            }
         );

         //Get all cookie stores and set the cookie in all of them.
         this.m_cookiesApi.getAllCookieStores(this.setCookieAtAllStores.bind(this, aCookieInfo));
      } catch ( ex ) {
         this.m_logger.logException(ex);
      } 
   },


   /**
    * For each store this function gets the existing cookie value (if exists) and set the new value.
    * 
    * @param {object} aCookieInfo New coookie value
    * @param {Array} aStores Array of stores (returned by chrome.cookies.getAllCookieStores)
    */
   setCookieAtAllStores: function(aCookieInfo, aStores) {
      try {
         for (var i = 0; i < aStores.length; ++i) {
            var newCookie = {
               url: aCookieInfo.url,
               name: aCookieInfo.name,
               value: aCookieInfo.value,
               secure: (aCookieInfo && aCookieInfo.url && aCookieInfo.url.startsWith("https"))?true:false,
               storeId: aStores[i].id
            };

            this.m_cookiesApi.get({url: aCookieInfo.url, name: aCookieInfo.name, storeId: aStores[i].id}, this.setCookie.bind(this, newCookie));
         }
      
      } catch (ex) {
         this.m_logger.logException(ex);
      }
   },


   /**
    * Save the current cookie value (if exists) and applies the new one.
    * @this {!DejaClick.CookieManager}
    * @param {object}  aCookieInfo Object with the cookie info (url, name and value)
    */
   setCookie: function(aCookieInfo, aOldCookie) {
      var details;
      try {
         //Rollback information should be saved.
         var rollbackInfo = this.m_customCookiesBackup.get(this.getCookieId(aCookieInfo));
         if ( aOldCookie ) {
            //Backup of the existing cookie value
            rollbackInfo.backup.push(aOldCookie);
         } else {
            //If there was no cookie, we save the store ID, so we can remove the cookie after replay/record.
            rollbackInfo.storeIds.push(aCookieInfo.storeId);
         }
         
         //Then we can update/create the cookie.
         this.m_cookiesApi.set(aCookieInfo, this.setCookieResult.bind(this, aCookieInfo));

      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Cookie set confirmation
    * 
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {?chrome.Cookie} aCookie The set cookie, or null if
    *    an error occurred.
    */
   setCookieResult: function(aCookieInfo, aCookie) {
      try {
         if (aCookie) {
            this.m_logger.logInfo("Cookie set! [name="+aCookie.name+"]");
         } else {
            this.m_logger.logWarning("Cookie set failed!! [name="+aCookieInfo.name+"]"); 
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Restore previous cookie value (if exists).
    * 
    * @this {!DejaClick.CookieManager}
    * @param {?function()} aCallback Optional callback to invoke when
    *    all of the hidden cookies have been restored.
    */
   restoreCookie: function(aCookieInfo) {
      try {
         var rollbackInfo = this.m_customCookiesBackup.get(this.getCookieId(aCookieInfo));

         if ( rollbackInfo ) {
            if ( rollbackInfo.storeIds ) {
               for (var i = 0; i < rollbackInfo.storeIds.length; ++i) {
                  this.m_cookiesApi.remove({url: aCookieInfo.url, name: aCookieInfo.name, storeId: rollbackInfo.storeIds[i]}, this.removeCookieResult.bind(this, aCookieInfo));
               }
            }

            if ( rollbackInfo.backup ) {
               for (var i = 0; i < rollbackInfo.backup.length; ++i) {
                  var cookie = rollbackInfo.backup[i];
                  var details = {
                     url: this.getCookieUrl(cookie),
                     name: cookie.name,
                     value: cookie.value,
                     path: cookie.path,
                     secure: cookie.secure,
                     httpOnly: cookie.httpOnly,
                     storeId: cookie.storeId
                  };
                  if (!cookie.hostOnly) {
                     details.domain = cookie.domain;
                  }
                  if (!cookie.session) {
                     details.expirationDate = cookie.expirationDate;
                  }

                  this.m_cookiesApi.set(details, this.setCookieResult.bind(this, rollbackInfo.backup[i]));
               }
            }

            //Remove entry from map when done.
            this.m_customCookiesBackup.delete(this.getCookieId(aCookieInfo));
         }
         
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

   /**
    * Cookie set confirmation
    * 
    * @private
    * @this {!DejaClick.CookieManager}
    * @param {?chrome.Cookie} aCookie The set cookie, or null if
    *    an error occurred.
    */
   removeCookieResult: function(aCookieInfo, aCookie) {
      try {
         if (aCookie) {
            this.m_logger.logInfo("Cookie removed! [name="+aCookie.name+"]");
         } else {
            this.m_logger.logWarning("Cookie removed failed!! [name="+aCookieInfo.name+"]"); 
         }
      } catch (/** @type {!Error} */ ex) {
         this.m_logger.logException(ex);
      }
   },

};
