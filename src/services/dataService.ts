import { Group, GroupCategory, Dass21Result, Dass21SubscaleResult, JournalEntry, Feedback, Message, Resource, MlMentalHealthProfile, KnnInput, WeeklyEmotionSummary, KnnRecommendationState, MentalHealthRecommendationProfile, RecommendationResult, MlStabilityCounter, Advisor, PrivateThreadMessage } from '../types';
import { db } from './firebaseConfig';
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, Timestamp, where,
  setDoc, updateDoc, increment, getDoc, onSnapshot, limit, serverTimestamp,
} from 'firebase/firestore';
import { predictText, MlPredictResponse, recommendGroups, KnnRecommendRequest } from './mlApiService';

// ─── Journal Firestore Functions ──────────────────────────────────────────────

export const saveJournalEntry = async (
  userId: string,
  entry: Omit<JournalEntry, 'id'>
): Promise<string> => {
  const ref = collection(db, 'users', userId, 'journal_entries');
  const docRef = await addDoc(ref, {
    title: entry.title,
    content: entry.content,
    mood_tag: entry.mood,
    date: Timestamp.fromDate(entry.timestamp),
    analysis: entry.analysis ?? null,
    ml_analysis: entry.mlAnalysis ?? null,
  });
  return docRef.id;
};

export const fetchJournalEntries = async (userId: string): Promise<JournalEntry[]> => {
  console.log('[Firestore] Fetching journal entries for user:', userId);
  const ref = collection(db, 'users', userId, 'journal_entries');
  const q = query(ref, orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    content: d.data().content,
    mood: d.data().mood_tag,
    timestamp: (d.data().date as Timestamp).toDate(),
    analysis: d.data().analysis ?? undefined,
  }));
};

export const deleteJournalEntry = async (userId: string, entryId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', userId, 'journal_entries', entryId));
};

// ─── Feedback Firestore Functions ─────────────────────────────────────────────

export const saveFeedback = async (
  userId: string,
  feedback: Omit<Feedback, 'id'>
): Promise<string> => {
  const ref = collection(db, 'users', userId, 'feedback');
  const docRef = await addDoc(ref, {
    rating: feedback.rating,
    peer_comment: feedback.peerComment,
    app_comment: feedback.appComment,
    date: Timestamp.fromDate(feedback.date),
  });
  return docRef.id;
};

// ─── Peer Group Firestore Functions ──────────────────────────────────────────

export const GROUP_CATEGORIES: GroupCategory[] = [
  'Severe Support',
  'Moderate Support',
  'Mild Support',
  'Wellness - Thriving',
  'Wellness - Stress Aware',
  'Wellness - Emotionally Aware',
  'Recovery & Improvement',
];

export const GROUP_IMAGE_MAP: Record<string, any> = {
  'Severe Support': require('../assets/group_image4.jpeg'),
  'Moderate Support': require('../assets/group_image1.jpg'),
  'Mild Support': require('../assets/group_image5.png'),
  'Wellness - Thriving': require('../assets/group_image3.png'),
  'Wellness - Stress Aware': require('../assets/group_image5.png'),
  'Wellness - Emotionally Aware': require('../assets/group_image1.jpg'),
  'Recovery & Improvement': require('../assets/group_image3.png'),
};

export const fetchPeerGroups = async (): Promise<Group[]> => {
  console.log('[Firestore] Fetching peer groups');
  const [groupsSnap, advisorsSnap] = await Promise.all([
    getDocs(collection(db, 'peer_groups')),
    getDocs(collection(db, 'advisors')),
  ]);

  // Build name → imageUrl lookup from advisors collection
  const advisorImageMap: Record<string, string> = {};
  advisorsSnap.docs.forEach(d => {
    const a = d.data();
    const name = (a.name ?? '').toLowerCase().trim();
    const img: string | undefined = a.profileImageUrl ?? a.imageUrl;
    if (name && img) advisorImageMap[name] = img;
  });

  return groupsSnap.docs.map(d => {
    const data = d.data();
    const category = (data.group_category ?? data.category ?? 'Wellness - Thriving') as GroupCategory;
    const imageUrl: string | undefined = data.group_image_url ?? data.imageUrl;
    const moderatorName: string | undefined =
      data.group_moderator ?? data.moderator_name ?? data.moderatorName ?? undefined;
    const moderatorImageUrl: string | undefined = moderatorName
      ? advisorImageMap[moderatorName.toLowerCase().trim()]
      : undefined;
    return {
      id: d.id,
      name: data.group_name ?? data.name ?? '',
      description: data.group_description ?? data.description ?? data.topic ?? '',
      members: data.memberCount ?? data.member_count ?? 0,
      category,
      image: imageUrl ? { uri: imageUrl } : (GROUP_IMAGE_MAP[category] ?? GROUP_IMAGE_MAP['Wellness - Thriving']),
      moderatorName,
      moderatorImageUrl,
    };
  });
};

