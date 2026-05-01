import { Group, Dass21Result, Dass21SubscaleResult } from '../types';

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
    name: 'Anxiety Support Circle',
    description: 'A safe space to discuss anxiety and coping mechanisms.',
    members: 124,
    category: 'Anxiety',
    image: require('../assets/group_image1.jpg'),
  },
  {
    id: '2',
    name: 'Hope Harbor',
    description: 'Supporting each other through depression and low moods.',
    members: 89,
    category: 'Depression',
    image: require('../assets/group_image4.jpeg'),
  },
  {
    id: '3',
    name: 'Stress Busters',
    description: 'Tips and support for managing daily stress and burnout.',
    members: 210,
    category: 'Stress',
    image: require('../assets/group_image5.png'),
  },
  {
    id: '4',
    name: 'Mindful Moments',
    description: 'Practicing mindfulness and meditation together.',
    members: 156,
    category: 'General',
    image: require('../assets/group_image3.png'),
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
  let groupLabel: string;
  let groupColor: string;
  let message: string;
  let ctaLabel: string;
  let ctaVariant: Dass21Result['ctaVariant'];
  let reassessInDays: number;
  let riskLevel: Dass21Result['riskLevel'];

  if (hasExtSev) {
    group = 1; groupLabel = 'EXTREMELY SEVERE'; groupColor = '#B71C1C';
    message = "We've detected significant distress. We strongly recommend speaking with a professional advisor immediately.";
    ctaLabel = 'Connect with Advisor'; ctaVariant = 'danger'; reassessInDays = 14; riskLevel = 'severe';
  } else if (severeCount >= 1) {
    group = 2; groupLabel = 'SEVERE'; groupColor = '#E53935';
    message = "We've detected significant distress. We recommend speaking with a professional advisor immediately.";
    ctaLabel = 'Connect with Advisor'; ctaVariant = 'danger'; reassessInDays = 14; riskLevel = 'severe';
  } else if (maxRank >= 2) {
    group = 3; groupLabel = 'MODERATE'; groupColor = '#FB8C00';
    message = "You're experiencing moderate levels of stress, anxiety, or depression. Let's build a plan to support you.";
    ctaLabel = 'View Your Plan'; ctaVariant = 'warning'; reassessInDays = 30; riskLevel = 'moderate';
  } else if (maxRank >= 1) {
    group = 4; groupLabel = 'MILD'; groupColor = '#F9A825';
    message = "You have mild symptoms. Some self-care and mindfulness practices can make a big difference.";
    ctaLabel = 'View Your Plan'; ctaVariant = 'success'; reassessInDays = 60; riskLevel = 'low';
  } else {
    group = 5; groupLabel = 'MINIMAL / NORMAL'; groupColor = '#43A047';
    message = "Great news! Your mental wellness looks good. Keep up your healthy habits.";
    ctaLabel = 'View Your Plan'; ctaVariant = 'success'; reassessInDays = 90; riskLevel = 'low';
  }

  return { answers, depression, anxiety, stress, group, groupLabel, groupColor, message, ctaLabel, ctaVariant, reassessInDays, riskLevel };
}
