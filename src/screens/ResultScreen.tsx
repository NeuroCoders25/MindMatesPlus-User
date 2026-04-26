import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Button } from '../components/UI';
import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

const getRisk = (score: number) => {
  if (score < 10)
    return { level: 'low', color: '#22C55E', bg: '#F0FDF4', label: 'Mild / Normal' };
  if (score < 20)
    return { level: 'moderate', color: '#EAB308', bg: '#FEFCE8', label: 'Moderate' };
  return { level: 'severe', color: '#EF4444', bg: '#FEF2F2', label: 'Severe' };
};

export const ResultScreen: React.FC<Props> = ({ navigation }) => {
  const { assessmentScore, user, setUser } = useApp();
  const risk = getRisk(assessmentScore);

  const handleContinue = () => {
    if (user) {
      setUser({ ...user, riskLevel: risk.level as any });
    }
    if (risk.level === 'severe') {
      navigation.replace('Advisor');
    } else {
      navigation.replace('Main');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor: risk.bg }]}>
        <Ionicons name="alert-circle" size={52} color={risk.color} />
      </View>

      <Text style={styles.title}>Your Assessment Result</Text>

      <View style={[styles.badge, { backgroundColor: risk.bg }]}>
        <Text style={[styles.badgeText, { color: risk.color }]}>{risk.label}</Text>
      </View>

      <Text style={styles.description}>
        {risk.level === 'severe'
          ? "We've detected significant distress. We recommend speaking with a professional advisor immediately."
          : "You're doing okay! We've recommended some peer groups and resources to help you stay balanced."}
      </Text>

      <Button
        onPress={handleContinue}
        variant={risk.level === 'severe' ? 'danger' : 'primary'}
        style={styles.btn}
      >
        {risk.level === 'severe' ? 'Connect with Advisor' : 'Join Us'}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
  },
  badgeText: { fontWeight: 'bold', fontSize: 17 },
  description: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 48,
  },
  btn: { width: '100%' },
});
