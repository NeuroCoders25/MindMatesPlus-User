import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { COLORS, GROUP_CATEGORIES } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group } from '../types';

const CATEGORIES = ['All', ...GROUP_CATEGORIES];

type MainTab = 'discover' | 'mygroups';

export const GroupsScreen = () => {
  const { peerGroups, joinedGroupIds, joinGroup, setSelectedGroup } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeCategory, setActiveCategory] = useState('All');
  const [mainTab, setMainTab] = useState<MainTab>('discover');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const discoverGroups =
    activeCategory === 'All'
      ? peerGroups
      : peerGroups.filter(g => g.category === activeCategory);

  const myGroups = peerGroups.filter(g => joinedGroupIds.includes(g.id));

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

  const renderGroupCard = (group: Group) => {
    const isJoined = joinedGroupIds.includes(group.id);
    const isLoading = joiningId === group.id;

    return (
      <Card
        key={group.id}
        style={styles.groupCard}
        onPress={() => (isJoined ? handleOpen(group) : handleJoin(group))}
      >
        <Image source={group.image} style={styles.groupImage} resizeMode="cover" />
        <View style={styles.groupInfo}>
          <View style={styles.groupTop}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{group.category}</Text>
            </View>
          </View>
          <Text style={styles.groupDesc} numberOfLines={1}>
            {group.description}
          </Text>
          <View style={styles.groupBottom}>
            <View style={styles.membersRow}>
              <Ionicons name="people-outline" size={12} color={COLORS.muted} />
              <Text style={styles.membersText}>{group.members} members active</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, isJoined && styles.actionBtnJoined]}
              onPress={() => (isJoined ? handleOpen(group) : handleJoin(group))}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {isJoined ? 'Open' : 'Join'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Peer Groups</Text>

      {/* Main tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'discover' && styles.activeTab]}
          onPress={() => setMainTab('discover')}
        >
          <Text style={[styles.tabText, mainTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mainTab === 'mygroups' && styles.activeTab]}
          onPress={() => setMainTab('mygroups')}
        >
          <Text style={[styles.tabText, mainTab === 'mygroups' && styles.activeTabText]}>
            My Groups
          </Text>
          {myGroups.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{myGroups.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {mainTab === 'discover' ? (
        <>
          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.categoryBtn,
                  activeCategory === cat && styles.activeCategoryBtn,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    activeCategory === cat && styles.activeCategoryText,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* All groups */}
          <View style={styles.groupsList}>
            {peerGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyText}>No groups available yet</Text>
              </View>
            ) : (
              discoverGroups.map(renderGroupCard)
            )}
          </View>
        </>
      ) : (
        /* My Groups */
        <View style={styles.groupsList}>
          {myGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={COLORS.muted} />
              <Text style={styles.emptyText}>You haven't joined any groups yet</Text>
              <TouchableOpacity onPress={() => setMainTab('discover')}>
                <Text style={styles.discoverLink}>Browse groups →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myGroups.map(renderGroupCard)
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  activeTabText: { color: 'white' },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, color: 'white', fontWeight: '700' },

  categories: { gap: 8, paddingRight: 4 },
  categoryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  activeCategoryBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  activeCategoryText: { color: 'white' },

  groupsList: { gap: 12 },
  groupCard: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  groupImage: { width: 64, height: 64, borderRadius: 16, marginRight: 14 },
  groupInfo: { flex: 1 },
  groupTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    fontSize: 9,
    color: COLORS.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupDesc: { fontSize: 11, color: COLORS.muted, lineHeight: 16, marginBottom: 8 },
  groupBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersText: { fontSize: 10, color: COLORS.muted, fontWeight: '500' },
  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  actionBtnJoined: { backgroundColor: COLORS.accent },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.muted, textAlign: 'center' },
  discoverLink: { fontSize: 13, color: COLORS.accent, fontWeight: '700' },
});
