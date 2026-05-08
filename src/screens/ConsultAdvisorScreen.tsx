import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { COLORS, fetchAdvisors } from '../services/dataService';
import { Advisor } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsultAdvisor'>;

const AvatarPlaceholder = () => (
  <View style={styles.avatarPlaceholder}>
    <Ionicons name="person-circle" size={52} color={COLORS.primary} />
  </View>
);

export const ConsultAdvisorScreen: React.FC<Props> = ({ navigation }) => {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdvisors()
      .then(data => setAdvisors(data))
      .catch(err => console.error('Error fetching advisors:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consult Advisor</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.description}>
        Please select a professional advisor to help you navigate through this difficult time.
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : advisors.length === 0 ? (
          <Text style={styles.emptyText}>No advisors available at the moment.</Text>
        ) : (
          advisors.map(advisor => (
            <TouchableOpacity
              key={advisor.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AdvisorDetails', { advisor })}
            >
              {advisor.imageUrl
                ? <Image source={{ uri: advisor.imageUrl }} style={styles.avatar} />
                : <AvatarPlaceholder />}
              <View style={styles.details}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{advisor.name ?? ''}</Text>
                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={12} color="#FACC15" />
                    {advisor.rating != null && (
                      <Text style={styles.ratingText}>{advisor.rating}</Text>
                    )}
                  </View>
                </View>
                {!!advisor.specialty && (
                  <Text style={styles.specialty}>{advisor.specialty}</Text>
                )}
                <View style={styles.availabilityRow}>
                  <Ionicons name="time-outline" size={12} color={COLORS.muted} />
                  <Text style={styles.availabilityText}>
                    {advisor.availability ? `Available: ${advisor.availability}` : 'Available'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    paddingBottom: 20,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSpacer: { width: 24 },
  description: {
    fontSize: 14,
    color: COLORS.muted,
    paddingHorizontal: 24,
    marginBottom: 24,
    lineHeight: 22,
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 16,
  },
  loader: { marginTop: 40 },
  emptyText: {
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginRight: 16,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FACC15',
  },
  specialty: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availabilityText: {
    fontSize: 11,
    color: COLORS.muted,
  },
});
