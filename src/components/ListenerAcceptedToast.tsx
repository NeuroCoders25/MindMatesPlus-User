import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  advisorName: string;
  onChat: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 8000;

export const ListenerAcceptedToast: React.FC<Props> = ({
  visible,
  advisorName,
  onChat,
  onDismiss,
}) => {
  const translateY = useRef(new Animated.Value(-160)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideIn = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  };

  const slideOut = (then?: () => void) => {
    Animated.timing(translateY, {
      toValue: -160,
      duration: 260,
      useNativeDriver: true,
    }).start(() => then?.());
  };

  useEffect(() => {
    if (visible) {
      slideIn();
      timerRef.current = setTimeout(() => slideOut(onDismiss), AUTO_DISMISS_MS);
    } else {
      slideOut();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const handleChat = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    slideOut(onChat);
  };

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    slideOut(onDismiss);
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY }] }]}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>Your expert is ready</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {advisorName} accepted your request. You can start chatting now.
        </Text>
      </View>

      <TouchableOpacity style={styles.chatBtn} onPress={handleChat} activeOpacity={0.85}>
        <Text style={styles.chatBtnText}>Chat</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} activeOpacity={0.7}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 52,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 1,
    lineHeight: 17,
  },
  chatBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    flexShrink: 0,
  },
  chatBtnText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
  },
  closeBtn: {
    padding: 4,
    flexShrink: 0,
  },
});
