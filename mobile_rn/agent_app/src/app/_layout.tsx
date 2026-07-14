import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import {
  PickerAuthProvider,
  usePickerAuth,
} from '../context/PickerAuthContext';

const GREEN = '#D90404';

function NavigationGuard() {
  const { token, loading } = usePickerAuth();

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === 'auth';

    if (!token && !inAuth) {
      router.replace('/auth/login');
    } else if (token && inAuth) {
      router.replace('/main/(tabs)/dashboard');
    }
  }, [token, loading, segments]);

  return null;
}

function RootLayoutInner() {
  const { loading } = usePickerAuth();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,

    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (loading || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <>
      <NavigationGuard />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="auth/login"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="main"
          options={{ headerShown: false }}
        />

      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <PickerAuthProvider>
      <RootLayoutInner />
    </PickerAuthProvider>
  );
}