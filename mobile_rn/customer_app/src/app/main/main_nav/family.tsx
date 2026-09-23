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
import { ScreenTitle, SearchField } from '../../../components/ui/CatalogKit';
import { CatalogService, Article, Family } from '../../../services/catalog.service';
import { getSavedLang, Lang } from '../../../components/onboarding/onboardingKit';
import { t } from '../../../i18n';

const RED = '#E10600';
const { width } = Dimensions.get('window');
const GAP = 12;
const CARD = (width - 32 - GAP) / 2;
const PAGE = 20;
const ALL = '__all__';

/** Pastille ronde de sous-famille (maquette) : anneau rouge et libellé rouge si sélectionnée. */
function Chip({ label, uri, selected, onPress }: { label: string; uri?: string | null; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.8} accessibilityState={{ selected }}>
      <View style={[styles.chipCircle, selected && styles.chipCircleActive]}>
        {uri
          ? <Image source={{ uri }} style={styles.chipImg} contentFit="cover" cachePolicy="memory-disk" />
          : <Image source={require('../../../../assets/images/atina/basket_small.png')} style={styles.chipImg} contentFit="contain" />}
      </View>
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Page d'une famille : pastilles de sous-familles + grille de produits (maquette « Pâte, Riz & Couscous »). */
export default function FamilyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ family_id: string; family_name?: string }>();
  const familyId = String(params.family_id ?? '');

  const [lang, setLang] = useState<Lang>('fr');
  const [family, setFamily] = useState<Family | null>(null);
  const [subs, setSubs] = useState<Family[]>([]);
  const [selected, setSelected] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const name = (f: { name_fr: string; name_ar?: string | null }) => (lang === 'ar' && f.name_ar ? f.name_ar : f.name_fr);

  useEffect(() => {
    getSavedLang().then(setLang);
    if (!familyId) return;
    CatalogService.getFamilySubfamilies(familyId)
      .then((r) => { setFamily(r.family); setSubs(r.subfamilies); })
      .catch(() => setSubs([]));
  }, [familyId]);

  const fetchPage = useCallback(async (p: number, reset: boolean) => {
    const id = ++reqId.current;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      setError('');
      const res = await CatalogService.searchArticles({
        family_id: familyId,
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
  }, [familyId, selected, query]);

  // Recherche avec un court délai de frappe ; changement de pastille immédiat.
  useEffect(() => {
    const t = setTimeout(() => fetchPage(1, true), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchPage, query]);

  const title = family ? name(family) : String(params.family_name ?? t('Produits'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScreenTitle title={title} onBack={() => (router.canGoBack() ? router.back() : router.navigate('/main/main_nav/products' as any))} />
      <View style={styles.sticky}>
        <SearchField value={query} onChangeText={setQuery} />
        {subs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            <Chip label={t('Tout')} uri={family?.image_url} selected={selected === ALL} onPress={() => setSelected(ALL)} />
            {subs.map((sf) => (
              <Chip key={sf.id} label={name(sf)} uri={sf.image_url} selected={selected === sf.id} onPress={() => setSelected(sf.id)} />
            ))}
          </ScrollView>
        )}
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
        ListEmptyComponent={
          loading ? <ActivityIndicator color={RED} style={{ marginTop: 40 }} /> : (
            <View style={styles.empty}>
              <Feather name={error ? 'wifi-off' : 'package'} size={30} color="#C4C4C4" />
              <Text style={styles.emptyText}>{error || t('Aucun produit disponible pour le moment.')}</Text>
              {!!error && (
                <TouchableOpacity onPress={() => fetchPage(1, true)}>
                  <Text style={styles.retry}>{t('Réessayer')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={RED} style={{ marginVertical: 16 }} /> : null}
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
  safe: { flex: 1, backgroundColor: '#fff' },
  // Bloc fixe sous l'en-tête : recherche + pastilles de sous-familles
  sticky: {
    paddingHorizontal: 16, paddingBottom: 6, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  chips: { gap: 14, paddingBottom: 12, paddingTop: 10 },
  chip: { alignItems: 'center', width: 70 },
  chipCircle: {
    width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: '#F4F4F4',
    borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  chipCircleActive: { borderColor: RED },
  chipImg: { width: '100%', height: '100%' },
  chipLabel: { marginTop: 6, fontSize: 12.5, color: '#0A0A0A', fontFamily: 'Inter_500Medium' },
  chipLabelActive: { color: RED, fontFamily: 'Inter_700Bold' },
  grid: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: GAP },
  empty: { alignItems: 'center', paddingTop: 50, gap: 10, paddingHorizontal: 30 },
  emptyText: { color: '#8A8A8A', fontSize: 13.5, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  retry: { color: RED, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
