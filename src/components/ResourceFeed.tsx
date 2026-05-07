import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  listenToUserRecommendationCategory,
  fetchResourcesByCategory,
} from '../services/dataService';
import { GroupCategory } from '../types';
import { Resource } from '../types';
import { ResourcePostCard } from './ResourcePostCard';

interface ResourceFeedProps {
  userId: string;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  hideTabs?: boolean;
}

export type TabType = 'image' | 'text';

export const ResourceFeed: React.FC<ResourceFeedProps> = ({ 
  userId, 
  activeTab: externalTab, 
  onTabChange,
  hideTabs = false
}) => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<GroupCategory | null>(null);
  const [baselineCategory, setBaselineCategory] = useState<GroupCategory | null>(null);
  const [internalTab, setInternalTab] = useState<TabType>('image');
  
  const activeTab = externalTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;

  const fetchingRef = useRef<string | null>(null);

  // Listen to category changes in real time
  useEffect(() => {
    const unsub = listenToUserRecommendationCategory(userId, ({ active, baseline }) => {
      setActiveCategory(active);
      setBaselineCategory(baseline);
    });
    return unsub;
  }, [userId]);

  // Refetch resources whenever active category changes
  useEffect(() => {
    if (!activeCategory) {
      setResources([]);
      setLoading(false);
      return;
    }

    const fetchKey = `${activeCategory}|${baselineCategory ?? ''}`;
    if (fetchingRef.current === fetchKey) return;
    fetchingRef.current = fetchKey;
    setLoading(true);

    fetchResourcesByCategory(activeCategory, baselineCategory ?? undefined)
      .then(data => {
        if (fetchingRef.current === fetchKey) setResources(data);
      })
      .catch(() => {
        if (fetchingRef.current === fetchKey) setResources([]);
      })
      .finally(() => {
        if (fetchingRef.current === fetchKey) setLoading(false);
      });
  }, [activeCategory, baselineCategory]);

  const filteredResources = resources.filter(r => {
    if (activeTab === 'image') return r.contentType === 'image' || !!r.imageUrl;
    return r.contentType === 'text' && !r.imageUrl;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading resources…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Switcher - only shown if not hidden */}
      {!hideTabs && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'image' && styles.activeTab]}
            onPress={() => setActiveTab('image')}
          >
            <Ionicons 
              name={activeTab === 'image' ? 'image' : 'image-outline'} 
              size={16} 
              color={activeTab === 'image' ? COLORS.white : COLORS.muted} 
            />
            <Text style={[styles.tabText, activeTab === 'image' && styles.activeTabText]}>Images</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'text' && styles.activeTab]}
            onPress={() => setActiveTab('text')}
          >
            <Ionicons 
              name={activeTab === 'text' ? 'document-text' : 'document-text-outline'} 
              size={16} 
              color={activeTab === 'text' ? COLORS.white : COLORS.muted} 
            />
            <Text style={[styles.tabText, activeTab === 'text' && styles.activeTabText]}>Text</Text>
          </TouchableOpacity>
        </View>
      )}

      {filteredResources.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="newspaper-outline" size={32} color={COLORS.muted} />
          <Text style={styles.emptyText}>No {activeTab} resources yet</Text>
          <Text style={styles.emptySubText}>
            {activeCategory
              ? `Resources for "${activeCategory}" will appear here.`
              : 'Complete your wellbeing check to see personalised resources.'}
          </Text>
        </View>
      ) : (
        <View style={styles.feed}>
          {filteredResources.map(resource => (
            <ResourcePostCard key={resource.id} resource={resource} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(219, 234, 254, 0.3)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  activeTabText: {
    color: COLORS.white,
  },
  feed: { gap: 0 },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: COLORS.muted },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
