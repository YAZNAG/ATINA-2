import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import PageHeader from '../../components/ui/PageHeader';
import { GamesService, MyPrizes, ClaimablePrize, CouponPrize } from '../../services/games.service';
import { RewardsCart, useRewardsCart } from '../../store/rewardsCartStore';

const RED = '#E10600';

const TABS = [
  { key: 'to_claim', label: 'Lots à réclamer' },
  { key: 'coupons',  label: 'Coupons' },
  { key: 'points',   label: 'Points' },
] as const;
type TabKey = typeof TABS[number]['key'];

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const COUPON_STATUS: Record<CouponPrize['status'], { label: string; color: string; bg: string }> = {
  available:   { label: 'Disponible', color: '#15803D', bg: '#DCFCE7' },
  used:        { label: 'Utilisé',    color: '#6B7280', bg: '#F3F4F6' },
  expired:     { label: 'Expiré',     color: '#B91C1C', bg: '#FEE2E2' },
  unavailable: { label: 'Indisponible', color: '#6B7280', bg: '#F3F4F6' },
};

const CLAIM_STATUS: Record<ClaimablePrize['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'À réclamer', color: '#B45309', bg: '#FEF3C7' },
  claimed: { label: 'Réclamé',    color: '#15803D', bg: '#DCFCE7' },
  expired: { label: 'Expiré',     color: '#B91C1C', bg: '#FEE2E2' },
};

