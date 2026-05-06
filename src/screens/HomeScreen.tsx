import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { COLORS, getRecommendedGroups, getGroupsByMlPrediction, getMlGroupCategory, ML_CATEGORY_MAP, subscribeToMlMentalHealthProfile } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group, MlMentalHealthProfile } from '../types';

// ─── Colour helpers for ML insight categories ─────────────────────────────────

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

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const { user, peerGroups, groupsLoading, mentalHealthProfile, joinedGroupIds, joinGroup, setSelectedGroup } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [mlInsight, setMlInsight] = useState<MlMentalHealthProfile | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  // Attach a realtime Firestore listener as soon as we have a logged-in user.
  // onSnapshot fires immediately with cached/current data, then again on any
  // change — so the card updates the moment a new journal entry is analysed.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToMlMentalHealthProfile(user.id, (profile) => {
      setMlInsight(profile);
      setInsightLoading(false);
    });
    return unsubscribe; // detaches the listener when the component unmounts
  }, [user?.id]);

  // Path 1 (DASS): severe/extremely severe → advisor redirect, no groups
  const isDassAdvisorRequired = mentalHealthProfile?.groupCategory === 'Severe Support';

  // Path 1 (DASS): filter groups by DASS-derived category when not severe
  // Path 2 (ML):   fall back to ML dominant category when DASS profile is absent
  const recommended: Group[] = (() => {
    if (isDassAdvisorRequired) return [];
    if (mentalHealthProfile) {
      return getRecommendedGroups(peerGroups, mentalHealthProfile).slice(0, 4);
    }
    if (mlInsight) {
      return getGroupsByMlPrediction(peerGroups, mlInsight.dominantCategory).slice(0, 4);
    }
    return [];
  })();

  // Label shown under the section title to indicate which path is active
  const recommendationSource: 'dass' | 'ml' | null =
    isDassAdvisorRequired ? null :
    mentalHealthProfile ? 'dass' :
    mlInsight ? 'ml' : null;

  const recommendationCategoryLabel =
    recommendationSource === 'dass'
      ? mentalHealthProfile!.groupCategory
      : recommendationSource === 'ml'
      ? getMlGroupCategory(mlInsight!.dominantCategory)
      : null;

  const handleJoin = async (group: Group) => {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      setSelectedGroup(group);
      navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name });
    } finally {
      setJoiningId(null);
    }
  };

  const handleOpen = (group: Group) => {
    setSelectedGroup(group);
    navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name });
  };

  const handleGroupPress = (group: Group) => {
    if (joinedGroupIds.includes(group.id)) {
      handleOpen(group);
    } else {
      handleJoin(group);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>
          <Text style={styles.subGreeting}>How are you feeling today?</Text>
        </View>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Motivation Card */}
      <View style={styles.motivationCard}>
        <View style={styles.motivationContent}>
          <Text style={styles.motivationLabel}>Daily Motivation</Text>
          <Text style={styles.motivationQuote}>
            "One small step at a time is still progress."
          </Text>
        </View>
        <Ionicons name="happy-outline" size={42} color="rgba(255,255,255,0.45)" />
      </View>

      {/* Recommended Groups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recommended Groups</Text>
            {recommendationCategoryLabel && (
              <Text style={styles.categoryLabel}>
                {recommendationCategoryLabel}
                {recommendationSource === 'ml' ? '  •  Based on your activity' : '  •  Based on your wellbeing check'}
              </Text>
            )}
          </View>
          {!isDassAdvisorRequired && (
            <TouchableOpacity onPress={() => navigation.navigate('Main')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Severe DASS case: redirect to advisor instead of showing groups */}
        {isDassAdvisorRequired ? (
          <View style={styles.advisorRedirectCard}>
            <Ionicons name="alert-circle" size={32} color={COLORS.danger} />
            <Text style={styles.advisorRedirectTitle}>Professional Support Recommended</Text>
            <Text style={styles.advisorRedirectText}>
              Your wellbeing check indicates a high level of distress. We recommend speaking with a professional advisor rather than joining a peer group at this time.
            </Text>
            <TouchableOpacity
              style={styles.advisorRedirectBtn}
              onPress={() => navigation.navigate('Advisor')}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={14} color="white" />
              <Text style={styles.advisorRedirectBtnText}>Connect with Advisor</Text>
            </TouchableOpacity>
            <Text style={styles.advisorDisclaimer}>
              AI suggestion only — not professional advice
            </Text>
          </View>
        ) : groupsLoading ? (
          <View style={styles.groupsPlaceholder}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading groups…</Text>
          </View>
        ) : recommended.length === 0 ? (
          <View style={styles.groupsPlaceholder}>
            <Text style={styles.loadingText}>
              {!mentalHealthProfile && !mlInsight
                ? 'Complete your wellbeing check or write a journal entry to get group recommendations.'
                : 'No groups found for your wellbeing category yet.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupsRow}
          >
            {recommended.map(group => {
              const isJoined = joinedGroupIds.includes(group.id);
              const isLoading = joiningId === group.id;
              return (
                <Card
                  key={group.id}
                  style={styles.groupCard}
                  onPress={() => handleGroupPress(group)}
                >
                  <Image
                    source={group.image}
                    style={styles.groupImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupDesc} numberOfLines={2}>
                    {group.description}
                  </Text>
                  <View style={styles.groupFooter}>
                    <View style={styles.membersRow}>
                      <Ionicons name="people-outline" size={12} color={COLORS.accent} />
                      <Text style={styles.membersText}>{group.members} members</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinBtn, isJoined && styles.joinBtnJoined]}
                      onPress={() => handleGroupPress(group)}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.joinBtnText}>
                          {isJoined ? 'Open' : 'Join'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </ScrollView>
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
        const categoryLabel = ML_CATEGORY_MAP[mlInsight.latestPrediction] ?? mlInsight.latestPrediction;
        const dominantLabel = ML_CATEGORY_MAP[mlInsight.dominantCategory] ?? mlInsight.dominantCategory;
        const confidencePct = Math.round(mlInsight.latestConfidence * 100);
        return (
          <Card style={[styles.insightCard, { borderLeftColor: palette.border, borderLeftWidth: 4 }]}>
            {/* Header */}
            <View style={styles.insightHeader}>
              <View style={styles.insightHeaderLeft}>
                <Ionicons name="sparkles" size={14} color={palette.accent} />
                <Text style={[styles.insightTitle, { color: palette.accent }]}>WELLBEING INSIGHT</Text>
              </View>
              <Text style={styles.insightTime}>{formatRelativeTime(mlInsight.lastUpdated)}</Text>
            </View>

            {/* Main row — emotion + confidence */}
            <View style={styles.insightMainRow}>
              <View style={styles.insightMainLeft}>
                <Text style={styles.insightFieldLabel}>Latest Emotion</Text>
                <View style={[styles.emotionBadge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.emotionBadgeText, { color: palette.accent }]}>
                    {categoryLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.insightMainRight}>
                <Text style={styles.insightFieldLabel}>Confidence</Text>
                <View style={[styles.confidenceCircle, { borderColor: palette.accent }]}>
                  <Text style={[styles.confidenceValue, { color: palette.accent }]}>
                    {confidencePct}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Dominant pattern */}
            <View style={styles.insightDominant}>
              <Text style={styles.insightFieldLabel}>Dominant Pattern</Text>
              <Text style={[styles.dominantValue, { color: palette.accent }]}>{dominantLabel}</Text>
            </View>


          </Card>
        );
      })()}

      {/* Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Resources</Text>
        <View style={styles.resourcesList}>
          {[
            { title: 'Managing Social Anxiety', type: 'Article', time: '5 min read' },
            { title: '10 Min Guided Meditation', type: 'Audio', time: '10 min' },
          ].map((item, i) => (
            <Card key={i} style={styles.resourceCard}>
              <View style={styles.resourceIconBox}>
                <Ionicons name="book-outline" size={24} color={COLORS.accent} />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>{item.title}</Text>
                <Text style={styles.resourceMeta}>
                  {item.type} • {item.time}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  subGreeting: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  logo: { width: 80, height: 36 },
  motivationCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  motivationContent: { flex: 1, marginRight: 12 },
  motivationLabel: {
    fontSize: 12,
    color: '#BFDBFE',
    fontWeight: '600',
    marginBottom: 8,
  },
  motivationQuote: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    lineHeight: 24,
  },
  section: { gap: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  categoryLabel: { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  seeAll: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  groupsRow: { gap: 12, paddingRight: 4 },
  groupsPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: { fontSize: 13, color: COLORS.muted },
  advisorRedirectCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  advisorRedirectTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.danger,
    textAlign: 'center',
  },
  advisorRedirectText: {
    fontSize: 13,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 20,
  },
  advisorRedirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  advisorRedirectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  advisorDisclaimer: {
    fontSize: 10,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  groupCard: { width: 220, padding: 16 },
  groupImage: { width: '100%', height: 120, borderRadius: 16, marginBottom: 12 },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  groupDesc: { fontSize: 11, color: COLORS.muted, lineHeight: 16, marginBottom: 10 },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersText: { fontSize: 11, color: COLORS.accent, fontWeight: '700' },
  joinBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 46,
    alignItems: 'center',
  },
  joinBtnJoined: { backgroundColor: COLORS.accent },
  joinBtnText: { fontSize: 11, fontWeight: '700', color: 'white' },
  resourcesList: { gap: 12 },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  resourceIconBox: {
    width: 48,
    height: 48,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  resourceInfo: { flex: 1 },
  resourceTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.text },
  resourceMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  // ─── Wellbeing Insight Card ────────────────────────────────────────────────
  insightCard: {
    gap: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  insightLoadingText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  insightEmptyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 4,
  },
  insightEmptySubText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  insightTime: {
    fontSize: 10,
    color: COLORS.muted,
  },
  insightMainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  insightMainLeft: { flex: 1, gap: 6 },
  insightMainRight: { gap: 6, alignItems: 'center' },
  insightFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emotionBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emotionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confidenceCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  confidenceValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  insightDominant: { gap: 4 },
  dominantValue: {
    fontSize: 15,
    fontWeight: '700',
  },
});
