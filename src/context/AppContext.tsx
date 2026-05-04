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
  updateMlMentalHealthProfile, addMlAnalysis,
} from '../services/dataService';
import { sendSupportMessage } from '../services/geminiService';
import { predictText, MlPredictResponse } from '../services/mlApiService';
import { User, Group, Message, JournalEntry, Dass21Result, Feedback, MlMentalHealthProfile } from '../types';
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
  prepareSupportChatFromDass: (result: Dass21Result) => void;
  journalEntries: JournalEntry[];
  addJournalEntry: (title: string, content: string, mood: string, mlAnalysis?: MlPredictResponse) => Promise<void>;
  removeJournalEntry: (entryId: string) => Promise<void>;
  submitFeedback: (rating: number, peerComment: string, appComment: string) => Promise<void>;
  peerGroups: Group[];
  groupsLoading: boolean;
  mentalHealthProfile: MentalHealthProfile | null;
  setMentalHealthProfile: (profile: MentalHealthProfile | null) => void;
  joinedGroupIds: string[];
  joinGroup: (groupId: string) => Promise<void>;
  mlMentalHealthProfile: MlMentalHealthProfile | null;
  aiMessages: Message[];
  sendAiMessage: (text: string) => Promise<void>;
  showCrisisAlert: boolean;
  setShowCrisisAlert: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Chatbot helpers ────────────────────────────────────────────────────────

const topConcernLabel = (result: Dass21Result) => {
  const dims = [
    { label: 'stress', score: result.stress.final },
    { label: 'anxiety', score: result.anxiety.final },
    { label: 'depression', score: result.depression.final },
  ];
  dims.sort((a, b) => b.score - a.score);
  return dims[0].label;
};

const supportMessagesFromResult = (result: Dass21Result): string[] => {
  const concern = topConcernLabel(result);
  if (result.riskLevel === 'severe') {
    return [
      "I'm here with you. Your check-in shows a high level of distress right now.",
      'Before anything else, please connect with a professional advisor or trusted person as soon as possible.',
      "While you connect, let's do one grounding step: breathe in for 4, hold 4, and out for 6 for 5 rounds.",
      `If you'd like, I can stay with you and guide one tiny step focused on your ${concern}.`,
    ];
  }
  if (result.riskLevel === 'moderate') {
    return [
      `Thanks for completing the DASS-21. I can see your ${concern} needs support right now.`,
      "Let's make a simple plan for today: one calming action now, one supportive action later, and a short reflection tonight.",
      'Would you like to start with a 2-minute breathing reset or a quick thought reframing prompt?',
    ];
  }
  return [
    'Nice work completing your mental wellness check.',
    `Your scores suggest mild to manageable symptoms, with ${concern} as the main area to watch.`,
    'I can help you keep momentum with a short daily routine and check-ins. Want a 3-step plan for today?',
  ];
};

const getRuleBasedReply = (text: string, result: Dass21Result | null): string => {
  const lower = text.toLowerCase();
  if (result?.riskLevel === 'severe') {
    return 'Thank you for sharing this. Your safety matters most right now. If you feel overwhelmed, please contact a trusted person or crisis support immediately.';
  } else if (lower.includes('breath') || lower.includes('anxious') || lower.includes('panic')) {
    return 'Try this now: inhale for 4, hold 4, exhale for 6. Repeat 5 times. When done, tell me your stress level from 1 to 10.';
  } else if (lower.includes('sad') || lower.includes('down') || lower.includes('hopeless')) {
    return 'I hear you. Let us do one gentle activation step: drink water, open a window, and take a 5-minute walk. Small actions help shift heavy moods.';
  } else if (lower.includes('plan') || lower.includes('routine')) {
    return 'Here is your mini plan: 1) 2-minute breathing now, 2) one supportive message to a trusted person today, 3) 5-minute journal reflection tonight.';
  } else if (result?.riskLevel === 'moderate') {
    return 'You are doing the right thing by checking in. We can break today into one small, doable step. Would you like calm-body, calm-thought, or connection support first?';
  }
  return "I understand. It's important to acknowledge those feelings. Would you like to try a quick breathing exercise?";
};

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
  const [mlMentalHealthProfile, setMlMentalHealthProfile] = useState<MlMentalHealthProfile | null>(null);
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
        setMlMentalHealthProfile(null);
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

  const addJournalEntry = async (title: string, content: string, mood: string, mlAnalysis?: MlPredictResponse) => {
    if (!user) return;
    const entryData: Omit<JournalEntry, 'id'> = {
      title,
      content,
      mood,
      timestamp: new Date(),
      mlAnalysis,
    };
    const id = await saveJournalEntry(user.id, entryData);
    const updatedEntries = [{ ...entryData, id }, ...journalEntries];
    setJournalEntries(updatedEntries);

    if (mlAnalysis) {
      updateMlMentalHealthProfile(user.id, updatedEntries)
        .then(profile => setMlMentalHealthProfile(profile))
        .catch(err => console.error('ML profile update failed:', err));
    }

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
    const feedbackId = await saveFeedback(user.id, { rating, peerComment, appComment, date: new Date() });

    // Analyze feedback text via BERT ML to contribute to ML mental health profile
    const textToAnalyze = [peerComment, appComment].filter(t => t.trim().length > 0).join(' ');
    if (textToAnalyze.trim().length > 10) {
      try {
        const mlResult = await predictText(textToAnalyze);
        await addMlAnalysis(user.id, {
          source_type: 'feedback',
          source_id: feedbackId,
          emotion_detected: mlResult.prediction,
          emotion_score: mlResult.confidence,
          predicted_condition: mlResult.prediction,
          confidence_score: mlResult.confidence,
        });
        // Rebuild ML profile treating feedback as a synthetic journal entry signal
        const syntheticEntry = {
          id: feedbackId,
          title: 'Feedback',
          content: textToAnalyze,
          mood: 'neutral',
          timestamp: new Date(),
          mlAnalysis: mlResult,
        };
        const allEntries = [syntheticEntry, ...journalEntries];
        updateMlMentalHealthProfile(user.id, allEntries)
          .then(profile => setMlMentalHealthProfile(profile))
          .catch(err => console.error('ML profile update from feedback failed:', err));
      } catch (err) {
        console.error('Feedback ML analysis failed:', err);
      }
    }
  };

  const prepareSupportChatFromDass = (result: Dass21Result) => {
    const now = Date.now();
    const seeded = supportMessagesFromResult(result).map((text, index) => ({
      id: `${now + index}`,
      text,
      sender: 'ai' as const,
      timestamp: new Date(now + index * 1000),
    }));
    setAiMessages(seeded);
  };

  const sendAiMessage = async (text: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, newMsg]);
    const result = dass21Result;
    let responseText: string;
    if (result) {
      const geminiReply = await sendSupportMessage(text, result);
      responseText = geminiReply ?? getRuleBasedReply(text, result);
    } else {
      responseText = getRuleBasedReply(text, null);
    }
    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      text: responseText,
      sender: 'ai',
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, aiResponse]);
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
        prepareSupportChatFromDass,
        peerGroups, groupsLoading, mentalHealthProfile, setMentalHealthProfile,
        mlMentalHealthProfile,
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
