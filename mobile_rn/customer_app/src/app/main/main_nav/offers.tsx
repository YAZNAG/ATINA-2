import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, Image as RNImage,
  RefreshControl, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ProductCard from '../../../components/ui/ProductCard';
import { PromotionsService, FlashSaleSummary, BestDeal } from '../../../services/promotions.service';
import { LoyaltyService, LoyaltySummary } from '../../../services/loyalty.service';
import { CouponsService } from '../../../services/coupons.service';
import { Article } from '../../../services/catalog.service';
import { t } from '../../../i18n';

const RED = '#E10600';
const { width } = Dimensions.get('window');
const CARD = (width - 32 - 12) / 2.2;

const IMG = {
  wheel:  require('../../../../assets/images/atina/wheel.png'),
  coins:  require('../../../../assets/images/atina/coins.png'),
  coupon: require('../../../../assets/images/atina/coupon.png'),
  gift:   require('../../../../assets/images/atina/gift.png'),
  trophy: require('../../../../assets/images/atina/trophy.png'),
};

function dealToArticle(d: BestDeal): Article {
  return {
    id: d.id, sku_code: d.sku_code ?? '', sku_id: d.sku_id, ean13: null,
    name_fr: d.name_fr, name_ar: d.name_ar, description_fr: null, description_ar: null,
    price: d.price, price_ttc: d.price_ttc, old_price_ttc: d.old_price_ttc, discount_pct: d.discount_pct,
    vat_rate: d.vat_rate, unit_sale: '', is_active: true, image_url: d.image_url, updated_at: '',
    images: [], brand: d.brand, category: d.category, sub_category: null,
  };
}

/** Tuile d'accès rapide (jeux, points, coupons, cadeaux) illustrée par les visuels Figma. */
function Tile({ title, subtitle, img, onPress, tint }: { title: string; subtitle: string; img: any; onPress: () => void; tint: string }) {
  return (
    <TouchableOpacity style={[styles.tile, { backgroundColor: tint }]} onPress={onPress} activeOpacity={0.85}>
      <RNImage source={img} style={styles.tileImg} resizeMode="contain" />
      <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

/** Onglet « Offres » : ventes flash, meilleures remises, jeux, points et coupons. */
export default function OffersScreen() {
  const router = useRouter();
  const [flash, setFlash] = useState<FlashSaleSummary[]>([]);
  const [deals, setDeals] = useState<BestDeal[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [couponCount, setCouponCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [f, d, l, c] = await Promise.allSettled([
      PromotionsService.listActive(),
      PromotionsService.listBestDeals(10, 1),
      LoyaltyService.getSummary(),
      CouponsService.listMyCoupons(),
    ]);
    if (f.status === 'fulfilled') setFlash(f.value);
    if (d.status === 'fulfilled') setDeals(d.value.data ?? []);
    if (l.status === 'fulfilled') setLoyalty(l.value);
    if (c.status === 'fulfilled') setCouponCount(c.value.available?.length ?? 0);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('Offres')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={RED} />}
      >
        {/* Bandeau points de fidélité */}
        <TouchableOpacity style={styles.hero} activeOpacity={0.9} onPress={() => router.push('/profile/loyalty' as any)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>{t('Mes points Atina')}</Text>
            <Text style={styles.heroPoints}>{loyalty ? loyalty.points_balance.toLocaleString('fr-FR') : '—'} pts</Text>
            {loyalty && loyalty.remaining_points > 0 && (
              <Text style={styles.heroHint}>Encore {loyalty.remaining_points} pts pour votre prochaine récompense</Text>
            )}
            {loyalty && (
              <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.min(100, loyalty.progress_pct)}%` }]} /></View>
            )}
          </View>
          <RNImage source={IMG.coins} style={styles.heroImg} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.tiles}>
          <Tile title={t('Jeux')} subtitle={t('Tournez la roue et gagnez')} img={IMG.wheel} tint="#FFF1F0" onPress={() => router.push('/games' as any)} />
          <Tile
            title={t('Coupons')}
            subtitle={couponCount != null ? `${couponCount} disponible${couponCount > 1 ? 's' : ''}` : 'Vos codes promo'}
            img={IMG.coupon}
            tint="#FFF7E6"
            onPress={() => router.push('/profile/coupons' as any)}
          />
          <Tile title={t('Cadeaux')} subtitle={t('Échangez vos points')} img={IMG.gift} tint="#F1F8F1" onPress={() => router.push('/rewards/exchange' as any)} />
          <Tile title={t('Mes gains')} subtitle={t('Lots gagnés aux jeux')} img={IMG.trophy} tint="#EEF4FF" onPress={() => router.push('/games/prizes' as any)} />
        </View>

        {flash.length > 0 && (
          <>
            <Text style={styles.section}>{t('Ventes flash')}</Text>
            <FlatList
              horizontal
              data={flash}
              keyExtractor={(f) => f.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.flash}
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/main/promotion_detail', params: { id: item.id } } as any)}
                >
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={styles.flashImg} contentFit="cover" />
                    : <View style={[styles.flashImg, styles.flashPh]}><Feather name="zap" size={28} color="#fff" /></View>}
                  <View style={styles.flashBody}>
                    <Text style={styles.flashName} numberOfLines={1}>{item.name_fr ?? item.scope_name ?? t('Vente flash')}</Text>
                    <Text style={styles.flashMeta}>
                      {item.discount_pct ? `-${item.discount_pct}% · ` : ''}{item.product_count} produit{item.product_count > 1 ? 's' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {deals.length > 0 && (
          <>
            <Text style={styles.section}>{t('Meilleures remises')}</Text>
            <FlatList
              horizontal
              data={deals}
              keyExtractor={(d, i) => `${d.id}-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              renderItem={({ item }) => (
                <ProductCard
                  article={dealToArticle(item)}
                  width={CARD}
                  onPress={() => router.push({ pathname: '/main/product-detail', params: { article_id: String(item.id) } } as any)}
                />
              )}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, alignItems: 'center' },
  headerTitle: { fontSize: 17, color: '#0A0A0A', fontFamily: 'Inter_700Bold' },
  hero: {
    marginHorizontal: 16, borderRadius: 20, backgroundColor: RED, padding: 18,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  heroPoints: { color: '#fff', fontSize: 28, fontFamily: 'Inter_800ExtraBold', marginTop: 2 },
  heroHint: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  progress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#FFD400' },
  heroImg: { width: 96, height: 72, marginLeft: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginTop: 16 },
  tile: { width: (width - 32 - 12) / 2, borderRadius: 16, padding: 14 },
  tileImg: { width: 54, height: 54, marginBottom: 8 },
  tileTitle: { fontSize: 15, color: '#0A0A0A', fontFamily: 'Inter_700Bold' },
  tileSub: { fontSize: 12, color: '#6B6B6B', fontFamily: 'Inter_400Regular', marginTop: 2 },
  section: { fontSize: 16, color: '#0A0A0A', fontFamily: 'Inter_700Bold', marginTop: 24, marginBottom: 12, paddingHorizontal: 16 },
  flash: {
    width: width * 0.62, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  flashImg: { width: '100%', height: 110 },
  flashPh: { backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  flashBody: { padding: 10 },
  flashName: { fontSize: 14, color: '#0A0A0A', fontFamily: 'Inter_700Bold' },
  flashMeta: { fontSize: 12, color: RED, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
});
