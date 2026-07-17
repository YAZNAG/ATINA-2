import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';

const RED = '#E10600';

export default function OrderConfirmedScreen() {
  const router = useRouter();
  const { reference } = useLocalSearchParams<{ reference?: string }>();

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>

        {/* ── Icône succès ── */}
        <View style={styles.iconWrap}>
          <Feather name="check" size={44} color="#fff" />
        </View>

        {/* ── Texte ── */}
        <Text style={styles.title}>Commande confirmée !</Text>
        <Text style={styles.subtitle}>
          {reference
            ? `Votre commande a été\ntraitée avec succès. Vous recevrez\nun SMS de confirmation.`
            : `Votre commande a été traitée avec\nsuccès. Vous recevrez un SMS\nde confirmation.`}
        </Text>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnTrack}
            onPress={() => {
              if (router.canDismiss?.()) router.dismissAll();
              router.replace('/order/orders' as any);}}
            activeOpacity={0.85}
          >
            <Text style={styles.btnTrackText}>Suivre ma commande</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnHome}
            onPress={() => router.replace('/main/home' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnHomeText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },

  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#1a1a1a',
    marginBottom: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 48,
  },

  actions: { width: '100%', gap: 14 },

  btnTrack: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnTrackText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },

  btnHome: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  btnHomeText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
