import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge } from '../services/gamificationApiService';

const BADGE_ICON_MAP: Record<string, string> = {
  journal: '📓',
  streak: '🔥',
  questionnaire: '📋',
  group: '👥',
  goal: '🎯',
  steps: '👣',
  feedback: '💬',
  return: '👋',
  checkin: '⭐',
  support_blue: '💙',
  support_bronze: '🥉',
  support_silver: '🥈',
  support_gold: '🥇',
  support_platinum: '💎',
};

export const getIcon = (iconName: string): string => BADGE_ICON_MAP[iconName] ?? '🏅';

interface Props {
  badge: Badge | null;
  onDismiss: () => void;
}

const HIDDEN_Y = -120;
const AUTO_DISMISS_MS = 4000;

export const BadgeAwardToast: React.FC<Props> = ({ badge, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(HIDDEN_Y)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(slideAnim, {
      toValue: HIDDEN_Y,
      duration: 260,
      useNativeDriver: true,
    }).start(onDismiss);
  };

  useEffect(() => {
    if (!badge) return;
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
    timerRef.current = setTimeout(handleDismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [badge]);

  if (!badge) return null;

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.badgeCircle}>
        <Text style={styles.badgeEmoji}>{getIcon(badge.iconName)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.badgeTitle}>🏅 Badge Earned!</Text>
        <Text style={styles.badgeName}>{badge.badgeName}</Text>
        <Text style={styles.badgeDesc} numberOfLines={1}>
          {badge.description}
        </Text>
      </View>
      <TouchableOpacity onPress={handleDismiss}>
        <Text style={styles.closeX}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 24 },
  badgeTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  badgeName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  badgeDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  closeX: { color: 'rgba(255,255,255,0.6)', fontSize: 18, padding: 4 },
});
