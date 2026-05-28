/**
 * RREADS — Cryptography module
 */

/**
 * Computes SHA-256 hash of a string.
 * @param {string} text 
 * @returns {Promise<string>} Hex representation of the hash
 */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts/Decrypts Uint8Array using cyclic XOR with the key bytes.
 * @param {Uint8Array} dataBytes 
 * @param {Uint8Array} keyBytes 
 * @returns {Uint8Array}
 */
function xorCrypt(dataBytes, keyBytes) {
  if (!keyBytes || keyBytes.length === 0) return dataBytes;
  const result = new Uint8Array(dataBytes.length);
  const keyLen = keyBytes.length;
  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyLen];
  }
  return result;
}

// Export functions to global scope
window.RReadsCrypto = {
  sha256,
  xorCrypt
};
