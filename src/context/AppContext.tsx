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
import {
  saveJournalEntry, fetchJournalEntries, deleteJournalEntry, saveFeedback,
  fetchPeerGroups, fetchUserJoinedGroupIds, joinPeerGroup,
  fetchMentalHealthProfile, MentalHealthProfile,
} from '../services/dataService';
import { User, Group, Message, JournalEntry, Dass21Result, Feedback } from '../types';
import { encryptName, decryptName } from '../utils/encryption';

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
  addJournalEntry: (title: string, content: string, mood: string) => Promise<void>;
  removeJournalEntry: (entryId: string) => Promise<void>;
  submitFeedback: (rating: number, peerComment: string, appComment: string) => Promise<void>;
  peerGroups: Group[];
  groupsLoading: boolean;
  mentalHealthProfile: MentalHealthProfile | null;
  setMentalHealthProfile: (profile: MentalHealthProfile | null) => void;
  joinedGroupIds: string[];
  joinGroup: (groupId: string) => Promise<void>;
  aiMessages: Message[];
  sendAiMessage: (text: string) => void;
  showCrisisAlert: boolean;
  setShowCrisisAlert: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapFirebaseUser = (fbUser: FirebaseUser): User => ({
  id: fbUser.uid,
  name: decryptName(fbUser.displayName || '') || fbUser.email?.split('@')[0] || 'User',
  email: fbUser.email || '',
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [assessmentScore, setAssessmentScore] = useState(0);
  const [dass21Result, setDass21Result] = useState<Dass21Result | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [peerGroups, setPeerGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [mentalHealthProfile, setMentalHealthProfile] = useState<MentalHealthProfile | null>(null);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(mapFirebaseUser(fbUser));
        setGroupsLoading(true);
        const [entries, groups, joinedIds, profile] = await Promise.all([
          fetchJournalEntries(fbUser.uid),
          fetchPeerGroups(),
          fetchUserJoinedGroupIds(fbUser.uid),
          fetchMentalHealthProfile(fbUser.uid),
        ]);
        setJournalEntries(entries);
        setPeerGroups(groups);
        setJoinedGroupIds(joinedIds);
        setMentalHealthProfile(profile);
        setGroupsLoading(false);
      } else {
        setUser(null);
        setJournalEntries([]);
        setPeerGroups([]);
        setMentalHealthProfile(null);
        setJoinedGroupIds([]);
        setGroupsLoading(false);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
    const encryptedName = encryptName(name);
    await updateProfile(fbUser, { displayName: encryptedName });
    setUser(mapFirebaseUser({ ...fbUser, displayName: encryptedName }));
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const addJournalEntry = async (title: string, content: string, mood: string) => {
    if (!user) return;
    const entryData: Omit<JournalEntry, 'id'> = {
      title,
      content,
      mood,
      timestamp: new Date(),
    };
    const id = await saveJournalEntry(user.id, entryData);
    setJournalEntries(prev => [{ ...entryData, id }, ...prev]);
    if (
      content.toLowerCase().includes('help') ||
      content.toLowerCase().includes('end it')
    ) {
      setTimeout(() => setShowCrisisAlert(true), 1000);
    }
  };

  const removeJournalEntry = async (entryId: string) => {
    if (!user) return;
    await deleteJournalEntry(user.id, entryId);
    setJournalEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const joinGroup = async (groupId: string) => {
    if (!user) return;
    await joinPeerGroup(user.id, groupId);
    setJoinedGroupIds(prev => (prev.includes(groupId) ? prev : [...prev, groupId]));
    setPeerGroups(prev =>
      prev.map(g => g.id === groupId ? { ...g, members: g.members + 1 } : g)
    );
  };

  const submitFeedback = async (rating: number, peerComment: string, appComment: string) => {
    if (!user) return;
    await saveFeedback(user.id, { rating, peerComment, appComment, date: new Date() });
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
        peerGroups, groupsLoading, mentalHealthProfile, setMentalHealthProfile,
        joinedGroupIds, joinGroup,
        journalEntries, addJournalEntry, removeJournalEntry,
        submitFeedback,
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
