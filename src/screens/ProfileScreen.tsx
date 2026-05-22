import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { COLORS } from '../services/dataService';
import { callKnnAndWriteResult } from '../services/dataService';
import { RootStackParamList } from '../navigation';

export const ProfileScreen = () => {
  const { user, setUser } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── [DEV] Manual KNN test — remove before production release ──────────────
  const handleDevTestKnn = async () => {
    if (!user) { Alert.alert('KNN Test', 'No user logged in'); return; }
    Alert.alert('[DEV] KNN Test', `Triggering KNN for user: ${user.id}\nCheck Metro/Logcat for [KNN] logs.`);
    try {
      await callKnnAndWriteResult(user.id);
      Alert.alert('[DEV] KNN Test', '✅ callKnnAndWriteResult completed.\nCheck Firestore → users/{uid}/mentalHealthProfile/currentProfile for knn* fields.');
    } catch (e) {
      Alert.alert('[DEV] KNN Test', `❌ Error: ${e}`);
    }
  };

  const handleLogout = () => {
    setUser(null);
    // getParent() navigates via the root stack, not the tab navigator
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.replace('Auth');
  };

  const settings = [
    {
      icon: 'bell' as const,
      label: 'Notifications',
      color: '#3B82F6',
      onPress: () => {},
    },
    {
      icon: 'heart' as const,
      label: 'Wellness Goals',
      color: '#EC4899',
      onPress: () => navigation.navigate('WellnessGoals'),
    },
    {
      icon: 'message-square' as const,
      label: 'Feedback',
      color: '#7C3AED',
      onPress: () => navigation.navigate('Feedback'),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color="white" />
        </View>
        <Text style={styles.userName}>{user?.name} {user?.nickname ? `(${user.nickname})` : ''}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.riskBadge}>
          <Text style={styles.riskText}>
            Risk Level: {user?.riskLevel || 'Not Assessed'}
          </Text>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsLabel}>SETTINGS</Text>
        {settings.map((item, i) => (
          <Card key={i} style={styles.settingRow} onPress={item.onPress}>
            <View style={styles.settingIconBox}>
              <Feather name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={styles.settingLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Card>
        ))}

        {/* ── [DEV] Remove before production release ── */}
        {__DEV__ && (
          <TouchableOpacity onPress={handleDevTestKnn} style={styles.devTestRow}>
            <View style={styles.devTestIcon}>
              <Feather name="cpu" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.devTestText}>[DEV] Test KNN Recommendation</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleLogout} style={styles.logoutRow}>
          <View style={styles.logoutIcon}>
            <Feather name="log-out" size={18} color="#EF4444" />
          </View>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 28 },
  avatarSection: { alignItems: 'center', paddingTop: 20, gap: 8 },
  avatar: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.accent,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  userEmail: { fontSize: 13, color: COLORS.muted },
  riskBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsSection: { gap: 10 },
  settingsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 24,
    marginTop: 4,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  // [DEV] test button styles
  devTestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 24,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    backgroundColor: '#F5F3FF',
  },
  devTestIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devTestText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#7C3AED' },
});
