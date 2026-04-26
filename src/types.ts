export interface User {
  id: string;
  name: string;
  email: string;
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
