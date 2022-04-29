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

/*global DejaClick,window,Uint8Array*/
/*jslint bitwise: false*/

'use strict';

/**
 * The encryption module for DejaClick allows strings to be encrypted
 * and decrypted with the specification of a password. The password
 * for a script may be verified by comparing its cryptographic hash value.
 * @constructor
 * @param {string} aPassword Password to protect the encryption mechanism.
 */
DejaClick.Encryption = function (aPassword) {
   var utf8Password = this.toUtf8(aPassword);
   this.m_password = aPassword;
   this.m_digest = this.createPasswordDigest(utf8Password);
   this.m_schedule = this.createKeySchedule(utf8Password);
};

DejaClick.Encryption.prototype = {
   /** Constructor for objects with this prototype. */
   constructor: DejaClick.Encryption,

   /**
    * Length of key (in bytes) used by this module to perform encryption.
    * @const
    */
   BYTES_PER_KEY: 32,

   /**
    * Length of data blocks (in bytes) encrypted by block cipher.
    * AES restricts this to 128 bits.
    * @const
    */
   BYTES_PER_BLOCK: 16,

   /**
    * Get the password with which this encryption object was initialized.
    * @this {!DejaClick.Encryption}
    * @return {string} The password.
    */
   getPassword: function () {
      return this.m_password;
   },

   /**
    * Get a cryptographic hash identifying the password.
    * @this {!DejaClick.Encryption}
    * @return {string} The cryptographic digest of the password.
    */
   getPasswordDigest: function () {
      return this.m_digest;
   },

   /**
    * Get the key schedule to use when encrypting a block with the
    * given password.
    * This method should only be used for unit testing.
    * @this {!DejaClick.Encryption}
    * @return {!Array.<integer>} The sequence of bytes to use as round keys
    *    for AES encryption.
    */
   getKeySchedule: function () {
      return this.m_schedule;
   },

   /**
    * Encrypt a text string using AES in counter mode. The counter is
    * initialized with a nonce derived from the current time and
    * is incremented after each encryption.
    * @this {!DejaClick.Encryption}
    * @param {string} aPlainText The message to be encrypted.
    * @return {string} Base64 encoded ciphertext.
    */
   encrypt: function (aPlainText) {
      var time, millis, nonce, counterBlock, bytes;

      // Initialize nonce and counter block.
      time = Date.now();
      millis = (time % 1000) & 0xff;
      time = Math.floor(time / 1000);
      nonce = [
         (time >>> 24) & 0xff,
         (time >>> 16) & 0xff,
         (time >>> 8) & 0xff,
         time & 0xff,
         millis,
         millis,
         millis,
         millis
      ];
      counterBlock = new Uint8Array(this.BYTES_PER_BLOCK);
      counterBlock.set(nonce);

      // Get the UTF-8 bytes of the plaintext message.
      bytes = this.toUtf8(aPlainText);
      // Encrypt the message.
      bytes = this.encryptMessage(counterBlock, bytes);
      // Prepend the nonce and Base64 encode the ciphertext.
      return this.toBase64(nonce.concat(bytes));
   },

   /**
    * Decrypt a message that has been encrypted by this algorithm and
    * password.
    * @this {!DejaClick.Encryption}
    * @param {string} aCipher64 Base64 encoded ciphertext.
    * @return {string} The decrypted message.
    */
   decrypt: function (aCipher64) {
      var bytes, counterBlock;

      // Remove the Base64 encoding to retrieve the actual ciphertext.
      bytes = this.fromBase64(aCipher64);

      // Extract nonce from first eight bytes of cipher text.
      counterBlock = new Uint8Array(this.BYTES_PER_BLOCK);
      counterBlock.set(bytes.splice(0, 8));

      // Decrypt the message.
      bytes = this.encryptMessage(counterBlock, bytes);
      // Convert the message to a Unicode string.
      return this.fromUtf8(bytes);
   },

   /**
    * Encrypt (or decrypt) a message using counter mode encryption
    * with AES.
    * @private
    * @this {!DejaClick.Encryption}
    * @param {Uint8Array} aCounterBlock The counter block to be repeatedly
    *    encrypted with AES. It will be modified after each encryption.
    * @param {!Array.<integer>} aMessage Array of plaintext bytes to be
    *    encrypted (or ciphertext bytes to be decrypted). This array
    *    will be modified in place.
    * @return {!Array.<integer>} aMessage.
    */
   encryptMessage: function (aCounterBlock, aMessage) {
      var length, index, cipherBlock, j;
      length = aMessage.length;
      index = 0;
      while (index !== length) {
         // Encrypt the counter block.
         cipherBlock = DejaClick.aes.cipher(aCounterBlock, this.m_schedule);

         // Increment the counter block.
         j = aCounterBlock.length;
         while (j !== 0) {
            --j;
            if (++aCounterBlock[j] !== 0) {
               break;
            }
         }

         // XOR the counter block to the message to encrypt (or decrypt) it.
         for (j = 0;
               (j !== cipherBlock.length) && (index !== length);
               ++j, ++index) {
            aMessage[index] ^= cipherBlock[j];
         }
      }
      return aMessage;
   },

   /**
    * Create a cryptographic hash of a password.
    * @private
    * @this {!DejaClick.Encryption}
    * @param {!Array.<integer>} aPassword The UTF-8 encoded bytes of
    *    the password.
    * @return {string} A cryptographic hash of the password.
    */
   createPasswordDigest: function (aPassword) {
      var salt, input;
      salt = this.bytesToHexArray(DejaClick.md5(
         new Uint8Array(aPassword).buffer));
      salt = this.bytesToHexArray(DejaClick.sha1(salt.buffer));
      input = new Uint8Array(salt.length + aPassword.length);
      input.set(salt);
      input.set(aPassword, salt.length);
      return this.bytesToHexString(DejaClick.md5(input.buffer));
   },

   /**
    * Create a key schedule to be used by AES to encrypt data blocks.
    * @private
    * @this {!DejaClick.Encryption}
    * @param {!Array.<integer>} aPassword The UTF-8 encoded bytes of the
    *    password from which to generated the key schedule.
    * @return {!Array.<integer>} Sequence of bytes containing the round
    *    keys to be used by AES.
    */
   createKeySchedule: function (aPassword) {
      var key, cipherKey;

      key = new Uint8Array(this.BYTES_PER_KEY);
      if (aPassword.length > this.BYTES_PER_KEY) {
         key.set(Array.prototype.slice.call(aPassword, 0, this.BYTES_PER_KEY));
      } else {
         key.set(aPassword);
      }
      cipherKey = DejaClick.aes.cipher(key.subarray(0, this.BYTES_PER_BLOCK),
         DejaClick.aes.keyExpansion(key));
      key.set(cipherKey);
      key.set(cipherKey.slice(0, this.BYTES_PER_KEY - this.BYTES_PER_BLOCK),
         cipherKey.length);
      return DejaClick.aes.keyExpansion(key);
   },

   /**
    * Convert a Base64 encoded string into an array of byte values.
    * @this {!DejaClick.Encryption}
    * @param {string} aString A Base64 encoded string.
    * @return {!Array.<integer>} Array of bytes represented by the
    *    encoded string.
    */
   fromBase64: function (aString) {
      return window.atob(aString).split('').map(this.toCharCode);
   },

   /**
    * Convert an array of bytes into a base-64 encoded string.
    * @this {!DejaClick.Encryption}
    * @param {!Array.<integer>} aByteArray Array of byte values.
    * @return {string} A Base64 encoded representation of the data in the array.
    */
   toBase64: function (aByteArray) {
      return window.btoa(Array.prototype.map.call(aByteArray,
         this.charCodeToString).join(''));
   },

   /**
    * Convert a text string to a UTF-8 encoded array of bytes.
    * @param {string} aString The text string to be encoded.
    * @return {!Array.<integer>} The UTF-8 encoded byte string.
    */
   toUtf8: function (aString) {
      var bytes, length, index, code;

      bytes = [];
      length = aString.length;
      for (index = 0; index < length; ++index) {
         code = aString.charCodeAt(index);
         if (code < 0x80) {
            bytes.push(code);
         } else if (code < 0x800) {
            bytes.push(0xC0 + (code >>> 6));
            bytes.push(0x80 + (code & 0x3F));
         } else if (code < 0x10000) {
            bytes.push(0xE0 + (code >>> 12));
            bytes.push(0x80 + ((code >>> 6) & 0x3F));
            bytes.push(0x80 + (code & 0x3F));
         } else if (code < 0x110000) {
            bytes.push(0xF0 + (code >>> 18));
            bytes.push(0x80 + ((code >>> 12) & 0x3F));
            bytes.push(0x80 + ((code >>> 6) & 0x3F));
            bytes.push(0x80 + (code & 0x3F));
         } else {
            throw new Error('Invalid character code');
         }
      }
      return bytes;
   },

   /**
    * Convert a UTF-8 encoded array of bytes to a text string.
    * @param {!Array.<integer>} aBytes The UTF-8 encoded byte string.
    * @return {string} The JavaScript script corresponding to the UTF-8 bytes.
    */
   fromUtf8: function (aBytes) {
      var chars, length, index, value, code;

      chars = [];
      length = aBytes.length;
      for (index = 0; index < length; ++index) {
         value = aBytes[index];
         if (value < 0x80) {
            chars.push(String.fromCharCode(value));
         } else if (value < 0xc0) {
            throw new Error('Invalid UTF-8 sequence');
         } else if (value < 0xe0) {
            code = value & 0x1f;
            ++index;
            value = aBytes[index];
            if ((value < 0x80) || (0xc0 <= value)) {
               throw new Error('Invalid UTF-8 sequence');
            }
            chars.push(String.fromCharCode((code << 6) + (value & 0x3f)));
         } else if (value < 0xf0) {
            code = value & 0xf;

            ++index;
            value = aBytes[index];
            if ((value < 0x80) || (0xc0 <= value)) {
               throw new Error('Invalid UTF-8 sequence');
            }
            code = (code << 6) + (value & 0x3f);

            ++index;
            value = aBytes[index];
            if ((value < 0x80) || (0xc0 <= value)) {
               throw new Error('Invalid UTF-8 sequence');
            }
            code = (code << 6) + (value & 0x3f);

            chars.push(String.fromCharCode(code));
         } else if (value < 0xf8) {
            code = value & 0x7;

            ++index;
            value = aBytes[index];
            if ((value < 0x80) || (0xc0 <= value)) {
               throw new Error('Invalid UTF-8 sequence');
            }
            code = (code << 6) + (value & 0x3f);

            ++index;
            value = aBytes[index];
            if ((value < 0x80) || (0xc0 <= value)) {
               throw new Error('Invalid UTF-8 sequence');
            }
            code = (code << 6) + (value & 0x3f);

            ++index;
            value = aBytes[index];
            if ((value < 0x80) || (0xc0 <= value)) {
               throw new Error('Invalid UTF-8 sequence');
            }
            code = (code << 6) + (value & 0x3f);

            chars.push(String.fromCharCode(code));
         }
      }
      return chars.join('');
   },

   /**
    * Convert a byte string to a byte string containing the ASCII
    * values of the hexadecimal representation of the original byte
    * string. (e.g., [ 0x01, 0x23, 0x45, 0x67 ] =>
    * [ 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37 ]).
    * @param {!ArrayBuffer} aBytes Array of bytes to be encoded.
    * @return {!Uint8Array} Array of bytes containing character codes
    *    of hexadecimal values
    */
   bytesToHexArray: function (aBytes) {
      var bytes, length, hexBytes, index, offset, value;
      bytes = new Uint8Array(aBytes);
      length = bytes.length;
      hexBytes = new Uint8Array(2 * length);
      for (index = 0, offset = 0; index < length; ++index, ++offset) {
         value = bytes[index];
         hexBytes[offset] = (value >>> 4).toString(16).charCodeAt(0);
         ++offset;
         hexBytes[offset] = (value & 0xf).toString(16).charCodeAt(0);
      }
      return hexBytes;
   },

   /**
    * Convert a byte string into a hexadecimal string representing
    * the values of each byte.
    * @param {!ArrayBuffer} aBuffer The array of bytes to be encoded.
    * @return {string} The hexadecimal representation.
    */
   bytesToHexString: function (aBuffer) {
      var bytes, result, index;
      bytes = new Uint8Array(aBuffer);
      result = '';
      for (index = 0; index < bytes.length; ++index) {
         result += ('0' + bytes[index].toString(16)).slice(-2);
      }
      return result;
   },

   /**
    * Return the character code of the first character of a string.
    * @private
    * @param {string} aChar The string containing a character.
    * @return {integer} The character code.
    */
   toCharCode: function (aChar) {
      return aChar.charCodeAt(0);
   },

   /**
    * Create a string containing a single character.
    * @private
    * @param {integer} aCode The character code of the desired string contents.
    * @return {string} The string.
    */
   charCodeToString: function (aCode) {
      return String.fromCharCode(aCode);
   }
};
