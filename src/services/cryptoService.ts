import Constants from 'expo-constants'

const BASE_URL: string =
  (Constants.expoConfig?.extra?.mlApiUrl as string | undefined) ??
  (Constants.expoConfig?.extra?.alertApiUrl as string | undefined) ??
  'http://192.168.1.2:8000'

export interface EncryptedMessage {
  ciphertext?: string
  iv?: string
  v?: number
  plaintext?: string
}

export async function encryptText(text: string): Promise<EncryptedMessage | string> {
  try {
    const res = await fetch(`${BASE_URL}/crypto/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return text
    const data = await res.json() as EncryptedMessage
    return data
  } catch (e) {
    console.warn('encryptText failed, storing plaintext fallback:', e)
    return text
  }
}

export async function decryptBatch(
  items: Array<EncryptedMessage | string>
): Promise<string[]> {
  if (items.length === 0) return []
  try {
    const res = await fetch(`${BASE_URL}/crypto/decrypt-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) {
      return items.map(i => typeof i === 'string' ? i : (i.plaintext ?? '[encrypted]'))
    }
    const data = await res.json() as { plaintext: string[] }
    return data.plaintext
  } catch (e) {
    console.warn('decryptBatch failed:', e)
    return items.map(i => typeof i === 'string' ? i : (i.plaintext ?? '[encrypted]'))
  }
}

export function isEncrypted(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    'ciphertext' in (val as object) &&
    'iv' in (val as object)
  )
}
