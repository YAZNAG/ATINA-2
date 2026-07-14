import { Tabs } from "expo-router";

import {
  MaterialIcons,
} from "@expo/vector-icons";

export default function BottomTabBar() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: "#D90404",

        tabBarInactiveTintColor: "#9CA3AF",

        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="shopping-bag"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="completed"
        options={{
          title: "Prêtes",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="check-circle"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="person"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}