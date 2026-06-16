import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
 Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader'
import CheckoutStepper from '../../components/ui/CheckoutStepper'

const RED = '#E10600';

type DeliveryMode = 'home' | 'pickup' | null;

export default function CheckoutDeliveryModeScreen() {
  const router = useRouter();
  const { cart_items } = useLocalSearchParams<{ cart_items: string }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  const [selected, setSelected] = useState<DeliveryMode>(null);

  if (!fontsLoaded) return null;

  const handleContinue = () => {
    if (!selected) return;

    if (selected === 'home') {
      // Livraison à domicile → page d'adresse
      router.push({
        pathname: '/order/delivery_address' as any,
        params: { delivery_type_code: 'home', cart_items },
      });
    } else {
      // Retrait en magasin → page de sélection du magasin
      router.push({
        pathname: '/order/delivery_pickup' as any,
        params: { delivery_type_code: 'pickup', cart_items },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>

        {/* ── Header ── */}
        <PageHeader title="Mode de réception" />

        {/* ── Stepper ── */}
        <CheckoutStepper currentStep={1} />

        {/* ── Subtitle ── */}
        <Text style={styles.subtitle}>
          Choisissez comment vous souhaitez recevoir votre commande.
        </Text>

        {/* ── Options ── */}
        <View style={styles.options}>

          <TouchableOpacity
            style={[styles.optionCard, selected === 'home' && styles.optionCardSelected]}
            onPress={() => setSelected('home')}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIcon, selected === 'home' && styles.optionIconSelected]}>
              <Feather name="truck" size={22} color={selected === 'home' ? RED : '#6B7280'} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, selected === 'home' && styles.optionTitleSelected]}>
                Livraison à domicile
              </Text>
              <Text style={styles.optionDesc}>Recevez votre commande rapidement chez vous.</Text>
            </View>
            {selected === 'home' && (
              <Feather name="check-circle" size={20} color={RED} style={styles.optionCheck} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, selected === 'pickup' && styles.optionCardSelected]}
            onPress={() => setSelected('pickup')}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIcon, selected === 'pickup' && styles.optionIconSelected]}>
              <Feather name="shopping-bag" size={22} color={selected === 'pickup' ? RED : '#6B7280'} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, selected === 'pickup' && styles.optionTitleSelected]}>
                Retrait en magasin
              </Text>
              <Text style={styles.optionDesc}>Récupérez votre commande directement au magasin.</Text>
            </View>
            {selected === 'pickup' && (
              <Feather name="check-circle" size={20} color={RED} style={styles.optionCheck} />
            )}
          </TouchableOpacity>

        </View>

        {/* ── Continue button ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnContinue, !selected && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Continuer</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12 },

  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20, marginBottom: 20 },

  options: { gap: 14 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, backgroundColor: '#fff' },
  optionCardSelected: { borderColor: RED, backgroundColor: '#FFF8F8' },
  optionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  optionIconSelected: { backgroundColor: '#FFE8E8' },
  optionText:  { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', marginBottom: 2 },
  optionTitleSelected: { color: RED },
  optionDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 18 },
  optionCheck: { marginLeft: 4 },

  footer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 24, left: 20, right: 20 },
  btnContinue: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnDisabled: { backgroundColor: '#E5E7EB',  shadowColor: '#00000026', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});