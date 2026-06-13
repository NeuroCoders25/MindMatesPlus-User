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
import { sendPasswordResetEmail } from 'firebase/auth';
import { RootStackParamList } from '../navigation';
import { Input, Button } from '../components/UI';
import { auth } from '../services/firebaseConfig';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (e: any) {
      switch (e?.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your connection.');
          break;
        default:
          setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.backText}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="lock-open-outline" size={48} color={COLORS.accent} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter the email address linked to your account and we'll send you a
            password reset link.
          </Text>
        </View>

        {!sent ? (
          <View style={styles.form}>
            <Input
              placeholder="Email Address"
              type="email"
              value={email}
              onChangeText={setEmail}
            />
            {error !== '' && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <Button
              onPress={handleSend}
              disabled={loading || !email.trim()}
              style={styles.submitBtn}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </View>
        ) : (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
            </View>
            <Text style={styles.successTitle}>Check Your Inbox</Text>
            <Text style={styles.successBody}>
              A password reset link has been sent to{' '}
              <Text style={styles.emailHighlight}>{email}</Text>. Use the code in
              that email on the next screen.
            </Text>
            <Button
              onPress={() => navigation.navigate('RecoverPassword')}
              style={styles.nextBtn}
            >
              Enter Reset Code
            </Button>
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={() => {
                setSent(false);
                setEmail('');
                setError('');
              }}
            >
              <Text style={styles.resendText}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        )}
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
  form: { gap: 16 },
  submitBtn: { marginTop: 4 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center' },
  successCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  successIcon: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  successBody: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: { color: COLORS.accent, fontWeight: '600' },
  nextBtn: { width: '100%', marginTop: 8 },
  resendBtn: { marginTop: 4, paddingVertical: 8 },
  resendText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
});