export const fetchUserJoinedGroupIds = async (userId: string): Promise<string[]> => {
  console.log('[Firestore] Fetching joined group IDs for user:', userId);
  const q = query(collection(db, 'groupMembers'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().groupId as string);
};

export const joinPeerGroup = async (userId: string, groupId: string): Promise<void> => {
  const memberRef = doc(db, 'groupMembers', `${groupId}_${userId}`);
  const existing = await getDoc(memberRef);
  if (existing.exists()) return;
  const joinedAt = Timestamp.now();
  await setDoc(memberRef, { groupId, userId, joinedAt });
  await updateDoc(doc(db, 'peer_groups', groupId), { memberCount: increment(1) });
  await setDoc(doc(db, 'users', userId, 'group_memberships', groupId), {
    group_id: groupId,
    joined_at: joinedAt,
    status: 'active',
  });
};

export const leavePeerGroup = async (userId: string, groupId: string): Promise<void> => {
  const memberRef = doc(db, 'groupMembers', `${groupId}_${userId}`);
  const existing = await getDoc(memberRef);
  if (!existing.exists()) return;

  await Promise.all([
    deleteDoc(memberRef),
    deleteDoc(doc(db, 'users', userId, 'group_memberships', groupId)),
    updateDoc(doc(db, 'peer_groups', groupId), { memberCount: increment(-1) }).catch(() => { }),
  ]);
};

// ─── Mental Health Profile ────────────────────────────────────────────────────

export const saveMentalHealthProfile = async (
  userId: string,
  profile: {
    depression_score: number;
    anxiety_score: number;
    stress_score: number;
    classification_level: string;
    source: string;
  }
): Promise<void> => {
  const ref = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  await setDoc(ref, { ...profile, last_updated: Timestamp.now() }, { merge: true });
};

// ─── Questionnaire Responses ──────────────────────────────────────────────────

export const saveQuestionnaireResponse = async (
  userId: string,
  result: Dass21Result
): Promise<string> => {
  const ref = collection(db, 'users', userId, 'questionnaireResponses');
  const docRef = await addDoc(ref, {
    score: result.depression.final + result.anxiety.final + result.stress.final,
    depression_score: result.depression.final,
    anxiety_score: result.anxiety.final,
    stress_score: result.stress.final,
    classification_level: result.riskLevel,
    date: Timestamp.now(),
  });
  return docRef.id;
};

// ─── ML Analysis ──────────────────────────────────────────────────────────────

export const addMlAnalysis = async (
  userId: string,
  analysis: {
    source_type: 'journal' | 'chat' | 'feedback';
    source_id: string;
    emotion_detected: string;
    emotion_score: number;
    predicted_condition: string;
    confidence_score: number;
  }
): Promise<string> => {
  const ref = collection(db, 'users', userId, 'ml_analysis');
  const docRef = await addDoc(ref, {
    ...analysis,
    status: 'pending',
    created_at: Timestamp.now(),
  });
  return docRef.id;
};

// ─── Mental Health Profile Fetch ──────────────────────────────────────────────

export interface MentalHealthProfile {
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;
  classificationLevel: 'low' | 'moderate' | 'severe';
  groupCategory: GroupCategory;
}

function classificationFromCategory(category: GroupCategory | undefined): 'low' | 'moderate' | 'severe' {
  if (category === 'Severe Support') return 'severe';
  if (category === 'Moderate Support') return 'moderate';
  return 'low';
}

export const fetchMentalHealthProfile = async (
  userId: string
): Promise<MentalHealthProfile | null> => {
  const ref = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();

  // New nested structure
  if (data.initialQuestionnaireScore) {
    const qs = data.initialQuestionnaireScore;
    const activeCategory: GroupCategory = data.activeRecommendationCategory ?? 'Wellness - Thriving';
    return {
      depressionScore: qs.depressionScore ?? 0,
      anxietyScore: qs.anxietyScore ?? 0,
      stressScore: qs.stressScore ?? 0,
      classificationLevel: classificationFromCategory(activeCategory),
      groupCategory: activeCategory,
    };
  }

  // Legacy flat structure — pass through as-is
  return data as MentalHealthProfile;
};

// ─── Group Recommendation Logic ───────────────────────────────────────────────

// Fallback categories when no exact-match groups exist, using adjacent ordered levels.
const RELATED_CATEGORIES: Record<GroupCategory, GroupCategory[]> = {
  'Severe Support': ['Moderate Support'],
  'Moderate Support': ['Mild Support'],
  'Mild Support': ['Recovery & Improvement', 'Moderate Support'],
  'Recovery & Improvement': ['Wellness - Emotionally Aware', 'Mild Support'],
  'Wellness - Emotionally Aware': ['Wellness - Stress Aware', 'Recovery & Improvement'],
  'Wellness - Stress Aware': ['Wellness - Thriving', 'Wellness - Emotionally Aware'],
  'Wellness - Thriving': ['Wellness - Stress Aware'],
};

export const getRecommendedGroups = (
  groups: Group[],
  profile: MentalHealthProfile | null
): Group[] => {
  if (!profile || groups.length === 0) return groups;

  const { groupCategory } = profile;
  const primary = groups.filter(g => g.category === groupCategory);

  // Only show related categories when no exact-match groups exist yet
  if (primary.length > 0) return primary;

  const related = RELATED_CATEGORIES[groupCategory] ?? [];
  const secondary = related.flatMap(cat => groups.filter(g => g.category === cat));
  return secondary.length > 0 ? secondary : groups;
};

export const COLORS = {
  primary: '#0B1F5B',
  accent: '#5D5FEF',
  accentLight: '#7879F1',
  background: '#F8F9FF',
  white: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#6E6E6E',
  border: '#EEF2FF',
  cardBorder: 'rgba(219, 234, 254, 0.5)',
  success: '#4ADE80',
  warning: '#FACC15',
  danger: '#F87171',
};

export const PEER_GROUPS: Group[] = [
  {
    id: '1',
    name: 'Crisis Support Circle',
    description: 'A safe space for those experiencing severe distress to find peer support.',
    members: 58,
    category: 'Severe Support',
    image: GROUP_IMAGE_MAP['Severe Support'],
  },
  {
    id: '2',
    name: 'Steady Steps',
    description: 'For those navigating moderate challenges together with shared strategies.',
    members: 124,
    category: 'Moderate Support',
    image: GROUP_IMAGE_MAP['Moderate Support'],
  },
  {
    id: '3',
    name: 'Gentle Progress',
    description: 'A supportive community for mild symptoms and everyday coping.',
    members: 89,
    category: 'Mild Support',
    image: GROUP_IMAGE_MAP['Mild Support'],
  },
  {
    id: '4',
    name: 'Thriving Together',
    description: 'Celebrate good mental health and build positive habits together.',
    members: 210,
    category: 'Wellness - Thriving',
    image: GROUP_IMAGE_MAP['Wellness - Thriving'],
  },
  {
    id: '5',
    name: 'Stress Busters',
    description: 'Tips and peer support for managing daily stress and burnout.',
    members: 156,
    category: 'Wellness - Stress Aware',
    image: GROUP_IMAGE_MAP['Wellness - Stress Aware'],
  },
  {
    id: '6',
    name: 'Emotionally Aware',
    description: 'Building emotional intelligence and self-awareness together.',
    members: 97,
    category: 'Wellness - Emotionally Aware',
    image: GROUP_IMAGE_MAP['Wellness - Emotionally Aware'],
  },
  {
    id: '7',
    name: 'Recovery & Growth',
    description: 'For those on a recovery journey — celebrating every step forward.',
    members: 73,
    category: 'Recovery & Improvement',
    image: GROUP_IMAGE_MAP['Recovery & Improvement'],
  },
];

export interface DassQuestion {
  id: number;
  text: string;
  subscale: 'depression' | 'anxiety' | 'stress';
}

export const DASS_QUESTIONS: DassQuestion[] = [
  { id: 1, text: 'I found it hard to wind down', subscale: 'stress' },
  { id: 2, text: 'I was aware of dryness of my mouth', subscale: 'anxiety' },
  { id: 3, text: "I couldn't seem to experience any positive feeling at all", subscale: 'depression' },
  { id: 4, text: 'I experienced breathing difficulty (rapid breathing, breathlessness)', subscale: 'anxiety' },
  { id: 5, text: 'I found it difficult to work up the initiative to do things', subscale: 'depression' },
  { id: 6, text: 'I tended to over-react to situations', subscale: 'stress' },
  { id: 7, text: 'I experienced trembling (e.g., in the hands)', subscale: 'anxiety' },
  { id: 8, text: 'I felt that I was using a lot of nervous energy', subscale: 'stress' },
  { id: 9, text: 'I was worried about situations in which I might panic and make a fool of myself', subscale: 'anxiety' },
  { id: 10, text: 'I felt that I had nothing to look forward to', subscale: 'depression' },
  { id: 11, text: 'I found myself getting agitated', subscale: 'stress' },
  { id: 12, text: 'I found it difficult to relax', subscale: 'stress' },
  { id: 13, text: 'I felt down-hearted and blue', subscale: 'depression' },
  { id: 14, text: 'I was intolerant of anything that kept me from getting on with what I was doing', subscale: 'stress' },
  { id: 15, text: 'I felt I was close to panic', subscale: 'anxiety' },
  { id: 16, text: 'I was unable to become enthusiastic about anything', subscale: 'depression' },
  { id: 17, text: "I felt I wasn't worth much as a person", subscale: 'depression' },
  { id: 18, text: 'I felt that I was rather touchy', subscale: 'stress' },
  { id: 19, text: 'I was aware of the action of my heart in the absence of physical exertion (e.g., sense of heart rate increase, heart missing a beat)', subscale: 'anxiety' },
  { id: 20, text: 'I felt scared without any good reason', subscale: 'anxiety' },
  { id: 21, text: 'I felt that life was meaningless', subscale: 'depression' },
];

export const DASS_OPTIONS = [
  { label: 'Did not apply to me at all', value: 0 },
  { label: 'Applied to me to some degree, or some of the time', value: 1 },
  { label: 'Applied to me to a considerable degree, or a good part of time', value: 2 },
  { label: 'Applied to me very much, or most of the time', value: 3 },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

const DEP_Q = [3, 5, 10, 13, 16, 17, 21];
const ANX_Q = [2, 4, 7, 9, 15, 19, 20];
const STR_Q = [1, 6, 8, 11, 12, 14, 18];

function depSev(score: number): { severity: string; color: string } {
  if (score <= 9) return { severity: 'Normal', color: '#43A047' };
  if (score <= 13) return { severity: 'Mild', color: '#F9A825' };
  if (score <= 20) return { severity: 'Moderate', color: '#FB8C00' };
  if (score <= 27) return { severity: 'Severe', color: '#E53935' };
  return { severity: 'Extremely Severe', color: '#B71C1C' };
}

function anxSev(score: number): { severity: string; color: string } {
  if (score <= 7) return { severity: 'Normal', color: '#43A047' };
  if (score <= 9) return { severity: 'Mild', color: '#F9A825' };
  if (score <= 14) return { severity: 'Moderate', color: '#FB8C00' };
  if (score <= 19) return { severity: 'Severe', color: '#E53935' };
  return { severity: 'Extremely Severe', color: '#B71C1C' };
}

function strSev(score: number): { severity: string; color: string } {
  if (score <= 14) return { severity: 'Normal', color: '#43A047' };
  if (score <= 18) return { severity: 'Mild', color: '#F9A825' };
  if (score <= 25) return { severity: 'Moderate', color: '#FB8C00' };
  if (score <= 33) return { severity: 'Severe', color: '#E53935' };
  return { severity: 'Extremely Severe', color: '#B71C1C' };
}

const SEVERITY_RANK: Record<string, number> = {
  Normal: 0, Mild: 1, Moderate: 2, Severe: 3, 'Extremely Severe': 4,
};

export function computeDass21Result(answers: Record<number, number>): Dass21Result {
  const depRaw = DEP_Q.reduce((s, q) => s + (answers[q] ?? 0), 0);
  const anxRaw = ANX_Q.reduce((s, q) => s + (answers[q] ?? 0), 0);
  const strRaw = STR_Q.reduce((s, q) => s + (answers[q] ?? 0), 0);

  const depFinal = depRaw * 2;
  const anxFinal = anxRaw * 2;
  const strFinal = strRaw * 2;

  const dS = depSev(depFinal);
  const aS = anxSev(anxFinal);
  const sS = strSev(strFinal);

  const depression: Dass21SubscaleResult = { raw: depRaw, final: depFinal, severity: dS.severity, severityColor: dS.color };
  const anxiety: Dass21SubscaleResult = { raw: anxRaw, final: anxFinal, severity: aS.severity, severityColor: aS.color };
  const stress: Dass21SubscaleResult = { raw: strRaw, final: strFinal, severity: sS.severity, severityColor: sS.color };

  const ranks = [SEVERITY_RANK[dS.severity], SEVERITY_RANK[aS.severity], SEVERITY_RANK[sS.severity]];
  const maxRank = Math.max(...ranks);
  const hasExtSev = maxRank === 4;
  const severeCount = ranks.filter(r => r >= 3).length;

  let group: Dass21Result['group'];
  let groupCategory: GroupCategory;
  let groupColor: string;
  let message: string;
  let ctaLabel: string;
  let ctaVariant: Dass21Result['ctaVariant'];
  let reassessInDays: number;
  let riskLevel: Dass21Result['riskLevel'];

  if (hasExtSev) {
    group = 1; groupCategory = 'Severe Support'; groupColor = '#B71C1C';
    message = "We've detected significant distress. We strongly recommend speaking with a professional advisor immediately.";
    ctaLabel = 'Connect with Advisor'; ctaVariant = 'danger'; reassessInDays = 14; riskLevel = 'severe';
  } else if (severeCount >= 1) {
    group = 2; groupCategory = 'Severe Support'; groupColor = '#E53935';
    message = "We've detected significant distress. We recommend speaking with a professional advisor immediately.";
    ctaLabel = 'Connect with Advisor'; ctaVariant = 'danger'; reassessInDays = 14; riskLevel = 'severe';
  } else if (maxRank >= 2) {
    group = 3; groupCategory = 'Moderate Support'; groupColor = '#FB8C00';
    message = "You're experiencing moderate levels of stress, anxiety, or depression. Let's build a plan to support you.";
    ctaLabel = 'View Your Plan'; ctaVariant = 'warning'; reassessInDays = 30; riskLevel = 'moderate';
  } else if (maxRank >= 1) {
    group = 4; groupCategory = 'Mild Support'; groupColor = '#F9A825';
    message = "You have mild symptoms. Some self-care and mindfulness practices can make a big difference.";
    ctaLabel = 'View Your Plan'; ctaVariant = 'success'; reassessInDays = 60; riskLevel = 'low';
  } else {
    // All Normal — sub-categorise by which subscale score is highest
    group = 5; groupColor = '#43A047';
    if (strFinal >= anxFinal && strFinal >= depFinal && strFinal > 0) {
      groupCategory = 'Wellness - Stress Aware';
    } else if (anxFinal > 0 || depFinal > 0) {
      groupCategory = 'Wellness - Emotionally Aware';
    } else {
      groupCategory = 'Wellness - Thriving';
    }
    message = "Great news! Your mental wellness looks good. Keep up your healthy habits.";
    ctaLabel = 'View Your Plan'; ctaVariant = 'success'; reassessInDays = 90; riskLevel = 'low';
  }

  return { answers, depression, anxiety, stress, group, groupCategory, groupColor, message, ctaLabel, ctaVariant, reassessInDays, riskLevel };
}

// ─── Group Chat Firestore Functions ───────────────────────────────────────────

const CRISIS_KEYWORDS = ['hurt myself', 'end it', 'suicide', 'kill myself', 'self harm', 'want to die', 'no reason to live'];

export const saveChatMessage = async (
  groupId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<string> => {
  const lower = text.toLowerCase();
  const flagged = CRISIS_KEYWORDS.some(kw => lower.includes(kw));
  const ref = collection(db, 'peer_groups', groupId, 'chatMessages');
  const docRef = await addDoc(ref, {
    senderId,
    senderName,
    text,
    timestamp: Timestamp.now(),
    flagged,
    reviewStatus: flagged ? 'pending' : 'not_required',
  });
  return docRef.id;
};

export const subscribeGroupMessages = (
  groupId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  console.log('[Firestore] Subscribing group messages for group:', groupId);
  const q = query(
    collection(db, 'peer_groups', groupId, 'chatMessages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(
    q,
    snapshot => {
      const messages: Message[] = snapshot.docs.map(d => ({
        id: d.id,
        text: d.data().text,
        sender: 'peer',
        senderId: d.data().senderId as string,
        senderName: d.data().senderName as string,
        timestamp: (d.data().timestamp as Timestamp).toDate(),
        flagged: d.data().flagged ?? false,
        reviewStatus: d.data().reviewStatus ?? 'not_required',
        reviewedBy: d.data().reviewedBy ?? null,
        reviewedAt: d.data().reviewedAt ? (d.data().reviewedAt as Timestamp).toDate() : null,
        deletedByAdvisor: d.data().deletedByAdvisor ?? false,
        hasPrivateThread: d.data().hasPrivateThread ?? false,
      }));
      callback(messages);
    },
    err => {
      console.error('[Firestore] subscribeGroupMessages error:', err);
    }
  );
};

export const deleteGroupMessage = async (
  groupId: string,
  messageId: string,
): Promise<void> => {
  await deleteDoc(doc(db, 'peer_groups', groupId, 'chatMessages', messageId));
};

// Subscribes to the private advisor thread for a specific flagged message.
// Uses array-contains so only docs where visibleTo includes userId are streamed.
// Other group members never call this — they have no subscription to this subcollection.
// Returns an unsubscribe function — call it in a useEffect cleanup.
export const subscribePrivateThread = (
  groupId: string,
  flaggedMessageId: string,
  userId: string,
  callback: (messages: PrivateThreadMessage[]) => void,
): (() => void) => {
  // orderBy('timestamp') is intentionally omitted — combining array-contains with
  // orderBy requires a composite index that is not yet provisioned.
  // Messages are sorted manually in JS after the snapshot is received.
  const q = query(
    collection(db, 'peer_groups', groupId, 'chatMessages', flaggedMessageId, 'privateThread'),
    where('visibleTo', 'array-contains', userId),
  );
  return onSnapshot(
    q,
    snapshot => {
      const messages: PrivateThreadMessage[] = snapshot.docs
        .map(d => ({
          id: d.id,
          senderId: d.data().senderId as string,
          senderName: d.data().senderName as string,
          senderRole: d.data().senderRole as 'user' | 'advisor',
          receiverId: d.data().receiverId as string,
          receiverName: d.data().receiverName as string,
          text: d.data().text as string,
          timestamp: (d.data().timestamp as Timestamp).toDate(),
          isPrivate: d.data().isPrivate ?? true,
          threadType: d.data().threadType as 'advisor_private_message' | 'user_private_reply',
          flaggedMessageRef: d.data().flaggedMessageRef as string,
          visibleTo: d.data().visibleTo as string[],
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      callback(messages);
    },
    err => {
      console.error('[Firestore] subscribePrivateThread error:', err);
    },
  );
};

// Saves the user's reply to a private advisor thread.
// Written to peer_groups/{groupId}/chatMessages/{flaggedMessageId}/privateThread.
// visibleTo: [advisorId, userId] — only those two see this document.
export const sendPrivateThreadReply = async (
  groupId: string,
  flaggedMessageId: string,
  userId: string,
  userName: string,
  advisorId: string,
  advisorName: string,
  text: string,
): Promise<string> => {
  const ref = collection(
    db, 'peer_groups', groupId, 'chatMessages', flaggedMessageId, 'privateThread',
  );
  const docRef = await addDoc(ref, {
    senderId: userId,
    senderName: userName,
    senderRole: 'user',
    receiverId: advisorId,
    receiverName: advisorName,
    text,
    timestamp: Timestamp.now(),
    isPrivate: true,
    threadType: 'user_private_reply',
    flaggedMessageRef: flaggedMessageId,
    visibleTo: [advisorId, userId],
  });
  return docRef.id;
};

// ─── ML Recommendation Category Map ──────────────────────────────────────────

// Maps BERT prediction labels to user-facing support category names
export const ML_CATEGORY_MAP: Record<string, string> = {
  depression: 'Depression Support',
  anxiety: 'Anxiety Support',
  normal: 'General Wellbeing',
};

// Maps each BERT prediction label to a single GroupCategory for group filtering.
// depression → peer support for moderate wellbeing concerns (ML has no explicit severity)
// anxiety    → stress-focused wellness groups
// normal     → general thriving/wellness groups
export const ML_TO_PRIMARY_CATEGORY: Record<string, GroupCategory> = {
  depression: 'Moderate Support',
  anxiety: 'Wellness - Stress Aware',
  normal: 'Wellness - Thriving',
};

export const getGroupsByMlPrediction = (groups: Group[], prediction: string): Group[] => {
  const category = ML_TO_PRIMARY_CATEGORY[prediction] ?? ML_TO_PRIMARY_CATEGORY['normal'];
  const matched = groups.filter(g => g.category === category);
  return matched.length > 0 ? matched : groups;
};

// Returns the single GroupCategory that corresponds to an ML dominant category string.
export const getMlGroupCategory = (dominantCategory: string): GroupCategory =>
  ML_TO_PRIMARY_CATEGORY[dominantCategory] ?? 'Wellness - Thriving';

// ─── Advisors Firestore Functions ───────────────────────────────────────────

export const fetchAdvisors = async (): Promise<Advisor[]> => {
  const snap = await getDocs(collection(db, 'advisors'));
  return snap.docs.map(d => ({
    id: (d.data().uid || d.id) as string,
    name: d.data().name as string,
    specialty: (d.data().specialty || d.data().role) as string,
    rating: d.data().rating as number,
    availability: d.data().availability as string,
    imageUrl: (d.data().profileImageUrl || d.data().imageUrl) as string | undefined,
    experience: d.data().experience as string | undefined,
    sessions: d.data().sessions as string | undefined,
    about: d.data().about as string | undefined,
  }));
};

// ─── Advisor Connection Real-time Functions ───────────────────────────────────

export type AdvisorConnectionStatusValue = 'pending' | 'accepted' | 'approved' | 'reviewed' | 'closed';

// Statuses that mean a connection is actively blocking a new request.
const ACTIVE_CONNECTION_STATUSES: ReadonlySet<string> = new Set(['pending', 'accepted']);

// Streams all advisor connections for a user as a map of advisorId → status.
// When a user has multiple docs for the same advisor (e.g. old approved + new pending),
// active statuses (pending/accepted) take precedence over terminal ones.
// Fires immediately with current data, then on every Firestore change.
export const listenToUserAdvisorConnections = (
  userId: string,
  callback: (connections: Record<string, AdvisorConnectionStatusValue>) => void
): (() => void) => {
  console.log('[AdvisorStatus] Listening user advisor connections');
  const q = query(collection(db, 'advisorConnections'), where('userId', '==', userId));
  return onSnapshot(
    q,
    snapshot => {
      const connections: Record<string, AdvisorConnectionStatusValue> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.advisorId && data.status) {
          const incoming = data.status as AdvisorConnectionStatusValue;
          const existing = connections[data.advisorId];
          // Active status always wins; among same priority, last write wins.
          if (!existing || ACTIVE_CONNECTION_STATUSES.has(incoming)) {
            connections[data.advisorId] = incoming;
          }
          console.log('[AdvisorStatus] Connection status changed:', data.advisorId, '->', data.status);
        }
      });
      callback(connections);
    },
    err => {
      console.error('[Firestore] listenToUserAdvisorConnections error:', err);
    }
  );
};

// Streams all advisor connections for a user with full details (including advisor name).
// Used by the global approval notification in AppContext.
export const listenToAdvisorConnectionsWithNames = (
  userId: string,
  callback: (connections: Array<{ advisorId: string; advisorName: string; status: AdvisorConnectionStatusValue }>) => void
): (() => void) => {
  const q = query(collection(db, 'advisorConnections'), where('userId', '==', userId));
  return onSnapshot(
    q,
    snapshot => {
      const connections = snapshot.docs
        .filter(d => d.data().advisorId && d.data().status)
        .map(d => ({
          advisorId: d.data().advisorId as string,
          advisorName: (d.data().advisorName as string) || 'Your Advisor',
          status: d.data().status as AdvisorConnectionStatusValue,
        }));
      callback(connections);
    },
    err => {
      console.error('[Firestore] listenToAdvisorConnectionsWithNames error:', err);
    }
  );
};

// Returns the active connection status (pending/accepted) for an advisor,
// or null if there is no active connection. Approved/reviewed/closed are treated
// as completed — a new connection can be created.
export const getAdvisorButtonStatus = (
  advisorId: string,
  connections: Record<string, AdvisorConnectionStatusValue>
): 'pending' | 'accepted' | null => {
  const status = connections[advisorId];
  if (status === 'pending' || status === 'accepted') return status;
  return null;
};

// ─── Advisor Connection Functions ────────────────────────────────────────────

export const checkExistingAdvisorConnection = async (
  userId: string,
  advisorId: string
): Promise<'pending' | 'accepted' | null> => {
  const q = query(
    collection(db, 'advisorConnections'),
    where('userId', '==', userId),
    where('advisorId', '==', advisorId),
    where('status', 'in', ['pending', 'accepted'])
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().status as 'pending' | 'accepted';
};

export const connectToAdvisor = async (
  userId: string,
  userName: string,
  userEmail: string,
  advisor: Advisor
): Promise<string> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.exists() ? profileSnap.data() : null;
  const userMentalHealthCategory =
    profileData?.userStatus ?? profileData?.activeRecommendationCategory ?? 'General Wellbeing';

  const ref = collection(db, 'advisorConnections');
  const docRef = await addDoc(ref, {
    userId,
    userName,
    userEmail,
    advisorId: advisor.id,
    advisorName: advisor.name,
    status: 'pending',
    caseType: 'critical_case',
    reason: 'User requested advisor support',
    userMentalHealthCategory,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(profileRef, {
    connectedAdvisorId: advisor.id,
    advisorConnectionId: docRef.id,
    advisorConnectionStatus: 'pending',
    userStatus: 'under_review',
  }, { merge: true });

  return docRef.id;
};

export const updateUserAdvisorStatus = async (
  userId: string,
  advisorId: string,
  status: string
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  await setDoc(profileRef, {
    connectedAdvisorId: advisorId,
    advisorConnectionStatus: status,
    userStatus: 'under_review',
  }, { merge: true });
};

// ─── Advisor Chat Functions ───────────────────────────────────────────────────

export interface AdvisorMessage {
  id: string;
  senderId: string;
  senderRole: 'user' | 'advisor';
  receiverId: string;
  messageText: string;
  messageType: string;
  createdAt: Date;
  isRead: boolean;
}

export interface AdvisorConnection {
  connectionId: string;
  advisorId: string;
  advisorName: string;
  userId: string;
  userName: string;
  status: 'pending' | 'accepted' | 'reviewed';
}

// Queries advisorConnections directly — does not rely on the user profile field.
// Matches any active (pending or accepted) connection for the given userId + advisorId pair.
export const findAdvisorConnection = async (
  userId: string,
  advisorId: string
): Promise<AdvisorConnection | null> => {
  const q = query(
    collection(db, 'advisorConnections'),
    where('userId', '==', userId),
    where('advisorId', '==', advisorId),
    where('status', 'in', ['pending', 'accepted'])
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('[AdvisorChat] No connection found for userId:', userId, 'advisorId:', advisorId);
    return null;
  }
  const d = snap.docs[0];
  const data = d.data();
  console.log('[AdvisorChat] Found connection:', d.id, 'status:', data.status);
  return {
    connectionId: d.id,
    advisorId: data.advisorId as string,
    advisorName: data.advisorName as string,
    userId: data.userId as string,
    userName: data.userName as string,
    status: data.status as 'pending' | 'accepted' | 'reviewed',
  };
};

export const listenToAdvisorConnectionMessages = (
  connectionId: string,
  callback: (messages: AdvisorMessage[]) => void
): (() => void) => {
  console.log('[AdvisorChat] Listening to messages:', `advisorConnections/${connectionId}/messages`);
  const q = query(
    collection(db, 'advisorConnections', connectionId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    snapshot => {
      callback(
        snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            senderId: data.senderId as string,
            senderRole: data.senderRole as 'user' | 'advisor',
            receiverId: data.receiverId as string,
            messageText: data.messageText as string,
            messageType: data.messageType ?? 'text',
            createdAt: data.createdAt?.toDate() ?? new Date(),
            isRead: data.isRead ?? false,
          };
        })
      );
    },
    err => {
      console.error('[Firestore] listenToAdvisorConnectionMessages error:', err);
    }
  );
};

export const updateAdvisorConnectionLastMessage = async (
  connectionId: string,
  text: string,
  senderId: string
): Promise<void> => {
  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    lastMessage: text,
    lastMessageSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const sendUserAdvisorMessage = async (
  connectionId: string,
  userId: string,
  advisorId: string,
  text: string
): Promise<void> => {
  await addDoc(collection(db, 'advisorConnections', connectionId, 'messages'), {
    senderId: userId,
    senderRole: 'user',
    receiverId: advisorId,
    messageText: text,
    messageType: 'text',
    createdAt: serverTimestamp(),
    isRead: false,
  });
  console.log('[AdvisorChat] Message sent:', text);
  await updateAdvisorConnectionLastMessage(connectionId, text, userId);
};

export const sendAdvisorUserMessage = async (
  connectionId: string,
  advisorId: string,
  userId: string,
  text: string
): Promise<void> => {
  await addDoc(collection(db, 'advisorConnections', connectionId, 'messages'), {
    senderId: advisorId,
    senderRole: 'advisor',
    receiverId: userId,
    messageText: text,
    messageType: 'text',
    createdAt: serverTimestamp(),
    isRead: false,
  });
  console.log('[AdvisorChat] Message sent:', text);
  await updateAdvisorConnectionLastMessage(connectionId, text, advisorId);
};

// Legacy aliases — kept so any existing callers outside this screen still compile.
export const getUserAdvisorConnection = findAdvisorConnection;
export const listenToAdvisorMessages = listenToAdvisorConnectionMessages;
export const updateConnectionLastMessage = updateAdvisorConnectionLastMessage;

// ─── Resources Firestore Functions ───────────────────────────────────────────

const mapResourceDoc = (d: any): Resource => {
  const data = d.data();
  const getVal = (fields: string[]) => {
    for (const f of fields) {
      if (data[f] !== undefined && data[f] !== null && data[f] !== '') return data[f];
    }
    return undefined;
  };

  const postedBy = getVal([
    'author', 'postedBy', 'posted_by', 'advisorName', 'advisor_name', 'authorName', 'author_name',
    'posted_by_name', 'advisor_profile_name'
  ]) ?? data.advisor?.name ?? data.author?.name ?? data.posted_by_profile?.name;

  return {
    id: d.id,
    title: (getVal(['title', 'resource_title']) ?? '') as string,
    description: (getVal(['description', 'resource_description']) ?? '') as string | undefined,
    category: (getVal(['category', 'resource_category']) ?? '') as string,
    contentType: (getVal(['resource_type', 'contentType', 'type']) ?? 'text') as 'text' | 'image',
    imageUrl: getVal(['image_url', 'imageUrl', 'imageURL', 'url']) as string | undefined,
    textContent: getVal(['resource', 'textContent', 'resource_content', 'content']) as string | undefined,
    isActive: data.isActive ?? true,
    postedBy: postedBy as string | undefined,
    authorId: data.authorId as string | undefined,
    authorInitials: getVal(['authorInitials', 'author_initials']) as string | undefined,
    type: data.type as string | undefined,
    content: data.content as string | undefined,
    url: data.url as string | undefined,
    createdAt: (data.createdAt ?? data.created_at ?? data.timestamp ? (data.createdAt ?? data.created_at ?? data.timestamp).toDate() : new Date()),
  };
};

const enrichResourcesWithAdvisorImages = async (resources: Resource[]): Promise<Resource[]> => {
  const authorIds = [...new Set(resources.map(r => r.authorId).filter(Boolean))] as string[];
  if (authorIds.length === 0) return resources;
  const imageMap: Record<string, string> = {};
  // advisors doc ID === advisor uid, so fetch by document ID directly
  for (let i = 0; i < authorIds.length; i += 30) {
    const chunk = authorIds.slice(i, i + 30);
    const snap = await getDocs(query(collection(db, 'advisors'), where('uid', 'in', chunk)));
    snap.docs.forEach(d => {
      const uid = d.data().uid as string;
      const url = d.data().profileImageUrl as string | undefined;
      if (uid && url) imageMap[uid] = url;
    });
  }
  return resources.map(r =>
    r.authorId && imageMap[r.authorId] ? { ...r, posterImageUrl: imageMap[r.authorId] } : r
  );
};

export const fetchResources = async (category?: string): Promise<Resource[]> => {
  const ref = collection(db, 'resources');
  const q = category
    ? query(ref, where('category', '==', category))
    : query(ref);
  const snap = await getDocs(q);
  const resources = snap.docs
    .map(mapResourceDoc)
    .filter(r => r.isActive !== false)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return enrichResourcesWithAdvisorImages(resources);
};

// Fetches active resources for the given category, plus non-duplicate baseline resources.
// Filters isActive client-side and sorts by createdAt descending.
export const fetchResourcesByCategory = async (
  activeCategory: string,
  baselineCategory?: string,
): Promise<Resource[]> => {
  const ref = collection(db, 'resources');

  const fetchByCategory = async (cat: string): Promise<Resource[]> => {
    const snap = await getDocs(query(ref, where('category', '==', cat)));
    return snap.docs
      .map(mapResourceDoc)
      .filter(r => r.isActive !== false)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  const primary = await fetchByCategory(activeCategory);

  if (!baselineCategory || baselineCategory === activeCategory)
    return enrichResourcesWithAdvisorImages(primary);

  const primaryIds = new Set(primary.map(r => r.id));
  const baseline = (await fetchByCategory(baselineCategory)).filter(
    r => !primaryIds.has(r.id),
  );

  return enrichResourcesWithAdvisorImages([...primary, ...baseline]);
};

// ─── Resource Social Features ────────────────────────────────────────────────

export interface ResourceInteractions {
  likeCount: number;
  isLiked: boolean;
}

export const toggleResourceLike = async (resourceId: string, userId: string): Promise<boolean> => {
  const likeRef = doc(db, 'resources', resourceId, 'likes', userId);
  const snap = await getDoc(likeRef);
  if (snap.exists()) { await deleteDoc(likeRef); return false; }
  await setDoc(likeRef, { userId, createdAt: Timestamp.now() });
  return true;
};

export const listenToResourceInteractions = (
  resourceId: string,
  userId: string,
  callback: (interactions: ResourceInteractions) => void,
): (() => void) => {
  return onSnapshot(collection(db, 'resources', resourceId, 'likes'), snap => {
    callback({ likeCount: snap.size, isLiked: snap.docs.some(d => d.id === userId) });
  });
};

export const toggleResourceSave = async (userId: string, resource: Resource): Promise<boolean> => {
  const saveRef = doc(db, 'users', userId, 'savedResources', resource.id);
  const snap = await getDoc(saveRef);
  if (snap.exists()) { await deleteDoc(saveRef); return false; }
  await setDoc(saveRef, {
    resourceId: resource.id,
    title: resource.title,
    description: resource.description ?? '',
    category: resource.category,
    contentType: resource.contentType,
    imageUrl: resource.imageUrl ?? '',
    textContent: resource.textContent ?? '',
    postedBy: resource.postedBy ?? '',
    posterImageUrl: resource.posterImageUrl ?? '',
    authorId: resource.authorId ?? '',
    createdAt: Timestamp.fromDate(resource.createdAt),
    savedAt: Timestamp.now(),
  });
  return true;
};

export const listenToResourceSaveState = (
  userId: string,
  resourceId: string,
  callback: (saved: boolean) => void,
): (() => void) => {
  return onSnapshot(doc(db, 'users', userId, 'savedResources', resourceId), snap => {
    callback(snap.exists());
  });
};

export const listenToUserSavedResources = (
  userId: string,
  callback: (resources: Resource[]) => void,
): (() => void) => {
  const q = query(collection(db, 'users', userId, 'savedResources'), orderBy('savedAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: d.data().resourceId as string,
      title: d.data().title as string,
      description: d.data().description as string | undefined,
      category: d.data().category as string,
      contentType: d.data().contentType as 'text' | 'image',
      imageUrl: d.data().imageUrl as string | undefined,
      textContent: d.data().textContent as string | undefined,
      postedBy: d.data().postedBy as string | undefined,
      posterImageUrl: d.data().posterImageUrl as string | undefined,
      authorId: d.data().authorId as string | undefined,
      createdAt: (d.data().createdAt as Timestamp).toDate(),
    })));
  });
};

// Realtime listener that emits resource + baseline recommendation categories
// from mentalHealthProfile/currentProfile whenever they change.
// active = resourceRecommendationCategory (real-time, changes per ML result)
// baseline = baselineRecommendationCategory (set once from questionnaire)
export const listenToUserRecommendationCategory = (
  userId: string,
  callback: (categories: { active: GroupCategory | null; baseline: GroupCategory | null }) => void,
): (() => void) => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  return onSnapshot(
    profileRef,
    snap => {
      if (!snap.exists()) {
        callback({ active: null, baseline: null });
        return;
      }
      const raw = snap.data();
      // Prefer resourceRecommendationCategory (real-time ML) for resource feed;
      // fall back to activeRecommendationCategory for users who have not yet
      // received an ML analysis update.
      callback({
        active: (raw.resourceRecommendationCategory as GroupCategory)
          ?? (raw.activeRecommendationCategory as GroupCategory)
          ?? null,
        baseline: (raw.baselineRecommendationCategory as GroupCategory) ?? null,
      });
    },
    err => {
      console.error('[Firestore] listenToUserRecommendationCategory error:', err);
      callback({ active: null, baseline: null });
    }
  );
};

// ─── ML Mental Health Profile (journal-based) ─────────────────────────────────

// Reads up to the 10 most recent journal entries that have ML results,
// counts prediction categories, finds the dominant one, then persists
// the profile as a field on the user's Firestore document.
export const updateMlMentalHealthProfile = async (
  userId: string,
  entries: JournalEntry[]
): Promise<MlMentalHealthProfile> => {
  const recent = entries.filter(e => e.mlAnalysis).slice(0, 10);
  let depressionCount = 0;
  let anxietyCount = 0;
  let normalCount = 0;
  let latestPrediction = 'normal';
  let latestConfidence = 0;

  recent.forEach((entry, i) => {
    const p = entry.mlAnalysis!.prediction;
    if (i === 0) {
      latestPrediction = p;
      latestConfidence = entry.mlAnalysis!.confidence;
    }
    if (p === 'depression') depressionCount++;
    else if (p === 'anxiety') anxietyCount++;
    else normalCount++;
  });

  let dominantCategory = 'normal';
  if (depressionCount > 0 && depressionCount >= anxietyCount && depressionCount >= normalCount) {
    dominantCategory = 'depression';
  } else if (anxietyCount > 0 && anxietyCount >= normalCount) {
    dominantCategory = 'anxiety';
  }

  const profile: MlMentalHealthProfile = {
    latestPrediction,
    latestConfidence,
    dominantCategory,
    depressionCount,
    anxietyCount,
    normalCount,
    lastUpdated: new Date(),
  };

  await setDoc(doc(db, 'users', userId), {
    mlMentalHealthProfile: {
      latestPrediction: profile.latestPrediction,
      latestConfidence: profile.latestConfidence,
      dominantCategory: profile.dominantCategory,
      depressionCount: profile.depressionCount,
      anxietyCount: profile.anxietyCount,
      normalCount: profile.normalCount,
      lastUpdated: Timestamp.now(),
    },
  }, { merge: true });

  return profile;
};

// ─── KNN Input Builder ────────────────────────────────────────────────────────

// Builds the exact 5-feature vector expected by POST /recommend-groups.
// emotion_encoded and emotion_confidence now come from the 7-day weekly summary
// rather than the single latest BERT prediction.
export const buildKnnInput = (
  dass21Result: Dass21Result | null,
  weeklyEmotion: WeeklyEmotionSummary
): KnnInput => ({
  depression_score:   dass21Result?.depression.final ?? 0,
  anxiety_score:      dass21Result?.anxiety.final    ?? 0,
  stress_score:       dass21Result?.stress.final     ?? 0,
  dominant_emotion:   weeklyEmotion.dominantEmotion,
  emotion_confidence: weeklyEmotion.averageConfidence,
});

// ─── Realtime ML Mental Health Profile Listener ───────────────────────────────

// Attaches an onSnapshot listener to the user document and extracts the
// mlMentalHealthProfile field. Fires immediately with current data, then
// again whenever the field changes (e.g. after a new journal entry is saved).
// Returns an unsubscribe function — call it in a useEffect cleanup.
export const subscribeToMlMentalHealthProfile = (
  userId: string,
  callback: (profile: MlMentalHealthProfile | null) => void
): (() => void) => {
  console.log('[Firestore] Subscribing ML mental health profile for user:', userId);
  return onSnapshot(
    doc(db, 'users', userId),
    snap => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const raw = snap.data().mlMentalHealthProfile;
      if (!raw) {
        callback(null);
        return;
      }
      callback({
        latestPrediction: raw.latestPrediction ?? 'normal',
        latestConfidence: raw.latestConfidence ?? 0,
        dominantCategory: raw.dominantCategory ?? 'normal',
        depressionCount: raw.depressionCount ?? 0,
        anxietyCount: raw.anxietyCount ?? 0,
        normalCount: raw.normalCount ?? 0,
        lastUpdated: raw.lastUpdated?.toDate() ?? new Date(),
      });
    },
    err => {
      console.error('[Firestore] subscribeToMlMentalHealthProfile error:', err);
      callback(null);
    }
  );
};

