import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RED, RED_SOFT } from './onboardingKit';

/**
 * Illustration « Gagnez des cadeaux exclusifs » composée en vectoriel (aucune image
 * de cadeaux n'existe dans assets). Peut être remplacée par un PNG dans assets/images/app/.
 */
export default function GiftsIllustration({ size = 250 }: { size?: number }) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <View style={[styles.disc, { width: s * 0.86, height: s * 0.86, borderRadius: s, top: s * 0.07, left: s * 0.07 }]} />

      {/* Cadeau principal */}
      <View style={[styles.abs, { top: s * 0.2, left: s * 0.22 }]}>
        <MaterialCommunityIcons name="gift" size={s * 0.5} color={RED} />
      </View>
      {/* Cadeaux secondaires */}
      <View style={[styles.abs, { top: s * 0.52, left: s * 0.06 }]}>
        <MaterialCommunityIcons name="gift-outline" size={s * 0.26} color={RED} />
      </View>
      <View style={[styles.abs, { top: s * 0.5, right: s * 0.04 }]}>
        <MaterialCommunityIcons name="gift-open-outline" size={s * 0.3} color="#F05A4F" />
      </View>
      <View style={[styles.abs, { top: s * 0.08, right: s * 0.1 }]}>
        <MaterialCommunityIcons name="ticket-percent-outline" size={s * 0.18} color="#F05A4F" />
      </View>

      {/* Confettis */}
      <View style={[styles.abs, { top: s * 0.06, left: s * 0.16 }]}>
        <MaterialCommunityIcons name="star-four-points" size={s * 0.08} color={RED} />
      </View>
      <View style={[styles.abs, { top: s * 0.3, right: s * 0.02 }]}>
        <MaterialCommunityIcons name="star-four-points" size={s * 0.06} color="#F7A09A" />
      </View>
      <View style={[styles.abs, { bottom: s * 0.06, left: s * 0.42 }]}>
        <MaterialCommunityIcons name="star-four-points" size={s * 0.07} color="#F05A4F" />
      </View>
      <View style={[styles.dot, { top: s * 0.16, left: s * 0.05, backgroundColor: '#F7A09A' }]} />
      <View style={[styles.dot, { top: s * 0.4, left: s * 0.02, backgroundColor: RED }]} />
      <View style={[styles.dot, { bottom: s * 0.14, right: s * 0.14, backgroundColor: '#F7A09A' }]} />
      <View style={[styles.dot, { top: s * 0.02, right: s * 0.36, backgroundColor: RED }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { position: 'absolute', backgroundColor: RED_SOFT },
  abs: { position: 'absolute' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
});
