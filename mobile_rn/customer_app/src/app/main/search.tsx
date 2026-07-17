import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
} from '@expo-google-fonts/inter';

import ProductCard from '../../components/ui/ProductCard';
import SearchBar from '../../components/ui/SearchBar';
import FilterModal from '../../components/ui/FilterModal';
import { CatalogService, Article, Category } from '../../services/catalog.service';
import { ProfileService } from '../../services/profile.service';
import { sortArticles } from '../../components/ui/SortBar';

const RED = '#E10600';

type SearchTab = 'default' | 'price_asc' | 'popular' | 'newest';

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'default',   label: 'Tous' },
  { key: 'price_asc', label: 'Prix bas' },
  { key: 'popular',   label: 'Populaire' },
  { key: 'newest',    label: 'Nouveaux' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const [query, setQuery]           = useState(q ?? '');
  const [activeTab, setActiveTab]   = useState<SearchTab>('default');
  const [results, setResults]       = useState<Article[]>([]);
  const [loading, setLoading]       = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [popularArticles, setPopularArticles] = useState<Article[]>([]);
  const [popularGrid, setPopularGrid] = useState<Article[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filtre catégories (via FilterModal) ──
  const [categories, setCategories]     = useState<Category[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);

  useEffect(() => {
    ProfileService.listFavorites()
      .then(favs => setFavoriteIds(new Set(favs.map(f => f.id))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    CatalogService.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    CatalogService.getPopularArticles({ limit: 6 })
      .then(res => setPopularArticles(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    CatalogService.getPopularArticles({ limit: 30 })
      .then(res => setPopularGrid(res.data))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async (text: string) => {
  setLoading(true);
  try {
    const res = await CatalogService.searchArticles({
      search: text || undefined,
      limit: 30,
      category_ids: selectedCats.length > 0 ? selectedCats : undefined,  
    });
    setResults(res.data);
  } catch {
    setResults([]);
  } finally {
    setLoading(false);
  }
}, [selectedCats]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  const handlePopularPress = (term: string) => {
    setQuery(term);
  };

  const displayed = (() => {
  switch (activeTab) {
    case 'price_asc': return sortArticles(results, 'price_asc');
    case 'popular': {
      if (!query) return popularGrid;
      const popularIds = new Set(popularGrid.map(a => a.id));
      return [...results].sort((a, b) => (popularIds.has(a.id) ? 0 : 1) - (popularIds.has(b.id) ? 0 : 1));
    }
    case 'newest': return [...results].sort((a, b) => b.id - a.id);
    default:       return results;
  }
})();

  const popularKeywords = [
    ...new Set(popularArticles.map(a => a.name_fr.split(' ')[0]))
  ].slice(0, 6);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header : retour + SearchBar (historique + suggestions + filtre inclus) ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/main/home'))}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={20} color={RED} />
        </TouchableOpacity>

        <View style={styles.searchBarFlex}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={setQuery}
            onFilter={() => setFilterVisible(true)}
            articleNames={[...results, ...popularGrid].map(a => a.name_fr)}
          />
        </View>
      </View>

      {/* ── Chip de filtre actif (retire le besoin de deviner que le filtre est appliqué) ── */}
      {selectedCats.length > 0 && (
        <View style={styles.activeFilterRow}>
          <View style={styles.activeFilterChip}>
            <Feather name="filter" size={13} color={RED} />
            <Text style={styles.activeFilterText}>
              {selectedCats.length === 1
                ? categories.find(c => c.id === selectedCats[0])?.name_fr ?? '1 catégorie'
                : `${selectedCats.length} catégories`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedCats([])} activeOpacity={0.7}>
            <Text style={styles.clearFilterText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Recherches populaires ── */}
        <View style={styles.popularSection}>
          <Text style={styles.popularTitle}>Recherches populaires</Text>
          <View style={styles.chipsWrap}>
            {popularKeywords.map(term => {
              const active = query.toLowerCase() === term.toLowerCase();
              return (
                <TouchableOpacity
                  key={term}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handlePopularPress(term)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{term}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Tabs de tri ── */}
        <View style={styles.tabsRow}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                style={styles.tabItem}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                {active && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Résultats ── */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={RED} />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="search" size={40} color="#E0E0E0" />
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {displayed.map(article => (
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

      </ScrollView>

      {/* ── Filter Modal (catégories) ── */}
      <FilterModal
        visible={filterVisible}
        categories={categories}
        subCategories={[]}
        selected={selectedCats}
        selectedSubs={[]}
        onApply={(ids) => {
          setSelectedCats(ids);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  headerRow: {
  flexDirection: 'row', alignItems: 'center',
  paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 4,
},
backBtn: {
  width: 40, height: 40, borderRadius: 20,
  backgroundColor: '#FFEAEA',
  alignItems: 'center', justifyContent: 'center',
  marginLeft: 16,  
  marginBottom: 7,
},
searchBarFlex: {
  flex: 1,
},

  activeFilterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 8, marginBottom: 4,
  },
  activeFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF0F0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  activeFilterText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: RED },
  clearFilterText:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },

  popularSection: { paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  popularTitle: { fontSize: 15, color: '#1a1a1a', fontFamily: 'Poppins_700Bold', marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  chipActive: { backgroundColor: RED },
  chipText: { fontSize: 13, color: '#1a1a1a', fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: '#fff', fontFamily: 'Inter_600SemiBold' },

  tabsRow: {
    flexDirection: 'row', gap: 20,
    paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tabItem: { paddingBottom: 10 },
  tabText: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
  tabTextActive: { color: RED, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: {
    height: 2, backgroundColor: RED, borderRadius: 1,
    marginTop: 8, width: '100%',
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 16, paddingTop: 16,
  },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap:   { paddingVertical: 60, alignItems: 'center' },
  emptyText:   { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontFamily: 'Inter_400Regular' },
});