// ─── Recommendation Category Logic ───────────────────────────────────────────

// Maps a DASS subscale condition + severity level to a GroupCategory.
export const buildRecommendationCategory = (
  condition: string,
  severity: string
): GroupCategory => {
  const sev = severity.toLowerCase();
  if (sev === 'extremely severe' || sev === 'severe') return 'Severe Support';
  if (sev === 'moderate') return 'Moderate Support';
  if (sev === 'mild') {
    if (condition === 'anxiety' || condition === 'stress') return 'Wellness - Stress Aware';
    return 'Mild Support';
  }
  // Normal severity — differentiate by condition for contextual grouping
  if (condition === 'stress') return 'Wellness - Stress Aware';
  if (condition === 'depression') return 'Recovery & Improvement';
  return 'Wellness - Thriving';
};

const ML_CONFIDENCE_THRESHOLD = 0.80;

// ─── Trend & Stability Thresholds ─────────────────────────────────────────────
// These constants control how resistant the recommendation system is to change.
// All three TREND_ constants must be satisfied simultaneously before
// peerGroupRecommendationCategory is allowed to move.

// Minimum number of high-confidence (>= 0.80) BERT records in the 7-day window.
// 10 records ≈ a user engaging meaningfully across the week, not just once.
const TREND_MIN_VALID_RECORDS = 10;

