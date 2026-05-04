import React, { useState } from 'react';
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
    case 'auth/email-already-in-use':  return 'An account with this email already exists.';
    case 'auth/invalid-email':         return 'Please enter a valid email address.';
    case 'auth/weak-password':         return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':        return 'No account found with this email.';
    case 'auth/wrong-password':        return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':    return 'Incorrect email or password.';
    case 'auth/too-many-requests':     return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Please check your connection.';
    default:                           return 'Something went wrong. Please try again.';
  }
};

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
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const handleAuth = async () => {
    setError('');
    let calculatedAge = 0;

    if (!isLogin) {
      if (!acceptedPrivacy) {
        setError('Please read and accept the privacy policy.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(dob)) {
        setError('Please enter your Date of Birth in YYYY-MM-DD format.');
        return;
      }
      const birthDate = new Date(dob);
      if (isNaN(birthDate.getTime())) {
        setError('Please enter a valid Date of Birth.');
        return;
      }
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
          await setDoc(doc(db, 'users', uid), {
            name: encryptedName,
            nickname: nickname.trim(),
            email,
            gender,
            age: calculatedAge,
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
        {/* ── Login: hero poster ── Register: centred logo ── */}
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
                  placeholder="Nickname (Optional)"
                  value={nickname}
                  onChangeText={setNickname}
                />
                <Input
                  placeholder="Gender (e.g. Male, Female, Non-binary)"
                  value={gender}
                  onChangeText={setGender}
                />
                <Input
                  placeholder="Date of Birth (YYYY-MM-DD)"
                  value={dob}
                  onChangeText={setDob}
                />
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
              setDob('');
              setNickname('');
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

  // Login hero poster
  poster: {
    width: '100%',
    height: 260,
  },

  // Register logo
  logoWrap: {
    paddingTop: 56,
    alignItems: 'center',
    paddingBottom: 4,
    backgroundColor: COLORS.background,
  },
  logo: {
    width: 160,
    height: 64,
  },

  // Shared content area
  inner: { padding: 32, paddingTop: 28, paddingBottom: 40 },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  form: { gap: 16 },
  authBtn: { marginTop: 8 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: -4 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, marginTop: 4, gap: 8 },
  disclaimerText: { color: COLORS.muted, fontSize: 12, flex: 1, lineHeight: 16 },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: COLORS.muted, fontWeight: '500', fontSize: 13 },
  toggleBtn: { marginTop: 40, alignItems: 'center' },
  toggleText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
});
