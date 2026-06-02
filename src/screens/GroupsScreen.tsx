import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { COLORS, subscribeUnreadCount } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group } from '../types';

export const GroupsScreen = () => {
  const { peerGroups, joinedGroupIds, setSelectedGroup, visitedGroupIds, markGroupAsVisited, isRestricted } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const myGroups = peerGroups.filter(g => joinedGroupIds.includes(g.id));
  const unvisitedGroupsCount = myGroups.filter(g => !visitedGroupIds.includes(g.id)).length;

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const groupIdsKey = myGroups.map(g => g.id).join(',');
  useEffect(() => {
    if (myGroups.length === 0) return;
    const unsubs = myGroups.map(group =>
      subscribeUnreadCount(group.id, 'group', count => {
        setUnreadCounts(prev => ({ ...prev, [group.id]: count }));
      })
    );
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdsKey]);

  const handleOpen = (group: Group) => {
    if (isRestricted) return;
    markGroupAsVisited(group.id);
    setSelectedGroup(group);
    navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name });
  };

  const renderGroupCard = (group: Group) => (
    <Card
      key={group.id}
      style={styles.groupCard}
      onPress={() => handleOpen(group)}
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
          <View style={styles.groupBottomRight}>
            {(unreadCounts[group.id] ?? 0) > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {(unreadCounts[group.id] ?? 0) > 99 ? '99+' : unreadCounts[group.id]}
                </Text>
              </View>
            )}
            {!visitedGroupIds.includes(group.id) && (
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => handleOpen(group)}
                activeOpacity={0.8}
              >
                <Text style={styles.openBtnText}>Open</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        {unvisitedGroupsCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{unvisitedGroupsCount}</Text>
          </View>
        )}
      </View>

      {isRestricted ? (
        <View style={styles.restrictionCard}>
          <Ionicons name="shield-outline" size={40} color="#DC2626" />
          <Text style={styles.restrictionTitle}>Peer Groups Paused</Text>
          <Text style={styles.restrictionText}>
            Peer groups are temporarily unavailable. Please speak with an advisor first so we can guide you safely.
          </Text>
          <TouchableOpacity
            style={styles.restrictionBtn}
            onPress={() => navigation.navigate('Advisor')}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={14} color="white" />
            <Text style={styles.restrictionBtnText}>Consult Advisor</Text>
          </TouchableOpacity>
          <Text style={styles.restrictionDisclaimer}>
            AI suggestion only — not professional advice
          </Text>
        </View>
      ) : myGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>No groups joined yet</Text>
          <Text style={styles.emptySubtext}>
            Groups recommended for you will appear on your home screen.
          </Text>
        </View>
      ) : (
        <View style={styles.groupsList}>
          {myGroups.map(renderGroupCard)}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 20 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  countBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: { fontSize: 12, color: 'white', fontWeight: '700' },

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
  openBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  openBtnText: { fontSize: 12, fontWeight: '700', color: 'white' },
  groupBottomRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  emptySubtext: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
  restrictionCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    marginTop: 8,
  },
  restrictionTitle: {
    fontSize: 16,
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
  restrictionDisclaimer: {
    fontSize: 10,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
});
