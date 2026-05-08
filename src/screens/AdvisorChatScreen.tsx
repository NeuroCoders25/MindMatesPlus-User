import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'AdvisorChat'>;

const FALLBACK_AVATARS: Record<string, any> = {
  'Clinical Psychologist': require('../assets/group_image1.jpg'),
  'Mental Health Advisor': require('../assets/group_image3.png'),
  'Depression Specialist': require('../assets/group_image4.jpeg'),
  default: require('../assets/group_image5.png'),
};

interface Message {
  id: string;
  text: string;
  fromAdvisor: boolean;
  timestamp: Date;
}

export const AdvisorChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { advisor } = route.params;
  const avatar = advisor.imageUrl
    ? { uri: advisor.imageUrl }
    : FALLBACK_AVATARS[advisor.specialty] ?? FALLBACK_AVATARS['default'];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: `Hello, I'm ${advisor.name}.\nHow can I support you today?`,
      fromAdvisor: true,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      fromAdvisor: false,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderItem = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.bubble,
        item.fromAdvisor ? styles.advisorBubble : styles.userBubble,
      ]}
    >
      <Text style={item.fromAdvisor ? styles.advisorText : styles.userText}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <Image source={avatar} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{advisor.name}</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.phoneBtn}>
          <Ionicons name="call-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This is not professional advice. If you are in crisis, call emergency services.
        </Text>

        {/* Input Bar */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.muted}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} activeOpacity={0.8}>
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
  },
  backBtn: {
    padding: 4,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginLeft: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  headerName: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  onlineText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  phoneBtn: {
    padding: 4,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  advisorBubble: {
    backgroundColor: '#E8E8EE',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  advisorText: {
    color: '#1A1A2E',
    fontSize: 14,
    lineHeight: 21,
  },
  userText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 21,
  },
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
    backgroundColor: 'white',
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
});
