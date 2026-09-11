import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { RED, ONBOARDING_DONE_KEY, prefGet } from '../components/onboarding/onboardingKit';

const { width } = Dimensions.get('window');

/** Écran de démarrage : fond rouge, mot « Atina. » et cercles décoratifs (maquette onboarding). */
export default function SplashScreen() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(async () => {
      const done = await prefGet(ONBOARDING_DONE_KEY);
      router.replace(done ? '/auth/login' : '/onboarding');
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />

      {/* Cercles décoratifs (haut droite, bas gauche) */}
      <View style={[styles.ring, styles.ringTopLarge]} />
      <View style={[styles.ring, styles.ringTopSmall]} />
      <View style={[styles.ring, styles.ringBottomLarge]} />
      <View style={[styles.ring, styles.ringBottomSmall]} />

      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <Text style={styles.wordmark} accessibilityRole="header">Atina.</Text>
      </Animated.View>
    </View>
  );
}

const RING = 'rgba(255,255,255,0.28)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wordmark: {
    color: '#fff',
    fontSize: 46,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.5,
  },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: RING, borderRadius: 999 },
  ringTopLarge: { width: width * 0.62, height: width * 0.62, top: -width * 0.24, right: -width * 0.22 },
  ringTopSmall: { width: width * 0.34, height: width * 0.34, top: width * 0.06, right: -width * 0.1 },
  ringBottomLarge: { width: width * 0.7, height: width * 0.7, bottom: -width * 0.3, left: -width * 0.26 },
  ringBottomSmall: { width: width * 0.3, height: width * 0.3, bottom: width * 0.08, left: -width * 0.08 },
});