// Minimum times the dominant label must appear among the valid records.
// With TREND_MIN_VALID_RECORDS = 10, this enforces ≥ 70 % dominance.
const TREND_MIN_DOMINANT_COUNT = 7;

// Records must originate from at least this many distinct calendar days.
// Prevents a single very active day from being mistaken for a weekly trend.
const TREND_MIN_DISTINCT_DAYS = 3;

// Minimum high-confidence records in 7-day window before getWeeklyDominantEmotion
// trusts the aggregate. Below this threshold it falls back to latestMlEmotionScore.
const KNN_MIN_RECORDS_FOR_TREND = 5;

// Consecutive high-confidence BERT results required before activeRecommendationCategory
// moves one level. Raised from 3 to prevent a brief bad day from shifting the category.
const STABILITY_REPEAT_THRESHOLD = 5;
// ──────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER_DS = ['Normal', 'Mild', 'Moderate', 'Severe', 'Extremely Severe'];

// Saves the questionnaire result as the immutable baseline.
// No-ops if initialQuestionnaireScore already exists (questionnaire is one-time only).
export const updateQuestionnaireBaseline = async (
  userId: string,
  dass21Result: Dass21Result
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  if (snap.exists() && snap.data()?.initialQuestionnaireScore) return;

  const depRank = SEVERITY_ORDER_DS.indexOf(dass21Result.depression.severity);
  const anxRank = SEVERITY_ORDER_DS.indexOf(dass21Result.anxiety.severity);
  const strRank = SEVERITY_ORDER_DS.indexOf(dass21Result.stress.severity);

  let mainCondition: string;
  let mainSeverity: string;
  if (depRank >= anxRank && depRank >= strRank) {
    mainCondition = 'depression'; mainSeverity = dass21Result.depression.severity;
  } else if (anxRank >= strRank) {
    mainCondition = 'anxiety'; mainSeverity = dass21Result.anxiety.severity;
  } else {
    mainCondition = 'stress'; mainSeverity = dass21Result.stress.severity;
  }

  const totalScore = dass21Result.depression.final + dass21Result.anxiety.final + dass21Result.stress.final;
  const baselineCategory = buildRecommendationCategory(mainCondition, mainSeverity);
  const sevSlug = mainSeverity.toLowerCase().replace(/\s+/g, '_');
  const userStatus = (sevSlug === 'severe' || sevSlug === 'extremely_severe') ? 'under_review' : 'normal';

  await setDoc(profileRef, {
    initialQuestionnaireScore: {
      depressionScore: dass21Result.depression.final,
      anxietyScore: dass21Result.anxiety.final,
      stressScore: dass21Result.stress.final,
      totalScore,
      mainCondition,
      category: mainSeverity,
      completedAt: Timestamp.now(),
    },
    latestMlEmotionScore: null,
    baselineRecommendationCategory: baselineCategory,
    activeRecommendationCategory: baselineCategory,
    recommendationSource: 'questionnaire',
    userStatus,
  }, { merge: true });
};

// Updates the recommendation profile when a new ML emotion analysis result arrives.
// Applies stability rules (3 repeated confident results) before moving one level.
// Severe baseline users are flagged for review instead of being auto-downgraded.
export const updateMlEmotionRecommendation = async (
  userId: string,
  mlResult: {
    prediction: string;
    confidence: number;
    probabilities: { depression: number; anxiety: number; normal: number };
  }
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  const existing = snap.data();
  const baselineCategory: GroupCategory = existing?.baselineRecommendationCategory ?? 'Wellness - Thriving';
  const currentCategory: GroupCategory = existing?.activeRecommendationCategory ?? baselineCategory;
  const isSevereBaseline = baselineCategory === 'Severe Support';

  const latestMlEmotionScore = {
    prediction: mlResult.prediction,
    confidence: mlResult.confidence,
    probabilities: mlResult.probabilities,
    recordedAt: Timestamp.now(),
  };

  const update: Record<string, any> = { latestMlEmotionScore, lastUpdated: Timestamp.now() };

  if (mlResult.confidence >= ML_CONFIDENCE_THRESHOLD) {
    if (isSevereBaseline) {
      update['userStatus'] = 'under_review';
    } else {
      const rawCounter = existing?.mlStabilityCounter;
      const counter: MlStabilityCounter | null = rawCounter
        ? { lastPrediction: rawCounter.lastPrediction, repeatedCount: rawCounter.repeatedCount, lastUpdatedAt: rawCounter.lastUpdatedAt?.toDate() ?? new Date() }
        : null;

      const { newCategory, newCounter, changed } = updateCategoryWithStabilityRules(currentCategory, mlResult, counter);
      update['mlStabilityCounter'] = {
        lastPrediction: newCounter.lastPrediction,
        repeatedCount: newCounter.repeatedCount,
        lastUpdatedAt: Timestamp.now(),
      };
      if (changed) {
        update['activeRecommendationCategory'] = newCategory;
        update['recommendationSource'] = 'ml_analysis';
      }
      update['userStatus'] = 'normal';
    }
  } else {
    update['activeRecommendationCategory'] = baselineCategory;
    update['recommendationSource'] = 'questionnaire';
  }

  await updateDoc(profileRef, update);
};

