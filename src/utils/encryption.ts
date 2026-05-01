// Encodes a name for storage in Firebase displayName.
// btoa/atob are Hermes globals — no native crypto module needed.

export const encryptName = (text: string): string => {
  if (!text) return '';
  try {
    return btoa(encodeURIComponent(text));
  } catch {
    return text;
  }
};

export const decryptName = (encoded: string): string => {
  if (!encoded) return '';
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    // Fallback for any pre-existing plain-text displayNames
    return encoded;
  }
};