/** « Mes gains » : points crédités, coupons nominatifs, produits / packs offerts à réclamer. */
export default function MyPrizesScreen() {
  const router = useRouter();
  const rewards = useRewardsCart();
  const [data, setData]             = useState<MyPrizes | null>(null);
  const [tab, setTab]               = useState<TabKey>('to_claim');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await GamesService.myPrizes());
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger vos gains');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const inCart = (playId: string) => rewards.claims.some((c) => c.play_id === playId);

  const toggleClaim = (p: ClaimablePrize) => {
    if (inCart(p.play_id)) { RewardsCart.removeClaim(p.play_id); return; }
    RewardsCart.addClaim({ play_id: p.play_id, name_fr: p.name_fr || p.prize_name_fr, type: p.type, expires_at: p.expires_at, node_id: p.node_id });
    Alert.alert('Lot ajouté au panier', 'Il sera offert (0 MAD) dans votre prochaine commande, sur le magasin du jeu.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Voir mon panier', onPress: () => router.push('/main/cart' as any) },
    ]);
  };

  const copy = async (code: string) => {
    try { await Clipboard.setStringAsync(code); Alert.alert('Code copié', code); } catch { /* ignore */ }
  };

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={RED} /></SafeAreaView>;
  }

  const renderClaims = () => {
    const list = data?.to_claim ?? [];
    if (!list.length) return <Text style={styles.emptyText}>Aucun produit ou pack gagné pour le moment.</Text>;
    return list.map((p) => {
      const st = CLAIM_STATUS[p.status];
      const added = inCart(p.play_id);
      return (
        <View key={p.play_id} style={[styles.card, p.status !== 'pending' && styles.cardMuted]}>
          <View style={styles.row}>
            <View style={styles.thumb}>
              {p.image_url
                ? <Image source={{ uri: p.image_url }} style={styles.thumbImg} contentFit="contain" />
                : <Feather name={p.type === 'free_pack' ? 'package' : 'gift'} size={22} color={RED} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{p.name_fr || p.prize_name_fr}</Text>
              <Text style={styles.sub}>{p.type === 'free_pack' ? 'Pack offert' : 'Produit offert'} • {p.game.name_fr}</Text>
              <Text style={styles.sub}>
                {p.status === 'pending' ? `À réclamer avant le ${fmtDate(p.expires_at)}`
                  : p.status === 'claimed' ? `Réclamé le ${fmtDate(p.claimed_at)}${p.order_id ? ` • commande #${p.order_id.slice(0, 8).toUpperCase()}` : ''}`
                    : `Expiré le ${fmtDate(p.expires_at)}`}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: st.bg }]}><Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text></View>
          </View>
          {p.status === 'pending' && (
            <TouchableOpacity style={[styles.claimBtn, added && styles.claimBtnAdded]} onPress={() => toggleClaim(p)} activeOpacity={0.85}>
              <Feather name={added ? 'check' : 'shopping-cart'} size={15} color={added ? RED : '#fff'} />
              <Text style={[styles.claimBtnText, added && { color: RED }]}>{added ? 'Dans mon panier (retirer)' : 'Réclamer dans mon panier'}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  const renderCoupons = () => {
    const list = data?.coupons ?? [];
    if (!list.length) return <Text style={styles.emptyText}>Aucun coupon gagné pour le moment.</Text>;
    return list.map((c) => {
      const st = COUPON_STATUS[c.status];
      const value = c.promo_type === 'PERCENTAGE' ? `-${c.value}%` : `-${c.value} MAD`;
      return (
        <View key={c.play_id} style={[styles.card, c.status !== 'available' && styles.cardMuted]}>
          <View style={styles.row}>
            <View style={styles.thumb}><MaterialCommunityIcons name="ticket-percent-outline" size={22} color={RED} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{value} • {c.prize_name_fr}</Text>
              <Text style={styles.sub}>{c.game.name_fr}{c.min_order_amount > 0 ? ` • dès ${c.min_order_amount} MAD` : ''}</Text>
              <Text style={styles.sub}>Valable jusqu'au {fmtDate(c.valid_to)}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: st.bg }]}><Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text></View>
          </View>
          {!!c.code && (
            <TouchableOpacity style={styles.codeBox} onPress={() => copy(c.code!)} activeOpacity={0.8}>
              <Text style={styles.codeText}>{c.code}</Text>
              <Feather name="copy" size={15} color={RED} />
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  const renderPoints = () => {
    const list = data?.points ?? [];
    if (!list.length) return <Text style={styles.emptyText}>Aucun point gagné en jouant pour le moment.</Text>;
    return list.map((p) => (
      <View key={p.play_id} style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: '#FEF3C7' }]}><Feather name="star" size={20} color="#F59E0B" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{p.game.name_fr}</Text>
            <Text style={styles.sub}>Crédité le {fmtDate(p.credited_at ?? p.played_at)}</Text>
          </View>
          <Text style={styles.points}>+{p.points} pts</Text>
        </View>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PageHeader title="Mes gains" />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={RED} />}
        >
          <View style={styles.summary}>
            <View style={styles.sumItem}><Text style={styles.sumValue}>{data?.summary.prizes_to_claim ?? 0}</Text><Text style={styles.sumLabel}>Lots à réclamer</Text></View>
            <View style={styles.sumItem}><Text style={styles.sumValue}>{data?.summary.coupons_available ?? 0}</Text><Text style={styles.sumLabel}>Coupons actifs</Text></View>
            <View style={styles.sumItem}><Text style={styles.sumValue}>{data?.summary.points_total ?? 0}</Text><Text style={styles.sumLabel}>Points gagnés</Text></View>
          </View>

          <View style={styles.tabs}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
                <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'to_claim' && renderClaims()}
          {tab === 'coupons' && renderCoupons()}
          {tab === 'points' && renderPoints()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  scroll:   { paddingHorizontal: 16, paddingBottom: 40 },

  summary: { flexDirection: 'row', backgroundColor: RED, borderRadius: 20, paddingVertical: 16, marginTop: 8 },
  sumItem: { flex: 1, alignItems: 'center' },
  sumValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sumLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },

  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginVertical: 16 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  tabTextActive: { color: RED, fontWeight: '800' },

  card: { borderRadius: 16, padding: 14, marginBottom: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0F0F0' },
  cardMuted: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: 42, height: 42 },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
  points: { fontSize: 15, fontWeight: '800', color: '#F59E0B' },

  claimBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: RED, borderRadius: 12, paddingVertical: 10, marginTop: 12 },
  claimBtnAdded: { backgroundColor: '#fff', borderWidth: 1, borderColor: RED },
  claimBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  codeBox: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: RED, borderRadius: 12, paddingVertical: 8, marginTop: 12 },
  codeText: { fontSize: 16, fontWeight: '800', color: RED, letterSpacing: 1 },

  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 24 },
  retryBtn: { marginTop: 12, backgroundColor: RED, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
