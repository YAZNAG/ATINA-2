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
  PacksService, PackDetail, PackItem, PackSummary,
} from '../../services/promotions.service';
import { CartService } from '../../services/cart.service';
import { useCartCount, useCartActions } from '../../context/CartContext';

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
  const { applyCart } = useCartActions();

  const handleAdd = async () => {
    if (!item.sku_id) {
      Alert.alert('Indisponible', 'Ce produit n\'est pas disponible à la commande.');
      return;
    }
    try {
      setAdding(true);
      const cart = await CartService.addItem(item.sku_id, 1);
      applyCart(cart);
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

// Carte article de pack 
function PackItemCard({ item }: { item: PackItem }) {
  return (
    <View style={styles.packItemCard}>
      <View style={styles.packItemImageBox}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.packItemImage} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={26} color={GRAY} />
          </View>
        )}
      </View>
      <View style={styles.packItemBody}>
        <Text style={styles.packItemName} numberOfLines={2}>{item.name_fr}</Text>
        {item.unit_label && (
          <Text style={styles.packItemUnit}>{item.unit_label}</Text>
        )}
        <View style={styles.packItemBottomRow}>
          <Text style={styles.packItemPrice}>{item.unit_price.toFixed(2)} MAD</Text>
        </View>
      </View>
    </View>
  );
}

