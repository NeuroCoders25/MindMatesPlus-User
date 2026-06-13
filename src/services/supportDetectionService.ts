import {
  collection, query, orderBy, where, limit,
  getDocs, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { BadgeId } from '../constants/badges';
import { awardSupportPoints } from './gamificationService';

const SUPPORTIVE_PATTERNS: RegExp[] = [
  /\b(i hear you|i feel you|i get it)\b/i,
  /\b(i('m| am) here|we('re| are) here|here for you)\b/i,
  /\b(you('re| are) not alone)\b/i,
  /\b(hang in there|stay strong|you got this|you('ve| have) got this)\b/i,
  /\b(sending (love|hugs)|take care|thinking of you)\b/i,
  /\b(believe in you|proud of you)\b/i,
  /\b(it('s| is) (okay|ok) to feel|your feelings (are valid|matter)|you matter)\b/i,
];

const SUPPORTIVE_EMOJIS = ['❤️', '🫂', '🤗', '💪', '🌟', '💙', '🙏', '💛'];

function isLikelySupportive(content: string): boolean {
  const words = content.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return false;

  if (SUPPORTIVE_PATTERNS.some(p => p.test(content))) return true;
  if (SUPPORTIVE_EMOJIS.some(e => content.includes(e))) return true;

  return false;
}

export async function evaluateSupportReply(
  groupId: string,
  replyMessageId: string,
  replyUserId: string,
  replyContent: string,
  replyTimestamp: Timestamp,
): Promise<{ awarded: boolean; newBadge: BadgeId | null }> {
  if (!isLikelySupportive(replyContent)) {
    return { awarded: false, newBadge: null };
  }

  const thirtyMinsAgoMs = replyTimestamp.toMillis() - 30 * 60 * 1000;

  const q = query(
    collection(db, 'peer_groups', groupId, 'chatMessages'),
    where('timestamp', '<', replyTimestamp),
    orderBy('timestamp', 'desc'),
    limit(5),
  );

  const snap = await getDocs(q);

  let distressedMsgId: string | null = null;
  for (const msgDoc of snap.docs) {
    const data = msgDoc.data();

    const msgTs = data.timestamp as Timestamp | undefined;
    if (!msgTs || msgTs.toMillis() < thirtyMinsAgoMs) break;

    if ((data.senderId as string | undefined) === replyUserId) continue;

    const bp = data.bertPrediction as { label: string; confidence: number } | undefined;
    if (!bp) continue;

    if (
      (bp.label === 'depression' || bp.label === 'anxiety') &&
      bp.confidence >= 0.70
    ) {
      distressedMsgId = msgDoc.id;
      break;
    }
  }

  if (!distressedMsgId) {
    return { awarded: false, newBadge: null };
  }

  const newBadge = await awardSupportPoints(replyUserId);

  await updateDoc(doc(db, 'peer_groups', groupId, 'chatMessages', replyMessageId), {
    detectedAsSupportive: true,
    inResponseToDistressedMsgId: distressedMsgId,
  });

  return { awarded: true, newBadge };
}
