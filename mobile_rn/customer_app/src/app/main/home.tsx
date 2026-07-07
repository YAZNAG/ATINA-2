import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
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
import SortBar, { SortOption, sortArticles } from '../../components/ui/SortBar';
import CategoryList  from '../../components/ui/CategoryList';
import SectionHeader from '../../components/ui/SectionHeader';
import ProductCard   from '../../components/ui/ProductCard';
import BottomNavBar  from '../../components/ui/BottomNavBar';
import FilterModal   from '../../components/ui/FilterModal';
import HomeHeader from '../../components/ui/HomeHeader';

import { CatalogService, Category, Article } from '../../services/catalog.service';
import { ProfileService, Address }           from '../../services/profile.service';
import {
  PromotionsService, FlashSaleSummary,
  PacksService, PackSummary,
  buildSlides, SlideItem,
  BestDeal, bestDealToArticle,
} from '../../services/promotions.service';
import { useNotification } from '../../context/NotificationContext';

const { width } = Dimensions.get('window');
const RED = '#E10600';

export default function HomeScreen() {

  const router = useRouter();
  const { refreshNotifCount } = useNotification();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [user, setUser]               = useState<any>(null);
  const [search, setSearch]           = useState('');
  const [categories, setCategories]   = useState<Category[]>([]);
  const [articles, setArticles]       = useState<Article[]>([]);
  const [recommended, setRecommended] = useState<Article[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filterVisible, setFilterVisible]   = useState(false);
  const [selectedCats, setSelectedCats]     = useState<number[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [sort, setSort]                     = useState<SortOption>('default');
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null);
  const [promotions, setPromotions]         = useState<FlashSaleSummary[]>([]);
  const [packs,      setPacks]              = useState<PackSummary[]>([]);
  const [bestDeals,  setBestDeals]          = useState<BestDeal[]>([]);
  const [favoriteIds, setFavoriteIds]       = useState<Set<number>>(new Set());

  const loadData = async () => {
    try {
      const [cats, arts, addresses, recs, profile, promos, pks, deals, favs] = await Promise.all([
        CatalogService.getCategories(),
        CatalogService.getArticles({ limit: 20 }),
        ProfileService.listAddresses(),
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
  };

  useEffect(() => { loadData(); }, []);

  useFocusEffect(useCallback(() => { refreshNotifCount(); }, [refreshNotifCount]));

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

  const filtered = sortArticles(
    articles.filter((a) => {
      const matchSearch = search ? a.name_fr.toLowerCase().includes(search.toLowerCase()) : true;
      const matchCat    = selectedCats.length > 0
        ? selectedCats.includes(a.category?.id ?? 0)
        : selectedCat ? a.category?.id === selectedCat : true;
      return matchSearch && matchCat;
    }),
    sort,
  );

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

      {/* ── Search bar ── */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onFilter={() => setFilterVisible(true)}
        articleNames={articles.map(a => a.name_fr)}
      />
      <FilterModal
        visible={filterVisible}
        categories={categories}
        subCategories={[]}
        selected={selectedCats}
        selectedSubs={[]}
        onApply={(ids) => {
          setSelectedCats(ids);
          setSelectedCat(null);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
      >
        <SortBar value={sort} onChange={(v) => setSort(v as SortOption)} />

        {/* ── Promotions + Packs slider ── */}
        {(promotions.length > 0 || packs.length > 0) && (() => {
          const slides: SlideItem[] = buildSlides(promotions, packs);
          if (slides.length === 0) return null;
          const ACCENT = (_isPack: boolean) => RED;
          return (
            <View style={styles.section}>
              <SectionHeader
                title="Promotions"
                onSeeAll={() => router.push('/main/promotions' as any)}
              />
              <FlatList
                data={slides}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={width * 0.82 + 12}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                keyExtractor={item => `${item.type}-${item.id}`}
                renderItem={({ item }) => {
                  const isPack  = item.type === 'pack';
                  const accent  = ACCENT(isPack);
                  const hasImg  = !!item.image_url;
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
                      <View style={[styles.promoClip, !hasImg && { backgroundColor: accent }]}>
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
                            <Text style={[styles.starBadgePct, { color: accent }]}>{item.discount_pct}%</Text>
                            <Text style={[styles.starBadgeOff, { color: accent }]}>OFF</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          );
        })()}

        {/* ── Catégories ── */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <SectionHeader title="Catégories" onSeeAll={() => {router.push({ pathname: '/main/categories'})}} />
          <CategoryList
            categories={categories}
            selectedId={selectedCat}
            onSelect={(cat) => {
              setSelectedCat(cat.id === 0 ? null : cat.id);
              setSelectedCats([]);
            }}
          />
        </View>

        {/* ── Best Deals ── */}
        {bestDeals.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Best Deals" onSeeAll={() => router.push('/main/promotions' as any)} />
            <FlatList
              data={bestDeals}
              keyExtractor={(item) => `deal-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <ProductCard
                  article={bestDealToArticle(item)}
                  discount={item.discount_pct}
                  oldPrice={item.old_price_ttc}
                  isFav={favoriteIds.has(item.id)}
                  onToggleFav={(next) => setFavoriteIds(prev => {
                    const s = new Set(prev);
                    if (next) s.add(item.id); else s.delete(item.id);
                    return s;
                  })}
                  onPress={() =>
                    router.push({ pathname: '/main/product-detail' as any, params: { article_id: item.id } })
                  }
                />
              )}
            />
          </View>
        )}

        {/* ── Recommandations ── */}
        {recommended.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Recommendé pour vous" onSeeAll={() => {}} />
            <FlatList
              data={recommended}
              keyExtractor={(item) => `rec-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <ProductCard
                  article={item}
                  isFav={favoriteIds.has(item.id)}
                  onToggleFav={(next) => setFavoriteIds(prev => {
                    const s = new Set(prev);
                    if (next) s.add(item.id); else s.delete(item.id);
                    return s;
                  })}
                  onPress={() =>
                    router.push({ pathname: '/main/product-detail' as any, params: { article_id: item.id } })
                  }
                />
              )}
            />
          </View>
        )}

        {/* ── Tous les produits ── */}
        <View style={styles.section}>
          <SectionHeader
            title={selectedCat ? 'Produits' : 'Tous les produits'}
            onSeeAll={() => {}}
          />

          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aucun produit trouvé</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filtered.map((article) => (
                <ProductCard
                  key={article.id}
                  article={article}
                  isFav={favoriteIds.has(article.id)}
                  onToggleFav={(next) => setFavoriteIds(prev => {
                    const s = new Set(prev);
                    if (next) s.add(article.id); else s.delete(article.id);
                    return s;
                  })}
                  onPress={() =>
                    router.push({ pathname: '/main/product-detail' as any, params: { article_id: article.id } })
                  }
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

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

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 16, paddingBottom: 8,
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