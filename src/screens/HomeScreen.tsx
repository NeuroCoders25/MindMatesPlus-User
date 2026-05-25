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
import { ResourceFeed, TabType } from '../components/ResourceFeed';
import {
  COLORS,
  ML_CATEGORY_MAP,
  subscribeToMlMentalHealthProfile,
  listenToMentalHealthProfile,
  getGroupsByMlPrediction,
  calculateWellnessScore,
  continueAfterAdvisorApproval,
} from '../services/dataService';
import { subscribeAllGroupCalls } from '../services/groupCallService';
import { LiveCallBanner } from '../components/LiveCallBanner';
import { UpcomingCallsCard } from '../components/UpcomingCallsCard';
import { RootStackParamList } from '../navigation';
import { Group, MlMentalHealthProfile, MentalHealthRecommendationProfile } from '../types';
import { GroupCall } from '../types/groupCall';

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const { user, peerGroups, groupsLoading, joinedGroupIds, joinGroup, setSelectedGroup, isRestricted } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Realtime wellbeing insight (journal-based ML profile on user doc)
  const [mlInsight, setMlInsight] = useState<MlMentalHealthProfile | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  // Realtime recommendation profile (mentalHealthProfile/currentProfile)
  const [recommendationProfile, setRecommendationProfile] = useState<MentalHealthRecommendationProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Resource Tab State
  const [activeResourceTab, setActiveResourceTab] = useState<TabType>('image');

  // Advisor approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Group call state — keyed by groupId
  const [callsByGroup, setCallsByGroup] = useState<Record<string, GroupCall[]>>({});


  // Subscribe to all group calls across every group the user has joined.
  // Re-runs when joinedGroupIds changes (join / leave events).
  useEffect(() => {
    const unsubscribe = subscribeAllGroupCalls(joinedGroupIds, setCallsByGroup);
    return unsubscribe;
  }, [joinedGroupIds]);

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
      setProfileLoading(false);
    });
    return unsub;
  }, [user?.id]);

  // Show approval modal once when advisor approves the user
  useEffect(() => {
    const p = recommendationProfile;
    if (
      p?.advisorConnectionStatus === 'approved' &&
      p?.approvalMessageSeen !== true
    ) {
      setShowApprovalModal(true);
    }
  }, [recommendationProfile]);

  const handleContinueAfterApproval = async () => {
    setShowApprovalModal(false);
    if (user) {
      await continueAfterAdvisorApproval(user.id).catch(err =>
        console.error('[Approval] Failed to mark approval seen:', err)
      );
    }
  };

  // Advisor redirect when DASS result is severe
  const isAdvisorRequired = recommendationProfile?.userStatus === 'under_review';

  // Build recommended groups using a priority chain.
  const recommendedGroups = (() => {
    if (isAdvisorRequired) return [];

    if (recommendationProfile) {
      // Priority 1: Live peer group category — set initially by advisor approval,
      // then kept current by the weekly ML trend. Single source of truth for groups.
      const weeklyCategory = recommendationProfile.peerGroupRecommendationCategory;
      if (weeklyCategory) {
        return peerGroups.filter(g => g.category === weeklyCategory).slice(0, 4);
      }

      // Priority 2: KNN recommendation (no weekly trend result yet)
      const knnCategory = recommendationProfile.knnMappedCategory;
      if (knnCategory && recommendationProfile.knnSafetyFlag !== true) {
        const knnGroups = peerGroups.filter(g => g.category === knnCategory).slice(0, 4);
        if (knnGroups.length > 0) return knnGroups;
      }

      // Priority 3: DASS baseline
      return peerGroups.filter(g => g.category === recommendationProfile.baselineRecommendationCategory).slice(0, 4);
    }

    // Priority 5: Raw ML dominant
    if (mlInsight) {
      return getGroupsByMlPrediction(peerGroups, mlInsight.dominantCategory).slice(0, 4);
    }

    // Priority 6: Empty array
    return [];
  })();

  // Source label and category subtitle (uses the stable peer group category)
  const sourceLabel: string | null = (() => {
    if (recommendationProfile) return 'Based on your wellbeing trend';
    if (mlInsight) return 'Based on your recent activity';
    return null;
  })();

  const categoryLabel: string | null = recommendationProfile
    ? (recommendationProfile.peerGroupRecommendationCategory ??
        recommendationProfile.baselineRecommendationCategory)
    : mlInsight
    ? ML_CATEGORY_MAP[mlInsight.dominantCategory] ?? null
    : null;

  const handleJoin = async (group: Group) => {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      // Switch to the Groups tab so the user sees the group card with the Open button
      (navigation as any).navigate('Groups');
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

  const approvedCategoryLabel =
    recommendationProfile?.approvedCategory ??
    recommendationProfile?.activeRecommendationCategory ??
    'General Wellbeing';

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name} {user?.nickname ? `(${user.nickname}) ` : ''}👋</Text>
          <Text style={styles.subGreeting}>How are you feeling today?</Text>
        </View>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Combined Daily Card */}
      <View style={styles.dailyCard}>
        {/* Decorative background circles */}
        <View style={styles.dailyCardCircle1} />
        <View style={styles.dailyCardCircle2} />

        {/* Date badge */}
        <View style={styles.dailyCardDateBadge}>
          <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.85)" />
          <Text style={styles.dailyCardDateText}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Motivation */}
        <View style={styles.dailyCardTop}>
          <View style={styles.dailyCardLabelRow}>
            <Ionicons name="sunny-outline" size={12} color="#BFDBFE" />
            <Text style={styles.dailyCardLabel}>Daily Motivation</Text>
          </View>
          <Text style={styles.dailyCardQuote}>
            "One small step at a time is still progress."
          </Text>
        </View>

        {/* Wellness Score strip (conditional) */}
        {!insightLoading && mlInsight && (() => {
          // Dashboard category is the stable weekly-trend peer group category,
          // not the real-time resource category.
          const dashboardCategory = recommendationProfile
            ? (recommendationProfile.peerGroupRecommendationCategory ??
                recommendationProfile.baselineRecommendationCategory ??
                recommendationProfile.activeRecommendationCategory)
            : null;
          const storedScore = recommendationProfile?.wellnessScore;
          const wellnessScore = storedScore !== undefined
            ? storedScore
            : dashboardCategory ? calculateWellnessScore(dashboardCategory) : null;
          if (wellnessScore === null) return null;
          return (
            <View style={styles.dailyCardBottom}>
              <View style={styles.dailyCardScoreSection}>
                <Text style={styles.dailyCardScoreLabel}>Mental Wellness Score</Text>
                <Text style={[styles.dailyCardScoreValue, { color: '#FFFFFF' }]}>{wellnessScore}%</Text>
              </View>
              <View style={styles.dailyCardDivider} />
              <View style={styles.dailyCardCategorySection}>
                <Text style={styles.dailyCardScoreLabel}>Category</Text>
                <Text style={[styles.dailyCardCategoryValue, { color: '#FFFFFF' }]} numberOfLines={2}>
                  {dashboardCategory}
                </Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* ── Live & Scheduled Group Calls ─────────────────────────────────────── */}
      {(() => {
        const allLiveCalls = Object.values(callsByGroup).flat().filter(c => c.status === 'live');
        const allScheduled = Object.values(callsByGroup).flat().filter(c => c.status === 'scheduled');
        if (allLiveCalls.length === 0 && allScheduled.length === 0) return null;
        return (
          <View style={styles.callsSection}>
            {allLiveCalls.map(c => (
              <LiveCallBanner key={c.id} call={c} />
            ))}
            {allScheduled.length > 0 && (
              <View style={styles.upcomingSection}>
                <Text style={styles.sectionTitle}>Upcoming group calls</Text>
                {allScheduled.map(c => (
                  <UpcomingCallsCard key={c.id} calls={[c]} groupName={c.groupId} />
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Recommended Groups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recommended Groups</Text>
            {!isRestricted && categoryLabel && sourceLabel && (
              <Text style={styles.categoryLabel}>
                {categoryLabel}{'  •  '}{sourceLabel}
              </Text>
            )}
          </View>
          {!isAdvisorRequired && !isRestricted && (
            <TouchableOpacity onPress={() => navigation.navigate('Main')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Low wellness restriction banner */}
        {isRestricted ? (
          <View style={styles.restrictionCard}>
            <Ionicons name="shield-outline" size={32} color="#DC2626" />
            <Text style={styles.restrictionTitle}>Support Pause Active</Text>
            <Text style={styles.restrictionText}>
              Your wellness score is very low right now. For your safety and support, group recommendations are temporarily paused. Please connect with an advisor to continue.
            </Text>
            <TouchableOpacity
              style={styles.restrictionBtn}
              onPress={() => navigation.navigate('Advisor')}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={14} color="white" />
              <Text style={styles.restrictionBtnText}>Consult Advisor</Text>
            </TouchableOpacity>
            <Text style={styles.advisorDisclaimer}>
              AI suggestion only — not professional advice
            </Text>
          </View>
        ) : isAdvisorRequired ? (
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
        ) : (groupsLoading || profileLoading) ? (
          <View style={styles.groupsPlaceholder}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading groups…</Text>
          </View>
        ) : recommendedGroups.length === 0 ? (
          <View style={styles.groupsPlaceholder}>
            <Text style={styles.loadingText}>
              {!recommendationProfile && !mlInsight
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
            {recommendedGroups.map(group => {
              const isJoined = joinedGroupIds.includes(group.id);
              const isLoading = joiningId === group.id;
              const isPrimary = true;
              return (
                <Card
                  key={group.id}
                  style={[styles.groupCard, !isPrimary && styles.groupCardSecondary]}
                  onPress={() => handleGroupPress(group)}
                >
                  <Image
                    source={group.image}
                    style={styles.groupImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.groupName}>{group.name}</Text>
                  {!isPrimary && (
                    <Text style={styles.groupSecondaryTag}>Also recommended</Text>
                  )}
                  <Text style={styles.groupDesc} numberOfLines={2}>
                    {group.description}
                  </Text>
                  <View style={styles.groupFooter}>
                    <View style={styles.membersRow}>
                      <Ionicons name="people-outline" size={12} color={COLORS.accent} />
                      <Text style={styles.membersText}>{group.members} members</Text>
                    </View>
                    {!isJoined && (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        onPress={() => handleGroupPress(group)}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.joinBtnText}>Join</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Resource Feed — right after groups */}
      {user && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Resources For You</Text>
            <View style={styles.smallTabContainer}>
              <TouchableOpacity
                style={[styles.smallTab, activeResourceTab === 'image' && styles.smallTabActive]}
                onPress={() => setActiveResourceTab('image')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={activeResourceTab === 'image' ? 'image' : 'image-outline'}
                  size={14}
                  color={activeResourceTab === 'image' ? COLORS.white : COLORS.muted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallTab, activeResourceTab === 'text' && styles.smallTabActive]}
                onPress={() => setActiveResourceTab('text')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={activeResourceTab === 'text' ? 'document-text' : 'document-text-outline'}
                  size={14}
                  color={activeResourceTab === 'text' ? COLORS.white : COLORS.muted}
                />
              </TouchableOpacity>
            </View>
          </View>
          <ResourceFeed userId={user.id} activeTab={activeResourceTab} hideTabs={true} />
        </View>
      )}


    </ScrollView>

    {/* Approval overlay — rendered as absolute View to avoid Android transparent-Modal black screen */}
    {showApprovalModal && (
      <View style={[styles.approvalOverlay, StyleSheet.absoluteFillObject]}>
        <View style={styles.approvalCard}>
          <View style={styles.approvalIconWrapper}>
            <Ionicons name="checkmark-circle" size={52} color="#22C55E" />
          </View>
          <Text style={styles.approvalTitle}>You're Approved!</Text>
          <Text style={styles.approvalMessage}>
            Your advisor has reviewed your case and approved you to continue using MindMates+.
          </Text>
          <View style={styles.approvalCategoryBox}>
            <Text style={styles.approvalCategoryLabel}>Your recommended category</Text>
            <Text style={styles.approvalCategoryValue}>{approvedCategoryLabel}</Text>
          </View>
          <Text style={styles.approvalDisclaimer}>
            Your dashboard, peer groups, and resources will now reflect your advisor-approved support level.
          </Text>
          <TouchableOpacity
            style={styles.approvalBtn}
            onPress={handleContinueAfterApproval}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color="white" />
            <Text style={styles.approvalBtnText}>Continue to App</Text>
          </TouchableOpacity>
          <Text style={styles.approvalSubDisclaimer}>
            AI suggestion only — not professional advice
          </Text>
        </View>
      </View>
    )}
    </View>
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
  dailyCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    gap: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  dailyCardCircle1: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -40,
    right: 30,
  },
  dailyCardCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -20,
    left: -10,
  },
  dailyCardDateBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1,
  },
  dailyCardDateText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dailyCardTop: {
    gap: 8,
    paddingRight: 76,
  },
  dailyCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dailyCardLabel: {
    fontSize: 10,
    color: '#BFDBFE',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dailyCardQuote: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
    lineHeight: 22,
  },
  dailyCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(219,234,254,0.25)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dailyCardScoreSection: { flex: 1, gap: 3 },
  dailyCardDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 14,
  },
  dailyCardCategorySection: { flex: 1, gap: 3 },
  dailyCardScoreLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailyCardScoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  dailyCardCategoryValue: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  callsSection: { gap: 10 },
  upcomingSection: { gap: 10 },
  section: { gap: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  categoryLabel: { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  smallTabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(219, 234, 254, 0.4)',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  smallTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallTabActive: {
    backgroundColor: COLORS.accent,
  },
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
  restrictionCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
  },
  restrictionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#DC2626',
    textAlign: 'center',
  },
  restrictionText: {
    fontSize: 13,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 20,
  },
  restrictionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  restrictionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  groupCard: { width: 220, padding: 16 },
  groupCardSecondary: { opacity: 0.85 },
  groupImage: { width: '100%', height: 120, borderRadius: 16, marginBottom: 12 },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  groupSecondaryTag: {
    fontSize: 10,
    color: COLORS.muted,
    fontStyle: 'italic',
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
  wellnessScoreRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  wellnessScoreLeft: { flex: 1, gap: 4 },
  wellnessScoreRight: { flex: 1, gap: 4 },
  wellnessScoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
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
    fontSize: 14,
    fontWeight: '700',
  },
  countsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  countChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countChipValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  insightDisclaimer: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ─── Advisor Approval Modal ────────────────────────────────────────────────
  approvalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  approvalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  approvalIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  approvalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  approvalMessage: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  approvalCategoryBox: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  approvalCategoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  approvalCategoryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803D',
    textAlign: 'center',
  },
  approvalDisclaimer: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  approvalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  approvalBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  approvalSubDisclaimer: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
