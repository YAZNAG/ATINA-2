import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image, Dimensions, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PageHeader from '../../components/ui/PageHeader';
import {
  PromotionsService, FlashSaleDetail, PromotionProduct,
  PacksService, PackDetail, PackItem,
} from '../../services/promotions.service';
import { CartService } from '../../services/cart.service';
import { useCart } from '../../context/CartContext';

const RED    = '#E10600';
const GREEN  = '#16A34A';
const INK    = '#1A1A1A';
const GRAY   = '#9CA3AF';

const { width } = Dimensions.get('window');
const CARD_W    = (width - 48) / 2;

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function weightLabel(g: number | null): string | null {
  if (!g) return null;
  return g >= 1000 ? `${g / 1000} kg` : `${g} g`;
}

function PromoProductCard({ item }: { item: PromotionProduct }) {
  const [adding, setAdding] = useState(false);
  const { refreshCartCount } = useCart();

  const handleAdd = async () => {
    if (!item.sku_id) {
      Alert.alert('Indisponible', 'Ce produit n\'est pas disponible à la commande.');
      return;
    }
    try {
      setAdding(true);
      await CartService.addItem(item.sku_id, 1);
      await refreshCartCount();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Erreur lors de l\'ajout au panier');
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.imageBox}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={28} color={GRAY} />
          </View>
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>-{item.discount_pct}%</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name_fr}</Text>
        {weightLabel(item.weight_g) && (
          <Text style={styles.cardWeight}>{weightLabel(item.weight_g)}</Text>
        )}
        <Text style={styles.cardNewPrice}>{item.new_price.toFixed(2)} MAD</Text>
        <Text style={styles.cardOldPrice}>{item.old_price.toFixed(2)} MAD</Text>
      </View>

      <TouchableOpacity
        style={[styles.addBtn, adding && { opacity: 0.7 }]}
        onPress={handleAdd}
        activeOpacity={0.85}
        disabled={adding}
      >
        {adding
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.addBtnText}>Ajouter</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

function PackItemRow({ item }: { item: PackItem }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemImageBox}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="contain" />
        ) : (
          <Feather name="image" size={22} color={GRAY} />
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name_fr}</Text>
        <Text style={styles.itemPrice}>{item.unit_price.toFixed(2)} MAD / unité</Text>
      </View>
      <View style={styles.itemQtyBox}>
        <Text style={styles.itemQty}>×{item.qty}</Text>
      </View>
    </View>
  );
}

