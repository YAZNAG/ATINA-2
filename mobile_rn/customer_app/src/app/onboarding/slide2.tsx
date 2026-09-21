import React from 'react';
import { Dimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingSlide from '../../components/onboarding/OnboardingSlide';
import { markOnboardingDone } from '../../components/onboarding/onboardingKit';

const { width, height } = Dimensions.get('window');

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
      illustration={
        <Image
          source={require('../../../assets/images/atina/gifts.png')}
          style={{ width: width * 0.72, height: height * 0.38 }}
          resizeMode="contain"
        />
      }
      onNext={finish}
      onSkip={finish}
    />
  );
}