// Fetches active peer groups and resources for the given recommendation category.
// peer_groups must have groupCategory + isActive fields.
// resources must have resourceCategory + isActive fields.
export const fetchRecommendations = async (
  category: GroupCategory
): Promise<RecommendationResult> => {
  const [groupsSnap, resourcesSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'peer_groups'),
      where('groupCategory', '==', category),
      where('isActive', '==', true)
    )),
    getDocs(query(
      collection(db, 'resources'),
      where('resourceCategory', '==', category),
      where('isActive', '==', true)
    )),
  ]);

  const groups: Group[] = groupsSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.groupName ?? data.group_name ?? '',
      description: data.description ?? '',
      members: data.memberCount ?? 0,
      category: data.groupCategory as GroupCategory,
      image: data.imageUrl
        ? { uri: data.imageUrl }
        : GROUP_IMAGE_MAP[category] ?? GROUP_IMAGE_MAP['Wellness - Thriving'],
    };
  });

  const resources: Resource[] = resourcesSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title as string,
      description: data.description as string | undefined,
      category: (data.resourceCategory ?? data.category) as string,
      contentType: (data.contentType as 'text' | 'image') ?? 'text',
      imageUrl: data.imageUrl as string | undefined,
      textContent: data.textContent as string | undefined,
      isActive: data.isActive as boolean | undefined,
      type: data.type as string | undefined,
      content: data.description as string | undefined,
      url: data.contentUrl as string | undefined,
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    };
  });

  return { groups, resources };
};

// Fetches groups (main + optional secondary) and resources for the given categories.
// Use activeCategory for main recommendations, baselineCategory for secondary ones.
// Secondary groups and resources are deduplicated by id against the primary set.
export const fetchRecommendationsByCategory = async (
  activeCategory: GroupCategory,
  baselineCategory?: GroupCategory
): Promise<RecommendationResult> => {
  const [primaryResult, resources] = await Promise.all([
    fetchRecommendations(activeCategory),
    fetchResourcesByCategory(activeCategory, baselineCategory),
  ]);

  if (!baselineCategory || baselineCategory === activeCategory) {
    return { groups: primaryResult.groups, resources };
  }

  const secondaryResult = await fetchRecommendations(baselineCategory);
  const primaryIds = new Set(primaryResult.groups.map(g => g.id));
  const secondaryGroups = secondaryResult.groups.filter(g => !primaryIds.has(g.id));

  return { groups: [...primaryResult.groups, ...secondaryGroups], resources };
};

// ─── Public Recommendation API ────────────────────────────────────────────────

// Maps DASS severity category + main condition to a GroupCategory.
// category: 'Normal' | 'Mild' | 'Moderate' | 'Severe' | 'Extremely Severe'
// condition: 'stress' | 'depression' | 'anxiety'
export const mapToAppCategory = (category: string, condition: string): GroupCategory => {
  const cat = category.toLowerCase().trim();
  const cond = condition.toLowerCase();
  if (cat === 'extremely severe' || cat === 'severe') return 'Severe Support';
  if (cat === 'moderate') return 'Moderate Support';
  if (cat === 'mild') return 'Mild Support';
  // Normal severity — differentiate by condition
  if (cond === 'stress') return 'Wellness - Stress Aware';
  if (cond === 'depression') return 'Wellness - Emotionally Aware';
  return 'Wellness - Thriving';
};

// Saves questionnaire result as the immutable baseline profile.
// No-ops if initialQuestionnaireScore already exists (one-time only).
export const updateQuestionnaireProfile = async (
  userId: string,
  dass21Result: Dass21Result
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  if (snap.exists() && snap.data()?.initialQuestionnaireScore) return;

  const depRank = SEVERITY_ORDER_DS.indexOf(dass21Result.depression.severity);
  const anxRank = SEVERITY_ORDER_DS.indexOf(dass21Result.anxiety.severity);
  const strRank = SEVERITY_ORDER_DS.indexOf(dass21Result.stress.severity);

  let mainCondition: string;
  let mainSeverity: string;
  if (depRank >= anxRank && depRank >= strRank) {
    mainCondition = 'depression'; mainSeverity = dass21Result.depression.severity;
  } else if (anxRank >= strRank) {
    mainCondition = 'anxiety'; mainSeverity = dass21Result.anxiety.severity;
  } else {
    mainCondition = 'stress'; mainSeverity = dass21Result.stress.severity;
  }

  const totalScore = dass21Result.depression.final + dass21Result.anxiety.final + dass21Result.stress.final;
  const baselineCategory = mapToAppCategory(mainSeverity, mainCondition);
  const sevNorm = mainSeverity.toLowerCase();
  const userStatus: 'normal' | 'under_review' =
    (sevNorm === 'severe' || sevNorm === 'extremely severe') ? 'under_review' : 'normal';

  await setDoc(profileRef, {
    initialQuestionnaireScore: {
      depressionScore: dass21Result.depression.final,
      anxietyScore: dass21Result.anxiety.final,
      stressScore: dass21Result.stress.final,
      totalScore,
      mainCondition,
      category: mainSeverity,
      completedAt: Timestamp.now(),
    },
    latestMlEmotionScore: null,
    baselineRecommendationCategory: baselineCategory,
    activeRecommendationCategory: baselineCategory,
    recommendationSource: 'questionnaire',
    userStatus,
  }, { merge: true });
};

// Updates the recommendation profile when a new ML result arrives.
// Requires questionnaire to have been completed first (no-ops otherwise).
// Applies stability rules (3 repeated confident results, one level at a time).
// Severe baseline users are flagged for review instead of being auto-downgraded.
export const updateMlEmotionProfile = async (
  userId: string,
  mlResult: {
    prediction: string;
    confidence: number;
    probabilities: { depression: number; anxiety: number; normal: number };
  }
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return;

  const existing = snap.data();
  const baselineCategory: GroupCategory = existing?.baselineRecommendationCategory ?? 'Wellness - Thriving';
  const currentCategory: GroupCategory = existing?.activeRecommendationCategory ?? baselineCategory;
  const isSevereBaseline = baselineCategory === 'Severe Support';

  const latestMlEmotionScore = {
    prediction: mlResult.prediction,
    confidence: mlResult.confidence,
    probabilities: mlResult.probabilities,
    recordedAt: Timestamp.now(),
  };

  const update: Record<string, any> = { latestMlEmotionScore, lastUpdated: Timestamp.now() };

  if (mlResult.confidence >= ML_CONFIDENCE_THRESHOLD) {
    if (isSevereBaseline) {
      update['userStatus'] = 'under_review';
    } else {
      const rawCounter = existing?.mlStabilityCounter;
      const counter: MlStabilityCounter | null = rawCounter
        ? { lastPrediction: rawCounter.lastPrediction, repeatedCount: rawCounter.repeatedCount, lastUpdatedAt: rawCounter.lastUpdatedAt?.toDate() ?? new Date() }
        : null;

      const { newCategory, newCounter, changed } = updateCategoryWithStabilityRules(currentCategory, mlResult, counter);
      update['mlStabilityCounter'] = {
        lastPrediction: newCounter.lastPrediction,
        repeatedCount: newCounter.repeatedCount,
        lastUpdatedAt: Timestamp.now(),
      };
      if (changed) {
        update['activeRecommendationCategory'] = newCategory;
        update['recommendationSource'] = 'ml_analysis';
      }
      update['userStatus'] = 'normal';
    }
  } else {
    update['activeRecommendationCategory'] = baselineCategory;
    update['recommendationSource'] = 'questionnaire';
  }

  await updateDoc(profileRef, update);
};

// Realtime listener for the recommendation profile stored in mentalHealthProfile/currentProfile.
// Returns an unsubscribe function — call it in a useEffect cleanup.
export const subscribeToRecommendationProfile = (
  userId: string,
  callback: (profile: MentalHealthRecommendationProfile | null) => void
): (() => void) => {
  console.log('[Firestore] Subscribing recommendation profile for user:', userId);
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  return onSnapshot(profileRef, snap => {
    if (!snap.exists()) { callback(null); return; }
    const raw = snap.data();
    if (!raw.initialQuestionnaireScore) { callback(null); return; }

    const qs = raw.initialQuestionnaireScore;
    const rawCounter = raw.mlStabilityCounter;
    callback({
      initialQuestionnaireScore: {
        depressionScore: qs.depressionScore ?? 0,
        anxietyScore: qs.anxietyScore ?? 0,
        stressScore: qs.stressScore ?? 0,
        totalScore: qs.totalScore ?? 0,
        mainCondition: qs.mainCondition ?? '',
        category: qs.category ?? 'Normal',
        completedAt: qs.completedAt?.toDate() ?? new Date(),
      },
      latestMlEmotionScore: raw.latestMlEmotionScore
        ? {
          prediction: raw.latestMlEmotionScore.prediction,
          confidence: raw.latestMlEmotionScore.confidence,
          probabilities: raw.latestMlEmotionScore.probabilities,
          recordedAt: raw.latestMlEmotionScore.recordedAt?.toDate() ?? new Date(),
          analyzedAt: raw.latestMlEmotionScore.analyzedAt?.toDate(),
          sourceTextsUsed: raw.latestMlEmotionScore.sourceTextsUsed,
        }
        : null,
      baselineRecommendationCategory: raw.baselineRecommendationCategory ?? 'Wellness - Thriving',
      activeRecommendationCategory: raw.activeRecommendationCategory ?? 'Wellness - Thriving',
      recommendationSource: raw.recommendationSource ?? 'questionnaire',
      userStatus: raw.userStatus ?? 'normal',
      mlStabilityCounter: rawCounter
        ? {
          lastPrediction: rawCounter.lastPrediction ?? 'normal',
          repeatedCount: rawCounter.repeatedCount ?? 0,
          lastUpdatedAt: rawCounter.lastUpdatedAt?.toDate() ?? new Date(),
        }
        : null,
      advisorConnectionStatus: raw.advisorConnectionStatus as string | undefined,
      approvedCategory: raw.approvedCategory as GroupCategory | undefined,
      approvalMessageSeen: raw.approvalMessageSeen as boolean | undefined,
      peerGroupRecommendationCategory: raw.peerGroupRecommendationCategory as GroupCategory | undefined,
      resourceRecommendationCategory: raw.resourceRecommendationCategory as GroupCategory | undefined,
      wellnessScore: typeof raw.wellnessScore === 'number' ? raw.wellnessScore : undefined,
    });
  }, err => {
    console.error('[Firestore] subscribeToRecommendationProfile error:', err);
    callback(null);
  });
};

// Alias for subscribeToRecommendationProfile — preferred name for feature code.
export const listenToMentalHealthProfile = (
  userId: string,
  callback: (profile: MentalHealthRecommendationProfile | null) => void
): (() => void) => subscribeToRecommendationProfile(userId, callback);

// Marks the advisor approval message as seen so it is not shown again.
// Called when the user taps "Continue to App" on the approval modal.
export const continueAfterAdvisorApproval = async (userId: string): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  await setDoc(profileRef, {
    approvalMessageSeen: true,
    approvalMessageSeenAt: serverTimestamp(),
  }, { merge: true });
};

// ─── Canonical Category Order & Level Helpers ─────────────────────────────────

// Single source of truth for recommendation category ordering.
// Index 0 = lowest support need (best wellness), index 5 = highest support need.
// 'Severe Support' is excluded — set only by the questionnaire baseline and never
// auto-assigned or transitioned into via ML. All recommendation logic that moves
// or compares categories must reference this array, not a local copy.
export const ML_RECOMMENDATION_ORDER: GroupCategory[] = [
  'Wellness - Thriving',          // 0 — lowest support need
  'Wellness - Stress Aware',      // 1
  'Wellness - Emotionally Aware', // 2
  'Recovery & Improvement',       // 3
  'Mild Support',                 // 4
  'Moderate Support',             // 5 — highest support need (ML ceiling)
];

// Maps KNN group IDs to GroupCategory. G1 is intentionally absent — it is a
// safety flag only and must never be auto-assigned as a category.
export const KNN_GROUP_TO_CATEGORY: Record<string, GroupCategory> = {
  G1_Crisis_Peer_Support:   'Severe Support',
  G2_Academic_Burnout:      'Moderate Support',
  G3_Social_Isolation:      'Moderate Support',
  G4_Anxiety_Management:    'Mild Support',
  G5_Study_Buddy:           'Wellness - Stress Aware',
  G6_General_Wellness:      'Wellness - Thriving',
  G7_Recovery_Resilience:   'Recovery & Improvement',
  G8_Depression_Support:    'Moderate Support',
};

