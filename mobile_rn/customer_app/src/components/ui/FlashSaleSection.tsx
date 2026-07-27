import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PromotionProduct, promotionProductToArticle } from '../../services/promotions.service';
import ProductCard from './ProductCard';

const RED       = '#E10600';
const RED_LIGHT = '#FF3D2E';
const RED_DARK  = '#B80400';

function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState(() => computeRemaining(endsAt));

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => setRemaining(computeRemaining(endsAt)), 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return remaining;
}

function computeRemaining(endsAt: string | null) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { h: 0, m: 0, s: 0, expired: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, expired: false };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

interface FlashSaleSectionProps {
  endsAt: string | null;
  products: PromotionProduct[];
}

function FlashSaleSection({ endsAt, products }: FlashSaleSectionProps) {
  const router = useRouter();
  const remaining = useCountdown(endsAt);

  if (!endsAt || products.length === 0 || remaining?.expired) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="zap" size={18} color={RED} />
          <Text style={styles.title}>Vente Flash</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>Profitez des meilleures promotions avant la fin de l'offre.</Text>

      {remaining && (
        <View style={styles.countdownShadowWrap}>
          <LinearGradient
            colors={[RED_LIGHT, RED, RED_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.countdownBar}
          >
            <View style={styles.countdownHeader}>
              <Feather name="clock" size={15} color="#fff" />
              <Text style={styles.countdownLabel}>Fin dans</Text>
              <Feather name="zap" size={15} color="#fff" />
            </View>

            <View style={styles.countdownBlocks}>
              <View style={styles.countdownBlock}>
                <Text style={styles.countdownValue}>{pad(remaining.h)}</Text>
                <Text style={styles.countdownUnit}>H</Text>
              </View>
              <View style={styles.countdownDots}>
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
              <View style={styles.countdownBlock}>
                <Text style={styles.countdownValue}>{pad(remaining.m)}</Text>
                <Text style={styles.countdownUnit}>MIN</Text>
              </View>
              <View style={styles.countdownDots}>
                <View style={styles.dot} />
                <View style={styles.dot} />
              </View>
              <View style={styles.countdownBlock}>
                <Text style={styles.countdownValue}>{pad(remaining.s)}</Text>
                <Text style={styles.countdownUnit}>SEC</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      <FlatList
        data={products}
        style={{ paddingBottom: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item.sku_id ?? item.id}-${i}`}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => (
          <ProductCard
            article={promotionProductToArticle(item)}
            discount={item.discount_pct}
            oldPrice={item.old_price}
            isFlashSale
            onPress={() => router.push({ pathname: '/main/product-detail' as any, params: { article_id: item.id } })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section:   { marginTop: 8, overflow: 'visible' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  title:     { fontSize: 19, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },
  seeAll:    { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: RED },
  subtitle:  { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: '#9CA3AF', paddingHorizontal: 16, marginBottom: 14 },

  countdownShadowWrap: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'visible',
  },
  countdownBar: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  countdownHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14,
  },
  countdownLabel: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#fff' },

  countdownBlocks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdownBlock: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 58,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  countdownValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff' },
  countdownUnit:  { fontSize: 10, fontFamily: 'Poppins_500Medium', color: 'rgba(255,255,255,0.85)' },

  countdownDots: { gap: 4, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' },
});

export default React.memo(FlashSaleSection);