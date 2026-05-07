import { Group, GroupCategory, Dass21Result, Dass21SubscaleResult, JournalEntry, Feedback, Message, Resource, MlMentalHealthProfile, KnnInput, MentalHealthRecommendationProfile, RecommendationResult, MlStabilityCounter } from '../types';
import { db } from './firebaseConfig';
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, Timestamp, where,
  setDoc, updateDoc, increment, getDoc, onSnapshot, limit,
} from 'firebase/firestore';
import { predictText, MlPredictResponse } from './mlApiService';

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
  'Severe Support':               require('../assets/group_image4.jpeg'),
  'Moderate Support':             require('../assets/group_image1.jpg'),
  'Mild Support':                 require('../assets/group_image5.png'),
  'Wellness - Thriving':          require('../assets/group_image3.png'),
  'Wellness - Stress Aware':      require('../assets/group_image5.png'),
  'Wellness - Emotionally Aware': require('../assets/group_image1.jpg'),
  'Recovery & Improvement':       require('../assets/group_image3.png'),
};

export const fetchPeerGroups = async (): Promise<Group[]> => {
  const snap = await getDocs(collection(db, 'peer_groups'));
  return snap.docs.map(d => {
    const data = d.data();
    const category = (data.group_category ?? data.category ?? 'Wellness - Thriving') as GroupCategory;
    const imageUrl: string | undefined = data.group_image_url ?? data.imageUrl;
    return {
      id: d.id,
      name: data.group_name ?? data.name ?? '',
      description: data.group_description ?? data.description ?? data.topic ?? '',
      members: data.memberCount ?? data.member_count ?? 0,
      category,
      image: imageUrl ? { uri: imageUrl } : (GROUP_IMAGE_MAP[category] ?? GROUP_IMAGE_MAP['Wellness - Thriving']),
    };
  });
};

export const fetchUserJoinedGroupIds = async (userId: string): Promise<string[]> => {
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
      depressionScore:     qs.depressionScore ?? 0,
      anxietyScore:        qs.anxietyScore ?? 0,
      stressScore:         qs.stressScore ?? 0,
      classificationLevel: classificationFromCategory(activeCategory),
      groupCategory:       activeCategory,
    };
  }

  // Legacy flat structure — pass through as-is
  return data as MentalHealthProfile;
};

// ─── Group Recommendation Logic ───────────────────────────────────────────────

// Secondary categories shown when primary matches are insufficient
const RELATED_CATEGORIES: Record<GroupCategory, GroupCategory[]> = {
  'Severe Support':               ['Moderate Support'],
  'Moderate Support':             ['Recovery & Improvement'],
  'Mild Support':                 ['Recovery & Improvement', 'Wellness - Thriving'],
  'Wellness - Stress Aware':      ['Wellness - Thriving', 'Recovery & Improvement'],
  'Wellness - Emotionally Aware': ['Wellness - Thriving', 'Recovery & Improvement'],
  'Wellness - Thriving':          ['Recovery & Improvement'],
  'Recovery & Improvement':       ['Mild Support', 'Wellness - Thriving'],
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
  { id: 1,  text: 'I found it hard to wind down', subscale: 'stress' },
  { id: 2,  text: 'I was aware of dryness of my mouth', subscale: 'anxiety' },
  { id: 3,  text: "I couldn't seem to experience any positive feeling at all", subscale: 'depression' },
  { id: 4,  text: 'I experienced breathing difficulty (rapid breathing, breathlessness)', subscale: 'anxiety' },
  { id: 5,  text: 'I found it difficult to work up the initiative to do things', subscale: 'depression' },
  { id: 6,  text: 'I tended to over-react to situations', subscale: 'stress' },
  { id: 7,  text: 'I experienced trembling (e.g., in the hands)', subscale: 'anxiety' },
  { id: 8,  text: 'I felt that I was using a lot of nervous energy', subscale: 'stress' },
  { id: 9,  text: 'I was worried about situations in which I might panic and make a fool of myself', subscale: 'anxiety' },
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
  if (score <= 9)  return { severity: 'Normal',           color: '#43A047' };
  if (score <= 13) return { severity: 'Mild',             color: '#F9A825' };
  if (score <= 20) return { severity: 'Moderate',         color: '#FB8C00' };
  if (score <= 27) return { severity: 'Severe',           color: '#E53935' };
  return               { severity: 'Extremely Severe', color: '#B71C1C' };
}

