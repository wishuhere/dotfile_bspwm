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
 * PreferenceService defines an interface for persistently storing and
 * retrieving values for a set of defined preferences. These
 * preference values may also be set as an attribute element of either
 * a script or event DOM element.
 *
 * A client may receive notifications when any preference is changed
 * at the system level by adding an observer to the dejaclick:preferences
 * topic. Observers receive a data argument conforming to
 * !{
 *    key: string,
 *    newValue: *,
 *    oldValue: *
 * }
 * where key is the id of the updated preference, newValue is the new
 * value of the preference, and oldValue is the old value. Observers
 * are not notified of script or event level changes.
 *
 * @constructor
 * @implements {DejaClick.Closable}
 * @param {!DejaClick.ObserverService} aObserverService Service to
 *    propagate news of a change in the value of a preference to
 *    interested parties.
 * @param {!Storage} aStorage Mechanism for persistently storing
 *    preference settings. The extension's localStorage object.
 */
DejaClick.PreferenceService = function (aObserverService, aStorage) {
   this.m_observerService = aObserverService;
   this.m_storage = aStorage;
   /**
    * Collection of known preferences, their default values, and type
    * validators.
    * @type {!Object.<string,!{
    *    name:string,
    *    type:!DejaClick.PreferenceService.Type,
    *    defaultValue:*,
    *    value:*
    * }>}
    */
   this.m_prefs = {};
};


/**
 * PreferenceType is an interface for defining the type of a
 * preference value.  A PreferenceType may be used to verify whether
 * an arbitrary valid meets the type's requirements or to encode or
 * decode a value from a text string.
 * @interface
 */
DejaClick.PreferenceService.Type = function () {};

DejaClick.PreferenceService.Type.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.Type,

   /**
    * Verify that the value meets the type requirements.
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if value meets the requirements of the type.
    */
   validate: function (aValue) { return false; },

   /**
    * Encode the value as a text string suitable for use as an XML
    * attribute value.
    * @param {*} aValue The value to be encoded.
    * @return {string} The text encoding of the value.
    *
    * Note: It is assumed that validate(value) returns true.
    */
   encode: function (aValue) { return ''; },

   /**
    * Decode the value from a text string. This is the inverse to encode.
    * @param {string} aText The text-encoding of the value.
    * @return {*} The decoded value, or null if the encoding is invalid.
    */
   decode: function (aText) { return null; }
};


