/**
 * Section 3 — BERT PREDICTION HISTORY
 * A FlatList of compact BERT event rows (latest 20) plus a confidence sparkline.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ListRenderItemInfo,
} from 'react-native';
import { ConfidenceSparkline } from '../components/ConfidenceSparkline';
import type { MLHistoryEntry } from '../../../types/diagnostic';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  journal:    '📓',
  group_chat: '💬',
  ai_chat:    '🤖',
};

const LABEL_COLOR: Record<string, { text: string; bg: string }> = {
  depression: { text: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  anxiety:    { text: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  normal:     { text: '#00FF88', bg: 'rgba(0,255,136,0.12)' },
};

function relativeTime(date: Date): string {
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH   < 24)  return `${diffH}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Row component ────────────────────────────────────────────────────────────

const HistoryRow = React.memo<{ item: MLHistoryEntry }>(({ item }) => {
  const labelColors = LABEL_COLOR[item.prediction] ?? LABEL_COLOR.normal;
  const confPct     = `${Math.round(item.confidence * 100)}%`;

  return (
    <View style={styles.row}>
      {/* Source icon */}
      <Text style={styles.rowIcon}>{SOURCE_ICON[item.source] ?? '●'}</Text>

      {/* Timestamp */}
      <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>

      {/* Label chip */}
      <View style={[styles.labelChip, { backgroundColor: labelColors.bg }]}>
        <Text style={[styles.labelChipText, { color: labelColors.text }]}>
          {item.prediction}
        </Text>
      </View>

      {/* Confidence */}
      <Text style={[styles.confText, { color: labelColors.text }]}>{confPct}</Text>
    </View>
  );
});
HistoryRow.displayName = 'HistoryRow';

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  entries: MLHistoryEntry[];
  error?:  string | null;
}

export const BertHistorySection = React.memo<Props>(({ entries, error }) => {
  const { width: screenW } = useWindowDimensions();
  // Account for outer padding (24px) + card padding (14px) × 2
  const sparklineWidth = Math.max(120, screenW - 24 * 2 - 14 * 2);

  const renderItem = useCallback(
    (info: ListRenderItemInfo<MLHistoryEntry>) => <HistoryRow item={info.item} />,
    []
  );

  const keyExtractor = useCallback((item: MLHistoryEntry) => item.id, []);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>BERT EVENTS (LAST 20)</Text>

      {error ? (
        <Text style={styles.errorText}>⚠ {error}</Text>
      ) : entries.length === 0 ? (
        <Text style={styles.emptyText}>
          No ML events recorded yet — trigger a journal save or AI chat to populate.
        </Text>
      ) : (
        <>
          <FlatList<MLHistoryEntry>
            data={entries}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            scrollEnabled={false}   // outer ScrollView handles scrolling
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          {/* Confidence sparkline */}
          <View style={styles.sparklineContainer}>
            <Text style={styles.sparklineLabel}>Confidence over time ↑  (dashed = 0.80 threshold)</Text>
            <ConfidenceSparkline entries={entries} width={sparklineWidth} height={56} />
          </View>
        </>
      )}
    </View>
  );
});

BertHistorySection.displayName = 'BertHistorySection';

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
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    paddingVertical: 4,
  },
  rowIcon:  { fontSize: 14 },
  rowTime:  { fontFamily: MONO, fontSize: 9, color: '#6B7280', width: 60 },
  labelChip: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      3,
  },
  labelChipText: {
    fontFamily:  MONO,
    fontSize:    9,
    fontWeight:  '700',
  },
  confText: {
    fontFamily: MONO,
    fontSize:   10,
    fontWeight: '600',
    minWidth:   38,
    textAlign:  'right',
  },
  separator: {
    height:          1,
    backgroundColor: '#111827',
    marginVertical:  1,
  },
  sparklineContainer: { gap: 2, paddingTop: 4 },
  sparklineLabel: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#4B5563',
  },
  emptyText: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#6B7280',
    fontStyle:  'italic',
    lineHeight: 18,
  },
  errorText: {
    fontFamily: MONO,
    fontSize:   11,
    color:      '#EF4444',
  },
});
