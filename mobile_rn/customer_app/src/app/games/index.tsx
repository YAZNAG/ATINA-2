import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, RefreshControl, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import PageHeader from '../../components/ui/PageHeader';
import { GamesService, GamesList, CustomerGame, PlayResult, gameTypeLabel } from '../../services/games.service';
import { RewardsCart } from '../../store/rewardsCartStore';

const RED = '#E10600';

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/**
 * Section « Jeux » (WF #9, #15, #36) : jeux du magasin, badge « tour disponible »,
 * partie jouée en un tap et résultat affiché (points crédités, code promo nominatif,
 * produit / pack offert à réclamer avant expiration).
 */
export default function GamesScreen() {
  const router = useRouter();
  const [data, setData]             = useState<GamesList | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [playing, setPlaying]       = useState<CustomerGame | null>(null);
  const [result, setResult]         = useState<PlayResult | null>(null);
  const [playError, setPlayError]   = useState<string | null>(null);
  const spin = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await GamesService.list());
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger les jeux');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!playing || result || playError) return;
    spin.setValue(0);
    const anim = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [playing, result, playError, spin]);

  const handlePlay = async (game: CustomerGame) => {
    if (!game.can_play) return;
    setPlaying(game);
    setResult(null);
    setPlayError(null);
    const started = Date.now();
    try {
      const r = await GamesService.play(game.id, game.order_id);
      // Laisse tourner la roue / gratter la carte un instant avant d'afficher le résultat.
      const wait = Math.max(0, 1400 - (Date.now() - started));
      setTimeout(() => setResult(r), wait);
    } catch (e: any) {
      setPlayError(e?.message ?? 'Partie impossible');
    }
  };

  const closeModal = () => {
    setPlaying(null);
    setResult(null);
    setPlayError(null);
    load();
  };

  const claimNow = () => {
    if (!result || !result.prize || (result.prize.type !== 'free_sku' && result.prize.type !== 'free_pack')) return;
    RewardsCart.addClaim({
      play_id: result.play_id,
      name_fr: result.prize.name_fr,
      type: result.prize.type,
      expires_at: result.expires_at,
      node_id: data?.node_id ?? null,
    });
    closeModal();
    router.push('/main/cart' as any);
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={RED} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PageHeader title="Jeux" rightIcon="gift" onRightPress={() => router.push('/games/prizes' as any)} rightBadge={data?.prizes_to_claim || undefined} />

      {error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color="#9CA3AF" />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data?.games ?? []}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={RED} />}
          ListHeaderComponent={
            <TouchableOpacity style={styles.prizesLink} onPress={() => router.push('/games/prizes' as any)} activeOpacity={0.8}>
              <View style={styles.prizesIcon}><Feather name="award" size={18} color="#9333EA" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.prizesTitle}>Mes gains</Text>
                <Text style={styles.prizesSub}>
                  {data?.prizes_to_claim ? `${data.prizes_to_claim} lot(s) à réclamer avant expiration` : 'Points, coupons et lots gagnés'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#C5C5C5" />
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="dice-multiple-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>Aucun jeu n'est disponible sur votre magasin pour le moment.</Text>
            </View>
          }
          renderItem={({ item: g }) => (
            <View style={[styles.gameCard, g.can_play && styles.gameCardActive]}>
              <View style={styles.gameTop}>
                <View style={[styles.gameIcon, g.can_play && styles.gameIconActive]}>
                  <MaterialCommunityIcons
                    name={g.type === 'scratch_card' ? 'card-bulleted-outline' : 'ship-wheel'}
                    size={26}
                    color={g.can_play ? '#fff' : RED}
                  />
                  {g.badge && <View style={styles.badgeDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameType}>{gameTypeLabel(g.type)}{g.period_label ? ` • ${g.period_label}` : ''}</Text>
                  <Text style={styles.gameName}>{g.name_fr}</Text>
                  {!!g.name_ar && <Text style={styles.gameNameAr}>{g.name_ar}</Text>}
                </View>
              </View>
              <Text style={[styles.gameMsg, g.can_play && styles.gameMsgActive]}>{g.message}</Text>
              {g.prizes.length > 0 && (
                <Text style={styles.gamePrizes} numberOfLines={2}>
                  À gagner : {g.prizes.filter((p) => p.type !== 'no_prize').map((p) => p.name_fr).join(' • ') || '—'}
                </Text>
              )}
              <View style={styles.gameFooter}>
                <Text style={styles.gameQuota}>
                  {g.remaining != null ? `${g.can_play ? g.remaining + 1 : g.remaining} tour(s) restant(s)` : ''}
                  {g.ends_at ? `  •  jusqu'au ${fmtDate(g.ends_at)}` : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.playBtn, !g.can_play && styles.playBtnDisabled]}
                  disabled={!g.can_play}
                  onPress={() => handlePlay(g)}
                  activeOpacity={0.85}
                >
                  <Feather name="play" size={14} color="#fff" />
                  <Text style={styles.playBtnText}>{g.type === 'scratch_card' ? 'Gratter' : 'Jouer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={!!playing} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {playError ? (
              <>
                <Feather name="alert-circle" size={44} color={RED} />
                <Text style={styles.modalTitle}>Partie impossible</Text>
                <Text style={styles.modalText}>{playError}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={closeModal} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnText}>Fermer</Text>
                </TouchableOpacity>
              </>
            ) : !result ? (
              <>
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <MaterialCommunityIcons name={playing?.type === 'scratch_card' ? 'card-bulleted-outline' : 'ship-wheel'} size={96} color={RED} />
                </Animated.View>
                <Text style={styles.modalTitle}>{playing?.type === 'scratch_card' ? 'Grattage en cours…' : 'La roue tourne…'}</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name={result.result === 'win' ? 'party-popper' : 'emoticon-sad-outline'}
                  size={64}
                  color={result.result === 'win' ? '#F59E0B' : '#9CA3AF'}
                />
                <Text style={styles.modalTitle}>{result.result === 'win' ? (result.prize?.name_fr ?? 'Gagné !') : 'Pas de chance cette fois !'}</Text>
                <Text style={styles.modalText}>{result.message}</Text>
                {result.reward?.type === 'points' && (
                  <Text style={styles.modalHighlight}>+{result.reward.points} pts • solde {result.reward.balance_after} pts</Text>
                )}
                {result.reward?.type === 'coupon' && (
                  <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{result.reward.code}</Text>
                    <Text style={styles.codeSub}>Valable jusqu'au {fmtDate(result.reward.valid_to)}</Text>
                  </View>
                )}
                {(result.reward?.type === 'free_sku' || result.reward?.type === 'free_pack') && (
                  <Text style={styles.modalHighlight}>À réclamer avant le {fmtDate(result.expires_at)}</Text>
                )}
                {!!result.reload_message && <Text style={styles.reloadText}>{result.reload_message}</Text>}
                {(result.reward?.type === 'free_sku' || result.reward?.type === 'free_pack') ? (
                  <>
                    <TouchableOpacity style={styles.primaryBtn} onPress={claimNow} activeOpacity={0.85}>
                      <Text style={styles.primaryBtnText}>Réclamer dans mon panier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={closeModal} activeOpacity={0.7}>
                      <Text style={styles.secondaryBtnText}>Plus tard</Text>
                    </TouchableOpacity>
                  </>
                ) : result.reward?.type === 'coupon' ? (
                  <>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => { closeModal(); router.push('/profile/coupons' as any); }} activeOpacity={0.85}>
                      <Text style={styles.primaryBtnText}>Voir mes coupons</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={closeModal} activeOpacity={0.7}>
                      <Text style={styles.secondaryBtnText}>Fermer</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={closeModal} activeOpacity={0.85}>
                    <Text style={styles.primaryBtnText}>Fermer</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  scroll:   { paddingHorizontal: 16, paddingBottom: 40 },

  prizesLink: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAF5FF',
    borderRadius: 16, padding: 14, marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: '#F3E8FF',
  },
  prizesIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  prizesTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  prizesSub:   { fontSize: 12, color: '#6B7280', marginTop: 2 },

  gameCard: { borderRadius: 18, padding: 16, marginBottom: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0F0F0' },
  gameCardActive: { borderColor: RED, backgroundColor: '#FFF7F7' },
  gameTop:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gameIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  gameIconActive: { backgroundColor: RED },
  badgeDot: { position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#fff' },
  gameType: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  gameName: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginTop: 2 },
  gameNameAr: { fontSize: 13, color: '#6B7280', writingDirection: 'rtl', textAlign: 'left' },
  gameMsg:  { fontSize: 13, color: '#6B7280', marginTop: 12, lineHeight: 18 },
  gameMsgActive: { color: RED, fontWeight: '700' },
  gamePrizes: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  gameFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  gameQuota:  { fontSize: 12, color: '#6B7280', flex: 1, marginRight: 8 },
  playBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RED, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  playBtnDisabled: { backgroundColor: '#D1D5DB' },
  playBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  empty:     { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingHorizontal: 24 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginTop: 12, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginTop: 6 },
  modalText:  { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 20 },
  modalHighlight: { fontSize: 15, fontWeight: '800', color: '#F59E0B', textAlign: 'center' },
  reloadText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  codeBox:  { borderWidth: 1.5, borderStyle: 'dashed', borderColor: RED, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center' },
  codeText: { fontSize: 20, fontWeight: '800', color: RED, letterSpacing: 1 },
  codeSub:  { fontSize: 12, color: '#6B7280', marginTop: 2 },

  primaryBtn: { alignSelf: 'stretch', backgroundColor: RED, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { alignSelf: 'stretch', paddingVertical: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
});
