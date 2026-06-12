import Constants from 'expo-constants'

const BASE_URL: string =
  (Constants.expoConfig?.extra?.alertApiUrl as string | undefined) ??
  (Constants.expoConfig?.extra?.mlApiUrl as string | undefined) ??
  'http://192.168.1.2:8000'

/**
 * Best-effort: asks the backend to send the listener-request email to the
 * advisor linked to this advisorConnections doc.
 *
 * Never throws — a network failure must never block the connection flow.
 */
export async function triggerListenerRequestEmail(
  connectionId: string,
): Promise<void> {
  try {
    const res = await fetch(
      `${BASE_URL}/listener-alerts/send-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      },
    )
    if (!res.ok) {
      console.warn('[listenerAlert] Email endpoint returned', res.status, 'for connection', connectionId)
      return
    }
    const data: unknown = await res.json()
    console.log('[listenerAlert] Email triggered for connection', connectionId, '— response:', data)
  } catch (e) {
    console.warn('[listenerAlert] triggerListenerRequestEmail failed (non-blocking):', e)
  }
}
