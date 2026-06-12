import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
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

import { CatalogService, Category, Article } from '../../services/catalog.service';
import { ProfileService, Address }           from '../../services/profile.service';

const { width } = Dimensions.get('window');
const RED = '#E10600';

export default function HomeScreen() {

  const router = useRouter();
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

  const loadData = async () => {
    try {
      const [cats, arts, addresses, recs] = await Promise.all([
        CatalogService.getCategories(),
        CatalogService.getArticles({ limit: 20 }),
        ProfileService.listAddresses(),
        CatalogService.getRecommendedArticles({ limit: 10 }).catch(() => []),
      ]);
      setCategories(cats);
      setArticles(arts);
      setRecommended(recs);
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0] || null;
      setDefaultAddress(defaultAddr);
    } catch (err) {
      console.log('Error loading data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUser = async () => {
    const userStr = await SecureStore.getItemAsync('user');
    if (userStr) setUser(JSON.parse(userStr));
  };

  useEffect(() => { loadUser(); loadData(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

  const filtered = articles.filter((a) => {
    const matchSearch = search ? a.name_fr.toLowerCase().includes(search.toLowerCase()) : true;
    const matchCat    = selectedCats.length > 0
      ? selectedCats.includes(a.category?.id ?? 0)
      : selectedCat ? a.category?.id === selectedCat : true;
    return matchSearch && matchCat;
  });

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/profile/addresses' as any)}>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={RED} />
            <Text style={styles.locationLabel}>Livrer à</Text>
            <Feather name="chevron-down" size={14} color="#1a1a1a" />
          </View>
          <Text style={styles.locationCity} numberOfLines={1}>
            {defaultAddress
              ? `Rue ${defaultAddress.street_name}, ${defaultAddress.city}`
              : 'Ajouter une adresse'}
          </Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/profile/notifications' as any)}
          >
            <Feather name="bell" size={20} color="#1a1a1a" />
            <View style={styles.notifBadge} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Search bar ── */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onFilter={() => setFilterVisible(true)}
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
        {/* ── Catégories ── */}
        <SectionHeader title="Catégories" onSeeAll={() => {}} />
        <CategoryList
          categories={categories}
          selectedId={selectedCat}
          onSelect={(cat) => {
            setSelectedCat(cat.id === 0 ? null : cat.id);
            setSelectedCats([]);
          }}
        />

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
                  onPress={() =>
                    router.push({ pathname: '/product/[id]', params: { id: item.id } } as any)
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
                  onPress={() =>
                    router.push({ pathname: '/product/[id]', params: { id: article.id } } as any)
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

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  locationRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Poppins_400Regular' },
  locationCity:  { fontSize: 15, color: '#1a1a1a', fontFamily: 'Poppins_700Bold' },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifBtn:      { position: 'relative' },
  notifBadge: {
    position: 'absolute', top: 0, right: 0,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: RED, borderWidth: 1, borderColor: '#fff',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins_700Bold' },

  section: { marginTop: 8 },

  // ── Recommandations horizontales ───────────────────────────────────────────
  horizontalList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },

  // ── Grille produits ────────────────────────────────────────────────────────
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
});