import Constants from 'expo-constants';

const BASE = Constants.expoConfig?.extra?.mlApiUrl ?? 'http://192.168.1.2:8000';

export interface PaymentQuote {
  baseFee: number;
  discountPercent: number;
  badgeTierName?: string;
  totalFee: number;
}

export interface TrialStatus {
  status: 'trial' | 'paid' | 'none';
  expired: boolean;
  daysLeft: number;
  hoursLeft?: number;
  finalFee?: number;
  badgeTierName?: string;
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.detail ?? `HTTP ${res.status}`);
    (e as any).status = res.status;
    throw e;
  }
  return res.json();
}

async function apiPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.detail ?? `HTTP ${res.status}`);
    (e as any).status = res.status;
    throw e;
  }
  return res.json();
}

export const getPaymentQuote = (advisorId: string, uid: string): Promise<PaymentQuote> =>
  apiGet(`/payments/quote?advisorId=${advisorId}&uid=${uid}`);

export const processPayment = (connectionId: string, uid: string, advisorId: string): Promise<void> =>
  apiPost('/payments/pay', { connectionId, uid, advisorId });

export const startTrial = (connectionId: string): Promise<void> =>
  apiPost('/payments/start-trial', { connectionId });

export const getTrialStatus = (connectionId: string): Promise<TrialStatus> =>
  apiGet(`/payments/trial-status/${connectionId}`);

export const cancelBooking = (connectionId: string, uid: string): Promise<void> =>
  apiPost('/payments/cancel-booking', { connectionId, uid });
