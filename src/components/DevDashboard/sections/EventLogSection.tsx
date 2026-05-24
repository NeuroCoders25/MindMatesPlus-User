/**
 * Section 5 — EVENT LOG
 * Append-only live log of Firestore field changes since the dashboard was opened.
 * Auto-scrolls to the bottom on new entries. Max 30 entries.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import type { EventLogEntry } from '../../../types/diagnostic';

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

function hhmmss(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface Props {
  entries:  EventLogEntry[];
  onClear:  () => void;
}

export const EventLogSection = React.memo<Props>(({ entries, onClear }) => {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (entries.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [entries.length]);

  return (
    <View style={styles.card}>
      {/* Header with clear button */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>EVENT LOG</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.7}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>
          Watching for changes… open the dashboard and interact with the app.
        </Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.logScroll}
          showsVerticalScrollIndicator={false}
        >
          {entries.map(e => (
            <View key={e.id} style={styles.logRow}>
              <Text style={styles.logTime}>[{hhmmss(e.timestamp)}]</Text>
              <Text style={styles.logField}>{e.field}:</Text>
              <Text style={styles.logOld}>{e.oldValue}</Text>
              <Text style={styles.logArrow}>→</Text>
              <Text style={styles.logNew}>{e.newValue}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

EventLogSection.displayName = 'EventLogSection';

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
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  sectionTitle: {
    fontFamily:    MONO,
    fontSize:      10,
    fontWeight:    '700',
    color:         '#00FF88',
    letterSpacing: 1.5,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      4,
    backgroundColor:   '#1F2937',
    borderWidth:       1,
    borderColor:       '#374151',
  },
  clearBtnText: {
    fontFamily:  MONO,
    fontSize:    10,
    color:       '#9CA3AF',
  },
  logScroll: {
    maxHeight: 220,
  },
  logRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  logTime: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#4B5563',
  },
  logField: {
    fontFamily:  MONO,
    fontSize:    9,
    fontWeight:  '700',
    color:       '#9CA3AF',
  },
  logOld: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#6B7280',
    textDecorationLine: 'line-through',
  },
  logArrow: {
    fontFamily: MONO,
    fontSize:   9,
    color:      '#374151',
  },
  logNew: {
    fontFamily:  MONO,
    fontSize:    9,
    fontWeight:  '700',
    color:       '#00FF88',
  },
  emptyText: {
    fontFamily: MONO,
    fontSize:   10,
    color:      '#4B5563',
    fontStyle:  'italic',
    lineHeight: 16,
  },
});
