import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, FlatList,
  ActivityIndicator, RefreshControl, Image, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import { ProfileService, FavoriteArticle } from '../../services/profile.service';
import { CartService } from '../../services/cart.service';
import BottomNavBar from '@/components/ui/BottomNavBar';
import { useCart } from '../../context/CartContext';


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
  const { refreshCartCount } = useCart();

  const handleAddToCart = async () => {
    if (!item.sku_id) {
      Alert.alert('Indisponible', 'Ce produit n\'est pas disponible à la commande.');
      return;
    }
    try {
      setAdding(true);
      await CartService.addItem(item.sku_id, 1);
      await refreshCartCount();
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

export default function FavoritesScreen() {
  const router = useRouter();
  const [items, setItems]         = useState<FavoriteArticle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRemove = async (item: FavoriteArticle) => {
    Alert.alert(
      'Retirer des favoris',
      `Retirer "${item.name_fr}" de vos favoris ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer', style: 'destructive',
          onPress: async () => {
            try {
              await ProfileService.removeFavorite(item.id);
              setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
            }
          },
        },
      ]
    );
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
      <BottomNavBar />
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
});