// Returns the ordered support level (0–5). Returns -1 for 'Severe Support'.
export const getCategoryLevel = (category: GroupCategory): number =>
  ML_RECOMMENDATION_ORDER.indexOf(category);

// Moves one step toward higher support need (signals worsening).
// Capped at 'Moderate Support'. Returns input unchanged for 'Severe Support'.
export const moveCategoryUp = (category: GroupCategory): GroupCategory => {
  const idx = ML_RECOMMENDATION_ORDER.indexOf(category);
  if (idx === -1) return category;
  return ML_RECOMMENDATION_ORDER[Math.min(ML_RECOMMENDATION_ORDER.length - 1, idx + 1)];
};

// Moves one step toward wellness (signals improvement).
// Capped at 'Wellness - Thriving'. Returns input unchanged for 'Severe Support'.
export const moveCategoryDown = (category: GroupCategory): GroupCategory => {
  const idx = ML_RECOMMENDATION_ORDER.indexOf(category);
  if (idx === -1) return category;
  return ML_RECOMMENDATION_ORDER[Math.max(0, idx - 1)];
};

// Moves at most one level toward mlSuggestedCategory, only when repeatedCount >= 3.
// Never jumps more than one step regardless of how far apart the categories are.
// Returns currentCategory unchanged for Severe Support, unknown categories, same
// level, or when the count threshold has not been reached.
export const updateCategorySafely = (
  currentCategory: GroupCategory,
  mlSuggestedCategory: GroupCategory,
  repeatedCount: number
): GroupCategory => {
  // Require STABILITY_REPEAT_THRESHOLD consecutive same-label confident results
  // before moving the category one level. Raised from 3 → 5 so a single
  // rough conversation session cannot immediately shift the recommendation.
  if (repeatedCount < STABILITY_REPEAT_THRESHOLD) return currentCategory;
  const currentLevel = getCategoryLevel(currentCategory);
  const suggestedLevel = getCategoryLevel(mlSuggestedCategory);
  if (currentLevel === -1 || suggestedLevel === -1 || suggestedLevel === currentLevel) {
    return currentCategory;
  }
  return suggestedLevel > currentLevel
    ? moveCategoryUp(currentCategory)
    : moveCategoryDown(currentCategory);
};

const WELLNESS_SCORE_MAP: Record<GroupCategory, number> = {
  'Wellness - Thriving': 100,
  'Wellness - Stress Aware': 85,
  'Wellness - Emotionally Aware': 75,
  'Recovery & Improvement': 65,
  'Mild Support': 50,
  'Moderate Support': 35,
  'Severe Support': 20,
};

export const calculateWellnessScore = (category: GroupCategory): number =>
  WELLNESS_SCORE_MAP[category] ?? 50;

// ─── Stability-based Category Transition ─────────────────────────────────────

// Target category for each ML prediction label, used to determine movement direction.
// normal → wants to reach wellness; depression/anxiety → wants to reach high support.
// The actual move is always one step via updateCategorySafely — never a direct jump.
const ML_SUGGESTED_CATEGORY: Record<string, GroupCategory> = {
  normal: 'Wellness - Thriving',
  depression: 'Moderate Support',
  anxiety: 'Moderate Support',
};

export const updateCategoryWithStabilityRules = (
  currentCategory: GroupCategory,
  mlResult: { prediction: string; confidence: number },
  counter: MlStabilityCounter | null
): { newCategory: GroupCategory; newCounter: MlStabilityCounter; changed: boolean } => {
  const now = new Date();

  if (mlResult.confidence < ML_CONFIDENCE_THRESHOLD) {
    return {
      newCategory: currentCategory,
      newCounter: counter ?? { lastPrediction: mlResult.prediction, repeatedCount: 0, lastUpdatedAt: now },
      changed: false,
    };
  }

  const isSame = counter?.lastPrediction === mlResult.prediction;
  const repeatedCount = isSame ? (counter!.repeatedCount + 1) : 1;
  const newCounter: MlStabilityCounter = {
    lastPrediction: mlResult.prediction,
    repeatedCount,
    lastUpdatedAt: now,
  };

  const mlSuggestedCategory = ML_SUGGESTED_CATEGORY[mlResult.prediction] ?? 'Wellness - Thriving';
  const newCategory = updateCategorySafely(currentCategory, mlSuggestedCategory, repeatedCount);
  const changed = newCategory !== currentCategory;

  if (changed) newCounter.repeatedCount = 0;

  return { newCategory, newCounter, changed };
};

// ─── ML Text Collection Functions ─────────────────────────────────────────────

export const fetchUserJournalTexts = async (userId: string): Promise<string[]> => {
  console.log('[ML] Fetching journal texts...');
  const q = query(
    collection(db, 'users', userId, 'journal_entries'),
    orderBy('date', 'desc'),
    limit(5)
  );
  const snap = await getDocs(q);
  const texts = snap.docs
    .map(d => {
      const data = d.data();
      // Combine title + content so short entries still contribute signal.
      return [data.title, data.content, data.text]
        .filter((v): v is string => typeof v === 'string' && v.trim().length >= 3)
        .join(' ')
        .trim();
    })
    .filter(t => t.length >= 3);
  console.log('[ML] Journal entries found:', texts.length);
  return texts;
};

export const fetchUserGroupChatTexts = async (userId: string): Promise<string[]> => {
  console.log('[ML] Fetching group chat texts...');
  const memberSnap = await getDocs(
    query(collection(db, 'groupMembers'), where('userId', '==', userId))
  );
  const groupIds = memberSnap.docs.map(d => d.data().groupId as string);

  const results = await Promise.all(
    groupIds.map(groupId =>
      getDocs(
        query(
          collection(db, 'peer_groups', groupId, 'chatMessages'),
          where('senderId', '==', userId),
          limit(10)
        )
      )
    )
  );

  const texts = results.flatMap(snap =>
    snap.docs
      .map(d => (d.data().text as string | undefined)?.trim() ?? '')
      .filter(t => t.length >= 3)
  );
  console.log('[ML] Group messages found:', texts.length);
  return texts;
};

