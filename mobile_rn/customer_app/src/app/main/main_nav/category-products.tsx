import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ProductCard  from '../../../components/ui/ProductCard';
import FilterModal  from '../../../components/ui/FilterModal';
import PageHeader from '../../../components/ui/PageHeader';
import SearchBar from '@/components/ui/SearchBar';
import { favoritesStore } from '../../../store/favoritesStore';

import { CatalogService, Article, ArticlesResponse, SubCategory, Category } from '../../../services/catalog.service';
import { ProfileService } from '../../../services/profile.service';

const RED = '#E10600';

const SubCatPill = ({
  label, image_path, selected, onPress,
}: {
  label: string; image_path?: string | null; selected: boolean; onPress: () => void;
}) => (
  <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.pillImageBox, selected && styles.pillImageBoxSelected]}>
      {image_path ? (
        <Image
          source={{ uri: image_path }}
          style={styles.pillImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <Feather name="grid" size={20} color={selected ? RED : '#9CA3AF'} />
      )}
    </View>
    <Text style={[styles.pillLabel, selected && styles.pillLabelSelected]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function CategoryProductsScreen() {
  const router = useRouter();
  const { category_id, category_name } = useLocalSearchParams<{
    category_id: string; category_name: string;
  }>();

  const [articles, setArticles]           = useState<Article[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedSub, setSelectedSub]     = useState<number | null>(null);
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCats, setSelectedCats]   = useState<number[]>([]);
  const [selectedSubs, setSelectedSubs]   = useState<number[]>([]);

  const catId   = Array.isArray(category_id)   ? category_id[0]   : (category_id   || '');
  const catName = Array.isArray(category_name) ? category_name[0] : (category_name || 'Catégorie');

  const [fontsLoaded] = useFonts({
      Inter_400Regular, Inter_500Medium,
      Inter_600SemiBold, Inter_700Bold,
    });

  const loadArticles = async (pageNum = 1, reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        const [subs, cats] = await Promise.all([
          CatalogService.getSubCategories(Number(catId)),
          CatalogService.getCategories(),
        ]);
        setSubCategories(subs);
        setAllCategories(cats);
      } else {
        setLoadingMore(true);
      }

      const result: ArticlesResponse = await CatalogService.getArticlesByCategory(
        Number(catId),
        { page: pageNum, limit: 20, search: search || undefined }
      );

      if (reset) {
        setArticles(result.data);
      } else {
        setArticles((prev) => [...prev, ...result.data]);
      }
      setTotalPages(result.pagination.pages);
      setPage(pageNum);
    } catch (err) {
      console.log('Error loading articles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadArticles(1, true); }, [catId]);

  useEffect(() => {
    ProfileService.listFavorites()
      .then(favs => favoritesStore.setIds(new Set(favs.map(f => f.id))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadArticles(1, true), 400);
    return () => clearTimeout(t);
  }, [search]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadArticles(1, true); }, []);

  const onLoadMore = () => {
    if (!loadingMore && page < totalPages) loadArticles(page + 1, false);
  };

  const filtered = useMemo(() => {
  return articles.filter((a) => {
    const matchSub = selectedSubs.length > 0
      ? selectedSubs.includes(a.sub_category?.id ?? 0)
      : selectedSub ? a.sub_category?.id === selectedSub : true;
    return matchSub;
  });
}, [articles, selectedSub, selectedSubs]);

  return (
    <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <PageHeader title={catName} />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        onFilter={() => setFilterVisible(true)}
        articleNames={articles.map(a => a.name_fr)}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
  <>
    {subCategories.length > 0 && selectedSubs.length === 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
        <SubCatPill label="Tout" selected={selectedSub === null} onPress={() => setSelectedSub(null)} />
        {subCategories.map((sub) => (
          <SubCatPill
            key={sub.id}
            label={sub.name_fr}
            image_path={sub.image_path}
            selected={selectedSub === sub.id}
            onPress={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)}
          />
        ))}
      </ScrollView>
    ) : null}
  </>
}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={RED} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aucun produit trouvé</Text>
            </View>
          }
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <ProductCard
              article={item}
              onPress={() => router.push({ pathname: '/main/product-detail' as any, params: { article_id: item.id } })}
            />
          )}
        />
      )}

      <FilterModal
        visible={filterVisible}
        categories={[]}
        subCategories={subCategories}
        selected={selectedCats}
        selectedSubs={selectedSubs}
        onApply={(ids, subIds) => {
          setSelectedCats(ids);
          setSelectedSubs(subIds);
          setSelectedSub(null);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  pillsContainer: { paddingHorizontal: 0, gap: 10, marginBottom: 16, alignItems: 'flex-start' },
  pill:           { alignItems: 'center', gap: 6, width: 68 },
  pillImageBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  pillImageBoxSelected: { borderColor: RED, backgroundColor: '#FFF0F0' },
  pillImage:            { width: '100%', height: '100%' },
  pillLabel:            { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  pillLabelSelected:    { color: RED, fontFamily:'Inter_700Bold' },
  grid: { paddingHorizontal: 16, paddingBottom: 100 },
  row:  { justifyContent: 'space-between', marginBottom: 16, marginTop: 10 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:        { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontFamily: 'Inter_400Regular' },
});