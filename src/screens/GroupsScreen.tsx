import React, { useState } from 'react';
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
import { PEER_GROUPS, COLORS } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group } from '../types';

const CATEGORIES = ['All', 'Anxiety', 'Depression', 'Stress', 'General'];

export const GroupsScreen = () => {
  const { setSelectedGroup } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered =
    activeCategory === 'All'
      ? PEER_GROUPS
      : PEER_GROUPS.filter(g => g.category === activeCategory);

  const handleGroupPress = (group: Group) => {
    setSelectedGroup(group);
    navigation.navigate('GroupChat', { groupId: group.id, groupName: group.name });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Peer Groups</Text>

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

      {/* Groups List */}
      <View style={styles.groupsList}>
        {filtered.map(group => (
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
              <View style={styles.membersRow}>
                <Ionicons name="people-outline" size={12} color={COLORS.muted} />
                <Text style={styles.membersText}>{group.members} members active</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
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
  groupDesc: { fontSize: 11, color: COLORS.muted, lineHeight: 16, marginBottom: 6 },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersText: { fontSize: 10, color: COLORS.muted, fontWeight: '500' },
});
