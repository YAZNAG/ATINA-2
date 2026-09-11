import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Palette et clés partagées par le parcours d'onboarding (maquette Atina). */
export const RED = '#E10600';
export const RED_SOFT = '#FDECEC';
export const RED_TINT = '#FFF4F4';
export const INK = '#0A0A0A';
export const GREY = '#8A8A8A';
export const LINE = '#EDEDED';

export const LANG_KEY = 'preferred_lang';
export const ONBOARDING_DONE_KEY = 'onboarding_done';

export type Lang = 'fr' | 'ar';

/** Stockage des préférences : SecureStore sur mobile, localStorage en web. Ne lève jamais. */
export async function prefGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}
export async function prefSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value);
  } catch { /* non bloquant */ }
}

export async function getSavedLang(): Promise<Lang> {
  return (await prefGet(LANG_KEY)) === 'ar' ? 'ar' : 'fr';
}

export async function markOnboardingDone() {
  await prefSet(ONBOARDING_DONE_KEY, '1');
}

/** Textes des slides en français et en arabe. */
export const SLIDES_TEXT = {
  fr: {
    skip: 'Ignorer',
    next: 'Suivant',
    start: 'Commencer',
    s1Title: 'Tous vos essentiels au même endroit',
    s1Body: 'Faites vos courses facilement : épicerie, produits frais, hygiène et bien plus encore, livrés chez vous.',
    s2Title: 'Gagnez des cadeaux exclusifs',
    s2Body: 'Cumulez des points à chaque commande, jouez et débloquez des cadeaux et des codes promo rien que pour vous.',
  },
  ar: {
    skip: 'تخطي',
    next: 'التالي',
    start: 'ابدأ',
    s1Title: 'كل ما تحتاجه في مكان واحد',
    s1Body: 'تسوّق بسهولة: بقالة، منتجات طازجة، نظافة والمزيد، مع التوصيل إلى باب منزلك.',
    s2Title: 'اربح هدايا حصرية',
    s2Body: 'اجمع النقاط مع كل طلب، العب واربح هدايا ورموزًا ترويجية خاصة بك.',
  },
} as const;

/** Points de progression : le point actif est une pilule rouge. */
export function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={kit.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[kit.dot, i === active ? kit.dotActive : kit.dotIdle]} />
      ))}
    </View>
  );
}

/** Bouton principal rouge pleine largeur. */
export function PrimaryButton({
  label, onPress, disabled, loading,
}: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <TouchableOpacity
      style={[kit.button, (disabled || loading) && kit.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={kit.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export const kit = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: RED },
  dotIdle: { width: 6, backgroundColor: '#E6E6E6' },
  button: {
    backgroundColor: RED,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    shadowColor: RED,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
});
