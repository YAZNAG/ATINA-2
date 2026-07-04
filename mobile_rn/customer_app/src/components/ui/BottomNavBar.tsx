import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useCart } from '../../context/CartContext';

const RED = '#E10600';

const TABS = [
  { name: 'Accueil',    icon: 'home',          route: '/main/home',       match: ['/main/home'] },
  { name: 'Catégories', icon: 'grid',           route: '/main/categories', match: ['/main/categories', '/main/category-products'] },
  { name: 'Panier',     icon: 'shopping-cart',  route: '/main/cart',       match: ['/main/cart'] },
  { name: 'Favoris',    icon: 'heart',          route: '/main/favorites',  match: ['/main/favorites'] },
  { name: 'Profil',     icon: 'user',           route: '/profile/profile', match: ['/profile/profile'] },
];

export default function BottomNavBar() {
  const router        = useRouter();
  const pathname      = usePathname();
  const { cartCount } = useCart();

  const isActive = (tab: typeof TABS[0]) =>
    tab.match.some(m => pathname === m || pathname.startsWith(m));

  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const active = isActive(tab);
        const isCart = tab.name === 'Panier';

        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => router.push({ pathname: tab.route as any })}
            activeOpacity={0.7}
          >
            {isCart ? (
              /* ── Cart button ── */
              <View style={styles.cartBtn}>
                <Feather name="shopping-cart" size={24} color="#fff" />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* ── Regular tab ── */
              <>
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
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
    paddingBottom: 20,
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },

  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },

  /* Active background pill behind icon */
  iconWrap: {
    width: 44, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: '#E106001A' },

  label:       { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  labelActive: { color: RED, fontWeight: '700' },

  /* Cart elevated circle */
  cartBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -28,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },

  /* Dark badge on cart */
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  cartBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', lineHeight: 13 },
});
