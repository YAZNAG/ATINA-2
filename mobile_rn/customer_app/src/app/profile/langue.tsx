import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService } from '../../services/profile.service';
import { C, F, S, R, ScreenHeader, shadow } from '../../theme/atina';
import { t, getLang, setLanguage } from '../../i18n';
import type { Lang } from '../../components/onboarding/onboardingKit';

const LANGUAGES: { code: Lang; label: string; hint: string; flag: any }[] = [
  { code: 'fr', label: 'Français', hint: 'Continuer en français.', flag: require('../../../assets/images/atina/flag_fr.png') },
  { code: 'ar', label: 'العربية', hint: 'المتابعة باللغة العربية.', flag: require('../../../assets/images/atina/flag_ma.png') },
];

/** Langue de l'app (maquette Figma « Langue ») : deux cartes drapeau, coche rouge sur l'active. */
export default function LangueScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState<Lang>('fr');
  const [saving, setSaving] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { setCurrent(getLang()); }, []));

  const handleSelect = async (code: Lang) => {
    if (saving || code === current) return;
    setSaving(code);
    try {
      try { await ProfileService.updateProfile({ preferred_lang: code }); } catch { /* le choix local suffit */ }
      await setLanguage(code);
      setCurrent(code);
    } catch (e: any) {
      Alert.alert(t('Erreur'), e?.message || t('Erreur lors de la mise à jour de la langue'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScreenHeader title={t('Langue')} onBack={() => router.back()} />

      <View style={styles.content}>
        <Text style={styles.label}>{t('Choisissez votre langue')}</Text>
        <Text style={styles.hint}>
          {t("Sélectionnez la langue que vous souhaitez utiliser. Vous pourrez la modifier à tout moment dans les paramètres.")}
        </Text>

        <View style={styles.cards}>
          {LANGUAGES.map((lang) => {
            const active = lang.code === current;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => handleSelect(lang.code)}
                disabled={saving !== null}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Image source={lang.flag} style={styles.flag} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, active && styles.nameActive]}>{lang.label}</Text>
                  <Text style={[styles.sub, active && styles.subActive]}>{lang.hint}</Text>
                </View>
                {saving === lang.code
                  ? <ActivityIndicator size="small" color={C.red} />
                  : active && <Feather name="check-circle" size={18} color={C.red} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: S.lg, paddingTop: S.sm },
  label: { fontSize: 18, color: C.ink, fontFamily: F.bold, marginBottom: 6 },
  hint: { fontSize: 13, lineHeight: 19, color: C.grey, fontFamily: F.regular, marginBottom: S.xl },
  cards: { gap: S.md },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.bg, borderRadius: R.md, borderWidth: 1, borderColor: 'transparent',
    paddingVertical: S.lg, paddingHorizontal: S.lg, ...shadow,
  },
  cardActive: { borderColor: C.red, backgroundColor: C.redSoft },
  flag: { width: 26, height: 18, borderRadius: 3 },
  name: { fontSize: 15.5, color: C.ink, fontFamily: F.semi },
  nameActive: { color: C.red },
  sub: { fontSize: 12, color: C.grey, fontFamily: F.regular, marginTop: 1 },
  subActive: { color: C.red },
});
