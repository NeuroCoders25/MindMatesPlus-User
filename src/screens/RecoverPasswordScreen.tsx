import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation';
import { Input, Button } from '../components/UI';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'RecoverPassword'>;

export const RecoverPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const isValid =
    code.trim().length >= 4 &&
    password.length >= 6 &&
    password === confirm;

  const handleReset = () => {
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 1200);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.successOuter} edges={['top']}>
        <View style={styles.successIcon}>
          <Ionicons name="shield-checkmark" size={52} color={COLORS.success} />
        </View>
        <Text style={styles.successTitle}>Password Reset!</Text>
        <Text style={styles.successBody}>
          Your password has been updated. You can now sign in with your new
          password.
        </Text>
        <Button
          onPress={() => navigation.navigate('Auth')}
          style={styles.signInBtn}
        >
          Back to Sign In
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.outer} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={48} color={COLORS.accent} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code from your email, then choose a new password.
          </Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Reset Code</Text>
            <Input
              placeholder="e.g. 123456"
              value={code}
              onChangeText={setCode}
            />
          </View>

          <View>
            <Text style={styles.label}>New Password</Text>
            <Input
              placeholder="At least 6 characters"
              type="password"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View>
            <Text style={styles.label}>Confirm New Password</Text>
            <Input
              placeholder="Repeat your new password"
              type="password"
              value={confirm}
              onChangeText={setConfirm}
            />
          </View>

          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            onPress={handleReset}
            disabled={loading || !isValid}
            style={styles.submitBtn}
          >
            {loading ? 'Resetting…' : 'Reset Password'}
          </Button>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.resendText}>Didn't receive a code? Resend</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, padding: 32, paddingTop: 20 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 32,
  },
  backText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  iconWrap: {
    width: 88,
    height: 88,
    backgroundColor: 'rgba(93,95,239,0.10)',
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 22 },
  form: { gap: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: COLORS.danger, fontSize: 13, fontWeight: '500', flex: 1 },
  submitBtn: { marginTop: 4 },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  // success state (full-screen)
  successOuter: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successIcon: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 14,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  signInBtn: { width: '100%' },
});
