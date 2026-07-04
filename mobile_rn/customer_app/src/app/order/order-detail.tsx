import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import { ProfileService, Order, OrderTimeline } from '../../services/profile.service';
import type { OrderDriver } from '../../services/profile.service';

const RED = '#E10600';

const DELIVERY_STEPS = [
  { codes: ['pending', 'confirmed'],            label: 'Commande placée', sub: 'Votre commande a été reçue' },
  { codes: ['picking'],                         label: 'En préparation',  sub: 'Nous préparons vos articles' },
  { codes: ['ready'],                           label: 'Prête',           sub: 'Votre commande est prête' },
  { codes: ['in_delivery', 'out_for_delivery'], label: 'En livraison',    sub: 'Votre commande est en route' },
  { codes: ['delivered', 'completed'],          label: 'Livrée',          sub: 'Commande livrée' },
];

const PICKUP_STEPS = [
  { codes: ['pending', 'confirmed'],                               label: 'Commande placée',   sub: 'Votre commande a été reçue' },
  { codes: ['picking'],                                            label: 'En préparation',    sub: 'Nous préparons vos articles' },
  { codes: ['ready'],                                              label: 'Prête',             sub: 'Votre commande est prête à retirer' },
  { codes: ['in_delivery', 'out_for_delivery', 'delivered', 'completed'], label: 'Disponible', sub: 'Prêt à être retiré en magasin' },
  { codes: ['delivered', 'completed'],                             label: 'Retiré',            sub: 'Commande récupérée en magasin' },
];

type Step = { codes: string[]; label: string; sub: string; isNegative?: boolean };

