import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { COLORS } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group } from '../types';

export const GroupsScreen = () => {
  const { peerGroups, joinedGroupIds, setSelectedGroup, visitedGroupIds } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const myGroups = peerGroups.filter(g => joinedGroupIds.includes(g.id));
  const unvisitedGroupsCount = myGroups.filter(g => !visitedGroupIds.includes(g.id)).length;

  const handleOpen = (group: Group) => {
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
          <TouchableOpacity
            style={styles.openBtn}
            onPress={() => handleOpen(group)}
            activeOpacity={0.8}
          >
            <Text style={styles.openBtnText}>Open</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <ScrollView
      style={styles.container}
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

      {myGroups.length === 0 ? (
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

  emptyState: { alignItems: 'center', paddingVertical: 64, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  emptySubtext: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
});
