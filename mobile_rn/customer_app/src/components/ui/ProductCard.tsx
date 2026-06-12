import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, Dimensions, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Article } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';

const RED = '#E10600';
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface ProductCardProps {
  article:      Article;
  onPress?:     () => void;
  onAddToCart?: () => void;
  discount?:    number;
}

export default function ProductCard({
  article, onPress, onAddToCart, discount,
}: ProductCardProps) {

  const [isFavorite, setIsFavorite]     = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // ─── Add to cart ───────────────────────────────────────────────────────────
  const handleAddToCart = async () => {
    if (onAddToCart) {
      onAddToCart();
      return;
    }
    if (!article.sku_id) {
      Alert.alert('Indisponible', 'Ce produit n\'est pas disponible à la commande.');
      return;
    }
    try {
      setAddingToCart(true);
      await CartService.addItem(article.sku_id, 1);
      Alert.alert('✓ Ajouté', `${article.name_fr} ajouté au panier`);
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Erreur lors de l\'ajout au panier');
    } finally {
      setAddingToCart(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>

      {/* ── Image ── */}
      <View style={styles.imageContainer}>
        {article.image_url ? (
          <Image source={{ uri: article.image_url }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={32} color="#D0D0D0" />
          </View>
        )}

        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}

        {/* Favorite button */}
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => setIsFavorite(!isFavorite)}
          activeOpacity={0.8}
        >
          <Feather name="heart" size={16} color={isFavorite ? RED : '#9CA3AF'} />
        </TouchableOpacity>
      </View>

      {/* ── Info ── */}
      <View style={styles.info}>
        {/* Nom complet */}
        <Text style={styles.name} numberOfLines={2}>{article.name_fr}</Text>

        {/* Marque */}
        {article.brand && (
          <Text style={styles.brand} numberOfLines={1}>{article.brand.name_fr}</Text>
        )}

        {/* Price + Add button */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{article.price_ttc.toFixed(1)} MAD</Text>
          <TouchableOpacity
            style={[styles.addBtn, addingToCart && { opacity: 0.6 }]}
            onPress={handleAddToCart}
            disabled={addingToCart}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  // ── Image ──────────────────────────────────────────────────────────────────
  imageContainer: {
    width: '100%', height: 130,
    backgroundColor: '#fff',
    position: 'relative',
  },
  image:            { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9F9F9',
  },

  // ── Badges ─────────────────────────────────────────────────────────────────
  discountBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: RED, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  discountText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },

  favoriteBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 5, elevation: 3,
  },

  // ── Info ───────────────────────────────────────────────────────────────────
  info:   { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  name:   { fontSize: 14, color: '#1a1a1a', fontFamily: 'Inter_700Bold', marginBottom: 3, lineHeight: 18 },
  brand:  { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginBottom: 10 },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price:    { fontSize: 16, color: '#E10600', fontFamily: 'Inter_700Bold' },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
});