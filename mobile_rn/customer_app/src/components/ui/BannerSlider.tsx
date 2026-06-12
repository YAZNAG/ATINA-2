import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Dimensions, TouchableOpacity,
} from 'react-native';

const { width } = Dimensions.get('window');
const RED = '#E10600';

const BANNERS = [
  {
    id: 1,
    title: 'RAMADAN\nSALE',
    subtitle: '+ SPECIAL OFFER',
    badge: '40%',
    badgeLabel: 'OFF',
    bg: RED,
    textColor: '#fff',
  },
  {
    id: 2,
    title: 'NOUVEAUX\nPRODUITS',
    subtitle: '+ OFFRE SPÉCIALE',
    badge: '20%',
    badgeLabel: 'OFF',
    bg: '#1a1a2e',
    textColor: '#fff',
  },
  {
    id: 3,
    title: 'LIVRAISON\nGRATUITE',
    subtitle: '+ COMMANDE > 100 MAD',
    badge: 'FREE',
    badgeLabel: 'FREE',
    bg: '#2d6a4f',
    textColor: '#fff',
  },
];

export default function BannerSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
    setActiveIndex(index);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={width - 32 + 12}
        decelerationRate="fast"
      >
        {BANNERS.map((banner) => (
          <TouchableOpacity
            key={banner.id}
            activeOpacity={0.95}
            style={[styles.banner, { backgroundColor: banner.bg }]}
          >
            {/* Left content */}
            <View style={styles.bannerLeft}>
              <Text style={[styles.bannerSubtitle, { color: banner.textColor }]}>
                {banner.subtitle}
              </Text>
              <Text style={[styles.bannerTitle, { color: banner.textColor }]}>
                {banner.title}
              </Text>
              <Text style={[styles.bannerFooter, { color: banner.textColor }]}>
                ALL NEW PRODUCTS
              </Text>
            </View>

            {/* Right badge */}
            <View style={styles.bannerRight}>
              <View style={styles.badgeCircle}>
                <Text style={styles.badgePercent}>{banner.badge}</Text>
                <Text style={styles.badgeLabel}>{banner.badgeLabel}</Text>
              </View>
            </View>

            {/* Decorative circles */}
            <View style={[styles.circle1, { borderColor: 'rgba(255,255,255,0.15)' }]} />
            <View style={[styles.circle2, { borderColor: 'rgba(255,255,255,0.10)' }]} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {BANNERS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const BANNER_WIDTH = width - 32;

const styles = StyleSheet.create({
  wrapper:       { marginBottom: 8 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },

  banner: {
    width: BANNER_WIDTH,
    height: 140,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  // ── Left ───────────────────────────────────────────────────────────────────
  bannerLeft:     { flex: 1 },
  bannerSubtitle: { fontSize: 11, fontWeight: '500', opacity: 0.85, marginBottom: 4 },
  bannerTitle:    { fontSize: 24, fontWeight: '900', lineHeight: 28, marginBottom: 6 },
  bannerFooter:   { fontSize: 10, opacity: 0.7, letterSpacing: 1 },

  // ── Right badge ────────────────────────────────────────────────────────────
  bannerRight:  { alignItems: 'center', justifyContent: 'center' },
  badgeCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  badgePercent: { fontSize: 18, fontWeight: '900', color: '#fff' },
  badgeLabel:   { fontSize: 10, fontWeight: '700', color: '#fff', opacity: 0.9 },

  // ── Decorative circles ─────────────────────────────────────────────────────
  circle1: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 1, top: -30, right: 60,
  },
  circle2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 1, bottom: -20, right: 20,
  },

  // ── Dots ───────────────────────────────────────────────────────────────────
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot:         { height: 6, borderRadius: 3 },
  dotActive:   { width: 20, backgroundColor: RED },
  dotInactive: { width: 6, backgroundColor: '#E0E0E0' },
});