DejaClick.PreferenceService.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService,

   /**
    * Release all references to external objects.
    * The preference service is no longer usable.
    * @this {!DejaClick.PreferenceService}
    */
   close: function () {
      delete this.m_prefs;
      delete this.m_storage;
      delete this.m_observerService;
   },

   /**
    * Define a named preference and its default value.
    * Throws an exception if the preference id has already been defined
    * or if the default value fails validation.
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId Name by which the preference is known in the
    *    PreferenceService API.
    * @param {*} aDefaultValue The default value for the preference.
    * @param {!DejaClick.PreferenceService.Type} aType Type of the
    *    preference value.
    * @param {string=} opt_name The key under which the preference
    *    value is held in the persistent store. If not specified, id
    *    is used.
    * @return {!DejaClick.PreferenceService} this
    */
   define: function (aId, aDefaultValue, aType, opt_name) {
      var name, value;
      if (this.hasOwnProperty.call(this.m_prefs, aId)) {
         throw new Error('Duplicate preference specified: ' + aId);
      } else if (!aType.validate(aDefaultValue)) {
         throw new Error('Default value ' + aDefaultValue + ' for ' +
            aId + ' fails validation.');
      }
      name = (opt_name == null) ? aId : opt_name;
      value = this.m_storage.getItem(name);
      if (value !== null) {
         try {
            value = JSON.parse(value);
         } catch (ex) {
            // Ignore parse error. Treat as a string.
         }
         if (!aType.validate(value)) {
            this.m_storage.removeItem(name);
            value = aDefaultValue;
         }
      } else {
         value = aDefaultValue;
      }
      this.m_prefs[aId] = {
         name: name,
         type: aType,
         defaultValue: aDefaultValue,
         value: value
      };
      return this;
   },

   /**
    * Define a named preference when its default value is stored in a file.
    * It's a async wrapper for the DejaClick.PreferenceService.define method
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId Name by which the preference is known in the
    *    PreferenceService API.
    * @param {string} aDefaultValueFileName The name of the file that contains
    *    default value for the preference. Filename shouldn't contain path
    *    (always '/src/common/data/') and extension (always '.json').
    *    I.e. 'dejaPref' will load data from '/src/common/data/dejaPref.json'
    * @param {!DejaClick.PreferenceService.Type} aType Type of the
    *    preference value.
    * @param {string=} opt_name The key under which the preference
    *    value is held in the persistent store. If not specified, id
    *    is used.
    * @return {!DejaClick.PreferenceService} this
    */
   defineFromFile: function (aId, aDefaultValueFileName, aType, opt_name) {
      var xhr = new XMLHttpRequest(),
         mobileData;

      if (chrome && chrome.extension && chrome.extension.getURL) {
         xhr.onreadystatechange = function () {
            var status, data;
            if (xhr.readyState == 4) { // `DONE`
               if (xhr.status == 200) {
                  try {
                     data = JSON.parse(xhr.responseText);
                     this.define(aId, data, aType, opt_name);
                  } catch (ex) {
                     console.log(ex);
                  }
               } else {
                  console.log(xhr.status);
               }
            }
         }.bind(this);

         xhr.open("GET", chrome.extension.getURL('/common/data/' + aDefaultValueFileName + '.json'), true);
         xhr.overrideMimeType('application/javascript');
         xhr.send();
      }

      return this;
   },

   /**
    * Reset all system preferences to their default values.
    * @this {!DejaClick.PreferenceService}
    * @param {!Object.<string>} aKeepPrefs Collection of preferences
    *    that should NOT be reset.
    * @return {!DejaClick.PreferenceService} this
    */
   clear: function (aKeepPrefs) {
      /** @type {string} */
      var key;
      for (key in this.m_prefs) {
         if (this.hasOwnProperty.call(this.m_prefs, key) &&
               !this.hasOwnProperty.call(aKeepPrefs, key)) {
            this.resetPrefOption(key);
         }
      }
      return this;
   },

   /**
    * Reread all system preference values from storage, notifying
    * listeners of any changed values.
    * @this {!DejaClick.PreferenceService}
    * @return {!DejaClick.PreferenceService} this
    */
   refresh: function () {
      var /** @type {string} */ key, pref, value, oldValue;
      for (key in this.m_prefs) {
         if (this.hasOwnProperty.call(this.m_prefs, key)) {
            pref = this.m_prefs[key];
            value = this.m_storage.getItem(pref.name);
            if (value !== null) {
               try {
                  value = JSON.parse(value);
               } catch (ex) {
                  // Ignore parse error. Treat as a string.
               }
               if (!pref.type.validate(value)) {
                  this.m_storage.removeItem(pref.name);
                  value = pref.defaultValue;
               }
            } else {
               value = pref.defaultValue;
            }
            if (pref.value !== value) {
               oldValue = pref.value;
               pref.value = value;
               this.notify(key, value, oldValue);
            }
         }
      }
      return this;
   },

   /**
    * Get a list of all defined preference ids.
    * @this {!DejaClick.PreferenceService}
    * @return {!Array.<string>} A list of the known preference ids.
    */
   getPreferences: function () {
      return Object.keys(this.m_prefs) || [];
   },

   /**
    * Applies new values to a set of preferences.
    * @this {!DejaClick.PreferenceService}
    * @param {!Object.<string>} aPrefValues Collection of preference
    *    names and values to set.
    *    Throws an exception if a preference name is not recognized or
    *    if the new value is not valid for that preference.
    */
   apply: function (aPrefValues) {
      for (var prefName in aPrefValues) {
         if (this.hasOwnProperty.call(aPrefValues, prefName)) {

            var id = 'DC_OPTID_' + prefName.toUpperCase();
            if (this.hasOwnProperty.call(this.m_prefs, id)) {

               var pref = this.m_prefs[id];
               var newValue = aPrefValues[prefName];
               var decodedValue = pref.type.decode(newValue);
               if (decodedValue === null) {
                  throw new Error('Invalid value [' + newValue + '] given for preference name ' +
                        id + ' of type ' + pref.type.toString());
               }
               pref.value = decodedValue;
            } else {
               throw new Error('Unknown preference name: ' + prefName);
            }
         }
      }
   },

   /**
    * Determine whether there is a value set for this preference at a
    * particular level (event, script, or system). The value may be
    * the same as the default value.
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId The preference in question.
    *    Throws an exception if the id is not recognized.
    * @param {!DejaClick.Script=} opt_script If defined, the script in
    *    which to look for the preference value.
    * @param {(Element|string)=} opt_event If defined, the event (or
    *    its hashkey) in which to look for the preference value.
    * @param {string=} opt_modTag If defined, the setting at either
    *    the script or event level must include an attribute with this
    *    name for hasPrefOption to return true.
    * @return {boolean} True if there is a user setting for this
    *    preference at the chosen value.
    */
   hasPrefOption: function (aId, opt_script, opt_event, opt_modTag) {
      var pref, elt, encoded, result;

      pref = this.m_prefs[aId];
      result = false;
      if (opt_script == null) {
         result = (this.m_storage.getItem(pref.name) !== null);
      } else {
         if (typeof opt_event === 'string') {
            elt = opt_script.getHashkeyNode(opt_event);
         } else if (opt_event == null) {
            elt = opt_script.getScriptElement();
         } else {
            elt = opt_event;
         }
         if ((elt !== null) &&
               opt_script.domTreeHasAttribute(elt, pref.name, opt_modTag)) {
            encoded = opt_script.domTreeGetAttribute(elt, pref.name);
            if ((encoded !== null) && (pref.type.decode(encoded) !== null)) {
               result = true;
            }
         }
      }
      return result;
   },

   /**
    * Get the current value of the preference for the specified
    * context (i.e., event, script, or system).  If no value is
    * specified in that context, use the enclosing context(s).
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId The id of the preference.
    *    Throws an exception if the id is not recognized.
    * @param {?DejaClick.Script=} opt_script If defined, the script in
    *    which to look for the preference value.
    * @param {(Element|string)=} opt_event If defined, the event (or
    *    its hashkey) in which to look for the preference value.
    * @return {*} The value.
    */
   getPrefOption: function (aId, opt_script, opt_event) {
      var pref, result, elt;

      pref = this.m_prefs[aId];
      result = null;
      if (opt_script == null) {
      } else {
         if (opt_event == null) {
         } else {
            if (typeof opt_event === 'string') {
               elt = opt_script.getHashkeyNode(opt_event);
            } else {
               elt = opt_event;
            }
            if (elt !== null) {
               result = opt_script.domTreeGetAttribute(elt, pref.name);
               if (result !== null) {
                  result = pref.type.decode(result);
               }
            }
         }
         if (result === null) {
            elt = opt_script.getScriptElement();
            result = opt_script.domTreeGetAttribute(elt, pref.name);
            if (result !== null) {
               result = pref.type.decode(result);
            }
         }
      }
      return (result === null) ? pref.value : result;
   },

   /**
    * Get the default value of the preference.
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId The id of the preference.
    *    Throws an exception if the id is not recognized.
    * @return {*} The default value of the preference.
    */
   getDefault: function (aId) {
      return this.m_prefs[aId].defaultValue;
   },

   /**
    * Get the type of the named preference.
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId The id of the preference.
    *    Throws an exception if the id is not recognized.
    * @return {!DejaClick.PreferenceService.Type} The type for the named
    *    preference.
    */
   getType: function (aId) {
      return this.m_prefs[aId].type;
   },

   /**
    * Set the value of the preference in the specified context (event,
    * script, or system). Notify listeners if the value of the
    * preference in the system context changes.
    *
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId Id of the preference
    *    Throws an exception if the id is not recognized.
    * @param {*} aValue The new value. An exception will be thrown if the
    *    value is not valid for this preference.
    * @param {!DejaClick.Script=} opt_script If defined, the script in
    *    which to set the preference's value.
    * @param {(Element|string)=} opt_event If defined, the event
    *    element (or its hashkey) in which to set the preference's value.
    * @param {string=} opt_modTag Name of the attribute in which to
    *    store a timestamp when setting the value in an event or script
    *    context.
    * @return {!DejaClick.PreferenceService} this
    */
   setPrefOption: function (aId, aValue, opt_script, opt_event, opt_modTag) {
      var pref, elt, oldValue;

      pref = this.m_prefs[aId];
      if (!pref.type.validate(aValue)) {
         throw new Error('Invalid value [' + aValue + '] for preference ' +
            aId);

      } else if (opt_script == null) {
         if (pref.value !== aValue) {
            oldValue = pref.value;
            pref.value = aValue;
            this.m_storage.setItem(pref.name, JSON.stringify(aValue));
            this.notify(aId, aValue, oldValue);
         }

      } else {
         if (typeof opt_event === 'string') {
            elt = opt_script.getHashkeyNode(opt_event);
         } else if (opt_event == null) {
            elt = opt_script.getScriptElement();
         } else {
            elt = opt_event;
         }
         if (elt !== null) {
            opt_script.domTreeChangeAttribute(elt, pref.name,
               pref.type.encode(aValue), opt_modTag);
         }
      }
      return this;
   },

   /**
    * Reset a system preference to its default value or remove the
    * setting for the preference in an event or script context. Notify
    * listeners if the value of the preference in the system context
    * changes.
    *
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId Id of the preference to be reset.
    * @param {!DejaClick.Script=} opt_script If defined, remove the
    *    value of the preference from this script or an event within it.
    * @param {(Element|string)=} opt_event If defined, remove the
    *    value of the preference from this event or the event identified
    *    by this hashkey.
    * @return {!DejaClick.PreferenceService} this
    */
   resetPrefOption: function (aId, opt_script, opt_event) {
      var pref, elt, oldValue;
      pref = this.m_prefs[aId];
      if (opt_script == null) {
         this.m_storage.removeItem(pref.name);
         oldValue = pref.value;
         pref.value = pref.defaultValue;
         if (pref.value !== oldValue) {
            this.notify(aId, pref.value, oldValue);
         }

      } else {
         if (typeof opt_event === 'string') {
            elt = opt_script.getHashkeyNode(opt_event);
         } else if (opt_event == null) {
            elt = opt_script.getScriptElement();
         } else {
            elt = opt_event;
         }
         if (elt !== null) {
            opt_script.domTreeDelAttribute(elt, pref.name);
         }
      }
      return this;
   },

   /**
    * Notify interested observers of a change made to the global value
    * of a preference.
    * @this {!DejaClick.PreferenceService}
    * @param {string} aId The name of the preference that has changed.
    * @param {*} aNewValue The new value of the preference.
    * @param {*} aOldValue The old value of the preference.
    */
   notify: function (aId, aNewValue, aOldValue) {
      this.m_observerService.notifyLocalObservers('dejaclick:preferences', {
         key: aId,
         newValue: aNewValue,
         oldValue: aOldValue
      });
   }
};

