import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { DASS_QUESTIONS, DASS_OPTIONS, computeDass21Result, COLORS } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { db } from '../services/firebaseConfig';
import { Dass21Result } from '../types';
import { askQuestionDoubt } from '../services/geminiService';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;

const TOTAL = DASS_QUESTIONS.length; // 21

// ─── Chatbot helpers ────────────────────────────────────────────────────

const buildQuestionHelp = (questionText: string, subscale: 'depression' | 'anxiety' | 'stress') => {
  const lower = questionText.toLowerCase();
  let meaning = 'This item asks about how often this feeling happened over the past week.';
  if (lower.includes('wind down') || lower.includes('relax') || lower.includes('agitated')) {
    meaning = 'This item checks body tension and how hard it was to settle your mind or body.';
  } else if (lower.includes('panic') || lower.includes('scared') || lower.includes('trembling') || lower.includes('breathing')) {
    meaning = 'This item checks physical anxiety signs like panic feelings, fear, or body alarm reactions.';
  } else if (lower.includes('nothing to look forward') || lower.includes('meaningless') || lower.includes('down-hearted')) {
    meaning = 'This item checks low mood and hopeless thoughts during the week.';
  }
  const subscaleTip =
    subscale === 'stress'
      ? 'For stress items, think about irritability, pressure, and difficulty calming down.'
      : subscale === 'anxiety'
        ? 'For anxiety items, focus on fear, nervousness, and physical signs like heart racing or shakiness.'
        : 'For depression items, focus on low mood, low motivation, and loss of positive feelings.';
  return {
    meaning,
    tips: [
      'Answer based on the past 7 days, not just today.',
      subscaleTip,
      'Choose the option that was true most often, even if not true every day.',
      'If unsure between two choices, pick the lower one unless it happened frequently.',
    ],
  };
};

const OPTION_GUIDE = [
  '0: Did not apply to me at all (never or almost never this week).',
  '1: Applied to me to some degree (once or occasionally).',
  '2: Applied to me to a considerable degree (many times this week).',
  '3: Applied to me very much or most of the time (nearly every day/intense).',
];

const saveToFirestore = async (
  userId: string,
  answers: Record<number, number>,
  result: Dass21Result,
) => {
  const scores = {
    depressionScore: result.depression.final,
    anxietyScore:    result.anxiety.final,
    stressScore:     result.stress.final,
    totalScore:      result.depression.final + result.anxiety.final + result.stress.final,
  };

  // One document per attempt — stored under the user's subcollection
  await addDoc(collection(db, 'users', userId, 'questionnaireResponses'), {
    date:       serverTimestamp(),
    ...scores,
    riskLevel:     result.riskLevel,
    groupCategory: result.groupCategory,
    answers,
  });

  // Single document per user — overwritten on each reassessment
  await setDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'), {
    ...scores,
    classificationLevel: result.riskLevel,
    groupCategory:       result.groupCategory,
    updatedAt:           serverTimestamp(),
  });
};

