import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvisorDetails'>;

const FALLBACK_AVATARS: Record<string, any> = {
  'Clinical Psychologist': require('../assets/group_image1.jpg'),
  'Mental Health Advisor': require('../assets/group_image3.png'),
  'Depression Specialist': require('../assets/group_image4.jpeg'),
  default: require('../assets/group_image5.png'),
};

const AVAILABILITY: Record<string, { label: string; color: string }> = {
  online:  { label: 'Online',  color: '#10B981' },
  busy:    { label: 'Busy',    color: '#F59E0B' },
  away:    { label: 'Away',    color: '#6B7280' },
  offline: { label: 'Offline', color: '#9CA3AF' },
};

const getAvailability = (raw: string | undefined) =>
  AVAILABILITY[(raw ?? '').toLowerCase()] ?? { label: 'Online', color: '#10B981' };

export const AdvisorDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { advisor } = route.params;
  const avatar = advisor.imageUrl ? { uri: advisor.imageUrl } : (FALLBACK_AVATARS[advisor.specialty] || FALLBACK_AVATARS['default']);

  // Fallbacks if database doesn't have these fields yet
  const experience = advisor.experience || '5 years';
  const sessions = advisor.sessions || '100+';
  const aboutText = advisor.about || `Specializing in cognitive behavioral therapy and anxiety disorders. Dedicated to helping individuals find peace and resilience.`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={{ width: 24 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            {advisor.imageUrl ? (
              <Image source={{ uri: advisor.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color="#9CA3AF" />
              </View>
            )}
            <View style={[
              styles.onlineDot,
              { backgroundColor: getAvailability(advisor.availability).color },
            ]} />
          </View>
          <Text style={styles.name}>{advisor.name}</Text>
          <Text style={styles.specialty}>{advisor.specialty}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>EXP.</Text>
            <Text style={styles.statValue}>{experience}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RATING</Text>
            <Text style={styles.statValue}>{advisor.rating != null ? String(advisor.rating) : '-'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>{sessions}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardText}>{aboutText}</Text>
        </View>

        <View style={styles.availabilityCard}>
          <View>
            <Text style={styles.availabilityLabel}>AVAILABILITY</Text>
            <View style={styles.availabilityRow}>
              <View style={[
                styles.availabilityDot,
                { backgroundColor: getAvailability(advisor.availability).color },
              ]} />
              <Text style={styles.availabilityValue}>
                {getAvailability(advisor.availability).label}
              </Text>
            </View>
          </View>
          <View style={styles.clockIconWrapper}>
            <Ionicons name="time-outline" size={24} color={COLORS.accentLight} />
          </View>
        </View>
      </ScrollView>

  
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdvisorChat', { advisor })}
          activeOpacity={0.85}
          style={styles.chatButton}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" />
            <Text style={styles.buttonText}>Chat</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
    padding: 4,
    backgroundColor: COLORS.white,
    borderRadius: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  specialty: {
    fontSize: 14,
    color: COLORS.accentLight,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 22,
  },
  availabilityCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  availabilityLabel: {
    fontSize: 10,
    color: COLORS.accentLight,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availabilityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  clockIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(120, 121, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: COLORS.background,
  },
  chatButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