function anxSev(score: number): { severity: string; color: string } {
  if (score <= 7)  return { severity: 'Normal',           color: '#43A047' };
  if (score <= 9)  return { severity: 'Mild',             color: '#F9A825' };
  if (score <= 14) return { severity: 'Moderate',         color: '#FB8C00' };
  if (score <= 19) return { severity: 'Severe',           color: '#E53935' };
  return               { severity: 'Extremely Severe', color: '#B71C1C' };
}

function strSev(score: number): { severity: string; color: string } {
  if (score <= 14) return { severity: 'Normal',           color: '#43A047' };
  if (score <= 18) return { severity: 'Mild',             color: '#F9A825' };
  if (score <= 25) return { severity: 'Moderate',         color: '#FB8C00' };
  if (score <= 33) return { severity: 'Severe',           color: '#E53935' };
  return               { severity: 'Extremely Severe', color: '#B71C1C' };
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
  const anxiety:    Dass21SubscaleResult = { raw: anxRaw, final: anxFinal, severity: aS.severity, severityColor: aS.color };
  const stress:     Dass21SubscaleResult = { raw: strRaw, final: strFinal, severity: sS.severity, severityColor: sS.color };

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
  });
  return docRef.id;
};

export const subscribeGroupMessages = (
  groupId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'peer_groups', groupId, 'chatMessages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(q, snapshot => {
    const messages: Message[] = snapshot.docs.map(d => ({
      id: d.id,
      text: d.data().text,
      sender: 'peer',
      senderId: d.data().senderId as string,
      senderName: d.data().senderName as string,
      timestamp: (d.data().timestamp as Timestamp).toDate(),
      flagged: d.data().flagged ?? false,
    }));
    callback(messages);
  });
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
  anxiety:    'Wellness - Stress Aware',
  normal:     'Wellness - Thriving',
};

export const getGroupsByMlPrediction = (groups: Group[], prediction: string): Group[] => {
  const category = ML_TO_PRIMARY_CATEGORY[prediction] ?? ML_TO_PRIMARY_CATEGORY['normal'];
  const matched = groups.filter(g => g.category === category);
  return matched.length > 0 ? matched : groups;
};

// Returns the single GroupCategory that corresponds to an ML dominant category string.
export const getMlGroupCategory = (dominantCategory: string): GroupCategory =>
  ML_TO_PRIMARY_CATEGORY[dominantCategory] ?? 'Wellness - Thriving';

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
    authorInitials: getVal(['authorInitials', 'author_initials']) as string | undefined,
    type: data.type as string | undefined,
    content: data.content as string | undefined,
    url: data.url as string | undefined,
    createdAt: (data.createdAt ?? data.created_at ?? data.timestamp ? (data.createdAt ?? data.created_at ?? data.timestamp).toDate() : new Date()),
  };
};

export const fetchResources = async (category?: string): Promise<Resource[]> => {
  const ref = collection(db, 'resources');
  const q = category
    ? query(ref, where('category', '==', category))
    : query(ref);
  const snap = await getDocs(q);
  return snap.docs
    .map(mapResourceDoc)
    .filter(r => r.isActive !== false)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

  if (!baselineCategory || baselineCategory === activeCategory) return primary;

  const primaryIds = new Set(primary.map(r => r.id));
  const baseline = (await fetchByCategory(baselineCategory)).filter(
    r => !primaryIds.has(r.id),
  );

  return [...primary, ...baseline];
};

// Realtime listener that emits the active + baseline recommendation categories
// from mentalHealthProfile/currentProfile whenever they change.
export const listenToUserRecommendationCategory = (
  userId: string,
  callback: (categories: { active: GroupCategory | null; baseline: GroupCategory | null }) => void,
): (() => void) => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  return onSnapshot(profileRef, snap => {
    if (!snap.exists()) {
      callback({ active: null, baseline: null });
      return;
    }
    const raw = snap.data();
    callback({
      active: (raw.activeRecommendationCategory as GroupCategory) ?? null,
      baseline: (raw.baselineRecommendationCategory as GroupCategory) ?? null,
    });
  });
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

// ─── KNN Input Builder (prepared for future KNN model — not executed yet) ────

