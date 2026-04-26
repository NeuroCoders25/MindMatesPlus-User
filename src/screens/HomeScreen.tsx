import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { PEER_GROUPS, COLORS } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Group } from '../types';

export const HomeScreen = () => {
  const { user, setSelectedGroup } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
          <Text style={styles.sectionTitle}>Recommended Groups</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupsRow}
        >
          {PEER_GROUPS.map(group => (
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
              <View style={styles.membersRow}>
                <Ionicons name="people-outline" size={12} color={COLORS.accent} />
                <Text style={styles.membersText}>{group.members} members</Text>
              </View>
            </Card>
          ))}
        </ScrollView>
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
  seeAll: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  groupsRow: { gap: 12, paddingRight: 4 },
  groupCard: { width: 220, padding: 16 },
  groupImage: { width: '100%', height: 120, borderRadius: 16, marginBottom: 12 },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  groupDesc: { fontSize: 11, color: COLORS.muted, lineHeight: 16, marginBottom: 10 },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersText: { fontSize: 11, color: COLORS.accent, fontWeight: '700' },
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
