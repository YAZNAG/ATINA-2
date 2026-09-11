import React from 'react';
import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingSlide from '../../components/onboarding/OnboardingSlide';
import GiftsIllustration from '../../components/onboarding/GiftsIllustration';
import { markOnboardingDone } from '../../components/onboarding/onboardingKit';

const { width } = Dimensions.get('window');

/** Slide 2 (dernière) : « Gagnez des cadeaux exclusifs ». */
export default function Slide2() {
  const router = useRouter();
  const finish = async () => { await markOnboardingDone(); router.replace('/auth/login'); };
  return (
    <OnboardingSlide
      index={1}
      count={2}
      isLast
      titleKey="s2Title"
      bodyKey="s2Body"
      illustration={<GiftsIllustration size={Math.min(260, width * 0.68)} />}
      onNext={finish}
      onSkip={finish}
    />
  );
}
