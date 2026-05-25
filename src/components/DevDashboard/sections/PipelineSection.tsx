/**
 * Section 2 — RECOMMENDATION PIPELINE
 * Priority waterfall showing the four recommendation sources and which one is
 * currently active on the HomeScreen. Also shows the ML stability counter and
 * the consecutive-days-at-floor warning.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { DiagnosticProfile } from '../../../types/diagnostic';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
// Max circles for the stability counter display
const STABILITY_MAX = 5;

// ─── Pipeline rows ────────────────────────────────────────────────────────────

interface PipelineRow {
  priority: number;
  source:   string;
  value:    string | null;
  flag?:    boolean; // knnSafetyFlag
}

function buildRows(p: DiagnosticProfile): PipelineRow[] {
  return [
    { priority: 1, source: 'Weekly Trend',  value: p.peerGroupRecommendationCategory },
    { priority: 2, source: 'KNN Mapped',    value: p.knnMappedCategory, flag: p.knnSafetyFlag },
    { priority: 3, source: 'Baseline',      value: p.baselineRecommendationCategory },
    { priority: 4, source: 'Active (ML)',   value: p.activeRecommendationCategory },
  ];
}

/** Index of first non-null row — that is the "active" row on HomeScreen. */
function activeIndex(rows: PipelineRow[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].value) return i;
  }
  return -1;
}

// ─── Stability circles ────────────────────────────────────────────────────────

function circleColor(count: number): string {
  if (count >= STABILITY_MAX) return '#00FF88';
  if (count >= 2)             return '#F59E0B';
  return '#374151';
}

const StabilityDots = React.memo<{ count: number }>(({ count }) => {
  const clamped = Math.min(count, STABILITY_MAX);
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: STABILITY_MAX }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < clamped ? circleColor(count) : '#1F2937',
              borderColor:     i < clamped ? circleColor(count) : '#374151',
            },
          ]}
        />
      ))}
    </View>
  );
});
StabilityDots.displayName = 'StabilityDots';

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  profile: DiagnosticProfile;
}

export const PipelineSection = React.memo<Props>(({ profile }) => {
  const rows    = useMemo(() => buildRows(profile), [profile]);
  const actIdx  = useMemo(() => activeIndex(rows),  [rows]);
  const counter = profile.mlStabilityCounter;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>RECOMMENDATION PIPELINE</Text>

      {rows.map((row, i) => {
        const isActive  = i === actIdx;
        const isGreyed  = actIdx !== -1 && i > actIdx;
        const textColor = isGreyed ? '#374151' : '#D1D5DB';

        return (
          <View key={row.priority} style={[styles.pipelineRow, isActive && styles.pipelineRowActive]}>
            {/* Priority badge */}
            <View style={[styles.priorityBadge, isGreyed && styles.priorityBadgeGreyed]}>
              <Text style={[styles.priorityText, isGreyed && styles.greyedText]}>
                P{row.priority}
              </Text>
            </View>

            {/* Source + value */}
            <View style={styles.pipelineMiddle}>
              <Text style={[styles.pipelineSource, { color: textColor }]}>{row.source}</Text>
              {row.value ? (
                <Text style={[styles.pipelineValue, isGreyed && styles.greyedText]} numberOfLines={1}>
                  {row.value}
                </Text>
              ) : (
                <Text style={styles.nullText}>—</Text>
              )}
              {row.flag && (
                <Text style={styles.safetyFlagText}>⚠ G1 SAFETY FLAG</Text>
              )}
            </View>

            {/* ACTIVE chip */}
            {isActive && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>ACTIVE</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.divider} />

      {/* Stability counter */}
      {counter ? (
        <View style={styles.stabilityRow}>
          <Text style={styles.stabilityLabel}>Stability Counter</Text>
          <StabilityDots count={counter.repeatedCount} />
          <Text style={[styles.stabilityCount, { color: circleColor(counter.repeatedCount) }]}>
            {counter.repeatedCount}/{STABILITY_MAX}
          </Text>
          <Text style={styles.predictionLabel}>{counter.lastPrediction}</Text>
        </View>
      ) : (
        <Text style={styles.nullText}>No stability data yet</Text>
      )}

      {/* Consecutive days at floor warning */}
      {profile.consecutiveDaysAtBottom > 0 && (
        <Text style={styles.floorWarning}>
          ⚠ {profile.consecutiveDaysAtBottom} day(s) at Moderate Support floor
        </Text>
      )}
    </View>
  );
});

PipelineSection.displayName = 'PipelineSection';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F1117',
    borderRadius:    10,
    padding:         14,
    gap:             8,
    borderWidth:     1,
    borderColor:     '#1F2937',
  },
  sectionTitle: {
    fontFamily:    MONO,
    fontSize:      10,
    fontWeight:    '700',
    color:         '#00FF88',
    letterSpacing: 1.5,
    marginBottom:  2,
  },
  pipelineRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius:   6,
    backgroundColor: 'transparent',
  },
  pipelineRowActive: {
    backgroundColor: 'rgba(0,255,136,0.07)',
    borderWidth:     1,
    borderColor:     'rgba(0,255,136,0.25)',
  },
  priorityBadge: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: '#1F2937',
    alignItems:      'center',
    justifyContent:  'center',
  },
  priorityBadgeGreyed: {
    backgroundColor: '#111827',
  },
  priorityText: {
    fontFamily:  MONO,
    fontSize:    10,
    fontWeight:  '700',
    color:       '#9CA3AF',
  },
  greyedText: { color: '#374151' },
  pipelineMiddle: { flex: 1, gap: 1 },
  pipelineSource: {
    fontFamily: MONO,
    fontSize:   10,
    letterSpacing: 0.5,
  },
  pipelineValue: {
    fontFamily:  MONO,
    fontSize:    12,
    fontWeight:  '700',
    color:       '#F9FAFB',
  },
  nullText: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#374151',
  },
  safetyFlagText: {
    fontFamily:  MONO,
    fontSize:    10,
    fontWeight:  '700',
    color:       '#EF4444',
  },
  activeChip: {
    backgroundColor:   'rgba(0,255,136,0.15)',
    borderRadius:      4,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       '#00FF88',
  },
  activeChipText: {
    fontFamily:  MONO,
    fontSize:    9,
    fontWeight:  '700',
    color:       '#00FF88',
  },
  divider: {
    height:          1,
    backgroundColor: '#1F2937',
    marginVertical:  2,
  },
  stabilityRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flexWrap:      'wrap',
  },
  stabilityLabel: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#9CA3AF',
  },
  dotsRow: {
    flexDirection: 'row',
    gap:           4,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    borderWidth:  1,
  },
  stabilityCount: {
    fontFamily:  MONO,
    fontSize:    11,
    fontWeight:  '700',
  },
  predictionLabel: {
    fontFamily: MONO,
    fontSize:   10,
    color:      '#6B7280',
  },
  floorWarning: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#F59E0B',
  },
});
