/**
 * Section 1 — LIVE SCORES
 * DASS-21 subscale progress bars, wellness score bar, and user-status chip.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { DiagnosticProfile } from '../../../types/diagnostic';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Severity helpers ─────────────────────────────────────────────────────────

type SeverityResult = { label: string; color: string };

function depressionSeverity(score: number): SeverityResult {
  if (score >= 28) return { label: 'Ext. Severe', color: '#EF4444' };
  if (score >= 21) return { label: 'Severe',      color: '#EF4444' };
  if (score >= 14) return { label: 'Moderate',    color: '#F59E0B' };
  if (score >= 10) return { label: 'Mild',        color: '#F59E0B' };
  return              { label: 'Normal',       color: '#00FF88' };
}

function anxietySeverity(score: number): SeverityResult {
  if (score >= 20) return { label: 'Ext. Severe', color: '#EF4444' };
  if (score >= 15) return { label: 'Severe',      color: '#EF4444' };
  if (score >= 10) return { label: 'Moderate',    color: '#F59E0B' };
  if (score >= 8)  return { label: 'Mild',        color: '#F59E0B' };
  return              { label: 'Normal',       color: '#00FF88' };
}

function stressSeverity(score: number): SeverityResult {
  if (score >= 34) return { label: 'Ext. Severe', color: '#EF4444' };
  if (score >= 26) return { label: 'Severe',      color: '#EF4444' };
  if (score >= 19) return { label: 'Moderate',    color: '#F59E0B' };
  if (score >= 15) return { label: 'Mild',        color: '#F59E0B' };
  return              { label: 'Normal',       color: '#00FF88' };
}

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  normal:       { text: '#00FF88', bg: 'rgba(0,255,136,0.15)' },
  under_review: { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  restricted:   { text: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface BarRowProps {
  label: string;
  score: number;
  maxScore: number;
  severity: SeverityResult;
}

const BarRow = React.memo<BarRowProps>(({ label, score, maxScore, severity }) => {
  const pct = Math.min(1, score / maxScore);
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barScore, { color: severity.color }]}>
          {score}/{maxScore}{'  '}{severity.label}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: severity.color }]} />
      </View>
    </View>
  );
});
BarRow.displayName = 'BarRow';

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  profile: DiagnosticProfile;
  error?: string | null;
}

export const LiveScoresSection = React.memo<Props>(({ profile, error }) => {
  const depSev = useMemo(() => depressionSeverity(profile.depressionScore), [profile.depressionScore]);
  const anxSev = useMemo(() => anxietySeverity(profile.anxietyScore),       [profile.anxietyScore]);
  const strSev = useMemo(() => stressSeverity(profile.stressScore),         [profile.stressScore]);

  const wellnessPct   = profile.wellnessScore !== null ? profile.wellnessScore / 100 : null;
  const statusColors  = STATUS_COLORS[profile.userStatus] ?? STATUS_COLORS.normal;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>DASS-21 SCORES</Text>

      {error ? (
        <Text style={styles.errorText}>⚠ {error}</Text>
      ) : (
        <>
          <BarRow label="Depression" score={profile.depressionScore} maxScore={42} severity={depSev} />
          <BarRow label="Anxiety"    score={profile.anxietyScore}    maxScore={42} severity={anxSev} />
          <BarRow label="Stress"     score={profile.stressScore}     maxScore={42} severity={strSev} />

          <View style={styles.divider} />

          {/* Wellness Score */}
          <View style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Wellness Score</Text>
              <Text style={[styles.barScore, { color: '#00FF88' }]}>
                {profile.wellnessScore !== null ? `${profile.wellnessScore}/100` : 'N/A'}
              </Text>
            </View>
            {wellnessPct !== null ? (
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${wellnessPct * 100}%`, backgroundColor: '#00FF88' }]} />
              </View>
            ) : (
              <Text style={styles.naText}>No score recorded</Text>
            )}
          </View>

          {/* User Status */}
          <View style={styles.statusRow}>
            <Text style={styles.barLabel}>User Status</Text>
            <View style={[styles.statusChip, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {profile.userStatus}
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
});

LiveScoresSection.displayName = 'LiveScoresSection';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F1117',
    borderRadius:    10,
    padding:         14,
    gap:             10,
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
  barRow: { gap: 4 },
  barLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  barLabel: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#9CA3AF',
  },
  barScore: {
    fontFamily: MONO,
    fontSize:   11,
    fontWeight: '700',
  },
  barTrack: {
    height:          8,
    backgroundColor: '#1F2937',
    borderRadius:    4,
    overflow:        'hidden',
  },
  barFill: {
    height:       8,
    borderRadius: 4,
  },
  divider: {
    height:          1,
    backgroundColor: '#1F2937',
    marginVertical:  2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      20,
  },
  statusText: {
    fontFamily: MONO,
    fontSize:   11,
    fontWeight: '700',
  },
  naText: {
    fontFamily: MONO,
    fontSize:   10,
    color:      '#6B7280',
    fontStyle:  'italic',
  },
  errorText: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#EF4444',
  },
});
