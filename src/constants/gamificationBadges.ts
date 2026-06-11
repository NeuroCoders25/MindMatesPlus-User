// Mirrors the badge IDs the backend gamification service can award.
// Used to render the "All Badges" section — earned badges show unlocked,
// the rest show locked with a lock icon.

export interface BadgeCatalogEntry {
  badgeId: string;
  badgeName: string;
  description: string;
  iconName: string;
}

export const BADGE_CATALOG: BadgeCatalogEntry[] = [
  { badgeId: 'first_reflection',     badgeName: 'First Reflection',      iconName: 'journal',        description: 'Saved your first journal entry.' },
  { badgeId: 'reflection_routine',   badgeName: 'Reflection Routine',    iconName: 'streak',         description: 'Wrote journal entries on 5 days.' },
  { badgeId: 'getting_started',      badgeName: 'Getting Started',       iconName: 'questionnaire',  description: 'Completed the DASS-21.' },
  { badgeId: 'community_explorer',   badgeName: 'Community Explorer',    iconName: 'group',          description: 'Joined your first peer group.' },
  { badgeId: 'goal_setter',          badgeName: 'Goal Setter',           iconName: 'goal',           description: 'Created your first wellness goal.' },
  { badgeId: 'small_steps_matter',   badgeName: 'Small Steps Matter',    iconName: 'steps',          description: 'Completed 3 wellness goals.' },
  { badgeId: 'feedback_contributor', badgeName: 'Feedback Contributor',  iconName: 'feedback',       description: 'Submitted app feedback.' },
  { badgeId: 'welcome_back',         badgeName: 'Welcome Back',          iconName: 'return',         description: 'Returned after a break.' },
  { badgeId: 'check_in_7',           badgeName: 'Week of Wellness',      iconName: 'checkin',        description: 'Checked in 7 days in a row.' },
  { badgeId: 'peer_supporter_blue',     badgeName: 'Peer Supporter — Blue',     iconName: 'support_blue',     description: 'First supportive reply.' },
  { badgeId: 'peer_supporter_bronze',   badgeName: 'Peer Supporter — Bronze',   iconName: 'support_bronze',   description: '20 supportive replies.' },
  { badgeId: 'peer_supporter_silver',   badgeName: 'Peer Supporter — Silver',   iconName: 'support_silver',   description: '50 supportive replies.' },
  { badgeId: 'peer_supporter_gold',     badgeName: 'Peer Supporter — Gold',     iconName: 'support_gold',     description: '200 supportive replies.' },
  { badgeId: 'peer_supporter_platinum', badgeName: 'Peer Supporter — Platinum', iconName: 'support_platinum', description: '1000 supportive replies.' },
];
