export interface GroupCall {
  id: string;
  groupId: string;
  advisorId: string;
  advisorName: string;
  title: string;
  roomUrl: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduledAt: any | null;  // Firestore Timestamp
  startedAt: any | null;
  endedAt: any | null;
  createdAt: any;
}