/**
 * BooleanType describes preferences with boolean values.
 * @constructor
 * @implements {DejaClick.PreferenceService.Type}
 */
DejaClick.PreferenceService.BooleanType = function () {};

DejaClick.PreferenceService.BooleanType.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.BooleanType,

   /**
    * Verify that a value is actually boolean.
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if aValue is boolean.
    */
   validate: function (aValue) { return typeof aValue === 'boolean'; },

   /**
    * Encode the boolean value as a string.
    * @param {*} aValue The boolean value to be encoded.
    * @return {string} The encoded value.
    */
   encode: function (aValue) { return String(aValue); },

   /**
    * Decode the string into a boolean value.
    * @param {string} aText Text-encoding of a boolean value.
    * @return {*} The decoded value (or null if it is not a boolean).
    */
   decode: function (aText) {
      if (aText === 'true') {
         return true;
      } else if (aText === 'false') {
         return false;
      } else {
         return null;
      }
   }
};


/**
 * StringType describes preferences with boolean values.
 * @constructor
 * @implements {DejaClick.PreferenceService.Type}
 */
DejaClick.PreferenceService.StringType = function () {};

DejaClick.PreferenceService.StringType.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.StringType,

   /**
    * Verify that a value is actually a string.
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if aValue is a string.
    */
   validate: function (aValue) { return typeof aValue === 'string'; },

   /**
    * Encode the string value (a noop).
    * @param {*} aValue The string value to be encoded.
    * @return {string} The encoded value.
    */
   encode: function (aValue) { return String(aValue); },

   /**
    * Decode the string into a string value.
    * @param {string} aText Text-encoding of a string value.
    * @return {string} The decoded value.
    */
   decode: function (aText) { return aText; }
};


