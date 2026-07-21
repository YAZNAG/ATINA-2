import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, ActivityIndicator, TouchableOpacity,
  RefreshControl, Dimensions, FlatList, Image,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';

import SearchBar     from '../../../components/ui/SearchBar';
import CategoryList  from '../../../components/ui/CategoryList';
import SectionHeader from '../../../components/ui/SectionHeader';
import ProductCard   from '../../../components/ui/ProductCard';
import FilterModal   from '../../../components/ui/FilterModal';
import HomeHeader from '../../../components/ui/HomeHeader';
import FlashSaleSection from '../../../components/ui/FlashSaleSection';
import SeeAllCard from '../../../components/ui/SeeAllCard';

import { CatalogService, Category, Article } from '../../../services/catalog.service';
import { ProfileService, Address, Profile }  from '../../../services/profile.service';
import { CartService } from '../../../services/cart.service';
import {
  PromotionsService, FlashSaleSummary,
  PacksService, PackSummary,
  buildSlides, SlideItem,
  BestDeal, bestDealToArticle, EndingSoonResponse
} from '../../../services/promotions.service';
import { useNotification } from '../../../context/NotificationContext';

const { width } = Dimensions.get('window');
const RED = '#E10600';
const GRID_COLUMNS = 2;
const SLIDE_INTERVAL = width * 0.82 + 12;
const HORIZONTAL_LIST_LIMIT = 7;

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
  const [favoriteIds, setFavoriteIds]       = useState<Set<number>>(new Set());
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
setFavoriteIds(new Set(favs.map((f) => f.id)));
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
    } catch(err) {
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

const suggestionRows = useMemo(() => {
  const rows: Article[][] = [];
  for (let i = 0; i < suggestions.length; i += 2) rows.push(suggestions.slice(i, i + 2));
  return rows;
}, [suggestions]);

  const handleToggleFav = useCallback((articleId: number, next: boolean) => {
    setFavoriteIds(prev => {
      const s = new Set(prev);
      if (next) s.add(articleId); else s.delete(articleId);
      return s;
    });
  }, []);

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

  // Pagination du carrousel de bannières 
  const handleSlideScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_INTERVAL);
    setActiveSlide(Math.max(0, Math.min(index, slides.length - 1)));
  }, [slides.length]);

  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;

  const handlersRef = useRef({ handleToggleFav, handlePressProduct });
  handlersRef.current = { handleToggleFav, handlePressProduct };

  function withSeeAllSentinel<T extends { id: number }>(items: T[], limit: number) {
  const trimmed = items.slice(0, limit);
  const hasMore = items.length > limit;
  return { trimmed, hasMore };}

  const renderProductCard = useCallback(({ item }: { item: Article }) => (
    <ProductCard
      article={item}
      isFav={favoriteIdsRef.current.has(item.id)}
      onToggleFav={(next) => handlersRef.current.handleToggleFav(item.id, next)}
      onPress={() => handlersRef.current.handlePressProduct(item.id)}
    />
  ), []);

  const renderTopRatedCard = useCallback(({ item }: { item: Article }) => (
  <ProductCard
    article={item}
    isFav={favoriteIdsRef.current.has(item.id)}
    onToggleFav={(next) => handlersRef.current.handleToggleFav(item.id, next)}
    onPress={() => handlersRef.current.handlePressProduct(item.id)}
  />
), []);

  const renderPopularCard = useCallback(({ item, index }: { item: Article; index: number }) => (
  <View>
    <ProductCard
      article={item}
      isFav={favoriteIdsRef.current.has(item.id)}
      onToggleFav={(next) => handlersRef.current.handleToggleFav(item.id, next)}
      onPress={() => handlersRef.current.handlePressProduct(item.id)}
    />
  </View>
), []);

  const renderBestDealCard = useCallback(({ item }: { item: BestDeal }) => (
    <ProductCard
      article={bestDealToArticle(item)}
      discount={item.discount_pct}
      oldPrice={item.old_price_ttc}
      isFav={favoriteIdsRef.current.has(item.id)}
      onToggleFav={(next) => handlersRef.current.handleToggleFav(item.id, next)}
      onPress={() => handlersRef.current.handlePressProduct(item.id)}
    />
  ), []);

  const renderPromoSlide = useCallback(({ item }: { item: SlideItem }) => {
    const isPack = item.type === 'pack';
    const hasImg = !!item.image_url;
    return (
      <TouchableOpacity
        style={styles.promoSlide}
        activeOpacity={0.88}
        onPress={() =>
          router.push({
            pathname: '/main/promotion_detail' as any,
            params: { id: item.id, type: item.type },
          })
        }
      >
        <View style={[styles.promoClip, !hasImg && { backgroundColor: RED }]}>
          {hasImg ? (
            <Image
              source={{ uri: item.image_url! }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.promoOverlay}>
              <Text style={styles.promoSpecial}>
                ✦  {isPack ? 'PACK ÉCONOMIQUE' : 'OFFRE SPÉCIALE'}  ✦
              </Text>
              <Text style={styles.promoSlideName} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.promoSlideScope} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
          )}
        </View>
        {!hasImg && item.discount_pct != null && (
          <View style={styles.starBadgeWrap}>
            <View style={styles.starShape} />
            <View style={[styles.starShape, { transform: [{ rotate: '22.5deg' }] }]} />
            <View style={styles.starBadgeContent}>
              <Text style={[styles.starBadgePct, { color: RED }]}>{item.discount_pct}%</Text>
              <Text style={[styles.starBadgeOff, { color: RED }]}>OFF</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [router]);

  const handleOpenSearch = useCallback(() => router.push('/main/search'), [router]);
  const handleOpenFilter = useCallback(() => setFilterVisible(true), []);

  const ListHeader = useMemo(() => (
  <>
    <SearchBar
      value=""
      onChangeText={() => {}}
      onFilter={handleOpenFilter}
      onPress={handleOpenSearch}
    />

    {!hasCategoryFilter && slides.length > 0 && (
      <View style={styles.section}>
        <FlatList
          data={slides}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SLIDE_INTERVAL}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          keyExtractor={item => `${item.type}-${item.id}`}
          renderItem={renderPromoSlide}
          onMomentumScrollEnd={handleSlideScrollEnd}
        />

        {slides.length > 1 && (
          <View style={styles.dotsContainer}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeSlide && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    )}

    {!hasCategoryFilter && (
      <FlashSaleSection
        endsAt={endingSoon.ends_at}
        products={endingSoon.products}
        favoriteIds={favoriteIds}
        onToggleFav={handleToggleFav}
      />
    )}

    {!hasCategoryFilter && (
  <View style={styles.section}>
    <SectionHeader title="Catégories" onSeeAll={handleSeeAllCategories} />
    <CategoryList
      categories={categories}
      selectedId={selectedCat}
      onSelect={handleSelectCategory}
    />
  </View>
   )}

{!hasCategoryFilter && bestDeals.length > 0 && (() => {
  const { trimmed, hasMore } = withSeeAllSentinel(bestDeals, HORIZONTAL_LIST_LIMIT);
  const seeAllRoute = { pathname: '/main/main_nav/product-list', params: { source: 'bestDeals', title: 'Meilleures offres' } };
  return (
    <View style={styles.section}>
      <SectionHeader title="Meilleures offres" onSeeAll={() => router.push(seeAllRoute as any)} />
      <FlatList
        data={trimmed}
        keyExtractor={(item) => `deal-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={renderBestDealCard}
        extraData={favoriteIds}
        ListFooterComponent={hasMore ? <SeeAllCard onPress={() => router.push(seeAllRoute as any)} /> : null}
      />
    </View>
  );
})()}

{!hasCategoryFilter && popular.length > 0 && (() => {
  const { trimmed, hasMore } = withSeeAllSentinel(popular, HORIZONTAL_LIST_LIMIT);
  const seeAllRoute = { pathname: '/main/main_nav/product-list', params: { source: 'popular', title: 'Produits populaires' } };
  return (
    <View style={styles.section}>
      <SectionHeader title="Produits populaires" onSeeAll={() => router.push(seeAllRoute as any)} />
      <FlatList
        data={trimmed}
        keyExtractor={(item) => `pop-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={renderPopularCard}
        extraData={favoriteIds}
        ListFooterComponent={hasMore ? <SeeAllCard onPress={() => router.push(seeAllRoute as any)} /> : null}
      />
    </View>
  );
})()}

{!hasCategoryFilter && topRated.length > 0 && (() => {
  const { trimmed, hasMore } = withSeeAllSentinel(topRated, HORIZONTAL_LIST_LIMIT);
  const seeAllRoute = { pathname: '/main/main_nav/product-list', params: { source: 'topRated', title: 'Notés 5 étoiles' } };
  return (
    <View style={styles.section}>
      <SectionHeader title="Notés 5 étoiles" onSeeAll={() => router.push(seeAllRoute as any)} />
      <FlatList
        data={trimmed}
        keyExtractor={(item) => `rated-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={renderTopRatedCard}
        extraData={favoriteIds}
        ListFooterComponent={hasMore ? <SeeAllCard onPress={() => router.push(seeAllRoute as any)} /> : null}
      />
    </View>
  );
})()}

{!hasCategoryFilter && suggestions.length > 0 && (() => {
  const { trimmed, hasMore } = withSeeAllSentinel(suggestions, HORIZONTAL_LIST_LIMIT);
  const trimmedRows: Article[][] = [];
  for (let i = 0; i < trimmed.length; i += 2) trimmedRows.push(trimmed.slice(i, i + 2));
  const seeAllRoute = { pathname: '/main/main_nav/product-list', params: { source: 'suggestions', title: 'Suggestions pour vous' } };
  return (
    <View style={styles.section}>
      <SectionHeader title="Suggestions pour vous" onSeeAll={() => router.push(seeAllRoute as any)} />
      {trimmedRows.map((row, ri) => (
        <View key={ri} style={styles.suggestionRow}>
          {row.map((item) => (
            <ProductCard
              key={item.id}
              article={item}
              isFav={favoriteIdsRef.current.has(item.id)}
              onToggleFav={(next) => handlersRef.current.handleToggleFav(item.id, next)}
              onPress={() => handlersRef.current.handlePressProduct(item.id)}
            />
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
})()}

    <View style={styles.section}>
  {hasCategoryFilter ? (
    <View style={styles.activeFilterRow}>
      <View style={styles.activeFilterChip}>
        <Feather name="filter" size={13} color={RED} />
        <Text style={styles.activeFilterText}>
          {activeCategoryName || 'Filtré'}
        </Text>
      </View>
      <TouchableOpacity onPress={handleClearCategoryFilter} activeOpacity={0.7}>
        <Text style={styles.clearFilterText}>Réinitialiser</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <SectionHeader
      title="Tous les produits"
      onSeeAll={() => router.push({ pathname: '/main/main_nav/product-list', params: { source: 'allProducts', title: 'Tous les produits' } } as any)}
    />
  )}
</View>
  </>
), [
  hasCategoryFilter, slides, bestDeals, recommended, categories, selectedCat, selectedCats,
  favoriteIds, endingSoon, activeSlide, popular, complements, suggestions, suggestionRows, topRated, activeCategoryName,
  handleSeeAllCategories, handleSelectCategory,
  handleOpenSearch, handleOpenFilter, handleSlideScrollEnd, handleApplyFilter, handleClearCategoryFilter,
  renderPromoSlide, renderBestDealCard, renderProductCard, renderPopularCard, renderTopRatedCard
]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
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

      {/* ── Grille principale : une seule FlatList verticale virtualisée ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => `article-${item.id}`}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={<View style={{ height: 100 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color="#E0E0E0" />
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        }
        renderItem={renderProductCard}
        extraData={favoriteIds}
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

  section: { marginTop: 16 },

  horizontalList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },

  gridContent: {
    paddingBottom: 8,
  },
  gridRow: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14, color: '#9CA3AF', marginTop: 12, fontFamily: 'Poppins_400Regular',
  },

  promoSlide: {
    width: width * 0.82,
    height: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 14, elevation: 6,
  },
  promoClip: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  promoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  promoSpecial: {
    fontSize: 10, fontFamily: 'Poppins_700Bold', color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2, marginBottom: 8,
  },
  promoSlideName: {
    fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff',
    lineHeight: 27, textAlign: 'center', marginBottom: 6,
  },
  promoSlideScope: {
    fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center',
  },

  starBadgeWrap: {
    position: 'absolute',
    top: -10, right: -8,
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  starShape: {
    position: 'absolute',
    width: 52, height: 52,
    borderRadius: 12,
    backgroundColor: '#FFF8E7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  starBadgeContent: { alignItems: 'center', justifyContent: 'center' },
  starBadgePct:     { fontSize: 15, fontFamily: 'Poppins_800ExtraBold', lineHeight: 17 },
  starBadgeOff:     { fontSize: 8, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8D4D4',
  },
  dotActive: {
    width: 18,
    backgroundColor: RED,
  },

  popularRankBadge: {
  position: 'absolute', top: 8, left: 8, zIndex: 1,
  backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,},
  popularRankText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#fff' },

  suggestionRow: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  gap: 16,
  marginBottom: 16,
},

activeFilterRow: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  paddingHorizontal: 16, marginBottom: 12,
},
activeFilterChip: {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  backgroundColor: '#FFF0F0', borderRadius: 20,
  paddingHorizontal: 12, paddingVertical: 6,
},
activeFilterText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: RED },
clearFilterText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#9CA3AF' },

seeAllInlineBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  marginHorizontal: 16, marginTop: 4, paddingVertical: 12,
  borderWidth: 1.5, borderColor: '#FFE1E1', borderRadius: 14, backgroundColor: '#FFF5F5',
},
seeAllInlineText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: RED },
});