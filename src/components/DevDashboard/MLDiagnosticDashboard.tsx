/**
 * MLDiagnosticDashboard — dev-only overlay panel.
 *
 * Rendered inside WellnessGoalsScreen when __DEV__ is true and the user taps
 * the DEV badge. Shows real-time ML pipeline diagnostics in 5 sections.
 *
 * ⚠ NEVER renders in production builds (__DEV__ guard is in the parent).
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import { useDiagnosticData } from '../../hooks/useDiagnosticData';
import { LiveScoresSection }   from './sections/LiveScoresSection';
import { PipelineSection }     from './sections/PipelineSection';
import { BertHistorySection }  from './sections/BertHistorySection';
import { KnnSection }          from './sections/KnnSection';
import { EventLogSection }     from './sections/EventLogSection';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Pulsing LIVE dot ─────────────────────────────────────────────────────────

const LiveDot = React.memo(() => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600,  useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 600,  useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.liveDot, { opacity }]}>●</Animated.Text>
  );
});
LiveDot.displayName = 'LiveDot';

// ─── Error card ───────────────────────────────────────────────────────────────

const SectionErrorCard = React.memo<{ title: string; message: string }>(({ title, message }) => (
  <View style={styles.errorCard}>
    <Text style={styles.errorCardTitle}>⚠ {title} listener failed</Text>
    <Text style={styles.errorCardMsg}>{message}</Text>
  </View>
));
SectionErrorCard.displayName = 'SectionErrorCard';

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface Props {
  uid: string;
}

export const MLDiagnosticDashboard: React.FC<Props> = ({ uid }) => {
  const { profile, mlHistory, eventLog, loading, errors, clearLog } =
    useDiagnosticData(uid);

  const isProfileLoading = loading.profile;

  return (
    <View style={styles.container}>
      {/* Dashboard header */}
      <View style={styles.headerRow}>
        <LiveDot />
        <Text style={styles.headerText}> LIVE  —  ML DIAGNOSTIC DASHBOARD</Text>
      </View>

      <View style={styles.subheaderRow}>
        <Text style={styles.subheaderText}>uid: {uid}</Text>
        <View style={styles.devBadge}>
          <Text style={styles.devBadgeText}>__DEV__</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Section 1: Live DASS-21 Scores ─────────────────────────────────── */}
      <Text style={styles.sectionHeader}>① LIVE SCORES</Text>
      {errors.profile ? (
        <SectionErrorCard title="Profile" message={errors.profile} />
      ) : isProfileLoading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      ) : !profile ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>
            No profile found — complete the DASS-21 questionnaire first.
          </Text>
        </View>
      ) : (
        <LiveScoresSection profile={profile} error={errors.profile} />
      )}

      {/* ── Section 2: Recommendation Pipeline ──────────────────────────────── */}
      <Text style={styles.sectionHeader}>② RECOMMENDATION PIPELINE</Text>
      {errors.profile ? (
        <SectionErrorCard title="Pipeline" message={errors.profile} />
      ) : !profile ? null : (
        <PipelineSection profile={profile} />
      )}

      {/* ── Section 3: BERT History ──────────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>③ BERT PREDICTION HISTORY</Text>
      {errors.mlHistory ? (
        <SectionErrorCard title="ML History" message={errors.mlHistory} />
      ) : (
        <BertHistorySection
          entries={mlHistory}
          error={loading.mlHistory ? null : errors.mlHistory}
        />
      )}

      {/* ── Section 4: KNN Result ────────────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>④ KNN RESULT</Text>
      {errors.profile ? (
        <SectionErrorCard title="KNN" message={errors.profile} />
      ) : !profile ? null : (
        <KnnSection uid={uid} profile={profile} />
      )}

      {/* ── Section 5: Event Log ─────────────────────────────────────────────── */}
      <Text style={styles.sectionHeader}>⑤ EVENT LOG</Text>
      <EventLogSection entries={eventLog} onClear={clearLog} />

      {/* Footer disclaimer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          DEV ONLY — not visible in production builds. Read-only except Re-run KNN.
        </Text>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#080B12',
    borderRadius:    12,
    padding:         14,
    gap:             12,
    borderWidth:     2,
    borderColor:     '#00FF88',
    marginTop:       12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  liveDot: {
    fontFamily:  MONO,
    fontSize:    14,
    color:       '#00FF88',
  },
  headerText: {
    fontFamily:    MONO,
    fontSize:      12,
    fontWeight:    '700',
    color:         '#00FF88',
    letterSpacing: 1.2,
  },
  subheaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      -4,
  },
  subheaderText: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#4B5563',
  },
  devBadge: {
    backgroundColor:   '#1A1A2E',
    borderWidth:       1,
    borderColor:       '#00FF88',
    borderRadius:      4,
    paddingHorizontal: 6,
    paddingVertical:   1,
  },
  devBadgeText: {
    fontFamily:  MONO,
    fontSize:    9,
    fontWeight:  '700',
    color:       '#00FF88',
  },
  divider: {
    height:          1,
    backgroundColor: '#1F2937',
  },
  sectionHeader: {
    fontFamily:    MONO,
    fontSize:      11,
    fontWeight:    '700',
    color:         '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom:  -4,
    marginTop:     4,
  },
  loadingCard: {
    backgroundColor: '#0F1117',
    borderRadius:    10,
    padding:         16,
    borderWidth:     1,
    borderColor:     '#1F2937',
    alignItems:      'center',
  },
  loadingText: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#6B7280',
    fontStyle:  'italic',
    textAlign:  'center',
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius:    10,
    padding:         12,
    borderWidth:     1,
    borderColor:     '#EF4444',
    gap:             4,
  },
  errorCardTitle: {
    fontFamily:  MONO,
    fontSize:    11,
    fontWeight:  '700',
    color:       '#EF4444',
  },
  errorCardMsg: {
    fontFamily: MONO,
    fontSize:   10,
    color:      '#FCA5A5',
  },
  footer: {
    paddingTop: 4,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#374151',
    textAlign:  'center',
    fontStyle:  'italic',
  },
});
