import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Image, ScrollView, ActivityIndicator,
  Dimensions, Platform, Alert, FlatList, NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { CatalogService, Article } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { ProfileService } from '../../services/profile.service';
import { useCart } from '../../context/CartContext';

const { width, height } = Dimensions.get('window');
const RED    = '#E10600';
const IMG_H  = height * 0.42;

// ── Image carousel ─────────────────────────────────────────────────────────────
function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x   = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / width);
    setIndex(idx);
  };

  if (!images.length) {
    return (
      <View style={[styles.heroContainer, styles.heroPlaceholder]}>
        <Feather name="image" size={64} color="#D0C9BF" />
      </View>
    );
  }

  return (
    <View style={styles.heroContainer}>
      <FlatList
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={styles.heroImage} resizeMode="cover" />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Similar product card ────────────────────────────────────────────────────────
function SimilarCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: any) => {
    e.stopPropagation?.();
    if (!article.sku_id) return;
    try {
      setAdding(true);
      await CartService.addItem(article.sku_id, 1);
    } catch {}
    finally { setAdding(false); }
  };

  return (
    <TouchableOpacity style={styles.simCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.simImgWrap}>
        {article.image_url
          ? <Image source={{ uri: article.image_url }} style={styles.simImg} resizeMode="contain" />
          : <Feather name="image" size={28} color="#D0D0D0" />}
      </View>
      <Text style={styles.simName} numberOfLines={2}>{article.name_fr}</Text>
      <View style={styles.simBottom}>
        <Text style={styles.simPrice}>{article.price_ttc.toFixed(0)} DH</Text>
        <TouchableOpacity
          style={[styles.simAddBtn, adding && { opacity: 0.6 }]}
          onPress={handleAdd} disabled={adding}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="plus" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const router = useRouter();
  const { article_id } = useLocalSearchParams<{ article_id: string }>();

  const [article,  setArticle]  = useState<Article | null>(null);
  const [similar,  setSimilar]  = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [wished,   setWished]   = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [toggling, setToggling] = useState(false);
  const { refreshCartCount } = useCart();

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const id  = Number(article_id);
        const art = await CatalogService.getArticleDetail(id);
        setArticle(art);
        if (art.category?.id) {
          const res = await CatalogService.getArticlesByCategory(art.category.id, { limit: 8 });
          setSimilar(res.data.filter(a => a.id !== id).slice(0, 8));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [article_id]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.centered}>
        <Feather name="alert-circle" size={48} color="#E0E0E0" />
        <Text style={{ color: '#9CA3AF', marginTop: 12, fontFamily: 'Inter_500Medium' }}>Produit introuvable</Text>
      </View>
    );
  }

  const images  = article.images?.length ? article.images : (article.image_url ? [article.image_url] : []);
  const total   = (article.price_ttc * quantity).toFixed(2);

  const handleAddToCart = async () => {
    if (!article.sku_id) {
      Alert.alert('Indisponible', "Ce produit n'est pas disponible à la commande.");
      return;
    }
    try {
      setAdding(true);
      await CartService.addItem(article.sku_id, quantity);
      await refreshCartCount();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || "Erreur lors de l'ajout au panier");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleWish = async () => {
    if (toggling) return;
    setToggling(true);
    const next = !wished;
    setWished(next);
    try {
      if (next) await ProfileService.addFavorite(article.id);
      else      await ProfileService.removeFavorite(article.id);
    } catch {
      setWished(!next);
    } finally {
      setToggling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Image carousel ── */}
        <View>
          <ImageCarousel images={images} />

          {/* Overlay buttons */}
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <Feather name="chevron-left" size={22} color="#1a1a1a" />
            </TouchableOpacity>
            <View style={styles.heroRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <Feather name="share-2" size={18} color="#1a1a1a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleToggleWish}>
                <Feather name="heart" size={18} color={wished ? RED : '#1a1a1a'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Info sheet ── */}
        <View style={styles.sheet}>

          {/* Category + rating */}
          <View style={styles.topRow}>
            <Text style={styles.category}>
              {article.category?.name_fr?.toUpperCase() ?? ''}
            </Text>
            <View style={styles.ratingBadge}>
              <Feather name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.name}>{article.name_fr}</Text>

          {/* Price + quantity */}
          <View style={styles.priceQtyRow}>
            <View>
              <Text style={styles.price}>{article.price_ttc.toFixed(0)} DH</Text>
              {article.unit_sale && article.unit_sale !== 'unit' && (
                <Text style={styles.unit}>/ {article.unit_sale}</Text>
              )}
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
              >
                <Feather name="minus" size={16} color={quantity <= 1 ? '#D1D5DB' : '#1a1a1a'} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => q + 1)}>
                <Feather name="plus" size={16} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          {!!article.description_fr && (
            <>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{article.description_fr}</Text>
            </>
          )}

          {/* Badges Qualité + Stock */}
          <View style={styles.badgesRow}>
            <View style={[styles.infoBadge, { borderColor: '#D1FAE5' }]}>
              <View style={[styles.badgeIcon, { backgroundColor: '#D1FAE5' }]}>
                <Feather name="check-circle" size={14} color="#059669" />
              </View>
              <View>
                <Text style={[styles.badgeTitle, { color: '#059669' }]}>Qualité</Text>
                <Text style={styles.badgeSub}>Fraîche</Text>
              </View>
            </View>
            <View style={[styles.infoBadge, { borderColor: '#E5E7EB' }]}>
              <View style={[styles.badgeIcon, { backgroundColor: '#F3F4F6' }]}>
                <Feather name="package" size={14} color="#6B7280" />
              </View>
              <View>
                <Text style={[styles.badgeTitle, { color: '#6B7280' }]}>Stock</Text>
                <Text style={styles.badgeSub}>Disponible</Text>
              </View>
            </View>
          </View>

          {/* Produits similaires */}
          {similar.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Produits similaires</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {similar.map(sim => (
                  <SimilarCard
                    key={sim.id}
                    article={sim}
                    onPress={() => router.push({ pathname: '/main/product-detail' as any, params: { article_id: sim.id } })}
                  />
                ))}
              </ScrollView>
            </>
          )}

        </View>
      </ScrollView>

      {/* ── Footer sticky ── */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>TOTAL</Text>
          <Text style={styles.footerTotal}>{total} DH</Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBtn, adding && { opacity: 0.7 }]}
          onPress={handleAddToCart}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding
            ? <ActivityIndicator color="#fff" />
            : <>
                <Feather name="shopping-cart" size={18} color="#fff" />
                <Text style={styles.cartBtnText}>Ajouter au panier</Text>
              </>}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },

  // ── Carousel ──
  heroContainer:   { width, height: IMG_H, backgroundColor: '#F5F5F5' },
  heroImage:       { width, height: IMG_H },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    position: 'absolute', bottom: 14,
    flexDirection: 'row', alignSelf: 'center', gap: 6,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { width: 18, backgroundColor: RED },

  // ── Overlay buttons ──
  heroButtons: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 40,
    left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },

  // ── Sheet ──
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20, paddingTop: 24,
  },

  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  category:    { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF', letterSpacing: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  ratingText:  { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#F59E0B' },

  name:  { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginBottom: 14, lineHeight: 30 },

  priceQtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  price:       { fontSize: 28, fontFamily: 'Poppins_700Bold', color: RED },
  unit:        { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },

  qtyRow:        { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn:        { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled:{ borderColor: '#F3F4F6' },
  qtyValue:      { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', minWidth: 24, textAlign: 'center' },

  sectionLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 8, marginTop: 4 },
  description:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20, marginBottom: 20 },

  // Badges
  badgesRow:  { flexDirection: 'row', gap: 12, marginBottom: 24 },
  infoBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14, padding: 12,
  },
  badgeIcon:  { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  badgeSub:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  // Similar cards
  simCard: {
    width: 120, backgroundColor: '#fff', borderRadius: 14,
    padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  simImgWrap: { width: '100%', height: 80, borderRadius: 10, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  simImg:     { width: '100%', height: '100%' },
  simName:    { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#1a1a1a', marginBottom: 8, lineHeight: 15 },
  simBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  simPrice:   { fontSize: 13, fontFamily: 'Poppins_700Bold', color: RED },
  simAddBtn: {
    width: 26, height: 26, borderRadius: 8, backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
  },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10,
  },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotal: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },
  cartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: RED, borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  cartBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
