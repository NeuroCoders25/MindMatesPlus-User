import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { submitAdvisorRating } from '../services/dataService';

interface Props {
  visible: boolean;
  advisorName: string;
  advisorId: string;
  connectionId: string;
  userId: string;
  userNickname: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export const AdvisorRatingModal: React.FC<Props> = ({
  visible,
  advisorName,
  advisorId,
  connectionId,
  userId,
  userNickname,
  onClose,
  onSubmitted,
}) => {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (stars === 0) { setError('Please select a rating'); return; }
    setSubmitting(true);
    const result = await submitAdvisorRating({
      userId,
      userNickname,
      advisorId,
      connectionId,
      rating: stars,
      comment: comment.trim(),
    });
    setSubmitting(false);
    if (result.success) {
      onSubmitted();
      onClose();
    } else if (result.alreadyRated) {
      setError('You have already rated this advisor.');
      setTimeout(onClose, 1500);
    } else {
      setError('Could not submit rating. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          <Text style={styles.title}>Rate your advisor</Text>
          <Text style={styles.subtitle}>
            How was your experience with {advisorName}?
          </Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => { setStars(n); setError(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.star, n <= stars ? styles.starFilled : styles.starEmpty]}>
                  {n <= stars ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingLabel}>
            {stars === 0 ? 'Tap to rate' : RATING_LABELS[stars]}
          </Text>

          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment (optional)"
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={300}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.skipText}>Maybe later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, stars === 0 && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={stars === 0 || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitText}>Submit rating</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  star: { fontSize: 40 },
  starFilled: { color: '#F59E0B' },
  starEmpty: { color: '#D1D5DB' },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
    height: 20,
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#1F2937',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  skipButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  skipText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#6C63FF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: '#C7C5F0',
  },
  submitText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
