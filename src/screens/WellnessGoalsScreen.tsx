import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import {
  COLORS,
  ML_CATEGORY_MAP,
  subscribeToMlMentalHealthProfile,
  listenToMentalHealthProfile,
  calculateWellnessScore,
} from '../services/dataService';
import { MlMentalHealthProfile, MentalHealthRecommendationProfile } from '../types';
// DEV-only dashboard — tree-shaken in production by the __DEV__ guard below
import { MLDiagnosticDashboard } from '../components/DevDashboard/MLDiagnosticDashboard';

const INSIGHT_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  depression: { accent: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: '#EF4444' },
  anxiety:    { accent: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: '#F59E0B' },
  normal:     { accent: '#22C55E', bg: 'rgba(34,197,94,0.08)',  border: '#22C55E' },
};

const formatRelativeTime = (date: Date): string => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const WellnessGoalsScreen = () => {
  const { user } = useApp();
  const navigation = useNavigation();

  const [mlInsight, setMlInsight] = useState<MlMentalHealthProfile | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [recommendationProfile, setRecommendationProfile] = useState<MentalHealthRecommendationProfile | null>(null);

  // ── DEV dashboard toggle (only wired up when __DEV__ is true) ─────────────
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  const toggleDev = useCallback(() => {
    if (isDashboardOpen) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0,   duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => setIsDashboardOpen(false));
    } else {
      setIsDashboardOpen(true);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [isDashboardOpen, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToMlMentalHealthProfile(user.id, (profile) => {
      setMlInsight(profile);
      setInsightLoading(false);
    });
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToMentalHealthProfile(user.id, (profile) => {
      setRecommendationProfile(profile);
    });
    return unsub;
  }, [user?.id]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wellness Goals</Text>
        {__DEV__ ? (
          <TouchableOpacity onPress={toggleDev} style={styles.devBadge}>
            <Text style={styles.devBadgeText}>{isDashboardOpen ? '✕ DEV' : 'DEV'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Wellbeing Insight Card */}
      {insightLoading ? (
        <Card style={styles.insightCard}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={styles.insightLoadingText}>Loading insight…</Text>
        </Card>
      ) : !mlInsight ? (
        <Card style={styles.insightCard}>
          <Ionicons name="sparkles-outline" size={22} color={COLORS.muted} />
          <Text style={styles.insightEmptyText}>No journal insights yet</Text>
          <Text style={styles.insightEmptySubText}>
            Write a journal entry to see your emotion pattern here.
          </Text>
        </Card>
      ) : (() => {
        const palette = INSIGHT_COLORS[mlInsight.dominantCategory] ?? INSIGHT_COLORS['normal'];
        const categoryLbl = ML_CATEGORY_MAP[mlInsight.latestPrediction] ?? mlInsight.latestPrediction;
        const dominantLabel = ML_CATEGORY_MAP[mlInsight.dominantCategory] ?? mlInsight.dominantCategory;
        const activeCategory = recommendationProfile?.activeRecommendationCategory;
        const wellnessScore = activeCategory ? calculateWellnessScore(activeCategory) : null;
        return (
          <Card style={[styles.insightCard, { borderLeftColor: palette.border, borderLeftWidth: 4 }]}>
            <View style={styles.insightHeader}>
              <View style={styles.insightHeaderLeft}>
                <Ionicons name="sparkles" size={14} color={palette.accent} />
                <Text style={[styles.insightTitle, { color: palette.accent }]}>WELLBEING INSIGHT</Text>
              </View>
              <Text style={styles.insightTime}>{formatRelativeTime(mlInsight.lastUpdated)}</Text>
            </View>

            {wellnessScore !== null && (
              <View style={styles.wellnessScoreRow}>
                <View style={styles.wellnessScoreLeft}>
                  <Text style={styles.insightFieldLabel}>Mental Wellness Score</Text>
                  <Text style={[styles.wellnessScoreValue, { color: palette.accent }]}>
                    {wellnessScore}%
                  </Text>
                </View>
                <View style={styles.wellnessScoreRight}>
                  <Text style={styles.insightFieldLabel}>Category</Text>
                  <Text style={[styles.dominantValue, { color: palette.accent }]} numberOfLines={2}>
                    {activeCategory}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.insightMainRow}>
              <View style={styles.insightMainLeft}>
                <Text style={styles.insightFieldLabel}>Latest Emotion</Text>
                <View style={[styles.emotionBadge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.emotionBadgeText, { color: palette.accent }]}>
                    {categoryLbl}
                  </Text>
                </View>
              </View>
              <View style={styles.insightMainRight}>
                <Text style={styles.insightFieldLabel}>Dominant Pattern</Text>
                <Text style={[styles.dominantValue, { color: palette.accent }]}>{dominantLabel}</Text>
              </View>
            </View>

            <View style={styles.countsRow}>
              <View style={[styles.countChip, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                <Text style={styles.countChipLabel}>Depression</Text>
                <Text style={[styles.countChipValue, { color: '#EF4444' }]}>{mlInsight.depressionCount}</Text>
              </View>
              <View style={[styles.countChip, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                <Text style={styles.countChipLabel}>Anxiety</Text>
                <Text style={[styles.countChipValue, { color: '#F59E0B' }]}>{mlInsight.anxietyCount}</Text>
              </View>
              <View style={[styles.countChip, { backgroundColor: 'rgba(34,197,94,0.08)' }]}>
                <Text style={styles.countChipLabel}>Normal</Text>
                <Text style={[styles.countChipValue, { color: '#22C55E' }]}>{mlInsight.normalCount}</Text>
              </View>
            </View>

            <Text style={styles.insightDisclaimer}>
              AI suggestion only — not professional advice
            </Text>
          </Card>
        );
      })()}

      {/* ── DEV Dashboard — visible only in __DEV__ builds ─────────────────── */}
      {__DEV__ && isDashboardOpen && user && (
        <Animated.View
          style={{
            opacity:   fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <MLDiagnosticDashboard uid={user.id} />
        </Animated.View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  insightCard: { gap: 14, borderLeftWidth: 4, borderLeftColor: COLORS.accent },
  insightLoadingText: { fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 4 },
  insightEmptyText: { fontSize: 14, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginTop: 4 },
  insightEmptySubText: { fontSize: 12, color: COLORS.muted, textAlign: 'center', lineHeight: 18 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insightHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  insightTime: { fontSize: 10, color: COLORS.muted },
  wellnessScoreRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  wellnessScoreLeft: { flex: 1, gap: 4 },
  wellnessScoreRight: { flex: 1, gap: 4 },
  wellnessScoreValue: { fontSize: 32, fontWeight: 'bold' },
  insightMainRow: { flexDirection: 'row', gap: 12 },
  insightMainLeft: { flex: 1, gap: 6 },
  insightMainRight: { gap: 6, alignItems: 'center' },
  insightFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emotionBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  emotionBadgeText: { fontSize: 13, fontWeight: '700' },
  dominantValue: { fontSize: 14, fontWeight: '700' },
  countsRow: { flexDirection: 'row', gap: 8 },
  countChip: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', gap: 2 },
  countChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countChipValue: { fontSize: 20, fontWeight: 'bold' },
  insightDisclaimer: { fontSize: 10, color: COLORS.muted, textAlign: 'center', fontStyle: 'italic' },

  // DEV badge — shown only in __DEV__ builds, replaces the header spacer
  devBadge: {
    backgroundColor:   '#1a1a2e',
    borderWidth:       1,
    borderColor:       '#00FF88',
    borderRadius:      4,
    paddingHorizontal: 6,
    paddingVertical:   2,
    minWidth:          36,
    alignItems:        'center',
    justifyContent:    'center',
  },
  devBadgeText: {
    fontSize:    10,
    fontWeight:  '700',
    color:       '#00FF88',
    letterSpacing: 0.5,
  },
});
