import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../services/dataService';
import { Resource } from '../types';

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
});
