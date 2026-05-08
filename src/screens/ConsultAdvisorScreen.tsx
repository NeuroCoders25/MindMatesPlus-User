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
    <Ionicons name="person-circle" size={52} color="#9CA3AF" />
  </View>
);

export const ConsultAdvisorScreen: React.FC<Props> = ({ navigation }) => {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedAdvisors, setConnectedAdvisors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAdvisors()
      .then(data => setAdvisors(data))
      .catch(err => console.error('Error fetching advisors:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = (advisor: Advisor) => {
    setConnectedAdvisors(prev => {
      const next = new Set(prev);
      next.add(advisor.id);
      return next;
    });
    navigation.navigate('AdvisorDetails', { advisor });
  };

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
                    <Text style={styles.ratingText}>{advisor.rating ?? '5.0'}</Text>
                  </View>
                </View>
                
                {!!advisor.specialty && (
                  <View style={styles.specialtyBadge}>
                    <Text style={styles.specialtyText}>{advisor.specialty}</Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <View style={styles.availabilityRow}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.availabilityText}>Available</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[
                      styles.connectBtn,
                      connectedAdvisors.has(advisor.id) && styles.connectedBtn
                    ]}
                    onPress={() => handleConnect(advisor)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.connectBtnText,
                      connectedAdvisors.has(advisor.id) && styles.connectedBtnText
                    ]}>
                      {connectedAdvisors.has(advisor.id) ? 'Connected' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
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
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 4,
    // Modern shadow
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.08)',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginRight: 16,
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginRight: 16,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  details: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  specialtyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  specialtyText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  availabilityText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '500',
  },
  connectBtn: {
    backgroundColor: '#6366F1', // Indigo from image
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  connectedBtn: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)', // Transparent gray
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  connectBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  connectedBtn: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)', // Transparent gray
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  connectedBtnText: {
    color: '#9CA3AF', // Gray text
  },
});
