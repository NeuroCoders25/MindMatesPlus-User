// TODO: Move token generation to backend before production.
// POST /api/zego-token → returns { token } using server-side HMAC.
//
// Note: we use crypto-js (already in package.json) instead of expo-crypto
// because expo-crypto.digestStringAsync only does plain SHA-256 hashes, not
// HMAC. ZEGOCLOUD's token04 spec requires HMAC-SHA256.

import CryptoJS from 'crypto-js';
import Constants from 'expo-constants';

/**
 * Generates a ZEGOCLOUD token04 for the given user and room.
 *
 * The token is valid for 1 hour. In production, replace this call with a
 * backend endpoint that performs the same signing without exposing
 * ZEGO_SERVER_SECRET to the client bundle.
 */
export async function generateZegoToken(
  userID: string,
  roomID: string,
): Promise<string> {
  const appID = Number(Constants.expoConfig?.extra?.zegoAppId ?? 0);
  const serverSecret: string =
    Constants.expoConfig?.extra?.zegoServerSecret ?? '';

  if (!appID || !serverSecret) {
    throw new Error(
      'ZEGO_APP_ID or ZEGO_SERVER_SECRET missing. Set them in .env and app.config.js.',
    );
  }

  // Token04 time fields
  const effectiveTimeInSeconds = 3600;
  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2_147_483_647);

  // Canonical string to sign (alphabetical key order, newline-separated)
  const signContent = [
    'appID=' + appID,
    'createTime=' + createTime,
    'expireTime=' + expireTime,
    'nonce=' + nonce,
    'roomID=' + roomID,
    'userID=' + userID,
  ].join('\n');

  // HMAC-SHA256 using crypto-js — synchronous, no await needed
  const hmac = CryptoJS.HmacSHA256(signContent, serverSecret).toString(
    CryptoJS.enc.Hex,
  );

  // Build the simplified token04 payload
  const payload = JSON.stringify({
    app_id: appID,
    room_id: roomID,
    user_id: userID,
    create_time: createTime,
    expire_time: expireTime,
    nonce,
    privilege: { 1: 1, 2: 1 },
    hmac,
  });

  // ZEGOCLOUD token04 format: "04" prefix + Base64(payload)
  const token = '04' + btoa(payload);
  return token;
}
