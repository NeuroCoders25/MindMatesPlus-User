import CryptoJS from 'crypto-js';

// In a real application, this should be an environment variable
const SECRET_KEY = 'mindmatesplus-secret-key-123';

/**
 * Encrypts a string using AES
 * @param text The plain text to encrypt
 * @returns The encrypted string
 */
export const encryptName = (text: string): string => {
  if (!text) return '';
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

/**
 * Decrypts an AES encrypted string
 * @param encryptedText The encrypted string to decrypt
 * @returns The decrypted plain text, or the original text if decryption fails
 */
export const decryptName = (encryptedText: string): string => {
  if (!encryptedText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    // If decryption fails, it might return an empty string or the original text
    return decrypted || encryptedText;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
};
