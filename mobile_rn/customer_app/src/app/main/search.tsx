import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity, ScrollView, FlatList,
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
import { CatalogService, Article } from '../../services/catalog.service';
import { ProfileService } from '../../services/profile.service';
import { sortArticles} from '../../components/ui/SortBar';

const RED = '#E10600';

const POPULAR_SEARCHES = ['Coca Cola', 'Snacks', 'Chips', 'Eau', 'Biscuit', 'Boissons'];
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
  const [activeTab, setActiveTab] = useState<SearchTab>('default');
  const [results, setResults]       = useState<Article[]>([]);
  const [loading, setLoading]       = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ProfileService.listFavorites()
      .then(favs => setFavoriteIds(new Set(favs.map(f => f.id))))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const res = await CatalogService.searchArticles({ search: text || undefined, limit: 30 });
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    case 'popular':    return [...results].sort((a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0));
    case 'newest':     return [...results].sort((a, b) => b.id - a.id);
    default:           return results;
  }
})();

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header : retour + input recherche + filtre ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/main/home'))}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={20} color={RED} />
        </TouchableOpacity>

        <View style={styles.searchInputWrap}>
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Rechercher des produits...."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Feather name="x" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.85}>
          <Feather name="sliders" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Recherches populaires ── */}
        <View style={styles.popularSection}>
          <Text style={styles.popularTitle}>Recherches populaires</Text>
          <View style={styles.chipsWrap}>
            {POPULAR_SEARCHES.map(term => {
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFEAEA',
    alignItems: 'center', justifyContent: 'center',
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F5F5', borderRadius: 24,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: '#1a1a1a',
    fontFamily: 'Inter_400Regular', paddingVertical: 0,
  },
  filterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },

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