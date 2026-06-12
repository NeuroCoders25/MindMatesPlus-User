import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { getIcon } from '../components/BadgeAwardToast';
import { BADGE_CATALOG } from '../constants/gamificationBadges';

const formatEarnedDate = (earnedAt: unknown): string => {
  const ts = earnedAt as { toDate?: () => Date } | string | number | null | undefined;
  const date =
    ts && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function'
      ? ts.toDate()
      : ts ? new Date(ts as string | number) : null;
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const AchievementsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { gamificationProfile, earnedBadges } = useApp();

  const earnedIds = new Set(earnedBadges.map(b => b.badgeId));
  const lockedBadges = BADGE_CATALOG.filter(b => !earnedIds.has(b.badgeId));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Achievements</Text>
        </View>

        {/* Daily streak banner */}
        {(gamificationProfile?.checkInStreak ?? 0) > 0 && (
          <View style={styles.streakBanner}>
            <View style={styles.streakBannerLeft}>
              <Text style={styles.streakBannerFire}>🔥</Text>
              <View>
                <Text style={styles.streakBannerValue}>{gamificationProfile!.checkInStreak} Day Streak</Text>
                <Text style={styles.streakBannerSub}>Keep checking in daily!</Text>
              </View>
            </View>
            <Ionicons name="flame" size={40} color="rgba(255,255,255,0.2)" />
          </View>
        )}

        {/* Stats card */}
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Your Journey 🌱</Text>
          <View style={styles.statsCardRow}>
            <View style={styles.statsCardItem}>
              <Text style={styles.statsCardValue}>{gamificationProfile?.totalPoints ?? 0}</Text>
              <Text style={styles.statsCardLabel}>Points</Text>
            </View>
            <View style={styles.statsCardDivider} />
            <View style={styles.statsCardItem}>
              <Text style={styles.statsCardValue}>{gamificationProfile?.journalStreak ?? 0}</Text>
              <Text style={styles.statsCardLabel}>Journal streak</Text>
            </View>
            <View style={styles.statsCardDivider} />
            <View style={styles.statsCardItem}>
              <Text style={styles.statsCardValue}>{gamificationProfile?.checkInStreak ?? 0}</Text>
              <Text style={styles.statsCardLabel}>Check-in streak</Text>
            </View>
          </View>
        </View>

        {/* Peer Supporter stat card */}
        <View style={styles.peerSupportCard}>
          <Text style={styles.peerSupportTitle}>Peer Supporter</Text>
          <Text style={styles.peerSupportCount}>
            🤝 Supportive replies: {gamificationProfile?.supportiveReplyCount ?? 0}
          </Text>
          {(gamificationProfile?.supporterDiscountPercent ?? 0) > 0 && (
            <Text style={styles.peerSupportDiscount}>
              Your current booking discount: {gamificationProfile!.supporterDiscountPercent}%
            </Text>
          )}
        </View>

        {/* Earned badges */}
        <Text style={styles.sectionTitle}>Earned Badges</Text>
        {earnedBadges.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Every step counts — your first badge is on its way.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {earnedBadges.map(badge => (
              <View key={badge.badgeId} style={styles.badgeCard}>
                <View style={styles.badgeIconCircle}>
                  <Text style={styles.badgeIconEmoji}>{getIcon(badge.iconName)}</Text>
                </View>
                <Text style={styles.badgeName} numberOfLines={1}>{badge.badgeName}</Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>{badge.description}</Text>
                <Text style={styles.badgeDate}>{formatEarnedDate(badge.earnedAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Locked badges */}
        {lockedBadges.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>All Badges</Text>
            <View style={styles.grid}>
              {lockedBadges.map(entry => (
                <View key={entry.badgeId} style={[styles.badgeCard, styles.badgeCardLocked]}>
                  <View style={[styles.badgeIconCircle, styles.badgeIconCircleLocked]}>
                    <Text style={styles.badgeIconEmoji}>🔒</Text>
                  </View>
                  <Text style={[styles.badgeName, styles.badgeNameLocked]} numberOfLines={1}>
                    {entry.badgeName}
                  </Text>
                  <Text style={styles.lockedLabel}>Locked</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },

  streakBanner: {
    backgroundColor: '#D97706',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  streakBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakBannerFire: { fontSize: 36 },
  streakBannerValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  streakBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  statsCard: {
    backgroundColor: '#4338CA',
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  statsCardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statsCardRow: { flexDirection: 'row', alignItems: 'center' },
  statsCardItem: { flex: 1, alignItems: 'center', gap: 4 },
  statsCardValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statsCardLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  statsCardDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  peerSupportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  peerSupportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  peerSupportCount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  peerSupportDiscount: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '600',
    marginTop: 2,
  },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard: {
    width: '47%',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  badgeCardLocked: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  badgeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconCircleLocked: { backgroundColor: '#E5E7EB' },
  badgeIconEmoji: { fontSize: 24 },
  badgeName: { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  badgeNameLocked: { color: COLORS.muted },
  badgeDesc: { fontSize: 11, color: COLORS.muted, textAlign: 'center', lineHeight: 16 },
  badgeDate: { fontSize: 10, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  lockedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
