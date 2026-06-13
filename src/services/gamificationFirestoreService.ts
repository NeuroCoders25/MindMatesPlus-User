import {
  doc, collection, getDoc, getDocs, onSnapshot,
  setDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { GamificationProfile, Badge } from './gamificationApiService';

// ─── Path helpers ─────────────────────────────────────────────────────────────
// Stats : users/{uid}/gamification/stats  (dedicated subcollection doc)
// Badges: users/{uid}/badges/{badgeId}    (unchanged path)

const statsRef = (uid: string) =>
  doc(db, 'users', uid, 'gamification', 'stats');

const badgesColRef = (uid: string) =>
  collection(db, 'users', uid, 'badges');

const badgeDocRef = (uid: string, badgeId: string) =>
  doc(db, 'users', uid, 'badges', badgeId);

// ─── Real-time listeners ──────────────────────────────────────────────────────

export function subscribeGamificationStats(
  uid: string,
  callback: (stats: GamificationProfile | null) => void,
): () => void {
  return onSnapshot(
    statsRef(uid),
    snap => callback(snap.exists() ? (snap.data() as GamificationProfile) : null),
    err => { console.warn('gamification stats listener error:', err); callback(null); },
  );
}

export function subscribeBadges(
  uid: string,
  callback: (badges: Badge[]) => void,
): () => void {
  const q = query(badgesColRef(uid), orderBy('earnedAt', 'desc'));
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ badgeId: d.id, ...d.data() } as Badge))),
    err => { console.warn('badges listener error:', err); callback([]); },
  );
}

// ─── One-shot fetch (used where a live listener is not needed) ────────────────

export async function fetchGamificationData(
  uid: string,
): Promise<{ profile: GamificationProfile | null; badges: Badge[] }> {
  const [statsSnap, badgesSnap] = await Promise.all([
    getDoc(statsRef(uid)),
    getDocs(query(badgesColRef(uid), orderBy('earnedAt', 'desc'))),
  ]);
  return {
    profile: statsSnap.exists() ? (statsSnap.data() as GamificationProfile) : null,
    badges: badgesSnap.docs.map(d => ({ badgeId: d.id, ...d.data() } as Badge)),
  };
}

// ─── Sync helpers (optimistic writes after API trigger responses) ─────────────

export const syncGamificationStats = (uid: string, stats: Partial<GamificationProfile>) =>
  setDoc(statsRef(uid), stats, { merge: true });

export const syncBadge = (uid: string, badge: Badge) =>
  setDoc(badgeDocRef(uid, badge.badgeId), badge, { merge: true });
