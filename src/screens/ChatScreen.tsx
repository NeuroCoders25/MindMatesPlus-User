import React, { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
} from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import multiavatar from '@multiavatar/multiavatar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Input } from '../components/UI';
import { COLORS, subscribeGroupMessages, deleteGroupMessage, subscribePrivateThread, sendPrivateThreadReply, fetchUserProfile, markChatRead, getLastReadAt } from '../services/dataService';

const AVAILABILITY: Record<string, { color: string }> = {
  online:  { color: '#10B981' },
  busy:    { color: '#F59E0B' },
  away:    { color: '#6B7280' },
  offline: { color: '#9CA3AF' },
};
const getModeratorStatusColor = (raw: string | undefined) =>
  (AVAILABILITY[(raw ?? '').toLowerCase()] ?? AVAILABILITY['online']).color;
import { moderateContent } from '../services/geminiService';
import { RootStackParamList } from '../navigation';
import { Message, ReviewStatus, PrivateThreadMessage } from '../types';
import { subscribeGroupCalls } from '../services/groupCallService';
import { LiveCallBanner } from '../components/LiveCallBanner';
import { GroupCall } from '../types/groupCall';

// ─── Message avatar ───────────────────────────────────────────────────────────
const MessageAvatar = memo(({ seed, name, imageUrl }: { seed?: string; name?: string; imageUrl?: string }) => {
  const svg = useMemo(() => (!imageUrl && seed ? multiavatar(seed) : null), [seed, imageUrl]);
  if (imageUrl) {
    return (
      <View style={msgAvatarStyles.wrap}>
        <Image source={{ uri: imageUrl }} style={msgAvatarStyles.img} resizeMode="cover" />
      </View>
    );
  }
  if (svg) {
    return (
      <View style={msgAvatarStyles.wrap}>
        <SvgXml xml={svg} width={32} height={32} />
      </View>
    );
  }
  const initials = (name ?? '?').charAt(0).toUpperCase();
  return (
    <View style={[msgAvatarStyles.wrap, msgAvatarStyles.fallback]}>
      <Text style={msgAvatarStyles.initials}>{initials}</Text>
    </View>
  );
});

const msgAvatarStyles = StyleSheet.create({
  wrap: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', marginTop: 2 },
  fallback: { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  img: { width: 32, height: 32, borderRadius: 16 },
});

// ─── Mindy AI avatar ──────────────────────────────────────────────────────────
const MindyAvatar = memo(() => (
  <View style={mindyAvatarStyles.wrap}>
    <MaterialCommunityIcons name="robot" size={18} color="#7C3AED" />
  </View>
));

const mindyAvatarStyles = StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
});

// ─── Swipe-to-reply row wrapper ───────────────────────────────────────────────
const SwipeableMessageRow = memo(({
  onReply,
  enabled = true,
  children,
}: {
  onReply: () => void;
  enabled?: boolean;
  children: React.ReactNode;
}) => {
  const swipeableRef = useRef<SwipeableMethods>(null);

  if (!enabled) return <>{children}</>;

  const renderLeftActions = () => (
    <View style={swipeReplyStyles.action}>
      <Ionicons name="arrow-undo" size={22} color="#6C63FF" />
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
          onReply();
          swipeableRef.current?.close();
        }
      }}
      friction={2}
      leftThreshold={40}
      overshootLeft={false}
    >
      {children}
    </ReanimatedSwipeable>
  );
});

const swipeReplyStyles = StyleSheet.create({
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});

// Returns a safe display string for a value that may still be an EncryptedMessage object
// (guards against decrypt-timing races when rendering replyTo.text)
function safeText(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val !== null && typeof val === 'object') {
    return (val as { plaintext?: string }).plaintext ?? '[encrypted]';
  }
  return '';
}

// ─── Review-status helpers ─────────────────────────────────────────────────────

// Treat missing reviewStatus (older messages) as 'not_required'.
const effectiveStatus = (msg: Message): ReviewStatus =>
  msg.reviewStatus ?? 'not_required';

// Visibility rule (main chatMessages feed only — privateThread is a separate subcollection):
//   - deletedByAdvisor                  → always visible (system notice to everyone)
//   - clean (not_required) or approved  → always visible
//   - pending / rejected                → visible only to the sender
const isMessageVisible = (msg: Message, viewerId: string | undefined): boolean => {
  if (msg.deletedByAdvisor) return true;
  const status = effectiveStatus(msg);
  if (status === 'not_required' || status === 'approved') return true;
  return msg.senderId === viewerId;
};

