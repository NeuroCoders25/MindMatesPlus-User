import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Input, Button } from '../components/UI';
import { COLORS } from '../services/dataService';
import { RootStackParamList } from '../navigation';

export const FeedbackScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [peerFeedback, setPeerFeedback] = useState('');
  const [appFeedback, setAppFeedback] = useState('');

  const handleSubmit = () => {
    Alert.alert('Thank you!', 'Your feedback has been submitted.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Feedback</Text>
      </View>

      <Text style={styles.subtitle}>Share your experience on MindMates+</Text>

      <View style={styles.formCard}>
        <View style={styles.field}>
          <Text style={styles.label}>Share your peer group experience</Text>
          <Input
            placeholder="Share any ups & downs of your groups"
            value={peerFeedback}
            onChangeText={setPeerFeedback}
            type="textarea"
            style={styles.textarea}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Share your app experience</Text>
          <Input
            placeholder="Share any ups & downs about our app?"
            value={appFeedback}
            onChangeText={setAppFeedback}
            type="textarea"
            style={styles.textarea}
          />
        </View>
      </View>

      <View style={styles.submitRow}>
        <Button onPress={handleSubmit} style={styles.submitBtn}>
          Submit
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 15, fontWeight: '500', color: COLORS.muted },
  formCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 28,
    padding: 24,
    gap: 20,
  },
  field: { gap: 10 },
  label: { fontSize: 13, fontWeight: '700', color: '#4A4A4A' },
  textarea: {
    backgroundColor: 'white',
    minHeight: 140,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  submitRow: { alignItems: 'center', paddingTop: 8 },
  submitBtn: {
    width: 180,
    backgroundColor: '#001B54',
    borderRadius: 28,
  },
});
