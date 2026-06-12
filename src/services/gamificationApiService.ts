import Constants from 'expo-constants';

const BASE = Constants.expoConfig?.extra?.mlApiUrl ?? 'http://192.168.1.2:8000';

export interface Badge {
  badgeId: string;
  badgeName: string;
  description: string;
  iconName: string;
  earnedAt: any;
  points: number;
}

export interface GamificationProfile {
  checkInStreak: number;
  journalStreak: number;
  longestJournalStreak: number;
  totalPoints: number;
  lastCheckInDate: any;
  lastJournalDate: any;
  supportiveReplyCount?: number;
  supporterDiscountPercent?: number;
}

export interface WeeklySummary {
  checkInsThisWeek: number;
  journalEntriesThisWeek: number;
  badgesEarnedThisWeek: Badge[];
  currentJournalStreak: number;
  currentCheckInStreak: number;
  totalPoints: number;
  weekMessage: string;
}

async function post(path: string, body: object): Promise<any> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`gamification ${path} failed:`, e);
    return null;
  }
}

async function get(path: string): Promise<any> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`gamification ${path} failed:`, e);
    return null;
  }
}

export const triggerJournalSaved = (uid: string, entryCount: number) =>
  post('/gamification/journal-saved', { uid, entry_count: entryCount });

export const triggerCheckIn = (uid: string) =>
  post('/gamification/checkin', { uid });

export const triggerDass21Complete = (uid: string) =>
  post('/gamification/dass21-complete', { uid });

export const triggerGroupJoined = (uid: string) =>
  post('/gamification/group-joined', { uid });

export const triggerGoalCreated = (uid: string) =>
  post('/gamification/goal-created', { uid });

export const triggerGoalsCompleted = (uid: string, totalCompleted: number) =>
  post('/gamification/goals-completed', { uid, total_completed: totalCompleted });

export const triggerFeedbackSubmitted = (uid: string) =>
  post('/gamification/feedback-submitted', { uid });

export const triggerSupportiveReplyCheck = (params: {
  uid: string;
  originalSenderId: string;
  originalText: string;
  replyText: string;
}) =>
  post('/gamification/supportive-reply', {
    uid: params.uid,
    original_sender_id: params.originalSenderId,
    original_text: params.originalText,
    reply_text: params.replyText,
  });

export const fetchGamificationProfile = (uid: string) =>
  get(`/gamification/profile/${uid}`);

export const fetchWeeklySummary = (uid: string) =>
  get(`/gamification/weekly-summary/${uid}`);
