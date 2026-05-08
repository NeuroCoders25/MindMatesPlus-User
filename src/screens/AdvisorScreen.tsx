import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Button } from '../components/UI';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'Advisor'>;

export const AdvisorScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="call" size={40} color="#EF4444" />
      </View>

      <Text style={styles.title}>Psychology Advisor Support</Text>

      <Text style={styles.description}>
        Your well-being is our priority. We recommend speaking with a professional
        advisor who can provide specialized support and guidance for your current
        situation.
      </Text>

      <View style={styles.buttons}>
        <Button
          onPress={() => navigation.navigate('ConsultAdvisor')}
          variant="danger"
          style={styles.btn}
        >
          Connect with Advisor
        </Button>

        <TouchableOpacity
          onPress={() => navigation.replace('Main')}
          style={styles.skipRow}
        >
          <Text style={styles.skipText}>Continue to App</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.muted} />
        </TouchableOpacity>
      </View>
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
    width: 80,
    height: 80,
    backgroundColor: '#FEF2F2',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 48,
  },
  buttons: { width: '100%', gap: 12 },
  btn: { width: '100%' },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  skipText: { color: COLORS.muted, fontWeight: '600', fontSize: 14 },
});
