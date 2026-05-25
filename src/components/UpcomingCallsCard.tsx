import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GroupCall } from '../types/groupCall';
import { formatCallTime } from '../services/groupCallService';

interface Props {
  calls: GroupCall[];
  groupName: string;
}

export const UpcomingCallsCard: React.FC<Props> = ({ calls, groupName }) => {
  if (calls.length === 0) return null;

  return (
    <View style={styles.card}>
      {calls.map((call, index) => (
        <View key={call.id}>
          {index > 0 && <View style={styles.divider} />}
          <Text style={styles.groupLabel}>{groupName}</Text>
          <Text style={styles.callTitle}>{call.title}</Text>
          <Text style={styles.callTime}>{formatCallTime(call.scheduledAt)}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Join when live</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    gap: 4,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    // Android
    elevation: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  callTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  callTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
