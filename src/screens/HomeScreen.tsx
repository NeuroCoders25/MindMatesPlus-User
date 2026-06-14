import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { ResourceFeed, TabType } from '../components/ResourceFeed';
import { ResourcePostCard } from '../components/ResourcePostCard';
import {
  COLORS,
  ML_CATEGORY_MAP,
  subscribeToMlMentalHealthProfile,
  listenToMentalHealthProfile,
  getGroupsByMlPrediction,
  calculateWellnessScore,
  continueAfterAdvisorApproval,
  listenToLatestAdvisorResource,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
  AppNotification,
} from '../services/dataService';
import { subscribeAllGroupCalls, formatCallTime } from '../services/groupCallService';
import { LiveCallBanner } from '../components/LiveCallBanner';
import { UpcomingCallsCard } from '../components/UpcomingCallsCard';
import { WeeklyReflectionCard } from '../components/WeeklyReflectionCard';
import { RootStackParamList } from '../navigation';
import { Group, MlMentalHealthProfile, MentalHealthRecommendationProfile } from '../types';
import { GroupCall } from '../types/groupCall';
import { SvgXml } from 'react-native-svg';
import multiavatar from '@multiavatar/multiavatar';
import { getIcon } from '../components/BadgeAwardToast';
import { useGuide } from '../context/GuideContext';
import { NotificationsPanel } from '../components/NotificationsPanel';

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const {
    user, peerGroups, groupsLoading, joinedGroupIds, joinGroup, setSelectedGroup, isRestricted,
    gamificationProfile, earnedBadges, gamificationTriggers, notifications,
  } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const avatarSvg = useMemo(
    () => (user?.avatarSeed ? multiavatar(user.avatarSeed) : null),
    [user?.avatarSeed],
  );

  // Realtime wellbeing insight (journal-based ML profile on user doc)
  const [mlInsight, setMlInsight] = useState<MlMentalHealthProfile | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  // Realtime recommendation profile (mentalHealthProfile/currentProfile)
  const [recommendationProfile, setRecommendationProfile] = useState<MentalHealthRecommendationProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Latest advisor resource poster
  const [latestAdvisorResource, setLatestAdvisorResource] = useState<import('../types').Resource | null>(null);

  // Resource Tab State
  const [activeResourceTab, setActiveResourceTab] = useState<TabType>('image');

  // Advisor approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Group call state — keyed by groupId
  const [callsByGroup, setCallsByGroup] = useState<Record<string, GroupCall[]>>({});

  // Notification panel state
  const [showNotifications, setShowNotifications] = useState(false);

  // About popup state
  const [showAbout, setShowAbout] = useState(false);
  const seenCallIdsRef = useRef<Set<string>>(new Set());
  const callNotifInitRef = useRef(false);

  // ── App Guide ──────────────────────────────────────────────────────────────
  const { registerTarget, checkAndMaybeStartGuide } = useGuide();
  const recommendedGroupsRef = useRef<View>(null);

  const measureAndRegister = (ref: React.RefObject<View>, key: string) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) registerTarget(key, { x, y, width, height });
    });
  };


  // Subscribe to all group calls. Detects newly-scheduled calls and writes
  // a notification for each one (seeded silently on first snapshot).
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    callNotifInitRef.current = false;
    seenCallIdsRef.current = new Set();

    const unsubscribe = subscribeAllGroupCalls(joinedGroupIds, newCallsByGroup => {
      setCallsByGroup(newCallsByGroup);

      const scheduled = Object.entries(newCallsByGroup).flatMap(([gId, calls]) =>
        calls.filter(c => c.status === 'scheduled').map(c => ({ ...c, _groupId: gId })),
      );

      if (!callNotifInitRef.current) {
        scheduled.forEach(c => seenCallIdsRef.current.add(c.id));
        callNotifInitRef.current = true;
        return;
      }

      scheduled.forEach(call => {
        if (seenCallIdsRef.current.has(call.id)) return;
        seenCallIdsRef.current.add(call.id);
        const group = peerGroups.find(g => g.id === call._groupId);
        const gName = group?.name ?? 'Group Chat';
        createNotification(userId, `call_${call.id}`, {
          type: 'call_scheduled',
          title: 'Group Call Scheduled',
          body: `${call.title}${call.scheduledAt ? ' — ' + formatCallTime(call.scheduledAt) : ''}`,
          read: false,
          groupId: call._groupId,
          groupName: gName,
        });
      });
    });
    return () => {
      unsubscribe();
      seenCallIdsRef.current = new Set();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedGroupIds, user?.id]);

  // Daily check-in trigger — fires at most once per day, compared client-side
  // against the last known check-in date so we don't spam the backend.
  useEffect(() => {
    if (!user?.id) return;
    const lastCheckin = gamificationProfile?.lastCheckInDate?.toDate?.();
    const today = new Date();
    const isNewDay = !lastCheckin || lastCheckin.toDateString() !== today.toDateString();
    if (isNewDay) {
      void gamificationTriggers.onCheckIn();
    }
  }, [user?.id]);

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


  useEffect(() => {
    return listenToLatestAdvisorResource(setLatestAdvisorResource);
  }, []);

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

  // Trigger guide check once profile data is ready and user is not restricted
  useEffect(() => {
    if (!user?.id || isRestricted || profileLoading) return;
    void checkAndMaybeStartGuide(user.id, isRestricted);
  }, [user?.id, isRestricted, profileLoading]);

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
  const recommendedGroups = useMemo(() => {
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
  }, [isAdvisorRequired, recommendationProfile, peerGroups, mlInsight]);

  // Source label and category subtitle (uses the stable peer group category)
  const sourceLabel = useMemo((): string | null => {
    if (recommendationProfile) return 'Based on your wellbeing trend';
    if (mlInsight) return 'Based on your recent activity';
    return null;
  }, [recommendationProfile, mlInsight]);

  const categoryLabel = useMemo((): string | null =>
    recommendationProfile
      ? (recommendationProfile.peerGroupRecommendationCategory ??
          recommendationProfile.baselineRecommendationCategory)
      : mlInsight
      ? ML_CATEGORY_MAP[mlInsight.dominantCategory] ?? null
      : null
  , [recommendationProfile, mlInsight]);

  const handleJoin = async (group: Group) => {
    setJoiningId(group.id);
    try {
      await joinGroup(group.id);
      void gamificationTriggers.onGroupJoined();
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationTap = useCallback((notif: AppNotification) => {
    if (!user?.id) return;
    markNotificationRead(user.id, notif.id);
    setShowNotifications(false);
    switch (notif.type) {
      case 'peer_message':
      case 'call_scheduled':
        if (notif.groupId && notif.groupName) {
          const group = peerGroups.find(g => g.id === notif.groupId);
          if (group) setSelectedGroup(group);
          navigation.navigate('GroupChat', {
            groupId: notif.groupId,
            groupName: notif.groupName,
          });
        }
        break;
      case 'advisor_message':
      case 'listener_accepted':
        (navigation as any).navigate('Listener');
        break;
      case 'advisor_request':
        navigation.navigate('Advisor');
        break;
      case 'badge_awarded':
        navigation.navigate('Achievements');
        break;
    }
  }, [user?.id, peerGroups, navigation, setSelectedGroup]);

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
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowAbout(true)} activeOpacity={0.8}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <View style={styles.headerGreetingBlock}>
            <Text style={styles.greeting}>Hello, {user?.name} {user?.nickname ? `(${user.nickname}) ` : ''}👋</Text>
            <Text style={styles.subGreeting}>How are you feeling today?</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationBell}
            onPress={() => setShowNotifications(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={24} color="#1a1a2e" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerProfilePic}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {user?.profileImageUrl
              ? <Image source={{ uri: user.profileImageUrl }} style={styles.headerAvatar} />
              : avatarSvg
                ? <SvgXml xml={avatarSvg} width={36} height={36} />
                : <Ionicons name="person" size={20} color="white" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Combined Daily Card */}
      <View style={styles.dailyCard}>
        {/* Decorative background circles */}
        <View style={styles.dailyCardCircle1} />
        <View style={styles.dailyCardCircle2} />

        {/* Motivation */}
        <View style={styles.dailyCardTop}>
          {/* Single header row: label | spacer | badge | date */}
          <View style={styles.dailyCardLabelRow}>
            <View style={styles.dailyCardLabelLeft}>
              <Ionicons name="sunny-outline" size={12} color="#BFDBFE" />
              <Text style={styles.dailyCardLabel}>Daily Motivation</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.dailyCardDateBadge}>
              <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.85)" />
              <Text style={styles.dailyCardDateText}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
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
              {earnedBadges.length > 0 ? (
                <TouchableOpacity
                  style={styles.dailyCardCategorySection}
                  onPress={() => navigation.navigate('Achievements')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dailyCardScoreLabel}>Latest Badge</Text>
                  <View style={styles.dailyCardBadgeRow}>
                    <Text style={styles.dailyCardBadgeSectionEmoji}>{getIcon(earnedBadges[0].iconName)}</Text>
                    <Text style={styles.dailyCardBadgeSectionName} numberOfLines={2} ellipsizeMode="tail">
                      {earnedBadges[0].badgeName.split(/\s*[–—-]\s*/)[0].trim()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.dailyCardCategorySection}>
                  <Text style={styles.dailyCardScoreLabel}>Category</Text>
                  <Text style={[styles.dailyCardCategoryValue, { color: '#FFFFFF' }]} numberOfLines={2}>
                    {dashboardCategory}
                  </Text>
                </View>
              )}
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
      <View
        ref={recommendedGroupsRef}
        onLayout={() => measureAndRegister(recommendedGroupsRef, 'recommended_groups')}
        style={styles.section}
        collapsable={false}
      >
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
            <TouchableOpacity onPress={() => (navigation as any).navigate('Groups')}>
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

      {/* Latest Advisor Resource Poster */}
      {latestAdvisorResource && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest from Advisor</Text>
          </View>
          <ResourcePostCard resource={latestAdvisorResource} />
        </View>
      )}

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

      {/* Weekly reflection — warm, affirming summary loaded once per session */}
      {user && <WeeklyReflectionCard uid={user.id} />}

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
    {/* About popup */}
    {showAbout && (
      <View style={[styles.aboutOverlay, StyleSheet.absoluteFillObject]}>
        <View style={styles.aboutCard}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.aboutLogo}
            resizeMode="contain"
          />
          <View style={styles.aboutVersionPill}>
            <Text style={styles.aboutVersionText}>Version 1.0</Text>
          </View>

          <Text style={styles.aboutTagline}>
            Your mental wellness companion
          </Text>

          <View style={styles.aboutDivider} />

          <View style={styles.aboutFeatures}>
            {[
              { icon: 'people-outline',        label: 'Peer Support Groups' },
              { icon: 'journal-outline',        label: 'Guided Journaling' },
              { icon: 'medal-outline',          label: 'Gamified Wellness' },
              { icon: 'headset-outline',        label: 'Expert Listeners' },
              { icon: 'bar-chart-outline',      label: 'DASS-21 Wellbeing Check' },
              { icon: 'shield-checkmark-outline', label: 'AI-Assisted Moderation' },
            ].map(f => (
              <View key={f.label} style={styles.aboutFeatureRow}>
                <Ionicons name={f.icon as any} size={15} color={COLORS.accent} />
                <Text style={styles.aboutFeatureText}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.aboutDivider} />

          <Text style={styles.aboutDisclaimer}>
            MindMates+ is a peer support platform and is not a substitute for professional mental health treatment.
          </Text>
          <Text style={styles.aboutCopyright}>© 2025 MindMates+. All rights reserved.</Text>

          <TouchableOpacity
            style={styles.aboutCloseBtn}
            onPress={() => setShowAbout(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.aboutCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}

    {/* Notifications panel — absolute overlay, anchors below the bell */}
    {showNotifications && (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllRead={() => {
            if (user?.id) {
              markAllNotificationsRead(
                user.id,
                notifications.filter(n => !n.read).map(n => n.id),
              );
            }
          }}
          onTap={handleNotificationTap}
        />
      </View>
    )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 100, gap: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 100, height: 44 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerGreetingBlock: { alignItems: 'flex-end' },
  greeting: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  subGreeting: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  notificationBell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginRight: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#f0f0f5',
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerProfilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  dailyCardDateText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dailyCardTop: {
    gap: 8,
  },
  dailyCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  dailyCardLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
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
  dailyCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
    maxWidth: 90,
    flexShrink: 1,
    minWidth: 0,
  },
  dailyCardBadgeEmoji: { fontSize: 12 },
  dailyCardBadgeName: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.9)', flexShrink: 1, minWidth: 0 },
  dailyCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  dailyCardBadgeSectionLabel: {
    fontSize: 9,
    color: '#FCD34D',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailyCardBadgeSectionEmoji: { fontSize: 24 },
  dailyCardBadgeSectionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
    flexWrap: 'wrap',
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
    backgroundColor: COLORS.primary,
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

  // ── About popup ──────────────────────────────────────────────────────────
  aboutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  aboutCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  aboutLogo: { width: 140, height: 52 },
  aboutVersionPill: {
    backgroundColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  aboutVersionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  aboutTagline: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 2,
  },
  aboutDivider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  aboutFeatures: { width: '100%', gap: 8 },
  aboutFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutFeatureText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  aboutDisclaimer: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  aboutCopyright: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
  },
  aboutCloseBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  aboutCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
