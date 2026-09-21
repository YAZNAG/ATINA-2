import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CatalogService, Family } from '../../../services/catalog.service';
import { getSavedLang, Lang } from '../../../components/onboarding/onboardingKit';
import { ScreenTitle, SearchField } from '../../../components/ui/CatalogKit';
import { t } from '../../../i18n';

const RED = '#E10600';
const { width } = Dimensions.get('window');
const COLS = 3;
const GAP = 12;
const TILE = (width - 32 - GAP * (COLS - 1)) / COLS;

/** Onglet « Produits » (maquette) : grille des familles illustrées. */
export default function ProductsScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('fr');
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setFamilies(await CatalogService.getFamilies());
    } catch (e: any) {
      setError(e?.message ?? t('Impossible de charger les produits.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { getSavedLang().then(setLang); load(); }, [load]);

  const name = (f: Family) => (lang === 'ar' && f.name_ar ? f.name_ar : f.name_fr);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? families.filter((f) => f.name_fr.toLowerCase().includes(q) || (f.name_ar ?? '').includes(q)) : families;
  }, [families, query]);

  const openSearch = () => {
    if (query.trim()) router.push({ pathname: '/main/search', params: { q: query.trim() } } as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenTitle title={t('Produits')} onBack={() => router.navigate('/main/main_nav/home')} />
      <View style={styles.searchWrap}>
        <SearchField value={query} onChangeText={setQuery} onSubmit={openSearch} />
      </View>

      {loading ? (
        <ActivityIndicator color={RED} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(f) => f.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={RED} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={error ? 'wifi-off' : 'search'} size={30} color="#C4C4C4" />
              <Text style={styles.emptyText}>
                {error || (query ? t('Aucune famille ne correspond. Validez pour chercher un produit.') : t('Aucun produit disponible.'))}
              </Text>
              {!!error && (
                <TouchableOpacity onPress={() => { setLoading(true); load(); }}>
                  <Text style={styles.retry}>{t('Réessayer')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/main/main_nav/family', params: { family_id: item.id, family_name: name(item) } } as any)}
            >
              <View style={styles.tileImg}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={styles.img} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                  : <Feather name="grid" size={26} color="#C4C4C4" />}
              </View>
              <Text style={styles.tileName} numberOfLines={1}>{name(item)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  grid: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 120, gap: 16 },
  tile: { width: TILE, alignItems: 'center' },
  tileImg: {
    width: TILE, height: TILE * 0.82, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },
  tileName: { marginTop: 6, fontSize: 12, color: '#0A0A0A', fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyText: { color: '#8A8A8A', fontSize: 13.5, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retry: { color: RED, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
