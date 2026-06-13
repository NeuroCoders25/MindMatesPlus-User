import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { processPayment } from '../services/paymentService';
import { useApp } from '../context/AppContext';
import { COLORS } from '../services/dataService';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

type PaymentMethod = 'card' | 'payhere' | 'ezcash';

const METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'card',    label: 'Credit / Debit Card', icon: '💳' },
  { id: 'payhere', label: 'PayHere',              icon: '🏦' },
  { id: 'ezcash',  label: 'eZ Cash',             icon: '📱' },
];

export const PaymentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { connectionId, advisorId, advisorName, quote } = route.params;
  const { user } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const fmtUSD = (amount: number | undefined | null, fallback = 10): string => {
    const n = Number(amount);
    if (amount == null || isNaN(n)) return `$${fallback.toFixed(2)}`;
    return `$${n.toFixed(2)}`;
  };

  const handlePay = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      await processPayment(connectionId, user.id, advisorId);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSucceeded(true);
    } catch (err: any) {
      Alert.alert(
        'Payment Failed',
        'Could not process your payment. Please try again.',
        [{ text: 'Retry' }],
      );
    } finally {
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={56} color="white" />
          </View>
          <Text style={styles.successTitle}>Payment Successful</Text>
          <Text style={styles.successSub}>Your session with {advisorName} has been booked.</Text>

          <View style={styles.receiptCard}>
            <Text style={styles.receiptTitle}>Receipt</Text>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Advisor</Text>
              <Text style={styles.receiptValue}>{advisorName}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Base fee</Text>
              <Text style={styles.receiptValue}>{fmtUSD(quote.baseFee)}</Text>
            </View>
            {(quote.discountPercent ?? 0) > 0 && (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>
                  {quote.badgeTierName ? `${quote.badgeTierName} discount` : 'Badge discount'}
                </Text>
                <Text style={[styles.receiptValue, styles.discountText]}>
                  -{quote.discountPercent}%
                </Text>
              </View>
            )}
            <View style={[styles.receiptRow, styles.receiptTotal]}>
              <Text style={styles.receiptTotalLabel}>Total paid</Text>
              <Text style={styles.receiptTotalValue}>{fmtUSD(quote.totalFee)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              navigation.replace('AdvisorChat', {
                advisor: {
                  id: advisorId,
                  name: advisorName,
                  specialty: '',
                  availability: '',
                },
              });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
            <Text style={styles.primaryBtnText}>Go to Chat</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Advisor identity */}
        <View style={styles.advisorRow}>
          <View style={styles.advisorAvatar}>
            <Ionicons name="person" size={28} color="white" />
          </View>
          <View>
            <Text style={styles.advisorName}>{advisorName}</Text>
            <Text style={styles.advisorSub}>Expert Listener Session</Text>
          </View>
        </View>

        {/* DEMO MODE pill */}
        <View style={styles.demoPill}>
          <Ionicons name="flask-outline" size={14} color="#92400E" />
          <Text style={styles.demoText}>DEMO MODE — No real payment will be processed</Text>
        </View>

        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Base fee</Text>
            <Text style={styles.summaryValue}>{fmtUSD(quote.baseFee)}</Text>
          </View>
          {(quote.discountPercent ?? 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {quote.badgeTierName
                  ? `Badge discount (${quote.badgeTierName})`
                  : 'Badge discount'}
              </Text>
              <Text style={[styles.summaryValue, styles.discountText]}>
                -{quote.discountPercent}%
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{fmtUSD(quote.totalFee)}</Text>
          </View>
        </View>

        {/* Payment method selector */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.methodList}>
          {METHODS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.methodRow, selectedMethod === m.id && styles.methodRowSelected]}
              onPress={() => setSelectedMethod(m.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.methodIcon}>{m.icon}</Text>
              <Text style={[styles.methodLabel, selectedMethod === m.id && styles.methodLabelSelected]}>
                {m.label}
              </Text>
              <View style={[styles.radio, selectedMethod === m.id && styles.radioSelected]}>
                {selectedMethod === m.id && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.disclaimer}>
          <Ionicons name="lock-closed-outline" size={12} color={COLORS.muted} />
          <Text style={styles.disclaimerText}>
            This is a simulated checkout. No card details are collected.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, processing && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="shield-checkmark-outline" size={18} color="white" />
              <Text style={styles.payBtnText}>Pay {fmtUSD(quote.totalFee)}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  scroll: { padding: 20, paddingBottom: 40, gap: 20 },

  advisorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  advisorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisorName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  advisorSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignSelf: 'center',
  },
  demoText: { fontSize: 12, fontWeight: '700', color: '#92400E', letterSpacing: 0.3 },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: COLORS.muted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  discountText: { color: '#16A34A' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  methodList: { gap: 10 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  methodRowSelected: {
    borderColor: '#1E3A8A',
    backgroundColor: '#EEF2FF',
  },
  methodIcon: { fontSize: 22 },
  methodLabel: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  methodLabelSelected: { color: '#1E3A8A', fontWeight: '700' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#1E3A8A' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3A8A',
  },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  disclaimerText: { fontSize: 11, color: COLORS.muted, textAlign: 'center' },

  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  payBtn: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },

  // ── Success state ──────────────────────────────────────────────────────────
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 18,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  successSub: { fontSize: 14, color: COLORS.muted, textAlign: 'center' },

  receiptCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  receiptTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptLabel: { fontSize: 13, color: COLORS.muted },
  receiptValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  receiptTotal: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
    marginTop: 4,
  },
  receiptTotalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  receiptTotalValue: { fontSize: 16, fontWeight: '800', color: '#22C55E' },

  primaryBtn: {
    width: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
