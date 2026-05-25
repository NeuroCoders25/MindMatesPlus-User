/**
 * useDiagnosticData — custom hook for the ML Diagnostic Dashboard.
 *
 * Sets up three real-time Firestore onSnapshot listeners:
 *   1. users/{uid}/mentalHealthProfile/currentProfile   — recommendation profile
 *   2. users/{uid}/mlAnalysisHistory (latest 20)       — BERT event history
 *   3. users/{uid}/journal_entries   (latest 10)       — journal BERT entries
 *
 * All listeners are cleaned up on unmount. The hook also maintains an
 * append-only event log (max 30 entries) tracking watched field changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import type {
  DiagnosticProfile,
  MLHistoryEntry,
  JournalBertEntry,
  EventLogEntry,
  DiagnosticDataState,
} from '../types/diagnostic';

// Monotone counter so event IDs are always unique even within the same ms
let _eventIdCounter = 0;
const makeEventId = (): string => `evt_${Date.now()}_${_eventIdCounter++}`;

// Snapshot of the fields we watch for the event log
interface WatchedSnapshot {
  wellnessScore: string;
  activeRecommendationCategory: string;
  userStatus: string;
  knnMappedCategory: string;
  knnSafetyFlag: string;
  stabilityRepeatedCount: string;
}

const snapshotFrom = (p: DiagnosticProfile): WatchedSnapshot => ({
  wellnessScore:                 String(p.wellnessScore ?? 'null'),
  activeRecommendationCategory:  p.activeRecommendationCategory ?? 'null',
  userStatus:                    p.userStatus,
  knnMappedCategory:             p.knnMappedCategory ?? 'null',
  knnSafetyFlag:                 String(p.knnSafetyFlag),
  stabilityRepeatedCount:        String(p.mlStabilityCounter?.repeatedCount ?? 0),
});

const FIELD_LABELS: Record<keyof WatchedSnapshot, string> = {
  wellnessScore:                'wellnessScore',
  activeRecommendationCategory: 'activeRecommendationCategory',
  userStatus:                   'userStatus',
  knnMappedCategory:            'knnMappedCategory',
  knnSafetyFlag:                'knnSafetyFlag',
  stabilityRepeatedCount:       'mlStabilityCounter.repeatedCount',
};

// ─────────────────────────────────────────────────────────────────────────────

export const useDiagnosticData = (uid: string): DiagnosticDataState => {
  const [profile, setProfile]         = useState<DiagnosticProfile | null>(null);
  const [mlHistory, setMlHistory]     = useState<MLHistoryEntry[]>([]);
  const [journals, setJournals]       = useState<JournalBertEntry[]>([]);
  const [eventLog, setEventLog]       = useState<EventLogEntry[]>([]);

  const [loadingProfile, setLoadingProfile]   = useState(true);
  const [loadingMlHistory, setLoadingMlHistory] = useState(true);
  const [loadingJournals, setLoadingJournals]  = useState(true);

  const [errProfile,   setErrProfile]   = useState<string | null>(null);
  const [errMlHistory, setErrMlHistory] = useState<string | null>(null);
  const [errJournals,  setErrJournals]  = useState<string | null>(null);

  // Tracks the previous watched snapshot for diffing; empty means first load
  const prevWatchedRef = useRef<WatchedSnapshot | null>(null);

  const appendEventLog = useCallback((field: string, oldValue: string, newValue: string) => {
    const entry: EventLogEntry = {
      id: makeEventId(),
      timestamp: new Date(),
      field,
      oldValue,
      newValue,
    };
    setEventLog(prev => {
      const next = [...prev, entry];
      return next.length > 30 ? next.slice(next.length - 30) : next;
    });
  }, []);

  const clearLog = useCallback(() => setEventLog([]), []);

  // ── Listener 1: mentalHealthProfile/currentProfile ──────────────────────────
  useEffect(() => {
    const profileRef = doc(db, 'users', uid, 'mentalHealthProfile', 'currentProfile');

    const unsub = onSnapshot(
      profileRef,
      snap => {
        setLoadingProfile(false);
        setErrProfile(null);

        if (!snap.exists()) {
          setProfile(null);
          return;
        }

        const raw = snap.data();
        const qs         = (raw.initialQuestionnaireScore as Record<string, unknown>) ?? {};
        const rawCounter = raw.mlStabilityCounter as Record<string, unknown> | null | undefined;

        const knnLastUpdatedAt: Date | null =
          raw.knnLastUpdatedAt instanceof Timestamp
            ? raw.knnLastUpdatedAt.toDate()
            : null;

        const newProfile: DiagnosticProfile = {
          depressionScore: typeof qs.depressionScore === 'number' ? qs.depressionScore : 0,
          anxietyScore:    typeof qs.anxietyScore    === 'number' ? qs.anxietyScore    : 0,
          stressScore:     typeof qs.stressScore     === 'number' ? qs.stressScore     : 0,

          peerGroupRecommendationCategory:
            typeof raw.peerGroupRecommendationCategory === 'string'
              ? raw.peerGroupRecommendationCategory
              : null,
          knnMappedCategory:
            typeof raw.knnMappedCategory === 'string' ? raw.knnMappedCategory : null,
          baselineRecommendationCategory:
            typeof raw.baselineRecommendationCategory === 'string'
              ? raw.baselineRecommendationCategory
              : null,
          activeRecommendationCategory:
            typeof raw.activeRecommendationCategory === 'string'
              ? raw.activeRecommendationCategory
              : null,
          resourceRecommendationCategory:
            typeof raw.resourceRecommendationCategory === 'string'
              ? raw.resourceRecommendationCategory
              : null,

          userStatus:               typeof raw.userStatus === 'string' ? raw.userStatus : 'normal',
          wellnessScore:            typeof raw.wellnessScore === 'number' ? raw.wellnessScore : null,
          advisorConnectionStatus:  typeof raw.advisorConnectionStatus === 'string'
                                      ? raw.advisorConnectionStatus
                                      : null,

          mlStabilityCounter: rawCounter
            ? {
                lastPrediction:  typeof rawCounter.lastPrediction  === 'string'  ? rawCounter.lastPrediction  : 'normal',
                repeatedCount:   typeof rawCounter.repeatedCount   === 'number'  ? rawCounter.repeatedCount   : 0,
              }
            : null,
          consecutiveDaysAtBottom:
            typeof raw.consecutiveDaysAtBottom === 'number' ? raw.consecutiveDaysAtBottom : 0,

          knnRecommendedGroup:  typeof raw.knnRecommendedGroup === 'string' ? raw.knnRecommendedGroup : null,
          knnProbabilities:     raw.knnProbabilities as Record<string, number> | null ?? null,
          knnSafetyFlag:        raw.knnSafetyFlag === true,
          knnLastUpdatedAt,
          knnFallbackReason:    typeof raw.knnFallbackReason === 'string' ? raw.knnFallbackReason : null,
        };

        // Diff against previous snapshot for the event log
        const newSnap = snapshotFrom(newProfile);
        const prevSnap = prevWatchedRef.current;
        if (prevSnap !== null) {
          (Object.keys(newSnap) as Array<keyof WatchedSnapshot>).forEach(key => {
            if (prevSnap[key] !== newSnap[key]) {
              appendEventLog(FIELD_LABELS[key], prevSnap[key], newSnap[key]);
            }
          });
        }
        prevWatchedRef.current = newSnap;
        setProfile(newProfile);
      },
      err => {
        setLoadingProfile(false);
        setErrProfile(err.message);
      }
    );

    return () => {
      unsub();
      prevWatchedRef.current = null; // reset on uid change
    };
  }, [uid, appendEventLog]);

  // ── Listener 2: mlAnalysisHistory (latest 20, newest first) ─────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'users', uid, 'mlAnalysisHistory'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      snap => {
        setLoadingMlHistory(false);
        setErrMlHistory(null);

        const entries: MLHistoryEntry[] = snap.docs.map(d => {
          const data = d.data();
          const createdAt =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : new Date();
          const probs = (data.probabilities as { depression: number; anxiety: number; normal: number } | undefined)
            ?? { depression: 0, anxiety: 0, normal: 1 };

          return {
            id:           d.id,
            prediction:   typeof data.prediction === 'string' ? data.prediction : 'normal',
            confidence:   typeof data.confidence === 'number' ? data.confidence : 0,
            probabilities: probs,
            source:       (data.source as 'journal' | 'group_chat' | 'ai_chat') ?? 'journal',
            textPreview:  typeof data.textPreview === 'string' ? data.textPreview : '',
            createdAt,
          };
        });

        setMlHistory(entries);
      },
      err => {
        setLoadingMlHistory(false);
        setErrMlHistory(err.message);
      }
    );

    return unsub;
  }, [uid]);

  // ── Listener 3: journal_entries (latest 10, newest first) ───────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'users', uid, 'journal_entries'),
      orderBy('date', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(
      q,
      snap => {
        setLoadingJournals(false);
        setErrJournals(null);

        const entries: JournalBertEntry[] = snap.docs.map(d => {
          const data = d.data();
          const createdAt =
            data.date instanceof Timestamp ? data.date.toDate() : new Date();
          const ml = data.ml_analysis as {
            prediction?: string;
            confidence?: number;
            probabilities?: { depression: number; anxiety: number; normal: number };
          } | null | undefined;

          return {
            id:           d.id,
            content:      typeof data.content === 'string' ? data.content.slice(0, 80) : '',
            mood:         typeof data.mood_tag === 'string' ? data.mood_tag : '',
            createdAt,
            prediction:   ml?.prediction ?? null,
            confidence:   typeof ml?.confidence === 'number' ? ml.confidence : null,
            probabilities: ml?.probabilities ?? null,
          };
        });

        setJournals(entries);
      },
      err => {
        setLoadingJournals(false);
        setErrJournals(err.message);
      }
    );

    return unsub;
  }, [uid]);

  return {
    profile,
    mlHistory,
    journalEntries: journals,
    eventLog,
    loading: {
      profile:   loadingProfile,
      mlHistory: loadingMlHistory,
      journals:  loadingJournals,
    },
    errors: {
      profile:   errProfile,
      mlHistory: errMlHistory,
      journals:  errJournals,
    },
    clearLog,
  };
};
