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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import {
  COLORS,
  fetchAdvisors,
  listenToUserAdvisorConnections,
  AdvisorConnectionStatusValue,
} from '../services/dataService';
import { Advisor } from '../types';
import { useApp } from '../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsultAdvisor'>;

const AvatarPlaceholder = () => (
  <View style={styles.avatarPlaceholder}>
    <Ionicons name="person-circle" size={52} color="#9CA3AF" />
  </View>
);

// ─── Availability config ──────────────────────────────────────────────────────

const AVAILABILITY: Record<string, { label: string; color: string }> = {
  online:  { label: 'Online',  color: '#10B981' },
  busy:    { label: 'Busy',    color: '#F59E0B' },
  away:    { label: 'Away',    color: '#6B7280' },
  offline: { label: 'Offline', color: '#9CA3AF' },
};

const getAvailability = (raw: string | undefined) =>
  AVAILABILITY[(raw ?? '').toLowerCase()] ?? { label: 'Online', color: '#10B981' };

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ConsultAdvisorScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useApp();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Record<string, AdvisorConnectionStatusValue>>({});

  useEffect(() => {
    fetchAdvisors()
      .then(data => setAdvisors(data))
      .catch(err => console.error('[ConsultAdvisor] Error fetching advisors:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToUserAdvisorConnections(user.id, incoming => {
      setConnections(incoming);
    });
    return unsub;
  }, [user]);

  const activeAdvisorId = Object.entries(connections).find(
    ([, s]) => s === 'pending' || s === 'accepted' || s === 'reviewed',
  )?.[0] ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consult Advisor</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.description}>
        Please select a professional advisor to help you navigate through this difficult time.
      </Text>

      {activeAdvisorId && (
        <View style={styles.lockBanner}>
          <Ionicons name="lock-closed-outline" size={14} color="#92400E" />
          <Text style={styles.lockBannerText}>
            You have an active request. Cancel it to select a different advisor.
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : advisors.length === 0 ? (
          <Text style={styles.emptyText}>No advisors available at the moment.</Text>
        ) : (
          advisors.map(advisor => {
            const status = connections[advisor.id];
            const isPreviouslyApproved = status === 'approved';
            const avail = getAvailability(advisor.availability);
            const isDisabled = !!activeAdvisorId && advisor.id !== activeAdvisorId;

            return (
              <TouchableOpacity
                key={advisor.id}
                style={[styles.card, isDisabled && styles.cardDisabled]}
                activeOpacity={isDisabled ? 1 : 0.7}
                disabled={isDisabled}
                onPress={() => navigation.navigate('CriticalAdvisorDetails', { advisor, flow: 'critical' })}
              >
                {advisor.imageUrl
                  ? <Image source={{ uri: advisor.imageUrl }} style={styles.avatar} />
                  : <AvatarPlaceholder />}

                <View style={styles.details}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{advisor.name ?? ''}</Text>
                    <View style={styles.ratingBox}>
                      <Ionicons name="star" size={12} color="#FACC15" />
                      <Text style={styles.ratingText}>
                        {advisor.rating != null ? String(advisor.rating) : '-'}
                      </Text>
                    </View>
                  </View>

                  {!!advisor.specialty && (
                    <View style={styles.specialtyBadge}>
                      <Text style={styles.specialtyText}>{advisor.specialty}</Text>
                    </View>
                  )}

                  {isPreviouslyApproved && (
                    <View style={styles.approvedBanner}>
                      <Ionicons name="shield-checkmark-outline" size={12} color="#15803D" />
                      <Text style={styles.approvedBannerText}>Previously approved</Text>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.availabilityRow}>
                      <View style={[styles.onlineDot, { backgroundColor: avail.color }]} />
                      <Text style={styles.availabilityText}>{avail.label}</Text>
                    </View>

                    {status === 'pending' ? (
                      <View style={[styles.statusPill, styles.statusPillPending]}>
                        <Text style={[styles.statusPillText, styles.statusPillTextPending]}>
                          Requested
                        </Text>
                      </View>
                    ) : status === 'accepted' || status === 'reviewed' ? (
                      <View style={[styles.statusPill, styles.statusPillAccepted]}>
                        <Text style={[styles.statusPillText, styles.statusPillTextAccepted]}>
                          Connected
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.chevronWrap}>
                        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  headerSpacer: { width: 24 },
  description: {
    fontSize: 14,
    color: COLORS.muted,
    paddingHorizontal: 24,
    marginBottom: 24,
    lineHeight: 22,
  },
  listContainer: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: COLORS.muted, marginTop: 40 },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 4,
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
  name: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: { fontSize: 11, fontWeight: '800', color: '#D97706' },
  specialtyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  specialtyText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  approvedBannerText: { fontSize: 10, color: '#15803D', fontWeight: '600' },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  availabilityText: { fontSize: 12, color: COLORS.muted, fontWeight: '500' },

  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  statusPillPending: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusPillAccepted: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statusPillTextPending: { color: '#9CA3AF' },
  statusPillTextAccepted: { color: '#16A34A' },
  chevronWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDisabled: {
    opacity: 0.4,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lockBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    lineHeight: 18,
  },
});
