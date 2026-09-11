import React from 'react';
import { Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingSlide from '../../components/onboarding/OnboardingSlide';
import { markOnboardingDone } from '../../components/onboarding/onboardingKit';

const { width, height } = Dimensions.get('window');

/** Slide 1 : « Tous vos essentiels au même endroit ». */
export default function Slide1() {
  const router = useRouter();
  return (
    <OnboardingSlide
      index={0}
      count={2}
      titleKey="s1Title"
      bodyKey="s1Body"
      illustration={
        <Image
          source={require('../../../assets/images/app/onboarding1.png')}
          style={{ width: width * 0.78, height: height * 0.38 }}
          resizeMode="contain"
        />
      }
      onNext={() => router.push('/onboarding/slide2' as any)}
      onSkip={async () => { await markOnboardingDone(); router.replace('/auth/login'); }}
    />
  );
}
