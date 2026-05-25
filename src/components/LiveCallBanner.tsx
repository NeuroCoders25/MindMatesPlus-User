import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GroupCall } from '../types/groupCall';
import { formatCallTime } from '../services/groupCallService';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  call: GroupCall;
}

export const LiveCallBanner: React.FC<Props> = ({ call }) => {
  const navigation = useNavigation<NavProp>();
  const { user } = useApp();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing dot animation — only runs for live calls.
  useEffect(() => {
    if (call.status !== 'live') return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [call.status, pulseAnim]);

  /** Navigate to the in-app full-screen WebView call screen. */
  const handleJoinCall = () => {
    navigation.push('GroupCall', {
      roomUrl: call.roomUrl,
      callTitle: call.title,
      advisorName: call.advisorName,
      userNickname: user?.nickname ?? user?.name ?? 'Student',
      groupId: call.groupId,
      callId: call.id,
    });
  };

  // ─── Live banner ────────────────────────────────────────────────────────────
  if (call.status === 'live') {
    return (
      <TouchableOpacity
        style={styles.liveBanner}
        onPress={handleJoinCall}
        activeOpacity={0.85}
      >
        <View style={styles.liveLeft}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
          <View style={styles.liveTextGroup}>
            <Text style={styles.liveTitle} numberOfLines={1}>
              Live Now · {call.title}
            </Text>
            <Text style={styles.liveSubtext}>Started by {call.advisorName}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={handleJoinCall}
          activeOpacity={0.8}
        >
          <Text style={styles.joinBtnText}>Join Call</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // ─── Scheduled banner ───────────────────────────────────────────────────────
  if (call.status === 'scheduled') {
    return (
      <View style={styles.scheduledBanner}>
        <View style={styles.scheduledLeft}>
          <Text style={styles.clockEmoji}>🕒</Text>
          <View style={styles.scheduledTextGroup}>
            <Text style={styles.scheduledTitle} numberOfLines={1}>
              Upcoming · {call.title}
            </Text>
            <Text style={styles.scheduledSubtext}>
              {formatCallTime(call.scheduledAt)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.reminderBtn}
          onPress={() =>
            Alert.alert(
              "Reminder set! We'll notify you when the call starts.",
            )
          }
          activeOpacity={0.8}
        >
          <Text style={styles.reminderBtnText}>Set Reminder</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  // ── Live ──────────────────────────────────────────────────────────────────
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E53E3E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // iOS shadow
    shadowColor: '#C53030',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    // Android
    elevation: 4,
  },
  liveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
    flexShrink: 0,
  },
  liveTextGroup: {
    flex: 1,
    gap: 2,
  },
  liveTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  liveSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  joinBtn: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 10,
    flexShrink: 0,
  },
  joinBtnText: {
    color: '#E53E3E',
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Scheduled ─────────────────────────────────────────────────────────────
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    // iOS shadow
    shadowColor: '#D69E2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    // Android
    elevation: 4,
  },
  scheduledLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  clockEmoji: {
    fontSize: 20,
    flexShrink: 0,
  },
  scheduledTextGroup: {
    flex: 1,
    gap: 2,
  },
  scheduledTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#78350F',
  },
  scheduledSubtext: {
    fontSize: 12,
    color: '#92400E',
  },
  reminderBtn: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D97706',
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 10,
    flexShrink: 0,
  },
  reminderBtnText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 13,
  },
});
