import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname} from 'expo-router';
import { useCartCount } from '../../context/CartContext';

const RED = '#E10600';

const TABS = [
  { name: 'Accueil',    icon: 'home',          route: '/main/main_nav/home',       match: ['/main/main_nav/home', '/main/main_nav/product-list'] },
  { name: 'Catégories', icon: 'grid',           route: '/main/main_nav/categories', match: ['/main/main_nav/categories', '/main/main_nav/category-products'] },
  { name: 'Panier',     icon: 'shopping-cart',  route: '/main/cart',       match: ['/main/cart'] },
  { name: 'Favoris',    icon: 'heart',          route: '/main/main_nav/favorites',  match: ['/main/main_nav/favorites'] },
  { name: 'Profil',     icon: 'user',           route: '/profile/profile', match: ['/profile/profile'] },
];

function normalize(p: string) {
  return p.replace(/\/+$/, '') || '/';
}

export default function BottomNavBar(_props: any) {
  const insets = useSafeAreaInsets();
  const router    = useRouter();
  const pathname  = usePathname();
  const cartCount = useCartCount();
  const isActive = (tab: typeof TABS[0]) => {
    const p = normalize(pathname);
    return tab.match.some(m => p === normalize(m) || p.startsWith(normalize(m)));
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
      {TABS.map(tab => {
        const active = isActive(tab);
        const isCart = tab.name === 'Panier';

        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => {
              if (active) return;
              router.navigate({ pathname: tab.route as any });
            }}
            activeOpacity={0.7}
          >
            {isCart ? (
              <View style={styles.cartWrapper}>
                <View style={styles.cartGlow} />
                <View style={styles.cartBtn}>
                  <Feather name="shopping-cart" size={22} color="#fff" />
                </View>
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                <View
                  key={active ? 'active' : 'inactive'}
                  style={[styles.iconWrap, active && styles.iconWrapActive]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={22}
                    color={active ? RED : '#9CA3AF'}
                  />
                </View>
                <Text style={[styles.label, active && styles.labelActive]}>
                  {tab.name}
                </Text>
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
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },

  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },

  iconWrap: {
    width: 44, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(225, 6, 0, 0.1)',
  },

  label:       { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  labelActive: { color: RED, fontWeight: '700' },

  cartWrapper: {
    width: 64,
    height: 64,
    marginTop: -30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 38,
    backgroundColor: 'rgba(225, 6, 0, 0.3)',
  },

  cartBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },

  cartBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  cartBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', lineHeight: 14 },
});