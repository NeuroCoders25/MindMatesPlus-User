import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { getTrialStatus, TrialStatus } from '../services/paymentService';

export function useTrialStatus(
  connectionId: string | null,
  caseType: string | null | undefined,
) {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(false);
  // Live paymentStatus from the connection doc — wins over initial fetch value.
  const [livePaymentStatus, setLivePaymentStatus] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!connectionId || caseType !== 'critical_case') return;
    setLoading(true);
    getTrialStatus(connectionId)
      .then(data => setTrialStatus(data))
      .catch(err => console.warn('[useTrialStatus] fetch failed:', err))
      .finally(() => setLoading(false));
  }, [connectionId, caseType]);

  // Initial fetch (and re-fetch when connectionId / caseType changes).
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Subscribe to the connection doc for two live signals:
  //   • trialExpired  — backend sets this when the 7-day window closes.
  //   • paymentStatus — flips to 'paid' after processPayment succeeds.
  // Both are needed so the UI transitions without a manual refresh.
  useEffect(() => {
    if (!connectionId || caseType !== 'critical_case') return;
    const unsub = onSnapshot(
      doc(db, 'advisorConnections', connectionId),
      snap => {
        const d = snap.data();
        if (d?.trialExpired) {
          setTrialStatus(prev =>
            prev && !prev.expired ? { ...prev, expired: true, daysLeft: 0 } : prev,
          );
        }
        if (typeof d?.paymentStatus === 'string') {
          setLivePaymentStatus(d.paymentStatus);
        }
      },
    );
    return unsub;
  }, [connectionId, caseType]);

  return { trialStatus, loading, refetch, livePaymentStatus };
}