export const buildKnnInput = (
  dass21Result: Dass21Result | null,
  mlProfile: MlMentalHealthProfile
): KnnInput => {
  const dassScore = dass21Result
    ? dass21Result.depression.final + dass21Result.anxiety.final + dass21Result.stress.final
    : 0;
  return {
    dassScore,
    latestPrediction: mlProfile.latestPrediction,
    dominantCategory: mlProfile.dominantCategory,
    depressionCount: mlProfile.depressionCount,
    anxietyCount: mlProfile.anxietyCount,
    normalCount: mlProfile.normalCount,
    preferredGroupCategory: ML_CATEGORY_MAP[mlProfile.dominantCategory] ?? 'General Wellbeing',
  };
};

// ─── Realtime ML Mental Health Profile Listener ───────────────────────────────

// Attaches an onSnapshot listener to the user document and extracts the
// mlMentalHealthProfile field. Fires immediately with current data, then
// again whenever the field changes (e.g. after a new journal entry is saved).
// Returns an unsubscribe function — call it in a useEffect cleanup.
export const subscribeToMlMentalHealthProfile = (
  userId: string,
  callback: (profile: MlMentalHealthProfile | null) => void
): (() => void) => {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
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
  });
};

// ─── Recommendation Category Logic ───────────────────────────────────────────

// Maps a DASS subscale condition + severity level to a GroupCategory.
// Also used for ML predictions: pass the BERT prediction label as condition
// and a severity derived from confidence (see ML_DEFAULT_SEVERITY below).
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

// Default severity used when mapping ML BERT prediction labels through buildRecommendationCategory.
// depression → Moderate Support, anxiety → Wellness - Stress Aware, normal → Wellness - Thriving
const ML_DEFAULT_SEVERITY: Record<string, string> = {
  depression: 'Moderate',
  anxiety: 'Mild',
  normal: 'Normal',
};

const ML_CONFIDENCE_THRESHOLD = 0.80;

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
      anxietyScore:    dass21Result.anxiety.final,
      stressScore:     dass21Result.stress.final,
      totalScore,
      mainCondition,
      category:        mainSeverity,
      completedAt:     Timestamp.now(),
    },
    latestMlEmotionScore:           null,
    baselineRecommendationCategory: baselineCategory,
    activeRecommendationCategory:   baselineCategory,
    recommendationSource:           'questionnaire',
    userStatus,
  }, { merge: true });
};

// Updates the recommendation profile when a new ML emotion analysis result arrives.
// High-confidence results update activeRecommendationCategory unless the DASS
// baseline is Severe Support, in which case the user is flagged for review instead.
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
  const baselineCategory: GroupCategory =
    existing?.baselineRecommendationCategory ?? 'Wellness - Thriving';
  const isSevereBaseline = baselineCategory === 'Severe Support';

  const latestMlEmotionScore = {
    prediction: mlResult.prediction,
    confidence: mlResult.confidence,
    probabilities: mlResult.probabilities,
    recordedAt: Timestamp.now(),
  };

  const mlCategory = buildRecommendationCategory(
    mlResult.prediction,
    ML_DEFAULT_SEVERITY[mlResult.prediction] ?? 'Normal'
  );

  const update: Record<string, any> = {
    latestMlEmotionScore,
    lastUpdated: Timestamp.now(),
  };

  if (mlResult.confidence >= ML_CONFIDENCE_THRESHOLD) {
    if (isSevereBaseline) {
      // Do not auto-downgrade a DASS-severe user; flag for advisor review
      update['userStatus'] = 'under_review';
    } else {
      update['activeRecommendationCategory'] = mlCategory;
      update['recommendationSource'] = 'ml_analysis';
      update['userStatus'] = 'normal';
    }
  } else {
    // Low confidence — revert to questionnaire baseline
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
      anxietyScore:    dass21Result.anxiety.final,
      stressScore:     dass21Result.stress.final,
      totalScore,
      mainCondition,
      category:        mainSeverity,
      completedAt:     Timestamp.now(),
    },
    latestMlEmotionScore:           null,
    baselineRecommendationCategory: baselineCategory,
    activeRecommendationCategory:   baselineCategory,
    recommendationSource:           'questionnaire',
    userStatus,
  }, { merge: true });
};

// ML prediction → GroupCategory for recommendation updates.
// depression/anxiety both map to Moderate Support (ML has no severity signal).
// normal maps to Wellness - Thriving.
const ML_EMOTION_TO_CATEGORY: Record<string, GroupCategory> = {
  depression: 'Moderate Support',
  anxiety:    'Moderate Support',
  normal:     'Wellness - Thriving',
};

