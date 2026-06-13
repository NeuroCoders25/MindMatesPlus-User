import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import {
  COLORS,
  requestExpertListener,
  cancelCriticalRequest,
  ListenerConnection,
  getCaseTypeFromCategory,
  listenToAdvisorConnection,
  AdvisorConnection,
  fetchAdvisorReviews,
  AdvisorReview,
} from '../services/dataService';
import { getPaymentQuote, cancelBooking, PaymentQuote } from '../services/paymentService';
import { useApp } from '../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvisorDetails' | 'CriticalAdvisorDetails'>;

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

const fmtUSD = (amount: number | undefined | null, fallback = 10): string => {
  const n = Number(amount);
  if (amount == null || isNaN(n)) return `$${fallback.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
};

const ACTIVE_PAYMENT_STATUSES = new Set(['pending_payment', 'paid', 'trial']);

const getActiveListenerConn = (
  advisorId: string,
  connections: ListenerConnection[],
): ListenerConnection | undefined =>
  connections.find(
    c =>
      c.advisorId === advisorId &&
      (c.status === 'pending' || c.status === 'accepted' || c.status === 'reviewed'),
  );

export const AdvisorDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { advisor } = route.params;
  const { user, listenerConnections, mentalHealthProfile } = useApp();

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<AdvisorReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Critical flow state
  const [criticalConn, setCriticalConn] = useState<AdvisorConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [cancellingCritical, setCancellingCritical] = useState(false);

  const flow = route.params?.flow ?? 'listener';
  const isCriticalFlow = flow === 'critical';

  // Subscribe to critical connection in real-time so the button updates immediately
  // when the advisor accepts.
  useEffect(() => {
    if (!isCriticalFlow || !user) return;
    const unsub = listenToAdvisorConnection(user.id, advisor.id, conn => {
      setCriticalConn(conn);
    });
    return unsub;
  }, [isCriticalFlow, user?.id, advisor.id]);

  // Safety correction: if routed as listener but profile says severe/critical, flip to critical.
  // Never correct the reverse — when in doubt, give the free flow.
  useEffect(() => {
    if (flow === 'listener' && mentalHealthProfile?.groupCategory) {
      const derived = getCaseTypeFromCategory(mentalHealthProfile.groupCategory);
      if (derived === 'critical_case') {
        console.warn(
          '[AdvisorDetails] flow corrected listener → critical for category:',
          mentalHealthProfile.groupCategory,
        );
        navigation.setParams({ flow: 'critical' });
      }
    }
  }, [mentalHealthProfile?.groupCategory, flow]);

  const conn = getActiveListenerConn(advisor.id, listenerConnections);
  const canCancel =
    conn?.status === 'pending' && ACTIVE_PAYMENT_STATUSES.has(conn.paymentStatus ?? '');
  const hasActiveConn = !!conn;

  // Listener: another advisor holds an active booking lock
  const lockedByOther = !isCriticalFlow && listenerConnections.some(
    c => c.advisorId !== advisor.id &&
      (c.status === 'pending' || c.status === 'accepted') &&
      ACTIVE_PAYMENT_STATUSES.has(c.paymentStatus ?? ''),
  );

  const experience = advisor.experience ?? '-';
  const sessions   = advisor.sessions   ?? '100+';
  const aboutText  = advisor.about      ?? `Specializing in cognitive behavioral therapy and anxiety disorders. Dedicated to helping individuals find peace and resilience.`;

  const handleOpenReviews = async () => {
    setShowReviews(true);
    if (reviews.length > 0) return;
    setLoadingReviews(true);
    const data = await fetchAdvisorReviews(advisor.id);
    setReviews(data);
    setLoadingReviews(false);
  };

  const handleBookSession = async () => {
    if (!user) return;
    setLoadingQuote(true);
    try {
      const raw = await getPaymentQuote(advisor.id, user.id) as any;
      // Backend may return baseFeeUSD / finalFeeUSD; normalise to safe numbers
      const safeBase     = Number(raw?.baseFeeUSD     ?? raw?.baseFee)     || 10;
      const safeDiscount = Number(raw?.discountPercent)                    || 0;
      const safeFinal    = Number(raw?.finalFeeUSD    ?? raw?.totalFee)    || safeBase;
      setQuote({
        baseFee:         safeBase,
        discountPercent: safeDiscount,
        badgeTierName:   raw?.badgeTierName,
        totalFee:        safeFinal,
      });
      setShowModal(true);
    } catch {
      Alert.alert('Error', 'Could not fetch pricing. Please try again.');
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!user || !quote) return;
    setBooking(true);
    try {
      const result = await requestExpertListener({
        userId:         user.id,
        userNickname:   user.nickname ?? user.name ?? 'Student',
        advisorId:      advisor.id,
        paymentStatus:  'pending_payment',
        forcedCaseType: 'listener_support',
      });

      if (!result.success) {
        if ((result as any).alreadyConnected) {
          Alert.alert('Already Connected', 'You already have an active booking with this advisor.');
        } else {
          Alert.alert('Error', 'Could not create booking. Please try again.');
        }
        setShowModal(false);
        return;
      }

      setShowModal(false);
      navigation.navigate('Payment', {
        connectionId: result.connectionId,
        advisorId:    advisor.id,
        advisorName:  advisor.name,
        quote,
      });
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const handleCancelBooking = () => {
    if (!user || !conn) return;
    Alert.alert(
      'Cancel Booking',
      'Cancel this booking? Your demo payment will be refunded.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelBooking(conn.id, user.id);
            } catch (err: any) {
              if (err?.status === 409) {
                Alert.alert(
                  'Cannot Cancel',
                  'The advisor has already accepted — cancellation is no longer available.',
                );
              } else {
                Alert.alert('Error', 'Could not cancel the booking. Please try again.');
              }
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleCriticalConnect = () => {
    Alert.alert(
      `Connect with ${advisor.name}?`,
      "You'll get free advisor support for 7 days. The advisor will be notified of your request.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            if (!user || connecting) return;
            setConnecting(true);
            try {
              const result = await requestExpertListener({
                userId:         user.id,
                userNickname:   user.nickname ?? user.name ?? 'Student',
                advisorId:      advisor.id,
                forcedCaseType: 'critical_case',
              });
              if (result.success) {
                setCriticalConn({
                  connectionId: result.connectionId,
                  advisorId:    advisor.id,
                  advisorName:  advisor.name,
                  userId:       user.id,
                  userName:     user.name,
                  status:       'pending',
                  caseType:     'critical_case',
                });
              } else if ((result as any).alreadyConnected) {
                Alert.alert('Already Requested', 'You already have a pending request with this advisor.');
                // Listener will automatically update criticalConn state
              } else {
                Alert.alert('Error', 'Could not send request. Please try again.');
              }
            } catch {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setConnecting(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelCriticalRequest = () => {
    Alert.alert(
      'Cancel Request',
      `Are you sure you want to cancel your request to ${advisor.name}? You can send a new request at any time.`,
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            if (!user || cancellingCritical) return;
            setCancellingCritical(true);
            try {
              const result = await cancelCriticalRequest(user.id, advisor.id);
              if (!result.success) {
                if (result.alreadyAccepted) {
                  Alert.alert(
                    'Cannot Cancel',
                    'The advisor has already accepted your request — cancellation is no longer available.',
                  );
                } else {
                  Alert.alert('Error', 'Could not cancel the request. Please try again.');
                }
              }
              // On success the real-time listener (listenToAdvisorConnection) will
              // automatically clear criticalConn, showing the Connect button again.
            } catch {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setCancellingCritical(false);
            }
          },
        },
      ],
    );
  };

  const avail = getAvailability(advisor.availability);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            <View style={[styles.onlineDot, { backgroundColor: avail.color }]} />
          </View>
          <Text style={styles.name}>{advisor.name}</Text>
          <Text style={styles.specialty}>{advisor.specialty}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>EXP.</Text>
            <Text style={styles.statValue}>{experience}</Text>
          </View>
          <TouchableOpacity style={styles.statBox} onPress={handleOpenReviews} activeOpacity={0.7}>
            <Text style={styles.statLabel}>RATING</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.statValue}>
                {advisor.rating != null ? String(advisor.rating) : '-'}
              </Text>
            </View>
            {advisor.rating != null && (
              <Text style={styles.tapHint}>tap to view</Text>
            )}
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>{sessions}</Text>
          </View>
        </View>

        {/* Session fee display */}
        {isCriticalFlow ? (
          <View style={styles.freeNoteCard}>
            <Text style={styles.freeNoteText}>
              💙 Free advisor support — 7 days included
            </Text>
          </View>
        ) : (
          <View style={styles.feeCard}>
            <View style={styles.feeRow}>
              <Ionicons name="wallet-outline" size={18} color="#1E3A8A" />
              <Text style={styles.feeLabel}>Session fee:</Text>
              <Text style={styles.feeValue}>
                {advisor.sessionFeeUSD != null
                  ? `${fmtUSD(advisor.sessionFeeUSD)}/session`
                  : '$10.00/session (default)'}
              </Text>
            </View>
            <Text style={styles.feeDesc}>
              {advisor.feeDescription || 'per week of chat support'}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.cardText}>{aboutText}</Text>
        </View>

        <View style={styles.availabilityCard}>
          <View>
            <Text style={styles.availabilityLabel}>AVAILABILITY</Text>
            <View style={styles.availabilityRow}>
              <View style={[styles.availabilityDot, { backgroundColor: avail.color }]} />
              <Text style={styles.availabilityValue}>{avail.label}</Text>
            </View>
          </View>
          <View style={styles.clockIconWrapper}>
            <Ionicons name="time-outline" size={24} color={COLORS.accentLight} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isCriticalFlow ? (
          criticalConn?.status === 'accepted' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('AdvisorChat', { advisor })}
              activeOpacity={0.85}
              style={styles.chatButton}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" />
                <Text style={styles.buttonText}>Open Chat</Text>
              </View>
            </TouchableOpacity>
          ) : criticalConn?.status === 'pending' ? (
            <View style={styles.pendingFooter}>
              <View style={styles.pendingInfo}>
                <Ionicons name="time-outline" size={16} color="#D97706" />
                <Text style={styles.pendingInfoText}>Request sent — awaiting advisor response</Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelCriticalRequest}
                activeOpacity={0.85}
                style={styles.cancelButton}
                disabled={cancellingCritical}
              >
                {cancellingCritical ? (
                  <ActivityIndicator color="#DC2626" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                    <Text style={styles.cancelButtonText}>Cancel Request</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCriticalConnect}
              activeOpacity={0.85}
              style={[styles.bookButton, connecting && { opacity: 0.6 }]}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator color="white" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="link-outline" size={20} color="white" />
                  <Text style={styles.buttonText}>Connect</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        ) : (
          conn?.status === 'accepted' || conn?.status === 'reviewed' ? (
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
          ) : canCancel ? (
            <TouchableOpacity
              onPress={handleCancelBooking}
              activeOpacity={0.85}
              style={styles.cancelButton}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                  <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : hasActiveConn ? (
            <View style={[styles.chatButton, styles.pendingButton]}>
              <View style={styles.buttonContent}>
                <Ionicons name="time-outline" size={20} color="#D97706" />
                <Text style={[styles.buttonText, { color: '#D97706' }]}>Pending Advisor Response</Text>
              </View>
            </View>
          ) : lockedByOther ? (
            <View style={styles.lockBar}>
              <Ionicons name="lock-closed-outline" size={16} color="#92400E" />
              <Text style={styles.lockBarText}>
                Another advisor session is active. Cancel it first to book here.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleBookSession}
              activeOpacity={0.85}
              style={styles.bookButton}
              disabled={loadingQuote}
            >
              {loadingQuote ? (
                <ActivityIndicator color="white" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="link-outline" size={20} color="white" />
                  <Text style={styles.buttonText}>Book Session</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Reviews modal */}
      <Modal visible={showReviews} transparent animationType="slide" onRequestClose={() => setShowReviews(false)}>
        <View style={modal.overlay}>
          <View style={[modal.sheet, { maxHeight: '80%' }]}>
            <View style={modal.handle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={modal.title}>Reviews</Text>
              <TouchableOpacity onPress={() => setShowReviews(false)}>
                <Ionicons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            {advisor.rating != null && (
              <View style={reviews_.summaryRow}>
                <Ionicons name="star" size={28} color="#F59E0B" />
                <Text style={reviews_.bigRating}>{advisor.rating}</Text>
                <Text style={reviews_.outOf}>/ 5</Text>
              </View>
            )}
            {loadingReviews ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
            ) : reviews.length === 0 ? (
              <Text style={reviews_.empty}>No reviews yet.</Text>
            ) : (
              <FlatList
                data={reviews}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                style={{ marginTop: 8 }}
                renderItem={({ item }) => (
                  <View style={reviews_.card}>
                    <View style={reviews_.cardHeader}>
                      <View style={reviews_.avatar}>
                        <Text style={reviews_.avatarText}>
                          {item.userNickname.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={reviews_.nickname}>{item.userNickname}</Text>
                        <View style={reviews_.stars}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Ionicons
                              key={s}
                              name={s <= item.rating ? 'star' : 'star-outline'}
                              size={13}
                              color="#F59E0B"
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={reviews_.date}>
                        {item.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    {item.comment.length > 0 && (
                      <Text style={reviews_.comment}>{item.comment}</Text>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Booking quote modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />
            <Text style={modal.title}>Booking Summary</Text>
            <Text style={modal.subtitle}>Session with {advisor.name}</Text>

            {quote && (
              <View style={modal.summaryCard}>
                <View style={modal.row}>
                  <Text style={modal.rowLabel}>Base fee</Text>
                  <Text style={modal.rowValue}>{fmtUSD(quote.baseFee)}</Text>
                </View>
                {quote.discountPercent > 0 && (
                  <View style={modal.row}>
                    <Text style={modal.rowLabel}>
                      {quote.badgeTierName
                        ? `Badge discount (${quote.badgeTierName})`
                        : 'Badge discount'}
                    </Text>
                    <Text style={[modal.rowValue, modal.discountValue]}>
                      -{quote.discountPercent}%
                    </Text>
                  </View>
                )}
                <View style={modal.divider} />
                <View style={modal.row}>
                  <Text style={modal.totalLabel}>Total</Text>
                  <Text style={modal.totalValue}>{fmtUSD(quote.totalFee)}</Text>
                </View>
              </View>
            )}

            <View style={modal.btnRow}>
              <TouchableOpacity
                style={modal.cancelBtn}
                onPress={() => setShowModal(false)}
                activeOpacity={0.8}
              >
                <Text style={modal.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modal.proceedBtn, booking && modal.proceedBtnDisabled]}
                onPress={handleProceedToPayment}
                disabled={booking}
                activeOpacity={0.85}
              >
                {booking ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={modal.proceedBtnText}>Proceed to Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: { padding: 4 },
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
    marginBottom: 20,
  },
  statBox: { alignItems: 'center' },
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapHint: {
    fontSize: 9,
    color: COLORS.accentLight,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  freeNoteCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  freeNoteText: {
    fontSize: 14,
    color: '#1E40AF',
    fontWeight: '600',
    textAlign: 'center',
  },
  feeCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 6,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feeLabel: { fontSize: 14, color: '#1E3A8A', fontWeight: '600' },
  feeValue: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },
  feeDesc: { fontSize: 12, color: '#4338CA', lineHeight: 18 },

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
  bookButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pendingButton: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingFooter: {
    gap: 12,
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingInfoText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },
  lockBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  lockBarText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
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

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: -8 },

  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: COLORS.muted },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  discountValue: { color: '#16A34A' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 2 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1E3A8A' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
  proceedBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
  },
  proceedBtnDisabled: { opacity: 0.6 },
  proceedBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },
});

const reviews_ = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  bigRating: { fontSize: 32, fontWeight: '800', color: COLORS.text },
  outOf: { fontSize: 16, color: COLORS.muted, alignSelf: 'flex-end', marginBottom: 4 },
  empty: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginTop: 24, marginBottom: 8 },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: 'white', fontWeight: '700', fontSize: 15 },
  nickname: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  stars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  date: { fontSize: 11, color: COLORS.muted },
  comment: { fontSize: 13, color: COLORS.muted, lineHeight: 19 },
});
