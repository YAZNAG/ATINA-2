import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet,
  StatusBar, ActivityIndicator,
  RefreshControl, Dimensions, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';

import ProductCard   from '../../../components/ui/ProductCard';
import FilterModal   from '../../../components/ui/FilterModal';

import HomeHeader     from '@/components/ui/Home/HomeHeader';
import HomeListHeader from '@/components/ui/Home/HomeListHeader';

import { favoritesStore } from '../../../store/favoritesStore';

import { CatalogService, Category, Article } from '../../../services/catalog.service';
import { ProfileService, Address, Profile }  from '../../../services/profile.service';
import { CartService } from '../../../services/cart.service';
import {
  PromotionsService, FlashSaleSummary,
  PacksService, PackSummary,
  buildSlides, SlideItem,
  BestDeal, EndingSoonResponse
} from '../../../services/promotions.service';
import { useNotification } from '../../../context/NotificationContext';

const { width } = Dimensions.get('window');
const RED = '#E10600';
const GRID_COLUMNS = 2;
const SLIDE_INTERVAL = width * 0.82 + 12;

export default function HomeScreen() {
  const router = useRouter();
  const { refreshNotifCount } = useNotification();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [user, setUser]               = useState<Profile | null>(null);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [articles, setArticles]       = useState<Article[]>([]);
  const [recommended, setRecommended] = useState<Article[]>([]);
  const [popular, setPopular]         = useState<Article[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filterVisible, setFilterVisible]   = useState(false);
  const [selectedCats, setSelectedCats]     = useState<number[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null);
  const [promotions, setPromotions]         = useState<FlashSaleSummary[]>([]);
  const [packs,      setPacks]              = useState<PackSummary[]>([]);
  const [bestDeals,  setBestDeals]          = useState<BestDeal[]>([]);
  const [endingSoon, setEndingSoon] = useState<EndingSoonResponse>({ ends_at: null, products: [] });
  const [activeSlide, setActiveSlide]       = useState(0);
  const [complements, setComplements] = useState<Article[]>([]);
  const [topRated, setTopRated] = useState<Article[]>([]);

  const loadArticles = useCallback(async () => {
    try {
      if (selectedCats.length > 0) {
        const results = await Promise.all(
          selectedCats.map((catId) =>
            CatalogService.getArticles({ limit: 50, category_id: catId }).catch(() => [])
          )
        );
        const merged = new Map<number, Article>();
        results.flat().forEach((a) => merged.set(a.id, a));
        setArticles(Array.from(merged.values()));
      } else {
        const arts = await CatalogService.getArticles({
          limit: 50,
          ...(selectedCat ? { category_id: selectedCat } : {}),
        });
        setArticles(arts);
      }
    } catch (err) {
      console.log('Error loading articles:', err);
      setArticles([]);
    }
  }, [selectedCat, selectedCats]);

  const loadData = useCallback(async () => {
    try {
      const [cats, arts, addresses, recs, profile, promos, pks, homePromos, favs, pop, rated] = await Promise.all([
        CatalogService.getCategories().catch(() => []),
        CatalogService.getArticles({ limit: 20 }).catch(() => []),
        ProfileService.listAddresses().catch(() => []),
        CatalogService.getRecommendedArticles({ limit: 10 }).catch(() => []),
        ProfileService.getProfile().catch(() => null),
        PromotionsService.listActive().catch(() => []),
        PacksService.listActive().catch(() => []),
        PromotionsService.listHomePromotions(24, 10).catch(() => ({
          endingSoon: { ends_at: null, products: [] },
          bestDeals: [],
        })),
        ProfileService.listFavorites().catch(() => []),
        CatalogService.getPopularArticles({ limit: 10 }).catch(() => ({ data: [], hasMore: false })),
        CatalogService.getTopRatedArticles({ limit: 10 }).catch(() => ({ data: [], hasMore: false })),
      ]);
      setCategories(cats);
      setArticles(arts);
      setRecommended(recs);
      setPopular(pop.data);
      setAvatarUrl(profile?.avatar_url ?? null);
      setUser(profile);
      setPromotions(promos);
      setPacks(pks);
      setEndingSoon(homePromos.endingSoon);
      setBestDeals(homePromos.bestDeals);
      favoritesStore.setIds(new Set(favs.map((f) => f.id)));
      setTopRated(rated.data);
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0] || null;
      setDefaultAddress(defaultAddr);
      try {
        const cart = await CartService.getCart();
        const skuIds = cart.items.map((i) => i.sku_id).filter(Boolean) as string[];
        if (skuIds.length > 0) {
          const comps = await CatalogService.getCartComplements(skuIds, 10);
          setComplements(comps.data);
        } else {
          setComplements([]);
        }
      } catch (err) {
        setComplements([]);
        console.log('Erreur compléments panier:', err);
      }
    } catch (err) {
      console.log('Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    loadArticles();
  }, [selectedCat, selectedCats, loadArticles]);

  useFocusEffect(useCallback(() => { refreshNotifCount(); }, [refreshNotifCount]));

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchCat = selectedCats.length > 0
        ? selectedCats.includes(a.category?.id ?? 0)
        : selectedCat ? a.category?.id === selectedCat : true;
      return matchCat;
    });
  }, [articles, selectedCat, selectedCats]);

  const suggestions = useMemo(() => {
    const seen = new Set<number>();
    const merged: Article[] = [];
    [...recommended, ...complements].forEach((a) => {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        merged.push(a);
      }
    });
    return merged;
  }, [recommended, complements]);

  const handlePressProduct = useCallback((articleId: number) => {
    router.push({ pathname: '/main/product-detail' as any, params: { article_id: articleId } });
  }, [router]);

  const handleSeeAllCategories = useCallback(() => {
    router.push({ pathname: '/main/main_nav/categories' });
  }, [router]);

  const handleSelectCategory = useCallback((cat: Category) => {
    setSelectedCat(cat.id === 0 ? null : cat.id);
    setSelectedCats([]);
  }, []);

  const handleApplyFilter = useCallback((ids: number[]) => {
    setSelectedCats(ids);
    setSelectedCat(null);
    setFilterVisible(false);
  }, []);

  const hasCategoryFilter = selectedCat != null || selectedCats.length > 0;

  const activeCategoryName = useMemo(() => {
    if (selectedCat != null) {
      return categories.find((c) => c.id === selectedCat)?.name_fr ?? null;
    }
    if (selectedCats.length === 1) {
      return categories.find((c) => c.id === selectedCats[0])?.name_fr ?? null;
    }
    if (selectedCats.length > 1) {
      return `${selectedCats.length} catégories`;
    }
    return null;
  }, [selectedCat, selectedCats, categories]);

  const handleClearCategoryFilter = useCallback(() => {
    setSelectedCat(null);
    setSelectedCats([]);
  }, []);

  const slides: SlideItem[] = useMemo(
    () => buildSlides(promotions, packs),
    [promotions, packs]
  );

  const handleSlideScrollEnd = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_INTERVAL);
    setActiveSlide(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length]);

  const handlePressProductRef = useRef(handlePressProduct);
  handlePressProductRef.current = handlePressProduct;

  const renderProductCard = useCallback(({ item }: { item: Article }) => (
    <ProductCard
      article={item}
      onPress={() => handlePressProductRef.current(item.id)}
    />
  ), []);

  const handleOpenSearch = useCallback(() => router.push('/main/search'), [router]);
  const handleOpenFilter = useCallback(() => setFilterVisible(true), []);

  const goToProductList = useCallback((source: string, title: string) => {
    router.push({ pathname: '/main/main_nav/product-list', params: { source, title } } as any);
  }, [router]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <HomeHeader
        defaultAddress={defaultAddress}
        user={user}
        avatarUrl={avatarUrl}
      />

      <FilterModal
        visible={filterVisible}
        categories={categories}
        subCategories={[]}
        selected={selectedCats}
        selectedSubs={[]}
        onApply={handleApplyFilter}
        onClose={() => setFilterVisible(false)}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => `article-${item.id}`}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
        ListHeaderComponent={
          <HomeListHeader
            hasCategoryFilter={hasCategoryFilter}
            slides={slides}
            activeSlide={activeSlide}
            onSlideScrollEnd={handleSlideScrollEnd}
            endingSoon={endingSoon}
            categories={categories}
            selectedCat={selectedCat}
            onSelectCategory={handleSelectCategory}
            onSeeAllCategories={handleSeeAllCategories}
            bestDeals={bestDeals}
            popular={popular}
            topRated={topRated}
            suggestions={suggestions}
            onPressProduct={handlePressProduct}
            activeCategoryName={activeCategoryName}
            onClearCategoryFilter={handleClearCategoryFilter}
            onOpenSearch={handleOpenSearch}
            onOpenFilter={handleOpenFilter}
            onSeeAllProductList={goToProductList}
          />
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color="#E0E0E0" />
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        }
        renderItem={renderProductCard}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  gridContent: { paddingBottom: 8 },
  gridRow: { paddingHorizontal: 16, gap: 16, marginBottom: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontFamily: 'Poppins_400Regular' },
});