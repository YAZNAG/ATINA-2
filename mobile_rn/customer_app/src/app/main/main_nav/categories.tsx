import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SearchField } from '../../../components/ui/CatalogKit';
import { CatalogService, Category } from '../../../services/catalog.service';
import { C, F, S, R, ScreenHeader, EmptyState, shadow } from '../../../theme/atina';
import { t, tName } from '../../../i18n';

const { width } = Dimensions.get('window');
const COLS = 3;
const GAP = 12;
const TILE = (width - S.lg * 2 - GAP * (COLS - 1)) / COLS;

/** Onglet « Catégories » : grille illustrée, même langage visuel que l'onglet Produits (Figma). */
export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setCategories(await CatalogService.getCategories());
    } catch (e: any) {
      setError(e?.message ?? t('Impossible de charger le catalogue'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name_fr.toLowerCase().includes(q) || (c.name_ar ?? '').includes(query.trim()));
  }, [categories, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScreenHeader title={t('Catégories')} onBack={() => router.navigate('/main/main_nav/home')} />
      <View style={styles.searchWrap}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          onSubmit={() => query.trim() && router.push({ pathname: '/main/search', params: { q: query.trim() } } as any)}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => String(c.id)}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.red} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'wifi-off' : 'search'}
              title={error ? t('Catalogue indisponible') : t('Aucune catégorie trouvée')}
              text={error || t('Essayez un autre mot-clé.')}
              actionLabel={error ? t('Réessayer') : undefined}
              onAction={error ? () => { setLoading(true); load(); } : undefined}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => router.push({
                pathname: '/main/main_nav/category-products',
                params: { category_id: String(item.id), category_name: tName(item) },
              } as any)}
            >
              <View style={styles.tileImg}>
                {item.image_path ? (
                  <Image source={{ uri: item.image_path }} style={styles.img} contentFit="contain" transition={150} cachePolicy="memory-disk" />
                ) : (
                  <Image source={require('../../../../assets/images/atina/basket_small.png')} style={styles.img} contentFit="contain" />
                )}
              </View>
              <Text style={styles.tileName} numberOfLines={2}>{tName(item)}</Text>
              {item.article_count > 0 && (
                <Text style={styles.tileCount}>{item.article_count} {t('produits')}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  searchWrap: { paddingHorizontal: S.lg, paddingBottom: S.md },
  grid: { paddingHorizontal: S.lg, paddingTop: 6, paddingBottom: 120, gap: S.lg },
  tile: { width: TILE, alignItems: 'center' },
  tileImg: {
    width: TILE, height: TILE * 0.82, borderRadius: R.md, overflow: 'hidden',
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', ...shadow,
  },
  img: { width: '100%', height: '100%' },
  tileName: { marginTop: 6, fontSize: 12, color: C.ink, fontFamily: F.semi, textAlign: 'center' },
  tileCount: { fontSize: 10.5, color: C.grey, fontFamily: F.regular, marginTop: 1 },
});