//Carte pack similaire
function SimilarPackCard({ item, onPress }: { item: PackSummary; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.similarCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.similarImageBox}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="package" size={28} color={GRAY} />
          </View>
        )}
        {item.discount_pct > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{item.discount_pct}%</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name_fr}</Text>
        <Text style={styles.cardWeight}>{item.item_count} produits</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.cardNewPrice}>{item.total_price.toFixed(2)} MAD</Text>
          {item.discount_pct > 0 && (
            <Text style={styles.cardOldPrice}>{item.original_price.toFixed(2)} MAD</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PromotionDetailScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const isPack = type === 'pack';
  const cartCount = useCartCount();
  const { applyCart } = useCartActions();

  const [promo,        setPromo]        = useState<FlashSaleDetail | null>(null);
  const [pack,         setPack]         = useState<PackDetail | null>(null);
  const [similarPacks, setSimilarPacks] = useState<PackSummary[]>([]);
  const [cartTotal,    setCartTotal]    = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [addingPack,   setAddingPack]   = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      if (isPack) {
        const [detail, cart, similar] = await Promise.all([
          PacksService.getById(id),
          CartService.getCart(),
          PacksService.listSimilar(id).catch(() => []),
        ]);
        setPack(detail);
        setCartTotal(cart.total);
        setSimilarPacks(similar);
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
      applyCart(cart);
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

  const packItemRows: PackItem[][] = [];
  if (pack) {
    for (let i = 0; i < pack.items.length; i += 2) packItemRows.push(pack.items.slice(i, i + 2));
  }

  const accent   = RED;
  const data     = isPack ? pack : promo;
  const notFound = !loading && !data;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <PageHeader title={isPack ? 'Détails du Pack' : 'Produits en promotion'} />

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
          {isPack ? (
            <>
              {/* ── Hero image pack ── */}
              <View style={styles.heroBox}>
                {pack!.image_url ? (
                  <Image source={{ uri: pack!.image_url }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.heroImage, styles.imagePlaceholder]}>
                    <Feather name="package" size={48} color={GRAY} />
                  </View>
                )}
                {pack!.discount_pct > 0 && (
                  <View style={styles.heroDiscountBadge}>
                    <Text style={styles.heroDiscountText}>-{pack!.discount_pct}%</Text>
                  </View>
                )}
              </View>

              {/* ── Titre + prix ── */}
              <Text style={styles.packTitle}>{pack!.name_fr}</Text>
              <View style={styles.packPriceRow}>
                <Text style={styles.packPriceNew}>{pack!.total_price.toFixed(2)} MAD</Text>
                {pack!.saved_amount > 0 && (
                  <Text style={styles.packPriceOld}>{pack!.original_price.toFixed(2)} MAD</Text>
                )}
              </View>
              {pack!.description_fr && (
                <Text style={styles.packDescription}>{pack!.description_fr}</Text>
              )}

              {/* ── Le pack contient ── */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Le pack contient</Text>
              {packItemRows.map((row, ri) => (
                <View key={ri} style={styles.row}>
                  {row.map(item => <PackItemCard key={item.sku_id} item={item} />)}
                  {row.length === 1 && <View style={{ width: CARD_W }} />}
                </View>
              ))}

              {/* ── Détails ── */}
              <Text style={styles.sectionTitle}>Détails</Text>
              <View style={styles.detailsCard}>
                <View style={styles.detailBlock}>
                  <View style={styles.detailIconBox}>
                    <Feather name="package" size={18} color={RED} />
                  </View>
                  <Text style={styles.detailLabel}>Nombre</Text>
                  <Text style={styles.detailValue}>{pack!.item_count} Produits</Text>
                </View>
                <View style={styles.detailDividerV} />
                <View style={styles.detailBlock}>
                  <View style={styles.detailIconBox}>
                    <Feather name="calendar" size={18} color={RED} />
                  </View>
                  <Text style={styles.detailLabel}>Valide jusqu'au</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {formatDate(pack!.valid_to) ?? 'Illimité'}
                  </Text>
                </View>
                <View style={styles.detailDividerV} />
                <View style={styles.detailBlock}>
                  <View style={styles.detailIconBox}>
                    <Feather name="check-circle" size={18} color={pack!.is_active ? GREEN : GRAY} />
                  </View>
                  <Text style={styles.detailLabel}>Dispo</Text>
                  <Text style={[styles.detailValue, { color: pack!.is_active ? GREEN : GRAY }]}>
                    {pack!.is_active ? 'En stock' : 'Indisponible'}
                  </Text>
                </View>
              </View>

              {/* ── Packs similaires ── */}
              {similarPacks.length > 0 && (
                <>
                  <View style={styles.similarHeader}>
                    <Text style={styles.sectionTitle}>Packs similaires</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                    {similarPacks.map(sp => (
                      <SimilarPackCard
                        key={sp.id}
                        item={sp}
                        onPress={() => router.push({ pathname: '/main/promotion-detail' as any, params: { id: sp.id, type: 'pack' } })}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          ) : (
            <>
              {/* ── Bannière flash sale (inchangée) ── */}
              <View style={styles.banner}>
                <View style={styles.bannerLeft}>
                  <View style={[styles.bannerIconBox, { backgroundColor: accent }]}>
                    <Text style={styles.bannerIconText}>%</Text>
                  </View>
                  <View style={styles.bannerInfo}>
                    <Text style={styles.bannerTitle} numberOfLines={2}>
                      {promo!.name_fr ?? (promo!.discount_pct != null
                        ? `-${promo!.discount_pct}% sur ${promo!.scope_name ?? 'les produits'}`
                        : promo!.scope_name ?? 'Flash Vente')}
                    </Text>
                    {promo!.scope_name && promo!.scope_type !== 'sku' && (
                      <Text style={styles.bannerScope}>
                        {scopeLabel[promo!.scope_type] ?? ''} · {promo!.scope_name}
                      </Text>
                    )}
                    <View style={styles.bannerDateRow}>
                      <Feather name="calendar" size={12} color={GRAY} />
                      <Text style={styles.bannerDate}>
                        Valide jusqu'au {formatDate(promo!.ends_at)}
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
          <View style={styles.bottomBarPrice}>
            <Text style={styles.bottomBarPriceValue}>{pack?.total_price.toFixed(2)} MAD</Text>
          </View>
          <TouchableOpacity
            style={[styles.cartBtn, { flex: 1 }, addingPack && { opacity: 0.7 }]}
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

  // ── Hero pack ──
  heroBox: {
    width: '100%', height: 220, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#F5F5F5', marginBottom: 18, position: 'relative',
  },
  heroImage: { width: '100%', height: '100%' },
  heroDiscountBadge: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: RED, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  heroDiscountText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },

  packTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: INK, marginBottom: 8 },
  packPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  packPriceNew: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: RED },
  packPriceOld: { fontSize: 16, fontFamily: 'Poppins_500Medium', color: GRAY, textDecorationLine: 'line-through' },
  packDescription: { fontSize: 13.5, fontFamily: 'Poppins_400Regular', color: GRAY, lineHeight: 20, marginBottom: 8 },

  // ── Flash sale banner (inchangé) ──
  banner: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#FFD9D9', padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
    shadowColor: RED, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  bannerLeft:    { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  bannerIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerIconText:{ fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff' },
  bannerInfo:    { flex: 1 },
  bannerTitle:   { fontSize: 14, fontFamily: 'Poppins_700Bold', color: INK, lineHeight: 20, marginBottom: 3 },
  bannerScope:   { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: GRAY, marginBottom: 4 },
  bannerDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerDate:    { fontSize: 11, fontFamily: 'Poppins_400Regular', color: GRAY },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, flexShrink: 0 },
  badgeActive:   { backgroundColor: '#F0FDF4' },
  badgeInactive: { backgroundColor: '#F3F4F6' },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusText:    { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  sectionTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: INK, marginBottom: 10 },

  row:  { flexDirection: 'row', gap: 16, marginBottom: 16 },
  card: {
    width: CARD_W, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
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

  // ── Pack item card (grille 2 colonnes façon capture) ──
  packItemCard: {
    width: CARD_W, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  packItemImageBox: { width: '100%', height: CARD_W * 0.75, backgroundColor: '#ffffff' },
  packItemImage:    { width: '100%', height: '100%' },
  packItemBody:     { padding: 10 },
  packItemName:     { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: INK, lineHeight: 18, marginBottom: 2 },
  packItemUnit:     { fontSize: 11, fontFamily: 'Poppins_400Regular', color: GRAY, marginBottom: 6 },
  packItemBottomRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  packItemPrice:    { fontSize: 14, fontFamily: 'Poppins_700Bold', color: RED },


  // ── Détails (Nombre / Valide / Dispo) ──
  detailsCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 24,
  },
  detailBlock:   { flex: 1, alignItems: 'center', gap: 6 },
  detailIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  detailLabel:   { fontSize: 11, fontFamily: 'Poppins_400Regular', color: GRAY },
  detailValue:   { fontSize: 13, fontFamily: 'Poppins_700Bold', color: INK, textAlign: 'center' },
  detailDividerV:{ width: 1, backgroundColor: '#F0F0F0', marginHorizontal: 6 },

  // ── Packs similaires ──
  similarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  similarCard: {
    width: CARD_W * 0.85, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, marginBottom:10
  },
  similarImageBox: { width: '100%', height: (CARD_W * 0.85) * 0.75, backgroundColor: '#FAFAFA', position: 'relative' },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: GRAY },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  bottomBarPrice:      { backgroundColor: '#FFF0F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  bottomBarPriceValue: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: RED },
  reductionChip:  { backgroundColor: '#FFF0F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  reductionLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: RED },
  reductionValue: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: RED },

  cartBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: RED, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  cartBtnText:  { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },
  cartDivider:  { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.4)' },
  cartBtnTotal: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },
});