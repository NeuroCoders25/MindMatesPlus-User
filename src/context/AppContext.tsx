import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import {
  subscribeGamificationStats,
  subscribeBadges,
} from '../services/gamificationFirestoreService';
import { navigationRef } from '../navigation/navigationRef';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';
import {
  saveJournalEntry, fetchJournalEntries, deleteJournalEntry, saveFeedback,
  fetchPeerGroups, fetchUserJoinedGroupIds, joinPeerGroup, leavePeerGroup,
  fetchMentalHealthProfile, MentalHealthProfile,
  updateMlMentalHealthProfile, saveAiChatMessage,
  saveChatMessage, runMlAnalysisForText, updateMentalHealthProfileFromMl,
  updateWellnessScoreGradually, saveMlAnalysisHistory,
  updateResourceRecommendationFromLatestMl, calculateWeeklyMlTrend,
  updatePeerGroupRecommendationFromWeeklyTrend,
  listenToMentalHealthProfile, isUserRestricted,
  listenToAdvisorConnectionsWithNames,
  listenToUserListenerConnections, ListenerConnection,
  continueAfterAdvisorApproval,
  runWeeklyKnnRecommendation,
  callKnnAndWriteResult,
  hasUserRatedAdvisor,
  createNotification,
  subscribeGroupMessageNotifications,
  subscribeAdvisorMessageNotifications,
  subscribeToNotifications,
  AppNotification,
} from '../services/dataService';
import { AdvisorRatingModal } from '../components/AdvisorRatingModal';
import { ListenerAcceptedToast } from '../components/ListenerAcceptedToast';
import { BadgeAwardToast } from '../components/BadgeAwardToast';
import {
  Badge, GamificationProfile,
  triggerJournalSaved, triggerCheckIn, triggerDass21Complete,
  triggerGroupJoined, triggerGoalCreated, triggerGoalsCompleted,
  triggerFeedbackSubmitted, triggerSupportiveReplyCheck,
} from '../services/gamificationApiService';
import { sendSupportMessage } from '../services/geminiService';
import { MlPredictResponse } from '../services/mlApiService';
import { User, Group, Message, JournalEntry, Dass21Result, Feedback, MlMentalHealthProfile, MentalHealthRecommendationProfile } from '../types';
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
  leaveGroup: (groupId: string) => Promise<void>;
  mlMentalHealthProfile: MlMentalHealthProfile | null;
  recommendationProfile: MentalHealthRecommendationProfile | null;
  isRestricted: boolean;
  aiMessages: Message[];
  sendAiMessage: (text: string) => Promise<void>;
  sendGroupMessage: (groupId: string, text: string, replyTo?: { id: string; text: string; senderName: string; senderId?: string }) => Promise<void>;
  showCrisisAlert: boolean;
  setShowCrisisAlert: (show: boolean) => void;
  visitedGroupIds: string[];
  markGroupAsVisited: (groupId: string) => void;
  listenerConnections: ListenerConnection[];
  listenerAcceptedNotice: ListenerConnection | null;
  clearListenerAcceptedNotice: () => void;
  dataAccessBlocked: boolean;
  pendingBadge: Badge | null;
  clearPendingBadge: () => void;
  gamificationProfile: GamificationProfile | null;
  earnedBadges: Badge[];
  notifications: AppNotification[];
  gamificationTriggers: {
    onJournalSaved: (entryCount: number) => Promise<void>;
    onCheckIn: () => Promise<void>;
    onDass21Complete: () => Promise<void>;
    onGroupJoined: () => Promise<void>;
    onGoalCreated: () => Promise<void>;
    onGoalsCompleted: (totalCompleted: number) => Promise<void>;
    onFeedbackSubmitted: () => Promise<void>;
    onSupportiveReply: (params: {
      originalSenderId: string;
      originalText: string;
      replyText: string;
    }) => Promise<void>;
  };
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
    `Great job completing your mental wellness check! Your scores look good — just keep an eye on ${concern}. I'm here whenever you need support. How are you feeling today?`,
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

