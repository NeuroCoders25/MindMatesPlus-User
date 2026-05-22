import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  age?: number;
  riskLevel?: 'low' | 'moderate' | 'severe';
}

export type GroupCategory =
  | 'Severe Support'
  | 'Moderate Support'
  | 'Mild Support'
  | 'Wellness - Thriving'
  | 'Wellness - Stress Aware'
  | 'Wellness - Emotionally Aware'
  | 'Recovery & Improvement';

export interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  category: GroupCategory;
  image: any;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'peer';
  senderId?: string;
  senderName?: string;
  timestamp: Date;
  flagged?: boolean;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  mood: string;
  timestamp: Date;
  analysis?: {
    sentiment: string;
    emotion: string;
    risk: 'Low' | 'Moderate' | 'High';
    score: number;
  };
  mlAnalysis?: {
    prediction: string;
    confidence: number;
    probabilities: {
      depression: number;
      anxiety: number;
      normal: number;
    };
  };
}

export interface Dass21SubscaleResult {
  raw: number;
  final: number;
  severity: string;
  severityColor: string;
}

export interface Dass21Result {
  answers: Record<number, number>;
  depression: Dass21SubscaleResult;
  anxiety: Dass21SubscaleResult;
  stress: Dass21SubscaleResult;
  group: 1 | 2 | 3 | 4 | 5;
  groupCategory: GroupCategory;
  groupColor: string;
  message: string;
  ctaLabel: string;
  ctaVariant: 'danger' | 'primary' | 'warning' | 'success';
  reassessInDays: number;
  riskLevel: 'low' | 'moderate' | 'severe';
}

export interface Feedback {
  id: string;
  rating: number;
  peerComment: string;
  appComment: string;
  date: Date;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  category: string;
  contentType: 'text' | 'image';
  imageUrl?: string;
  textContent?: string;
  isActive?: boolean;
  postedBy?: string;
  authorInitials?: string;
  advisor?: { name?: string };
  author?: { name?: string };
  // legacy fields kept for backwards compat
  type?: string;
  content?: string;
  url?: string;
  createdAt: Date;
}

// Built from recent journal ML predictions — stored on the user document
export interface MlMentalHealthProfile {
  latestPrediction: string;
  latestConfidence: number;
  dominantCategory: string;
  depressionCount: number;
  anxietyCount: number;
  normalCount: number;
  lastUpdated: Date;
}

// 5-feature input vector sent to POST /recommend-groups
export interface KnnInput {
  depression_score: number;   // DASS-21 depression subscale × 2  (0–42)
  anxiety_score: number;      // DASS-21 anxiety subscale × 2     (0–42)
  stress_score: number;       // DASS-21 stress subscale × 2      (0–42)
  dominant_emotion: string;   // weekly dominant BERT label: depression | anxiety | normal
  emotion_confidence: number; // average confidence for dominant emotion over 7 days (0–1)
}

// Result of aggregating 7-day mlAnalysisHistory into a dominant emotion signal
export interface WeeklyEmotionSummary {
  dominantEmotion: string;
  averageConfidence: number;
  totalRecords: number;
  emotionDistribution: {
    depression: number;
    anxiety: number;
    normal: number;
  };
}

// Stored at users/{uid}/mentalHealth/recommendationState — owned by KNN pipeline only
export interface KnnRecommendationState {
  peerGroupRecommendationCategory: string;
  dashboardCategory: string;
  recommendationEngine: 'knn';
  lastWeeklyAnalysisAt: Date;
  weeklyTrendSummary: WeeklyEmotionSummary;
}

export interface QuestionnaireScore {
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;
  totalScore: number;
  mainCondition: string;
  category: string;
  completedAt: Date;
}

export interface MlEmotionScore {
  prediction: string;
  confidence: number;
  probabilities: { depression: number; anxiety: number; normal: number };
  recordedAt: Date;
  analyzedAt?: Date;
  sourceTextsUsed?: string[];
}

export interface MlStabilityCounter {
  lastPrediction: string;
  repeatedCount: number;
  lastUpdatedAt: Date;
}

// Persistent recommendation profile stored on the user document.
// Merges questionnaire baseline with ongoing ML emotion analysis.
export interface MentalHealthRecommendationProfile {
  initialQuestionnaireScore: QuestionnaireScore | null;
  latestMlEmotionScore: MlEmotionScore | null;
  baselineRecommendationCategory: GroupCategory;
  activeRecommendationCategory: GroupCategory;
  recommendationSource: 'questionnaire' | 'ml_analysis' | 'advisor_approval';
  userStatus: 'normal' | 'under_review' | 'restricted';
  mlStabilityCounter: MlStabilityCounter | null;
  // Advisor approval fields — populated by the advisor portal on approval
  advisorConnectionStatus?: string;
  approvedCategory?: GroupCategory;
  approvalMessageSeen?: boolean;
  peerGroupRecommendationCategory?: GroupCategory;
  resourceRecommendationCategory?: GroupCategory;
  wellnessScore?: number;
  restrictedReason?: string;
  restrictedAt?: Date;
  knnRecommendedGroup?: string;
  knnMappedCategory?: GroupCategory;
  knnProbabilities?: Record<string, number>;
  knnLastUpdatedAt?: Timestamp;
  knnSafetyFlag?: boolean;
  knnFallbackReason?: 'backend_unreachable' | string;
}

export interface RecommendationResult {
  groups: Group[];
  resources: Resource[];
}

export interface Advisor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  availability: string;
  imageUrl?: string;
  experience?: string;
  sessions?: string;
  about?: string;
}
