const web3utils = require('web3-utils');
const BN = require("bn.js");
const _ = require('underscore');
const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
let decodeMap = {};

for (let i = 0; i < base32.length; i++) {
  decodeMap[base32[i]] = i;
}

/**
 * Convert geohash string representation into numeric where each symbol
 * encoded into 5 bits.
 *
 * For ex. 'qwerqwerqwer' will be converted into BN of `824642203853484471`
 *
 * @param {string} input geohash to encode, for ex. 'sezu06`
 * @returns {BN} bignumber for given geohash
 */
function geohashToNumber(input) {
  const output = new BN('0');

  for (let i = 0; i < input.length; i++) {
    output.ior(new BN(decodeMap[input[i]]));
    if (i !== input.length - 1) {
      output.ishln(5);
    }
  }

  return output;
}

/**
 * Convert a numerical representation of geohash into a string one.
 *
 * For ex. '824642203853484471' will be converted into `qwerqwerqwer`
 *
 * @param {string} input bignumber as a string
 * @returns {string} geohash
 */
function numberToGeohash(input) {
  const num = new BN(input);
  const output = [];
  const fiveBits = new BN(31);

  while (!num.isZero()) {
    // get right 5 bytes
    const d = num.and(fiveBits);
    output.push(base32[d]);
    num.ishrn(5);
  }

  output.reverse();
  return output.join('');
}

module.exports = {
  geohashToNumber,
  numberToGeohash
};
