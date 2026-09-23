import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity,
  ActivityIndicator, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ProductCard from '../../../components/ui/ProductCard';
import { SearchField } from '../../../components/ui/CatalogKit';
import { CatalogService, Article, SubCategory, EntityId } from '../../../services/catalog.service';
import { C, F, S, R, ScreenHeader, EmptyState } from '../../../theme/atina';
import { t, tName } from '../../../i18n';

const { width } = Dimensions.get('window');
const GAP = 12;
const CARD = (width - S.lg * 2 - GAP) / 2;
const PAGE = 20;
const ALL = '__all__';

/** Pastille ronde de sous-catégorie (maquette : anneau rouge + libellé rouge si sélectionnée). */
function Pill({ label, uri, selected, onPress }: { label: string; uri?: string | null; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.85} accessibilityState={{ selected }}>
      <View style={[styles.pillCircle, selected && styles.pillCircleOn]}>
        {uri
          ? <Image source={{ uri }} style={styles.pillImg} contentFit="cover" cachePolicy="memory-disk" />
          : <Feather name="grid" size={20} color={selected ? C.red : C.greyLight} />}
      </View>
      <Text style={[styles.pillLabel, selected && styles.pillLabelOn]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Produits d'une catégorie (axe thématique US-024), présentation identique à la maquette Figma. */
export default function CategoryProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category_id: string; category_name?: string }>();
  const categoryId = String(params.category_id ?? '');

  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [selected, setSelected] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  useEffect(() => {
    if (!categoryId) return;
    CatalogService.getSubCategories(categoryId).then(setSubs).catch(() => setSubs([]));
  }, [categoryId]);

  const fetchPage = useCallback(async (p: number, reset: boolean) => {
    const id = ++reqId.current;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      setError('');
      const res = await CatalogService.searchArticles({
        category_id: categoryId as EntityId,
        ...(selected !== ALL ? { subfamily_id: selected } : {}),
        ...(query.trim() ? { search: query.trim() } : {}),
        page: p,
        limit: PAGE,
      });
      if (id !== reqId.current) return;
      setItems((prev) => (reset ? res.data : [...prev, ...res.data]));
      setPage(p);
      setHasMore(p < (res.pagination?.pages ?? 1));
    } catch (e: any) {
      if (id === reqId.current) setError(e?.message ?? t('Impossible de charger les produits.'));
    } finally {
      if (id === reqId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [categoryId, selected, query]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1, true), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPage, query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScreenHeader
        title={String(params.category_name ?? t('Produits'))}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/main/main_nav/categories' as any))}
      />
      <View style={styles.searchWrap}>
        <SearchField value={query} onChangeText={setQuery} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(a, i) => `${a.id}-${i}`}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasMore && !loading && !loadingMore) fetchPage(page + 1, false); }}
        ListHeaderComponent={
          subs.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
              <Pill label={t('Tout')} selected={selected === ALL} onPress={() => setSelected(ALL)} />
              {subs.map((s) => (
                <Pill
                  key={String(s.id)}
                  label={tName(s)}
                  uri={s.image_url ?? s.image_path}
                  selected={selected === String(s.id)}
                  onPress={() => setSelected(String(s.id))}
                />
              ))}
            </ScrollView>
          ) : null
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator color={C.red} style={{ marginTop: 40 }} /> : (
            <EmptyState
              icon={error ? 'wifi-off' : 'package'}
              title={error ? t('Catalogue indisponible') : t('Aucun produit trouvé')}
              text={error || t('Aucun produit disponible pour le moment.')}
              actionLabel={error ? t('Réessayer') : undefined}
              onAction={error ? () => fetchPage(1, true) : undefined}
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={C.red} style={{ marginVertical: S.lg }} /> : null}
        renderItem={({ item }) => (
          <ProductCard
            article={item}
            width={CARD}
            onPress={() => router.push({ pathname: '/main/product-detail', params: { article_id: String(item.id) } } as any)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  searchWrap: { paddingHorizontal: S.lg, paddingBottom: S.sm },
  pills: { gap: 14, paddingBottom: 14, paddingTop: 4 },
  pill: { alignItems: 'center', width: 70 },
  pillCircle: {
    width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: C.bgSoft,
    borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  pillCircleOn: { borderColor: C.red },
  pillImg: { width: '100%', height: '100%' },
  pillLabel: { marginTop: 6, fontSize: 12.5, color: C.ink, fontFamily: F.medium },
  pillLabelOn: { color: C.red, fontFamily: F.bold },
  grid: { paddingHorizontal: S.lg, paddingBottom: 120, gap: GAP },
});
