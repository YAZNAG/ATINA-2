import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PageHeader from '../../components/ui/PageHeader';
import {
  PromotionsService, FlashSaleSummary,
  PacksService, PackSummary,
} from '../../services/promotions.service';

const RED    = '#E10600';
const INK    = '#1A1A1A';
const GRAY   = '#9CA3AF';

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

const SCOPE_LABEL: Record<string, string> = {
  category: 'Catégorie',
  brand:    'Marque',
};

function FlashCard({ item, onPress }: { item: FlashSaleSummary; onPress: () => void }) {
  const hasImg = !!item.image_url;
  return (
    <TouchableOpacity style={[styles.card, !hasImg && { backgroundColor: RED }]} onPress={onPress} activeOpacity={0.88}>
      {hasImg ? (
        <Image source={{ uri: item.image_url! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.overlay}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardLabel}>✦ OFFRE SPÉCIALE</Text>
            <Text style={styles.cardName} numberOfLines={2}>
              {item.name_fr ?? item.scope_name ?? 'Flash Vente'}
            </Text>
            {item.scope_name && item.scope_type !== 'sku' && (
              <View style={styles.scopeRow}>
                <Feather name={item.scope_type === 'brand' ? 'tag' : 'grid'} size={11} color="rgba(255,255,255,0.8)" />
                <Text style={styles.cardSub}>{SCOPE_LABEL[item.scope_type] ?? ''} · {item.scope_name}</Text>
              </View>
            )}
            <View style={styles.dateRow}>
              <Feather name="clock" size={11} color="rgba(255,255,255,0.7)" />
              <Text style={styles.cardDate}>Jusqu'au {formatDate(item.ends_at)}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.product_count} produit{item.product_count > 1 ? 's' : ''}</Text>
            </View>
          </View>
          {item.discount_pct != null && (
            <View style={styles.discCircle}>
              <Text style={styles.discPct}>{item.discount_pct}%</Text>
              <Text style={styles.discOff}>OFF</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function PackCard({ item, onPress }: { item: PackSummary; onPress: () => void }) {
  const hasImg = !!item.image_url;
  return (
    <TouchableOpacity style={[styles.card, !hasImg && { backgroundColor: RED }]} onPress={onPress} activeOpacity={0.88}>
      {hasImg ? (
        <Image source={{ uri: item.image_url! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.overlay}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardLabel}>⬡ PACK ÉCONOMIQUE</Text>
            <Text style={styles.cardName} numberOfLines={2}>{item.name_fr}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceOld}>{item.original_price.toFixed(2)} MAD</Text>
              <Text style={styles.priceNew}>{item.total_price.toFixed(2)} MAD</Text>
            </View>
            {item.valid_to && (
              <View style={styles.dateRow}>
                <Feather name="calendar" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={styles.cardDate}>Valide jusqu'au {formatDate(item.valid_to)}</Text>
              </View>
            )}
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.item_count} article{item.item_count > 1 ? 's' : ''}</Text>
            </View>
          </View>
          {item.discount_pct > 0 && (
            <View style={[styles.discCircle, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <Text style={styles.discPct}>{item.discount_pct}%</Text>
              <Text style={styles.discOff}>OFF</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function PromotionsScreen() {
  const router = useRouter();
  const [promos,     setPromos]     = useState<FlashSaleSummary[]>([]);
  const [packs,      setPacks]      = useState<PackSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [p, pk] = await Promise.all([
        PromotionsService.listActive().catch(() => []),
        PacksService.listActive().catch(() => []),
      ]);
      setPromos(p.filter(f => f.scope_type === 'category' || f.scope_type === 'brand'));
      setPacks(pk);
    } catch (e) {
      console.error('Promotions load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(true); };

  const isEmpty = promos.length === 0 && packs.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <PageHeader title="Promotions" />

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
          {isEmpty ? (
            <View style={styles.empty}>
              <Feather name="tag" size={40} color={GRAY} />
              <Text style={styles.emptyTitle}>Aucune promotion active</Text>
              <Text style={styles.emptyDesc}>Revenez bientôt pour découvrir nos offres.</Text>
            </View>
          ) : (
            <>
              {promos.length > 0 && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Feather name="zap" size={16} color={RED} />
                    <Text style={styles.sectionTitle}>Ventes Flash</Text>
                  </View>
                  {promos.map(item => (
                    <FlashCard
                      key={`flash-${item.id}`}
                      item={item}
                      onPress={() => router.push({ pathname: '/main/promotion_detail' as any, params: { id: item.id, type: 'flash' } })}
                    />
                  ))}
                </View>
              )}

              {packs.length > 0 && (
                <View style={promos.length > 0 ? styles.packsSection : undefined}>
                  <View style={styles.sectionHeader}>
                    <Feather name="package" size={16} color={RED} />
                    <Text style={[styles.sectionTitle, { color: RED }]}>Packs Économiques</Text>
                  </View>
                  {packs.map(item => (
                    <PackCard
                      key={`pack-${item.id}`}
                      item={item}
                      onPress={() => router.push({ pathname: '/main/promotion_detail' as any, params: { id: item.id, type: 'pack' } })}
                    />
                  ))}
                </View>
              )}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:     { paddingHorizontal: 16, paddingTop: 14 },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  sectionTitle:   { fontSize: 16, fontFamily: 'Poppins_700Bold', color: RED },
  packsSection:   { marginTop: 24 },

  card: {
    height: 200,
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  cardLeft:  { flex: 1, paddingRight: 14 },
  cardLabel: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5, marginBottom: 5 },
  cardName:  { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff', lineHeight: 24, marginBottom: 6 },

  scopeRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  cardSub:   { fontSize: 12, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.85)' },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  cardDate:  { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.75)' },
  chip:      { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  chipText:  { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  priceOld:  { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through' },
  priceNew:  { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },

  discCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  discPct:  { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', lineHeight: 24 },
  discOff:  { fontSize: 10, fontFamily: 'Poppins_700Bold', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: INK },
  emptyDesc:  { fontSize: 14, fontFamily: 'Poppins_400Regular', color: GRAY, textAlign: 'center', paddingHorizontal: 32 },
});
