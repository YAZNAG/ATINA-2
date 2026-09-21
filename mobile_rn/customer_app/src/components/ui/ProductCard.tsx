import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Article } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { useCartActions } from '../../context/CartContext';
import { t } from '../../i18n';

const RED = '#E10600';
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface ProductCardProps {
  article:      Article;
  onPress?:     () => void;
  onAddToCart?: () => void;
  discount?:    number;
  oldPrice?:    number;
  isFlashSale?: boolean;
  /** Fin de la vente flash : affiche le compte à rebours de la maquette. */
  endsAt?:      string | null;
  /** Largeur imposée (grilles à 2 colonnes, carrousels). */
  width?:       number;
}

function remaining(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!(ms > 0)) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Compte à rebours hh:mm:ss d'une vente flash (disparaît à l'échéance). */
function Countdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState(() => remaining(endsAt));
  useEffect(() => {
    const id = setInterval(() => setLeft(remaining(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!left) return null;
  return (
    <View style={styles.countdown}>
      <Text style={styles.countdownText}>{left}</Text>
    </View>
  );
}

const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} MAD`;

function ProductCard({
  article, onPress, onAddToCart, discount, oldPrice, isFlashSale = false, endsAt, width: cardWidth,
}: ProductCardProps) {
  const [addingToCart, setAddingToCart] = useState(false);
  const { applyCart } = useCartActions();

  const effectiveDiscount = discount ?? article.discount_pct ?? undefined;
  const effectiveOldPrice = oldPrice ?? article.old_price_ttc ?? undefined;

  const handleAddToCart = useCallback(async () => {
    if (onAddToCart) {
      onAddToCart();
      return;
    }
    if (!article.sku_id) {
      Alert.alert(t('Indisponible'), t('Ce produit n\'est pas disponible à la commande.'));
      return;
    }
    try {
      setAddingToCart(true);
      const cart = await CartService.addItem(article.sku_id, 1);
      applyCart(cart);
    } catch (err: any) {
      Alert.alert(t('Erreur'), err.message || t('Erreur lors de l\'ajout au panier'));
    } finally {
      setAddingToCart(false);
    }
  }, [onAddToCart, article.sku_id, applyCart]);

  const flashEnd = endsAt ?? article.flash_ends_at ?? null;
  const showOld = effectiveOldPrice != null && effectiveOldPrice > article.price_ttc;

  return (
    <TouchableOpacity style={[styles.card, cardWidth ? { width: cardWidth } : null]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {article.image_url ? (
          <Image
            source={{ uri: article.image_url }}
            style={styles.image}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={String(article.id)}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={32} color="#D0D0D0" />
          </View>
        )}

        <View style={styles.badges}>
          {!!effectiveDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{effectiveDiscount}%</Text>
            </View>
          )}
          {!!flashEnd && <Countdown endsAt={flashEnd} />}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{article.name_fr}</Text>
        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.price}>{fmt(article.price_ttc)}</Text>
            {showOld && <Text style={styles.oldPrice}>{fmt(Number(effectiveOldPrice))}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, addingToCart && { opacity: 0.6 }]}
            onPress={handleAddToCart}
            disabled={addingToCart}
            activeOpacity={0.85}
            accessibilityLabel={t('Ajouter au panier')}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: { width: '100%', height: 128, backgroundColor: '#fff', paddingTop: 8 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9F9F9',
  },
  badges: {
    position: 'absolute', top: 8, left: 8, right: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  discountBadge: { backgroundColor: '#FFD400', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: '#0A0A0A', fontSize: 10.5, fontFamily: 'Inter_700Bold' },
  countdown: {
    marginLeft: 'auto', borderWidth: 1, borderColor: RED, backgroundColor: '#FFF4F4',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
  },
  countdownText: { color: RED, fontSize: 11, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  info: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  name: { fontSize: 13, color: '#1a1a1a', fontFamily: 'Inter_700Bold', marginBottom: 4, lineHeight: 17, minHeight: 34 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 15, color: RED, fontFamily: 'Inter_800ExtraBold' },
  oldPrice: { fontSize: 11.5, color: '#8A8A8A', fontFamily: 'Inter_500Medium', textDecorationLine: 'line-through', marginTop: 1 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
});
