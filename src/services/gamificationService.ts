import { doc, updateDoc, getDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { BADGES, POINTS, BadgeId } from '../constants/badges';

export const awardSupportPoints = async (userId: string): Promise<BadgeId | null> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { supportScore: increment(POINTS.SUPPORTIVE_REPLY) });

  const snap = await getDoc(userRef);
  const data = snap.data() ?? {};
  const newScore: number = typeof data.supportScore === 'number' ? data.supportScore : 0;
  const earnedBadges: string[] = Array.isArray(data.earnedBadges) ? data.earnedBadges : [];
  const newReplyCount = Math.floor(newScore / POINTS.SUPPORTIVE_REPLY);

  const supportBadges = BADGES
    .filter(b => b.unlockCondition === 'supportive_replies')
    .sort((a, b) => a.threshold - b.threshold);

  for (const badge of supportBadges) {
    if (badge.threshold === newReplyCount && !earnedBadges.includes(badge.id)) {
      await updateDoc(userRef, { earnedBadges: arrayUnion(badge.id) });
      return badge.id;
    }
  }

  return null;
};

export const awardJournalPoints = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), { supportScore: increment(POINTS.JOURNAL_ENTRY) });
};

export const unlockDass21Badge = async (userId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), { earnedBadges: arrayUnion('first_steps') });
};
