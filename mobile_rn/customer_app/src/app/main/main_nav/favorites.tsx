import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, FlatList,
  ActivityIndicator, RefreshControl, Image, Alert, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import PageHeader from '../../../components/ui/PageHeader';
import { ProfileService, FavoriteArticle } from '../../../services/profile.service';
import { CartService } from '../../../services/cart.service';
import { useCartActions } from '../../../context/CartContext';


const RED = '#E10600';

function FavCard({
  item,
  onRemove,
  onPress,
}: {
  item: FavoriteArticle;
  onRemove: () => void;
  onPress: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const { applyCart } = useCartActions();

  const handleAddToCart = async () => {
    if (!item.sku_id) {
      Alert.alert('Indisponible', 'Ce produit n\'est pas disponible à la commande.');
      return;
    }
    try {
      setAdding(true);
      const cart = await CartService.addItem(item.sku_id, 1);
      applyCart(cart);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Erreur lors de l\'ajout au panier');
    } finally {
      setAdding(false);
    }
  };
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      <View style={styles.imgWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.img} resizeMode="contain" />
        ) : (
          <View style={styles.imgPlaceholder}>
            <Feather name="image" size={28} color="#D1D5DB" />
          </View>
        )}
        {item.discount_pct != null && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{item.discount_pct}%</Text>
          </View>
        )} 
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.name_fr}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price_ttc.toFixed(2)} DH</Text>
          {item.old_price_ttc != null && item.old_price_ttc > item.price_ttc && (
            <Text style={styles.oldPrice}>{item.old_price_ttc.toFixed(2)} DH</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Retirer favori */}
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} activeOpacity={0.7}>
          <Feather name="heart" size={18} color={RED} />
        </TouchableOpacity>

        {/* Ajouter au panier */}
        <TouchableOpacity
          style={[styles.cartBtn, adding && { opacity: 0.6 }]}
          onPress={handleAddToCart}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="shopping-cart" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

//Modal de confirmation de suppression
function RemoveFavoriteModal({
  visible, itemName, onConfirm, onCancel,
}: {
  visible: boolean;
  itemName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Retirer des favoris ?</Text>
          <Text style={styles.modalSubtitle}>
            Êtes-vous sûr de vouloir retirer "{itemName}" de vos favoris ?
          </Text>
          <TouchableOpacity style={styles.btnConfirmDelete} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={styles.btnConfirmDeleteText}>Retirer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function FavoritesScreen() {
  const router = useRouter();
  const [items, setItems]         = useState<FavoriteArticle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FavoriteArticle | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await ProfileService.listFavorites();
      setItems(data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRemove = (item: FavoriteArticle) => {
    setRemoveTarget(item);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await ProfileService.removeFavorite(removeTarget.id);
      setItems(prev => prev.filter(i => i.id !== removeTarget.id));
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setRemoveTarget(null);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <PageHeader title="Mes favoris" />

        {loading ? (
          <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="heart" size={52} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptySubtitle}>Ajoutez des produits à vos favoris en appuyant sur ♡</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/main/home' as any)}>
              <Text style={styles.emptyBtnText}>Découvrir des produits</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <FavCard
                item={item}
                onRemove={() => handleRemove(item)}
                onPress={() => router.push({ pathname: '/main/product-detail' as any, params: { article_id: item.id } })}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[RED]} tintColor={RED} />
            }
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>

      <RemoveFavoriteModal
        visible={removeTarget !== null}
        itemName={removeTarget?.name_fr ?? null}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  list:      { paddingBottom: 32, paddingTop: 8 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },

  imgWrap:       { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', position: 'relative' },
  img:           { width: '100%', height: '100%' },
  imgPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  discountBadge:     { position: 'absolute', top: 6, left: 6, backgroundColor: RED, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  info:    { flex: 1 },
  name:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', lineHeight: 20, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  price:    { fontSize: 16, fontFamily: 'Poppins_700Bold', color: RED },
  oldPrice: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textDecorationLine: 'line-through' },

  actions:   { gap: 8 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center',
  },
  cartBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },

  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle:    { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginTop: 8 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 16, backgroundColor: RED, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  modalOverlay: { flex: 1,  justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40, alignItems: 'center',
    minHeight: 320,
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