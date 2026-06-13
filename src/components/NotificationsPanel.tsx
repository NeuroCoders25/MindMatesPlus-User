import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, AppNotification } from '../services/dataService';

interface Props {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onTap: (notification: AppNotification) => void;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICONS: Record<AppNotification['type'], IoniconsName> = {
  peer_message: 'chatbubble-ellipses-outline',
  advisor_message: 'headset-outline',
  advisor_request: 'checkmark-circle-outline',
  listener_accepted: 'person-add-outline',
  call_scheduled: 'calendar-outline',
  badge_awarded: 'medal-outline',
};

function relativeTime(ts: any): string {
  if (!ts) return '';
  const date: Date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const NotificationsPanel: React.FC<Props> = ({
  notifications,
  onClose,
  onMarkAllRead,
  onTap,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.backdrop} onStartShouldSetResponder={() => true}>
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={onMarkAllRead} activeOpacity={0.7} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Notification list */}
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={44} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                Badge awards, messages, and updates will appear here
              </Text>
            </View>
          ) : (
            notifications.map(n => (
              <TouchableOpacity
                key={n.id}
                style={[styles.item, !n.read && styles.itemUnread]}
                onPress={() => onTap(n)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, !n.read && styles.iconWrapUnread]}>
                  <Ionicons
                    name={TYPE_ICONS[n.type]}
                    size={18}
                    color={n.read ? COLORS.muted : COLORS.accent}
                  />
                </View>
                <View style={styles.itemBody}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.itemTitle, !n.read && styles.itemTitleBold]}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    {!n.read && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.itemPreview} numberOfLines={2}>
                    {n.body}
                  </Text>
                  <Text style={styles.itemTime}>{relativeTime(n.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 8 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingRight: 12,
  },
  panel: {
    width: 320,
    maxHeight: 480,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.border,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  itemUnread: {
    backgroundColor: '#F0F4FF',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapUnread: {
    backgroundColor: '#EEF2FF',
  },
  itemBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontSize: 13,
    color: COLORS.muted,
    flex: 1,
  },
  itemTitleBold: {
    color: COLORS.text,
    fontWeight: '700',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    flexShrink: 0,
  },
  itemPreview: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  itemTime: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
    opacity: 0.7,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
