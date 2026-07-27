import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SlideItem } from '../../../services/promotions.service';

const { width } = Dimensions.get('window');
const RED = '#E10600';
const SLIDE_INTERVAL = width * 0.82 + 12;

interface PromoSlidesSectionProps {
  slides: SlideItem[];
  activeSlide: number;
  onScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

function PromoSlidesSection({ slides, activeSlide, onScrollEnd }: PromoSlidesSectionProps) {
  const router = useRouter();

  const renderPromoSlide = useCallback(({ item }: { item: SlideItem }) => {
    const isPack = item.type === 'pack';
    const hasImg = !!item.image_url;
    return (
      <TouchableOpacity
        style={styles.promoSlide}
        activeOpacity={0.88}
        onPress={() =>
          router.push({
            pathname: '/main/promotion_detail' as any,
            params: { id: item.id, type: item.type },
          })
        }
      >
        <View style={[styles.promoClip, !hasImg && { backgroundColor: RED }]}>
          {hasImg ? (
            <Image
              source={{ uri: item.image_url! }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.promoOverlay}>
              <Text style={styles.promoSpecial}>
                ✦  {isPack ? 'PACK ÉCONOMIQUE' : 'OFFRE SPÉCIALE'}  ✦
              </Text>
              <Text style={styles.promoSlideName} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.promoSlideScope} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
          )}
        </View>
        {!hasImg && item.discount_pct != null && (
          <View style={styles.starBadgeWrap}>
            <View style={styles.starShape} />
            <View style={[styles.starShape, { transform: [{ rotate: '22.5deg' }] }]} />
            <View style={styles.starBadgeContent}>
              <Text style={[styles.starBadgePct, { color: RED }]}>{item.discount_pct}%</Text>
              <Text style={[styles.starBadgeOff, { color: RED }]}>OFF</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [router]);

  if (slides.length === 0) return null;

  return (
    <View style={styles.section}>
      <FlatList
        data={slides}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLIDE_INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={renderPromoSlide}
        onMomentumScrollEnd={onScrollEnd}
      />

      {slides.length > 1 && (
        <View style={styles.dotsContainer}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeSlide && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },

  promoSlide: {
    width: width * 0.82,
    height: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 14, elevation: 6,
  },
  promoClip: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  promoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  promoSpecial: {
    fontSize: 10, fontFamily: 'Poppins_700Bold', color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2, marginBottom: 8,
  },
  promoSlideName: {
    fontSize: 22, fontFamily: 'Poppins_800ExtraBold', color: '#fff',
    lineHeight: 27, textAlign: 'center', marginBottom: 6,
  },
  promoSlideScope: {
    fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center',
  },

  starBadgeWrap: {
    position: 'absolute', top: -10, right: -8,
    width: 64, height: 64, alignItems: 'center', justifyContent: 'center',
  },
  starShape: {
    position: 'absolute', width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#FFF8E7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  starBadgeContent: { alignItems: 'center', justifyContent: 'center' },
  starBadgePct:     { fontSize: 15, fontFamily: 'Poppins_800ExtraBold', lineHeight: 17 },
  starBadgeOff:     { fontSize: 8, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },

  dotsContainer: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 10, gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8D4D4' },
  dotActive: { width: 18, backgroundColor: RED },
});

export default React.memo(PromoSlidesSection);