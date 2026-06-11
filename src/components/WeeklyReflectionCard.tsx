import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchWeeklySummary, WeeklySummary } from '../services/gamificationApiService';
import { getIcon } from './BadgeAwardToast';

interface StatPillProps {
  icon: string;
  label: string;
  value: number;
}

const StatPill: React.FC<StatPillProps> = ({ icon, label, value }) => (
  <View style={styles.statPill}>
    <Text style={styles.statPillIcon}>{icon}</Text>
    <Text style={styles.statPillValue}>{value}</Text>
    <Text style={styles.statPillLabel}>{label}</Text>
  </View>
);

interface Props {
  uid: string;
}

export const WeeklyReflectionCard: React.FC<Props> = ({ uid }) => {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchWeeklySummary(uid).then(setSummary);
  }, [uid]);

  if (!summary) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.weekTitle}>📅 Your Week in Review</Text>
      <Text style={styles.weekMessage}>{summary.weekMessage}</Text>
      <View style={styles.statsRow}>
        <StatPill icon="⭐" label="Check-ins" value={summary.checkInsThisWeek} />
        <StatPill icon="📓" label="Journal entries" value={summary.journalEntriesThisWeek} />
        <StatPill icon="🏅" label="Badges" value={summary.badgesEarnedThisWeek.length} />
      </View>
      {summary.badgesEarnedThisWeek.length > 0 && (
        <View style={styles.newBadges}>
          <Text style={styles.newBadgesTitle}>New this week:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {summary.badgesEarnedThisWeek.map(b => (
              <View key={b.badgeId} style={styles.badgePill}>
                <Text>{getIcon(b.iconName)}</Text>
                <Text style={styles.badgePillName}>{b.badgeName}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
    margin: 12,
    gap: 12,
  },
  weekTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  weekMessage: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statPillIcon: { fontSize: 16 },
  statPillValue: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  statPillLabel: { fontSize: 10, color: '#6E6E6E', textAlign: 'center' },
  newBadges: { gap: 8 },
  newBadgesTitle: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  badgePillName: { fontSize: 12, fontWeight: '600', color: '#1A1A2E' },
});
