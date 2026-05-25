export type BadgeId = 'first_steps' | 'first_hand' | 'kind_words' | 'steady_support' | 'lifeline';

export interface BadgeDefinition {
  id: BadgeId;
  emoji: string;
  name: string;
  description: string;
  unlockCondition: 'dass21_complete' | 'supportive_replies';
  threshold: number;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'first_steps',
    emoji: '🌱',
    name: 'First Steps',
    description: 'Completed the DASS-21 questionnaire',
    unlockCondition: 'dass21_complete',
    threshold: 1,
  },
  {
    id: 'first_hand',
    emoji: '🤝',
    name: 'First Hand',
    description: 'Sent your first supportive reply to a peer',
    unlockCondition: 'supportive_replies',
    threshold: 1,
  },
  {
    id: 'kind_words',
    emoji: '💬',
    name: 'Kind Words',
    description: '10 supportive replies to peers',
    unlockCondition: 'supportive_replies',
    threshold: 10,
  },
  {
    id: 'steady_support',
    emoji: '🫂',
    name: 'Steady Support',
    description: '25 supportive replies to peers',
    unlockCondition: 'supportive_replies',
    threshold: 25,
  },
  {
    id: 'lifeline',
    emoji: '🌟',
    name: 'Lifeline',
    description: '50 supportive replies to peers',
    unlockCondition: 'supportive_replies',
    threshold: 50,
  },
];

export const SCORE_DESCRIPTOR = (score: number): string => {
  if (score >= 100) return 'Trusted Supporter';
  if (score >= 50)  return 'Active Helper';
  if (score >= 20)  return 'Caring Voice';
  if (score >= 5)   return 'Getting Started';
  return 'New Member';
};

export const POINTS = {
  SUPPORTIVE_REPLY: 5,
  JOURNAL_ENTRY: 2,
  DASS21_RECHECK: 10,
};
