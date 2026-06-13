export interface GuideStep {
  /** Unique identifier for this step */
  key: string;
  /** Human-readable title shown in the tooltip card */
  title: string;
  /** Body copy shown in the tooltip card */
  body: string;
  /**
   * Key that maps to a measured rect in GuideContext.targetRects.
   * Keys prefixed with "tab_" are estimated from screen dimensions
   * inside AppGuideOverlay; all others must be registered via registerTarget().
   */
  targetKey: string;
}

export const APP_GUIDE_STEPS: GuideStep[] = [
  {
    key: 'step_recommendations',
    targetKey: 'recommended_groups',
    title: 'View your recommendations',
    body: 'Based on your assessment, we recommend peer groups and helpful resources picked for you. These update as we get to know you better.',
  },
  {
    key: 'step_peer_groups',
    targetKey: 'groups_content',
    title: 'Join a Peer Group',
    body: "Join a peer group to chat with students who understand what you're going through. It's safe, moderated, and supportive.",
  },
  {
    key: 'step_listener',
    targetKey: 'listener_content',
    title: 'Your Listener',
    body: 'Talk anytime with Mindy, your free AI listener — or connect privately with an expert advisor when you need a human ear.',
  },
  {
    key: 'step_journal',
    targetKey: 'journal_content',
    title: 'Daily Journal',
    body: "Write daily journals. It's private — and it helps MindMates+ understand how you're really doing so we can support you better.",
  },
  {
    key: 'step_badges',
    targetKey: 'achievements_row',
    title: 'Badges & Rewards',
    body: 'Stay engaged to collect badges — they earn you discounts when booking counselor sessions.',
  },
  {
    key: 'step_feedback',
    targetKey: 'feedback_row',
    title: 'Your Feedback Matters',
    body: "Tell us how we're doing anytime. Your feedback shapes MindMates+.",
  },
];
