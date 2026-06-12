import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register" options={{ headerShown: false }} />
      <Stack.Screen name="main/home" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      
      <Stack.Screen name="auth/verify-phone" options={{ headerShown: false }} />
      <Stack.Screen name="auth/verify-otp" options={{ headerShown: false }} />
      <Stack.Screen name="auth/success" options={{ headerShown: false }} />

      <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="auth/forgot-otp" options={{ headerShown: false }} />
      <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />

      <Stack.Screen name="main/categories" options={{ headerShown: false }} />
      <Stack.Screen name="main/category-products" options={{ headerShown: false }} />

      <Stack.Screen name="main/cart" options={{ headerShown: false }} />

            <Stack.Screen name="profile/profile" options={{ headerShown: false }} />
            <Stack.Screen name="profile/addresses" options={{ headerShown: false }} />
            <Stack.Screen name="profile/notifications" options={{ headerShown: false }} />
    </Stack>
  );
}