/**
 * NumberType describes preferences with numeric values.
 * The range of acceptable numbers may be limited.
 * @constructor
 * @implements {DejaClick.PreferenceService.Type}
 * @param {number=} opt_min Optional minimum valid value for the type.
 * @param {number=} opt_max Optional maximum valid value for the type.
 */
DejaClick.PreferenceService.NumberType = function (opt_min, opt_max) {
   this.m_min = (opt_min == null) ? -Infinity : opt_min;
   this.m_max = (opt_max == null) ? Infinity : opt_max;
};

DejaClick.PreferenceService.NumberType.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.NumberType,

   /**
    * Verify that a value is actually a number in the configured range.
    * @this {!DejaClick.PreferenceService.NumberType}
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if aValue is a number in the configured range.
    */
   validate: function (aValue) {
      return (typeof aValue === 'number') &&
         (this.m_min <= aValue) &&
         (aValue <= this.m_max);
   },

   /**
    * Encode the number value.
    * @param {*} aValue The numeric value to be encoded.
    * @return {string} The encoded value.
    */
   encode: function (aValue) {
      return String(aValue);
   },

   /**
    * Decode the string into a numeric value.
    * @this {!DejaClick.PreferenceService.NumberType}
    * @param {string} aText Text-encoding of a numeric value.
    * @return {?number} The decoded value (or null if not a valid encoding).
    */
   decode: function (aText) {
      var value = (aText.length === 0) ? NaN : Number(aText);
      return this.validate(value) ? value : null;
   }
};


