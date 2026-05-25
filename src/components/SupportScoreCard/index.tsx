import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BADGES, POINTS, SCORE_DESCRIPTOR } from '../../constants/badges';
import { BadgeItem } from './BadgeItem';

const PRIMARY = '#0B1F5B';

interface Props {
  supportScore: number;
  earnedBadges: string[];
}

export const SupportScoreCard: React.FC<Props> = ({ supportScore, earnedBadges }) => {
  const replyCount = Math.floor(supportScore / POINTS.SUPPORTIVE_REPLY);
  const earnedCount = earnedBadges.length;
  const allEarned = BADGES.every(b => earnedBadges.includes(b.id));

  const nextSupportBadge = BADGES
    .filter(b => b.unlockCondition === 'supportive_replies' && !earnedBadges.includes(b.id))
    .sort((a, b) => a.threshold - b.threshold)[0];

  const dass21Done = earnedBadges.includes('first_steps');

  let nextLine: React.ReactElement | null = null;
  if (allEarned) {
    nextLine = (
      <Text style={styles.allEarned}>
        🎉 All badges earned. Thank you for being part of this community.
      </Text>
    );
  } else if (!dass21Done) {
    nextLine = (
      <Text style={styles.nextLabel}>
        Next: Complete DASS-21 for 🌱 First Steps
      </Text>
    );
  } else if (nextSupportBadge) {
    const progress = Math.min(replyCount, nextSupportBadge.threshold);
    nextLine = (
      <>
        <Text style={styles.nextLabel}>
          Next: {nextSupportBadge.threshold} supportive replies for {nextSupportBadge.emoji} {nextSupportBadge.name}
        </Text>
        <Text style={styles.progressLabel}>
          Progress: {progress} / {nextSupportBadge.threshold}
        </Text>
      </>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>SUPPORT SCORE</Text>

      <Text style={styles.score}>{supportScore}</Text>
      <Text style={styles.descriptor}>{SCORE_DESCRIPTOR(supportScore)}</Text>

      <View style={styles.divider} />

      <Text style={styles.badgesLabel}>Badges Earned ({earnedCount} of 5)</Text>

      <View style={styles.badgesRow}>
        {BADGES.map(badge => (
          <BadgeItem
            key={badge.id}
            badge={badge}
            earned={earnedBadges.includes(badge.id)}
          />
        ))}
      </View>

      {nextLine}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  score: {
    fontSize: 42,
    fontWeight: '700',
    color: PRIMARY,
    lineHeight: 48,
  },
  descriptor: {
    fontSize: 14,
    color: '#4B5563',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  badgesLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  nextLabel: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  progressLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  allEarned: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
});
