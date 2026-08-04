import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
 Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import CheckoutStepper from '../../components/ui/CheckoutStepper';
import { getDeliverySlots, DeliverySlot } from '../../services/order.service';

const RED = '#E10600';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function CheckoutDateTimeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    delivery_type_code: string;
    node_id?:    string;
    node_name?:  string;
    address_id?: string;
    cart_items?: string;
  }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [slots, setSlots]               = useState<DeliverySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError]     = useState('');
  const [resolvedNodeId, setResolvedNodeId] = useState<string | null>(null);

  // ── Grille calendrier ──
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startOffset = firstDay.getDay() - 1;     
    if (startOffset < 0) startOffset = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewMonth, viewYear]);

  useEffect(() => {
  if (!selectedDate) return;
  (async () => {
    try {
      setLoadingSlots(true);
      setSlotsError('');
      setSelectedSlot(null);
      setResolvedNodeId(null);

      const dateStr = formatDate(selectedDate);
      const result = await getDeliverySlots({
        delivery_type_code: params.delivery_type_code,
        node_id:            params.node_id,
        address_id:         params.address_id,
        date:               dateStr,
        cart_items:         params.cart_items ? JSON.parse(params.cart_items) : undefined,
      });

      setSlots(result.slots);
      setResolvedNodeId(result.node_id);
    } catch (e: any) {
      setSlots([]);
      setSlotsError(e.message || 'Erreur chargement des créneaux');
    } finally {
      setLoadingSlots(false);
    }
  })();
}, [selectedDate]);

  if (!fontsLoaded) return null;

  const formatDate = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < t;
  };
  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (day: number) =>
    selectedDate?.getDate() === day &&
    selectedDate?.getMonth() === viewMonth &&
    selectedDate?.getFullYear() === viewYear;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedSlot) return;
    const slot = slots.find((s) => s.id === selectedSlot);
    const nodeId = params.node_id ?? resolvedNodeId ?? undefined;
    router.replace({
      pathname: '/order/payment' as any,
      params: {
        ...params,
        node_id:    nodeId,
        date:       formatDate(selectedDate),
        slot_id:    selectedSlot,
        slot_start: slot?.start_time,
        slot_end:   slot?.end_time,
      },
    });
  };

  const canConfirm = selectedDate && selectedSlot;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>

        <PageHeader title="Mode de réception" />
        <CheckoutStepper currentStep={2} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ── Calendrier ── */}
          <View style={styles.calendarCard}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                <Feather name="chevron-left" size={20} color="#1a1a1a" />
              </TouchableOpacity>
              <Text style={styles.calTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                <Feather name="chevron-right" size={20} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((day, i) => {
                if (day === null) return <View key={`e${i}`} style={styles.dayCell} />;
                const past = isPast(day);
                const sel  = isSelected(day);
                const tod  = isToday(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={styles.dayCell}
                    disabled={past}
                    onPress={() => setSelectedDate(new Date(viewYear, viewMonth, day))}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dayInner,
                      tod && !sel && styles.dayToday,
                      sel && styles.daySelected,
                    ]}>
                      <Text style={[
                        styles.dayText,
                        past && styles.dayTextPast,
                        (sel || tod) && styles.dayTextHighlight,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Créneaux ── */}
          <Text style={styles.sectionTitle}>Choisir un créneau horaire</Text>

          {!selectedDate ? (
            <Text style={styles.hintText}>Sélectionnez d'abord une date</Text>
          ) : loadingSlots ? (
            <ActivityIndicator color={RED} style={{ marginVertical: 20 }} />
          ) : slotsError ? (
            <Text style={styles.errorText}>{slotsError}</Text>
          ) : slots.length === 0 ? (
            <View style={styles.emptySlots}>
              <Feather name="clock" size={36} color="#E0E0E0" />
              <Text style={styles.emptyText}>
                {params.delivery_type_code === 'home' && resolvedNodeId === null
                  ? 'Livraison indisponible dans cette zone'
                  : 'Aucun créneau disponible ce jour'}
              </Text>
              <Text style={styles.emptySubtext}>
                {params.delivery_type_code === 'home' && resolvedNodeId === null
                  ? 'Votre adresse est hors zone de livraison'
                  : 'Choisissez une autre date'}
              </Text>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => {
                const active   = selectedSlot === slot.id;
                const disabled = slot.available === false;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotChip,
                      active && styles.slotChipActive,
                      disabled && styles.slotChipDisabled,
                    ]}
                    onPress={() => !disabled && setSelectedSlot(slot.id)}
                    disabled={disabled}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.slotText,
                      active && styles.slotTextActive,
                      disabled && styles.slotTextDisabled,
                    ]}>
                      {slot.start_time} - {slot.end_time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </ScrollView>

        {/* ── Confirmer ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnConfirm, !canConfirm && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, !canConfirm && styles.btnTextDisabled]}>
              Confirmer la planification
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12 },

  calendarCard: { backgroundColor: '#fff', borderRadius: 16, padding: 8, marginBottom: 24 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 16, marginTop: 8 },
  calNavBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  calTitle:  { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell:  { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayToday:    { backgroundColor: '#FFD600' },
  daySelected: { backgroundColor: RED ,borderRadius: 18},
  dayText:        { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#1a1a1a' },
  dayTextPast:    { color: '#D1D5DB' },
  dayTextHighlight: { color: '#fff', fontFamily: 'Inter_700Bold' },

  sectionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', marginBottom: 14 },
  hintText:     { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center', marginVertical: 16 },
  errorText:    { fontSize: 13, fontFamily: 'Inter_400Regular', color: RED, textAlign: 'center', marginVertical: 16 },
  emptySlots:   { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyText:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  emptySubtext: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slotChip: { width: '47%', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  slotChipActive: { backgroundColor: RED, borderColor: RED },
  slotChipDisabled: { backgroundColor: '#F9FAFB', borderColor: '#F0F0F0' },
  slotText:       { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#1a1a1a' },
  slotTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  slotTextDisabled: { color: '#D1D5DB' },

  footer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 20, left: 16, right: 16 },
  btnConfirm: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnDisabled: { backgroundColor: '#E5E7EB',  shadowColor: '#00000026', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  btnTextDisabled: { color: '#9CA3AF' },
});