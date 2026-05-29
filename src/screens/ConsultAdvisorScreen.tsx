import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import {
  COLORS,
  fetchAdvisors,
  connectToAdvisor,
  listenToUserAdvisorConnections,
  getAdvisorButtonStatus,
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

// ─── Button config per connection status ──────────────────────────────────────

type BtnConfig = { label: string; style: 'default' | 'muted' | 'green'; disabled: boolean };

const getBtnConfig = (
  advisorId: string,
  connections: Record<string, AdvisorConnectionStatusValue>,
  connecting: Set<string>
): BtnConfig => {
  if (connecting.has(advisorId)) return { label: 'Sending…', style: 'muted', disabled: true };
  const status = getAdvisorButtonStatus(advisorId, connections);
  switch (status) {
    case 'pending':  return { label: 'Pending',   style: 'muted',   disabled: true };
    case 'accepted': return { label: 'Connected', style: 'muted',   disabled: true };
    default:         return { label: 'Connect',   style: 'default', disabled: false };
  }
};

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
  const [connecting, setConnecting] = useState<Set<string>>(new Set());

  // Load advisors once
  useEffect(() => {
    fetchAdvisors()
      .then(data => setAdvisors(data))
      .catch(err => console.error('[ConsultAdvisor] Error fetching advisors:', err))
      .finally(() => setLoading(false));
  }, []);

  // Real-time listener for all advisor connections for this user
  useEffect(() => {
    if (!user) return;
    const unsub = listenToUserAdvisorConnections(user.id, incoming => {
      setConnections(incoming);
    });
    return unsub;
  }, [user]);

  const handleConnect = async (advisor: Advisor) => {
    if (!user) return;
    const status = getAdvisorButtonStatus(advisor.id, connections);

    // Active connection → navigate to advisor details (chat/status)
    if (status === 'pending' || status === 'accepted') {
      navigation.navigate('AdvisorDetails', { advisor });
      return;
    }

    setConnecting(prev => new Set(prev).add(advisor.id));
    try {
      await connectToAdvisor(user.id, user.name, user.email, advisor);
      // Real-time listener will update connections automatically
      Alert.alert(
        'Request Sent',
        `Your connection request has been sent to ${advisor.name}. You will be notified once they accept.`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('[ConsultAdvisor] Error connecting to advisor:', err);
      Alert.alert('Error', 'Failed to send connection request. Please try again.');
    } finally {
      setConnecting(prev => {
        const next = new Set(prev);
        next.delete(advisor.id);
        return next;
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={styles.backButton}>
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
          advisors.map(advisor => {
            const { label, style: btnStyle, disabled } = getBtnConfig(advisor.id, connections, connecting);
            const isPreviouslyApproved = connections[advisor.id] === 'approved';

            return (
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
                      {(() => {
                        const avail = getAvailability(advisor.availability);
                        return (
                          <>
                            <View style={[styles.onlineDot, { backgroundColor: avail.color }]} />
                            <Text style={styles.availabilityText}>{avail.label}</Text>
                          </>
                        );
                      })()}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.connectBtn,
                        btnStyle === 'muted' && styles.connectBtnMuted,
                        btnStyle === 'green' && styles.connectBtnGreen,
                      ]}
                      onPress={() => handleConnect(advisor)}
                      disabled={disabled}
                      activeOpacity={0.8}
                    >
                      {connecting.has(advisor.id) ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                      ) : (
                        <Text style={[
                          styles.connectBtnText,
                          btnStyle === 'muted' && styles.connectBtnTextMuted,
                          btnStyle === 'green' && styles.connectBtnTextGreen,
                        ]}>
                          {label}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
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

  connectBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 82,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  connectBtnMuted: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  connectBtnGreen: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
  },
  connectBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  connectBtnTextMuted: { color: '#9CA3AF' },
  connectBtnTextGreen: { color: 'white' },
});
