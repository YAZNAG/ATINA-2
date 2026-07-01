import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import {
  useFonts, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ProfileService } from '../../services/profile.service';
import { getToken } from '../../services/customer_auth.service';

const RED = '#E10600';
export const LANG_KEY = 'preferred_lang';

type Lang = 'fr' | 'ar';

const LANGUAGES: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: 'fr', label: 'Français', native: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'Arabe',    native: 'العربية',  flag: '🇲🇦' },
];

export default function LanguageScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [selected, setSelected] = useState<Lang>('fr');
  const [saving, setSaving]     = useState(false);

  if (!fontsLoaded) return null;

  const handleContinue = async () => {
    setSaving(true);
    try {
      // 1. Sauvegarde locale (marche avant login + persiste)
      await SecureStore.setItemAsync(LANG_KEY, selected);

      // 2. Si déjà connecté, synchronise avec la table customer
      const token = await getToken();
      if (token) {
        try {
          await ProfileService.updateProfile({ preferred_lang: selected });
        } catch { /* sync DB échoue → pas bloquant, le local suffit */ }
      }

      // 3. Étape suivante de l'onboarding
      router.push('/onboarding/slide1' as any);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible d\'enregistrer la langue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>

        {/* ── En-tête ── */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Feather name="globe" size={32} color={RED} />
          </View>
          <Text style={styles.title}>Choisissez votre langue</Text>
          <Text style={styles.title}>اختر لغتك</Text>
        </View>

        {/* ── Options ── */}
        <View style={styles.options}>
          {LANGUAGES.map((lang) => {
            const active = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langCard, active && styles.langCardActive]}
                onPress={() => setSelected(lang.code)}
                activeOpacity={0.85}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={styles.langText}>
                  <Text style={[styles.langNative, active && styles.langNativeActive]}>
                    {lang.native}
                  </Text>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <Feather name="check" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Continuer ── */}
        <TouchableOpacity
          style={[styles.btnContinue, saving && { opacity: 0.7 }]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Continuer</Text>
          }
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, justifyContent: 'center' },

  header: { alignItems: 'center', marginBottom: 48 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF0F0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title:    { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 18, fontFamily: 'Inter_500Medium', color: '#9CA3AF', textAlign: 'center' },

  options: { gap: 16, marginBottom: 40 },
  langCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 18, backgroundColor: '#fff',
  },
  langCardActive: { borderColor: RED, backgroundColor: '#FFF8F8' },
  langFlag: { fontSize: 32 },
  langText: { flex: 1 },
  langNative: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  langNativeActive: { color: RED },
  langLabel:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  radio: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { backgroundColor: RED, borderColor: RED },

  btnContinue: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 5,
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});