import React, { useEffect, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface TermsModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

interface TermsSection {
  title: string;
  body?: string[];
  bullets?: string[];
  footer?: string[];
}

const TERMS: TermsSection[] = [
  {
    title: '1. Purpose of the App',
    body: [
      'MindMates+ is designed to support mental well-being through features such as self-assessments, mood tracking, peer-support activities, advisor communication, educational content, and safety-related alerts.',
      'MindMates+ is not a replacement for professional medical advice, diagnosis, treatment, counselling, or emergency services.',
    ],
  },
  {
    title: '2. Emergency Disclaimer',
    body: [
      'MindMates+ is not an emergency-response service and may not be monitored continuously.',
      'If you or another person is in immediate danger, is at risk of self-harm, or requires urgent support, contact emergency services, visit the nearest hospital, or contact a trusted person immediately.',
      'Do not rely only on this app.',
    ],
  },
  {
    title: '3. Eligibility',
    body: [
      'You must be at least 18 years old to use MindMates+.',
      'By signing up, you confirm that the information you provide is accurate and that you will use the app responsibly.',
    ],
  },
  {
    title: '4. Account Security',
    body: [
      'You are responsible for keeping your login details confidential.',
      'Do not share your password, verification code, or account with another person. Notify us immediately if you suspect unauthorised access to your account.',
    ],
  },
  {
    title: '5. Personal Data and Privacy',
    body: [
      "MindMates+ may collect and process information required to provide the app's features, including:",
    ],
    bullets: [
      'account details;',
      'mood entries and self-assessment responses;',
      'mental-health-related information you choose to provide;',
      'advisor and peer-support messages;',
      'critical-alert records;',
      'notification preferences; and',
      'security and audit records.',
    ],
    footer: [
      'Some of this information may be sensitive.',
      'Please read the MindMates+ Privacy Policy to understand how your information is collected, used, stored, shared, and deleted.',
      'Where required, your consent for sensitive-data processing and critical alerts will be requested separately.',
    ],
  },
  {
    title: '6. Self-Assessments and Automated Results',
    body: [
      'Any questionnaire result, score, recommendation, or risk flag shown in the app is intended only to support awareness and well-being.',
      'These results are not a medical diagnosis and may not always be accurate. Seek professional advice for medical or mental-health concerns.',
    ],
  },
  {
    title: '7. Critical Alerts',
    body: [
      'MindMates+ may create a safety-related alert when a serious risk is detected or reported.',
      'Where necessary, limited information may be shared with authorised advisors, authorised administrators, or your selected emergency contact to respond to a safety concern.',
      'MindMates+ cannot guarantee immediate alert delivery or response.',
    ],
  },
  {
    title: '8. Advisor Support',
    body: [
      'Advisor support is subject to availability.',
      'Unless clearly stated otherwise, an advisor should not be assumed to be a doctor, psychologist, psychiatrist, counsellor, or emergency responder.',
      'Use advisor support respectfully and do not rely on it for emergencies.',
    ],
  },
  {
    title: '9. Peer-Support Rules',
    body: ['When using peer-support features, you must:'],
    bullets: [
      'communicate respectfully;',
      'avoid bullying, harassment, threats, or hate speech;',
      'avoid encouraging self-harm, violence, or dangerous behaviour;',
      "avoid sharing another person's private information;",
      'avoid false medical claims; and',
      'avoid posting spam or harmful content.',
    ],
    footer: [
      'Do not share information in public or peer-support spaces that you do not want other users to view.',
    ],
  },
  {
    title: '10. Acceptable Use',
    body: ['You must not:'],
    bullets: [
      'misuse critical-alert or reporting features;',
      "attempt to access another user's account;",
      'bypass app security;',
      'post illegal, harmful, or misleading content;',
      "collect another user's personal information without permission; or",
      'use the app to harm, threaten, or deceive another person.',
    ],
    footer: [
      'We may remove content, restrict features, or suspend accounts where necessary to protect users or prevent misuse.',
    ],
  },
  {
    title: '11. App Availability',
    body: [
      'We aim to provide a reliable service, but we cannot guarantee that the app will always be available, error-free, or suitable for every device.',
      'Do not use MindMates+ as your only method of obtaining urgent support.',
    ],
  },
  {
    title: '12. Account Deletion',
    body: [
      'You may request to delete your account using the account settings or by contacting support.',
      'Some records may be retained where required for security, safety, legal, or audit purposes, as explained in the Privacy Policy.',
    ],
  },
  {
    title: '13. Changes to These Terms',
    body: [
      'We may update these Terms when the app, legal requirements, or safety practices change.',
      'Where significant changes are made, we may ask you to review and accept the updated Terms again.',
    ],
  },
  {
    title: '14. Governing Law',
    body: ['These Terms are governed by the laws of Sri Lanka.'],
  },
  {
    title: '15. Contact Us',
    body: [
      'For questions, complaints, privacy requests, or account-deletion requests, contact your MindMates+ support team.',
    ],
  },
  {
    title: 'By selecting "Accept", you confirm that:',
    bullets: [
      'you have read and agreed to these Terms;',
      'you understand that MindMates+ is not an emergency-response service;',
      'you understand that MindMates+ is not a replacement for professional mental-health or medical care; and',
      'you have had an opportunity to read the MindMates+ Privacy Policy.',
    ],
  },
];

export const TermsModal: React.FC<TermsModalProps> = ({
  visible,
  onAccept,
  onDecline,
  onClose,
}) => {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    if (visible) {
      setScrolledToBottom(false);
    }
  }, [visible]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 24;
    const reachedBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (reachedBottom) {
      setScrolledToBottom(true);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close terms and conditions"
        />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Terms & Conditions</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close terms and conditions"
            >
              <Text style={styles.closeX}>x</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator
          >
            <Text style={styles.lastUpdated}>Last Updated: 1st June 2026</Text>
            <Text style={styles.documentTitle}>MINDMATES+ TERMS AND CONDITIONS</Text>
            <Text style={styles.intro}>
              By creating a MindMates+ account, you confirm that you have read, understood,
              and agreed to these Terms and Conditions.
            </Text>

            {TERMS.map((section) => (
              <View key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.body?.map((paragraph) => (
                  <Text key={paragraph} style={styles.body}>
                    {paragraph}
                  </Text>
                ))}
                {section.bullets?.map((bullet) => (
                  <Text key={bullet} style={styles.bullet}>
                    {'\u2022  '}
                    {bullet}
                  </Text>
                ))}
                {section.footer?.map((paragraph) => (
                  <Text key={paragraph} style={styles.body}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>

          {!scrolledToBottom && (
            <Text style={styles.scrollHint}>{'\u2193 Scroll down to read all terms'}</Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={onDecline}
              accessibilityRole="button"
            >
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, !scrolledToBottom && styles.acceptBtnDisabled]}
              onPress={onAccept}
              disabled={!scrolledToBottom}
              accessibilityRole="button"
              accessibilityState={{ disabled: !scrolledToBottom }}
            >
              <Text style={styles.acceptText}>
                {scrolledToBottom ? 'Accept' : 'Read to accept'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeX: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  scroll: {
    flexGrow: 0,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  intro: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 14,
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginLeft: 8,
    marginBottom: 2,
  },
  scrollHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6C63FF',
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  declineText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    backgroundColor: '#C7CEDF',
  },
  acceptText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
