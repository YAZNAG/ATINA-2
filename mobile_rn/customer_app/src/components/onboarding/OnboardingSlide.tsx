import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { INK, GREY, RED, Dots, PrimaryButton, Lang, getSavedLang, SLIDES_TEXT } from './onboardingKit';

const { height } = Dimensions.get('window');

type Props = {
  index: number;
  count: number;
  illustration: React.ReactNode;
  titleKey: 's1Title' | 's2Title';
  bodyKey: 's1Body' | 's2Body';
  isLast?: boolean;
  onNext: () => void;
  onSkip: () => void;
};

/** Slide d'onboarding (maquette) : Ignorer en haut à droite, illustration, titre, texte, points, bouton. */
export default function OnboardingSlide({ index, count, illustration, titleKey, bodyKey, isLast, onNext, onSkip }: Props) {
  const [lang, setLang] = useState<Lang>('fr');
  useEffect(() => { getSavedLang().then(setLang); }, []);
  const t = SLIDES_TEXT[lang];
  const rtl = lang === 'ar';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={[styles.topBar, rtl && styles.topBarRtl]}>
        <TouchableOpacity onPress={onSkip} hitSlop={12} accessibilityRole="button">
          <Text style={styles.skip}>{t.skip}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.illustration}>{illustration}</View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{t[titleKey]}</Text>
        <Text style={[styles.body, rtl && styles.bodyRtl]}>{t[bodyKey]}</Text>
      </View>

      <View style={styles.bottom}>
        <Dots count={count} active={index} />
        <PrimaryButton label={isLast ? t.start : t.next} onPress={onNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 12 },
  topBarRtl: { justifyContent: 'flex-start' },
  skip: { color: RED, fontSize: 14.5, fontFamily: 'Poppins_600SemiBold' },
  illustration: { height: height * 0.4, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  textBlock: { paddingHorizontal: 32, marginTop: 18, alignItems: 'center' },
  title: {
    fontSize: 24, lineHeight: 32, color: INK, fontFamily: 'Poppins_700Bold',
    textAlign: 'center', marginBottom: 10, maxWidth: 300,
  },
  body: { fontSize: 13.5, lineHeight: 21, color: GREY, fontFamily: 'Poppins_400Regular', textAlign: 'center', maxWidth: 320 },
  bodyRtl: { writingDirection: 'rtl' },
  bottom: { marginTop: 'auto', paddingHorizontal: 24, paddingBottom: 16, gap: 22 },
});
