import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>

      <Stack.Screen name="notifications" options={{ headerShown: false }}/>

      <Stack.Screen name="order_detail" options={{
          headerShown: false,
          presentation: "card",
        }}
      />

       <Stack.Screen name="order_prepare" options={{
          headerShown: false,
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="session"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="qr_ready"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}