export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  riskLevel?: 'low' | 'moderate' | 'severe';
  joinedGroups: string[];
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: number;
  category: 'Anxiety' | 'Depression' | 'Stress' | 'General';
  image: any;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'peer';
  senderName?: string;
  timestamp: Date;
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
  groupLabel: string;
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
