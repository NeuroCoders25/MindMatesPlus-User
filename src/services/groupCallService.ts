import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { GroupCall } from '../types/groupCall';

// NOTE: The `where("status", "in", [...]) + orderBy("createdAt", "desc")` combination
// requires a Firestore composite index that may not exist yet.
// To avoid that requirement, we drop `orderBy` from the query and sort client-side.
// When you're ready to restore server-side ordering, deploy firestore.indexes.json
// (at the project root) via `firebase deploy --only firestore:indexes`, then add
// `orderBy('createdAt', 'desc')` back to the query below.

/** Sort helper — newest first, tolerates missing/null timestamps. */
function byCreatedAtDesc(a: GroupCall, b: GroupCall): number {
  const aMs =
    a.createdAt && typeof a.createdAt.toMillis === 'function'
      ? a.createdAt.toMillis()
      : a.createdAt instanceof Date
      ? a.createdAt.getTime()
      : 0;
  const bMs =
    b.createdAt && typeof b.createdAt.toMillis === 'function'
      ? b.createdAt.toMillis()
      : b.createdAt instanceof Date
      ? b.createdAt.getTime()
      : 0;
  return bMs - aMs;
}

/**
 * Subscribes to active (live + scheduled) calls for a single peer group.
 * Results are sorted newest-first client-side (avoids composite index requirement).
 * Returns the Firestore unsubscribe function.
 */
export function subscribeGroupCalls(
  groupId: string,
  callback: (calls: GroupCall[]) => void,
): () => void {
  const q = query(
    collection(db, 'peer_groups', groupId, 'groupCalls'),
    where('status', 'in', ['live', 'scheduled']),
    // orderBy('createdAt', 'desc') — requires composite index; see note at top of file
  );

  return onSnapshot(
    q,
    snapshot => {
      const calls: GroupCall[] = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as Omit<GroupCall, 'id'>) }))
        .sort(byCreatedAtDesc);
      callback(calls);
    },
    err => {
      console.error('[GroupCallService] subscribeGroupCalls error:', err);
    },
  );
}

/**
 * Subscribes to active calls across multiple peer groups simultaneously.
 * Results are merged into a Record<groupId, GroupCall[]> and emitted
 * whenever any individual group listener updates.
 *
 * Returns a single cleanup function that tears down all listeners.
 */
export function subscribeAllGroupCalls(
  groupIds: string[],
  callback: (callsByGroup: Record<string, GroupCall[]>) => void,
): () => void {
  if (groupIds.length === 0) {
    callback({});
    return () => {};
  }

  // Shared mutable state — safe because all listeners run on the JS thread.
  const results: Record<string, GroupCall[]> = {};
  const unsubs: Array<() => void> = [];

  groupIds.forEach(groupId => {
    const unsub = subscribeGroupCalls(groupId, calls => {
      results[groupId] = calls;
      // Spread so React sees a new object reference and re-renders.
      callback({ ...results });
    });
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach(u => u());
  };
}

/**
 * Converts a Firestore Timestamp (or plain Date) to a readable string.
 * Examples: "Today at 3:00 PM" | "May 28 at 3:00 PM"
 */
export function formatCallTime(timestamp: any): string {
  let date: Date;

  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return 'Scheduled';
  }

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dateStr} at ${timeStr}`;
}
