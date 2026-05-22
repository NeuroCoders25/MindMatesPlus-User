import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Input } from '../components/UI';
import { COLORS, subscribeGroupMessages, deleteGroupMessage } from '../services/dataService';
import { moderateContent } from '../services/geminiService';
import { RootStackParamList } from '../navigation';
import { Message, ReviewStatus } from '../types';

// ─── Review-status helpers ─────────────────────────────────────────────────────

// Treat missing reviewStatus (older messages) as 'not_required'.
const effectiveStatus = (msg: Message): ReviewStatus =>
  msg.reviewStatus ?? 'not_required';

// Visibility rule:
//   - clean (not_required) or approved  → always visible
//   - pending / rejected                → visible only to the sender
const isMessageVisible = (msg: Message, viewerId: string | undefined): boolean => {
  const status = effectiveStatus(msg);
  if (status === 'not_required' || status === 'approved') return true;
  return msg.senderId === viewerId;
};

export const ChatScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { user, aiMessages, sendAiMessage, sendGroupMessage, peerGroups, leaveGroup, markGroupAsVisited, isRestricted } = useApp();

  const params = (route.params ?? {}) as { groupId?: string; groupName?: string };
  const isAI = !params.groupId;
  const title = isAI ? 'Mindy AI' : params.groupName ?? '';
  const groupId = params.groupId ?? '';

  const group = peerGroups.find(g => g.id === groupId);

  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

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

  const messages: Message[] = isAI ? aiMessages : groupMessages;

  // Subscribe to real-time Firestore messages for group chats
  useEffect(() => {
    if (isAI || !groupId) return;
    const unsubscribe = subscribeGroupMessages(groupId, incoming => {
      // Mark messages from current user as 'user', all others as 'peer'
      const mapped: Message[] = incoming.map(msg => ({
        ...msg,
        sender: msg.senderId === user?.id ? 'user' : 'peer',
        senderName: msg.senderId === user?.id ? undefined : msg.senderName,
      }));
      setGroupMessages(mapped.filter(msg => isMessageVisible(msg, user?.id)));
    });
    return unsubscribe;
  }, [groupId, isAI, user?.id]);

  useEffect(() => {
    if (!isAI && groupId) {
      markGroupAsVisited(groupId);
    }
  }, [groupId, isAI, markGroupAsVisited]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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

    if (isAI) {
      setSending(false);
      sendAiMessage(text);
      return;
    }
    if (!user) { setSending(false); return; }
    setSending(true);
    try {
      await sendGroupMessage(groupId, text);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Group Info Modal */}
      <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInfoVisible(false)}>
          <View style={styles.infoCard}>
            <View style={styles.infoAvatar}>
              <Ionicons name="people-outline" size={32} color="#2563EB" />
            </View>
            <Text style={styles.infoTitle}>{group?.name ?? title}</Text>
            <Text style={styles.infoBadge}>{group?.category}</Text>
            <Text style={styles.infoDesc}>{group?.description}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={14} color={COLORS.muted} />
              <Text style={styles.infoMeta}>{group?.members ?? '—'} members</Text>
            </View>
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

      {/* Header */}
      <View style={styles.header}>
        {!isAI && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <View style={[styles.avatar, isAI ? styles.aiAvatar : styles.groupAvatar]}>
          <Ionicons
            name={isAI ? 'happy-outline' : 'people-outline'}
            size={20}
            color={isAI ? '#7C3AED' : '#2563EB'}
          />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.onlineText}>Live</Text>
        </View>
        {!isAI && (
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: msg }) => {
          const status = effectiveStatus(msg);
          const isOwn = msg.sender === 'user';
          const isRejected = isOwn && status === 'rejected';
          const isPending = isOwn && status === 'pending';
          const canDelete = !isAI && isOwn && !isRejected;
          return (
            <View
              style={[
                styles.msgWrapper,
                isOwn ? styles.userSide : styles.otherSide,
              ]}
            >
              {msg.senderName && (
                <Text style={styles.senderName}>{msg.senderName}</Text>
              )}
              <TouchableOpacity
                onLongPress={canDelete ? () => handleDeleteMessage(msg) : undefined}
                delayLongPress={400}
                activeOpacity={canDelete ? 0.8 : 1}
                disabled={deletingId === msg.id || isRejected}
              >
                <View
                  style={[
                    styles.bubble,
                    isOwn ? styles.userBubble : styles.otherBubble,
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
                  {!isPending && !isRejected && msg.flagged && (
                    <View style={styles.flaggedBadge}>
                      <Ionicons name="warning-outline" size={10} color="#F87171" />
                      <Text style={styles.flaggedText}>Flagged</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.bubbleText,
                      isOwn ? styles.userBubbleText : styles.otherBubbleText,
                      isRejected && styles.rejectedBubbleText,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.timestamp}>
                {msg.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
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
          {moderationError && (
            <View style={styles.moderationBanner}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={styles.moderationBannerText}>{moderationError}</Text>
            </View>
          )}
          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.muted} />
            <Text style={styles.safetyNoteText}>
              {isAI
                ? 'Your conversations help Mindy understand and support your emotional wellbeing.'
                : 'This chat is monitored for your safety by mental health professionals.'}
            </Text>
          </View>
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  onlineText: {
    fontSize: 10,
    color: '#22C55E',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  messageList: { flex: 1, backgroundColor: COLORS.background },
  messageContent: { padding: 20, gap: 12 },
  msgWrapper: { maxWidth: '80%' },
  userSide: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherSide: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 4,
    marginLeft: 4,
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
    paddingVertical: 5,
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
  infoAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
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
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  infoMeta: { fontSize: 13, color: COLORS.muted },
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
});
