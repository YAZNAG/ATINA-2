import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import { LoyaltyService, LoyaltySummary, LoyaltyHistoryItem } from '../../services/loyalty.service';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

const RED = '#E10600';

export default function LoyaltyScreen() {
  const router = useRouter();
  const [summary, setSummary]   = useState<LoyaltySummary | null>(null);
  const [history, setHistory]   = useState<LoyaltyHistoryItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming]   = useState(false);

  const [fontsLoaded] = useFonts({
      Poppins_600SemiBold,
      Poppins_700Bold,
      Poppins_400Regular,
      Poppins_500Medium
    });

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        LoyaltyService.getSummary(),
        LoyaltyService.getHistory(4),
      ]);
      setSummary(s);
      setHistory(h.items);
    } catch (e) {
      console.warn('loyalty load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleRedeem = async () => {
    if (!summary?.can_redeem || redeeming) return;
    try {
      setRedeeming(true);
      const res = await LoyaltyService.redeem();
      Alert.alert(
        'Coupon débloqué 🎉',
        `Code : ${res.coupon.code}\nValeur : ${res.coupon.value_mad} MAD\nValable jusqu'au ${new Date(res.coupon.valid_to).toLocaleDateString('fr-FR')}`
      );
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Échec de l\'échange.');
    } finally {
      setRedeeming(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

    if (isSameDay(d, today))     return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    if (isSameDay(d, yesterday)) return `Hier à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={RED} />
      </SafeAreaView>
    );
  }

  if (!fontsLoaded) return null;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PageHeader  title='Points fidélité'/>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
      >
        {/* ── Carte principale ── */}
        <View style={styles.mainCard}>
          <View style={styles.badge}>
            <MaterialCommunityIcons
                name="star"
                size={12}
                color={'#ffffff'}/>
            <Text style={styles.badgeText}>PROGRAMME FIDÉLITÉ</Text>
          </View>

          <Text style={styles.balanceLabel}>Points disponibles</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue}>{summary?.points_balance.toLocaleString('fr-FR')}</Text>
            <Text style={styles.balanceUnit}>pts</Text>
          </View>

          <View style={styles.progressBox}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progression</Text>
              <Text style={styles.progressValue}>
                {summary?.points_balance} / {summary?.next_milestone} pts
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${summary?.progress_pct ?? 0}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              Plus que <Text style={styles.progressHintBold}>{summary?.remaining_points} pts</Text> pour débloquer un coupon de {summary?.reward_mad} MAD.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.redeemBtn, !summary?.can_redeem && styles.redeemBtnDisabled]}
            onPress={handleRedeem}
            activeOpacity={0.85}
            disabled={!summary?.can_redeem || redeeming}
          >
            {redeeming ? (
              <ActivityIndicator color={RED} />
            ) : (
              <>
                <MaterialCommunityIcons name="ticket-percent-outline" size={18} color={RED} />
                <Text style={styles.redeemBtnText}>Échanger mes points</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Comment ça marche ── */}
        <Text style={styles.sectionTitle}>Comment ça marche ?</Text>

        <View style={styles.stepCard}>
          <View style={[styles.stepIcon, { backgroundColor: '#DBEAFE' }]}>
            <Feather name="shopping-cart" size={18} color="#2563EB" />
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Achetez</Text>
            <Text style={styles.stepDesc}>1 MAD dépensé = 1 point gagné sur votre cagnotte.</Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={[styles.stepIcon, { backgroundColor: '#D1FAE5' }]}>
            <Feather name="truck" size={18} color="#059669" />
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Recevez</Text>
            <Text style={styles.stepDesc}>Les points sont validés une fois la commande livrée.</Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={[styles.stepIcon, { backgroundColor: '#F3E8FF' }]}>
            <Feather name="gift" size={18} color="#9333EA" />
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>Profitez</Text>
            <Text style={styles.stepDesc}>Échangez vos points contre des coupons de réduction.</Text>
          </View>
        </View>

        {/* ── Validité ── */}
        <View style={styles.infoBox}>
          <Feather name="info" size={20} color="#2563EB" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>Validité des points</Text>
            <Text style={styles.infoDesc}>Vos points restent valables pendant 12 mois à compter de leur date d'acquisition.</Text>
          </View>
        </View>

        {/* ── Historique ── */}
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Historique</Text>
          <TouchableOpacity onPress={() => {}} activeOpacity={0.7}>
            <Text style={styles.seeAll}>Voir tout →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timeline}>
          {history.map((item, idx) => (
            <View key={item.id} style={styles.timelineRow}>
              <View style={styles.timelineIconCol}>
                <View style={[styles.timelineIcon, item.type === 'redeem' && styles.timelineIconRedeem]}>
                  {item.type === 'redeem'
                    ? <MaterialCommunityIcons name="ticket-percent-outline" size={16} color="#B91C1C" />
                    : <Feather name="star" size={14} color="#F59E0B" />}
                </View>
                {idx < history.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>{item.label}</Text>
                <Text style={styles.timelineDate}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={[styles.timelinePoints, item.points < 0 && styles.timelinePointsNeg]}>
                {item.points > 0 ? '+' : ''}{item.points}
              </Text>
            </View>
          ))}

          {history.length === 0 && (
            <Text style={styles.emptyText}>Aucune activité pour le moment.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  mainCard: {
    backgroundColor: RED, borderRadius: 24, padding: 24, marginTop: 8,
    shadowColor: RED, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  badge: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 20,
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 4, fontFamily: 'Poppins_500Medium' },
  balanceRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 20 },
  balanceValue: { color: '#fff', fontSize: 44, fontWeight: '800' },
  balanceUnit:  { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 8 },

  progressBox: {
    backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 16, padding: 16, marginBottom: 20,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel:  { color: '#fff', fontSize: 13, fontWeight: '600' },
  progressValue:  { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  progressTrack:  { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginBottom: 12 },
  progressFill:   { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  progressHint:   { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  progressHintBold: { fontWeight: '700', color: '#fff' },

  redeemBtn: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  redeemBtnDisabled: { opacity: 0.6 },
  redeemBtnText: { color: RED, fontSize: 15, fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 28, marginBottom: 12 },

  stepCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  stepIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  stepText:  { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  stepDesc:  { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  infoBox: {
    flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 16,
    padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#DBEAFE',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 4 },
  infoDesc:  { fontSize: 13, color: '#1E40AF', lineHeight: 18 },

  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontSize: 13, fontWeight: '700', color: RED, marginTop: 28 },

  timeline: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0',
    paddingHorizontal: 16, paddingTop: 4,
  },
  timelineRow: { flexDirection: 'row', paddingVertical: 12 },
  timelineIconCol: { alignItems: 'center', width: 32 },
  timelineIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
  },
  timelineIconRedeem: { backgroundColor: '#FEE2E2' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#F0F0F0', marginTop: 4 },
  timelineContent: { flex: 1, marginLeft: 12 },
  timelineLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  timelineDate:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  timelinePoints: { fontSize: 14, fontWeight: '800', color: '#F59E0B' },
  timelinePointsNeg: { color: '#1a1a1a' },

  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 24 },
});