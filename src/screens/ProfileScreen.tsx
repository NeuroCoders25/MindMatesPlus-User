import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Image, Modal, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { Card } from '../components/UI';
import { COLORS, listenToUserSavedResources } from '../services/dataService';
import { RootStackParamList } from '../navigation';
import { Resource } from '../types';
import { ResourcePostCard } from '../components/ResourcePostCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 48 - 4) / 2;

// ── Saved grid item ───────────────────────────────────────────────────────────

const SavedGridItem: React.FC<{ resource: Resource; onPress: () => void }> = ({ resource, onPress }) => {
  const hasImage = !!resource.imageUrl?.trim();
  const posterName = resource.postedBy?.trim() || 'MindMates+';
  const initials = posterName !== 'MindMates+'
    ? posterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'M+';

  return (
    <TouchableOpacity style={styles.gridItem} activeOpacity={0.85} onPress={onPress}>
      {hasImage ? (
        <Image source={{ uri: resource.imageUrl! }} style={styles.gridImage} resizeMode="cover" />
      ) : (
        <View style={styles.gridTextCard}>
          <Text style={styles.gridTextContent} numberOfLines={4}>
            {resource.textContent ?? resource.content ?? resource.title}
          </Text>
        </View>
      )}
      <View style={styles.gridFooter}>
        {resource.posterImageUrl
          ? <Image source={{ uri: resource.posterImageUrl }} style={styles.gridAvatar} />
          : <View style={styles.gridAvatarCircle}><Text style={styles.gridAvatarText}>{initials}</Text></View>}
        <Text style={styles.gridTitle} numberOfLines={1}>{resource.title}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────

export const ProfileScreen = () => {
  const { user, setUser } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [savedResources, setSavedResources] = useState<Resource[]>([]);
  const [savedTab, setSavedTab] = useState(false);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenToUserSavedResources(user.id, setSavedResources);
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.replace('Auth');
  };

  const settings = [
    { icon: 'bell' as const,           label: 'Notifications',  color: '#3B82F6', onPress: () => {} },
    { icon: 'heart' as const,          label: 'Wellness Goals', color: '#EC4899', onPress: () => navigation.navigate('WellnessGoals') },
    { icon: 'bookmark' as const,       label: `Saved${savedResources.length > 0 ? ` (${savedResources.length})` : ''}`, color: '#F59E0B', onPress: () => setSavedTab(true) },
    { icon: 'message-square' as const, label: 'Feedback',       color: '#7C3AED', onPress: () => navigation.navigate('Feedback') },
  ];

  // Build 2-column grid rows
  const gridRows: Array<[Resource, Resource | null]> = [];
  for (let i = 0; i < savedResources.length; i += 2) {
    gridRows.push([savedResources[i], savedResources[i + 1] ?? null]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color="white" />
        </View>
        <Text style={styles.userName}>{user?.name}{user?.nickname ? ` (${user.nickname})` : ''}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.riskBadge}>
          <Text style={styles.riskText}>Risk Level: {user?.riskLevel || 'Not Assessed'}</Text>
        </View>
      </View>

      {/* Settings */}
      {!savedTab && (
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
          <TouchableOpacity onPress={handleLogout} style={styles.logoutRow}>
            <View style={styles.logoutIcon}><Feather name="log-out" size={18} color="#EF4444" /></View>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Saved collection */}
      {savedTab && (
        <View style={styles.savedSection}>
          <TouchableOpacity onPress={() => setSavedTab(false)} style={styles.savedBackRow}>
            <Ionicons name="arrow-back" size={20} color={COLORS.accent} />
            <Text style={styles.savedBackText}>Back to Settings</Text>
          </TouchableOpacity>
          {savedResources.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={44} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No saved posts yet</Text>
              <Text style={styles.emptySubtitle}>Tap the bookmark icon on any resource to save it here.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.collectionLabel}>YOUR COLLECTION</Text>
              {gridRows.map((row, idx) => (
                <View key={idx} style={styles.gridRow}>
                  <SavedGridItem resource={row[0]} onPress={() => setPreviewResource(row[0])} />
                  {row[1]
                    ? <SavedGridItem resource={row[1]} onPress={() => setPreviewResource(row[1]!)} />
                    : <View style={{ width: GRID_ITEM_SIZE }} />}
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Full-card preview modal */}
      <Modal visible={!!previewResource} animationType="slide" onRequestClose={() => setPreviewResource(null)}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.previewModal}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setPreviewResource(null)} style={styles.previewBack}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>Saved Post</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={styles.previewContent}>
            {previewResource && <ResourcePostCard resource={previewResource} />}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 100, gap: 24 },

  avatarSection: { alignItems: 'center', paddingTop: 20, gap: 8 },
  avatar: {
    width: 96, height: 96, backgroundColor: COLORS.accent, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  userName: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginTop: 8 },
  userEmail: { fontSize: 13, color: COLORS.muted },
  riskBadge: { backgroundColor: '#EFF6FF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6 },
  riskText: { fontSize: 11, fontWeight: '700', color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5 },


  settingsSection: { gap: 10 },
  settingsLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1, paddingHorizontal: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  settingIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, marginTop: 4 },
  logoutIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  savedSection: { gap: 12 },
  savedBackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  savedBackText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
  collectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1, paddingHorizontal: 2 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridItem: {
    width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, borderRadius: 16, overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  gridImage: { width: '100%', height: '100%' },
  gridTextCard: { flex: 1, backgroundColor: '#EEF4FF', padding: 12, justifyContent: 'center', borderLeftWidth: 3, borderLeftColor: COLORS.accent },
  gridTextContent: { fontSize: 12, color: COLORS.text, lineHeight: 18 },
  gridFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', padding: 8 },
  gridAvatar: { width: 22, height: 22, borderRadius: 11 },
  gridAvatarCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  gridAvatarText: { color: '#fff', fontWeight: '800', fontSize: 8 },
  gridTitle: { flex: 1, fontSize: 11, color: '#fff', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  previewModal: { flex: 1, backgroundColor: COLORS.background },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  previewBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  previewHeaderTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  previewContent: { padding: 16, paddingBottom: 48 },
});
