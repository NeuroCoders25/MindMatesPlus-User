import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import multiavatar from '@multiavatar/multiavatar';
import { ScrollView } from 'react-native-gesture-handler';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input, Button } from '../components/UI';
import { TermsModal } from '../components/TermsModal';
import { useApp } from '../context/AppContext';
import { auth, db } from '../services/firebaseConfig';
import { COLORS } from '../services/dataService';
import { encryptName } from '../utils/encryption';

const friendlyError = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Please check your connection.';
    default: return 'Something went wrong. Please try again.';
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
  scrollToValue?: number;
}

const OPTION_HEIGHT = 46;

const DropdownPicker: React.FC<DropdownPickerProps> = ({ placeholder, options, value, onChange, scrollToValue }) => {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<any>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (open && scrollRef.current) {
      const targetValue = value ?? scrollToValue;
      if (targetValue != null) {
        const idx = options.findIndex(o => o.value === targetValue);
        if (idx >= 0) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: idx * OPTION_HEIGHT, animated: false });
          }, 50);
        }
      }
    }
  }, [open]);

  return (
    <View style={dpStyles.container}>
      <TouchableOpacity
        style={[dpStyles.trigger, open && dpStyles.triggerOpen]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={[dpStyles.triggerText, !selected && dpStyles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={COLORS.muted} />
      </TouchableOpacity>

      {open && (
        <>
          <TouchableOpacity
            style={dpStyles.overlay}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />
          <View style={dpStyles.dropdown}>
            <ScrollView
              ref={scrollRef}
              style={{ maxHeight: 240 }}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {options.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[dpStyles.option, item.value === value && dpStyles.optionSelected]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[dpStyles.optionText, item.value === value && dpStyles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const dpStyles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  triggerOpen: {
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  triggerText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    marginRight: 4,
  },
  placeholder: { color: COLORS.muted },
  overlay: {
    position: 'absolute',
    top: -500,
    left: -500,
    right: -500,
    bottom: -500,
    zIndex: 998,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 999,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: OPTION_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  optionSelected: { backgroundColor: '#F0F4FF' },
  optionText: { fontSize: 13, color: COLORS.text },
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
  const [avatarSeed, setAvatarSeed] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [hasAttemptedRegistration, setHasAttemptedRegistration] = useState(false);

  const randomSeed = () => Math.random().toString(36).substring(2, 14);

const avatarSvg = useMemo(
    () => (avatarSeed ? multiavatar(avatarSeed) : null),
    [avatarSeed],
  );

  useEffect(() => {
    if (!isLogin) setAvatarSeed(randomSeed());
  }, [isLogin]);

  const shuffleAvatar = () => setAvatarSeed(randomSeed());

  const allFieldsFilled = useMemo(() => {
    return !!(
      name.trim() &&
      nickname.trim() &&
      gender &&
      dobYear &&
      dobMonth &&
      dobDay &&
      email.trim() &&
      password &&
      confirmPassword
    );
  }, [name, nickname, gender, dobYear, dobMonth, dobDay, email, password, confirmPassword]);

  const yearOptions = useMemo<DropdownOption[]>(() => {
    const endYear = new Date().getFullYear() - 10;
    return Array.from({ length: endYear - 1960 + 1 }, (_, i) => {
      const y = 1960 + i;
      return { label: String(y), value: y };
    });
  }, []);

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
      setHasAttemptedRegistration(true);
      if (!allFieldsFilled) {
        setError('Please fill all the fields to complete registration');
        return;
      }
      if (!agreedToTerms) {
        setError('Please accept the Terms & Conditions.');
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
      if (calculatedAge < 18) {
        setError('Sorry, you cannot register on our system.');
        return;
      }
      if (calculatedAge > 100) {
        setError('Please enter a valid date of birth.');
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
          const seed = avatarSeed || randomSeed();
          await setDoc(doc(db, 'users', uid), {
            name: encryptedName,
            nickname: nickname.trim(),
            email,
            gender,
            age: calculatedAge,
            dob: dobString,
            avatarSeed: seed,
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
                {/* Nickname + avatar shuffle — full-width input, avatar floats on right edge */}
                <View style={styles.nicknameRow}>
                  <Input
                    placeholder="Nickname * — Shown to public"
                    value={nickname}
                    onChangeText={setNickname}
                    style={{ paddingRight: 72 }}
                  />
                  <TouchableOpacity style={styles.photoPickerBtn} onPress={shuffleAvatar} activeOpacity={0.8}>
                    {avatarSvg ? (
                      <View style={styles.photoPreview}>
                        <SvgXml xml={avatarSvg} width={50} height={50} />
                      </View>
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="person-outline" size={22} color={COLORS.muted} />
                      </View>
                    )}
                    <View style={styles.photoPlusBadge}>
                      <Ionicons name="shuffle-outline" size={11} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </View>

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
                <View style={[styles.fieldGroup, { zIndex: 1000 }]}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <View style={styles.dobRow}>
                    <View style={styles.dobYear}>
                      <DropdownPicker
                        placeholder="Year"
                        options={yearOptions}
                        value={dobYear}
                        onChange={v => { setDobYear(v); setDobDay(null); }}
                        scrollToValue={2000}
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
                style={styles.checkboxRow}
                onPress={() => {
                  if (agreedToTerms) {
                    setAgreedToTerms(false);
                  } else {
                    setShowTerms(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree that my data is collected solely for mental health wellness and is handled securely.
                </Text>
              </TouchableOpacity>
            )}
            {error !== '' ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (!isLogin && hasAttemptedRegistration) ? (
              (!allFieldsFilled || !agreedToTerms) && (
                <Text style={styles.errorText}>
                  {!allFieldsFilled
                    ? 'Please fill all the fields to complete registration'
                    : 'Please accept the Terms & Conditions.'}
                </Text>
              )
            ) : null}
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
              setAvatarSeed('');
              setAgreedToTerms(false);
              setShowTerms(false);
              setHasAttemptedRegistration(false);
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
    <TermsModal
      visible={showTerms}
      onAccept={() => {
        setAgreedToTerms(true);
        setShowTerms(false);
        setError('');
      }}
      onDecline={() => {
        setAgreedToTerms(false);
        setShowTerms(false);
      }}
      onClose={() => {
        setShowTerms(false);
      }}
    />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1 },
  poster: { width: '100%', height: 260 },
  logoWrap: {
    paddingTop: 20,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    marginTop: 4,
    gap: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: { color: COLORS.muted, fontSize: 12, flex: 1, lineHeight: 16 },
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

  dobRow: { flexDirection: 'row', gap: 8, zIndex: 1000 },
  dobYear: { flex: 2.2, zIndex: 3000 },
  dobMonth: { flex: 3, zIndex: 2000 },
  dobDay: { flex: 1.5, zIndex: 1000 },

  // Nickname + avatar picker
  nicknameRow: {
    position: 'relative',
    width: '100%',
  },
  photoPickerBtn: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
  },
  photoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(219,234,254,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  photoPlusBadge: {
    position: 'absolute',
    bottom: 6,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