export default function PromotionDetailScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const isPack = type === 'pack';
  const { cartCount, refreshCartCount } = useCart();

  const [promo,      setPromo]      = useState<FlashSaleDetail | null>(null);
  const [pack,       setPack]       = useState<PackDetail | null>(null);
  const [cartTotal,  setCartTotal]  = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingPack, setAddingPack] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      if (isPack) {
        const [detail, cart] = await Promise.all([PacksService.getById(id), CartService.getCart()]);
        setPack(detail);
        setCartTotal(cart.total);
      } else {
        const [detail, cart] = await Promise.all([PromotionsService.getById(id), CartService.getCart()]);
        setPromo(detail);
        setCartTotal(cart.total);
      }
    } catch (e) {
      console.error('Promotion detail load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, isPack]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleAddPack = async () => {
    if (!pack) return;
    try {
      setAddingPack(true);
      const cart = await CartService.addPack(pack.id, 1);
      await refreshCartCount();
      setCartTotal(cart.total);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || "Erreur lors de l'ajout du pack");
    } finally {
      setAddingPack(false);
    }
  };

  const scopeLabel: Record<string, string> = {
    category: 'Catégorie',
    brand:    'Marque',
  };

  const products = promo?.eligible_products ?? [];
  const rows: PromotionProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2));

  const accent   = RED;
  const data     = isPack ? pack : promo;
  const notFound = !loading && !data;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <PageHeader title={isPack ? 'Détail du pack' : 'Produits en promotion'} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : notFound ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Introuvable</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accent]} />}
        >
          {/* ── Bannière ── */}
          <View style={styles.banner}>
            <View style={styles.bannerLeft}>
              <View style={[styles.bannerIconBox, { backgroundColor: accent }]}>
                {isPack ? (
                  <Feather name="package" size={20} color="#fff" />
                ) : (
                  <Text style={styles.bannerIconText}>%</Text>
                )}
              </View>
              <View style={styles.bannerInfo}>
                <Text style={styles.bannerTitle} numberOfLines={2}>
                  {isPack
                    ? pack!.name_fr
                    : (promo!.name_fr ?? (promo!.discount_pct != null
                        ? `-${promo!.discount_pct}% sur ${promo!.scope_name ?? 'les produits'}`
                        : promo!.scope_name ?? 'Flash Vente'))}
                </Text>
                {!isPack && promo!.scope_name && promo!.scope_type !== 'sku' && (
                  <Text style={styles.bannerScope}>
                    {scopeLabel[promo!.scope_type] ?? ''} · {promo!.scope_name}
                  </Text>
                )}
                <View style={styles.bannerDateRow}>
                  <Feather name="calendar" size={12} color={GRAY} />
                  <Text style={styles.bannerDate}>
                    Valide jusqu'au {formatDate(isPack ? pack!.valid_to : promo!.ends_at)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.statusBadge, data!.is_active ? styles.badgeActive : styles.badgeInactive]}>
              <View style={[styles.statusDot, { backgroundColor: data!.is_active ? GREEN : GRAY }]} />
              <Text style={[styles.statusText, { color: data!.is_active ? GREEN : GRAY }]}>
                {data!.is_active ? 'Activé' : 'Expiré'}
              </Text>
            </View>
          </View>

          {isPack ? (
            <>
              {/* ── Prix du pack ── */}
              <View style={styles.priceCard}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Prix normal</Text>
                  <Text style={styles.priceOld}>{pack!.original_price.toFixed(2)} MAD</Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabelPromo}>Prix pack</Text>
                  <Text style={styles.priceNew}>{pack!.total_price.toFixed(2)} MAD</Text>
                </View>
                {pack!.saved_amount > 0 && (
                  <View style={styles.savingRow}>
                    <Feather name="check-circle" size={14} color={GREEN} />
                    <Text style={styles.savingText}>
                      Vous économisez {pack!.saved_amount.toFixed(2)} MAD
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Articles inclus ── */}
              <Text style={styles.sectionTitle}>
                Articles inclus ({pack!.item_count})
              </Text>
              <View style={styles.itemsCard}>
                {pack!.items.map((item, i) => (
                  <View key={item.sku_id}>
                    {i > 0 && <View style={styles.itemDivider} />}
                    <PackItemRow item={item} />
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* ── Produits éligibles ── */}
              <Text style={styles.sectionTitle}>
                Produits éligibles ({promo!.eligible_count})
              </Text>

              {products.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="tag" size={36} color={GRAY} />
                  <Text style={styles.emptyText}>Aucun produit éligible</Text>
                </View>
              ) : (
                rows.map((row, ri) => (
                  <View key={ri} style={styles.row}>
                    {row.map(item => <PromoProductCard key={`${item.id}-${item.sku_id}`} item={item} />)}
                    {row.length === 1 && <View style={{ width: CARD_W }} />}
                  </View>
                ))
              )}
            </>
          )}

          <View style={{ height: (isPack || cartCount > 0) ? 90 : 32 }} />
        </ScrollView>
      )}

      {/* ── Barre du bas ── */}
      {isPack ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.cartBtn, { backgroundColor: RED }, addingPack && { opacity: 0.7 }]}
            onPress={handleAddPack}
            activeOpacity={0.85}
            disabled={addingPack}
          >
            {addingPack ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="shopping-cart" size={17} color="#fff" />
                <Text style={styles.cartBtnText}>Ajouter le pack</Text>
                <View style={styles.cartDivider} />
                <Text style={styles.cartBtnTotal}>{pack?.total_price.toFixed(2)} MAD</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : cartCount > 0 && (
        <View style={styles.bottomBar}>
          {promo?.discount_pct != null && (
            <View style={styles.reductionChip}>
              <Text style={styles.reductionLabel}>Réduction</Text>
              <Text style={styles.reductionValue}>-{promo.discount_pct}%</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => router.push('/main/cart' as any)}
            activeOpacity={0.85}
          >
            <Feather name="shopping-cart" size={17} color="#fff" />
            <Text style={styles.cartBtnText}>Voir le panier ({cartCount})</Text>
            <View style={styles.cartDivider} />
            <Text style={styles.cartBtnTotal}>{cartTotal.toFixed(2)} MAD</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  errorText:{ fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: GRAY },

  banner: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1, borderColor: '#FFD9D9',
    padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: RED, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  bannerLeft:    { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  bannerIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bannerIconText: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff' },
  bannerInfo:     { flex: 1 },
  bannerTitle:    { fontSize: 14, fontFamily: 'Poppins_700Bold', color: INK, lineHeight: 20, marginBottom: 3 },
  bannerScope:    { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: GRAY, marginBottom: 4 },
  bannerDateRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerDate:     { fontSize: 11, fontFamily: 'Poppins_400Regular', color: GRAY },

  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, flexShrink: 0 },
  badgeActive:    { backgroundColor: '#F0FDF4' },
  badgeInactive:  { backgroundColor: '#F3F4F6' },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusText:     { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: INK, marginBottom: 14 },

  row:  { flexDirection: 'row', gap: 16, marginBottom: 16 },
  card: {
    width: CARD_W, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  imageBox:         { position: 'relative', width: '100%', height: CARD_W * 0.85, backgroundColor: '#FAFAFA' },
  image:            { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge:    { position: 'absolute', top: 8, left: 8, backgroundColor: RED, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  discountBadgeText:{ fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#fff' },

  cardBody:     { padding: 10, paddingBottom: 6 },
  cardName:     { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: INK, lineHeight: 18, marginBottom: 2 },
  cardWeight:   { fontSize: 11, fontFamily: 'Poppins_400Regular', color: GRAY, marginBottom: 4 },
  cardNewPrice: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: RED },
  cardOldPrice: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: GRAY, textDecorationLine: 'line-through' },

  addBtn:     { margin: 10, marginTop: 6, backgroundColor: RED, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },

  priceCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  priceRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  priceLabel:   { fontSize: 14, fontFamily: 'Poppins_400Regular', color: GRAY },
  priceOld:     { fontSize: 14, fontFamily: 'Poppins_500Medium', color: GRAY, textDecorationLine: 'line-through' },
  priceDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  priceLabelPromo: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: INK },
  priceNew:     { fontSize: 18, fontFamily: 'Poppins_700Bold', color: RED },
  savingRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10 },
  savingText:   { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: GREEN },

  itemsCard:    { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemImageBox: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  itemImage:    { width: '100%', height: '100%' },
  itemInfo:     { flex: 1 },
  itemName:     { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: INK, lineHeight: 18, marginBottom: 3 },
  itemPrice:    { fontSize: 12, fontFamily: 'Poppins_400Regular', color: GRAY },
  itemQtyBox:   { backgroundColor: '#FFF0F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  itemQty:      { fontSize: 13, fontFamily: 'Poppins_700Bold', color: RED },
  itemDivider:  { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 14 },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: GRAY },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  reductionChip:  { backgroundColor: '#FFF0F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  reductionLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: RED },
  reductionValue: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: RED },

  cartBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: RED, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  cartBtnText:  { flex: 1, fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },
  cartDivider:  { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.4)' },
  cartBtnTotal: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },
});