/**
 * IntegerType describes preferences with integral values.
 * The range of acceptable integers may be limited.
 * @constructor
 * @implements {DejaClick.PreferenceService.Type}
 * @param {number=} opt_min Optional minimum valid value for the type.
 * @param {number=} opt_max Optional maximum valid value for the type.
 */
DejaClick.PreferenceService.IntegerType = function (opt_min, opt_max) {
   this.m_min = (opt_min == null) ? -Infinity : opt_min;
   this.m_max = (opt_max == null) ? Infinity : opt_max;
};

DejaClick.PreferenceService.IntegerType.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.IntegerType,

   /**
    * Verify that a value is actually an integer in the configured range.
    * @this {!DejaClick.PreferenceService.IntegerType}
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if aValue is a integer in the configured range.
    */
   validate: function (aValue) {
      return (typeof aValue === 'number') &&
         (aValue % 1 === 0) &&
         (this.m_min <= aValue) &&
         (aValue <= this.m_max);
   },

   /**
    * Encode the integral value.
    * @this {!DejaClick.PreferenceService.IntegerType}
    * @param {*} aValue The integer value to be encoded.
    * @return {string} The encoded value.
    */
   encode: function (aValue) {
      return String(aValue);
   },

   /**
    * Decode the string into a integral value.
    * @this {!DejaClick.PreferenceService.IntegerType}
    * @param {string} aText Text-encoding of a integral value.
    * @return {?integer} The decoded value (or null if not a valid encoding).
    */
   decode: function (aText) {
      var value = (aText.length === 0) ? NaN : Number(aText);
      return this.validate(value) ? value : null;
   }
};

