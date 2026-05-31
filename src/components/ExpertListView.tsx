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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import {
  COLORS,
  fetchAdvisors,
  requestExpertListener,
  ListenerConnection,
} from '../services/dataService';
import { Advisor } from '../types';
import { useApp } from '../context/AppContext';

// ─── Availability config ──────────────────────────────────────────────────────

const AVAILABILITY: Record<string, { label: string; color: string }> = {
  online:  { label: 'Online',  color: '#10B981' },
  busy:    { label: 'Busy',    color: '#F59E0B' },
  away:    { label: 'Away',    color: '#6B7280' },
  offline: { label: 'Offline', color: '#9CA3AF' },
};

const getAvailability = (raw: string | undefined) =>
  AVAILABILITY[(raw ?? '').toLowerCase()] ?? { label: 'Online', color: '#10B981' };

// ─── Avatar fallback ──────────────────────────────────────────────────────────

const AvatarPlaceholder: React.FC = () => (
  <View style={styles.avatarPlaceholder}>
    <Ionicons name="person-circle" size={52} color="#9CA3AF" />
  </View>
);

// ─── Button config ────────────────────────────────────────────────────────────

type BtnConfig = {
  label: string;
  style: 'primary' | 'muted' | 'green';
  disabled: boolean;
};

const getActiveConnection = (
  advisorId: string,
  connections: ListenerConnection[],
): ListenerConnection | undefined =>
  connections.find(
    c => c.advisorId === advisorId &&
      (c.status === 'pending' || c.status === 'accepted' || c.status === 'reviewed'),
  );

const getBtnConfig = (
  advisorId: string,
  connections: ListenerConnection[],
  connectingId: string | null,
): BtnConfig => {
  if (connectingId === advisorId) return { label: 'Sending…', style: 'muted', disabled: true };
  const conn = getActiveConnection(advisorId, connections);
  if (!conn) return { label: 'Connect', style: 'primary', disabled: false };
  if (conn.status === 'accepted' || conn.status === 'reviewed') {
    return { label: 'Chat', style: 'green', disabled: false };
  }
  return { label: 'Pending', style: 'muted', disabled: true };
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ExpertListView: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, listenerConnections } = useApp();

  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAdvisors()
      .then(data => setAdvisors(data))
      .catch(err => console.error('[ExpertListView] fetchAdvisors error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (advisor: Advisor) => {
    if (!user) return;

    const conn = getActiveConnection(advisor.id, listenerConnections);

    if (conn?.status === 'accepted' || conn?.status === 'reviewed') {
      navigation.navigate('AdvisorChat', { advisor });
      return;
    }

    if (conn?.status === 'pending') return;

    setConnectingId(advisor.id);
    const result = await requestExpertListener({
      userId: user.id,
      userNickname: user.nickname ?? user.name ?? 'Student',
      advisorId: advisor.id,
    });
    setConnectingId(null);

    if (result.success) {
      Alert.alert(
        'Request Sent',
        `Your request has been sent to ${advisor.name}. They will respond based on availability.`,
        [{ text: 'OK' }],
      );
    } else if (result.alreadyConnected) {
      Alert.alert(
        'Already Connected',
        `You already have an active request with ${advisor.name}.`,
        [{ text: 'OK' }],
      );
    } else {
      Alert.alert('Could not connect', 'Something went wrong creating your request. Please try again.');
      console.error('[ExpertListView] requestExpertListener failed for advisor', advisor.id);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContainer}
    >
      {/* Intro banner */}
      <View style={styles.introBanner}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#6C63FF" />
        <Text style={styles.introText}>
          Talk to a real counselor. Connect with a verified expert for one-on-one support.
          Response times vary by availability.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : advisors.length === 0 ? (
        <Text style={styles.emptyText}>No advisors available at the moment.</Text>
      ) : (
        advisors.map(advisor => {
          const { label, style: btnStyle, disabled } = getBtnConfig(
            advisor.id,
            listenerConnections,
            connectingId,
          );
          const avail = getAvailability(advisor.availability);

          return (
            <View key={advisor.id} style={styles.card}>
              {advisor.imageUrl
                ? <Image source={{ uri: advisor.imageUrl }} style={styles.avatar} />
                : <AvatarPlaceholder />}

              <View style={styles.details}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{advisor.name ?? ''}</Text>
                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={12} color="#FACC15" />
                    <Text style={styles.ratingText}>
                      {advisor.rating != null ? String(advisor.rating) : '–'}
                    </Text>
                  </View>
                </View>

                {!!advisor.specialty && (
                  <View style={styles.specialtyBadge}>
                    <Text style={styles.specialtyText}>{advisor.specialty}</Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <View style={styles.availabilityRow}>
                    <View style={[styles.onlineDot, { backgroundColor: avail.color }]} />
                    <Text style={styles.availabilityText}>{avail.label}</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.connectBtn,
                      btnStyle === 'muted'  && styles.connectBtnMuted,
                      btnStyle === 'green'  && styles.connectBtnGreen,
                    ]}
                    onPress={() => handleConnect(advisor)}
                    disabled={disabled}
                    activeOpacity={0.8}
                  >
                    {connectingId === advisor.id ? (
                      <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                      <Text style={[
                        styles.connectBtnText,
                        btnStyle === 'muted'  && styles.connectBtnTextMuted,
                        btnStyle === 'green'  && styles.connectBtnTextGreen,
                      ]}>
                        {label}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 14,
  },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: COLORS.muted, marginTop: 40 },

  introBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 4,
  },
  introText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 19,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
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