export const ChatScreen = ({ embedded = false }: { embedded?: boolean }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { user, aiMessages, sendAiMessage, sendGroupMessage, peerGroups, leaveGroup, markGroupAsVisited, isRestricted, gamificationTriggers } = useApp();

  const params = (route.params ?? {}) as { groupId?: string; groupName?: string };
  const isAI = !params.groupId;
  const title = isAI ? 'Mindy AI' : params.groupName ?? '';
  const groupId = params.groupId ?? '';

  const group = peerGroups.find(g => g.id === groupId);

  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Group call state — live + scheduled calls for this group
  const [activeCalls, setActiveCalls] = useState<GroupCall[]>([]);

  // { flaggedMessageId, advisorId, advisorName } set when user taps "Reply privately"
  const [replyingToPrivate, setReplyingToPrivate] = useState<{
    flaggedMessageId: string;
    advisorId: string;
    advisorName: string;
  } | null>(null);
  // keyed by flaggedMessageId → sorted thread messages
  const [privateThreads, setPrivateThreads] = useState<Record<string, PrivateThreadMessage[]>>({});
  const listRef = useRef<FlatList>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);
  const firstUnreadIndexRef = useRef<number | null>(null);
  const lastReadAtRef = useRef<Date | null>(null);
  const initializedRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const openTimeRef = useRef<number>(Date.now());
  const userHasScrolledRef = useRef(false);
  const prevLengthRef = useRef(0);
  // Holds unsubscribe functions for active privateThread listeners; cleaned up on unmount / group change
  const privateThreadUnsubs = useRef<Record<string, () => void>>({});
  // Live avatarSeed + profileImageUrl fetched from users/{senderId} — keyed by userId
  const [userProfiles, setUserProfiles] = useState<Record<string, { avatarSeed?: string; profileImageUrl?: string }>>({});
  const fetchedUserIds = useRef<Set<string>>(new Set());

  const handleExitGroup = () => {
    setMenuVisible(false);
    // Delay Alert until the modal fade animation finishes — on Android the Alert
    // is swallowed if shown while the Modal is still animating closed.
    setTimeout(() => {
      Alert.alert(
        'Exit Group',
        `Are you sure you want to leave "${title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: async () => {
              await leaveGroup(groupId);
              navigation.goBack();
            },
          },
        ],
      );
    }, 300);
  };

  // Only own messages in group chat can be deleted.
  // Long-pressing a peer message or any AI message is a no-op.
  const handleDeleteMessage = (msg: Message) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(msg.id);
            try {
              await deleteGroupMessage(groupId, msg.id);
              // The onSnapshot listener removes the message from the list
              // automatically — no manual state update needed.
            } catch {
              Alert.alert('Error', 'Could not delete the message. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const handleMessageAction = (msg: Message) => {
    const isOwn = msg.senderId === user?.id;
    Alert.alert(
      'Message',
      undefined,
      [
        { text: 'Reply', onPress: () => setReplyingTo(msg) },
        ...(isOwn ? [{
          text: 'Delete',
          style: 'destructive' as const,
          onPress: () => handleDeleteMessage(msg),
        }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const scrollToMessage = (messageId: string) => {
    const index = groupMessages.findIndex(m => m.id === messageId);
    if (index < 0) return;
    try {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    } catch {
      // onScrollToIndexFailed handles the fallback
    }
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId(null), 1500);
  };

  const renderQuotedPreview = (replyTo: NonNullable<Message['replyTo']>) => (
    <TouchableOpacity
      style={styles.quotedBlock}
      activeOpacity={0.7}
      onPress={() => scrollToMessage(replyTo.id)}
    >
      <View style={styles.quotedBar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.quotedName} numberOfLines={1}>{replyTo.senderName}</Text>
        <Text style={styles.quotedSnippet} numberOfLines={1}>{safeText(replyTo.text)}</Text>
      </View>
    </TouchableOpacity>
  );

  const messages: Message[] = isAI ? aiMessages : groupMessages;

  // Subscribe to real-time Firestore messages for group chats.
  // Loads lastReadAt first so the unread divider position is stable on open.
  useEffect(() => {
    if (isAI || !groupId) return;

    // Reset unread state when the group changes
    lastReadAtRef.current = null;
    initializedRef.current = false;
    initialScrollDoneRef.current = false;
    openTimeRef.current = Date.now();
    userHasScrolledRef.current = false;
    prevLengthRef.current = 0;
    setUnreadCount(0);
    setFirstUnreadIndex(null);
    firstUnreadIndexRef.current = null;

    let unsubscribeMessages: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      lastReadAtRef.current = await getLastReadAt(groupId, 'group');
      if (cancelled) return;

      unsubscribeMessages = subscribeGroupMessages(groupId, incoming => {
        const mapped: Message[] = incoming.map(msg => ({
          ...msg,
          sender: msg.senderId === user?.id ? 'user' : 'peer',
          senderName: msg.senderId === user?.id ? undefined : msg.senderName,
        }));
        const filtered = mapped.filter(msg => isMessageVisible(msg, user?.id));
        setGroupMessages(filtered);

        // Compute unread once on the first snapshot so the divider stays fixed
        if (!initializedRef.current) {
          const lastRead = lastReadAtRef.current;
          if (lastRead) {
            const uid = user?.id;
            let idx = -1;
            let count = 0;
            filtered.forEach((m, i) => {
              if (m.timestamp > lastRead && m.senderId !== uid) {
                if (idx === -1) idx = i;
                count++;
              }
            });
            const firstUnread = idx >= 0 ? idx : null;
            setUnreadCount(count);
            setFirstUnreadIndex(firstUnread);
            firstUnreadIndexRef.current = firstUnread;
          }
          initializedRef.current = true;
        }
      });
    })();

    return () => {
      cancelled = true;
      unsubscribeMessages?.();
      initializedRef.current = false;
      initialScrollDoneRef.current = false;
      openTimeRef.current = Date.now();
      userHasScrolledRef.current = false;
      prevLengthRef.current = 0;
      firstUnreadIndexRef.current = null;
      // Also tear down all private-thread listeners when the group subscription resets
      Object.values(privateThreadUnsubs.current).forEach(u => u());
      privateThreadUnsubs.current = {};
      setPrivateThreads({});
      // Reset profile cache on group change so fresh data is fetched
      fetchedUserIds.current = new Set();
      setUserProfiles({});
    };
  }, [groupId, isAI, user?.id]);

  // Fetch live avatarSeed + profileImageUrl for each unique sender in the group
  useEffect(() => {
    if (isAI || groupMessages.length === 0) return;
    const newIds = [...new Set(
      groupMessages.map(m => m.senderId).filter((id): id is string => !!id)
    )].filter(id => !fetchedUserIds.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach(id => fetchedUserIds.current.add(id));
    Promise.all(newIds.map(id => fetchUserProfile(id).then(profile => ({ id, profile }))))
      .then(results => {
        setUserProfiles(prev => {
          const next = { ...prev };
          results.forEach(({ id, profile }) => { next[id] = profile; });
          return next;
        });
      })
      .catch(() => {});
  }, [groupMessages, isAI]);

  // Subscribe to privateThread subcollections for the current user's own flagged messages.
  //
  // IMPORTANT: we do NOT require hasPrivateThread === true as the trigger, because the
  // advisor portal writes directly to the privateThread subcollection without necessarily
  // setting that flag on the parent doc first.  Instead we subscribe to the privateThread
  // of every flagged message sent by the current user.  The Firestore query uses
  // `where('visibleTo', 'array-contains', userId)` as the real security gate — it returns
  // nothing until the advisor creates a doc, then fires in real-time when they do.
  //
  // Other group members never call this function — they have no listener on this path.
  useEffect(() => {
    if (isAI || !groupId || !user?.id) return;
    groupMessages
      .filter(msg => msg.senderId === user.id && (msg.flagged || msg.hasPrivateThread))
      .forEach(msg => {
        if (privateThreadUnsubs.current[msg.id]) return; // already subscribed — skip
        const unsub = subscribePrivateThread(groupId, msg.id, user.id, threads => {
          setPrivateThreads(prev => ({ ...prev, [msg.id]: threads }));
        });
        privateThreadUnsubs.current[msg.id] = unsub;
      });
  }, [groupMessages, groupId, isAI, user?.id]);

  // Subscribe to live / scheduled group calls for this group
  useEffect(() => {
    if (isAI || !groupId) return;
    const unsubscribe = subscribeGroupCalls(groupId, setActiveCalls);
    return unsubscribe;
  }, [groupId, isAI]);

  useEffect(() => {
    if (!isAI && groupId) {
      markGroupAsVisited(groupId);
    }
  }, [groupId, isAI, markGroupAsVisited]);

  const scrollToInitialPosition = useCallback((animated: boolean) => {
    const idx = firstUnreadIndexRef.current;
    if (idx !== null && idx >= 0) {
      try {
        listRef.current?.scrollToIndex({ index: idx, animated, viewPosition: 0.2 });
      } catch {
        listRef.current?.scrollToEnd({ animated });
      }
    } else {
      listRef.current?.scrollToEnd({ animated });
    }
  }, []);

  // AI chat: keep scrolled to latest on every new message
  useEffect(() => {
    if (!isAI || messages.length === 0) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages.length, isAI]);

  // Group chat: re-pin to initial position at intervals to cover async decrypt + image loads
  useEffect(() => {
    if (isAI || groupMessages.length === 0) return;
    if (userHasScrolledRef.current) return;
    const timers = [150, 500, 1000].map(delay =>
      setTimeout(() => {
        if (!userHasScrolledRef.current) {
          scrollToInitialPosition(false);
        }
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [groupMessages.length, isAI, scrollToInitialPosition]);

  // Group chat: scroll to end when a new message arrives after initial positioning is done
  useEffect(() => {
    if (isAI || groupMessages.length === 0) return;
    const grew = groupMessages.length > prevLengthRef.current;
    prevLengthRef.current = groupMessages.length;
    if (!grew) return;
    if (!initialScrollDoneRef.current) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(t);
  }, [groupMessages.length, isAI]);

  // Mark chat as read when the user leaves the screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!isAI && groupId) {
          markChatRead(groupId, 'group');
        }
      };
    }, [groupId, isAI]),
  );

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending || isRestricted) return;

    setModerationError(null);
    setSending(true);
    try {
      const moderation = await moderateContent(text);
      if (!moderation.safe) {
        setModerationError(
          moderation.reason ??
            'Your message contains inappropriate content. Please keep conversations respectful.',
        );
        setSending(false);
        return;
      }
    } catch {
      setSending(false);
      return;
    }

    setInputText('');

    // Private reply mode — write into the flagged message's privateThread subcollection
    if (replyingToPrivate && user) {
      try {
        await sendPrivateThreadReply(
          groupId,
          replyingToPrivate.flaggedMessageId,
          user.id,
          user.name ?? user.nickname ?? 'Me',
          replyingToPrivate.advisorId,
          replyingToPrivate.advisorName,
          text,
        );
      } finally {
        setSending(false);
        setReplyingToPrivate(null);
      }
      return;
    }

    if (isAI) {
      setSending(false);
      sendAiMessage(text);
      return;
    }
    if (!user) { setSending(false); return; }

    const replyPayload = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderName: replyingTo.senderName ?? 'User',
      senderId: replyingTo.senderId ?? '',
    } : undefined;
    setReplyingTo(null);

    setSending(true);
    try {
      await sendGroupMessage(groupId, text, replyPayload);
      if (replyPayload && replyPayload.senderId && replyPayload.senderId !== user.id) {
        void gamificationTriggers.onSupportiveReply({
          originalSenderId: replyPayload.senderId,
          originalText: safeText(replyPayload.text),
          replyText: text,
        });
      }
    } finally {
      setSending(false);
    }
  };

  // Derived call state — filter by status for conditional rendering
  const liveCall = activeCalls.find(c => c.status === 'live');
  const scheduledCalls = activeCalls.filter(c => c.status === 'scheduled');

  const Wrapper = embedded ? View : SafeAreaView;
  const wrapperProps = embedded ? {} : { edges: ['top'] as const };

  return (
    <Wrapper style={styles.container} {...wrapperProps}>
      {/* Group Info Modal */}
      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInfoVisible(false)}>
          <View style={styles.infoCard}>
            {/* Group image */}
            {group?.image ? (
              <Image source={group.image} style={styles.infoGroupImage} resizeMode="cover" />
            ) : (
              <View style={styles.infoAvatar}>
                <Ionicons name="people-outline" size={32} color="#2563EB" />
              </View>
            )}

            <Text style={styles.infoTitle}>{group?.name ?? title}</Text>
            <Text style={styles.infoBadge}>{group?.category}</Text>
            <Text style={styles.infoDesc}>{group?.description}</Text>

            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={14} color={COLORS.muted} />
              <Text style={styles.infoMeta}>{group?.members ?? '—'} members</Text>
            </View>

            {/* Moderator row */}
            {group?.moderatorName && (
              <View style={styles.infoModeratorRow}>
                {/* Profile picture with verified badge overlay */}
                <View style={styles.moderatorAvatarWrap}>
                  {group.moderatorImageUrl ? (
                    <Image
                      source={{ uri: group.moderatorImageUrl }}
                      style={styles.moderatorAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.moderatorAvatarCircle}>
                      <Ionicons name="person" size={16} color="#2563EB" />
                    </View>
                  )}
                  {/* Availability status badge pinned to bottom-right of avatar */}
                  <View style={styles.moderatorVerifiedBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={getModeratorStatusColor(group?.moderatorAvailability)}
                    />
                  </View>
                </View>

                {/* Name + label */}
                <View style={styles.moderatorTextCol}>
                  <Text style={styles.moderatorLabel}>Moderator</Text>
                  <Text style={styles.moderatorName}>{group.moderatorName}</Text>
                </View>

                {/* Authorized icon on the right */}
                <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
              </View>
            )}

            <TouchableOpacity style={styles.infoClose} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dropdown Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setInfoVisible(true); }}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.text} />
              <Text style={styles.menuItemText}>Group info</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleExitGroup}>
              <Ionicons name="exit-outline" size={20} color="#DC2626" />
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>Exit group</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Header — hidden when embedded inside ListenerScreen */}
      {!embedded && (
      <View style={styles.header}>
        {!isAI && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        {isAI ? (
          <View style={[styles.avatar, styles.aiAvatar]}>
            <Ionicons name="happy-outline" size={20} color="#7C3AED" />
          </View>
        ) : (
          group?.image
            ? <Image source={group.image} style={styles.headerGroupImage} resizeMode="cover" />
            : <View style={[styles.avatar, styles.groupAvatar]}>
                <Ionicons name="people-outline" size={20} color="#2563EB" />
              </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {!isAI && (
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>
      )}

      {/* Live / scheduled call banners — group chat only */}
      {!isAI && (liveCall || scheduledCalls.length > 0) && (
        <View style={styles.callBannersContainer}>
          {liveCall && <LiveCallBanner call={liveCall} />}
          {scheduledCalls.map(c => (
            <LiveCallBanner key={c.id} call={c} />
          ))}
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        windowSize={8}
        initialNumToRender={20}
        removeClippedSubviews={true}
        onContentSizeChange={() => {
          if (isAI) {
            listRef.current?.scrollToEnd({ animated: false });
            return;
          }
          if (userHasScrolledRef.current) return;
          const sinceOpen = Date.now() - openTimeRef.current;
          if (sinceOpen < 1500) {
            scrollToInitialPosition(false);
          } else if (!initialScrollDoneRef.current) {
            scrollToInitialPosition(false);
            initialScrollDoneRef.current = true;
          }
        }}
        onScrollBeginDrag={() => {
          userHasScrolledRef.current = true;
          initialScrollDoneRef.current = true;
        }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
          setTimeout(() => {
            if (!userHasScrolledRef.current) {
              try {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                  viewPosition: 0.2,
                });
              } catch {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }
          }, 250);
        }}
        renderItem={({ item: msg, index }) => {
          const showDivider = !isAI && firstUnreadIndex === index && unreadCount > 0;
          const unreadDivider = showDivider ? (
            <View style={styles.unreadDivider}>
              <View style={styles.unreadLine} />
              <Text style={styles.unreadLabel}>
                {unreadCount} new message{unreadCount > 1 ? 's' : ''}
              </Text>
              <View style={styles.unreadLine} />
            </View>
          ) : null;

          // Advisor hard-deleted — replace bubble in its original position for everyone.
          if (msg.deletedByAdvisor) {
            const deletedIsOwn = msg.sender === 'user';
            return (
              <View>
                {unreadDivider}
                <View style={[styles.msgRow, deletedIsOwn ? styles.msgRowUser : styles.msgRowOther]}>
                {!deletedIsOwn && (
                  <MessageAvatar
                    seed={userProfiles[msg.senderId ?? '']?.avatarSeed ?? msg.senderAvatarSeed}
                    name={msg.senderName}
                    imageUrl={userProfiles[msg.senderId ?? '']?.profileImageUrl}
                  />
                )}
                <View style={[styles.msgWrapper, deletedIsOwn ? styles.userSide : styles.otherSide]}>
                  {(deletedIsOwn ? (user?.nickname ?? user?.name) : msg.senderName) ? (
                    <Text style={styles.senderName}>
                      {deletedIsOwn ? (user?.nickname ?? user?.name) : msg.senderName}
                    </Text>
                  ) : null}
                  <View style={styles.deletedBubble}>
                    <Text style={styles.deletedBubbleText}>
                      🗑 This message was deleted by the advisor.
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {deletedIsOwn && (
                  <MessageAvatar seed={user?.avatarSeed} name={user?.name} imageUrl={user?.profileImageUrl} />
                )}
              </View>
              </View>
            );
          }

          const status = effectiveStatus(msg);
          const isOwn = msg.sender === 'user';
          const isModerator = !isOwn &&
            !!group?.moderatorName &&
            msg.senderName?.trim().toLowerCase() === group.moderatorName.trim().toLowerCase();
          const isRejected = isOwn && status === 'rejected';
          const isPending = isOwn && status === 'pending';
          // Private thread data — only populated for the current user's own flagged messages
          const thread: PrivateThreadMessage[] = isOwn ? (privateThreads[msg.id] ?? []) : [];
          const hasThread = thread.length > 0;
          const advisorMsg = thread.find(t => t.senderRole === 'advisor');

          return (
            <View>
              {unreadDivider}
              <SwipeableMessageRow
                onReply={() => setReplyingTo(msg)}
                enabled={!isAI && status !== 'rejected'}
              >
                {/* Original message bubble */}
                <View style={[styles.msgRow, isOwn ? styles.msgRowUser : styles.msgRowOther]}>
                  {!isOwn && (
                    msg.sender === 'ai'
                      ? <MindyAvatar />
                      : <MessageAvatar
                          seed={userProfiles[msg.senderId ?? '']?.avatarSeed ?? msg.senderAvatarSeed}
                          name={msg.senderName}
                          imageUrl={isModerator ? group?.moderatorImageUrl : userProfiles[msg.senderId ?? '']?.profileImageUrl}
                        />
                  )}
                  <View style={[styles.msgWrapper, isOwn ? styles.userSide : styles.otherSide]}>
                    {(isOwn ? (user?.nickname ?? user?.name) : msg.senderName) ? (
                      <View style={styles.senderNameRow}>
                        <Text style={styles.senderName}>
                          {isOwn ? (user?.nickname ?? user?.name) : msg.senderName}
                        </Text>
                        {isModerator && (
                          <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                        )}
                      </View>
                    ) : null}
                    <View style={[highlightedId === msg.id && styles.highlightFlash]}>
                      {msg.replyTo && renderQuotedPreview(msg.replyTo)}
                      <TouchableOpacity
                        onLongPress={!isAI && !isRejected ? () => handleMessageAction(msg) : undefined}
                        delayLongPress={300}
                        activeOpacity={!isRejected ? 0.8 : 1}
                        disabled={deletingId === msg.id || isRejected}
                      >
                        <View
                          style={[
                            styles.bubble,
                            isOwn ? styles.userBubble : styles.otherBubble,
                            isModerator && styles.moderatorBubble,
                            deletingId === msg.id && styles.bubbleDeleting,
                            isRejected && styles.bubbleRejected,
                          ]}
                        >
                          {isPending && (
                            <View style={styles.reviewBadge}>
                              <Ionicons name="time-outline" size={10} color="#D97706" />
                              <Text style={styles.reviewBadgeText}>Under review</Text>
                            </View>
                          )}
                          {isRejected && (
                            <View style={styles.removedBadge}>
                              <Ionicons name="ban-outline" size={10} color="#9CA3AF" />
                              <Text style={styles.removedBadgeText}>Removed by moderator</Text>
                            </View>
                          )}
                          {!isPending && !isRejected && status !== 'approved' && msg.flagged && (
                            <View style={styles.flaggedBadge}>
                              <Ionicons name="warning-outline" size={10} color="#F87171" />
                              <Text style={styles.flaggedText}>Flagged</Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.bubbleText,
                              isOwn ? styles.userBubbleText : styles.otherBubbleText,
                              isModerator && styles.moderatorBubbleText,
                              isRejected && styles.rejectedBubbleText,
                            ]}
                          >
                            {msg.text}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.timestamp}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  {isOwn && (
                    <MessageAvatar seed={user?.avatarSeed} name={user?.name} imageUrl={user?.profileImageUrl} />
                  )}
                </View>
              </SwipeableMessageRow>

              {/* Inline private advisor thread — only rendered for the message sender */}
              {hasThread && (
                <View style={styles.privateThreadContainer}>
                  {/* Thread header */}
                  <View style={styles.privateThreadHeader}>
                    <Ionicons name="lock-closed" size={11} color="#7C3AED" />
                    <Text style={styles.privateThreadHeaderText}>
                      Private · Only you can see this
                    </Text>
                  </View>

                  {/* Thread messages — advisor LEFT, user RIGHT */}
                  {thread.map(threadMsg => (
                    <View
                      key={threadMsg.id}
                      style={[
                        styles.threadMsgRow,
                        threadMsg.senderRole === 'user'
                          ? styles.threadUserRow
                          : styles.threadAdvisorRow,
                      ]}
                    >
                      {threadMsg.senderRole === 'advisor' && (
                        <Text style={styles.threadSenderName}>{threadMsg.senderName}</Text>
                      )}
                      <View style={[
                        styles.threadBubble,
                        threadMsg.senderRole === 'user'
                          ? styles.threadUserBubble
                          : styles.threadAdvisorBubble,
                      ]}>
                        <Text style={[
                          styles.threadBubbleText,
                          threadMsg.senderRole === 'user' && styles.threadUserBubbleText,
                        ]}>
                          {threadMsg.text}
                        </Text>
                      </View>
                      <Text style={styles.threadTimestamp}>
                        {threadMsg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}

                  {/* Reply button */}
                  <TouchableOpacity
                    style={styles.threadReplyBtn}
                    onPress={() => setReplyingToPrivate({
                      flaggedMessageId: msg.id,
                      advisorId: advisorMsg?.senderId ?? '',
                      advisorName: advisorMsg?.senderName ?? 'Advisor',
                    })}
                  >
                    <Ionicons name="arrow-undo-outline" size={12} color="#7C3AED" />
                    <Text style={styles.threadReplyBtnText}>Reply privately</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View>
          {isRestricted && (
            <View style={styles.restrictionCard}>
              <View style={styles.restrictionCardRow}>
                <View style={styles.restrictionIconWrap}>
                  <Ionicons name="shield-outline" size={22} color="#DC2626" />
                </View>
                <View style={styles.restrictionCardBody}>
                  <Text style={styles.restrictionCardTitle}>
                    {isAI ? 'AI Chat Paused' : 'Group Chat Paused'}
                  </Text>
                  <Text style={styles.restrictionCardText}>
                    {isAI
                      ? 'AI chat is temporarily paused. Please connect with an advisor for support.'
                      : 'Group chat is temporarily paused. Please connect with an advisor before continuing.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.restrictionAdvisorBtn}
                onPress={() => navigation.navigate('Advisor')}
                activeOpacity={0.85}
              >
                <Ionicons name="call-outline" size={14} color="white" />
                <Text style={styles.restrictionAdvisorBtnText}>Consult Advisor</Text>
              </TouchableOpacity>
            </View>
          )}
          {replyingToPrivate && (
            <View style={styles.privateReplyBanner}>
              <Ionicons name="lock-closed" size={13} color="#7C3AED" />
              <Text style={styles.privateReplyBannerText}>
                Replying privately to {replyingToPrivate.advisorName}
              </Text>
              <TouchableOpacity onPress={() => setReplyingToPrivate(null)}>
                <Ionicons name="close" size={18} color="#7C3AED" />
              </TouchableOpacity>
            </View>
          )}
          {replyingTo && !isAI && (
            <View style={styles.replyBanner}>
              <View style={styles.quotedBar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyBannerName} numberOfLines={1}>
                  Replying to {replyingTo.senderName ?? 'message'}
                </Text>
                <Text style={styles.replyBannerSnippet} numberOfLines={1}>
                  {safeText(replyingTo.text)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}
          {moderationError && (
            <View style={styles.moderationBanner}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={styles.moderationBannerText}>{moderationError}</Text>
            </View>
          )}
          <View style={[styles.inputBar, isRestricted && styles.inputBarDisabled]}>
            <View style={styles.inputField}>
              <Input
                placeholder={isAI ? 'Talk to Mindy...' : 'Type a message...'}
                value={inputText}
                onChangeText={t => { if (!isRestricted) { setInputText(t); if (moderationError) setModerationError(null); } }}
                editable={!isRestricted}
              />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendBtn, (sending || isRestricted) && styles.sendBtnDisabled]}
              activeOpacity={0.8}
              disabled={sending || isRestricted}
            >
              {sending
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="send" size={18} color="white" />
              }
            </TouchableOpacity>
          </View>
          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.muted} />
            <Text style={styles.safetyNoteText}>
              {isAI
                ? 'Your conversations help Mindy understand and support your emotional wellbeing.'
                : 'This chat is monitored for your safety by mental health professionals.'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF6FF',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatar: { backgroundColor: '#EDE9FE' },
  groupAvatar: { backgroundColor: '#DBEAFE' },
  headerGroupImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  callBannersContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF6FF',
  },
  messageList: { flex: 1, backgroundColor: COLORS.background },
  messageContent: { padding: 20, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgWrapper: { maxWidth: '75%' },
  userSide: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherSide: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
    marginLeft: 4,
  },
  senderName: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
  },
  bubble: { padding: 14, borderRadius: 20 },
  bubbleDeleting: { opacity: 0.35 },
  userBubble: { backgroundColor: COLORS.accent, borderTopRightRadius: 4 },
  otherBubble: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EFF6FF',
  },
  flaggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  flaggedText: { fontSize: 9, color: '#F87171', fontWeight: '700' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userBubbleText: { color: 'white' },
  otherBubbleText: { color: COLORS.text },
  timestamp: { fontSize: 10, color: COLORS.muted, marginTop: 4, opacity: 0.6 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFF6FF',
    backgroundColor: COLORS.white,
    gap: 12,
  },
  inputField: { flex: 1 },
  sendBtn: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: { opacity: 0.6 },
  moderationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  moderationBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
  inputBarDisabled: { opacity: 0.55 },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
  },
  safetyNoteText: {
    fontSize: 10,
    color: COLORS.muted,
    flex: 1,
    lineHeight: 14,
    opacity: 0.8,
  },
  restrictionCard: {
    backgroundColor: '#FFF5F5',
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  restrictionCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  restrictionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  restrictionCardBody: { flex: 1, gap: 3 },
  restrictionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  restrictionCardText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  restrictionAdvisorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
  },
  restrictionAdvisorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  headerInfo: { flex: 1 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 6,
    minWidth: 190,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuItemText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  menuItemDanger: { color: '#DC2626' },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 12 },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: 300,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  infoGroupImage: {
    width: 72,
    height: 72,
    borderRadius: 22,
    marginBottom: 14,
  },
  infoAvatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 6, textAlign: 'center' },
  infoBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  infoDesc: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  infoMeta: { fontSize: 13, color: COLORS.muted },
  // Moderator row
  infoModeratorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  moderatorAvatarWrap: {
    position: 'relative',
    width: 38,
    height: 38,
  },
  moderatorAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#BFDBFE',
  },
  moderatorAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moderatorVerifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorizedBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  authorizedText: {
    fontSize: 9,
    color: '#16A34A',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  moderatorTextCol: { flex: 1 },
  moderatorLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  moderatorName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },
  infoClose: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  infoCloseText: { color: 'white', fontWeight: '700', fontSize: 14 },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  reviewBadgeText: { fontSize: 9, color: '#D97706', fontWeight: '700' },
  removedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  removedBadgeText: { fontSize: 9, color: '#9CA3AF', fontWeight: '700' },
  bubbleRejected: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.75,
  },
  rejectedBubbleText: { color: '#9CA3AF' },
  deletedBubble: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deletedBubbleText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // ── Inline private advisor thread ─────────────────────────────────────────
  privateThreadContainer: {
    marginTop: 6,
    marginHorizontal: 8,
    backgroundColor: '#FAF5FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  privateThreadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
  },
  privateThreadHeaderText: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '700',
  },
  threadMsgRow: { gap: 3 },
  threadAdvisorRow: { alignItems: 'flex-start' },
  threadUserRow: { alignItems: 'flex-end' },
  threadSenderName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
    marginLeft: 4,
    marginBottom: 2,
  },
  threadBubble: {
    maxWidth: '85%',
    padding: 10,
    borderRadius: 14,
  },
  threadAdvisorBubble: {
    backgroundColor: '#EDE9FE',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  threadUserBubble: {
    backgroundColor: '#7C3AED',
    borderTopRightRadius: 4,
  },
  threadBubbleText: {
    fontSize: 13,
    color: '#5B21B6',
    lineHeight: 18,
  },
  threadUserBubbleText: { color: 'white' },
  threadTimestamp: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 2,
    opacity: 0.6,
  },
  threadReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
  },
  threadReplyBtnText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
  },
  // ── Private reply input banner ─────────────────────────────────────────────
  privateReplyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF5FF',
    borderTopWidth: 1,
    borderTopColor: '#DDD6FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  privateReplyBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
  },
  // ── Moderator message ──────────────────────────────────────────────────────
  moderatorBubble: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderTopLeftRadius: 4,
  },
  moderatorBubbleText: { color: '#14532D' },
  // ── Unread messages divider ────────────────────────────────────────────────
  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  unreadLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#6C63FF',
  },
  unreadLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  // ── Reply: quoted preview inside bubble ────────────────────────────────────
  quotedBlock: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  quotedBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#6C63FF',
  },
  quotedName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  quotedSnippet: {
    fontSize: 12,
    color: '#6B7280',
  },
  // ── Reply banner above input ───────────────────────────────────────────────
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 8,
    marginBottom: 6,
  },
  replyBannerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  replyBannerSnippet: {
    fontSize: 12,
    color: '#6B7280',
  },
  // ── Highlight flash on tap-to-scroll target ────────────────────────────────
  highlightFlash: {
    backgroundColor: 'rgba(108,99,255,0.12)',
    borderRadius: 8,
  },
});