/**
 * RecordType describes preferences that consist of a collection of
 * named primitive values (i.e., a simple struct).
 * @constructor
 * @implements {DejaClick.PreferenceService.Type}
 */
DejaClick.PreferenceService.RecordType = function () {};

DejaClick.PreferenceService.RecordType.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.RecordType,

   /**
    * Verify that a value is actually an Object whose members are
    * primitive types.
    * @this {!DejaClick.PreferenceService.RecordType}
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if aValue is an Object.
    */
   validate: function (aValue) {
      try {
         return (typeof aValue === 'object') &&
            (aValue !== null) &&
            (JSON.stringify(aValue) !== null);
      } catch (ex) {
         return false;
      }
   },

   /**
    * Encode the object value.
    * @this {!DejaClick.PreferenceService.RecordType}
    * @param {*} aValue The object value to be encoded.
    * @return {string} The encoded value.
    */
   encode: function (aValue) {
      return JSON.stringify(aValue);
   },

   /**
    * Decode the string into a record value.
    * @this {!DejaClick.PreferenceService.RecordType}
    * @param {string} aText Text-encoding of a record value.
    * @return {*} The decoded record (or null if not a valid encoding).
    */
   decode: function (aText) {
      var value;
      try {
         value = JSON.parse(aText);
         if (this.validate(value)) {
            return value;
         }
      } catch (ex) {}
      return null;
   }
};

/**
 * ArrayType describes preferences with arrays of other preference types.
 * @constructor
 * @implements {DejaClick.PreferenceService.Type}
 * @param {!DejaClick.PreferenceService.Type} aEltType The type of
 *    each element of the preference.
 * @param {string=} opt_separator String used to separated elements in the
 *    encoded representation of the array. Defaults to a single space.
 */
DejaClick.PreferenceService.ArrayType = function (aEltType, opt_separator) {
   this.m_elementType = aEltType;
   this.m_separator = (opt_separator == null) ? ' ' : opt_separator;
};

DejaClick.PreferenceService.ArrayType.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.PreferenceService.ArrayType,

   /**
    * Verify that a value is actually an array and each element conforms
    * to the configured element type.
    * @this {!DejaClick.PreferenceService.ArrayType}
    * @param {*} aValue The value to be validated.
    * @return {boolean} true if aValue is an array of the correct type.
    */
   validate: function (aValue) {
      return Array.isArray(aValue) &&
         /** @type {!Array} */ (aValue).every(this.m_elementType.validate,
            this.m_elementType);
   },

   /**
    * Encode the array value.
    * @this {!DejaClick.PreferenceService.ArrayType}
    * @param {*} aValue The array value to be encoded.
    * @return {string} The encoded value.
    */
   encode: function (aValue) {
      return /** @type {!Array} */ (aValue).map(this.m_elementType.encode,
         this.m_elementType).join(this.m_separator);
   },

   /**
    * Decode the string into an array value.
    * @this {!DejaClick.PreferenceService.ArrayType}
    * @param {string} aText Text-encoding of an array value.
    * @return {?Array.<*>} The decoded value (or null if not a valid encoding).
    */
   decode: function (aText) {
      var ary = aText.split(this.m_separator).
         map(this.m_elementType.decode, this.m_elementType);
      if (ary.indexOf(null) !== -1) {
         ary = null;
      }
      return ary;
   }
};
