import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PageHeader from '../../components/ui/PageHeader';
import SortBar from '../../components/ui/SortBar';
import {
  CouponsService, Coupon, MyCoupons,
  couponTitle, couponDescription,
} from '../../services/coupons.service';

const RED   = '#E10600';
const GREEN = '#16A34A';
const AMBER = '#F59E0B';
const GRAY  = '#9CA3AF';
const INK   = '#1A1A1A';

type Tab = 'all' | 'available' | 'used' | 'expired';

type CouponStatus = 'available' | 'used' | 'expired';

const STATUS_CONFIG: Record<CouponStatus, { label: string; color: string; bg: string }> = {
  available: { label: 'Disponible', color: GREEN, bg: '#F0FDF4' },
  used:      { label: 'Utilisé',    color: GRAY,  bg: '#F3F4F6' },
  expired:   { label: 'Expiré',     color: AMBER, bg: '#FFFBEB' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}


function CouponCard({ coupon, status }: { coupon: Coupon; status: CouponStatus }) {
  const router = useRouter();
  const badge  = STATUS_CONFIG[status];
  const isAvailable = status === 'available';
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyCode = () => {
    Clipboard.setStringAsync(coupon.code);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  const handleUse = () => {
    Clipboard.setStringAsync(coupon.code);
    SecureStore.setItemAsync('pending_coupon_code', coupon.code);
    router.push('/main/cart' as any);
  };

  const dateLabel =
    status === 'used'    ? `Utilisé le ${formatDate(coupon.valid_to)}`
    : status === 'expired' ? `Expiré le ${formatDate(coupon.valid_to)}`
    : `Expire le ${formatDate(coupon.valid_to)}`;

  return (
    <View style={[styles.card, !isAvailable && styles.cardMuted]}>
      {/* ── Top ── */}
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {couponTitle(coupon)}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <View style={[styles.dot, { backgroundColor: badge.color }]} />
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* ── Code ── */}
        <TouchableOpacity
          style={[styles.codeRow, copied && styles.codeRowCopied]}
          onPress={copyCode}
          activeOpacity={0.7}
        >
          <Text style={[styles.codeText, copied && styles.codeTextCopied]}>{coupon.code}</Text>
          {copied ? (
            <Feather name="check" size={13} color={GREEN} style={{ marginLeft: 8 }} />
          ) : (
            <Feather name="copy" size={13} color={GRAY} style={{ marginLeft: 8 }} />
          )}
          {copied && (
            <Text style={styles.copiedLabel}>Copié !</Text>
          )}
        </TouchableOpacity>

        {/* ── Description ── */}
        <Text style={styles.cardDesc}>{couponDescription(coupon)}</Text>
      </View>

      {/* ── Date ── */}
      <View style={styles.dateRow}>
        <Feather name="clock" size={13} color={isAvailable ? RED : GRAY} />
        <Text style={[styles.dateText, { color: isAvailable ? RED : GRAY }]}>
          {dateLabel}
        </Text>
      </View>

      {/* ── Bouton ── */}
      {isAvailable ? (
        <TouchableOpacity style={styles.btnUse} onPress={handleUse} activeOpacity={0.85}>
          <Text style={styles.btnUseText}>Utiliser</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.btnUsed}>
          <Text style={styles.btnUsedText}>
            {status === 'used' ? 'Déjà utilisé' : 'Expiré'}
          </Text>
        </View>
      )}
    </View>
  );
}


export default function CouponsScreen() {
  const [data,       setData]       = useState<MyCoupons | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await CouponsService.listMyCoupons();
      setData(result);
    } catch (e) {
      console.error('Coupons load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(true); };

  const items: { coupon: Coupon; status: CouponStatus }[] = [];
  if (data) {
    if (activeTab === 'all' || activeTab === 'available')
      data.available.forEach(c => items.push({ coupon: c, status: 'available' }));
    if (activeTab === 'all' || activeTab === 'used')
      data.used.forEach(c => items.push({ coupon: c, status: 'used' }));
    if (activeTab === 'all' || activeTab === 'expired')
      data.expired.forEach(c => items.push({ coupon: c, status: 'expired' }));
  }

  const totalCount = data
    ? { all: data.available.length + data.used.length + data.expired.length,
        available: data.available.length, used: data.used.length, expired: data.expired.length }
    : { all: 0, available: 0, used: 0, expired: 0 };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title="Mes Coupons" />

      {/* ── Tabs ── */}
      <SortBar
        value={activeTab}
        onChange={v => setActiveTab(v as Tab)}
        options={[
          { value: 'all',       label: 'Tous',        badge: totalCount.all },
          { value: 'available', label: 'Disponibles', badge: totalCount.available },
          { value: 'used',      label: 'Utilisés',    badge: totalCount.used },
          { value: 'expired',   label: 'Expirés',     badge: totalCount.expired },
        ]}
      />

      {/* ── Contenu ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RED]} />}
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucun coupon</Text>
              <Text style={styles.emptyDesc}>
                Vos coupons de réduction apparaîtront ici.
              </Text>
            </View>
          ) : (
            items.map(({ coupon, status }) => (
              <CouponCard key={coupon.id + status} coupon={coupon} status={status} />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // List
  list: { paddingHorizontal: 16, paddingTop: 14 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1, borderColor: '#F0F0F0',
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardMuted: { opacity: 0.85 },

  cardTop:      { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle:    { flex: 1, fontSize: 15.5, fontFamily: 'Poppins_700Bold', color: INK, marginRight: 8, lineHeight: 22 },

  // Badge
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 50,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  // Code
  codeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 10, borderWidth: 1.2, borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 8,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  codeText:       { fontSize: 13, fontFamily: 'Consolas', fontWeight: 'bold', color: INK, letterSpacing: 1.5 },
  codeTextCopied: { color: GREEN },
  codeRowCopied:  { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  copiedLabel:    { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: GREEN, marginLeft: 4 },

  // Description
  cardDesc: { fontSize: 12.5, fontFamily: 'Poppins_400Regular', color: '#6B7280', lineHeight: 18 },

  // Date
  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  dateText: { fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },

  // Buttons
  btnUse: {
    backgroundColor: RED, borderRadius: 15,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  btnUseText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins_700Bold' },
  btnUsed: {
    backgroundColor: '#F3F4F6', borderRadius: 15,
    paddingVertical: 14, alignItems: 'center',
  },
  btnUsedText: { color: GRAY, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 70 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: INK, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, fontFamily: 'Poppins_400Regular', color: GRAY, textAlign: 'center', paddingHorizontal: 32 },
});
