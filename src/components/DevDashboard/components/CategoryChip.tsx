import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export type ChipVariant =
  | 'depression'
  | 'anxiety'
  | 'normal'
  | 'active'
  | 'inactive'
  | 'warning'
  | 'critical'
  | 'info'
  | 'moved';

const PALETTE: Record<ChipVariant, { bg: string; text: string; border: string }> = {
  depression: { bg: 'rgba(239,68,68,0.18)',   text: '#EF4444', border: '#EF4444' },
  anxiety:    { bg: 'rgba(245,158,11,0.18)',  text: '#F59E0B', border: '#F59E0B' },
  normal:     { bg: 'rgba(0,255,136,0.15)',   text: '#00FF88', border: '#00FF88' },
  active:     { bg: 'rgba(0,255,136,0.15)',   text: '#00FF88', border: '#00FF88' },
  inactive:   { bg: 'rgba(75,85,99,0.20)',    text: '#6B7280', border: '#374151' },
  warning:    { bg: 'rgba(245,158,11,0.18)',  text: '#F59E0B', border: '#F59E0B' },
  critical:   { bg: 'rgba(239,68,68,0.18)',   text: '#EF4444', border: '#EF4444' },
  info:       { bg: 'rgba(6,182,212,0.18)',   text: '#06B6D4', border: '#06B6D4' },
  moved:      { bg: 'rgba(6,182,212,0.18)',   text: '#06B6D4', border: '#06B6D4' },
};

interface Props {
  label: string;
  variant: ChipVariant;
  small?: boolean;
}

export const CategoryChip = React.memo<Props>(({ label, variant, small = false }) => {
  const c = PALETTE[variant] ?? PALETTE.info;
  return (
    <View style={[
      styles.chip,
      { backgroundColor: c.bg, borderColor: c.border },
      small && styles.chipSm,
    ]}>
      <Text style={[styles.text, { color: c.text }, small && styles.textSm]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

CategoryChip.displayName = 'CategoryChip';

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      4,
    borderWidth:       1,
    alignSelf:         'flex-start',
  },
  chipSm: {
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  text: {
    fontFamily:  MONO,
    fontSize:    11,
    fontWeight:  '700',
  },
  textSm: {
    fontSize: 9,
  },
});
