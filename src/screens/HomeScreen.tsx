import React, { useState } from 'react';
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
import { COLORS, getRecommendedGroups } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group } from '../types';

export const HomeScreen = () => {
  const { user, peerGroups, groupsLoading, mentalHealthProfile, joinedGroupIds, joinGroup, setSelectedGroup } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const recommended = getRecommendedGroups(peerGroups, mentalHealthProfile).slice(0, 4);

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
            {mentalHealthProfile && (
              <Text style={styles.categoryLabel}>{mentalHealthProfile.groupCategory}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Main')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {groupsLoading ? (
          <View style={styles.groupsPlaceholder}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.loadingText}>Loading groups…</Text>
          </View>
        ) : recommended.length === 0 ? (
          <View style={styles.groupsPlaceholder}>
            <Text style={styles.loadingText}>No groups found for your wellbeing category yet.</Text>
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
        {mentalHealthProfile?.classificationLevel === 'severe' && (
          <View style={styles.supportNotice}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
            <Text style={styles.supportNoticeText}>
              Your wellbeing check suggests speaking with a professional advisor may help.
            </Text>
          </View>
        )}
      </View>

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
  supportNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  supportNoticeText: { flex: 1, fontSize: 12, color: COLORS.danger, lineHeight: 18 },
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
});
