import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const RED = '#E62A27';

export default function SuccessScreen() {
  const router = useRouter();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, friction: 4, useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />

      <View style={styles.container}>

        {/* ── Top red section ── */}
        <View style={styles.topRed} />

        {/* ── Middle section with card ── */}
        <View style={styles.middleSection}>
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

            {/* ── Check icon INSIDE card ── */}
            <Animated.View style={[styles.checkContainer, { transform: [{ scale: scaleAnim }] }]}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            </Animated.View>

            {/* ── Title ── */}
            <Text style={styles.title}>Bienvenue sur El Herri</Text>
            <Text style={styles.subtitle}>Votre compte a été créé avec succès</Text>

          </Animated.View>
        </View>

        {/* ── Bottom section with button ── */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.btnCommencer}
            onPress={() => router.replace('/main/main_nav/home')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnCommencerText}>Commencer</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: RED },
  container: { flex: 1 },

  // ── Sections ────────────────────────────────────────────────────────────────
  topRed: {
    flex: 1,
    backgroundColor: RED,
  },
  middleSection: {
    flex: 2,                     
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  // ── Card ────────────────────────────────────────────────────────────────────
  card: {
    width: width - 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 40,               
    paddingBottom: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Check icon INSIDE card ───────────────────────────────────────────────
  checkContainer: {
    marginBottom: 20,         
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  checkmark: { color: '#fff', fontSize: 32, fontWeight: '800' },

  // ── Text ────────────────────────────────────────────────────────────────────
  title: {
    fontSize: 22, fontWeight: '800', color: '#1a1a1a',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: '#9CA3AF',
    textAlign: 'center', lineHeight: 22,
  },

  // ── Button ──────────────────────────────────────────────────────────────────
  btnCommencer: {
    width: width - 48,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  btnCommencerText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});