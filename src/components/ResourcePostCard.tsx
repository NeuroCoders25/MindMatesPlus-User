import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, ScrollView, StatusBar,
  Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../services/dataService';
import {
  toggleResourceLike, listenToResourceInteractions,
  toggleResourceSave, listenToResourceSaveState,
  ResourceInteractions,
} from '../services/dataService';
import { Resource } from '../types';
import { useApp } from '../context/AppContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ResourcePostCardProps {
  resource: Resource;
}

const formatDate = (date: Date): string => {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ResourcePostCard: React.FC<ResourcePostCardProps> = ({ resource }) => {
  const { user } = useApp();
  const userId = user?.id ?? '';

  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [interactions, setInteractions] = useState<ResourceInteractions>({ likeCount: 0, isLiked: false });
  const [isSaved, setIsSaved] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const posterName = resource.postedBy?.trim() || 'MindMates+';
  const initials = resource.authorInitials?.trim()
    ? resource.authorInitials
    : posterName !== 'MindMates+'
      ? posterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
      : 'M+';

  const imageUri = resource.imageUrl;
  const isImageType = resource.contentType === 'image';
  const hasImageUri = !!imageUri?.trim();
  const showImage = (isImageType || hasImageUri) && !imageError;

  const shareLink = hasImageUri
    ? imageUri!
    : `${resource.title}\n${resource.description || resource.textContent || ''}`.trim();

  useEffect(() => {
    if (!userId) return;
    return listenToResourceInteractions(resource.id, userId, setInteractions);
  }, [resource.id, userId]);

  useEffect(() => {
    if (!userId) return;
    return listenToResourceSaveState(userId, resource.id, setIsSaved);
  }, [resource.id, userId]);

  const handleLike = async () => {
    if (!userId || likePending) return;
    setLikePending(true);
    setInteractions(prev => ({
      isLiked: !prev.isLiked,
      likeCount: prev.isLiked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
    }));
    try {
      await toggleResourceLike(resource.id, userId);
    } catch {
      setInteractions(prev => ({
        isLiked: !prev.isLiked,
        likeCount: prev.isLiked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
      }));
    } finally {
      setLikePending(false);
    }
  };

  const handleSave = async () => {
    if (!userId || savePending) return;
    setSavePending(true);
    setIsSaved(prev => !prev);
    try {
      await toggleResourceSave(userId, resource);
    } catch {
      setIsSaved(prev => !prev);
    } finally {
      setSavePending(false);
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareLink);
    setCopied(true);
    setTimeout(() => { setCopied(false); setShareOpen(false); }, 1500);
  };

  const AvatarEl = resource.posterImageUrl
    ? <Image source={{ uri: resource.posterImageUrl }} style={styles.avatarImage} />
    : <View style={styles.avatarCircle}><Text style={styles.avatarText}>{initials}</Text></View>;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        {AvatarEl}
        <View style={styles.headerMeta}>
          <Text style={styles.posterName}>{posterName}</Text>
          <Text style={styles.categoryTag}>{resource.category}</Text>
        </View>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {showImage ? (
        <TouchableOpacity activeOpacity={0.95} onPress={() => setFullscreenOpen(true)}>
          <View style={styles.imageWrapper}>
            {(imageLoading || !hasImageUri) && (
              <View style={styles.imagePlaceholder}>
                {isImageType && !hasImageUri
                  ? <Ionicons name="image-outline" size={40} color={COLORS.muted} />
                  : <ActivityIndicator size="small" color={COLORS.accent} />}
              </View>
            )}
            {hasImageUri && (
              <Image
                source={{ uri: imageUri! }}
                style={[styles.postImage, imageLoading && { opacity: 0 }]}
                resizeMode="cover"
                onLoad={() => setImageLoading(false)}
                onError={() => { setImageLoading(false); setImageError(true); }}
              />
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.textContentCard}>
          <Text style={styles.textContentTitle}>{resource.title}</Text>
          <Text style={styles.textContent}>{resource.textContent ?? resource.content ?? ''}</Text>
        </View>
      )}

      {/* Caption */}
      <View style={styles.captionArea}>
        {showImage && <Text style={styles.postTitle}>{resource.title}</Text>}
        {!!resource.description && (
          <Text style={styles.postDescription} numberOfLines={3}>{resource.description}</Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name={interactions.isLiked ? 'heart' : 'heart-outline'} size={24} color={interactions.isLiked ? '#EF4444' : COLORS.text} />
            {interactions.likeCount > 0 && <Text style={styles.actionCount}>{interactions.likeCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShareOpen(true)} style={styles.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="share-social-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={isSaved ? COLORS.accent : COLORS.text} />
        </TouchableOpacity>
      </View>

      <Text style={styles.timestamp}>{formatDate(resource.createdAt)}</Text>
      <Text style={styles.disclaimer}>AI suggestion only — not professional advice</Text>

      {/* ── Share / Copy Link popup ── */}
      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShareOpen(false)}>
          <TouchableOpacity style={styles.sharePopup} activeOpacity={1}>
            <View style={styles.shareHandle} />
            <Text style={styles.shareTitle}>Share Resource</Text>
            <View style={styles.sharePreviewRow}>
              {resource.posterImageUrl
                ? <Image source={{ uri: resource.posterImageUrl }} style={styles.shareAvatar} />
                : <View style={styles.shareAvatarCircle}><Text style={styles.shareAvatarText}>{initials}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.sharePostTitle} numberOfLines={1}>{resource.title}</Text>
                <Text style={styles.sharePostAuthor} numberOfLines={1}>{posterName}</Text>
              </View>
            </View>
            <View style={styles.linkBox}>
              <Ionicons name="link-outline" size={16} color={COLORS.muted} />
              <Text style={styles.linkText} numberOfLines={2} selectable>{shareLink}</Text>
            </View>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnDone]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" />
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShareOpen(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Fullscreen image modal ── */}
      <Modal visible={fullscreenOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setFullscreenOpen(false)}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.modalContainer}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setFullscreenOpen(false)} style={styles.modalBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modalPosterRow}>
              {resource.posterImageUrl
                ? <Image source={{ uri: resource.posterImageUrl }} style={styles.modalAvatarImage} />
                : <View style={styles.modalAvatar}><Text style={styles.modalAvatarText}>{initials}</Text></View>}
              <View>
                <Text style={styles.modalPosterName}>{posterName}</Text>
                <Text style={styles.modalCategoryTag}>{resource.category}</Text>
              </View>
            </View>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {hasImageUri && <Image source={{ uri: imageUri! }} style={styles.modalImage} resizeMode="contain" />}
          <ScrollView style={styles.modalSheet} contentContainerStyle={styles.modalSheetContent}>
            <View style={styles.modalActions}>
              <View style={styles.actionsLeft}>
                <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
                  <Ionicons name={interactions.isLiked ? 'heart' : 'heart-outline'} size={26} color={interactions.isLiked ? '#EF4444' : COLORS.text} />
                  {interactions.likeCount > 0 && <Text style={styles.actionCount}>{interactions.likeCount}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setFullscreenOpen(false); setTimeout(() => setShareOpen(true), 300); }} style={styles.actionBtn}>
                  <Ionicons name="share-social-outline" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleSave}>
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? COLORS.accent : COLORS.text} />
              </TouchableOpacity>
            </View>
            {!!resource.title && <Text style={styles.modalTitle}>{resource.title}</Text>}
            {!!resource.description && <Text style={styles.modalDescription}>{resource.description}</Text>}
            {!!(resource.textContent || resource.content) && (
              <Text style={styles.modalBodyText}>{resource.textContent ?? resource.content}</Text>
            )}
            <Text style={styles.modalTimestamp}>{formatDate(resource.createdAt)}</Text>
            <Text style={styles.modalDisclaimer}>AI suggestion only — not professional advice</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  avatarImage: { width: 38, height: 38, borderRadius: 19 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  headerMeta: { flex: 1 },
  posterName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  categoryTag: { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 1 },
  imageWrapper: { width: '100%', height: 220 },
  imagePlaceholder: { position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  postImage: { width: '100%', height: 220 },
  textContentCard: { marginHorizontal: 14, backgroundColor: COLORS.background, borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: COLORS.accent, marginBottom: 2 },
  textContentTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  textContent: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  captionArea: { paddingHorizontal: 14, paddingTop: 12, gap: 4 },
  postTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  postDescription: { fontSize: 13, color: COLORS.muted, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  timestamp: { paddingHorizontal: 14, paddingBottom: 4, fontSize: 11, color: COLORS.muted },
  disclaimer: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 10, color: COLORS.muted, fontStyle: 'italic' },

  // Share popup
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sharePopup: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, gap: 16,
  },
  shareHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  shareTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sharePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareAvatar: { width: 44, height: 44, borderRadius: 22 },
  shareAvatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  shareAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sharePostTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sharePostAuthor: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  linkText: { flex: 1, fontSize: 12, color: COLORS.muted, lineHeight: 18 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14 },
  copyBtnDone: { backgroundColor: '#22C55E' },
  copyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { fontSize: 14, color: COLORS.muted, fontWeight: '600' },

  // Fullscreen modal
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12 },
  modalBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalPosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginHorizontal: 12 },
  modalAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  modalAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  modalPosterName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  modalCategoryTag: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  modalImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  modalSheet: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -16 },
  modalSheetContent: { padding: 16, paddingBottom: 48, gap: 10 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modalDescription: { fontSize: 14, color: COLORS.muted, lineHeight: 21 },
  modalBodyText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  modalTimestamp: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  modalDisclaimer: { fontSize: 10, color: COLORS.muted, fontStyle: 'italic' },
});
