import React, { useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input, Button } from '../components/UI';
import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const { setUser } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleAuth = () => {
    setUser({
      id: '1',
      name: name || 'James',
      email: email || 'james@example.com',
      joinedGroups: [],
    });
    navigation.replace('Questionnaire');
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
              <Input
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
              />
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
            <Button onPress={handleAuth} style={styles.authBtn}>
              {isLogin ? 'Sign In' : 'Create Account'}
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
            onPress={() => setIsLogin(!isLogin)}
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
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: COLORS.muted, fontWeight: '500', fontSize: 13 },
  toggleBtn: { marginTop: 40, alignItems: 'center' },
  toggleText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
});
