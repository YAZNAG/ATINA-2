import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image'; 
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import PageHeader   from '../../components/ui/PageHeader';
import { CartService, CartItem, Cart } from '../../services/cart.service';
import { useCartActions } from '../../context/CartContext';

const RED = '#E10600';
const { width } = Dimensions.get('window');

const CARD_HEIGHT = 320;

const ITEM_HEIGHT      = 96;
const PACK_ITEM_HEIGHT = 118;
const ITEM_GAP         = 12;
const ROW_HEIGHT       = ITEM_HEIGHT + ITEM_GAP;
const PACK_ROW_HEIGHT  = PACK_ITEM_HEIGHT + ITEM_GAP;

const getEntryRowHeight = (entry: ListEntry) =>
  entry.type === 'pack' ? PACK_ROW_HEIGHT : ROW_HEIGHT;


interface PackGroup {
  type:       'pack';
  packId:     string;
  name_fr:    string;
  image_url:  string | null;
  bundleQty:  number;
  items:      CartItem[];
  subtotal:   number;
}

interface StandaloneEntry {
  type: 'item';
  item: CartItem;
}

type ListEntry = PackGroup | StandaloneEntry;

function buildListEntries(items: CartItem[]): ListEntry[] {
  const entries: ListEntry[] = [];
  const packGroups = new Map<string, PackGroup>();

  for (const item of items) {
    if (item.pack) {
      let group = packGroups.get(item.pack.id);
      if (!group) {
        group = {
          type: 'pack', packId: item.pack.id, name_fr: item.pack.name_fr,
          image_url: item.pack.image_url, bundleQty: item.pack.bundle_qty,
          items: [], subtotal: 0,
        };
        packGroups.set(item.pack.id, group);
        entries.push(group);
      }
      group.items.push(item);
      group.subtotal = Math.round((group.subtotal + item.subtotal) * 100) / 100;
    } else {
      entries.push({ type: 'item', item });
    }
  }
  return entries;
}

type DeleteTarget =
  | { kind: 'item'; item: CartItem }
  | { kind: 'pack'; packId: string; name_fr: string }
  | { kind: 'clearAll' };


const stableCart = (c: Cart): Cart => ({
  ...c,
  items: [...c.items].sort((a, b) => a.id.localeCompare(b.id)),
});

const ConfirmDeleteModal = ({
  visible, target, onConfirm, onCancel,
}: {
  visible: boolean; target: DeleteTarget | null;
  onConfirm: () => void; onCancel: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>
          {target?.kind === 'pack'
            ? 'Supprimer le pack ?'
            : target?.kind === 'clearAll'
              ? 'Vider le panier ?'
              : "Supprimer l'article ?"}
        </Text>
        <Text style={styles.modalSubtitle}>
          {target?.kind === 'pack'
            ? `Êtes-vous sûr de vouloir supprimer le pack "${target.name_fr}" de votre panier ?`
            : target?.kind === 'clearAll'
              ? 'Êtes-vous sûr de vouloir supprimer tous les articles de votre panier ?'
              : 'Êtes-vous sûr de vouloir supprimer cet article de votre panier ?'}
        </Text>
        <TouchableOpacity style={styles.btnConfirmDelete} onPress={onConfirm} activeOpacity={0.85}>
          <Text style={styles.btnConfirmDeleteText}>Supprimer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.btnCancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

const CartItemRow = React.memo(({
  item, onIncrease, onDecrease, onRemove, updating,
}: {
  item: CartItem;
  onIncrease: (item: CartItem) => void;
  onDecrease: (item: CartItem) => void;
  onRemove: (item: CartItem) => void;
  updating: boolean;
}) => (
  <View style={styles.itemCard}>
    <View style={styles.itemImageBox}>
      {item.article.image_url ? (
        <Image
          source={{ uri: item.article.image_url }}
          style={styles.itemImage}
          contentFit="contain"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={String(item.article.id ?? item.article.sku_code)}
        />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <Feather name="image" size={24} color="#E0E0E0" />
        </View>
      )}
    </View>
    <View style={styles.itemInfo}>
      <Text style={styles.itemName} numberOfLines={2}>{item.article.name_fr}</Text>
      <Text style={styles.itemSub} numberOfLines={1}>
        {item.article.brand?.name_fr ? `${item.article.brand.name_fr} • ` : ''}
        {item.article.sku_code}
      </Text>
      <View style={styles.priceCol}>
  <Text style={styles.itemPrice}>{item.article.price_ttc.toFixed(2)} MAD</Text>
  {item.article.discount_pct != null && (
    <View style={styles.oldPriceRow}>
      <Text style={styles.itemOldPrice}>{item.article.original_price_ttc!.toFixed(2)} MAD</Text>
      <View style={styles.discountBadge}>
        <Text style={styles.discountBadgeText}>-{item.article.discount_pct}%</Text>
      </View>
    </View>
  )}
</View>
    </View>
    <View style={styles.itemActions}>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onRemove(item)} activeOpacity={0.7}>
        <Feather name="trash-2" size={16} color={RED} />
      </TouchableOpacity>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrease(item)} disabled={updating} activeOpacity={0.7}>
          <Feather name="minus" size={14} color="#1a1a1a" />
        </TouchableOpacity>
        {updating
          ? <ActivityIndicator size="small" color={RED} style={{ width: 24 }} />
          : <Text style={styles.qtyText}>{item.quantity}</Text>
        }
        <TouchableOpacity style={styles.qtyBtnPlus} onPress={() => onIncrease(item)} disabled={updating} activeOpacity={0.7}>
          <Feather name="plus" size={14} color="#1a1a1a" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
));

