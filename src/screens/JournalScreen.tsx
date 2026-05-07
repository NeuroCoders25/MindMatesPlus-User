import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Input, Card, Button } from '../components/UI';
import { COLORS, ML_CATEGORY_MAP } from '../services/dataService';
import { JournalEntry } from '../types';
import { predictText, MlPredictResponse } from '../services/mlApiService';
import { moderateContent } from '../services/geminiService';

interface AnalysisResult {
  sentiment: string;
  emotion: string;
  risk: 'Low' | 'Moderate' | 'High';
  score: number;
}

const MOODS = [
  { emoji: '😊', label: 'happy' },
  { emoji: '😔', label: 'sad' },
  { emoji: '😤', label: 'angry' },
  { emoji: '😴', label: 'tired' },
];

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

export const JournalScreen = () => {
  const { journalEntries, addJournalEntry } = useApp();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [mlResult, setMlResult] = useState<MlPredictResponse | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const handleSave = async () => {
    if (!content.trim()) return;

    setModerationError(null);
    setIsAnalyzing(true);
    const moderation = await moderateContent(content);
    if (!moderation.safe) {
      setIsAnalyzing(false);
      setModerationError(
        moderation.reason ??
          'Your journal entry contains inappropriate content and cannot be saved. Please keep your writing respectful.',
      );
      return;
    }

    setMlError(null);

    let mlAnalysis: MlPredictResponse | undefined;

    try {
      mlAnalysis = await predictText(content);
      console.log('ML prediction result:', mlAnalysis);
      const result: AnalysisResult = {
        emotion: ML_CATEGORY_MAP[mlAnalysis.prediction] ?? mlAnalysis.prediction,
        sentiment: `${(mlAnalysis.confidence * 100).toFixed(0)}% confident`,
        risk: mlAnalysis.prediction === 'normal' ? 'Low' : 'Moderate',
        score: mlAnalysis.confidence,
      };
      setAnalysis(result);
      setMlResult(mlAnalysis);
    } catch (err) {
      console.error('ML API error:', err);
      setMlError('Analysis service unavailable. Your entry has been saved.');
    }

    setIsAnalyzing(false);
    await addJournalEntry(title || 'Untitled Entry', content, selectedMood || 'neutral', mlAnalysis);

    setTimeout(() => {
      setTitle('');
      setContent('');
      setSelectedMood('');
      setAnalysis(null);
      setMlResult(null);
      setMlError(null);
    }, 3000);
  };

  const riskBarColor = (risk: string, level: number) => {
    if (risk === 'Low' && level === 1) return '#4ADE80';
    if (risk === 'Moderate' && level <= 2) return '#FACC15';
    if (risk === 'High') return '#F87171';
    return 'rgba(255,255,255,0.2)';
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>My Journal</Text>
        <Text style={styles.subtitle}>Express yourself freely and safely</Text>

        {/* Entry Form Card */}
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.dateRow}>
              <Feather name="calendar" size={14} color={COLORS.muted} />
              <Text style={styles.dateLabel}>{fmtDate(new Date()).toUpperCase()}</Text>
            </View>
            <Feather name="tag" size={14} color="rgba(110,110,110,0.3)" />
          </View>

          <Input
            placeholder="Entry title (optional)"
            value={title}
            onChangeText={setTitle}
            style={styles.titleInput}
          />
          <Input
            placeholder="How are you really feeling today?"
            value={content}
            onChangeText={t => { setContent(t); if (moderationError) setModerationError(null); }}
            type="textarea"
            style={styles.contentInput}
          />

          <View style={styles.formFooter}>
            <View style={styles.moodRow}>
              {MOODS.map(({ emoji, label }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => setSelectedMood(label)}
                  style={[
                    styles.moodBtn,
                    selectedMood === label && styles.activeMoodBtn,
                  ]}
                >
                  <Text style={styles.moodEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              onPress={handleSave}
              disabled={isAnalyzing || !content.trim()}
            >
              {isAnalyzing ? 'Analyzing...' : 'Save Entry'}
            </Button>
          </View>
        </Card>

        {/* Moderation error */}
        {moderationError && (
          <View style={styles.moderationBanner}>
            <Ionicons name="warning-outline" size={16} color="#DC2626" />
            <Text style={styles.moderationBannerText}>{moderationError}</Text>
          </View>
        )}

        {/* ML API error message */}
        {mlError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
            <Text style={styles.errorText}>{mlError}</Text>
          </View>
        )}

        {/* AI Insight */}
        {analysis && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Ionicons name="sparkles" size={18} color="#C4B5FD" />
              <Text style={styles.insightLabel}>AI EMOTION INSIGHT</Text>
            </View>
            <View style={styles.insightGrid}>
              <View style={styles.insightCell}>
                <Text style={styles.insightCellLabel}>Dominant Emotion</Text>
                <Text style={styles.insightCellValue}>{analysis.emotion}</Text>
              </View>
              <View style={styles.insightCell}>
                <Text style={styles.insightCellLabel}>Sentiment</Text>
                <Text style={styles.insightCellValue}>{analysis.sentiment}</Text>
              </View>
            </View>
            <View style={styles.riskRow}>
              <View>
                <Text style={styles.insightCellLabel}>Risk Level</Text>
                <Text style={styles.insightCellValue}>{analysis.risk}</Text>
              </View>
              <View style={styles.riskBars}>
                {[1, 2, 3].map(level => (
                  <View
                    key={level}
                    style={[
                      styles.riskBar,
                      { backgroundColor: riskBarColor(analysis.risk, level) },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Probabilities breakdown */}
            {mlResult && (
              <View style={styles.probRow}>
                {(['depression', 'anxiety', 'normal'] as const).map(key => (
                  <View key={key} style={styles.probCell}>
                    <Text style={styles.probLabel}>{ML_CATEGORY_MAP[key]}</Text>
                    <Text style={styles.probValue}>
                      {(mlResult.probabilities[key] * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Past Entries */}
        {journalEntries.length > 0 && (
          <View style={styles.entriesSection}>
            <Text style={styles.entriesLabel}>RECENT REFLECTIONS</Text>
            {journalEntries.slice(0, 5).map(entry => (
              <Card
                key={entry.id}
                style={styles.entryRow}
                onPress={() => setSelectedEntry(entry)}
              >
                <View style={styles.entryIcon}>
                  <Text style={styles.entryEmoji}>
                    {MOODS.find(m => m.label === entry.mood)?.emoji || '📝'}
                  </Text>
                </View>
                <View style={styles.entryMeta}>
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.entryDate}>
                    {fmtDate(entry.timestamp)} • {fmtTime(entry.timestamp)}
                  </Text>
                  <Text style={styles.entrySnippet} numberOfLines={1}>
                    {entry.content}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="rgba(110,110,110,0.3)"
                />
              </Card>
            ))}
          </View>
        )}

        {/* Empty State */}
        {journalEntries.length === 0 && !analysis && (
          <Card style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="edit-2" size={32} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>Start Your First Entry</Text>
            <Text style={styles.emptyDesc}>
              Express your thoughts and feelings. Our AI will help you understand
              your emotional patterns.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Entry Detail Modal */}
      <Modal visible={!!selectedEntry} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedEntry(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            {selectedEntry && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.entryIcon}>
                    <Text style={styles.entryEmoji}>
                      {MOODS.find(m => m.label === selectedEntry.mood)?.emoji || '📝'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selectedEntry.title}</Text>
                    <Text style={styles.entryDate}>
                      {fmtDate(selectedEntry.timestamp)} •{' '}
                      {fmtTime(selectedEntry.timestamp)}
                    </Text>
                  </View>
                </View>
                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalBodyText}>{selectedEntry.content}</Text>
                </ScrollView>
                <Button
                  onPress={() => setSelectedEntry(null)}
                  style={{ marginTop: 20 }}
                >
                  Close
                </Button>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.muted },
  formCard: { gap: 16 },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 1,
  },
  titleInput: { backgroundColor: 'rgba(219,234,254,0.5)' },
  contentInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: 160,
  },
  formFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFF6FF',
  },
  moodRow: { flexDirection: 'row', gap: 8 },
  moodBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeMoodBtn: {
    backgroundColor: 'rgba(93,95,239,0.1)',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  moodEmoji: { fontSize: 20 },
  insightCard: {
    backgroundColor: COLORS.accent,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  insightGrid: { flexDirection: 'row', gap: 12 },
  insightCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
  },
  insightCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  insightCellValue: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  riskRow: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  riskBars: { flexDirection: 'row', gap: 4 },
  riskBar: { width: 8, height: 32, borderRadius: 4 },
  entriesSection: { gap: 12 },
  entriesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 1,
  },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  entryIcon: {
    width: 52,
    height: 52,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryEmoji: { fontSize: 24 },
  entryMeta: { flex: 1 },
  entryTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  entryDate: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  entrySnippet: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 28,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  modalBody: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    maxHeight: 240,
  },
  modalBodyText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#DC2626', flex: 1 },
  probRow: {
    flexDirection: 'row',
    gap: 8,
  },
  probCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  probLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  probValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
  },
  moderationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  moderationBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
});
