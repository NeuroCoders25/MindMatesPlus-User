import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { DASS_QUESTIONS, DASS_OPTIONS, computeDass21Result, COLORS } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { db } from '../services/firebaseConfig';
import { Dass21Result } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;

const TOTAL = DASS_QUESTIONS.length; // 21

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

  // One document per attempt — auto-generated response_id
  await addDoc(collection(db, 'questionnaireResponses'), {
    userId,
    date:       serverTimestamp(),
    ...scores,
    riskLevel:  result.riskLevel,   // user type
    groupLabel: result.groupLabel,
    answers,
  });

  // One document per user — overwritten on each reassessment
  await setDoc(doc(db, 'mentalHealthProfiles', userId), {
    userId,
    ...scores,
    classificationLevel: result.riskLevel,
    groupLabel:          result.groupLabel,
    updatedAt:           serverTimestamp(),
  });
};

export const QuestionnaireScreen: React.FC<Props> = ({ navigation }) => {
  const { setDass21Result, user } = useApp();
  const [showInstructions, setShowInstructions] = useState(true);
  const [currentStep, setCurrentStep] = useState(0); // 0-indexed; 0 = Q1
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const opacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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
    const newAnswers = { ...answers, [questionNum]: value };
    setAnswers(newAnswers);

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
        const result = computeDass21Result(newAnswers);
        setDass21Result(result);
        if (user?.id) {
          saveToFirestore(user.id, newAnswers, result).catch(console.error);
        }
        navigation.replace('Result');
      }
    });
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
        <Text style={styles.question}>{DASS_QUESTIONS[currentStep].text}</Text>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsContent}
          showsVerticalScrollIndicator={false}
        >
          {DASS_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              onPress={() => handleAnswer(option.value)}
              activeOpacity={0.8}
              style={styles.option}
            >
              <Text style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Floating assistant — shown on every question screen */}
      <View style={styles.chatbotRow}>
        <View style={styles.chatBubble}>
          <Text style={styles.chatBubbleText}>
            Are you struggling to select the right answer? I'm here to help you.
          </Text>
        </View>
        <Image
          source={{
            uri: 'https://res.cloudinary.com/dov6pvinq/image/upload/v1773962201/c3bnxufurgzmcllpzgql.png',
          }}
          style={styles.chatbot}
          resizeMode="contain"
        />
      </View>
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
  optionsContent: { gap: 12, paddingBottom: 120 },
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
  optionText: { fontSize: 14, fontWeight: '500', color: COLORS.text, lineHeight: 20 },

  // Floating assistant
  chatbotRow: {
    position: 'absolute',
    bottom: 28,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
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
});
