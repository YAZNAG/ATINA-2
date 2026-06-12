import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Image, ScrollView, ActivityIndicator,
  Dimensions, Platform, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CatalogService, Article } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';

const { width, height } = Dimensions.get('window');
const RED   = '#E10600';
const IMG_H = height * 0.42;

export default function ProductDetailScreen() {
  const router = useRouter();
  const { article_id } = useLocalSearchParams<{ article_id: string }>();

  const [article,  setArticle]  = useState<Article | null>(null);
  const [similar,  setSimilar]  = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [wished,   setWished]   = useState(false);
  const [adding,   setAdding]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const id  = Number(article_id);
        const art = await CatalogService.getArticleDetail(id);
        setArticle(art);
        if (art.category?.id) {
          const res = await CatalogService.getArticlesByCategory(art.category.id, { limit: 6 });
          setSimilar(res.data.filter((a) => a.id !== id).slice(0, 6));
        }
      } catch (err) {
        console.log('Error loading product detail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [article_id]);

  const dec = () => setQuantity((q) => Math.max(1, q - 1));
  const inc = () => setQuantity((q) => q + 1);

  const handleAddToCart = async () => {
    if (!article?.sku_id) {
      Alert.alert('Indisponible', 'Ce produit n\'est pas disponible à la commande.');
      return;
    }
    try {
      setAdding(true);
      await CartService.addItem(article.sku_id, quantity);
      Alert.alert(
        '✓ Ajouté au panier',
        `${quantity} × ${article.name_fr}`,
        [
          { text: 'Continuer', style: 'cancel' },
          { text: 'Voir le panier', onPress: () => router.push('/main/cart' as any) },
        ]
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Erreur lors de l\'ajout au panier');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
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
        <Text style={styles.emptyText}>Produit introuvable</Text>
      </View>
    );
  }

  const total = (article.price_ttc * quantity).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Image hero ── */}
      <View style={styles.heroContainer}>
        {article.image_url ? (
          <Image source={{ uri: article.image_url }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Feather name="image" size={64} color="#D0C9BF" />
          </View>
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={styles.heroActionsRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <Feather name="share-2" size={18} color="#1a1a1a" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setWished((w) => !w)}>
              <Feather name="heart" size={18} color={wished ? RED : '#1a1a1a'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Fiche produit ── */}
      <View style={styles.sheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {article.category && (
            <Text style={styles.category}>{article.category.name_fr.toUpperCase()}</Text>
          )}
          <View style={styles.titleRow}>
            <Text style={styles.name}>{article.name_fr}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{article.price_ttc.toFixed(2)} DH</Text>
            {article.unit_sale && <Text style={styles.unit}>/ {article.unit_sale}</Text>}
          </View>

          {/* quantité */}
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={dec}>
              <Feather name="minus" size={16} color={quantity === 1 ? '#D0D0D0' : '#1a1a1a'} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={inc}>
              <Feather name="plus" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {article.description_fr && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{article.description_fr}</Text>
            </View>
          )}

          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Feather name="shield" size={14} color={RED} />
              <View>
                <Text style={styles.badgeLabel}>Qualité</Text>
                <Text style={styles.badgeValue}>Certifiée</Text>
              </View>
            </View>
            <View style={styles.badgeDivider} />
            <View style={styles.badge}>
              <Feather name="clock" size={14} color={RED} />
              <View>
                <Text style={styles.badgeLabel}>Stock</Text>
                <Text style={styles.badgeValue}>{article.is_active ? 'Disponible' : 'Indisponible'}</Text>
              </View>
            </View>
            {article.brand && (
              <>
                <View style={styles.badgeDivider} />
                <View style={styles.badge}>
                  <Feather name="tag" size={14} color={RED} />
                  <View>
                    <Text style={styles.badgeLabel}>Marque</Text>
                    <Text style={styles.badgeValue}>{article.brand.name_fr}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {similar.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Produits similaires</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>
                {similar.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.similarCard}
                    onPress={() => router.replace({ pathname: '/main/product-detail' as any, params: { article_id: item.id } })}
                    activeOpacity={0.8}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.similarImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.similarImage, styles.heroPlaceholder]}>
                        <Feather name="image" size={24} color="#D0C9BF" />
                      </View>
                    )}
                    <Text style={styles.similarName} numberOfLines={2}>{item.name_fr}</Text>
                    <Text style={styles.similarPrice}>{item.price_ttc.toFixed(2)} DH</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>

      {/* ── Footer sticky ── */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>TOTAL</Text>
          <Text style={styles.footerTotal}>{total} DH</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, adding && { opacity: 0.7 }]}
          activeOpacity={0.85}
          onPress={handleAddToCart}
          disabled={adding}
        >
          {adding ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="shopping-cart" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Ajouter au panier</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12 },
  heroContainer: { width, height: IMG_H, position: 'relative' },
  heroImage:     { width: '100%', height: '100%' },
  heroPlaceholder: { backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)' },
  heroActions: { position: 'absolute', top: Platform.OS === 'android' ? 36 : 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroActionsRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  category:  { fontSize: 12, fontWeight: '700', color: RED, letterSpacing: 1, marginBottom: 6 },
  titleRow:  { marginBottom: 6 },
  name:      { fontSize: 22, fontWeight: '800', color: '#1a1a1a', lineHeight: 28 },
  priceRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 16 },
  price:     { fontSize: 20, fontWeight: '700', color: RED },
  unit:      { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  qtyRow:    { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  qtyBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  qtyBtnPlus: { backgroundColor: RED },
  qtyValue:   { fontSize: 17, fontWeight: '700', color: '#1a1a1a', minWidth: 20, textAlign: 'center' },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  description:  { fontSize: 14, color: '#6B7280', lineHeight: 21 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 24, gap: 8 },
  badge:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeDivider: { width: 1, height: 32, backgroundColor: '#FFD5D5' },
  badgeLabel:   { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  badgeValue:   { fontSize: 12, color: '#1a1a1a', fontWeight: '700' },
  similarList: { gap: 12, paddingBottom: 4 },
  similarCard: { width: 110 },
  similarImage: { width: 110, height: 100, borderRadius: 14, backgroundColor: '#F5F0E8', marginBottom: 6, overflow: 'hidden' },
  similarName:  { fontSize: 11, color: '#1a1a1a', fontWeight: '500', marginBottom: 2, lineHeight: 15 },
  similarPrice: { fontSize: 13, color: RED, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  footerLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  footerTotal: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: RED, borderRadius: 50, paddingVertical: 14, paddingHorizontal: 24, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});