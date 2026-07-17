import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PageHeader from '../../components/ui/PageHeader';
import ProductCard from '../../components/ui/ProductCard';
import BottomNavBar from '../../components/ui/BottomNavBar';

import { CatalogService, Article } from '../../services/catalog.service';
import { ProfileService } from '../../services/profile.service';
import { CartService } from '../../services/cart.service';
import {
  PromotionsService, BestDeal, bestDealToArticle,
} from '../../services/promotions.service';

const PAGE_SIZE = 20;

const RED = '#E10600';
const GRID_COLUMNS = 2;

type Source = 'bestDeals' | 'popular' | 'topRated' | 'suggestions' | 'allProducts';

interface ListCard {
  article:   Article;
  discount?: number;
  oldPrice?: number;
  isFlashSale?: boolean;
}

export default function ProductListScreen() {
  const router = useRouter();
  const { source, title } = useLocalSearchParams<{ source: Source; title: string }>();

  const [cards, setCards]           = useState<ListCard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageTitle = Array.isArray(title) ? title[0] : (title || 'Produits');

  // ── Compléments panier : les skuIds du panier ne changent pas d'une page à l'autre ──
  const [cartSkuIds, setCartSkuIds] = useState<string[]>([]);

  const fetchPage = useCallback(async (targetPage: number): Promise<{ cards: ListCard[]; more: boolean }> => {
    switch (source) {
      case 'bestDeals': {
        const res = await PromotionsService.listBestDeals(PAGE_SIZE, targetPage);
        return {
          cards: res.data.map((d: BestDeal) => ({
            article:  bestDealToArticle(d),
            discount: d.discount_pct,
            oldPrice: d.old_price_ttc,
          })),
          more: res.hasMore,
        };
      }
      case 'popular': {
        const res = await CatalogService.getPopularArticles({ limit: PAGE_SIZE, page: targetPage });
        return { cards: res.data.map((a) => ({ article: a })), more: res.hasMore };
      }
      case 'topRated': {
        const res = await CatalogService.getTopRatedArticles({ limit: PAGE_SIZE, page: targetPage });
        return { cards: res.data.map((a) => ({ article: a })), more: res.hasMore };
      }
      case 'suggestions': {
        // Pas de vraie source "recommandations" paginable côté backend — on ne paginera que les compléments panier.
        // Page 1 : recommandations + première page de compléments. Pages suivantes : compléments uniquement.
        if (targetPage === 1) {
          const recs = await CatalogService.getRecommendedArticles({ limit: PAGE_SIZE }).catch(() => []);
          let compData: Article[] = [];
          let compHasMore = false;
          if (cartSkuIds.length > 0) {
            const res = await CatalogService.getCartComplements(cartSkuIds, PAGE_SIZE, 1);
            compData = res.data;
            compHasMore = res.hasMore;
          }
          const seen = new Set<number>();
          const merged: Article[] = [];
          [...recs, ...compData].forEach((a) => {
            if (!seen.has(a.id)) { seen.add(a.id); merged.push(a); }
          });
          return { cards: merged.map((a) => ({ article: a })), more: compHasMore };
        }
        if (cartSkuIds.length === 0) return { cards: [], more: false };
        const res = await CatalogService.getCartComplements(cartSkuIds, PAGE_SIZE, targetPage);
        return { cards: res.data.map((a) => ({ article: a })), more: res.hasMore };
      }
      case 'allProducts': {
        const res = await CatalogService.searchArticles({ page: targetPage, limit: PAGE_SIZE });
        return {
          cards: res.data.map((a) => ({ article: a })),
          more: res.pagination.page < res.pagination.pages,
        };
      }
      default:
        return { cards: [], more: false };
    }
  }, [source, cartSkuIds]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      // Prépare les skuIds du panier une seule fois avant de charger la 1ère page (utile pour 'suggestions')
      let skuIds = cartSkuIds;
      if (source === 'suggestions') {
        try {
          const cart = await CartService.getCart();
          skuIds = cart.items.map((i) => i.sku_id).filter(Boolean) as string[];
          setCartSkuIds(skuIds);
        } catch { skuIds = []; }
      }
      const { cards: pageCards, more } = await fetchPage(1);
      setCards(pageCards);
      setPage(1);
      setHasMore(more);
    } catch (err) {
      console.log('Error loading product list:', err);
      setCards([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [source, fetchPage, cartSkuIds]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { cards: pageCards, more } = await fetchPage(nextPage);
      setCards((prev) => [...prev, ...pageCards]);
      setPage(nextPage);
      setHasMore(more);
    } catch (err) {
      console.log('Error loading more products:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, hasMore, loadingMore, fetchPage]);

  useEffect(() => { loadInitial(); }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ProfileService.listFavorites()
      .then((favs) => setFavoriteIds(new Set(favs.map((f) => f.id))))
      .catch(() => {});
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadInitial(); }, [loadInitial]);

  const handleToggleFav = useCallback((articleId: number, next: boolean) => {
    setFavoriteIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(articleId); else s.delete(articleId);
      return s;
    });
  }, []);

  const renderItem = useCallback(({ item }: { item: ListCard }) => (
    <ProductCard
      article={item.article}
      discount={item.discount}
      oldPrice={item.oldPrice}
      isFlashSale={item.isFlashSale}
      isFav={favoriteIds.has(item.article.id)}
      onToggleFav={(next) => handleToggleFav(item.article.id, next)}
      onPress={() => router.push({ pathname: '/main/product-detail' as any, params: { article_id: item.article.id } })}
    />
  ), [favoriteIds, handleToggleFav, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title={pageTitle} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item, i) => `${item.article.id}-${i}`}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={RED} style={{ marginVertical: 20 }} /> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aucun produit trouvé</Text>
            </View>
          }
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      )}

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridContent: { paddingBottom: 100, paddingTop: 8 },
  gridRow: { paddingHorizontal: 16, gap: 16, marginBottom: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontFamily: 'Inter_400Regular' },
});