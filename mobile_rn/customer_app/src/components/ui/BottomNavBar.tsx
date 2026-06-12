import React from 'react';
import {
  View, TouchableOpacity, StyleSheet, Text, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

const { width } = Dimensions.get('window');
const RED = '#E10600';

const TABS = [
  { name: 'Accueil',    icon: 'home',          route: '/main/home',       match: ['/main/home'] },
  { name: 'Catégories', icon: 'grid',           route: '/main/categories', match: ['/main/categories', '/main/category-products'] },
  { name: 'Panier',     icon: 'shopping-cart',  route: '/main/cart',       match: ['/main/cart'] },
  { name: 'Favoris',    icon: 'heart',          route: '/main/favorites',  match: ['/main/favorites'] },
  { name: 'Profil',     icon: 'user',           route: '/profile/profile',    match: ['/main/profile'] },
];

export default function BottomNavBar() {
  const router   = useRouter();
  const pathname = usePathname();

  const isActive = (tab: typeof TABS[0]) =>
    tab.match.some((m) => pathname === m || pathname.startsWith(m));

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => router.push({ pathname: tab.route as any })}
            activeOpacity={0.7}
          >
            {tab.name === 'Panier' ? (
              <View style={styles.cartBtn}>
                <Feather name={tab.icon as any} size={22} color="#fff" />
              </View>
            ) : (
              <>
                <Feather
                  name={tab.icon as any}
                  size={22}
                  color={active ? RED : '#9CA3AF'}
                />
                <Text style={[styles.label, active && styles.labelActive]}>
                  {tab.name}
                </Text>
                {active && <View style={styles.activeDot} />}
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 20,
    paddingTop: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  tab:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  labelActive:  { color: RED, fontWeight: '700' },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: RED, marginTop: 2,
  },
  cartBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -24,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});