const mapFirebaseUser = (fbUser: FirebaseUser, nickname?: string, avatarSeed?: string, profileImageUrl?: string): User => ({
  id: fbUser.uid,
  name: decryptName(fbUser.displayName || '') || fbUser.email?.split('@')[0] || 'User',
  nickname: nickname,
  email: fbUser.email || '',
  avatarSeed: avatarSeed,
  profileImageUrl: profileImageUrl,
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
  const [recommendationProfile, setRecommendationProfile] = useState<MentalHealthRecommendationProfile | null>(null);
  const [aiMessages, setAiMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm Mindy, your AI companion. How are you feeling today?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [visitedGroupIds, setVisitedGroupIds] = useState<string[]>([]);
  const [advisorApprovalNotification, setAdvisorApprovalNotification] = useState<string | null>(null);
  const [showAdvisorApprovalModal, setShowAdvisorApprovalModal] = useState(false);
  const [advisorApprovedCategory, setAdvisorApprovedCategory] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingAdvisorId, setRatingAdvisorId] = useState('');
  const [ratingAdvisorName, setRatingAdvisorName] = useState('');
  const [ratingConnectionId, setRatingConnectionId] = useState('');
  const prevConnectionStatuses = useRef<Record<string, string>>({});
  const [listenerConnections, setListenerConnections] = useState<ListenerConnection[]>([]);
  const [listenerAcceptedNotice, setListenerAcceptedNotice] = useState<ListenerConnection | null>(null);
  const prevListenerStatuses = useRef<Record<string, string>>({});
  const isFirstListenerSnapshot = useRef(true);
  const [dataAccessBlocked, setDataAccessBlocked] = useState(false);
  // Ensures weekly KNN fires at most once per app session per user
  const knnTriggeredRef = useRef(false);
  const [pendingBadge, setPendingBadge] = useState<Badge | null>(null);
  const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const handleFirestoreError = (label: string) => (code: string) => {
    if (code === 'permission-denied') {
      console.warn('[Firestore] permission denied for', label);
      setDataAccessBlocked(true);
    } else {
      console.warn('[Firestore] listener error for', label, '— code:', code);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log('[Auth] State changed. User:', fbUser?.uid ?? 'signed out');
      if (fbUser) {
        setGroupsLoading(true);
        try {
          console.log('[Firestore] Fetching initial data for user:', fbUser.uid);
          const [entries, groups, joinedIds, profile, userSnap] = await Promise.all([
            fetchJournalEntries(fbUser.uid),
            fetchPeerGroups(),
            fetchUserJoinedGroupIds(fbUser.uid),
            fetchMentalHealthProfile(fbUser.uid),
            getDoc(doc(db, 'users', fbUser.uid)),
          ]);
          const nickname = userSnap.exists() ? userSnap.data()?.nickname : undefined;
          const avatarSeed = userSnap.exists() ? userSnap.data()?.avatarSeed : undefined;
          const profileImageUrl = userSnap.exists() ? userSnap.data()?.profileImageUrl : undefined;
          setUser(mapFirebaseUser(fbUser, nickname, avatarSeed, profileImageUrl));
          setJournalEntries(entries);
          setPeerGroups(groups);
          setJoinedGroupIds(joinedIds);
          setMentalHealthProfile(profile);
          console.log('[Firestore] Initial data loaded for user:', fbUser.uid);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'permission-denied') {
            console.warn('[Firestore] permission denied reading initial user data');
            setDataAccessBlocked(true);
          } else {
            console.warn('[Firestore] Failed to load initial data — operating offline:', err);
          }
          // Still set the user so the app is usable; data will be empty until Firestore reconnects
          setUser(mapFirebaseUser(fbUser));
        } finally {
          setGroupsLoading(false);
        }
      } else {
        console.log('[Auth] User signed out — clearing app state');
        setUser(null);
        setJournalEntries([]);
        setPeerGroups([]);
        setMentalHealthProfile(null);
        setMlMentalHealthProfile(null);
        setRecommendationProfile(null);
        setJoinedGroupIds([]);
        setVisitedGroupIds([]);
        setGroupsLoading(false);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    console.log('[Listener] Subscribing advisor connections for user:', user.id);
    const unsub = listenToAdvisorConnectionsWithNames(user.id, (connections) => {
      const prev = prevConnectionStatuses.current;
      connections.forEach(({ advisorId, advisorName, status }) => {
        if (prev[advisorId] === 'pending' && status === 'accepted') {
          setAdvisorApprovalNotification(advisorName);
        }
      });
      const updated: Record<string, string> = {};
      connections.forEach(({ advisorId, status }) => { updated[advisorId] = status; });
      prevConnectionStatuses.current = updated;
    }, handleFirestoreError('advisorConnections'));
    return () => {
      console.log('[Listener] Unsubscribed advisor connections for user:', user.id);
      unsub();
    };
  }, [user?.id]);

  // ─── Gamification — live listeners on subcollection paths ───────────────────
  useEffect(() => {
    if (!user?.id) return;
    const unsubStats = subscribeGamificationStats(user.id, setGamificationProfile);
    const unsubBadges = subscribeBadges(user.id, setEarnedBadges);
    return () => { unsubStats(); unsubBadges(); };
  }, [user?.id]);

  // ─── Notifications — global real-time subscription ───────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToNotifications(user.id, setNotifications);
    return unsub;
  }, [user?.id]);

  // ─── Listener expert connection tracking ──────────────────────────────────────
  // Detects pending→accepted transitions and fires a non-blocking toast.
  // Pre-existing accepted connections on launch are seeded silently (no notice).
  useEffect(() => {
    if (!user?.id) return;
    isFirstListenerSnapshot.current = true;
    const unsub = listenToUserListenerConnections(user.id, conns => {
      if (isFirstListenerSnapshot.current) {
        // Seed without firing any notices — connections were already accepted before launch
        conns.forEach(c => { prevListenerStatuses.current[c.id] = c.status; });
        isFirstListenerSnapshot.current = false;
      } else {
        conns.forEach(c => {
          const prev = prevListenerStatuses.current[c.id];
          if (prev === 'pending' && c.status === 'accepted') {
            setListenerAcceptedNotice(c);
            createNotification(user.id, `listener_accepted_${c.id}`, {
              type: 'listener_accepted',
              title: 'Expert Listener Ready',
              body: `${c.advisorName ?? 'Your expert'} has accepted your request. Start chatting now.`,
              read: false,
              chatId: c.id,
            });
          }
          prevListenerStatuses.current[c.id] = c.status;
        });
      }
      setListenerConnections(conns);
    }, handleFirestoreError('listenerConnections'));
    return () => {
      unsub();
      isFirstListenerSnapshot.current = true;
    };
  }, [user?.id]);

  // ─── Track selected group for "don't notify if chat is open" check ────────────
  const selectedGroupIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedGroupIdRef.current = selectedGroup?.id ?? null;
  }, [selectedGroup]);

  // ─── Peer group message notification subscriptions ────────────────────────────
  useEffect(() => {
    if (!user?.id || joinedGroupIds.length === 0) return;
    const startTimestamp = Timestamp.now();
    const userId = user.id;
    const unsubs = joinedGroupIds.map(groupId => {
      const group = peerGroups.find(g => g.id === groupId);
      const groupName = group?.name ?? 'Group Chat';
      return subscribeGroupMessageNotifications(
        groupId,
        groupName,
        userId,
        startTimestamp,
        () => selectedGroupIdRef.current === groupId,
      );
    });
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, joinedGroupIds.join(',')]);

  // ─── Advisor/listener message notification subscriptions ─────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const startTimestamp = Timestamp.now();
    const userId = user.id;
    const accepted = listenerConnections.filter(c => c.status === 'accepted');
    const unsubs = accepted.map(conn =>
      subscribeAdvisorMessageNotifications(conn.id, userId, startTimestamp),
    );
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, listenerConnections.map(c => `${c.id}:${c.status}`).join(',')]);

  // ─── Weekly KNN trigger — fires once per session when the profile first loads ─
  // Rate-limited to once per 23 hours via knnLastUpdatedAt in Firestore.
  // callKnnAndWriteResult is also invoked on every chat message, so this ensures
  // the fields are always populated even for users who haven't chatted yet.
  useEffect(() => {
    if (!user || !recommendationProfile || knnTriggeredRef.current) return;
    knnTriggeredRef.current = true;

    const lastKnnRun = recommendationProfile.knnLastUpdatedAt?.toDate?.();
    const hoursSinceLastRun = lastKnnRun
      ? (Date.now() - lastKnnRun.getTime()) / 1000 / 3600
      : 999;

    if (hoursSinceLastRun >= 23) {
      console.log('[KNN] Running weekly recommendation (last ran', Math.round(hoursSinceLastRun), 'h ago)…');
      runWeeklyKnnRecommendation(user.id).catch(e =>
        console.error('[KNN WEEKLY ERROR]', e)
      );
      // Also call the immediate path so knnRecommendedGroup on currentProfile is fresh.
      callKnnAndWriteResult(user.id).catch(e =>
        console.error('[KNN IMMEDIATE ERROR]', e)
      );
    } else {
      console.log('[KNN] Weekly recommendation skipped — ran', Math.round(hoursSinceLastRun), 'h ago');
    }
  }, [user?.id, recommendationProfile]);

  useEffect(() => {
    if (!user) return;
    console.log('[Listener] Subscribing mental health profile for user:', user.id);
    const unsub = listenToMentalHealthProfile(user.id, (profile) => {
      console.log('[ApprovalPopup] Profile changed:', profile);
      console.log('[ApprovalPopup] advisorConnectionStatus:', profile?.advisorConnectionStatus);
      console.log('[ApprovalPopup] userStatus:', profile?.userStatus);
      console.log('[ApprovalPopup] recommendationSource:', profile?.recommendationSource);
      console.log('[ApprovalPopup] approvalMessageSeen:', profile?.approvalMessageSeen);
      setRecommendationProfile(profile);
      if (profile && isUserRestricted(profile)) {
        console.log('[Restriction] User restricted');
        console.log('[Restriction] Blocking feature: groups, chat, journal');
      }
      if (
        profile?.advisorConnectionStatus === 'approved' &&
        profile?.userStatus === 'normal' &&
        profile?.recommendationSource === 'advisor_approval' &&
        profile?.approvalMessageSeen !== true
      ) {
        console.log('[ApprovalPopup] Approval condition met');
        console.log('[ApprovalPopup] Showing modal');
        const category =
          profile.approvedCategory ??
          profile.baselineRecommendationCategory ??
          'General Wellbeing';
        setAdvisorApprovedCategory(category);
        setShowAdvisorApprovalModal(true);
        const connId = (profile as any).advisorConnectionId ?? 'advisor_approval';
        createNotification(user.id, `advisor_approved_${connId}`, {
          type: 'advisor_request',
          title: 'Advisor Approved You',
          body: `You've been approved for ${category}`,
          read: false,
          chatId: (profile as any).advisorConnectionId,
        });
      }
    }, handleFirestoreError('mentalHealthProfile'));
    return () => {
      console.log('[Listener] Unsubscribed mental health profile for user:', user.id);
      unsub();
    };
  }, [user?.id]);

  const isRestricted = isUserRestricted(recommendationProfile);

  const handleAdvisorApprovalContinue = async () => {
    console.log('[ApprovalPopup] Continue clicked');
    setShowAdvisorApprovalModal(false);
    if (user) {
      try {
        await continueAfterAdvisorApproval(user.id);
        console.log('[ApprovalPopup] approvalMessageSeen updated');
      } catch (err) {
        console.error('[ApprovalPopup] Failed to update approvalMessageSeen:', err);
      }

      // Offer rating if the user hasn't rated this connection yet
      const advisorId = recommendationProfile?.approvedByAdvisorId;
      const connectionId = recommendationProfile?.advisorConnectionId;
      if (advisorId && connectionId) {
        try {
          const alreadyRated = await hasUserRatedAdvisor(user.id, advisorId, connectionId);
          if (!alreadyRated) {
            const advisorSnap = await getDoc(doc(db, 'advisors', advisorId));
            const name = advisorSnap.exists()
              ? (advisorSnap.data().name as string | undefined) ?? 'your advisor'
              : 'your advisor';
            setRatingAdvisorId(advisorId);
            setRatingAdvisorName(name);
            setRatingConnectionId(connectionId);
            setShowRatingModal(true);
          }
        } catch (err) {
          console.warn('[Rating] Could not check rating status:', err);
        }
      }
    }
    if (navigationRef.isReady()) {
      navigationRef.navigate('Main' as never);
    }
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
    const encryptedName = encryptName(name);
    await updateProfile(fbUser, { displayName: encryptedName });
    // Note: nickname will be picked up by the onAuthStateChanged listener or set manually here
    setUser(mapFirebaseUser({ ...fbUser, displayName: encryptedName }));
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    knnTriggeredRef.current = false; // Allow KNN to re-run on next login
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
        .catch(err => console.error('[ML] journal profile update failed:', err));
      // mlAnalysis is already the BERT result computed in JournalScreen — reuse it
      // directly instead of making a redundant second API call.
      const journalPreview = [title, content].filter(Boolean).join(' ').slice(0, 80);
      console.log('[ML] Source: journal');
      console.log('[ML] Text analyzed:', journalPreview);
      updateMentalHealthProfileFromMl(user.id, mlAnalysis, ['journal'], journalPreview)
        .then(() => console.log('[ML] latestMlEmotionScore updated successfully'))
        .catch(err => console.error('[ML] journal ML analysis failed:', err));
      updateWellnessScoreGradually(user.id, content, 'journal', mlAnalysis)
        .catch(err => console.error('[Wellness] journal score update failed:', err));
      updateResourceRecommendationFromLatestMl(user.id, mlAnalysis)
        .catch(err => console.error('[ML] journal resource category update failed:', err));
      saveMlAnalysisHistory(user.id, mlAnalysis, 'journal', journalPreview)
        .then(() => calculateWeeklyMlTrend(user.id))
        .then(trend => {
          if (trend) {
            updatePeerGroupRecommendationFromWeeklyTrend(user.id, trend)
              .catch(err => console.error('[ML] weekly trend persist failed:', err));
          }
        })
        .catch(err => console.error('[ML] journal weekly trend calculation failed:', err));
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

  const leaveGroup = async (groupId: string) => {
    if (!user) return;
    await leavePeerGroup(user.id, groupId);
    setJoinedGroupIds(prev => prev.filter(id => id !== groupId));
    setPeerGroups(prev =>
      prev.map(g => g.id === groupId ? { ...g, members: Math.max(0, g.members - 1) } : g)
    );
  };
  
  const markGroupAsVisited = (groupId: string) => {
    setVisitedGroupIds(prev => (prev.includes(groupId) ? prev : [...prev, groupId]));
  };

  const submitFeedback = async (rating: number, peerComment: string, appComment: string) => {
    if (!user) return;
    await saveFeedback(user.id, { rating, peerComment, appComment, date: new Date() });
  };

  // ─── Gamification — backend-driven triggers + badge award toast ──────────────
  // Fire-and-forget: a failed gamification call never blocks the real action.
  const processBadgeResult = useCallback((result: any, userId?: string) => {
    if (!result) return;
    const awarded: Badge[] = result.awarded_badges ?? [];
    if (awarded.length > 0) {
      setPendingBadge(awarded[0]);
      if (userId) {
        awarded.forEach(badge => {
          createNotification(userId, `badge_${badge.badgeId}`, {
            type: 'badge_awarded',
            title: badge.badgeName,
            body: badge.description ?? 'You earned a new badge!',
            read: false,
            badgeId: badge.badgeId,
          });
        });
      }
    }
    // Stats and badge docs update via Firestore listeners automatically.
  }, []);

  const clearListenerAcceptedNotice = useCallback(() => setListenerAcceptedNotice(null), []);
  const clearPendingBadge = useCallback(() => setPendingBadge(null), []);

  const gamificationTriggers = useMemo(() => ({
    onJournalSaved: async (entryCount: number) => {
      if (!user?.id) return;
      processBadgeResult(await triggerJournalSaved(user.id, entryCount), user.id);
    },
    onCheckIn: async () => {
      if (!user?.id) return;
      const r = await triggerCheckIn(user.id);
      processBadgeResult(r, user.id);
      // Optimistic update so the streak chip reacts immediately.
      if (r?.checkInStreak !== undefined) {
        setGamificationProfile(p => p ? { ...p, checkInStreak: r.checkInStreak as number } : p);
      }
    },
    onDass21Complete: async () => {
      if (!user?.id) return;
      processBadgeResult(await triggerDass21Complete(user.id), user.id);
    },
    onGroupJoined: async () => {
      if (!user?.id) return;
      processBadgeResult(await triggerGroupJoined(user.id), user.id);
    },
    onGoalCreated: async () => {
      if (!user?.id) return;
      processBadgeResult(await triggerGoalCreated(user.id), user.id);
    },
    onGoalsCompleted: async (totalCompleted: number) => {
      if (!user?.id) return;
      processBadgeResult(await triggerGoalsCompleted(user.id, totalCompleted), user.id);
    },
    onFeedbackSubmitted: async () => {
      if (!user?.id) return;
      processBadgeResult(await triggerFeedbackSubmitted(user.id), user.id);
    },
    onSupportiveReply: async (params: {
      originalSenderId: string;
      originalText: string;
      replyText: string;
    }) => {
      if (!user?.id) return;
      const r = await triggerSupportiveReplyCheck({ uid: user.id, ...params });
      processBadgeResult(r, user.id);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user?.id, processBadgeResult]);

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

  const sendGroupMessage = async (groupId: string, text: string, replyTo?: { id: string; text: string; senderName: string; senderId?: string }) => {
    if (!user) return;
    await saveChatMessage(groupId, user.id, user.name, text, user.avatarSeed, replyTo);
    runMlAnalysisForText(user.id, text, 'group_chat').catch(() => {});
  };

  const sendAiMessage = async (text: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };
    setAiMessages(prev => [...prev, newMsg]);

    if (user) {
      const uid = user.id;
      saveAiChatMessage(uid, text).catch(() => {});
      runMlAnalysisForText(uid, text, 'ai_chat').catch(() => {});
    }

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
        mlMentalHealthProfile, recommendationProfile, isRestricted,
        joinedGroupIds, joinGroup, leaveGroup,
        journalEntries, addJournalEntry, removeJournalEntry,
        submitFeedback,
        aiMessages, sendAiMessage, sendGroupMessage,
        showCrisisAlert, setShowCrisisAlert,
        visitedGroupIds, markGroupAsVisited,
        listenerConnections,
        listenerAcceptedNotice,
        clearListenerAcceptedNotice,
        dataAccessBlocked,
        pendingBadge,
        clearPendingBadge,
        gamificationProfile,
        earnedBadges,
        notifications,
        gamificationTriggers,
      }}
    >
      {children}
      {/* Advisor approval modal — fires globally on any screen */}
      <Modal
        visible={showAdvisorApprovalModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={approvalStyles.overlay}>
          <View style={approvalStyles.card}>
            <View style={approvalStyles.iconCircle}>
              <Text style={approvalStyles.iconText}>✓</Text>
            </View>
            <Text style={approvalStyles.title}>Advisor Approval Received</Text>
            <Text style={approvalStyles.message}>
              Your advisor has approved you to continue using MindMates+.
            </Text>
            <View style={approvalStyles.categoryBox}>
              <Text style={approvalStyles.categoryLabel}>You will now continue under:</Text>
              <Text style={approvalStyles.categoryValue}>{advisorApprovedCategory}</Text>
            </View>
            <TouchableOpacity
              style={approvalStyles.btn}
              onPress={handleAdvisorApprovalContinue}
              activeOpacity={0.85}
            >
              <Text style={approvalStyles.btnText}>Continue to App</Text>
            </TouchableOpacity>
            <Text style={approvalStyles.disclaimer}>
              AI suggestion only — not professional advice
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={advisorApprovalNotification !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAdvisorApprovalNotification(null)}
      >
        <View style={notifStyles.overlay}>
          <View style={notifStyles.card}>
            <View style={notifStyles.iconCircle}>
              <Text style={notifStyles.iconText}>✓</Text>
            </View>
            <Text style={notifStyles.title}>Request Approved!</Text>
            <Text style={notifStyles.body}>
              <Text style={notifStyles.advisorName}>{advisorApprovalNotification}</Text>
              {' '}has accepted your connection request. You can now chat with your advisor.
            </Text>
            <Text style={notifStyles.disclaimer}>
              This is peer support — not professional advice.
            </Text>
            <TouchableOpacity
              style={notifStyles.btn}
              onPress={() => setAdvisorApprovalNotification(null)}
              activeOpacity={0.85}
            >
              <Text style={notifStyles.btnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Post-approval rating prompt */}
      {showRatingModal && (
        <AdvisorRatingModal
          visible={showRatingModal}
          advisorName={ratingAdvisorName}
          advisorId={ratingAdvisorId}
          connectionId={ratingConnectionId}
          userId={user?.id ?? ''}
          userNickname={user?.nickname ?? user?.name ?? 'Anonymous'}
          onClose={() => setShowRatingModal(false)}
          onSubmitted={() => console.log('[Rating] Advisor rated from approval flow')}
        />
      )}

      {/* Badge award — global celebratory toast, fires from any screen */}
      <BadgeAwardToast badge={pendingBadge} onDismiss={() => setPendingBadge(null)} />

      {/* Listener expert accepted — non-blocking slide-down toast */}
      {listenerAcceptedNotice && (
        <ListenerAcceptedToast
          visible
          advisorName={listenerAcceptedNotice.advisorName ?? 'Your expert'}
          onChat={() => {
            const conn = listenerAcceptedNotice;
            setListenerAcceptedNotice(null);
            if (navigationRef.isReady()) {
              navigationRef.navigate('AdvisorChat' as never, {
                advisor: {
                  id: conn.advisorId,
                  name: conn.advisorName ?? 'Expert',
                  specialty: '',
                  availability: '',
                },
              } as never);
            }
          }}
          onDismiss={() => setListenerAcceptedNotice(null)}
        />
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

const approvalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconText: {
    fontSize: 40,
    color: '#22C55E',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
  categoryBox: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803D',
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  disclaimer: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

const notifStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 26,
    color: '#059669',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
  },
  advisorName: {
    fontWeight: '700',
    color: '#1A1A2E',
  },
  disclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
