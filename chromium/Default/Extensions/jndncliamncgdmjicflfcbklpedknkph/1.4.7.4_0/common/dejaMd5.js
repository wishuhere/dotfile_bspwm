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

/*global DejaClick,ArrayBuffer,Uint8Array,DataView*/
/*jslint bitwise: false*/

'use strict';

/**
 * Implementation of MD5 based upon RFC 1321.
 * @param {!ArrayBuffer} aMessage The message to be digested.
 * @return {!ArrayBuffer} The 128-bit message digest.
 */
DejaClick.md5 = (function () {
   var BITS_PER_BYTE, BITS_PER_WORD, BYTES_PER_WORD,
      BITS_PER_BLOCK, BYTES_PER_BLOCK, WORDS_PER_BLOCK,
      PADDING_BIT_OFFSET, PADDING_BYTE_OFFSET, PADDING_WORD_OFFSET,
      NUM_WORD_VALUES;

   /**
    * Create an ArrayBuffer containing the final blocks (including
    * padding and message length) of the message to be digested.  This
    * encompasses steps 1 (Append Padding Bits) and 2 (Append Length)
    * of the algorithm.
    * @param {!Uint8Array} aFinalBytes Array of the last bytes of the
    *    message that do not completely fill a block.
    * @param {integer} aLength The length of the message (in bytes).
    * @return {!ArrayBuffer} The bytes in aFinalBytes plus the padding
    *    and message length. This will be one or two blocks in length.
    */
   function createFinalBlocks(aFinalBytes, aLength) {
      var blocks, blockBytes, sizeWords;

      if (aFinalBytes.length < PADDING_BYTE_OFFSET) {
         blocks = new ArrayBuffer(BYTES_PER_BLOCK);
      } else {
         blocks = new ArrayBuffer(BYTES_PER_BLOCK * 2);
      }
      blockBytes = new Uint8Array(blocks);
      blockBytes.set(aFinalBytes);
      blockBytes[aFinalBytes.length] = 0x80;
      sizeWords = new DataView(blocks, blocks.byteLength - 2 * BYTES_PER_WORD);
      sizeWords.setUint32(0, BITS_PER_BYTE * aLength, true);
      sizeWords.setUint32(BYTES_PER_WORD,
         aLength / (NUM_WORD_VALUES / BITS_PER_BYTE), true);
      return blocks;
   }

   /**
    * Round 1 operation.
    * @param {integer} x An unsigned 32-bit integer.
    * @param {integer} y An unsigned 32-bit integer.
    * @param {integer} z An unsigned 32-bit integer.
    * @param {integer} addend An unsigned integral value to add to the result.
    * @param {integer} shift Number of bits to rotate the result
    *    (between 1 and 31).
    * @return {integer}
    */
   function f(x, y, z, addend, shift) {
      var result;

      result = (x & y) | ((~x) & z);
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += addend;
      result = (result << shift) | (result >>> (BITS_PER_WORD - shift));
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += x;
      if (result >= NUM_WORD_VALUES) {
         result -= NUM_WORD_VALUES;
      }
      return result;
   }

   /**
    * Round 2 operation.
    * @param {integer} x An unsigned 32-bit integer.
    * @param {integer} y An unsigned 32-bit integer.
    * @param {integer} z An unsigned 32-bit integer.
    * @param {integer} addend An unsigned integral value to add to the result.
    * @param {integer} shift Number of bits to rotate the result
    *    (between 1 and 31).
    * @return {integer}
    */
   function g(x, y, z, addend, shift) {
      var result;

      result = (z & x) | ((~z) & y);
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += addend;
      result = (result << shift) | (result >>> (BITS_PER_WORD - shift));
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += x;
      if (result >= NUM_WORD_VALUES) {
         result -= NUM_WORD_VALUES;
      }
      return result;
   }

   /**
    * Round 3 operation.
    * @param {integer} x An unsigned 32-bit integer.
    * @param {integer} y An unsigned 32-bit integer.
    * @param {integer} z An unsigned 32-bit integer.
    * @param {integer} addend An unsigned integral value to add to the result.
    * @param {integer} shift Number of bits to rotate the result
    *    (between 1 and 31).
    * @return {integer}
    */
   function h(x, y, z, addend, shift) {
      var result;

      result = x ^ y ^ z;
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += addend;
      result = (result << shift) | (result >>> (BITS_PER_WORD - shift));
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += x;
      if (result >= NUM_WORD_VALUES) {
         result -= NUM_WORD_VALUES;
      }
      return result;
   }

   /**
    * Round 4 operation.
    * @param {integer} x An unsigned 32-bit integer.
    * @param {integer} y An unsigned 32-bit integer.
    * @param {integer} z An unsigned 32-bit integer.
    * @param {integer} addend An unsigned integral value to add to the result.
    * @param {integer} shift Number of bits to rotate the result
    *    (between 1 and 31).
    * @return {integer}
    */
   function i(x, y, z, addend, shift) {
      var result;

      result = y ^ (x | ~z);
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += addend;
      result = (result << shift) | (result >>> (BITS_PER_WORD - shift));
      if (result < 0) {
         result += NUM_WORD_VALUES;
      }
      result += x;
      if (result >= NUM_WORD_VALUES) {
         result -= NUM_WORD_VALUES;
      }
      return result;
   }

   /**
    * Process a 16-word block (step 4).
    * @param {!DataView} aBlock The 16-word block to be processed.
    * @param {!Array.<integer>} aHash In/out. Initially the hash of the
    *    message preceding the current block. On completion, the hash
    *    value of the message up to the end of the current block.
    */
   function hashBlock(aBlock, aHash) {
      var a, b, c, d;

      a = aHash[0];
      b = aHash[1];
      c = aHash[2];
      d = aHash[3];

      // Round 1
      a = f(b, c, d, a + 0xd76aa478 + aBlock.getUint32( 0, true), 7);
      d = f(a, b, c, d + 0xe8c7b756 + aBlock.getUint32( 4, true), 12);
      c = f(d, a, b, c + 0x242070db + aBlock.getUint32( 8, true), 17);
      b = f(c, d, a, b + 0xc1bdceee + aBlock.getUint32(12, true), 22);

      a = f(b, c, d, a + 0xf57c0faf + aBlock.getUint32(16, true), 7);
      d = f(a, b, c, d + 0x4787c62a + aBlock.getUint32(20, true), 12);
      c = f(d, a, b, c + 0xa8304613 + aBlock.getUint32(24, true), 17);
      b = f(c, d, a, b + 0xfd469501 + aBlock.getUint32(28, true), 22);

      a = f(b, c, d, a + 0x698098d8 + aBlock.getUint32(32, true), 7);
      d = f(a, b, c, d + 0x8b44f7af + aBlock.getUint32(36, true), 12);
      c = f(d, a, b, c + 0xffff5bb1 + aBlock.getUint32(40, true), 17);
      b = f(c, d, a, b + 0x895cd7be + aBlock.getUint32(44, true), 22);

      a = f(b, c, d, a + 0x6b901122 + aBlock.getUint32(48, true), 7);
      d = f(a, b, c, d + 0xfd987193 + aBlock.getUint32(52, true), 12);
      c = f(d, a, b, c + 0xa679438e + aBlock.getUint32(56, true), 17);
      b = f(c, d, a, b + 0x49b40821 + aBlock.getUint32(60, true), 22);

      // Round 2
      a = g(b, c, d, a + 0xf61e2562 + aBlock.getUint32( 4, true), 5);
      d = g(a, b, c, d + 0xc040b340 + aBlock.getUint32(24, true), 9);
      c = g(d, a, b, c + 0x265e5a51 + aBlock.getUint32(44, true), 14);
      b = g(c, d, a, b + 0xe9b6c7aa + aBlock.getUint32( 0, true), 20);

      a = g(b, c, d, a + 0xd62f105d + aBlock.getUint32(20, true), 5);
      d = g(a, b, c, d + 0x02441453 + aBlock.getUint32(40, true), 9);
      c = g(d, a, b, c + 0xd8a1e681 + aBlock.getUint32(60, true), 14);
      b = g(c, d, a, b + 0xe7d3fbc8 + aBlock.getUint32(16, true), 20);

      a = g(b, c, d, a + 0x21e1cde6 + aBlock.getUint32(36, true), 5);
      d = g(a, b, c, d + 0xc33707d6 + aBlock.getUint32(56, true), 9);
      c = g(d, a, b, c + 0xf4d50d87 + aBlock.getUint32(12, true), 14);
      b = g(c, d, a, b + 0x455a14ed + aBlock.getUint32(32, true), 20);

      a = g(b, c, d, a + 0xa9e3e905 + aBlock.getUint32(52, true), 5);
      d = g(a, b, c, d + 0xfcefa3f8 + aBlock.getUint32( 8, true), 9);
      c = g(d, a, b, c + 0x676f02d9 + aBlock.getUint32(28, true), 14);
      b = g(c, d, a, b + 0x8d2a4c8a + aBlock.getUint32(48, true), 20);

      // Round 3
      a = h(b, c, d, a + 0xfffa3942 + aBlock.getUint32(20, true), 4);
      d = h(a, b, c, d + 0x8771f681 + aBlock.getUint32(32, true), 11);
      c = h(d, a, b, c + 0x6d9d6122 + aBlock.getUint32(44, true), 16);
      b = h(c, d, a, b + 0xfde5380c + aBlock.getUint32(56, true), 23);

      a = h(b, c, d, a + 0xa4beea44 + aBlock.getUint32( 4, true), 4);
      d = h(a, b, c, d + 0x4bdecfa9 + aBlock.getUint32(16, true), 11);
      c = h(d, a, b, c + 0xf6bb4b60 + aBlock.getUint32(28, true), 16);
      b = h(c, d, a, b + 0xbebfbc70 + aBlock.getUint32(40, true), 23);

      a = h(b, c, d, a + 0x289b7ec6 + aBlock.getUint32(52, true), 4);
      d = h(a, b, c, d + 0xeaa127fa + aBlock.getUint32( 0, true), 11);
      c = h(d, a, b, c + 0xd4ef3085 + aBlock.getUint32(12, true), 16);
      b = h(c, d, a, b + 0x04881d05 + aBlock.getUint32(24, true), 23);

      a = h(b, c, d, a + 0xd9d4d039 + aBlock.getUint32(36, true), 4);
      d = h(a, b, c, d + 0xe6db99e5 + aBlock.getUint32(48, true), 11);
      c = h(d, a, b, c + 0x1fa27cf8 + aBlock.getUint32(60, true), 16);
      b = h(c, d, a, b + 0xc4ac5665 + aBlock.getUint32( 8, true), 23);

      // Round 4
      a = i(b, c, d, a + 0xf4292244 + aBlock.getUint32( 0, true), 6);
      d = i(a, b, c, d + 0x432aff97 + aBlock.getUint32(28, true), 10);
      c = i(d, a, b, c + 0xab9423a7 + aBlock.getUint32(56, true), 15);
      b = i(c, d, a, b + 0xfc93a039 + aBlock.getUint32(20, true), 21);

      a = i(b, c, d, a + 0x655b59c3 + aBlock.getUint32(48, true), 6);
      d = i(a, b, c, d + 0x8f0ccc92 + aBlock.getUint32(12, true), 10);
      c = i(d, a, b, c + 0xffeff47d + aBlock.getUint32(40, true), 15);
      b = i(c, d, a, b + 0x85845dd1 + aBlock.getUint32( 4, true), 21);

      a = i(b, c, d, a + 0x6fa87e4f + aBlock.getUint32(32, true), 6);
      d = i(a, b, c, d + 0xfe2ce6e0 + aBlock.getUint32(60, true), 10);
      c = i(d, a, b, c + 0xa3014314 + aBlock.getUint32(24, true), 15);
      b = i(c, d, a, b + 0x4e0811a1 + aBlock.getUint32(52, true), 21);

      a = i(b, c, d, a + 0xf7537e82 + aBlock.getUint32(16, true), 6);
      d = i(a, b, c, d + 0xbd3af235 + aBlock.getUint32(44, true), 10);
      c = i(d, a, b, c + 0x2ad7d2bb + aBlock.getUint32( 8, true), 15);
      b = i(c, d, a, b + 0xeb86d391 + aBlock.getUint32(36, true), 21);

      aHash[0] += a;
      if (aHash[0] >= NUM_WORD_VALUES) {
         aHash[0] -= NUM_WORD_VALUES;
      }
      aHash[1] += b;
      if (aHash[1] >= NUM_WORD_VALUES) {
         aHash[1] -= NUM_WORD_VALUES;
      }
      aHash[2] += c;
      if (aHash[2] >= NUM_WORD_VALUES) {
         aHash[2] -= NUM_WORD_VALUES;
      }
      aHash[3] += d;
      if (aHash[3] >= NUM_WORD_VALUES) {
         aHash[3] -= NUM_WORD_VALUES;
      }
   }

   BITS_PER_BYTE = 8;
   BITS_PER_WORD = 32;
   BYTES_PER_WORD = BITS_PER_WORD / BITS_PER_BYTE;
   BITS_PER_BLOCK = 512;
   BYTES_PER_BLOCK = BITS_PER_BLOCK / BITS_PER_BYTE;
   WORDS_PER_BLOCK = BITS_PER_BLOCK / BITS_PER_WORD;
   PADDING_BIT_OFFSET = 448;
   PADDING_BYTE_OFFSET = PADDING_BIT_OFFSET / BITS_PER_BYTE;
   PADDING_WORD_OFFSET = PADDING_BIT_OFFSET / BITS_PER_WORD;
   NUM_WORD_VALUES = 0x100000000;

   return function (aMessage) {
      var numInitialBlocks, finalBlocks, hash, offset, digest;
      if (aMessage.length > 0x1FFFFFFF) {
         throw new Error('Invalid input');
      }
      numInitialBlocks = Math.floor(aMessage.byteLength / BYTES_PER_BLOCK);
      finalBlocks = createFinalBlocks(new Uint8Array(aMessage,
         numInitialBlocks * BYTES_PER_BLOCK), aMessage.byteLength);

      // Step 3. Initialize MD Buffer.
      hash = [ 0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476 ];

      for (offset = 0; numInitialBlocks !== 0; --numInitialBlocks) {
         hashBlock(new DataView(aMessage, offset, BYTES_PER_BLOCK), hash);
         offset = offset + BYTES_PER_BLOCK;
      }
      for (offset = 0;
            offset < finalBlocks.byteLength;
            offset += BYTES_PER_BLOCK) {
         hashBlock(new DataView(finalBlocks, offset, BYTES_PER_BLOCK), hash);
      }
      digest = new DataView(new ArrayBuffer(16));
      digest.setUint32(0, hash[0], true);
      digest.setUint32(4, hash[1], true);
      digest.setUint32(8, hash[2], true);
      digest.setUint32(12, hash[3], true);
      return digest.buffer;
   };
}());