const PackCartRow = React.memo(({
  group, onIncrease, onDecrease, onRemove, updating,
}: {
  group: PackGroup;
  onIncrease: (g: PackGroup) => void;
  onDecrease: (g: PackGroup) => void;
  onRemove: (g: PackGroup) => void;
  updating: boolean;
}) => (

  <View style={styles.itemCardPack}>
    <View style={styles.itemImageBox}>
      {group.image_url ? (
        <Image
          source={{ uri: group.image_url }}
          style={styles.itemImage}
          contentFit="contain"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={group.packId}
        />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <Feather name="package" size={24} color="#E0E0E0" />
        </View>
      )}
    </View>
    <View style={styles.itemInfo}>
      <View style={styles.packBadge}>
        <Feather name="package" size={10} color={RED} />
        <Text style={styles.packBadgeText}>Pack</Text>
      </View>
      <Text style={styles.itemName} numberOfLines={2}>{group.name_fr}</Text>
      <Text style={styles.itemSub} numberOfLines={1}>
        {group.items.length} article{group.items.length > 1 ? 's' : ''}
      </Text>
      <Text style={styles.itemPrice}>{group.subtotal.toFixed(2)} MAD</Text>
    </View>
    <View style={styles.itemActions}>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onRemove(group)} activeOpacity={0.7}>
        <Feather name="trash-2" size={16} color={RED} />
      </TouchableOpacity>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onDecrease(group)} disabled={updating} activeOpacity={0.7}>
          <Feather name="minus" size={14} color="#1a1a1a" />
        </TouchableOpacity>
        {updating
          ? <ActivityIndicator size="small" color={RED} style={{ width: 24 }} />
          : <Text style={styles.qtyText}>{group.bundleQty}</Text>
        }
        <TouchableOpacity style={styles.qtyBtnPlus} onPress={() => onIncrease(group)} disabled={updating} activeOpacity={0.7}>
          <Feather name="plus" size={14} color="#1a1a1a" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
));

