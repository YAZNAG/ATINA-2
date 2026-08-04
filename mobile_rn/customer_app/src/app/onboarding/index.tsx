import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import {
  useFonts, Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { ProfileService } from '../../services/profile.service';
import { getToken } from '../../services/customer_auth.service';

const RED = '#E10600';
export const LANG_KEY = 'preferred_lang';

const { width } = Dimensions.get('window');

type Lang = 'fr' | 'ar';

const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'ar', label: 'Arabe',    native: 'العربية' },
];

export default function LanguageScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
  });

  const [selected, setSelected] = useState<Lang>('fr');
  const [saving, setSaving]     = useState(false);

  if (!fontsLoaded) return null;

  const handleContinue = async () => {
    setSaving(true);
    try {
      await SecureStore.setItemAsync(LANG_KEY, selected);

      const token = await getToken();
      if (token) {
        try {
          await ProfileService.updateProfile({ preferred_lang: selected });
        } catch { /* sync DB échoue pas bloquant, le local suffit */ }
      }

      router.push('/onboarding/slide1' as any);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible d\'enregistrer la langue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />

      <View style={styles.container}>

        {/* ── Logo ── */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/images/app/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>


        {/* ── Options (boutons) ── */}
        <View style={styles.options}>
          {LANGUAGES.map((lang) => {
            const active = selected === lang.code;
            return (
              <TouchableOpacity
  key={lang.code}
  style={[styles.langBtn, active && styles.langBtnActive]}
  onPress={() => setSelected(lang.code)}
  activeOpacity={0.85}
>
  <Text style={[styles.langNative, active && styles.langNativeActive]}>
    {lang.native}
  </Text>
  {active && (
    <View style={styles.checkCircle}>
      <Feather name="check" size={14} color={RED} />
    </View>
  )}
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
            ? <ActivityIndicator color={RED} />
            : <Text style={styles.btnText}>Continuer</Text>
          }
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: RED },
  container: {
  flex: 1,
  paddingHorizontal: 24,
  paddingTop: 60,           // remonte le contenu vers le haut
  justifyContent: 'flex-start',  // au lieu de 'center'
},

  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { width: width * 0.7, height: (width * 0.7) / (267 / 314), },

  options: { gap: 16, marginBottom: 40 },
  langBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',   
  position: 'relative',       
  borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 16,
  paddingVertical: 18, paddingHorizontal: 20,
  backgroundColor: 'rgba(255,255,255,0.08)',
},
langBtnActive: {
  borderColor: '#fff',
  backgroundColor: '#fff',
},
langNative: {
  fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#fff',
  textAlign: 'center',
},
langNativeActive: { color: RED },
checkCircle: {
  position: 'absolute',
  right: 20,
  width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff',
  alignItems: 'center', justifyContent: 'center',
},

  btnContinue: {
     alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_700Bold' },
});