function DriverCard({ driver, slotStart, slotEnd }: {
  driver: OrderDriver;
  slotStart: string | null;
  slotEnd:   string | null;
}) {
  const initial = driver.name.charAt(0).toUpperCase();

  const etaLabel = slotStart && slotEnd
    ? `${slotStart} – ${slotEnd}`
    : slotStart ?? null;

  return (
    <View style={styles.driverCard}>
      <Text style={styles.sectionTitle}>Livreur assigné</Text>
      <View style={styles.driverRow}>
        {/* Avatar */}
        <View style={styles.driverAvatar}>
          <Text style={styles.driverAvatarText}>{initial}</Text>
        </View>

        {/* Info */}
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driver.name}</Text>
          {(driver.vehicle_type || driver.vehicle_plate) && (
            <View style={styles.vehicleRow}>
              <Feather name="truck" size={12} color="#9CA3AF" />
              <Text style={styles.vehicleText}>
                {[driver.vehicle_type, driver.vehicle_plate].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
        </View>

        {/* Call button */}
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => Linking.openURL(`tel:${driver.phone}`)}
          activeOpacity={0.7}
        >
          <Feather name="phone" size={18} color={RED} />
        </TouchableOpacity>
      </View>

      {/* ETA */}
      {etaLabel && (
        <View style={styles.etaRow}>
          <Feather name="clock" size={13} color={RED} />
          <Text style={styles.etaLabel}>Créneau de livraison</Text>
          <Text style={styles.etaValue}>{etaLabel}</Text>
        </View>
      )}

    </View>
  );
}

const TERMINAL_CODES = new Set(['delivered', 'completed', 'cancelled', 'returned', 'failed']);

const NEGATIVE_TERMINAL: Record<string, { label: string; sub: string }> = {
  cancelled: { label: 'Annulée',   sub: 'Votre commande a été annulée' },
  returned:  { label: 'Retournée', sub: 'Votre commande a été retournée' },
  failed:    { label: 'Échouée',   sub: 'La livraison a échoué' },
};

function getActiveStepIdx(steps: Step[], currentCode: string, doneSet: Set<string>): number {
  const current = currentCode?.toLowerCase() ?? '';
  let max = -1;
  steps.forEach((s, i) => {
    if (s.codes.some(c => c === current || doneSet.has(c))) max = i;
  });
  return max;
}

function stepState(
  idx: number,
  activeIdx: number,
  isTerminal: boolean,
  hasNegativeTerminal: boolean,
  stepCodes: string[],
  doneSet: Set<string>,
): 'done' | 'current' | 'pending' {
  if (idx === activeIdx) return isTerminal ? 'done' : 'current';
  if (idx > activeIdx)  return 'pending';
  // idx < activeIdx — pour un état terminal négatif, seuls les steps
  // réellement passés (présents dans la timeline) sont cochés
  if (hasNegativeTerminal) return stepCodes.some(c => doneSet.has(c)) ? 'done' : 'pending';
  return 'done';
}

function getStepTime(stepCodes: string[], timeline: OrderTimeline[]): string | null {
  for (const entry of timeline) {
    if (stepCodes.includes(entry.status_code?.toLowerCase() ?? '')) {
      return new Date(entry.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return null;
}

function progressPercent(activeIdx: number, total: number, isTerminal: boolean): number {
  const done = isTerminal ? activeIdx + 1 : activeIdx;
  return Math.round((Math.max(done, 0) / total) * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  useEffect(() => {
    if (!id) return;
    ProfileService.getOrderById(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
      <PageHeader title="Suivi de commande" />
        <View style={styles.container}>
          <ActivityIndicator color={RED} style={{ marginTop: 60 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <PageHeader title="Suivi de commande" />          
        <View style={styles.container}>
          <View style={styles.errorWrap}>
            <Feather name="alert-circle" size={40} color="#E5E7EB" />
            <Text style={styles.errorText}>Commande introuvable</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isPickup    = order.delivery_type?.toLowerCase() === 'pickup';
  const steps       = isPickup ? PICKUP_STEPS : DELIVERY_STEPS;
  const currentCode = order.status?.code ?? '';
  const timeline    = order.timeline ?? [];
  const isTerminal  = TERMINAL_CODES.has(currentCode.toLowerCase());
  const doneSet     = new Set(timeline.map(t => t.status_code?.toLowerCase() ?? ''));

  const negStep            = NEGATIVE_TERMINAL[currentCode.toLowerCase()];
  const hasNegativeTerminal = !!negStep;
  const displaySteps: Step[] = hasNegativeTerminal
    ? [...steps, { codes: [currentCode.toLowerCase()], ...negStep, isNegative: true }]
    : steps;

  const activeIdx = getActiveStepIdx(displaySteps, currentCode, doneSet);
  const pct       = progressPercent(activeIdx, displaySteps.length, isTerminal);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.headerRow}>
          <PageHeader title="Suivi de commande" />
          <TouchableOpacity
            style={styles.phoneBtn}
            onPress={() => Linking.openURL('tel:+212500000000')}
          >
            <Feather name="phone" size={20} color={RED} />
          </TouchableOpacity>
        </View>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Order ID ── */}
          <View style={styles.section}>
            <Text style={styles.orderIdLabel}>Order ID</Text>
            <Text style={styles.orderIdValue}>{order.reference}</Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>

          {/* ── Order Progress ── */}
          <View style={styles.section}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>Order Progress</Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>
          </View>

          {/* ── Timeline Steps ── */}
          <View style={styles.section}>
            {displaySteps.map((step, idx) => {
              const state  = stepState(idx, activeIdx, isTerminal, hasNegativeTerminal, step.codes, doneSet);
              const time   = getStepTime(step.codes, timeline);
              const isLast = idx === displaySteps.length - 1;

              return (
                <View key={idx} style={styles.stepRow}>
                  {/* Icône + trait vertical */}
                  <View style={styles.stepLeft}>
                    <View style={[
                      styles.stepCircle,
                      state === 'done' && !step.isNegative && styles.stepCircleDone,
                      state === 'done' && step.isNegative  && styles.stepCircleNegative,
                      state === 'current' && styles.stepCircleCurrent,
                      state === 'pending' && styles.stepCirclePending,
                    ]}>
                      {state === 'done' && !step.isNegative && <Feather name="check" size={14} color="#fff" />}
                      {state === 'done' && step.isNegative  && <Feather name="x"     size={14} color="#fff" />}
                      {state === 'current' && <Feather name="clock" size={14} color={RED} />}
                    </View>
                    {!isLast && (
                      <View style={[
                        styles.stepLine,
                        state === 'done' ? styles.stepLineDone : styles.stepLinePending,
                      ]} />
                    )}
                  </View>

                  {/* Texte */}
                  <View style={styles.stepContent}>
                    <Text style={[
                      styles.stepLabel,
                      state === 'pending' && styles.stepLabelPending,
                    ]}>
                      {step.label}
                    </Text>
                    <Text style={styles.stepSub}>{step.sub}</Text>
                    {time && (
                      <View style={styles.stepTimeRow}>
                        <View style={styles.stepTimeLine} />
                        <Text style={styles.stepTime}>Today, {time}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── Livreur assigné ── */}
          {order.driver && !isPickup && (
            <DriverCard
              driver={order.driver}
              slotStart={order.slot_start}
              slotEnd={order.slot_end}
            />
          )}

          {/* ── Adresse de livraison ── */}
          {!!order.address_full && (
            <View style={styles.section}>
              <View style={styles.addressHeader}>
                <Feather name="map-pin" size={16} color={RED} />
                <Text style={styles.sectionTitle}>Adresse de livraison</Text>
              </View>
              <Text style={styles.addressText}>{order.address_full}</Text>
              {order.address_label && (
                <Text style={styles.addressLabel}>{order.address_label}</Text>
              )}
            </View>
          )}

          {/* ── Récapitulatif commande ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            {(order.items ?? []).map(item => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name_fr}</Text>
                <Text style={styles.itemQty}>×{item.qty}</Text>
                <Text style={styles.itemPrice}>{Number(item.total_ttc).toFixed(2)} DH</Text>
              </View>
            ))}
            {order.delivery_fee > 0 && (
              <View style={styles.itemRow}>
                <Text style={[styles.itemName, { color: '#9CA3AF' }]}>Frais de livraison</Text>
                <Text style={styles.itemPrice}>{Number(order.delivery_fee).toFixed(2)} DH</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{Number(order.total_ttc).toFixed(2)} DH</Text>
            </View>
          </View>

          {/* ── Need Help? ── */}
          <View style={styles.helpSection}>
            <Feather name="help-circle" size={16} color="#6B7280" />
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpSub}>Contact our support team if you have any questions about your order.</Text>
            <View style={styles.helpBtns}>
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => Linking.openURL('tel:+212500000000')}
                activeOpacity={0.8}
              >
                <Feather name="phone" size={15} color="#1a1a1a" />
                <Text style={styles.helpBtnText}>Call Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.helpBtn} activeOpacity={0.8}>
                <Feather name="message-circle" size={15} color="#1a1a1a" />
                <Text style={styles.helpBtnText}>Chat</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneBtn:  { padding: 8, marginBottom: 4 },

  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', marginBottom: 10 },

  orderIdLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  orderIdValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: RED, letterSpacing: 1 },
  orderDate:    { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 4 },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressPct:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: RED },
  progressTrack:  { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: RED, borderRadius: 3 },

  // Steps
  stepRow:     { flexDirection: 'row', gap: 14, marginBottom: 0 },
  stepLeft:    { alignItems: 'center', width: 32 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleDone:     { backgroundColor: RED },
  stepCircleNegative: { backgroundColor: '#F97316' },
  stepCircleCurrent:  { backgroundColor: '#fff', borderWidth: 2, borderColor: RED },
  stepCirclePending:  { backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: '#E5E7EB' },
  stepLine:          { width: 2, flex: 1, minHeight: 20, marginVertical: 2 },
  stepLineDone:      { backgroundColor: RED },
  stepLinePending:   { backgroundColor: '#E5E7EB' },

  stepContent: { flex: 1, paddingBottom: 20 },
  stepLabel:        { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  stepLabelPending: { color: '#9CA3AF' },
  stepSub:          { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  stepTimeRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  stepTimeLine:     { width: 3, height: 14, backgroundColor: RED, borderRadius: 2 },
  stepTime:         { fontSize: 11, fontFamily: 'Inter_500Medium', color: RED },

  // Address
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  addressText:   { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', lineHeight: 22 },
  addressLabel:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 4 },

  // Items
  itemRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  itemName:   { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#1a1a1a' },
  itemQty:    { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#9CA3AF', width: 28, textAlign: 'center' },
  itemPrice:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', textAlign: 'right', minWidth: 70 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 6 },
  totalLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  totalValue: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },

  // Help
  helpSection: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  helpTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginTop: 8, marginBottom: 6 },
  helpSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  helpBtns:  { flexDirection: 'row', gap: 12, width: '100%' },
  helpBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 12,
  },
  helpBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },

  // Driver card
  driverCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    gap: 12,
  },
  driverRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { color: '#fff', fontSize: 18, fontFamily: 'Poppins_700Bold' },
  driverInfo:       { flex: 1 },
  driverName:       { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  vehicleRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  vehicleText:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
  },
  etaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8F8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  etaLabel: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  etaValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: RED },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 12, paddingVertical: 12,
  },
  trackBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
