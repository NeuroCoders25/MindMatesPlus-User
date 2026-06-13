import Constants from 'expo-constants'

const BASE_URL: string =
  (Constants.expoConfig?.extra?.alertApiUrl as string | undefined) ??
  (Constants.expoConfig?.extra?.mlApiUrl as string | undefined) ??
  'http://192.168.1.2:8000'

/**
 * Best-effort: asks the backend to send the critical-alert email to the
 * advisor linked to this advisorConnections doc.
 *
 * Never throws — a network failure must never block the connection flow.
 * The endpoint is idempotent (skips if emailAlertStatus == "sent"), so
 * calling it more than once for the same connectionId is safe.
 */
export async function triggerCriticalAlertEmail(
  connectionId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE_URL}/critical-alerts/send-email/${connectionId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    )
    if (!res.ok) {
      console.warn('[criticalAlert] Email endpoint returned', res.status, 'for connection', connectionId)
      return false
    }
    const data: unknown = await res.json()
    console.log('[criticalAlert] Email triggered for connection', connectionId, '— response:', data)
    return true
  } catch (e) {
    console.warn('[criticalAlert] triggerCriticalAlertEmail failed (non-blocking):', e)
    return false
  }
}

/**
 * Best-effort: asks the backend to send a cancellation email to the advisor
 * so they know the user has withdrawn their request.
 *
 * Never throws — a network failure must never block the cancellation flow.
 */
export async function triggerCriticalCancellationEmail(
  connectionId: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE_URL}/critical-alerts/cancel-email/${connectionId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    )
    if (!res.ok) {
      console.warn('[criticalAlert] Cancel-email endpoint returned', res.status, 'for connection', connectionId)
      return false
    }
    const data: unknown = await res.json()
    console.log('[criticalAlert] Cancellation email triggered for connection', connectionId, '— response:', data)
    return true
  } catch (e) {
    console.warn('[criticalAlert] triggerCriticalCancellationEmail failed (non-blocking):', e)
    return false
  }
}
