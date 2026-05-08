import React, { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input, Button } from '../components/UI';
import { useApp } from '../context/AppContext';
import { auth, db } from '../services/firebaseConfig';
import { COLORS } from '../services/dataService';
import { encryptName } from '../utils/encryption';

const friendlyError = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':   return 'An account with this email already exists.';
    case 'auth/invalid-email':          return 'Please enter a valid email address.';
    case 'auth/weak-password':          return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':         return 'No account found with this email.';
    case 'auth/wrong-password':         return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':     return 'Incorrect email or password.';
    case 'auth/too-many-requests':      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Please check your connection.';
    default:                            return 'Something went wrong. Please try again.';
  }
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

function getDaysInMonth(year: number | null, month: number | null): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

type DropdownOption = { label: string; value: number };

interface DropdownPickerProps {
  placeholder: string;
  options: DropdownOption[];
  value: number | null;
  onChange: (val: number) => void;
}

const DropdownPicker: React.FC<DropdownPickerProps> = ({ placeholder, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      <TouchableOpacity style={dpStyles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[dpStyles.triggerText, !selected && dpStyles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dpStyles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dpStyles.sheet}>
            <Text style={dpStyles.sheetTitle}>{placeholder}</Text>
            <FlatList
              data={options}
              keyExtractor={item => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[dpStyles.option, item.value === value && dpStyles.optionSelected]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text style={[dpStyles.optionText, item.value === value && dpStyles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const dpStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },
  triggerText: { fontSize: 15, color: COLORS.text },
  placeholder: { color: COLORS.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 360,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  optionSelected: { backgroundColor: '#F0F4FF' },
  optionText: { fontSize: 15, color: COLORS.text },
  optionTextSelected: { color: COLORS.primary, fontWeight: '600' },
});

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const { login, register } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('');
  const [dobYear, setDobYear] = useState<number | null>(null);
  const [dobMonth, setDobMonth] = useState<number | null>(null);
  const [dobDay, setDobDay] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo<DropdownOption[]>(() =>
    Array.from({ length: 91 }, (_, i) => {
      const y = currentYear - 10 - i;
      return { label: String(y), value: y };
    }), [currentYear]);

  const monthOptions = useMemo<DropdownOption[]>(() =>
    MONTHS.map((m, i) => ({ label: m, value: i + 1 })), []);

  const dayOptions = useMemo<DropdownOption[]>(() => {
    const count = getDaysInMonth(dobYear, dobMonth);
    return Array.from({ length: count }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
  }, [dobYear, dobMonth]);

  const handleAuth = async () => {
    setError('');
    let calculatedAge = 0;

    if (!isLogin) {
      if (!acceptedPrivacy) {
        setError('Please read and accept the privacy policy.');
        return;
      }
      if (!nickname.trim()) {
        setError('Please enter a nickname.');
        return;
      }
      if (nickname.trim().toLowerCase() === name.trim().toLowerCase()) {
        setError('Nickname must be different from your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!dobYear || !dobMonth || !dobDay) {
        setError('Please select your full date of birth.');
        return;
      }
      const birthDate = new Date(dobYear, dobMonth - 1, dobDay);
      const today = new Date();
      calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge < 10 || calculatedAge > 100) {
        setError('You must be between 10 and 100 years old.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        const uid = auth.currentUser?.uid;
        if (uid) {
          const profileSnap = await getDoc(doc(db, 'users', uid, 'mentalHealthProfile', 'currentProfile'));
          navigation.replace(profileSnap.exists() ? 'Main' : 'Questionnaire');
        } else {
          navigation.replace('Main');
        }
      } else {
        await register(email, password, name);
        const uid = auth.currentUser?.uid;
        if (uid) {
          const encryptedName = encryptName(name);
          const dobString = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;
          await setDoc(doc(db, 'users', uid), {
            name: encryptedName,
            nickname: nickname.trim(),
            email,
            gender,
            age: calculatedAge,
            dob: dobString,
            createdAt: serverTimestamp(),
          });
        }
        navigation.replace('Questionnaire');
      }
    } catch (e: any) {
      console.error('Auth error:', e?.code, e?.message);
      setError(friendlyError(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isLogin ? (
          <Image
            source={require('../assets/group_image3.png')}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isLogin ? 'Welcome Back' : 'Join MindMates+'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Sign in to continue your journey'
                : 'Start your mental wellness journey today'}
            </Text>
          </View>

          <View style={styles.form}>
            {!isLogin && (
              <>
                <Input
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                />
                <Input
                  placeholder="Nickname *"
                  value={nickname}
                  onChangeText={setNickname}
                />

                {/* Gender */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Gender</Text>
                  <View style={styles.radioGroup}>
                    {GENDER_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={styles.radioChip}
                        onPress={() => setGender(opt)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.radioOuter, gender === opt && styles.radioOuterSelected]}>
                          {gender === opt && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.radioLabel, gender === opt && styles.radioLabelSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Date of Birth */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <View style={styles.dobRow}>
                    <View style={styles.dobYear}>
                      <DropdownPicker
                        placeholder="Year"
                        options={yearOptions}
                        value={dobYear}
                        onChange={v => { setDobYear(v); setDobDay(null); }}
                      />
                    </View>
                    <View style={styles.dobMonth}>
                      <DropdownPicker
                        placeholder="Month"
                        options={monthOptions}
                        value={dobMonth}
                        onChange={v => { setDobMonth(v); setDobDay(null); }}
                      />
                    </View>
                    <View style={styles.dobDay}>
                      <DropdownPicker
                        placeholder="Day"
                        options={dayOptions}
                        value={dobDay}
                        onChange={v => setDobDay(v)}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            <Input
              placeholder="Email Address"
              type="email"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChangeText={setPassword}
            />
            {!isLogin && (
              <Input
                placeholder="Confirm Password"
                type="password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            )}
            {!isLogin && (
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={acceptedPrivacy ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={acceptedPrivacy ? COLORS.primary : COLORS.muted}
                />
                <Text style={styles.disclaimerText}>
                  I agree that my data is collected solely for mental health wellness and is handled securely.
                </Text>
              </TouchableOpacity>
            )}
            {error !== '' && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            <Button onPress={handleAuth} disabled={loading} style={styles.authBtn}>
              {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>

            {isLogin && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => {
              setIsLogin(!isLogin);
              setError('');
              setConfirmPassword('');
              setDobYear(null);
              setDobMonth(null);
              setDobDay(null);
              setNickname('');
              setGender('');
              setAcceptedPrivacy(false);
            }}
          >
            <Text style={styles.toggleText}>
              {isLogin
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1 },
  poster: { width: '100%', height: 260 },
  logoWrap: {
    paddingTop: 56,
    alignItems: 'center',
    paddingBottom: 4,
    backgroundColor: COLORS.background,
  },
  logo: { width: 160, height: 64 },
  inner: { padding: 32, paddingTop: 28, paddingBottom: 40 },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  form: { gap: 16 },
  authBtn: { marginTop: 8 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: -4 },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    marginTop: 4,
    gap: 8,
  },
  disclaimerText: { color: COLORS.muted, fontSize: 12, flex: 1, lineHeight: 16 },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: COLORS.muted, fontWeight: '500', fontSize: 13 },
  toggleBtn: { marginTop: 40, alignItems: 'center' },
  toggleText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted, paddingHorizontal: 4 },

  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  radioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  radioLabel: { fontSize: 14, color: COLORS.text },
  radioLabelSelected: { color: COLORS.primary, fontWeight: '600' },

  dobRow: { flexDirection: 'row', gap: 8 },
  dobYear: { flex: 2.2 },
  dobMonth: { flex: 3 },
  dobDay: { flex: 1.5 },
});
