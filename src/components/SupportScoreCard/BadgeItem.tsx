import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { BadgeDefinition } from '../../constants/badges';

interface Props {
  badge: BadgeDefinition;
  earned: boolean;
}

export const BadgeItem: React.FC<Props> = ({ badge, earned }) => {
  const handlePress = () => {
    Alert.alert(badge.name, badge.description);
  };

  return (
    <TouchableOpacity
      style={[styles.container, !earned && styles.unearned]}
      onPress={handlePress}
    >
      <Text style={styles.emoji}>{badge.emoji}</Text>
      <Text
        style={[styles.name, earned ? styles.nameEarned : styles.nameUnearned]}
        numberOfLines={2}
      >
        {badge.name}
      </Text>
      <Text style={[styles.status, earned ? styles.statusEarned : styles.statusUnearned]}>
        {earned ? '✓' : '—'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  unearned: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 28,
  },
  name: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  nameEarned: {
    color: '#111827',
  },
  nameUnearned: {
    color: '#9CA3AF',
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusEarned: {
    color: '#10B981',
  },
  statusUnearned: {
    color: '#D1D5DB',
  },
});