export default function CartScreen() {
  const router = useRouter();
  const { applyCart } = useCartActions();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });

  const [cart, setCart]             = useState<Cart>({ items: [], total: 0, count: 0 });
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const setCartAndSync = useCallback((c: Cart) => {
    setCart(c);
    applyCart(c);
  }, [applyCart]);

  const loadCart = async () => {
    try { setCartAndSync(stableCart(await CartService.getCart())); }
    catch (err: any) {  }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadCart(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadCart(); }, []);

  const handleIncrease = useCallback(async (item: CartItem) => {
    setUpdatingId(item.id);
    try { setCartAndSync(stableCart(await CartService.updateItem(item.id, item.quantity + 1))); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  }, [setCartAndSync]);

  const handleDecrease = useCallback(async (item: CartItem) => {
    if (item.quantity <= 1) { setDeleteTarget({ kind: 'item', item }); return; }
    setUpdatingId(item.id);
    try { setCartAndSync(stableCart(await CartService.updateItem(item.id, item.quantity - 1))); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  }, [setCartAndSync]);

  const handlePackIncrease = useCallback(async (group: PackGroup) => {
    const id = `pack-${group.packId}`;
    setUpdatingId(id);
    try { setCartAndSync(stableCart(await CartService.updatePackQuantity(group.packId, group.bundleQty + 1))); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  }, [setCartAndSync]);

  const handlePackDecrease = useCallback(async (group: PackGroup) => {
    if (group.bundleQty <= 1) { setDeleteTarget({ kind: 'pack', packId: group.packId, name_fr: group.name_fr }); return; }
    const id = `pack-${group.packId}`;
    setUpdatingId(id);
    try { setCartAndSync(stableCart(await CartService.updatePackQuantity(group.packId, group.bundleQty - 1))); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  }, [setCartAndSync]);

  const handleRemoveItemPress = useCallback((item: CartItem) => {
    setDeleteTarget({ kind: 'item', item });
  }, []);

  const handleRemovePackPress = useCallback((group: PackGroup) => {
    setDeleteTarget({ kind: 'pack', packId: group.packId, name_fr: group.name_fr });
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);

    if (target.kind === 'clearAll') {
      setLoading(true);
      try {
        setCartAndSync(stableCart(await CartService.clearCart()));
      } catch (err: any) {
        Alert.alert('Erreur', err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const id = target.kind === 'pack' ? `pack-${target.packId}` : target.item.id;
    setUpdatingId(id);
    try {
      const updated = target.kind === 'pack'
        ? await CartService.removePack(target.packId)
        : await CartService.removeItem(target.item.id);
      setCartAndSync(stableCart(updated));
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setUpdatingId(null);
    }
  }, [deleteTarget, setCartAndSync]);

  const handleClearAll = () => {
    setDeleteTarget({ kind: 'clearAll' });
  };

    const listEntries = useMemo(() => buildListEntries(cart.items), [cart.items]);

    const renderItem = useCallback(({ item: entry }: { item: ListEntry }) => {
  return entry.type === 'pack' ? (
    <PackCartRow
      group={entry}
      updating={updatingId === `pack-${entry.packId}`}
      onIncrease={handlePackIncrease}
      onDecrease={handlePackDecrease}
      onRemove={handleRemovePackPress}
    />
  ) : (
    <CartItemRow
      item={entry.item}
      updating={updatingId === entry.item.id}
      onIncrease={handleIncrease}
      onDecrease={handleDecrease}
      onRemove={handleRemoveItemPress}
    />
  );
}, [updatingId, handleIncrease, handleDecrease, handlePackIncrease, handlePackDecrease, handleRemoveItemPress, handleRemovePackPress]);


  if (!fontsLoaded) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={RED} /></View>;
  }


  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <PageHeader title="Mon panier" rightIcon="trash-2" onRightPress={handleClearAll} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
        </View>

      ) : cart.items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyBadge}>
            <Feather name="star" size={14} color={RED} />
            <Text style={styles.emptyBadgeText}>Prêt pour votre prochaine commande</Text>
          </View>
          <Image source={require('../../../assets/images/app/emptyCart.png')} style={styles.emptyImage} contentFit="contain" />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez des produits pour commencer votre commande et retrouvez ici tous vos articles favoris.
          </Text>
          <TouchableOpacity style={styles.btnExplore} onPress={() => router.push('/main/main_nav/home' as any)} activeOpacity={0.85}>
            <Feather name="shopping-bag" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnExploreText}>Découvrir les produits</Text>
          </TouchableOpacity>
        </View>

      ) : (
        <View style={styles.flex}>
          <FlatList
  data={listEntries}
  extraData={updatingId}
  keyExtractor={(entry) =>
    entry.type === 'pack'
      ? `pack-${entry.packId}`
      : entry.item.id
  }
  contentContainerStyle={styles.list}
  showsVerticalScrollIndicator={false}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={RED}
    />
  }
  renderItem={renderItem}
  getItemLayout={(data, index) => {
    let offset = 0;
    for (let i = 0; i < index; i++) offset += getEntryRowHeight(data![i]);
    return { length: getEntryRowHeight(data![index]), offset, index };
  }}

  removeClippedSubviews
  initialNumToRender={8}
  maxToRenderPerBatch={8}
  windowSize={7}
/>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SOUS-TOTAL</Text>
              <Text style={styles.summaryValue}>{cart.total.toFixed(2)} DH</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>LIVRAISON</Text>
              <Text style={[styles.summaryValue, { color: '#9CA3AF', fontSize: 14 }]}>Calculée au checkout</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{cart.total.toFixed(2)} DH</Text>
            </View>
            <TouchableOpacity
              style={styles.btnCheckout}
              activeOpacity={0.85}
              onPress={() => {
                const cart_items = cart.items.map((item) => ({
                  sku_code:   item.sku_id ?? item.article?.sku_code,
                  qty:        item.quantity,
                  unit_price: item.article.price_ttc,
                  vat_rate:   item.article.vat_rate,
                  pack_id:    item.pack?.id ?? null,
                }));
                console.log(JSON.stringify(cart_items))
                router.push({
                  pathname: '/order/delivery_type' as any,
                  params: { cart_items: JSON.stringify(cart_items) },
                });
              }}
            >
              <Text style={styles.btnCheckoutText}>Passer la commande</Text>
              <View style={styles.btnCheckoutArrow}>
                <Feather name="chevron-right" size={18} color='#ffff' />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ConfirmDeleteModal
        visible={!!deleteTarget}
        target={deleteTarget}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  flex:     { flex: 1 },

  list: { padding: 16, gap: 12, paddingBottom: 24 },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  itemCardPack: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#FFD9D9',
  },
  itemImageBox:         { width: 72, height: 72, borderRadius: 12, backgroundColor: '#ffffff', overflow: 'hidden' },
  itemImage:            { width: '100%', height: '100%' },
  itemImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInfo:             { flex: 1 },
  itemName:             { fontSize: 14, color: '#1a1a1a', marginBottom: 2, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  itemSub:              { fontSize: 11, color: '#9CA3AF', marginBottom: 6, fontFamily: 'Inter_400Regular' },
  packBadge:            { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FFF0F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  packBadgeText:        { fontSize: 10, color: RED, fontFamily: 'Inter_600SemiBold' },
  priceCol:      { gap: 2 },
  oldPriceRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceRow:             { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemPrice:            { fontSize: 15, color: RED, fontFamily: 'Inter_800ExtraBold' },
  itemOldPrice:         { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through' },
  discountBadge:        { backgroundColor: '#FFF0F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText:    { fontSize: 10, color: RED, fontFamily: 'Inter_700Bold' },
  itemActions:          { alignItems: 'flex-end', gap: 8 },
  deleteBtn:            { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  qtyRow:               { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn:               { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyBtnPlus:           { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyText:              { fontSize: 15, color: '#1a1a1a', minWidth: 20, textAlign: 'center', fontFamily: 'Inter_700Bold' },

  summary: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
    minHeight: CARD_HEIGHT,
    justifyContent: 'flex-start',
    paddingTop: 28, paddingBottom: 24,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryLabel: { fontSize: 14, color: '#8E8E93', letterSpacing: 0.5, fontFamily: 'Inter_600SemiBold' },
  summaryValue: { fontSize: 16, color: '#1A1A1A', fontFamily: 'Inter_700Bold' },
  divider:      { height: 1, backgroundColor: '#F0F0F0', marginBottom: 16 },
  totalLabel:   { fontSize: 18, color: '#1a1a1a', fontFamily: 'Inter_700Bold' },
  totalValue:   { fontSize: 22, color: RED, fontFamily: 'Inter_800ExtraBold' },
  btnCheckout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: RED, borderRadius: 24, paddingVertical: 18, marginTop: 16,
    shadowColor: RED, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnCheckoutText:  { color: '#fff', fontSize: 16, flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  btnCheckoutArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF33', alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 16 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#fff' },
  emptyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0F0', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 24 },
  emptyBadgeText: { fontSize: 12, color: RED, fontFamily: 'Inter_600SemiBold' },
  emptyImage: { width: width * 0.65, height: width * 0.65, marginBottom: 28 },
  emptyTitle:    { fontSize: 22, color: '#1a1a1a', marginBottom: 12, textAlign: 'center', fontFamily: 'Inter_800ExtraBold' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, marginBottom: 36, fontFamily: 'Inter_400Regular' },
  btnExplore: { flexDirection: 'row', alignItems: 'center', backgroundColor: RED, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 32, shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnExploreText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },

  modalOverlay: { flex: 1,  justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40, alignItems: 'center',
    minHeight: CARD_HEIGHT,
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  modalTitle:           { fontSize: 22, color: '#1a1a1a', marginBottom: 10, textAlign: 'center', fontFamily: 'Inter_800ExtraBold' },
  modalSubtitle:        { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 28, fontFamily: 'Inter_400Regular' },
  btnConfirmDelete:     { width: '100%', paddingVertical: 16, borderRadius: 24, backgroundColor: RED, alignItems: 'center', marginBottom: 12, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnConfirmDeleteText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnCancel:            { paddingVertical: 12 },
  btnCancelText:        { fontSize: 15, color: '#1a1a1a', fontFamily: 'Inter_600SemiBold' },
});