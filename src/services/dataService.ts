import { Group } from '../types';

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

export const DASS_QUESTIONS = [
  "I found it hard to wind down",
  "I was aware of dryness of my mouth",
  "I couldn't seem to experience any positive feeling at all",
  "I experienced breathing difficulty",
  "I found it difficult to work up the initiative to do things",
  "I tended to over-react to situations",
  "I experienced trembling (e.g. in the hands)",
  "I felt that I was using a lot of nervous energy",
  "I was worried about situations in which I might panic",
  "I felt that I had nothing to look forward to",
];
