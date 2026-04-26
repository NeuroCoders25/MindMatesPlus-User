import React, { createContext, useContext, useState } from 'react';
import { User, Group, Message, JournalEntry } from '../types';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  selectedGroup: Group | null;
  setSelectedGroup: (group: Group | null) => void;
  assessmentScore: number;
  setAssessmentScore: (score: number) => void;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [assessmentScore, setAssessmentScore] = useState(0);
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

  return (
    <AppContext.Provider
      value={{
        user, setUser,
        selectedGroup, setSelectedGroup,
        assessmentScore, setAssessmentScore,
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
