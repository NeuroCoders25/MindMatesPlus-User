export interface User {
  id: string;
  name: string;
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
  category: string;  // matches ML prediction: 'depression' | 'anxiety' | 'normal'
  type: string;      // e.g. 'article' | 'video' | 'exercise'
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

// Input shape prepared for future KNN model — not used for inference yet
export interface KnnInput {
  dassScore: number;
  latestPrediction: string;
  dominantCategory: string;
  depressionCount: number;
  anxietyCount: number;
  normalCount: number;
  preferredGroupCategory: string;
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
