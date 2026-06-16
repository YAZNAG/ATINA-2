import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Image, Modal,
  ActivityIndicator, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import BottomNavBar from '../../components/ui/BottomNavBar';
import PageHeader   from '../../components/ui/PageHeader';
import { CartService, CartItem, Cart } from '../../services/cart.service';

const RED = '#E10600';
const { width } = Dimensions.get('window');


const ConfirmDeleteModal = ({
  visible, onConfirm, onCancel,
}: {
  visible: boolean; onConfirm: () => void; onCancel: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
    <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Supprimer l'article ?</Text>
        <Text style={styles.modalSubtitle}>
          Êtes-vous sûr de vouloir supprimer cet article de votre panier ?
        </Text>
        <TouchableOpacity style={styles.btnConfirmDelete} onPress={onConfirm} activeOpacity={0.85}>
          <Text style={styles.btnConfirmDeleteText}>Supprimer l'article</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.btnCancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);


const CartItemRow = ({
  item, onIncrease, onDecrease, onRemove, updating,
}: {
  item: CartItem; onIncrease: () => void; onDecrease: () => void;
  onRemove: () => void; updating: boolean;
}) => (
  <View style={styles.itemCard}>
    <View style={styles.itemImageBox}>
      {item.article.image_url ? (
        <Image source={{ uri: item.article.image_url }} style={styles.itemImage} resizeMode="contain" />
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
      <Text style={styles.itemPrice}>{item.article.price_ttc.toFixed(2)} MAD</Text>
    </View>
    <View style={styles.itemActions}>
      <TouchableOpacity style={styles.deleteBtn} onPress={onRemove} activeOpacity={0.7}>
        <Feather name="trash-2" size={16} color={RED} />
      </TouchableOpacity>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onDecrease} disabled={updating} activeOpacity={0.7}>
          <Feather name="minus" size={14} color="#1a1a1a" />
        </TouchableOpacity>
        {updating
          ? <ActivityIndicator size="small" color={RED} style={{ width: 24 }} />
          : <Text style={styles.qtyText}>{item.quantity}</Text>
        }
        <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={onIncrease} disabled={updating} activeOpacity={0.7}>
          <Feather name="plus" size={14} color="#1a1a1a" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default function CartScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });

  const [cart, setCart]             = useState<Cart>({ items: [], total: 0, count: 0 });
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<CartItem | null>(null);

  const loadCart = async () => {
    try { setCart(await CartService.getCart()); }
    catch (err: any) { console.log('Error loading cart:', err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadCart(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadCart(); }, []);

  const handleIncrease = async (item: CartItem) => {
    setUpdatingId(item.id);
    try { setCart(await CartService.updateItem(item.sku_id, item.quantity + 1)); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  };

  const handleDecrease = async (item: CartItem) => {
    if (item.quantity <= 1) { setDeleteItem(item); return; }
    setUpdatingId(item.id);
    try { setCart(await CartService.updateItem(item.sku_id, item.quantity - 1)); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  };

  const handleRemoveConfirm = async () => {
    if (!deleteItem) return;
    const item = deleteItem;
    setDeleteItem(null);
    setUpdatingId(item.id);
    try { setCart(await CartService.removeItem(item.sku_id)); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
    finally { setUpdatingId(null); }
  };

  const handleClearAll = () =>
    Alert.alert('Vider le panier', 'Voulez-vous supprimer tous les articles ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: async () => {
        try { setCart(await CartService.clearCart()); }
        catch (err: any) { Alert.alert('Erreur', err.message); }
      }},
    ]);

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
          <Image source={require('../../../assets/images/app/emptyCart.png')} style={styles.emptyImage} resizeMode="contain" />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez des produits pour commencer votre commande et retrouvez ici tous vos articles favoris.
          </Text>
          <TouchableOpacity style={styles.btnExplore} onPress={() => router.push('/main/home' as any)} activeOpacity={0.85}>
            <Feather name="shopping-bag" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnExploreText}>Découvrir les produits</Text>
          </TouchableOpacity>
        </View>

      ) : (
        <View style={styles.flex}>
          <FlatList
            data={cart.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
            renderItem={({ item }) => (
              <CartItemRow
                item={item}
                updating={updatingId === item.id}
                onIncrease={() => handleIncrease(item)}
                onDecrease={() => handleDecrease(item)}
                onRemove={() => setDeleteItem(item)}
              />
            )}
          />

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SOUS-TOTAL</Text>
              <Text style={styles.summaryValue}>{cart.total.toFixed(2)} DH</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>LIVRAISON</Text>
              <Text style={[styles.summaryValue, { color: '#22C55E' }]}>Gratuit</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{cart.total.toFixed(2)} DH</Text>
            </View>
            <TouchableOpacity style={styles.btnCheckout} activeOpacity={0.85} onPress={() => router.push('/../order/delivery_type' as any)}>
              <Text style={styles.btnCheckoutText}>Passer la commande</Text>
              <View style={styles.btnCheckoutArrow}>
                <Feather name="chevron-right" size={18} color={RED} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <BottomNavBar />

      <ConfirmDeleteModal
        visible={!!deleteItem}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setDeleteItem(null)}
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
  itemImageBox:         { width: 72, height: 72, borderRadius: 12, backgroundColor: '#F5F5F5', overflow: 'hidden' },
  itemImage:            { width: '100%', height: '100%' },
  itemImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInfo:             { flex: 1 },
  itemName:             { fontSize: 14, color: '#1a1a1a', marginBottom: 2, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  itemSub:              { fontSize: 11, color: '#9CA3AF', marginBottom: 6, fontFamily: 'Inter_400Regular' },
  itemPrice:            { fontSize: 15, color: RED, fontFamily: 'Inter_800ExtraBold' },
  itemActions:          { alignItems: 'flex-end', gap: 8 },
  deleteBtn:            { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  qtyRow:               { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn:               { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyBtnPlus:           { backgroundColor: '#fff'},
  qtyText:              { fontSize: 15, color: '#1a1a1a', minWidth: 20, textAlign: 'center', fontFamily: 'Inter_700Bold' },

  summary: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 12, color: '#9CA3AF', letterSpacing: 0.5, fontFamily: 'Inter_600SemiBold' },
  summaryValue: { fontSize: 14, color: '#1a1a1a', fontFamily: 'Inter_600SemiBold' },
  divider:      { height: 1, backgroundColor: '#F0F0F0', marginBottom: 12 },
  totalLabel:   { fontSize: 16, color: '#1a1a1a', fontFamily: 'Inter_700Bold' },
  totalValue:   { fontSize: 20, color: RED, fontFamily: 'Inter_800ExtraBold' },
  btnCheckout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: RED, borderRadius: 50, paddingVertical: 18, marginTop: 16,
    shadowColor: RED, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnCheckoutText:  { color: '#fff', fontSize: 16, flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  btnCheckoutArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 16 },

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
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, alignItems: 'center', },
  modalTitle:           { fontSize: 22, color: '#1a1a1a', marginBottom: 10, textAlign: 'center', fontFamily: 'Inter_800ExtraBold' },
  modalSubtitle:        { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 28, fontFamily: 'Inter_400Regular' },
  btnConfirmDelete:     { width: '100%', paddingVertical: 16, borderRadius: 50, backgroundColor: RED, alignItems: 'center', marginBottom: 12, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnConfirmDeleteText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnCancel:            { paddingVertical: 12 },
  btnCancelText:        { fontSize: 15, color: '#1a1a1a', fontFamily: 'Inter_600SemiBold' },
});