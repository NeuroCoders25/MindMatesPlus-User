import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import {
  COLORS,
  AdvisorMessage,
  findAdvisorConnection,
  listenToAdvisorConnectionMessages,
  sendUserAdvisorMessage,
} from '../services/dataService';
import { useApp } from '../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvisorChat'>;


type ConnectionStatus = 'pending' | 'accepted' | 'reviewed';

export const AdvisorChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { advisor } = route.params;
  const { user } = useApp();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    findAdvisorConnection(user.id, advisor.id)
      .then(conn => {
        if (conn) {
          console.log('[AdvisorChat] Using connectionId:', conn.connectionId);
          setConnectionId(conn.connectionId);
          setConnectionStatus(conn.status);
        } else {
          console.log('[AdvisorChat] No connection found');
        }
      })
      .catch(err => console.error('[AdvisorChat] Failed to load connection:', err))
      .finally(() => setLoadingConnection(false));
  }, [user, advisor.id]);

  useEffect(() => {
    if (!connectionId) return;
    const unsubscribe = listenToAdvisorConnectionMessages(connectionId, incoming => {
      setMessages(incoming);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return unsubscribe;
  }, [connectionId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !connectionId || !user || connectionStatus !== 'accepted') return;
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

  const isReadOnly = connectionStatus !== 'accepted';

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

  const renderMessage = ({ item }: { item: AdvisorMessage }) => {
    const isUser = item.senderRole === 'user';
    return (
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
    );
  };

  const renderHeader = (showStatus = true) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.headerProfile}>
        <View style={styles.headerAvatarCircle}>
            <Ionicons name="person" size={22} color="white" />
          </View>
        <View>
          <Text style={styles.headerName}>{advisor.name}</Text>
          {showStatus && connectionStatus && (
            <View style={styles.statusRow}>
              <View style={[
                styles.statusDot,
                connectionStatus === 'accepted' ? styles.dotOnline : styles.dotMuted,
              ]} />
              <Text style={styles.statusText}>
                {connectionStatus === 'accepted' ? 'Online' : connectionStatus === 'pending' ? 'Pending' : 'Reviewed'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  if (loadingConnection) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {renderHeader(false)}
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!connectionId) {
    return (
      <SafeAreaView style={styles.safeArea}>
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

  return (
    <SafeAreaView style={styles.safeArea}>
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
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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
});
