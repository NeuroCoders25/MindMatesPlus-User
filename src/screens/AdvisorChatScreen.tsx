import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import {
  COLORS,
  AdvisorMessage,
  listenToAdvisorConnection,
  listenToAdvisorConnectionMessages,
  sendUserAdvisorMessage,
  hasUserRatedAdvisor,
  markChatRead,
  getLastReadAt,
  fetchAdvisorById,
} from '../services/dataService';
import { getPaymentQuote, PaymentQuote } from '../services/paymentService';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { useApp } from '../context/AppContext';
import { AdvisorRatingModal } from '../components/AdvisorRatingModal';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvisorChat'>;

type ConnectionStatus = 'pending' | 'accepted' | 'reviewed' | 'system_approved';

const fmtUSD = (amount: number | undefined | null, fallback = 10): string => {
  const n = Number(amount);
  if (amount == null || isNaN(n)) return `$${fallback.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
};

export const AdvisorChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { advisor } = route.params;
  const { user } = useApp();
  const [advisorImageUrl, setAdvisorImageUrl] = useState<string | undefined>(advisor.imageUrl);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [caseType, setCaseType] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [canRate, setCanRate] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const listRef = useRef<FlatList>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);
  const lastReadAtRef = useRef<Date | null>(null);
  const initializedRef = useRef(false);
  const hasScrolledRef = useRef(false);

  const [paymentStatus, setPaymentStatus] = useState<string | undefined>(undefined);
  const [paymentQuote, setPaymentQuote] = useState<PaymentQuote | null>(null);

  useEffect(() => {
    if (advisorImageUrl) return;
    fetchAdvisorById(advisor.id)
      .then(a => { if (a?.imageUrl) setAdvisorImageUrl(a.imageUrl); })
      .catch(() => {});
  }, [advisor.id, advisorImageUrl]);

  // ── Trial state (critical_case only) ──────────────────────────────────────
  const isCritical = caseType === 'critical_case';
  const { trialStatus, loading: loadingTrial, refetch, livePaymentStatus } =
    useTrialStatus(connectionId, caseType);

  // Firestore live value overrides the initial paymentStatus from findAdvisorConnection.
  // This is what makes the lock card disappear the moment the backend confirms payment.
  const effectivePaymentStatus = livePaymentStatus ?? paymentStatus;

  // Spec gates (Step 1)
  const isApproved =
    effectivePaymentStatus === 'not_required' || connectionStatus === 'system_approved';
  const isPaid = effectivePaymentStatus === 'paid';

  const trialExpired = isCritical && (trialStatus?.expired === true) && !isApproved && !isPaid;
  const trialActive =
    isCritical &&
    effectivePaymentStatus === 'trial' &&
    !(trialStatus?.expired) &&
    (trialStatus?.daysLeft ?? 0) > 0 &&
    !isApproved;

  // ── Connection / quote load ───────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const unsub = listenToAdvisorConnection(user.id, advisor.id, conn => {
      if (conn) {
        setConnectionId(conn.connectionId);
        setConnectionStatus(conn.status as ConnectionStatus);
        setCaseType(conn.caseType);
        setPaymentStatus(conn.paymentStatus);
      }
      setLoadingConnection(false);
    });
    return unsub;
  }, [user?.id, advisor.id]);

  // Fetch payment quote so lock card can show a price immediately.
  useEffect(() => {
    if (!connectionId || !isCritical || !user) return;
    getPaymentQuote(advisor.id, user.id)
      .then(setPaymentQuote)
      .catch(err => console.warn('[AdvisorChat] quote fetch failed:', err));
  }, [advisor.id, connectionId, isCritical, user]);

  useEffect(() => {
    if (!user || !connectionId) return;
    hasUserRatedAdvisor(user.id, advisor.id, connectionId)
      .then(rated => setCanRate(!rated))
      .catch(() => setCanRate(false));
  }, [user, advisor.id, connectionId]);

  // ── Message listener ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!connectionId) return;

    lastReadAtRef.current = null;
    initializedRef.current = false;
    hasScrolledRef.current = false;
    setUnreadCount(0);
    setFirstUnreadIndex(null);

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      lastReadAtRef.current = await getLastReadAt(connectionId, 'advisor');
      if (cancelled) return;

      unsubscribe = listenToAdvisorConnectionMessages(connectionId, incoming => {
        setMessages(incoming);

        if (!initializedRef.current) {
          const lastRead = lastReadAtRef.current;
          if (lastRead) {
            let idx = -1;
            let count = 0;
            incoming.forEach((m, i) => {
              if (m.createdAt > lastRead && m.senderRole === 'advisor') {
                if (idx === -1) idx = i;
                count++;
              }
            });
            setUnreadCount(count);
            setFirstUnreadIndex(idx >= 0 ? idx : null);
          }
          initializedRef.current = true;
        }
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      initializedRef.current = false;
      hasScrolledRef.current = false;
    };
  }, [connectionId]);

  // Re-fetch trial status on focus (backup for returning from PaymentScreen),
  // and mark chat read on blur.
  useFocusEffect(
    useCallback(() => {
      if (isCritical && connectionId) refetch();
      return () => {
        if (connectionId) markChatRead(connectionId, 'advisor');
      };
    }, [connectionId, isCritical, refetch]),
  );

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !connectionId || !user) return;
    if (connectionStatus !== 'accepted' && connectionStatus !== 'system_approved') return;
    if (sendLocked) return;
    setSending(true);
    setInput('');
    try {
      await sendUserAdvisorMessage(connectionId, user.id, advisor.id, text);
    } catch (err) {
      console.error('[AdvisorChat] Send failed:', err);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  // isReadOnly: pending/reviewed lock the whole chat; system_approved = full access.
  const isReadOnly =
    connectionStatus !== 'accepted' && connectionStatus !== 'system_approved';
  // sendLocked: trial window closed and user hasn't paid / been approved.
  const sendLocked = !isReadOnly && trialExpired && !isPaid && !isApproved;

  // ── Rendering ─────────────────────────────────────────────────────────────

  const renderStatusBanner = () => {
    if (connectionStatus === 'pending') {
      return (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={14} color="#D97706" />
          <Text style={styles.pendingText}>Waiting for advisor to accept your request</Text>
        </View>
      );
    }
    if (connectionStatus === 'reviewed') {
      return (
        <View style={styles.reviewedBanner}>
          <Ionicons name="checkmark-circle-outline" size={14} color="#6B7280" />
          <Text style={styles.reviewedText}>This case has been reviewed and is now closed</Text>
        </View>
      );
    }
    return null;
  };

  // Small chip at the top of the message list — calm blue, never red/orange.
  // Only for critical_case while the trial is live. Never shown when approved/paid.
  const renderCountdownPill = () => {
    if (!trialActive) return null;
    const daysLeft = trialStatus?.daysLeft ?? 0;
    const hoursLeft = trialStatus?.hoursLeft;
    const label =
      daysLeft <= 1 && hoursLeft != null
        ? `🕐 Free session · ${hoursLeft}h left`
        : `🕐 Free session · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    return (
      <View style={styles.countdownPill}>
        <Text style={styles.countdownText}>{label}</Text>
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: AdvisorMessage; index: number }) => {
    const showDivider = firstUnreadIndex === index && unreadCount > 0;
    const isUser = item.senderRole === 'user';
    return (
      <View>
        {showDivider && (
          <View style={styles.unreadDivider}>
            <View style={styles.unreadLine} />
            <Text style={styles.unreadLabel}>
              {unreadCount} new message{unreadCount > 1 ? 's' : ''}
            </Text>
            <View style={styles.unreadLine} />
          </View>
        )}
        <View style={[styles.msgWrapper, isUser ? styles.userSide : styles.advisorSide]}>
          {!isUser && <Text style={styles.senderLabel}>{advisor.name}</Text>}
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.advisorBubble]}>
            <Text style={isUser ? styles.userText : styles.advisorText}>
              {item.messageText}
            </Text>
          </View>
          <Text style={styles.timestamp}>
            {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = (showStatus = true) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.headerProfile}>
        <View style={styles.headerAvatarCircle}>
          {advisorImageUrl ? (
            <Image source={{ uri: advisorImageUrl }} style={styles.headerAvatarImage} />
          ) : (
            <Ionicons name="person" size={22} color="white" />
          )}
        </View>
        <View>
          <Text style={styles.headerName}>{advisor.name}</Text>
          {showStatus && connectionStatus && (
            <View style={styles.statusRow}>
              <View style={[
                styles.statusDot,
                (connectionStatus === 'accepted' || connectionStatus === 'system_approved')
                  ? styles.dotOnline
                  : styles.dotMuted,
              ]} />
              <Text style={styles.statusText}>
                {connectionStatus === 'accepted' || connectionStatus === 'system_approved'
                  ? 'Online'
                  : connectionStatus === 'pending'
                  ? 'Pending'
                  : 'Reviewed'}
              </Text>
            </View>
          )}
        </View>
      </View>
      {canRate && connectionId && connectionStatus !== 'pending' && (
        <TouchableOpacity
          style={styles.rateBtn}
          onPress={() => setShowRating(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="star-outline" size={16} color="#F59E0B" />
          <Text style={styles.rateBtnText}>Rate</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Early exits ───────────────────────────────────────────────────────────

  if (loadingConnection) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {renderHeader(false)}
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!connectionId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {renderHeader(false)}
        <View style={styles.centeredState}>
          <Ionicons name="link-outline" size={48} color={COLORS.muted} />
          <Text style={styles.stateTitle}>Not Connected</Text>
          <Text style={styles.stateBody}>
            Send a connection request from the advisor list first, then come back to chat.
          </Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Safe fee values (no toFixed on undefined) for the lock card.
  const safeBase = paymentQuote?.baseFee ?? trialStatus?.finalFee ?? 10;
  const safeDiscount = paymentQuote?.discountPercent ?? 0;
  const safeFinal = paymentQuote?.totalFee ?? trialStatus?.finalFee ?? 10;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {renderHeader()}
      {renderStatusBanner()}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          windowSize={8}
          initialNumToRender={20}
          removeClippedSubviews={true}
          // Countdown pill is pinned at the top of the message list (not a banner).
          ListHeaderComponent={renderCountdownPill()}
          onContentSizeChange={() => {
            if (!initializedRef.current) return;
            if (!hasScrolledRef.current) {
              hasScrolledRef.current = true;
              if (firstUnreadIndex !== null && firstUnreadIndex >= 0) {
                listRef.current?.scrollToIndex({
                  index: firstUnreadIndex,
                  animated: false,
                  viewPosition: 0.1,
                });
              } else {
                listRef.current?.scrollToEnd({ animated: false });
              }
            } else {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScrollToIndexFailed={info => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0.1,
              });
            }, 200);
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={40} color={COLORS.muted} />
              <Text style={styles.emptyChatTitle}>No messages yet</Text>
              <Text style={styles.emptyChatSub}>
                {connectionStatus === 'pending'
                  ? 'Chat will unlock once the advisor accepts your request.'
                  : `Start the conversation with ${advisor.name}`}
              </Text>
            </View>
          }
        />

        <Text style={styles.disclaimer}>
          This is peer support — not professional advice. In a crisis, call emergency services.
        </Text>

        {/* Bottom area: three states — read-only / locked / active input */}
        {isReadOnly ? (
          <View style={styles.readOnlyBar}>
            <Ionicons
              name={connectionStatus === 'pending' ? 'time-outline' : 'lock-closed-outline'}
              size={14}
              color={connectionStatus === 'pending' ? '#D97706' : COLORS.muted}
            />
            <Text style={[
              styles.readOnlyText,
              connectionStatus === 'pending' && styles.readOnlyTextPending,
            ]}>
              {connectionStatus === 'pending'
                ? 'Waiting for advisor to accept your request'
                : 'This conversation is read-only'}
            </Text>
          </View>
        ) : sendLocked ? (
          /* Trial expired — message history stays readable, only input locked */
          <View style={styles.lockCard}>
            {loadingTrial ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <Text style={styles.lockTitle}>
                  Your free week with {advisor.name} has ended
                </Text>
                <Text style={styles.lockSub}>
                  To continue chatting with your advisor, book a paid session.
                </Text>
                <TouchableOpacity
                  style={styles.lockBtn}
                  onPress={() => {
                    if (!connectionId) return;
                    navigation.navigate('Payment', {
                      connectionId,
                      advisorId: advisor.id,
                      advisorName: advisor.name,
                      quote: {
                        baseFee: safeBase,
                        discountPercent: safeDiscount,
                        badgeTierName: paymentQuote?.badgeTierName,
                        totalFee: safeFinal,
                      },
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.lockBtnText}>
                    Book Session · {fmtUSD(safeFinal)}
                  </Text>
                </TouchableOpacity>
                {safeDiscount > 0 && (
                  <Text style={styles.lockDiscount}>
                    {safeDiscount}% badge discount applied
                  </Text>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.muted}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending || !input.trim()}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="send" size={18} color="white" />
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {showRating && connectionId && (
        <AdvisorRatingModal
          visible={showRating}
          advisorName={advisor.name}
          advisorId={advisor.id}
          connectionId={connectionId}
          onClose={() => setShowRating(false)}
          onSubmitted={() => setCanRate(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1, backgroundColor: '#F5F6FA' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B0B0B0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9E9E9E',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: '#22C55E' },
  dotMuted: { backgroundColor: '#9CA3AF' },
  statusText: { fontSize: 12, color: COLORS.muted },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pendingText: { fontSize: 12, color: '#D97706', fontWeight: '500', flex: 1 },

  reviewedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reviewedText: { fontSize: 12, color: '#6B7280', fontWeight: '500', flex: 1 },

  // ── Countdown chip (inside FlatList, critical_case only) ──────────────────
  countdownPill: {
    alignSelf: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  countdownText: { fontSize: 12, color: '#1E40AF', fontWeight: '600' },

  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  msgWrapper: { maxWidth: '78%', marginBottom: 12 },
  userSide: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  advisorSide: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  senderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  advisorBubble: {
    backgroundColor: '#E8E8EE',
    borderBottomLeftRadius: 4,
  },
  userText: { color: 'white', fontSize: 14, lineHeight: 21 },
  advisorText: { color: '#1A1A2E', fontSize: 14, lineHeight: 21 },
  timestamp: { fontSize: 10, color: COLORS.muted, marginTop: 4, opacity: 0.6 },

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyChatTitle: { fontSize: 16, fontWeight: '600', color: COLORS.muted },
  emptyChatSub: { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 32 },

  disclaimer: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 4,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  readOnlyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
  },
  readOnlyText: { fontSize: 13, color: COLORS.muted },
  readOnlyTextPending: { color: '#D97706' },

  // ── Trial lock card (replaces input bar on expiry, critical_case only) ────
  lockCard: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  lockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  lockSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  lockBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  lockBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  lockDiscount: { fontSize: 12, color: '#059669', textAlign: 'center', marginTop: 8 },

  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  stateTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  stateBody: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  goBackBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  goBackBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  rateBtnText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  unreadLine: { flex: 1, height: 1, backgroundColor: '#E53E3E' },
  unreadLabel: { fontSize: 12, fontWeight: '600', color: '#E53E3E' },
});
