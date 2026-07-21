import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import FilterModal   from '../../../components/ui/FilterModal';
import PageHeader    from '../../../components/ui/PageHeader';
import SearchBar     from '../../../components/ui/SearchBar';
import { CatalogService, Category } from '../../../services/catalog.service';

const { width } = Dimensions.get('window');
const RED       = '#E10600';
const COLS      = 3;
const GAP       = 12;
const H_PADDING = 16;
const CARD_SIZE = (width - H_PADDING * 2 - GAP * (COLS - 1)) / COLS;

const CategoryCard = ({
  category, onPress,
}: { category: Category; onPress: () => void }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.imageBox}>
      {category.image_path ? (
        <Image
          source={{ uri: category.image_path }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Feather name="image" size={28} color="#D0C9BF" />
        </View>
      )}
    </View>
    <Text style={styles.cardLabel} numberOfLines={2}>{category.name_fr}</Text>
  </TouchableOpacity>
);

export default function CategoriesScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  const [categories, setCategories]       = useState<Category[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCats, setSelectedCats]   = useState<number[]>([]);

  const loadCategories = async () => {
    try {
      const data = await CatalogService.getCategories();
      setCategories(data);
    } catch (err) {
      console.log('Error loading categories:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadCategories(); }, []);

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      const matchSearch = search.trim() === '' ||
        c.name_fr.toLowerCase().includes(search.toLowerCase()) ||
        c.name_ar.toLowerCase().includes(search.toLowerCase());
      const matchFilter = selectedCats.length === 0 || selectedCats.includes(c.id);
      return matchSearch && matchFilter;
    });
  }, [categories, search, selectedCats]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <PageHeader title="Catégories" />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        onFilter={() => setFilterVisible(true)}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aucune catégorie trouvée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <CategoryCard
              category={item}
              onPress={() => router.push({
                pathname: '/main/main_nav/category-products' as any,
                params: { category_id: item.id, category_name: item.name_fr },
              })}
            />
          )}
        />
      )}

      <FilterModal
        visible={filterVisible}
        categories={categories}
        subCategories={[]}
        selected={selectedCats}
        selectedSubs={[]}
        onApply={(ids) => { setSelectedCats(ids); setFilterVisible(false); }}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
grid: { paddingHorizontal: H_PADDING, paddingBottom: 24 },
row:  { gap: GAP, marginBottom: 16 },
  card: { width: CARD_SIZE, alignItems: 'center' },
  imageBox: {
    width: CARD_SIZE, height: CARD_SIZE,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#f4f3f3', marginBottom: 8,
  },
  image:            { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 12, color: '#1a1a1a', textAlign: 'center', lineHeight: 16, fontFamily: 'Inter_500Medium' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:        { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontFamily: 'Inter_400Regular' },
  
});