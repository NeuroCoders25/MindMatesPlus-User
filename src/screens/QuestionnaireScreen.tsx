import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { DASS_QUESTIONS, COLORS } from '../services/dataService';
import { useApp } from '../context/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;

const OPTIONS = [
  { label: 'Never', score: 0 },
  { label: 'Sometimes', score: 1 },
  { label: 'Often', score: 2 },
  { label: 'Almost Always', score: 3 },
];

export const QuestionnaireScreen: React.FC<Props> = ({ navigation }) => {
  const { setAssessmentScore } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const opacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(
    new Animated.Value((1 / DASS_QUESTIONS.length) * 100)
  ).current;

  const handleAnswer = (score: number) => {
    const newScores = [...scores, score];
    setScores(newScores);

    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (currentStep < DASS_QUESTIONS.length - 1) {
        const next = currentStep + 1;
        setCurrentStep(next);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(progressAnim, {
            toValue: ((next + 1) / DASS_QUESTIONS.length) * 100,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
      } else {
        const total = newScores.reduce((a, b) => a + b, 0);
        setAssessmentScore(total);
        navigation.replace('Result');
      }
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.stepLabel}>
          Question {currentStep + 1} of {DASS_QUESTIONS.length}
        </Text>
      </View>

      <Text style={styles.title}>Mental Wellness Check</Text>

      <Animated.View style={[styles.questionBlock, { opacity }]}>
        <Text style={styles.question}>{DASS_QUESTIONS[currentStep]}</Text>
        <View style={styles.options}>
          {OPTIONS.map(option => (
            <TouchableOpacity
              key={option.score}
              onPress={() => handleAnswer(option.score)}
              activeOpacity={0.8}
              style={styles.option}
            >
              <Text style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {currentStep === 0 && (
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
    marginBottom: 28,
  },
  questionBlock: { flex: 1 },
  question: {
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.text,
    lineHeight: 28,
    marginBottom: 36,
  },
  options: { gap: 12 },
  option: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: { fontSize: 15, fontWeight: '500', color: COLORS.text },
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
