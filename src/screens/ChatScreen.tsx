import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Input } from '../components/UI';
import { COLORS } from '../services/dataService';
import { saveChatMessage, subscribeGroupMessages } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Message } from '../types';

export const ChatScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { user, aiMessages, sendAiMessage } = useApp();

  const params = (route.params ?? {}) as { groupId?: string; groupName?: string };
  const isAI = !params.groupId;
  const title = isAI ? 'Mindy AI' : params.groupName ?? '';
  const groupId = params.groupId ?? '';

  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

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
      setGroupMessages(mapped);
    });
    return unsubscribe;
  }, [groupId, isAI, user?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    if (isAI) {
      sendAiMessage(text);
      return;
    }
    if (!user) return;
    setSending(true);
    try {
      await saveChatMessage(groupId, user.id, user.name, text);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.onlineText}>Live</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: msg }) => (
          <View
            style={[
              styles.msgWrapper,
              msg.sender === 'user' ? styles.userSide : styles.otherSide,
            ]}
          >
            {msg.senderName && (
              <Text style={styles.senderName}>{msg.senderName}</Text>
            )}
            <View
              style={[
                styles.bubble,
                msg.sender === 'user' ? styles.userBubble : styles.otherBubble,
              ]}
            >
              {msg.flagged && (
                <View style={styles.flaggedBadge}>
                  <Ionicons name="warning-outline" size={10} color="#F87171" />
                  <Text style={styles.flaggedText}>Flagged</Text>
                </View>
              )}
              <Text
                style={[
                  styles.bubbleText,
                  msg.sender === 'user'
                    ? styles.userBubbleText
                    : styles.otherBubbleText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
            <Text style={styles.timestamp}>
              {msg.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inputBar}>
          <Input
            placeholder={isAI ? 'Talk to Mindy...' : 'Type a message...'}
            value={inputText}
            onChangeText={setInputText}
            style={styles.inputField}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            activeOpacity={0.8}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="send" size={18} color="white" />
            }
          </TouchableOpacity>
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
});