export const fetchUserAiChatTexts = async (userId: string): Promise<string[]> => {
  console.log('[ML] Fetching AI chat texts...');
  const q = query(
    collection(db, 'users', userId, 'aiChatMessages'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  const snap = await getDocs(q);
  // Only analyze the user's own messages — not the AI bot's responses.
  const texts = snap.docs
    .filter(d => d.data().sender === 'user')
    .map(d => (d.data().text as string | undefined)?.trim() ?? '')
    .filter(t => t.length >= 3);
  console.log('[ML] AI messages found:', texts.length);
  return texts;
};

export const saveAiChatMessage = async (userId: string, text: string): Promise<void> => {
  await addDoc(collection(db, 'users', userId, 'aiChatMessages'), {
    text,
    timestamp: Timestamp.now(),
    sender: 'user',
  });
};

export const collectUserMlTextBatch = async (
  userId: string
): Promise<{ texts: string[]; sources: string[] }> => {
  const [journalTexts, groupTexts, aiTexts] = await Promise.all([
    fetchUserJournalTexts(userId),
    fetchUserGroupChatTexts(userId),
    fetchUserAiChatTexts(userId),
  ]);

  const sources: string[] = [];
  if (journalTexts.length > 0) sources.push('journal');
  if (groupTexts.length > 0) sources.push('group_chat');
  if (aiTexts.length > 0) sources.push('ai_chat');

  const texts = [...journalTexts, ...groupTexts, ...aiTexts].filter(t => t.trim().length >= 3);
  return { texts, sources };
};

// ─── ML Analysis Runner ────────────────────────────────────────────────────────

export const runMlAnalysis = async (textBatch: string[]): Promise<MlPredictResponse | null> => {
  if (textBatch.length === 0) return null;
  const combined = textBatch.join(' ').trim();
  if (combined.length < 20) return null;
  try {
    return await predictText(combined);
  } catch {
    return null;
  }
};

// ─── Update Mental Health Profile from ML (with stability rules) ──────────────

export const updateMentalHealthProfileFromMl = async (
  userId: string,
  mlResult: MlPredictResponse,
  sourceTextsUsed: string[] = [],
  analyzedTextPreview?: string
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  const existing = snap.exists() ? snap.data() : null;

  // Always persist the latest ML emotion score regardless of questionnaire state.
  const scorePayload: Record<string, any> = {
    prediction:      mlResult.prediction,
    confidence:      mlResult.confidence,
    probabilities:   mlResult.probabilities,
    recordedAt:      Timestamp.now(),
    analyzedAt:      Timestamp.now(),
    sourceTextsUsed,
  };
  if (analyzedTextPreview !== undefined) {
    scorePayload['analyzedTextPreview'] = analyzedTextPreview;
  }
  const update: Record<string, any> = {
    latestMlEmotionScore: scorePayload,
    lastUpdated: Timestamp.now(),
  };

  // Category transitions and stability rules only apply once the questionnaire
  // baseline exists — without it there is no reference point to move from.
  if (existing?.initialQuestionnaireScore) {
    const baselineCategory: GroupCategory = existing.baselineRecommendationCategory ?? 'Wellness - Thriving';
    const isSevereBaseline = baselineCategory === 'Severe Support';
    const currentCategory: GroupCategory = existing.activeRecommendationCategory ?? baselineCategory;

    const rawCounter = existing.mlStabilityCounter;
    const counter: MlStabilityCounter | null = rawCounter
      ? {
        lastPrediction: rawCounter.lastPrediction,
        repeatedCount: rawCounter.repeatedCount,
        lastUpdatedAt: rawCounter.lastUpdatedAt?.toDate() ?? new Date(),
      }
      : null;

    if (isSevereBaseline) {
      update['userStatus'] = 'under_review';
      const isSame = counter?.lastPrediction === mlResult.prediction;
      update['mlStabilityCounter'] = {
        lastPrediction: mlResult.prediction,
        repeatedCount: isSame ? (counter!.repeatedCount + 1) : 1,
        lastUpdatedAt: Timestamp.now(),
      };
    } else {
      const { newCategory, newCounter, changed } = updateCategoryWithStabilityRules(
        currentCategory, mlResult, counter
      );
      update['mlStabilityCounter'] = {
        lastPrediction: newCounter.lastPrediction,
        repeatedCount: newCounter.repeatedCount,
        lastUpdatedAt: Timestamp.now(),
      };
      if (changed) {
        update['activeRecommendationCategory'] = newCategory;
        update['recommendationSource'] = 'ml_analysis';
      }
      update['userStatus'] = 'normal';
    }
  }

  // Create the profile doc if it doesn't exist yet (questionnaire not done).
  if (snap.exists()) {
    await updateDoc(profileRef, update);
  } else {
    await setDoc(profileRef, update, { merge: true });
  }
};

// ─── Shared ML Analysis Entry Point ───────────────────────────────────────────

// Single function called after every user-generated text event (journal save,
// group chat send, AI chat send). Collects text from all three sources, sends
// the combined batch to BERT, and writes latestMlEmotionScore to Firestore.
export const runUserTextMlAnalysis = async (userId: string): Promise<void> => {
  const [journalTexts, aiTexts, groupTexts] = await Promise.all([
    fetchUserJournalTexts(userId),
    fetchUserAiChatTexts(userId),
    fetchUserGroupChatTexts(userId),
  ]);

  const sources: string[] = [];
  if (journalTexts.length > 0) sources.push('journal');
  if (aiTexts.length > 0) sources.push('ai_chat');
  if (groupTexts.length > 0) sources.push('group_chat');

  const allTexts = [...journalTexts, ...aiTexts, ...groupTexts].filter(t => t.trim().length >= 3);
  const combined = allTexts.join(' ').trim();

  console.log('[ML] Combined ML text batch:', combined.length > 120 ? combined.slice(0, 120) + '…' : combined);

  if (combined.length < 3) {
    console.log('[ML] Not enough text to analyze — skipping.');
    return;
  }

  try {
    const result = await predictText(combined);
    console.log('[ML] ML prediction result:', JSON.stringify(result));
    await updateMentalHealthProfileFromMl(userId, result, sources);
    console.log('[ML] latestMlEmotionScore updated successfully');
  } catch (err) {
    console.error('[ML] ML analysis failed:', err);
  }
};

// Legacy alias — kept for any callers outside AppContext.
export const triggerBatchMlAnalysis = async (userId: string): Promise<void> =>
  runUserTextMlAnalysis(userId);

// ─── Low Wellness Restriction ────────────────────────────────────────────────

export const isUserRestricted = (profile: MentalHealthRecommendationProfile | null): boolean => {
  if (!profile) return false;
  return (
    profile.userStatus === 'restricted' ||
    (typeof profile.wellnessScore === 'number' && profile.wellnessScore < 10)
  );
};

export const applyLowWellnessRestriction = async (
  userId: string,
  wellnessScore: number
): Promise<void> => {
  console.log('[Restriction] Wellness score below 10');
  console.log('[Restriction] User restricted');
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  await setDoc(profileRef, {
    userStatus: 'restricted',
    restrictedReason: 'Low wellness score detected',
    restrictedAt: serverTimestamp(),
    recommendationSource: 'safety_restriction',
  }, { merge: true });
};

// ─── Gradual Wellness Score ───────────────────────────────────────────────────

const POSITIVE_KEYWORDS = ['happy', 'good', 'better', 'calm', 'grateful', 'relaxed', 'excited', 'hopeful', 'peaceful'];
const NEGATIVE_KEYWORDS = ['sad', 'stressed', 'anxious', 'angry', 'tired', 'lonely', 'worried', 'depressed', 'upset'];

export const calculateScoreAdjustment = (
  text: string,
  mlResult: MlPredictResponse
): number => {
  let mlAdjustment = 0;
  if (mlResult.confidence >= 0.80) {
    if (mlResult.prediction === 'normal') mlAdjustment = 2;
    else if (mlResult.prediction === 'anxiety') mlAdjustment = -1;
    else if (mlResult.prediction === 'depression') mlAdjustment = -1;
  }

  const lower = text.toLowerCase();
  let keywordAdjustment = 0;
  if (POSITIVE_KEYWORDS.some(kw => lower.includes(kw))) keywordAdjustment += 2;
  if (NEGATIVE_KEYWORDS.some(kw => lower.includes(kw))) keywordAdjustment -= 1;

  return mlAdjustment + keywordAdjustment;
};

export const saveWellnessScoreHistory = async (
  userId: string,
  previousScore: number,
  newScore: number,
  source: string,
  textPreview: string,
  mlResult: MlPredictResponse
): Promise<void> => {
  await addDoc(collection(db, 'users', userId, 'wellnessScoreHistory'), {
    previousScore,
    newScore,
    changeAmount: newScore - previousScore,
    source,
    textPreview,
    mlPrediction: mlResult.prediction,
    mlConfidence: mlResult.confidence,
    createdAt: Timestamp.now(),
  });
};

export const updateWellnessScoreGradually = async (
  userId: string,
  text: string,
  source: 'journal' | 'group_chat' | 'ai_chat',
  mlResult: MlPredictResponse
): Promise<void> => {
  const adjustment = calculateScoreAdjustment(text, mlResult);
  if (adjustment === 0) return;

  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);

  let currentScore: number;
  if (snap.exists()) {
    const data = snap.data();
    if (typeof data.wellnessScore === 'number') {
      currentScore = data.wellnessScore;
    } else {
      const activeCategory = data.activeRecommendationCategory as GroupCategory | undefined;
      currentScore = activeCategory ? (WELLNESS_SCORE_MAP[activeCategory] ?? 50) : 50;
    }
  } else {
    currentScore = 50;
  }

  const newScore = Math.min(100, Math.max(0, currentScore + adjustment));
  const textPreview = text.slice(0, 80);

  const payload: Record<string, any> = {
    wellnessScore: newScore,
    wellnessScoreUpdatedAt: Timestamp.now(),
  };

  if (snap.exists()) {
    await updateDoc(profileRef, payload);
  } else {
    await setDoc(profileRef, payload, { merge: true });
  }

  saveWellnessScoreHistory(userId, currentScore, newScore, source, textPreview, mlResult).catch(() => {});
  console.log(`[Wellness] Score: ${currentScore} → ${newScore} (${adjustment >= 0 ? '+' : ''}${adjustment}) [${source}]`);

  if (newScore < 10) {
    applyLowWellnessRestriction(userId, newScore).catch(() => {});
  }
};

// ─── Per-Event ML Analysis ────────────────────────────────────────────────────

// Analyzes only the single text that triggered the update (no historical fetch).
// source must be 'journal' | 'group_chat' | 'ai_chat'.
// Saves latestMlEmotionScore including an 80-char preview of the analyzed text.
export const runMlAnalysisForText = async (
  userId: string,
  text: string,
  source: 'journal' | 'group_chat' | 'ai_chat'
): Promise<void> => {
  const trimmed = text.trim();
  if (trimmed.length < 3) return;

  console.log(`[ML] Source: ${source}`);
  console.log('[ML] Text analyzed:', trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed);

  try {
    const result = await predictText(trimmed);
    console.log('[ML] ML prediction result:', JSON.stringify(result));
    const textPreview = trimmed.slice(0, 80);
    await Promise.all([
      updateMentalHealthProfileFromMl(userId, result, [source], textPreview),
      updateResourceRecommendationFromLatestMl(userId, result),
      updateWellnessScoreGradually(userId, trimmed, source, result),
      saveMlAnalysisHistory(userId, result, source, textPreview),
    ]);
    console.log('[ML] latestMlEmotionScore and resourceRecommendationCategory updated');

    const trendResult = await calculateWeeklyMlTrend(userId);
    if (trendResult) {
      await updatePeerGroupRecommendationFromWeeklyTrend(userId, trendResult);
      console.log('[ML] Weekly trend calculated — peerGroupCategory:', trendResult.finalPeerGroupCategory,
        trendResult.updatedPeerGroup ? '(moved)' : '(unchanged)');
    }
    // ✋ KNN is NOT called here on purpose.
    // callKnnAndWriteResult() is rate-limited to 23 h and triggered by the
    // periodic useEffect in AppContext (on profile load). Running it on every
    // text event would defeat the stability thresholds we added and cause the
    // peer-group recommendation to flip after just a few messages.
  } catch (err) {
    console.error(`[ML] ML analysis failed for source "${source}":`, err);
  }
};

// ─── ML Analysis History ──────────────────────────────────────────────────────

// Saves a single ML prediction to the per-user history subcollection.
// Used to build the weekly trend that drives peerGroupRecommendationCategory.
export const saveMlAnalysisHistory = async (
  userId: string,
  mlResult: MlPredictResponse,
  source: 'journal' | 'group_chat' | 'ai_chat',
  textPreview: string
): Promise<string> => {
  const ref = collection(db, 'users', userId, 'mlAnalysisHistory');
  const docRef = await addDoc(ref, {
    prediction: mlResult.prediction,
    confidence: mlResult.confidence,
    probabilities: mlResult.probabilities,
    source,
    textPreview: textPreview.slice(0, 80),
    resourceRecommendationCategory: ML_TO_PRIMARY_CATEGORY[mlResult.prediction] ?? 'Wellness - Thriving',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// Updates resourceRecommendationCategory on the profile in real-time.
// Called on every ML result — does NOT touch peerGroupRecommendationCategory.
export const updateResourceRecommendationFromLatestMl = async (
  userId: string,
  mlResult: MlPredictResponse
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  await setDoc(
    profileRef,
    { resourceRecommendationCategory: ML_TO_PRIMARY_CATEGORY[mlResult.prediction] ?? 'Wellness - Thriving' },
    { merge: true }
  );
};

// Moves currentCategory exactly one step toward suggestedCategory in
// ML_RECOMMENDATION_ORDER. Never jumps more than one level. Returns
// currentCategory if already there, or if either value is outside the order.
export const moveOneLevelToward = (
  currentCategory: GroupCategory,
  suggestedCategory: GroupCategory
): GroupCategory => {
  const currentIdx = ML_RECOMMENDATION_ORDER.indexOf(currentCategory);
  const suggestedIdx = ML_RECOMMENDATION_ORDER.indexOf(suggestedCategory);
  if (currentIdx === -1 || suggestedIdx === -1 || currentIdx === suggestedIdx) {
    return currentCategory;
  }
  return suggestedIdx > currentIdx
    ? ML_RECOMMENDATION_ORDER[currentIdx + 1]
    : ML_RECOMMENDATION_ORDER[currentIdx - 1];
};

export interface WeeklyTrendResult {
  validRecordCount: number;
  dominantPrediction: string;
  dominantCategory: GroupCategory;
  dominantCount: number;
  previousPeerGroupCategory: GroupCategory;
  suggestedPeerGroupCategory: GroupCategory;
  finalPeerGroupCategory: GroupCategory;
  updatedPeerGroup: boolean;
}

// Derives a GroupCategory from raw DASS-21 subscale scores.
// Used as a fallback when the KNN backend is unreachable.
function mapDassScoreToFallbackCategory(qs: {
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;
}): GroupCategory {
  const max = Math.max(qs.depressionScore, qs.anxietyScore, qs.stressScore);
  if (max >= 21) return 'Severe Support';
  if (max >= 14) return 'Moderate Support';
  if (max >= 10) return 'Mild Support';
  return 'Wellness - Thriving';
}

// Calls the KNN /recommend-groups endpoint using the current Firestore profile
// and writes the result back to mentalHealthProfile/currentProfile.
// On network failure, writes a DASS-derived fallback so KNN fields always exist.
export async function callKnnAndWriteResult(userId: string): Promise<void> {
  // Declare these outside try so the catch block can reference them for logging/fallback.
  const KNN_ENDPOINT = 'http://10.0.2.2:8000/recommend-groups';
  const profileDocRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  let payload: KnnRecommendRequest | null = null;

  try {
    console.log('[KNN] Starting KNN call for user:', userId);

    // 1. Read current profile — path: users/{uid}/mentalHealthProfile/currentProfile
    const profileSnap = await getDoc(profileDocRef);
    if (!profileSnap.exists()) {
      console.log('[KNN] Skipping — currentProfile document not found');
      return;
    }
    const profile = profileSnap.data() as MentalHealthRecommendationProfile;

    // 2. Guards - only run when safe
    if (!profile.initialQuestionnaireScore) {
      console.log('[KNN] Skipping — initialQuestionnaireScore is null (questionnaire not completed)');
      return;
    }
    if (profile.userStatus !== 'normal') {
      console.log('[KNN] Skipping — userStatus is', profile.userStatus, '(not normal)');
      return;
    }

    // 3. Build 5-feature vector from existing Firestore data.
    //    Use the 7-day aggregated weekly trend (not the single per-event raw
    //    latestMlEmotionScore) so KNN receives a stable, representative signal.
    const weeklyEmotion = await getWeeklyDominantEmotion(userId);
    console.log(
      `[KNN] Weekly emotion used for payload — dominant: ${weeklyEmotion.dominantEmotion}`,
      `| avgConf: ${weeklyEmotion.averageConfidence}`,
      `| records: ${weeklyEmotion.totalRecords}`
    );
    payload = {
      depression_score:   profile.initialQuestionnaireScore.depressionScore,
      anxiety_score:      profile.initialQuestionnaireScore.anxietyScore,
      stress_score:       profile.initialQuestionnaireScore.stressScore,
      dominant_emotion:   weeklyEmotion.dominantEmotion,
      emotion_confidence: weeklyEmotion.averageConfidence,
    };
    console.log('[KNN] Payload:', JSON.stringify(payload));

    // 4. Call KNN endpoint via the shared mlApiService helper
    console.log('[KNN] Calling /recommend-groups…');
    const knn = await recommendGroups(payload);
    console.log('[KNN] Response received:', JSON.stringify(knn));

    // 5. Safety check: G1 is a flag only — NEVER auto-assign Severe Support
    const isCrisisFlag = knn.recommended_group === 'G1_Crisis_Peer_Support';
    const mappedCategory: GroupCategory | null = isCrisisFlag
      ? null
      : (KNN_GROUP_TO_CATEGORY[knn.recommended_group] ?? null);

    // 6. Write results back to Firestore using setDoc+merge so new fields are
    //    always created even if updateDoc would reject a missing field.
    const knnFields: Record<string, unknown> = {
      knnRecommendedGroup: knn.recommended_group,
      knnProbabilities:    knn.probabilities,
      knnLastUpdatedAt:    serverTimestamp(),
      knnSafetyFlag:       isCrisisFlag,
    };
    if (mappedCategory) knnFields['knnMappedCategory'] = mappedCategory;

    console.log('[KNN] Writing to Firestore...');
    await setDoc(profileDocRef, knnFields, { merge: true });

    console.log(
      `[KNN] ✅ Written — group=${knn.recommended_group} | mapped=${mappedCategory ?? 'none (crisis flag)'} | crisisFlag=${isCrisisFlag}`
    );
    if (isCrisisFlag) {
      console.warn('[KNN] Crisis flag raised for user:', userId);
    }
  } catch (err) {
    // ── Enhanced error logging so network failures surface in Metro/Logcat ──
    console.error('[KNN ERROR] callKnnAndWriteResult failed:', err);
    console.error('[KNN ERROR] Endpoint:', KNN_ENDPOINT);
    if (payload) {
      console.error('[KNN ERROR] Payload sent:', JSON.stringify(payload));
    } else {
      console.error('[KNN ERROR] Payload was never built (failed before step 3)');
    }

    // ── Fallback: write questionnaire-derived category so KNN fields always exist ──
    try {
      const profileSnap = await getDoc(profileDocRef);
      if (profileSnap.exists()) {
        const profile = profileSnap.data() as MentalHealthRecommendationProfile;
        if (profile.initialQuestionnaireScore) {
          const fallbackCategory = mapDassScoreToFallbackCategory(
            profile.initialQuestionnaireScore
          );
          await setDoc(profileDocRef, {
            knnRecommendedGroup: 'FALLBACK_QUESTIONNAIRE',
            knnMappedCategory:   fallbackCategory,
            knnProbabilities:    {},
            knnLastUpdatedAt:    serverTimestamp(),
            knnSafetyFlag:       false,
            knnFallbackReason:   'backend_unreachable',
          }, { merge: true });
          console.warn('[KNN] Backend unreachable — fallback written:', fallbackCategory);
        } else {
          console.warn('[KNN] Cannot write fallback — initialQuestionnaireScore missing');
        }
      }
    } catch (fallbackErr) {
      console.error('[KNN ERROR] Fallback write also failed:', fallbackErr);
    }
  }
}

// Reads the last 7 days of mlAnalysisHistory, filters to high-confidence records
// (>= 0.80), and determines whether peerGroupRecommendationCategory should move
// one level. Requires >= 5 valid records AND the dominant prediction appearing
// >= 3 times before any change is made.
export const calculateWeeklyMlTrend = async (
  userId: string
): Promise<WeeklyTrendResult | null> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) return null;

  const profileData = profileSnap.data();
  const currentPeerGroupCategory: GroupCategory =
    (profileData.peerGroupRecommendationCategory as GroupCategory | undefined) ??
    (profileData.baselineRecommendationCategory as GroupCategory | undefined) ??
    'Wellness - Thriving';

  const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const historySnap = await getDocs(
    query(
      collection(db, 'users', userId, 'mlAnalysisHistory'),
      where('createdAt', '>=', sevenDaysAgo)
    )
  );

  const validRecords = historySnap.docs
    .map(d => d.data())
    .filter(d => typeof d.confidence === 'number' && d.confidence >= 0.80);

  const validRecordCount = validRecords.length;
  const counts: Record<string, number> = { depression: 0, anxiety: 0, normal: 0 };
  validRecords.forEach(r => {
    const p = r.prediction as string;
    if (p in counts) counts[p]++;
  });

  let dominantPrediction = 'normal';
  let dominantCount = 0;
  for (const [pred, count] of Object.entries(counts)) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantPrediction = pred;
    }
  }

  const suggestedPeerGroupCategory: GroupCategory =
    ML_TO_PRIMARY_CATEGORY[dominantPrediction] ?? 'Wellness - Thriving';

  let finalPeerGroupCategory = currentPeerGroupCategory;
  let updatedPeerGroup = false;

  // ── Distinct-day span check ───────────────────────────────────────────────
  // Records must come from at least TREND_MIN_DISTINCT_DAYS different calendar
  // days. This ensures we are seeing a sustained multi-day pattern rather than
  // a burst of activity on a single day inflating the count.
  const distinctDays = new Set(
    validRecords.map(r => {
      const ts = r.createdAt as import('firebase/firestore').Timestamp | undefined;
      return ts?.toDate?.()?.toDateString?.() ?? null;
    }).filter((d): d is string => d !== null)
  ).size;

  // All three conditions must hold before peerGroupRecommendationCategory moves:
  //   • enough total high-confidence records (TREND_MIN_VALID_RECORDS)
  //   • dominant emotion appears with strong majority (TREND_MIN_DOMINANT_COUNT)
  //   • records span multiple days, not a single session (TREND_MIN_DISTINCT_DAYS)
  if (
    validRecordCount >= TREND_MIN_VALID_RECORDS &&
    dominantCount >= TREND_MIN_DOMINANT_COUNT &&
    distinctDays >= TREND_MIN_DISTINCT_DAYS
  ) {
    const moved = moveOneLevelToward(currentPeerGroupCategory, suggestedPeerGroupCategory);
    if (moved !== currentPeerGroupCategory) {
      finalPeerGroupCategory = moved;
      updatedPeerGroup = true;
    }
  }

  return {
    validRecordCount,
    dominantPrediction,
    dominantCategory: suggestedPeerGroupCategory,
    dominantCount,
    previousPeerGroupCategory: currentPeerGroupCategory,
    suggestedPeerGroupCategory,
    finalPeerGroupCategory,
    updatedPeerGroup,
  };
};

