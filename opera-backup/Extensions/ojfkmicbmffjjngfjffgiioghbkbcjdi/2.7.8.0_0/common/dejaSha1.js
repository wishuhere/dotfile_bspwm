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

/*global DejaClick,ArrayBuffer,Uint8Array,DataView,Uint32Array*/
/*jslint bitwise: false*/

'use strict';


/**
 * Implementation of Secure Hash Algorithm SHA-1 based upon FIPS PUB 180-4.
 * @param {!ArrayBuffer} aMessage The message to be digested.
 * @return {!ArrayBuffer} The 160-bit message digest.
 */
DejaClick.sha1 = (function () {
   var BITS_PER_BYTE, BITS_PER_WORD, BYTES_PER_WORD,
      BITS_PER_BLOCK, BYTES_PER_BLOCK, WORDS_PER_BLOCK,
      PADDING_BIT_OFFSET, PADDING_BYTE_OFFSET, PADDING_WORD_OFFSET,
      BITS_PER_DIGEST, BYTES_PER_DIGEST, WORDS_PER_DIGEST,
      NUM_WORD_VALUES, SCHEDULE_LENGTH;

   /**
    * Create an ArrayBuffer containing the final blocks (including
    * padding and message length) of the message to be digested. From
    * Section 5.1.1.
    * @param {!Uint8Array} aFinalBytes Array of the last bytes of the
    *    message that do not completely fill a block.
    * @param {integer} aLength The length of the message (in bytes).
    * @return {!ArrayBuffer} The bytes in aFinalBytes plus the padding
    *    and message length. This will be one or two blocks in length.
    */
   function padMessage(aFinalBytes, aLength) {
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
      sizeWords.setUint32(0, aLength / (NUM_WORD_VALUES / BITS_PER_BYTE));
      sizeWords.setUint32(BYTES_PER_WORD, BITS_PER_BYTE * aLength);
      return blocks;
   }

   /**
    * Hash a block of data.
    * @param {!DataView} aBlock 512-bit buffer to be hashed.
    * @param {!Array.<integer>} aHash In/out parameter giving the hash
    *    before and after the given block.
    */
   function hashBlock(aBlock, aHash) {
      var messageSchedule, t, a, b, c, d, e, f, k, temp;

      // Prepare the message schedule.
      messageSchedule = new Uint32Array(80);
      for (t = 0; t < WORDS_PER_BLOCK; ++t) {
         messageSchedule[t] = aBlock.getUint32(t * BYTES_PER_WORD);
      }
      for (t = WORDS_PER_BLOCK; t < SCHEDULE_LENGTH; ++t) {
         messageSchedule[t] = messageSchedule[t - 3] ^
            messageSchedule[t - 8] ^
            messageSchedule[t - 14] ^
            messageSchedule[t - 16];
         messageSchedule[t] = (messageSchedule[t] << 1) |
            (messageSchedule[t] >>> (BITS_PER_WORD - 1));
      }

      // Initialize working variables.
      a = aHash[0];
      b = aHash[1];
      c = aHash[2];
      d = aHash[3];
      e = aHash[4];

      // Loop through message schedule.
      for (t = 0; t < SCHEDULE_LENGTH; ++t) {
         if (t < 20) {
            f = (b & c) ^ (~b & d); //Ch
            k = 0x5a827999;
         } else if (t < 40) {
            f = b ^ c ^ d; //Parity
            k = 0x6ed9eba1;
         } else if (t < 60) {
            f = (b & c) ^ (b & d) ^ (c & d); //Maj
            k = 0x8f1bbcdc;
         } else {
            f = b ^ c ^ d; //Parity
            k = 0xca62c1d6;
         }
         if (f < 0) {
            f += NUM_WORD_VALUES;
         }
         temp = (a << 5) | (a >>> (BITS_PER_WORD - 5));
         if (temp < 0) {
            temp += NUM_WORD_VALUES;
         }
         temp += f + e + k + messageSchedule[t];
         e = d;
         d = c;
         c = (b << 30) | (b >>> (BITS_PER_WORD - 30));
         if (c < 0) {
            c += NUM_WORD_VALUES;
         }
         b = a;
         a = temp;
         while (a >= NUM_WORD_VALUES) {
            a -= NUM_WORD_VALUES;
         }
         //console.log(t, a.toString(16), b.toString(16), c.toString(16), d.toString(16), e.toString(16));
      }

      // Compute intermediate hash value.
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
      aHash[4] += e;
      if (aHash[4] >= NUM_WORD_VALUES) {
         aHash[4] -= NUM_WORD_VALUES;
      }
   }

   BITS_PER_BYTE = 8;
   BITS_PER_WORD = 32;
   BYTES_PER_WORD = BITS_PER_WORD / BITS_PER_BYTE;
   BITS_PER_BLOCK = 512; // m
   BYTES_PER_BLOCK = BITS_PER_BLOCK / BITS_PER_BYTE;
   WORDS_PER_BLOCK = BITS_PER_BLOCK / BITS_PER_WORD;
   PADDING_BIT_OFFSET = 448;
   PADDING_BYTE_OFFSET = PADDING_BIT_OFFSET / BITS_PER_BYTE;
   PADDING_WORD_OFFSET = PADDING_BIT_OFFSET / BITS_PER_WORD;
   BITS_PER_DIGEST = 160;
   BYTES_PER_DIGEST = BITS_PER_DIGEST / BITS_PER_BYTE;
   WORDS_PER_DIGEST = BITS_PER_DIGEST / BITS_PER_WORD;
   NUM_WORD_VALUES = 0x100000000;
   SCHEDULE_LENGTH = 80;

   return function (aMessage) {
      var numInitialBlocks, finalBlocks, hash, offset, digest;
      
      numInitialBlocks = Math.floor(aMessage.byteLength / BYTES_PER_BLOCK);
      finalBlocks = padMessage(new Uint8Array(aMessage,
         numInitialBlocks * BYTES_PER_BLOCK), aMessage.byteLength);

      // Initialize Hash Buffer (Section 5.3.1).
      hash = [ 0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0 ];

      for (offset = 0; numInitialBlocks !== 0; --numInitialBlocks) {
         hashBlock(new DataView(aMessage, offset, BYTES_PER_BLOCK), hash);
         offset = offset + BYTES_PER_BLOCK;
      }
      for (offset = 0;
            offset < finalBlocks.byteLength;
            offset += BYTES_PER_BLOCK) {
         hashBlock(new DataView(finalBlocks, offset, BYTES_PER_BLOCK), hash);
      }

      digest = new DataView(new ArrayBuffer(BYTES_PER_DIGEST));
      digest.setUint32(0, hash[0]);
      digest.setUint32(4, hash[1]);
      digest.setUint32(8, hash[2]);
      digest.setUint32(12, hash[3]);
      digest.setUint32(16, hash[4]);
      return digest.buffer;
   };
}());
