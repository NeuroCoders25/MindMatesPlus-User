import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { User, Group, Message, JournalEntry, Dass21Result } from '../types';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  selectedGroup: Group | null;
  setSelectedGroup: (group: Group | null) => void;
  assessmentScore: number;
  setAssessmentScore: (score: number) => void;
  dass21Result: Dass21Result | null;
  setDass21Result: (result: Dass21Result) => void;
  journalEntries: JournalEntry[];
  addJournalEntry: (title: string, content: string, mood: string) => void;
  groupMessages: Record<string, Message[]>;
  sendGroupMessage: (text: string, groupId: string) => void;
  aiMessages: Message[];
  sendAiMessage: (text: string) => void;
  showCrisisAlert: boolean;
  setShowCrisisAlert: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapFirebaseUser = (fbUser: FirebaseUser): User => ({
  id: fbUser.uid,
  name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
  email: fbUser.email || '',
  joinedGroups: [],
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [assessmentScore, setAssessmentScore] = useState(0);
  const [dass21Result, setDass21Result] = useState<Dass21Result | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [groupMessages, setGroupMessages] = useState<Record<string, Message[]>>({});
  const [aiMessages, setAiMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm Mindy, your AI companion. How are you feeling today?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? mapFirebaseUser(fbUser) : null);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(fbUser, { displayName: name });
    setUser(mapFirebaseUser({ ...fbUser, displayName: name }));
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const addJournalEntry = (title: string, content: string, mood: string) => {
    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      title,
      content,
      mood,
      timestamp: new Date(),
    };
    setJournalEntries(prev => [newEntry, ...prev]);
    if (
      content.toLowerCase().includes('help') ||
      content.toLowerCase().includes('end it')
    ) {
      setTimeout(() => setShowCrisisAlert(true), 1000);
    }
  };

  const sendGroupMessage = (text: string, groupId: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setGroupMessages(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), newMsg],
    }));
    setTimeout(() => {
      const peerResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I've felt that way too. You're not alone in this.",
        sender: 'peer',
        senderName: 'Sarah',
        timestamp: new Date(),
      };
      setGroupMessages(prev => ({
        ...prev,
        [groupId]: [...(prev[groupId] || []), peerResponse],
      }));
    }, 2000);
  };

  const sendAiMessage = (text: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, newMsg]);
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I understand. It's important to acknowledge those feelings. Would you like to try a quick breathing exercise?",
        sender: 'ai',
        timestamp: new Date(),
      };
      setAiMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <AppContext.Provider
      value={{
        user, setUser,
        authLoading,
        login, register, logout,
        selectedGroup, setSelectedGroup,
        assessmentScore, setAssessmentScore,
        dass21Result, setDass21Result,
        journalEntries, addJournalEntry,
        groupMessages, sendGroupMessage,
        aiMessages, sendAiMessage,
        showCrisisAlert, setShowCrisisAlert,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
