import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CartProvider } from '../context/CartContext';
import { NotificationProvider } from '../context/NotificationContext';
import AppUpdater from '../components/AppUpdater';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { initI18n } from '../i18n';
import { hydrateHomeCache } from '../store/homeCache';

export default function RootLayout() {
  // Police de la maquette Figma : Inter. Les écrans référencent les clés « Poppins_* »
  // historiques ; elles pointent désormais vers Inter, sans toucher à chaque style.
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular: Inter_400Regular,
    Poppins_500Medium: Inter_500Medium,
    Poppins_600SemiBold: Inter_600SemiBold,
    Poppins_700Bold: Inter_700Bold,
    Poppins_800ExtraBold: Inter_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Langue et sens d'écriture (RTL en arabe) fixés avant le premier écran.
  const [langReady, setLangReady] = useState(false);
  useEffect(() => {
    hydrateHomeCache().catch(() => {});
    initI18n().finally(() => setLangReady(true));
  }, []);

  // Filet de sécurité : si les polices ou la langue ne répondent pas (réseau, cache
  // d'assets), l'application s'affiche quand même au bout de 2,5 s au lieu de rester
  // bloquée sur l'écran de démarrage.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const ready = (fontsLoaded || !!fontError || timedOut) && (langReady || timedOut);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NotificationProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <AppUpdater />
        </CartProvider>
      </NotificationProvider>
    </SafeAreaProvider>
  );
}