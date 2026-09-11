import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ProfileService } from '../../services/profile.service';
import { getToken } from '../../services/customer_auth.service';
import {
  RED, RED_SOFT, RED_TINT, INK, GREY, LINE, LANG_KEY, Lang, PrimaryButton, prefSet,
} from '../../components/onboarding/onboardingKit';

export { LANG_KEY };

const LANGUAGES: { code: Lang; label: string; hint: string }[] = [
  { code: 'fr', label: 'Français', hint: 'Continuer en français' },
  { code: 'ar', label: 'العربية', hint: 'المتابعة باللغة العربية' },
];

/** Drapeaux dessinés (les emoji drapeaux ne s'affichent pas sur toutes les plateformes). */
function Flag({ code }: { code: Lang }) {
  if (code === 'fr') {
    return (
      <View style={[styles.flagCircle, { flexDirection: 'row' }]}>
        <View style={{ flex: 1, backgroundColor: '#1F3F99' }} />
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
        <View style={{ flex: 1, backgroundColor: '#E1251B' }} />
      </View>
    );
  }
  return (
    <View style={[styles.flagCircle, { backgroundColor: '#C1272D', alignItems: 'center', justifyContent: 'center' }]}>
      <MaterialCommunityIcons name="star-outline" size={20} color="#006233" />
    </View>
  );
}

/** Choix de la langue (maquette « page choix langue »). */
export default function LanguageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Lang | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await prefSet(LANG_KEY, selected);
      let token = null;
      try { token = await getToken(); } catch { /* pas de session */ }
      if (token) {
        try { await ProfileService.updateProfile({ preferred_lang: selected }); } catch { /* le choix local suffit */ }
      }
    } finally {
      setSaving(false);
    }
    // La langue est un confort : la suite du parcours n'est jamais bloquée.
    router.push('/onboarding/slide1' as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        {/* Illustration : globe et bulles de langue */}
        <View style={styles.hero}>
          <View style={styles.heroOuter}>
            <View style={styles.heroInner}>
              <Feather name="globe" size={40} color={RED} />
            </View>
          </View>
          <View style={[styles.bubble, styles.bubbleTop]}>
            <Text style={styles.bubbleText}>A</Text>
          </View>
          <View style={[styles.bubble, styles.bubbleLeft]}>
            <Text style={styles.bubbleText}>ع</Text>
          </View>
        </View>

        <Text style={styles.title}>Choisissez votre langue</Text>
        <Text style={styles.subtitle}>
          Sélectionnez la langue que vous souhaitez utiliser dans l'application. Vous pourrez la modifier à tout moment
          depuis votre profil.
        </Text>

        <View style={styles.options} accessibilityRole="radiogroup">
          {LANGUAGES.map((lang) => {
            const active = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelected(lang.code)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Flag code={lang.code} />
                <View style={styles.cardText}>
                  <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>{lang.label}</Text>
                  <Text style={styles.cardHint}>{lang.hint}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Continuer" onPress={handleContinue} disabled={!selected} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 24, alignItems: 'center' },

  hero: { width: 150, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  heroOuter: {
    width: 116, height: 116, borderRadius: 58, backgroundColor: RED_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  heroInner: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: RED, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  bubble: {
    position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  bubbleTop: { top: 4, right: 10 },
  bubbleLeft: { bottom: 8, left: 8 },
  bubbleText: { color: RED, fontSize: 15, fontFamily: 'Poppins_700Bold', lineHeight: 20 },

  title: { fontSize: 24, color: INK, fontFamily: 'Poppins_700Bold', textAlign: 'center', marginBottom: 10 },
  subtitle: {
    fontSize: 13.5, color: GREY, fontFamily: 'Poppins_400Regular', textAlign: 'center',
    lineHeight: 20, marginBottom: 28, maxWidth: 320,
  },

  options: { alignSelf: 'stretch', gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: LINE, borderRadius: 14, backgroundColor: '#fff',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  cardActive: { borderColor: RED, backgroundColor: RED_TINT },
  flagCircle: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EDEDED',
  },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 15.5, color: INK, fontFamily: 'Poppins_600SemiBold' },
  cardLabelActive: { color: RED },
  cardHint: { fontSize: 12, color: GREY, fontFamily: 'Poppins_400Regular', marginTop: 1 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CFCFCF',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: RED },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },

  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
});
