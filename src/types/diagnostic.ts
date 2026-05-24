/**
 * Types for the ML Diagnostic Dashboard (dev-only overlay).
 * All fields are nullable to handle partially-populated Firestore documents.
 * Users who have not yet completed the DASS-21 questionnaire will have most
 * fields as null; components must render gracefully in that case.
 */

// ─── Core diagnostic snapshot ─────────────────────────────────────────────────

export interface DiagnosticProfile {
  // DASS-21 questionnaire subscale final scores (×2 of raw; range 0–42 each)
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;

  // Recommendation pipeline — in HomeScreen priority order
  peerGroupRecommendationCategory: string | null;   // P1: rule-based weekly trend
  knnMappedCategory: string | null;                 // P2: KNN output
  baselineRecommendationCategory: string | null;    // P3: frozen DASS-21
  activeRecommendationCategory: string | null;      // P4: stability-based ML

  // Auxiliary
  resourceRecommendationCategory: string | null;

  // User health state
  userStatus: string;                               // 'normal' | 'under_review' | 'restricted'
  wellnessScore: number | null;
  advisorConnectionStatus: string | null;

  // ML stability counter (tracks consecutive high-confidence same-label results)
  mlStabilityCounter: {
    lastPrediction: string;
    repeatedCount: number;
  } | null;

  // Number of consecutive days at the Moderate Support floor (may be 0)
  consecutiveDaysAtBottom: number;

  // KNN-specific result fields
  knnRecommendedGroup: string | null;
  knnProbabilities: Record<string, number> | null;
  knnSafetyFlag: boolean;
  knnLastUpdatedAt: Date | null;
  knnFallbackReason: string | null;
}

// ─── ML analysis history entry ────────────────────────────────────────────────

export interface MLHistoryEntry {
  id: string;
  prediction: string;       // 'depression' | 'anxiety' | 'normal'
  confidence: number;       // 0–1
  probabilities: {
    depression: number;
    anxiety: number;
    normal: number;
  };
  source: 'journal' | 'group_chat' | 'ai_chat';
  textPreview: string;
  createdAt: Date;
}

// ─── Journal entry with BERT annotation ──────────────────────────────────────

export interface JournalBertEntry {
  id: string;
  content: string;          // first 80 chars only
  mood: string;
  createdAt: Date;
  prediction: string | null;
  confidence: number | null;
  probabilities: {
    depression: number;
    anxiety: number;
    normal: number;
  } | null;
}

// ─── Event log entry ──────────────────────────────────────────────────────────

export interface EventLogEntry {
  id: string;
  timestamp: Date;
  field: string;
  oldValue: string;
  newValue: string;
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface DiagnosticDataState {
  profile: DiagnosticProfile | null;
  mlHistory: MLHistoryEntry[];
  journalEntries: JournalBertEntry[];
  eventLog: EventLogEntry[];
  loading: {
    profile: boolean;
    mlHistory: boolean;
    journals: boolean;
  };
  errors: {
    profile: string | null;
    mlHistory: string | null;
    journals: string | null;
  };
  clearLog: () => void;
}
