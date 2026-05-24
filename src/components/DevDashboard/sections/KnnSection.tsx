/**
 * Section 4 — KNN RESULT
 * Shows the last KNN inference result or a safety-flag warning.
 * Includes a probability bar chart and a "Re-run KNN" button.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { callKnnAndWriteResult } from '../../../services/dataService';
import type { DiagnosticProfile } from '../../../types/diagnostic';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Group probability bar row ────────────────────────────────────────────────

const ProbBar = React.memo<{ groupKey: string; probability: number }>(({ groupKey, probability }) => {
  const pct    = Math.max(0, Math.min(1, probability));
  // Short display label: strip "G4_Anxiety_Management" → "G4 Anxiety"
  const label  = groupKey.replace(/_/g, ' ').split(' ').slice(0, 2).join(' ');
  const barColor = pct >= 0.5 ? '#00FF88' : pct >= 0.25 ? '#F59E0B' : '#374151';

  return (
    <View style={probStyles.row}>
      <Text style={probStyles.label} numberOfLines={1}>{label}</Text>
      <View style={probStyles.track}>
        <View style={[probStyles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[probStyles.pct, { color: barColor }]}>
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
});
ProbBar.displayName = 'ProbBar';

const probStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  4,
  },
  label: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#9CA3AF',
    width:      72,
  },
  track: {
    flex:            1,
    height:          6,
    backgroundColor: '#1F2937',
    borderRadius:    3,
    overflow:        'hidden',
  },
  fill: {
    height:       6,
    borderRadius: 3,
  },
  pct: {
    fontFamily: MONO,
    fontSize:   9,
    width:      32,
    textAlign:  'right',
  },
});

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  uid:     string;
  profile: DiagnosticProfile;
}

export const KnnSection = React.memo<Props>(({ uid, profile }) => {
  const [running,  setRunning]  = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOk,    setRunOk]    = useState(false);

  const handleRerun = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    setRunOk(false);
    try {
      await callKnnAndWriteResult(uid);
      setRunOk(true);
      setTimeout(() => setRunOk(false), 3000);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  }, [uid]);

  // ── Safety flag state — full-section red warning ─────────────────────────
  if (profile.knnSafetyFlag) {
    return (
      <View style={[styles.card, styles.crisisCard]}>
        <Text style={styles.crisisTitle}>⚠ G1 SAFETY FLAG ACTIVE</Text>
        <Text style={styles.crisisBody}>
          KNN predicted Crisis — auto-assignment blocked.{'\n'}
          Awaiting advisor review.
        </Text>
        <TouchableOpacity
          style={[styles.rerunBtn, styles.rerunBtnCrisis]}
          onPress={handleRerun}
          disabled={running}
          activeOpacity={0.7}
        >
          {running
            ? <ActivityIndicator size="small" color="#EF4444" />
            : <Text style={[styles.rerunBtnText, { color: '#EF4444' }]}>Re-run KNN</Text>
          }
        </TouchableOpacity>
        {runError && <Text style={styles.rerunError}>⚠ {runError}</Text>}
      </View>
    );
  }

  // ── Normal KNN result display ─────────────────────────────────────────────
  const probEntries = profile.knnProbabilities
    ? Object.entries(profile.knnProbabilities).sort((a, b) => b[1] - a[1])
    : null;

  const lastUpdatedStr = profile.knnLastUpdatedAt
    ? profile.knnLastUpdatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>KNN RESULT</Text>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldKey}>KNN Group</Text>
        <Text style={styles.fieldVal}>{profile.knnRecommendedGroup ?? '—'}</Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldKey}>Mapped Cat</Text>
        <Text style={[styles.fieldVal, styles.accent]}>{profile.knnMappedCategory ?? '—'}</Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldKey}>Safety Flag</Text>
        <Text style={[styles.fieldVal, { color: '#00FF88' }]}>false</Text>
      </View>

      {profile.knnFallbackReason && (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldKey}>Fallback</Text>
          <Text style={[styles.fieldVal, { color: '#F59E0B' }]}>{profile.knnFallbackReason}</Text>
        </View>
      )}

      {lastUpdatedStr && (
        <Text style={styles.updatedAt}>Last run: {lastUpdatedStr}</Text>
      )}

      <View style={styles.divider} />

      {/* Probability breakdown */}
      {probEntries && probEntries.length > 0 ? (
        <>
          <Text style={styles.subheading}>GROUP PROBABILITIES</Text>
          {probEntries.map(([key, val]) => (
            <ProbBar key={key} groupKey={key} probability={val} />
          ))}
        </>
      ) : (
        <Text style={styles.noProbText}>
          Full probability breakdown unavailable — tap Re-run KNN to refresh.
        </Text>
      )}

      <View style={styles.divider} />

      {/* Re-run button */}
      <TouchableOpacity
        style={styles.rerunBtn}
        onPress={handleRerun}
        disabled={running}
        activeOpacity={0.7}
      >
        {running ? (
          <ActivityIndicator size="small" color="#00FF88" />
        ) : (
          <Text style={styles.rerunBtnText}>
            {runOk ? '✓ KNN refreshed' : '↻ Re-run KNN'}
          </Text>
        )}
      </TouchableOpacity>

      {runError && <Text style={styles.rerunError}>⚠ {runError}</Text>}
    </View>
  );
});

KnnSection.displayName = 'KnnSection';

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
  crisisCard: {
    borderColor: '#EF4444',
    gap:         12,
  },
  sectionTitle: {
    fontFamily:    MONO,
    fontSize:      10,
    fontWeight:    '700',
    color:         '#00FF88',
    letterSpacing: 1.5,
    marginBottom:  2,
  },
  crisisTitle: {
    fontFamily:  MONO,
    fontSize:    14,
    fontWeight:  '700',
    color:       '#EF4444',
    textAlign:   'center',
  },
  crisisBody: {
    fontFamily:  MONO,
    fontSize:    11,
    color:       '#FCA5A5',
    textAlign:   'center',
    lineHeight:  18,
  },
  fieldRow: {
    flexDirection: 'row',
    gap:           8,
    alignItems:    'flex-start',
  },
  fieldKey: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#6B7280',
    width:      80,
  },
  fieldVal: {
    fontFamily:  MONO,
    fontSize:    11,
    fontWeight:  '600',
    color:       '#D1D5DB',
    flex:        1,
  },
  accent: { color: '#00FF88' },
  updatedAt: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#4B5563',
  },
  divider: {
    height:          1,
    backgroundColor: '#1F2937',
    marginVertical:  2,
  },
  subheading: {
    fontFamily:    MONO,
    fontSize:      9,
    fontWeight:    '700',
    color:         '#4B5563',
    letterSpacing: 1,
    marginBottom:  2,
  },
  noProbText: {
    fontFamily: MONO,
    fontSize:   10,
    color:      '#4B5563',
    fontStyle:  'italic',
    lineHeight: 16,
  },
  rerunBtn: {
    backgroundColor:   '#111827',
    borderRadius:      8,
    paddingVertical:   10,
    paddingHorizontal: 16,
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       '#00FF88',
    minHeight:         40,
    justifyContent:    'center',
  },
  rerunBtnCrisis: {
    borderColor: '#EF4444',
  },
  rerunBtnText: {
    fontFamily:  MONO,
    fontSize:    12,
    fontWeight:  '700',
    color:       '#00FF88',
  },
  rerunError: {
    fontFamily: MONO,
    fontSize:   10,
    color:      '#EF4444',
  },
});
