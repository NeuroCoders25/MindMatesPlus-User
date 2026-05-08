import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { COLORS } from '../services/dataService';
import { Button } from '../components/UI';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvisorDetails'>;

const FALLBACK_AVATARS: Record<string, any> = {
  'Clinical Psychologist': require('../assets/group_image1.jpg'),
  'Mental Health Advisor': require('../assets/group_image3.png'),
  'Depression Specialist': require('../assets/group_image4.jpeg'),
  default: require('../assets/group_image5.png'),
};

export const AdvisorDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { advisor } = route.params;
  const avatar = advisor.imageUrl ? { uri: advisor.imageUrl } : (FALLBACK_AVATARS[advisor.specialty] || FALLBACK_AVATARS['default']);

  // Fallbacks if database doesn't have these fields yet
  const experience = advisor.experience || '5 years';
  const sessions = advisor.sessions || '100+';
  const aboutText = advisor.about || `Specializing in cognitive behavioral therapy and anxiety disorders. Dedicated to helping individuals find peace and resilience.`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={{ width: 24 }} /> {/* Spacer */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Image source={avatar} style={styles.avatar} />
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.name}>{advisor.name}</Text>
          <Text style={styles.specialty}>{advisor.specialty}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>EXP.</Text>
            <Text style={styles.statValue}>{experience}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RATING</Text>
            <Text style={styles.statValue}>{advisor.rating}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>{sessions}</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardText}>{aboutText}</Text>
        </View>

        {/* Availability Section */}
        <View style={styles.availabilityCard}>
          <View>
            <Text style={styles.availabilityLabel}>NEXT AVAILABILITY</Text>
            <Text style={styles.availabilityValue}>{advisor.availability}</Text>
          </View>
          <View style={styles.clockIconWrapper}>
            <Ionicons name="time-outline" size={24} color={COLORS.accentLight} />
          </View>
        </View>
      </ScrollView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <Button
          onPress={() => navigation.navigate('AdvisorChat', { advisor })}
          variant="primary"
          style={styles.chatButton}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" />
            <Text style={styles.buttonText}>Live Chat</Text>
          </View>
        </Button>
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
  onlineDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
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
    borderRadius: 16,
    backgroundColor: COLORS.accent,
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
