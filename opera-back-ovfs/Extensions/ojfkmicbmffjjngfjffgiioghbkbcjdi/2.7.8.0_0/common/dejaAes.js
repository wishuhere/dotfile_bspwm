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

/*global DejaClick,Uint8Array*/
/*jslint bitwise: false*/

'use strict';


/**
 * Advanced Encryption Standard (AES) implementation from FIPS
 * Publication 197. This supports encryption and decryption of
 * 128-bit blocks using keys of either 128, 192, or 256 bits.
 */
DejaClick.aes = (function () {
   var sbox, sboxInv;

   /**
    * Perform the SubBytes and ShiftRows transformations from the AES
    * specification. Cyclically shift the bytes in the last three
    * rows of the state. Perform a non-linear byte substitution on
    * each byte of the state. Sections 5.1.1 and 5.1.2.
    * This implementation assumes a block size of 16 bytes (Nb = 4).
    * @param {(!Array.<integer>|!Uint8Array)} aState Array of bytes to
    *    be substituted.
    */
   function shiftAndSub(aState) {
      var tmp;
      aState[0] = sbox[aState[0]];
      aState[4] = sbox[aState[4]];
      aState[8] = sbox[aState[8]];
      aState[12] = sbox[aState[12]];

      tmp = sbox[aState[1]];
      aState[1] = sbox[aState[5]];
      aState[5] = sbox[aState[9]];
      aState[9] = sbox[aState[13]];
      aState[13] = tmp;

      tmp = sbox[aState[2]];
      aState[2] = sbox[aState[10]];
      aState[10] = tmp;
      tmp = sbox[aState[6]];
      aState[6] = sbox[aState[14]];
      aState[14] = tmp;

      tmp = sbox[aState[15]];
      aState[15] = sbox[aState[11]];
      aState[11] = sbox[aState[7]];
      aState[7] = sbox[aState[3]];
      aState[3] = tmp;
   }

   /**
    * Perform the InvShiftRows and InvSubBytes transformations from
    * the AES specification.  Cyclically shift the bytes in the last
    * three rows of the state. Perform a non-linear byte substitution
    * on each byte of the state.  Section 5.3.1 and 5.3.2.
    * This implementation assumes a block size of 16 bytes (Nb = 4).
    * @param {(!Array.<integer>|!Uint8Array)} aState Array of bytes to
    *    be substituted.
    */
   function invShiftAndSub(aState) {
      var tmp;
      aState[0] = sboxInv[aState[0]];
      aState[4] = sboxInv[aState[4]];
      aState[8] = sboxInv[aState[8]];
      aState[12] = sboxInv[aState[12]];

      tmp = sboxInv[aState[13]];
      aState[13] = sboxInv[aState[9]];
      aState[9] = sboxInv[aState[5]];
      aState[5] = sboxInv[aState[1]];
      aState[1] = tmp;

      tmp = sboxInv[aState[2]];
      aState[2] = sboxInv[aState[10]];
      aState[10] = tmp;
      tmp = sboxInv[aState[6]];
      aState[6] = sboxInv[aState[14]];
      aState[14] = tmp;

      tmp = sboxInv[aState[3]];
      aState[3] = sboxInv[aState[7]];
      aState[7] = sboxInv[aState[11]];
      aState[11] = sboxInv[aState[15]];
      aState[15] = tmp;
   }

   /**
    * Transform each column of the state by multiplication.
    * Section 5.1.3
    * @param {(!Array.<integer>|!Uint8Array)} aState The state to be
    *    transformed. It is treated as n columns of 4 bytes each.
    * @param {(!Array.<integer>|!Uint8Array)} aOne An array buffer that
    *    can contain four bytes. Its value is of no interest to callers.
    * @param {(!Array.<integer>|!Uint8Array)} aTwo An array buffer that
    *    can contain four bytes. Its value is of no interest to callers.
    */
   function mixColumns(aState, aOne, aTwo) {
      var one, two, column, index, value;
      column = aState.length;
      while (column !== 0) {
         column -= 4;
         for (index = 0; index < 4; ++index) {
            value = aState[column + index];
            aOne[index] = value;
            aTwo[index] = (value < 0x80) ? (2 * value) : ((2 * value) ^ 0x11b);
         }
         aState[column] = aTwo[0] ^ aTwo[1] ^ aOne[1] ^ aOne[2] ^ aOne[3];
         aState[column + 1] = aOne[0] ^ aTwo[1] ^ aTwo[2] ^ aOne[2] ^ aOne[3];
         aState[column + 2] = aOne[0] ^ aOne[1] ^ aTwo[2] ^ aTwo[3] ^ aOne[3];
         aState[column + 3] = aTwo[0] ^ aOne[0] ^ aOne[1] ^ aOne[2] ^ aTwo[3];
      }
   }

   /**
    * Transform each column of the state by multiplication.
    * Section 5.3.3.
    * @param {(!Array.<integer>|!Uint8Array)} aState The state to be
    *    transformed. It is treated as n columns of 4 bytes each.
    * @param {(!Array.<integer>|!Uint8Array)} aOne An array buffer that
    *    can contain four bytes. Its value is of no interest to callers.
    * @param {(!Array.<integer>|!Uint8Array)} aTwo An array buffer that
    *    can contain four bytes. Its value is of no interest to callers.
    * @param {(!Array.<integer>|!Uint8Array)} aFour An array buffer that
    *    can contain four bytes. Its value is of no interest to callers.
    */
   function invMixColumns(aState, aOne, aTwo, aFour) {
      var eight, column, index, value;
      column = aState.length;
      while (column !== 0) {
         column -= 4;
         eight = 0;
         for (index = 0; index < 4; ++index) {
            value = aState[column + index];
            aOne[index] = value;
            value = (value < 0x80) ? (2 * value) : ((2 * value) ^ 0x11b);
            aTwo[index] = value;
            value = (value < 0x80) ? (2 * value) : ((2 * value) ^ 0x11b);
            aFour[index] = value;
            eight ^= (value < 0x80) ? (2 * value) : ((2 * value) ^ 0x11b);
         }
         aState[column] = eight ^
            aFour[0] ^ aTwo[0] ^
            aTwo[1] ^ aOne[1] ^
            aFour[2] ^ aOne[2] ^
            aOne[3];
         aState[column + 1] = eight ^
            aOne[0] ^
            aFour[1] ^ aTwo[1] ^
            aTwo[2] ^ aOne[2] ^
            aFour[3] ^ aOne[3];
         aState[column + 2] = eight ^
            aFour[0] ^ aOne[0] ^
            aOne[1] ^
            aFour[2] ^ aTwo[2] ^
            aTwo[3] ^ aOne[3];
         aState[column + 3] = eight ^
            aTwo[0] ^ aOne[0] ^
            aFour[1] ^ aOne[1] ^
            aOne[2] ^
            aFour[3] ^ aTwo[3];
      }
   }

   /**
    * Add (exclusive-or) the round key to the state.
    * Section 5.1.4
    * @param {(!Array.<integer>|!Uint8Array)} aState The state to which
    *    to add the round key.
    * @param {(!Array.<integer>|!Uint8Array)} aKeySchedule Array of bytes
    *    containing the round key.
    * @param {integer} aOffset Offset into aKeySchedule at which the
    *    round key begins.
    */
   function addRoundKey(aState, aKeySchedule, aOffset) {
      var index = aState.length;
      while (index !== 0) {
         --index;
         aState[index] ^= aKeySchedule[aOffset + index];
      }
   }

   // Byte substitution array for encryption.
   sbox = new Uint8Array([
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5,
      0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0,
      0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc,
      0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a,
      0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0,
      0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b,
      0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85,
      0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5,
      0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17,
      0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88,
      0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c,
      0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9,
      0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6,
      0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e,
      0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94,
      0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68,
      0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
   ]);
   // Byte substitution array for decryption.
   sboxInv = new Uint8Array([
      0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38,
      0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
      0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87,
      0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
      0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d,
      0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
      0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2,
      0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
      0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16,
      0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
      0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda,
      0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
      0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a,
      0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
      0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02,
      0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
      0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea,
      0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
      0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85,
      0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
      0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89,
      0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
      0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20,
      0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
      0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31,
      0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
      0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d,
      0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
      0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0,
      0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
      0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26,
      0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d
   ]);

   return {
      /**
       * Create key schedule from key.
       * Section 5.2
       * @param {(!Array.<integer>|!Uint8Array)} aKey Array of bytes
       *    defining the key. Should be either 16, 24, or 32 bytes long.
       * @param {integer=} opt_wordsPerBlock Number of words per block
       *    of data to be encrypted (i.e., Nb). This shiftAndSub methods
       *    expect this value to be 4, which is the default.
       * @param {integer=} opt_rounds The number of rounds used
       *    to encrypt data with the key (i.e., Nr). This defaults to
       *    the number of words in the key plus 6 (i.e., Nk + 6).
       * @return {!Array.<integer>} Array of bytes containing the round keys.
       */
      keyExpansion: function(aKey, opt_wordsPerBlock, opt_rounds) {
         var keyLength, scheduleLength, keySchedule, rcon, index, srcIndex;
         keyLength = aKey.length;
         scheduleLength = 4 *
            ((opt_wordsPerBlock == null) ? 4 : opt_wordsPerBlock) *
            (((opt_rounds == null) ? ((keyLength / 4) + 6) : opt_rounds) + 1);
         keySchedule = new Array(scheduleLength);
         for (index = 0; index < keyLength; ++index) {
            keySchedule[index] = aKey[index];
         }

         srcIndex = 0;
         rcon = 1;
         for (index = keyLength; index < scheduleLength; index += 4) {
            if ((index % keyLength) === 0) {
               keySchedule[index] = keySchedule[srcIndex] ^
                  (sbox[keySchedule[index - 3]] ^ rcon);
               keySchedule[index + 1] = keySchedule[srcIndex + 1] ^
                  sbox[keySchedule[index - 2]];
               keySchedule[index + 2] = keySchedule[srcIndex + 2] ^
                  sbox[keySchedule[index - 1]];
               keySchedule[index + 3] = keySchedule[srcIndex + 3] ^
                  sbox[keySchedule[index - 4]];
               rcon = (rcon < 128) ? (2 * rcon) : (((2 * rcon) - 0x100) ^ 0x1b);

            } else if ((keyLength > 24) && ((index % keyLength) === 16)) {
               keySchedule[index] = keySchedule[srcIndex] ^
                  sbox[keySchedule[index - 4]];
               keySchedule[index + 1] = keySchedule[srcIndex + 1] ^
                  sbox[keySchedule[index - 3]];
               keySchedule[index + 2] = keySchedule[srcIndex + 2] ^
                  sbox[keySchedule[index - 2]];
               keySchedule[index + 3] = keySchedule[srcIndex + 3] ^
                  sbox[keySchedule[index - 1]];

            } else {
               keySchedule[index] = keySchedule[srcIndex] ^
                  keySchedule[index - 4];
               keySchedule[index + 1] = keySchedule[srcIndex + 1] ^
                  keySchedule[index - 3];
               keySchedule[index + 2] = keySchedule[srcIndex + 2] ^
                  keySchedule[index - 2];
               keySchedule[index + 3] = keySchedule[srcIndex + 3] ^
                  keySchedule[index - 1];
            }
            srcIndex += 4;
         }
         return keySchedule;
      },

      /**
       * Encrypt a block of data using AES and a given key. Section 5.1.
       * The shiftAndSub method requires Nb to be 4, thus the input
       * must be 16 bytes long.
       * @param {(!Array.<integer>|!Uint8Array)} aInput Buffer containing
       *    4*Nb bytes of plaintext to be encrypted.
       * @param {(!Array.<integer>|!Uint8Array)} aKeySchedule Buffer
       *    containing 4*Nb*(Nr+1) bytes of key information.
       * @return {!Array.<integer>} 4*Nb bytes of ciphertext.
       */
      cipher: function(aInput, aKeySchedule) {
         var state, offset, bytesPerBlock, one, two, round;

         state = Array.prototype.slice.call(aInput);

         offset = 0;
         bytesPerBlock = aInput.length;
         addRoundKey(state, aKeySchedule, offset);

         one = new Array(4);
         two = new Array(4);
         for (round = (aKeySchedule.length / bytesPerBlock) - 2;
               round !== 0;
               --round) {
            shiftAndSub(state);
            mixColumns(state, one, two);
            offset += bytesPerBlock;
            addRoundKey(state, aKeySchedule, offset);
         }

         shiftAndSub(state);
         offset += bytesPerBlock;
         addRoundKey(state, aKeySchedule, offset);

         return state;
      },
      
      /**
       * Decrypt a block of data using AES and a given key. Section 5.3.
       * The invShiftAndSub method requires Nb to be 4, thus the input
       * must be 16 bytes long.
       * @param {(!Array.<integer>|!Uint8Array)} aInput Buffer containing
       *    4*Nb bytes of ciphertext to be decrypted.
       * @param {(!Array.<integer>|!Uint8Array)} aKeySchedule Buffer
       *    containing 4*Nb*(Nr+1) bytes of key information.
       * @return {!Array.<integer>} 4*Nb bytes of plaintext.
       */
      invCipher: function(aInput, aKeySchedule) {
         var state, bytesPerBlock, offset, one, two, four;

         state = Array.prototype.slice.call(aInput);

         bytesPerBlock = aInput.length;
         offset = aKeySchedule.length - bytesPerBlock;
         addRoundKey(state, aKeySchedule, offset);

         one = new Array(4);
         two = new Array(4);
         four = new Array(4);
         while (true) {
            invShiftAndSub(state);
            offset -= bytesPerBlock;
            addRoundKey(state, aKeySchedule, offset);
            if (offset === 0) {
               break;
            }
            invMixColumns(state, one, two, four);
         }
         return state;
      }
   };
}());