// Updates the recommendation profile when a new ML result arrives.
// Requires questionnaire to have been completed first (no-ops otherwise).
// High-confidence results update activeRecommendationCategory; severe baseline
// users are flagged for review instead of being auto-downgraded.
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
  const isSevereBaseline = baselineCategory === 'Severe Support';

  const latestMlEmotionScore = {
    prediction:    mlResult.prediction,
    confidence:    mlResult.confidence,
    probabilities: mlResult.probabilities,
    recordedAt:    Timestamp.now(),
  };

  const update: Record<string, any> = { latestMlEmotionScore, lastUpdated: Timestamp.now() };

  if (mlResult.confidence >= ML_CONFIDENCE_THRESHOLD) {
    if (isSevereBaseline) {
      update['userStatus'] = 'under_review';
    } else {
      update['activeRecommendationCategory'] = ML_EMOTION_TO_CATEGORY[mlResult.prediction] ?? 'Wellness - Thriving';
      update['recommendationSource'] = 'ml_analysis';
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
        anxietyScore:    qs.anxietyScore ?? 0,
        stressScore:     qs.stressScore ?? 0,
        totalScore:      qs.totalScore ?? 0,
        mainCondition:   qs.mainCondition ?? '',
        category:        qs.category ?? 'Normal',
        completedAt:     qs.completedAt?.toDate() ?? new Date(),
      },
      latestMlEmotionScore: raw.latestMlEmotionScore
        ? {
            prediction:       raw.latestMlEmotionScore.prediction,
            confidence:       raw.latestMlEmotionScore.confidence,
            probabilities:    raw.latestMlEmotionScore.probabilities,
            recordedAt:       raw.latestMlEmotionScore.recordedAt?.toDate() ?? new Date(),
            analyzedAt:       raw.latestMlEmotionScore.analyzedAt?.toDate(),
            sourceTextsUsed:  raw.latestMlEmotionScore.sourceTextsUsed,
          }
        : null,
      baselineRecommendationCategory: raw.baselineRecommendationCategory ?? 'Wellness - Thriving',
      activeRecommendationCategory:   raw.activeRecommendationCategory ?? 'Wellness - Thriving',
      recommendationSource:           raw.recommendationSource ?? 'questionnaire',
      userStatus:                     raw.userStatus ?? 'normal',
      mlStabilityCounter: rawCounter
        ? {
            lastPrediction: rawCounter.lastPrediction ?? 'normal',
            repeatedCount:  rawCounter.repeatedCount ?? 0,
            lastUpdatedAt:  rawCounter.lastUpdatedAt?.toDate() ?? new Date(),
          }
        : null,
    });
  });
};

// Alias for subscribeToRecommendationProfile — preferred name for feature code.
export const listenToMentalHealthProfile = (
  userId: string,
  callback: (profile: MentalHealthRecommendationProfile | null) => void
): (() => void) => subscribeToRecommendationProfile(userId, callback);

// ─── ML Recommendation Order & Wellness Score ─────────────────────────────────

// Ordered from lowest risk (best) to highest risk (worst).
// Severe Support is intentionally excluded — it is only set by questionnaire baseline
// and cannot be auto-assigned or transitioned into via ML analysis.
export const ML_RECOMMENDATION_ORDER: GroupCategory[] = [
  'Wellness - Thriving',
  'Wellness - Stress Aware',
  'Wellness - Emotionally Aware',
  'Recovery & Improvement',
  'Mild Support',
  'Moderate Support',
];

const WELLNESS_SCORE_MAP: Record<GroupCategory, number> = {
  'Wellness - Thriving':          100,
  'Wellness - Stress Aware':      85,
  'Wellness - Emotionally Aware': 75,
  'Recovery & Improvement':       65,
  'Mild Support':                 50,
  'Moderate Support':             35,
  'Severe Support':               20,
};

export const calculateWellnessScore = (category: GroupCategory): number =>
  WELLNESS_SCORE_MAP[category] ?? 50;

// ─── Stability-based Category Transition ─────────────────────────────────────

