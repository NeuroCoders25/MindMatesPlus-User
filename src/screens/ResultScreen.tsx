import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Button } from '../components/UI';
import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';
import { Dass21SubscaleResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function groupIcon(group: number): IoniconsName {
  if (group <= 2) return 'alert-circle';
  if (group === 3) return 'information-circle';
  return 'checkmark-circle';
}

const SubscaleCard: React.FC<{ label: string; result: Dass21SubscaleResult }> = ({ label, result }) => (
  <View style={styles.scoreCard}>
    <Text style={styles.scoreCardLabel}>{label}</Text>
    <Text style={styles.scoreCardNumber}>{result.final}</Text>
    <Text style={[styles.scoreCardSeverity, { color: result.severityColor }]}>
      {result.severity}
    </Text>
  </View>
);

export const ResultScreen: React.FC<Props> = ({ navigation }) => {
  const { dass21Result, user, setUser } = useApp();

  if (!dass21Result) {
    return (
      <SafeAreaView style={[styles.scroll, { justifyContent: 'center' }]} edges={['top']}>
        <Text style={{ color: COLORS.muted, textAlign: 'center' }}>No result available.</Text>
      </SafeAreaView>
    );
  }

  const { depression, anxiety, stress, group, groupCategory, groupColor, message, ctaLabel, ctaVariant, reassessInDays, riskLevel } = dass21Result;

  const handleContinue = () => {
    if (user) {
      setUser({ ...user, riskLevel: riskLevel as any });
    }
    if (riskLevel === 'severe') {
      navigation.replace('ConsultAdvisor');
    } else {
      navigation.replace('Main');
    }
  };

  const iconColor = group <= 2 ? '#E53935' : group === 3 ? '#FB8C00' : '#43A047';
  const iconBg   = group <= 2 ? '#FEF2F2' : group === 3 ? '#FFF3E0' : '#F1F8E9';

  return (
    <SafeAreaView style={styles.scroll} edges={['top']}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Icon */}
      <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
        <Ionicons name={groupIcon(group)} size={52} color={iconColor} />
      </View>

      <Text style={styles.title}>Your Assessment Result</Text>

      {/* Three subscale score cards */}
      <View style={styles.scoreRow}>
        <SubscaleCard label="Depression" result={depression} />
        <SubscaleCard label="Anxiety"    result={anxiety} />
        <SubscaleCard label="Stress"     result={stress} />
      </View>

      {/* Overall group badge */}
      <View style={[styles.groupBadge, { backgroundColor: groupColor }]}>
        <Text style={styles.groupBadgeText}>{groupCategory}</Text>
      </View>

      {/* Description */}
      <Text style={styles.description}>{message}</Text>

      {/* Reassessment note */}
      <Text style={styles.reassessNote}>
        We'll check in again in {reassessInDays} days
      </Text>

      {/* CTA */}
      <Button onPress={handleContinue} variant={ctaVariant} style={styles.btn}>
        {ctaLabel}
      </Button>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  container: {
    padding: 28,
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 48,
  },

  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 28,
    textAlign: 'center',
  },

  // Score cards row
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 24,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  scoreCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  scoreCardNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  scoreCardSeverity: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Group badge
  groupBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  groupBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.8,
  },

  description: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 16,
  },

  reassessNote: {
    fontSize: 12,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginBottom: 36,
  },

  btn: { width: '100%' },
});
