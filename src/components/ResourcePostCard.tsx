import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../services/dataService';
import { Resource } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ResourcePostCardProps {
  resource: Resource;
}

const formatPostDate = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
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
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const posterName = resource.postedBy && resource.postedBy.trim() !== '' ? resource.postedBy : 'MindMates+';
  const initials = resource.authorInitials && resource.authorInitials.trim() !== '' 
    ? resource.authorInitials 
    : (posterName !== 'MindMates+'
        ? posterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : 'M+');

  const imageUri = resource.imageUrl;
  // Show image if it's an image type OR if we have a valid URI and it's NOT explicitly a text type with no content
  const isImageType = resource.contentType === 'image';
  const hasImageUri = !!imageUri && imageUri.trim() !== '';
  const showImage = (isImageType || hasImageUri) && !imageError;

  return (
    <View style={styles.card}>
      {/* Post header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
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
        <TouchableOpacity activeOpacity={0.95} onPress={() => setModalOpen(true)}>
          <View style={styles.imageWrapper}>
            {(imageLoading || !hasImageUri) && (
              <View style={styles.imagePlaceholder}>
                {isImageType && !hasImageUri ? (
                  <Ionicons name="image-outline" size={40} color={COLORS.muted} />
                ) : (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                )}
              </View>
            )}
            {hasImageUri && (
              <Image
                source={{ uri: imageUri }}
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
          <Text style={styles.textContent}>
            {resource.textContent ?? resource.content ?? ''}
          </Text>
        </View>
      )}

      {/* Title and caption */}
      <View style={styles.captionArea}>
        {showImage && <Text style={styles.postTitle}>{resource.title}</Text>}
        {resource.description ? (
          <Text style={styles.postDescription} numberOfLines={3}>
            {resource.description}
          </Text>
        ) : null}
      </View>

      {/* Action bar */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            onPress={() => setLiked(v => !v)}
            style={styles.actionBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? '#EF4444' : COLORS.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chatbubble-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="share-social-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setBookmarked(v => !v)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={bookmarked ? COLORS.accent : COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Timestamp */}
      <Text style={styles.timestamp}>{formatPostDate(resource.createdAt)}</Text>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>AI suggestion only — not professional advice</Text>

      {/* Instagram-style post modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setModalOpen(false)}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.modalContainer}>
          {/* Top bar */}
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.modalBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modalPosterRow}>
              <View style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>{initials}</Text>
              </View>
              <View>
                <Text style={styles.modalPosterName}>{posterName}</Text>
                <Text style={styles.modalCategoryTag}>{resource.category}</Text>
              </View>
            </View>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Full image */}
          {hasImageUri && (
            <Image
              source={{ uri: imageUri! }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}

          {/* Bottom sheet */}
          <ScrollView style={styles.modalSheet} contentContainerStyle={styles.modalSheetContent}>
            {/* Actions */}
            <View style={styles.modalActions}>
              <View style={styles.actionsLeft}>
                <TouchableOpacity onPress={() => setLiked(v => !v)} style={styles.actionBtn}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={26}
                    color={liked ? '#EF4444' : COLORS.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="share-social-outline" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setBookmarked(v => !v)}>
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={bookmarked ? COLORS.accent : COLORS.text}
                />
              </TouchableOpacity>
            </View>

            {/* Caption */}
            {resource.title ? (
              <Text style={styles.modalTitle}>{resource.title}</Text>
            ) : null}
            {resource.description ? (
              <Text style={styles.modalDescription}>{resource.description}</Text>
            ) : null}
            {resource.textContent || resource.content ? (
              <Text style={styles.modalBodyText}>
                {resource.textContent ?? resource.content}
              </Text>
            ) : null}

            <Text style={styles.modalTimestamp}>{formatPostDate(resource.createdAt)}</Text>
            <Text style={styles.modalDisclaimer}>AI suggestion only — not professional advice</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  headerMeta: { flex: 1 },
  posterName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryTag: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  imageWrapper: {
    width: '100%',
    height: 220,
  },
  imagePlaceholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  postImage: {
    width: '100%',
    height: 220,
  },
  textContentCard: {
    marginHorizontal: 14,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    marginBottom: 2,
  },
  textContentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  textContent: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  captionArea: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 4,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  postDescription: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {},
  timestamp: {
    paddingHorizontal: 14,
    paddingBottom: 4,
    fontSize: 11,
    color: COLORS.muted,
  },
  disclaimer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    fontSize: 10,
    color: COLORS.muted,
    fontStyle: 'italic',
  },

  // ─── Modal ────────────────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  modalBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginHorizontal: 12,
  },
  modalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  modalPosterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  modalCategoryTag: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  modalSheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
  },
  modalSheetContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 10,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 21,
  },
  modalBodyText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  modalTimestamp: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
  modalDisclaimer: {
    fontSize: 10,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
});