// normal prediction → improving (move toward lower risk)
// depression/anxiety prediction → worsening (move toward higher risk)
const ML_PREDICTION_DIRECTION: Record<string, 'improve' | 'worsen'> = {
  normal:     'improve',
  depression: 'worsen',
  anxiety:    'worsen',
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

  // Category only changes after 3 consecutive confident same-direction predictions
  if (repeatedCount < 3) {
    return { newCategory: currentCategory, newCounter, changed: false };
  }

  const currentIndex = ML_RECOMMENDATION_ORDER.indexOf(currentCategory);
  if (currentIndex === -1) {
    // Severe Support or unknown — do not auto-transition
    return { newCategory: currentCategory, newCounter, changed: false };
  }

  const direction = ML_PREDICTION_DIRECTION[mlResult.prediction] ?? 'improve';
  const newIndex = direction === 'improve'
    ? Math.max(0, currentIndex - 1)
    : Math.min(ML_RECOMMENDATION_ORDER.length - 1, currentIndex + 1);

  const newCategory = ML_RECOMMENDATION_ORDER[newIndex];
  const changed = newCategory !== currentCategory;

  if (changed) newCounter.repeatedCount = 0;

  return { newCategory, newCounter, changed };
};

// ─── ML Text Collection Functions ─────────────────────────────────────────────

export const fetchUserJournalTexts = async (userId: string): Promise<string[]> => {
  const q = query(
    collection(db, 'users', userId, 'journal_entries'),
    orderBy('date', 'desc'),
    limit(5)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data().content as string)
    .filter(text => text && text.trim().length > 10);
};

export const fetchUserGroupChatTexts = async (userId: string): Promise<string[]> => {
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

  return results.flatMap(snap =>
    snap.docs
      .map(d => d.data().text as string)
      .filter(text => text && text.trim().length > 10)
  );
};

export const fetchUserAiChatTexts = async (userId: string): Promise<string[]> => {
  const q = query(
    collection(db, 'users', userId, 'aiChatMessages'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data().text as string)
    .filter(text => text && text.trim().length > 10);
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

  const texts = [...journalTexts, ...groupTexts, ...aiTexts].filter(t => t.trim().length > 10);
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
  sourceTextsUsed: string[] = []
): Promise<void> => {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  if (!snap.exists() || !snap.data()?.initialQuestionnaireScore) return;

  const existing = snap.data();
  const baselineCategory: GroupCategory = existing.baselineRecommendationCategory ?? 'Wellness - Thriving';
  const isSevereBaseline = baselineCategory === 'Severe Support';
  const currentCategory: GroupCategory = existing.activeRecommendationCategory ?? baselineCategory;

  const rawCounter = existing.mlStabilityCounter;
  const counter: MlStabilityCounter | null = rawCounter
    ? {
        lastPrediction: rawCounter.lastPrediction,
        repeatedCount:  rawCounter.repeatedCount,
        lastUpdatedAt:  rawCounter.lastUpdatedAt?.toDate() ?? new Date(),
      }
    : null;

  const latestMlEmotionScore = {
    prediction:      mlResult.prediction,
    confidence:      mlResult.confidence,
    probabilities:   mlResult.probabilities,
    recordedAt:      Timestamp.now(),
    analyzedAt:      Timestamp.now(),
    sourceTextsUsed,
  };

  const update: Record<string, any> = {
    latestMlEmotionScore,
    lastUpdated: Timestamp.now(),
  };

  if (isSevereBaseline) {
    update['userStatus'] = 'under_review';
    const isSame = counter?.lastPrediction === mlResult.prediction;
    update['mlStabilityCounter'] = {
      lastPrediction: mlResult.prediction,
      repeatedCount:  isSame ? (counter!.repeatedCount + 1) : 1,
      lastUpdatedAt:  Timestamp.now(),
    };
  } else {
    const { newCategory, newCounter, changed } = updateCategoryWithStabilityRules(
      currentCategory, mlResult, counter
    );

    update['mlStabilityCounter'] = {
      lastPrediction: newCounter.lastPrediction,
      repeatedCount:  newCounter.repeatedCount,
      lastUpdatedAt:  Timestamp.now(),
    };

    if (changed) {
      update['activeRecommendationCategory'] = newCategory;
      update['recommendationSource'] = 'ml_analysis';
    }
    update['userStatus'] = 'normal';
  }

  await updateDoc(profileRef, update);
};

// ─── Trigger Full Batch ML Analysis ───────────────────────────────────────────

export const triggerBatchMlAnalysis = async (userId: string): Promise<void> => {
  const { texts, sources } = await collectUserMlTextBatch(userId);
  const mlResult = await runMlAnalysis(texts);
  if (mlResult) {
    await updateMentalHealthProfileFromMl(userId, mlResult, sources);
  }
};