// Persists the weekly trend summary. Only moves peerGroupRecommendationCategory
// when updatedPeerGroup is true (threshold rules were satisfied).
export const updatePeerGroupRecommendationFromWeeklyTrend = async (
  userId: string,
  trendResult: WeeklyTrendResult
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const update: Record<string, any> = {
    weeklyTrendSummary: {
      timeframeDays: 7,
      validRecordCount: trendResult.validRecordCount,
      dominantPrediction: trendResult.dominantPrediction,
      dominantCategory: trendResult.dominantCategory,
      dominantCount: trendResult.dominantCount,
      previousPeerGroupCategory: trendResult.previousPeerGroupCategory,
      suggestedPeerGroupCategory: trendResult.suggestedPeerGroupCategory,
      finalPeerGroupCategory: trendResult.finalPeerGroupCategory,
      calculatedAt: serverTimestamp(),
    },
  };
  if (trendResult.updatedPeerGroup) {
    update['peerGroupRecommendationCategory'] = trendResult.finalPeerGroupCategory;
    update['dashboardCategory'] = trendResult.finalPeerGroupCategory;
  }
  await setDoc(profileRef, update, { merge: true });
};

// Returns the stable category to display on the dashboard and use for group recommendations.
export const getDashboardCategory = (
  profile: MentalHealthRecommendationProfile
): GroupCategory =>
  profile.peerGroupRecommendationCategory ??
  profile.baselineRecommendationCategory ??
  profile.activeRecommendationCategory;

// Fetches peer groups from Firestore filtered by the given GroupCategory.
export const fetchRecommendedGroups = async (category: GroupCategory): Promise<Group[]> => {
  const snap = await getDocs(
    query(collection(db, 'peer_groups'), where('group_category', '==', category))
  );
  return snap.docs.map(d => {
    const data = d.data();
    const cat = (data.group_category ?? data.category ?? 'Wellness - Thriving') as GroupCategory;
    return {
      id: d.id,
      name: data.group_name ?? data.name ?? '',
      description: data.group_description ?? data.description ?? '',
      members: data.memberCount ?? data.member_count ?? 0,
      category: cat,
      image: data.group_image_url
        ? { uri: data.group_image_url }
        : GROUP_IMAGE_MAP[cat] ?? GROUP_IMAGE_MAP['Wellness - Thriving'],
    };
  });
};

// Fetches resources filtered by the current resourceRecommendationCategory.
export const fetchRecommendedResources = async (category: string): Promise<Resource[]> =>
  fetchResources(category);

// ─── KNN Weekly Dominant Emotion ─────────────────────────────────────────────

// Reads the last 7 days of mlAnalysisHistory (Firestore path:
// users/{uid}/mlAnalysisHistory) and aggregates it into a dominant emotion
// signal for use as the KNN emotion feature.
// Only records with confidence >= ML_CONFIDENCE_THRESHOLD are counted.
export const getWeeklyDominantEmotion = async (
  userId: string
): Promise<WeeklyEmotionSummary> => {
  console.log('[KNN] Fetching weekly emotion history');

  const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'mlAnalysisHistory'),
      where('createdAt', '>=', sevenDaysAgo)
    )
  );

  const distribution: { depression: number; anxiety: number; normal: number } =
    { depression: 0, anxiety: 0, normal: 0 };
  const confidenceSums: Record<string, number> = { depression: 0, anxiety: 0, normal: 0 };

  // Only count records where BERT was sufficiently confident.
  // The function comment already states this requirement; this loop enforces it.
  snap.docs.forEach(d => {
    const data = d.data();
    const pred = data.prediction as string;
    const conf = typeof data.confidence === 'number' ? data.confidence : 0;
    if (pred in distribution && conf >= ML_CONFIDENCE_THRESHOLD) {
      distribution[pred as keyof typeof distribution]++;
      confidenceSums[pred] += conf;
    }
  });

  const totalRecords = distribution.depression + distribution.anxiety + distribution.normal;

  // ── Fallback for users with insufficient high-confidence history ─────────
  // Require at least KNN_MIN_RECORDS_FOR_TREND confident records before trusting
  // the aggregate. Below this threshold a single entry could dominate the result.
  if (totalRecords < KNN_MIN_RECORDS_FOR_TREND) {
    console.log(`[KNN] Fewer than ${KNN_MIN_RECORDS_FOR_TREND} confident emotion records (got ${totalRecords}) — falling back to latestMlEmotionScore`);
    try {
      const profileSnap = await getDoc(
        doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile')
      );
      if (profileSnap.exists()) {
        const profileData = profileSnap.data() as MentalHealthRecommendationProfile;
        const latestMl = profileData.latestMlEmotionScore;
        if (latestMl?.prediction) {
          console.log('[KNN] Fallback emotion:', latestMl.prediction, 'confidence:', latestMl.confidence);
          return {
            dominantEmotion:     latestMl.prediction ?? 'normal',
            averageConfidence:   latestMl.confidence ?? 0.5,
            totalRecords,
            emotionDistribution: distribution,
          };
        }
      }
    } catch (e) {
      console.warn('[KNN] Could not fetch latestMlEmotionScore for fallback:', e);
    }
    // Last resort: safe neutral defaults
    console.log('[KNN] No latestMlEmotionScore found — using neutral defaults');
    return {
      dominantEmotion:     'normal',
      averageConfidence:   0.5,
      totalRecords,
      emotionDistribution: distribution,
    };
  }

  let dominantEmotion = 'normal';
  let dominantCount = 0;
  for (const [pred, count] of Object.entries(distribution)) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantEmotion = pred;
    }
  }

  const averageConfidence =
    dominantCount > 0
      ? Math.round((confidenceSums[dominantEmotion] / dominantCount) * 1000) / 1000
      : 0;

  console.log(`[KNN] Dominant emotion: ${dominantEmotion}`);
  console.log(`[KNN] Average confidence: ${averageConfidence}`);

  return { dominantEmotion, averageConfidence, totalRecords, emotionDistribution: distribution };
};

// ─── KNN Recommendation State Persistence ────────────────────────────────────

// Writes KNN output to users/{uid}/mentalHealth/recommendationState.
// This document is owned exclusively by the KNN pipeline. The BERT pipeline
// (latestMlEmotionScore, resourceRecommendationCategory, wellnessScore) is
// stored separately on mentalHealthProfile/currentProfile.
const saveKnnRecommendationState = async (
  userId: string,
  recommendedGroup: string,
  weeklyEmotion: WeeklyEmotionSummary
): Promise<void> => {
  console.log('[KNN] Updating recommendationState');
  const stateRef = doc(db, 'users', userId, 'mentalHealth', 'recommendationState');
  const state: Omit<KnnRecommendationState, 'lastWeeklyAnalysisAt'> & { lastWeeklyAnalysisAt: any } = {
    peerGroupRecommendationCategory: recommendedGroup,
    dashboardCategory:               recommendedGroup,
    recommendationEngine:            'knn',
    lastWeeklyAnalysisAt:            serverTimestamp(),
    weeklyTrendSummary:              weeklyEmotion,
  };
  await setDoc(stateRef, state, { merge: true });
};

// ─── Weekly KNN Recommendation Runner ────────────────────────────────────────

// Runs the full KNN recommendation flow at most once per 23 hours.
// Call this from a daily trigger (e.g. on app open after 24 h, or a scheduled job).
// Does NOT touch: latestMlEmotionScore, resourceRecommendationCategory, wellnessScore.
export const runWeeklyKnnRecommendation = async (userId: string): Promise<void> => {
  // Rate-limit: skip if already ran within the last 23 hours.
  const stateRef = doc(db, 'users', userId, 'mentalHealth', 'recommendationState');
  const stateSnap = await getDoc(stateRef);
  if (stateSnap.exists()) {
    const lastRan = stateSnap.data().lastWeeklyAnalysisAt;
    if (lastRan) {
      const lastRanMs = (lastRan as Timestamp).toMillis();
      if (Date.now() - lastRanMs < 23 * 60 * 60 * 1000) {
        console.log('[KNN] Skipping — already ran within 23 hours');
        return;
      }
    }
  }

  // Fetch DASS-21 baseline scores.
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    console.log('[KNN] Skipping — no questionnaire profile found');
    return;
  }
  const profileData = profileSnap.data();
  const qs = profileData.initialQuestionnaireScore;
  if (!qs) {
    console.log('[KNN] Skipping — questionnaire not yet completed');
    return;
  }

  // Reconstruct a minimal Dass21Result from the persisted score.
  const dass21Partial = {
    depression: { final: qs.depressionScore ?? 0 },
    anxiety:    { final: qs.anxietyScore    ?? 0 },
    stress:     { final: qs.stressScore     ?? 0 },
  } as Pick<Dass21Result, 'depression' | 'anxiety' | 'stress'>;

  // Fetch weekly dominant emotion from mlAnalysisHistory.
  const weeklyEmotion = await getWeeklyDominantEmotion(userId);

  // totalRecords === 0 is fine — getWeeklyDominantEmotion now falls back to
  // latestMlEmotionScore so the feature vector is always populated.
  if (weeklyEmotion.totalRecords === 0) {
    console.log('[KNN] No emotion history in last 7 days — proceeding with latestMlEmotionScore fallback');
  }

  // Build the KNN feature vector.
  console.log('[KNN] Building KNN input');
  const knnInput = buildKnnInput(dass21Partial as Dass21Result, weeklyEmotion);

  // Call the FastAPI /recommend-groups endpoint.
  console.log('[KNN] Calling /recommend-groups');
  const { recommendGroups } = await import('./mlApiService');
  const result = await recommendGroups(knnInput);

  console.log(`[KNN] Predicted group: ${result.recommended_group}`);

  // Persist to the KNN-owned recommendationState document.
  await saveKnnRecommendationState(userId, result.recommended_group, weeklyEmotion);
};
