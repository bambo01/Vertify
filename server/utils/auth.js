const { ethers } = require('ethers');

/**
 * Verify wallet signature
 * @param {string} walletAddress - Ethereum wallet address
 * @param {string} message - Original message that was signed
 * @param {string} signature - Signature to verify
 * @returns {boolean} - True if signature is valid
 */
function verifyWalletSignature(walletAddress, message, signature) {
  try {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

module.exports = {
  verifyWalletSignature
};
