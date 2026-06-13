import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ChatScreen } from './ChatScreen';
import { ExpertListView } from '../components/ExpertListView';
import { useGuide } from '../context/GuideContext';
import { COLORS } from '../services/dataService';

type Tab = 'mindy' | 'expert';

export const ListenerScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('mindy');
  const { registerTarget } = useGuide();
  const listenerContentRef = useRef<View>(null);
  const measureListenerContent = () => {
    listenerContentRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) registerTarget('listener_content', { x, y, width: w, height: h });
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View
        ref={listenerContentRef}
        onLayout={measureListenerContent}
        collapsable={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Listener</Text>
          <Text style={styles.headerSubtitle}>Someone to talk to, whenever you need</Text>
        </View>

      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'mindy' && styles.segmentActive]}
          onPress={() => setActiveTab('mindy')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="robot-outline"
            size={18}
            color={activeTab === 'mindy' ? '#FFFFFF' : '#6B7280'}
          />
          <Text style={[styles.segmentText, activeTab === 'mindy' && styles.segmentTextActive]}>
            Mindy AI
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segment, activeTab === 'expert' && styles.segmentActive]}
          onPress={() => setActiveTab('expert')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person"
            size={16}
            color={activeTab === 'expert' ? '#FFFFFF' : '#6B7280'}
          />
          <Text style={[styles.segmentText, activeTab === 'expert' && styles.segmentTextActive]}>
            Expert
          </Text>
        </TouchableOpacity>
      </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'mindy' ? <ChatScreen embedded /> : <ExpertListView />}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});
