import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, ActivityIndicator, TouchableOpacity,
  RefreshControl, Dimensions, FlatList, Image,
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

import SearchBar     from '../../components/ui/SearchBar';
import CategoryList  from '../../components/ui/CategoryList';
import SectionHeader from '../../components/ui/SectionHeader';
import ProductCard   from '../../components/ui/ProductCard';
import BottomNavBar  from '../../components/ui/BottomNavBar';
import FilterModal   from '../../components/ui/FilterModal';
import HomeHeader from '../../components/ui/HomeHeader';

import { CatalogService, Category, Article } from '../../services/catalog.service';
import { ProfileService, Address, Profile }  from '../../services/profile.service';
import {
  PromotionsService, FlashSaleSummary,
  PacksService, PackSummary,
  buildSlides, SlideItem,
  BestDeal, bestDealToArticle,
} from '../../services/promotions.service';
import { useNotification } from '../../context/NotificationContext';

const { width } = Dimensions.get('window');
const RED = '#E10600';
const GRID_COLUMNS = 2;

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
  const [favoriteIds, setFavoriteIds]       = useState<Set<number>>(new Set());

  // ── Chargement des articles, avec filtre catégorie appliqué côté backend ──
  // CatalogService.getArticles n'accepte qu'un seul `category_id` (pas de tableau).
  // Pour le multi-select (`selectedCats`), on parallélise une requête par
  // catégorie puis on fusionne + déduplique les résultats côté client.
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
      const [cats, arts, addresses, recs, profile, promos, pks, deals, favs] = await Promise.all([
        CatalogService.getCategories().catch(() => []),
        CatalogService.getArticles({ limit: 50 }).catch(() => []),
        ProfileService.listAddresses().catch(() => []),
        CatalogService.getRecommendedArticles({ limit: 10 }).catch(() => []),
        ProfileService.getProfile().catch(() => null),
        PromotionsService.listActive().catch(() => []),
        PacksService.listActive().catch(() => []),
        PromotionsService.listBestDeals(10).catch(() => []),
        ProfileService.listFavorites().catch(() => []),
      ]);
      setCategories(cats);
      setArticles(arts);
      setRecommended(recs);
      setAvatarUrl(profile?.avatar_url ?? null);
      setUser(profile);
      setPromotions(promos);
      setPacks(pks);
      setBestDeals(deals);
      setFavoriteIds(new Set(favs.map(f => f.id)));
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0] || null;
      setDefaultAddress(defaultAddr);
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
    router.push({ pathname: '/main/categories' });
  }, [router]);

  const handleSeeAllPromotions = useCallback(() => {
    router.push('/main/promotions' as any);
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

  const slides: SlideItem[] = useMemo(
    () => buildSlides(promotions, packs),
    [promotions, packs]
  );

  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;

  const handlersRef = useRef({ handleToggleFav, handlePressProduct });
  handlersRef.current = { handleToggleFav, handlePressProduct };

  const renderProductCard = useCallback(({ item }: { item: Article }) => (
    <ProductCard
      article={item}
      isFav={favoriteIdsRef.current.has(item.id)}
      onToggleFav={(next) => handlersRef.current.handleToggleFav(item.id, next)}
      onPress={() => handlersRef.current.handlePressProduct(item.id)}
    />
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

      {slides.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Promotions" onSeeAll={handleSeeAllPromotions} />
          <FlatList
            data={slides}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.82 + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            keyExtractor={item => `${item.type}-${item.id}`}
            renderItem={renderPromoSlide}
          />
        </View>
      )}

      <View style={[styles.section, { marginTop: 28 }]}>
        <SectionHeader title="Catégories" onSeeAll={handleSeeAllCategories} />
        <CategoryList
          categories={categories}
          selectedId={selectedCat}
          onSelect={handleSelectCategory}
        />
      </View>

      {bestDeals.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Best Deals" onSeeAll={handleSeeAllPromotions} />
          <FlatList
            data={bestDeals}
            keyExtractor={(item) => `deal-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={renderBestDealCard}
            extraData={favoriteIds}
          />
        </View>
      )}

      {recommended.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Recommendé pour vous" onSeeAll={() => {}} />
          <FlatList
            data={recommended}
            keyExtractor={(item) => `rec-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={renderProductCard}
            extraData={favoriteIds}
          />
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader
          title={selectedCat || selectedCats.length > 0 ? 'Produits' : 'Tous les produits'}
          onSeeAll={() => {}}
        />
      </View>
    </>
  ), [
    slides, bestDeals, recommended, categories, selectedCat, selectedCats, favoriteIds,
    handleSeeAllPromotions, handleSeeAllCategories, handleSelectCategory,
    handleOpenSearch, handleOpenFilter,
    renderPromoSlide, renderBestDealCard, renderProductCard,
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

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  section: { marginTop: 8 },

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
});