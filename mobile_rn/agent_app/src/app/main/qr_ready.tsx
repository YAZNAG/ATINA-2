import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#D90404',
  background: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  secondary: '#6B7280',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  blue: '#3B82F6',
};

// -----------------------------------------------------------------------
// MOCK — à remplacer par les vraies données de la commande (via route params
// ou un fetch `GET /orders/:id`)
// -----------------------------------------------------------------------
const MOCK_ORDER = {
  code: 'CMD-4582',
  validUntil: '15h00',
  autoprint: true,
};

export default function OrderReadyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [autoPrint, setAutoPrint] = useState(MOCK_ORDER.autoprint);

  const qrValue = `${MOCK_ORDER.code}-${id ?? ''}`;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#111827" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={26} color={COLORS.green} />
        </View>

        <Text style={styles.title}>Commande prête</Text>

        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>Prête à être récupérée</Text>
        </View>

        {/* Carte QR code */}
        <View style={styles.qrCard}>
          <View style={styles.qrDashedBox}>
            <QRCode value={qrValue} size={150} />
          </View>
          <Text style={styles.orderCode}>#{MOCK_ORDER.code}</Text>
          <View style={styles.validRow}>
            <Ionicons name="time-outline" size={13} color={COLORS.secondary} />
            <Text style={styles.validText}>
              Valide aujourd'hui jusqu'à {MOCK_ORDER.validUntil}
            </Text>
          </View>
        </View>

        {/* Actions ticket */}
        <View style={styles.ticketActionsRow}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() =>
              router.push({
                pathname: '/main/order_ticket',
                params: { id },
              } as any)
            }
          >
            <Ionicons name="eye-outline" size={17} color={COLORS.primary} />
            <Text style={styles.previewButtonText}>Aperçu du ticket</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.printIconButton}
            onPress={() =>
              router.push({
                pathname: '/main/order_ticket',
                params: { id, autoPrint: '1' },
              } as any)
            }
          >
            <Ionicons name="print-outline" size={19} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/main/(tabs)/dashboard.tsx' as any)}
        >
          <Text style={styles.homeButtonText}>Retour à l'accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAutoPrint((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, autoPrint && styles.checkboxChecked]}>
            {autoPrint && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>Impression automatique après préparation</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  content: {
    alignItems: 'center',
    marginTop: 8,
  },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 22,
  },
  statusBadgeText: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: '600',
  },
  qrCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  qrDashedBox: {
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  orderCode: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  validRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validText: {
    fontSize: 12,
    color: COLORS.secondary,
  },
  ticketActionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  printIconButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 12.5,
    color: COLORS.secondary,
  },
});