export const QuestionnaireScreen: React.FC<Props> = ({ navigation }) => {
  const { setDass21Result, prepareSupportChatFromDass, user } = useApp();
  const [showInstructions, setShowInstructions] = useState(true);
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed; 0 = Q1
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showHelper, setShowHelper] = useState(false);
  const [doubtInput, setDoubtInput] = useState('');
  const [geminiReply, setGeminiReply] = useState<string | null>(null);
  const [askingGemini, setAskingGemini] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = DASS_QUESTIONS[currentStep];
  const helperContent = buildQuestionHelp(currentQuestion.text, currentQuestion.subscale);

  const handleOpenHelper = () => {
    setGeminiReply(null);
    setDoubtInput('');
    setShowHelper(v => !v);
  };

  const handleAskGemini = async () => {
    if (askingGemini) return;
    setAskingGemini(true);
    setGeminiReply(null);
    const reply = await askQuestionDoubt(
      doubtInput,
      currentQuestion.text,
      currentQuestion.subscale,
      currentStep + 1,
    );
    setAskingGemini(false);
    setGeminiReply(reply ?? (helperContent.meaning + '\n\n' + helperContent.tips.join('\n')));
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const handleStart = () => {
    setShowInstructions(false);
    Animated.timing(progressAnim, {
      toValue: (1 / TOTAL) * 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleAnswer = (value: number) => {
    const questionNum = currentStep + 1;
    setAnswers({ ...answers, [questionNum]: value });
  };

  const handleNext = () => {
    const questionNum = currentStep + 1;
    if (answers[questionNum] === undefined) return;

    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (currentStep < TOTAL - 1) {
        const next = currentStep + 1;
        setCurrentStep(next);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(progressAnim, {
            toValue: ((next + 1) / TOTAL) * 100,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
      } else {
        const result = computeDass21Result(answers);
        setDass21Result(result);
        prepareSupportChatFromDass(result);
        if (user?.id) {
          saveToFirestore(user.id, answers, result).catch(console.error);
        }
        navigation.replace('Result');
      }
    });
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        const prev = currentStep - 1;
        setCurrentStep(prev);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(progressAnim, {
            toValue: ((prev + 1) / TOTAL) * 100,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
      });
    }
  };

  // ─── Instructions screen ───────────────────────────────────────────────────
  if (showInstructions) {
    return (
      <View style={styles.container}>
        <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        <View style={styles.instructionsBlock}>
          <Text style={styles.title}>Mental Wellness Check</Text>
          <Text style={styles.instructionsBody}>
            Please read each statement and select the option that indicates how much it applied to you{' '}
            <Text style={styles.instructionsEmphasis}>OVER THE PAST WEEK</Text>.{'\n\n'}
            There are no right or wrong answers. Do not spend too much time on any statement.
          </Text>
          <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startButtonText}>Start Assessment</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Question screen ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />

      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.stepLabel}>Question {currentStep + 1} of {TOTAL}</Text>
      </View>

      <Text style={styles.title}>Mental Wellness Check</Text>

      <Animated.View style={[styles.questionBlock, { opacity }]}>
        <Text style={styles.question}>{currentQuestion.text}</Text>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsContent}
          showsVerticalScrollIndicator={false}
        >
          {DASS_OPTIONS.map(option => {
            const isSelected = answers[currentStep + 1] === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleAnswer(option.value)}
                activeOpacity={0.8}
                style={[styles.option, isSelected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnBack, currentStep === 0 && { opacity: 0 }]}
          onPress={handleBack}
          disabled={currentStep === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.navBtnBackText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnNext, answers[currentStep + 1] === undefined && styles.navBtnDisabled]}
          onPress={handleNext}
          disabled={answers[currentStep + 1] === undefined}
          activeOpacity={0.8}
        >
          <Text style={styles.navBtnNextText}>
            {currentStep === TOTAL - 1 ? 'Finish' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating assistant */}
      <View style={styles.chatbotRow}>
        <TouchableOpacity
          onPress={handleOpenHelper}
          activeOpacity={0.85}
          style={styles.chatbotBtn}
        >
          <View style={styles.chatBubble}>
            <Text style={styles.chatBubbleText}>Need help choosing an answer?</Text>
          </View>
          <Image
            source={{
              uri: 'https://res.cloudinary.com/dov6pvinq/image/upload/v1773962201/c3bnxufurgzmcllpzgql.png',
            }}
            style={styles.chatbot}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {showHelper && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.helperCard}
        >
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>Mindy Question Helper</Text>
            <TouchableOpacity onPress={() => setShowHelper(false)}>
              <Text style={styles.helperCloseX}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.helperScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.helperBody}>{helperContent.meaning}</Text>
            <View style={styles.helperDivider} />
            {OPTION_GUIDE.map(row => (
              <Text key={row} style={styles.optionGuideText}>{row}</Text>
            ))}
            {geminiReply && (
              <View style={styles.geminiReplyBox}>
                <Text style={styles.geminiReplyLabel}>Mindy says:</Text>
                <Text style={styles.geminiReplyText}>{geminiReply}</Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.askRow}>
            <TextInput
              style={styles.askInput}
              placeholder="Type your doubt about this question…"
              placeholderTextColor={COLORS.muted}
              value={doubtInput}
              onChangeText={setDoubtInput}
              returnKeyType="send"
              onSubmitEditing={handleAskGemini}
            />
            <TouchableOpacity
              onPress={handleAskGemini}
              style={[styles.askBtn, askingGemini && { opacity: 0.6 }]}
              activeOpacity={0.85}
              disabled={askingGemini}
            >
              {askingGemini
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.askBtnText}>Ask</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 28 },
  logo: { width: 120, height: 50, alignSelf: 'center', marginTop: 8 },

  progressSection: { marginTop: 32, marginBottom: 8 },
  progressTrack: {
    height: 8,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  stepLabel: { fontSize: 12, color: COLORS.muted },

  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
    marginBottom: 20,
  },

  // Instructions
  instructionsBlock: { flex: 1, justifyContent: 'flex-start' },
  instructionsBody: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 24,
    marginBottom: 40,
  },
  instructionsEmphasis: { fontWeight: '700', color: COLORS.text },
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 15 },

  // Questions
  questionBlock: { flex: 1 },
  question: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 27,
    marginBottom: 24,
  },
  optionsScroll: { flex: 1 },
  optionsContent: { gap: 12, paddingBottom: 24 },
  option: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF4FF',
  },
  optionText: { fontSize: 14, fontWeight: '500', color: COLORS.text, lineHeight: 20 },
  optionTextSelected: { color: COLORS.primary, fontWeight: '700' },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
  },
  navBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  navBtnBack: {
    backgroundColor: '#F3F4F6',
  },
  navBtnBackText: {
    color: COLORS.muted,
    fontWeight: '600',
    fontSize: 15,
  },
  navBtnNext: {
    backgroundColor: COLORS.primary,
  },
  navBtnNextText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  navBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },

  // Floating assistant
  chatbotRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginRight: -12,
    marginBottom: -12,
  },
  chatbotBtn: { flexDirection: 'row', alignItems: 'flex-end' },
  chatBubble: {
    backgroundColor: '#3370B0',
    borderRadius: 14,
    borderBottomRightRadius: 0,
    padding: 10,
    maxWidth: 140,
    marginRight: -6,
    zIndex: 1,
  },
  chatBubbleText: { color: 'white', fontSize: 10, fontWeight: '500', lineHeight: 14 },
  chatbot: { width: 80, height: 80 },

  // Helper card
  helperCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCEBFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '65%',
  },
  helperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  helperCloseX: { fontSize: 16, color: COLORS.muted, paddingHorizontal: 4 },
  helperScroll: { flexGrow: 0, marginBottom: 10 },
  helperBody: { fontSize: 13, color: COLORS.muted, lineHeight: 20, marginBottom: 8 },
  helperDivider: { height: 1, backgroundColor: '#E6EEF8', marginVertical: 10 },
  optionGuideText: { fontSize: 12, color: COLORS.muted, lineHeight: 18 },
  geminiReplyBox: {
    marginTop: 12,
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  geminiReplyLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  geminiReplyText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6EEF8',
    paddingTop: 10,
  },
  askInput: {
    flex: 1,
    backgroundColor: '#F5F8FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  askBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
});
