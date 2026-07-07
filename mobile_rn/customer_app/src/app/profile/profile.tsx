import React, { useState, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Image, ActivityIndicator,
  Dimensions, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Profile } from '../../services/profile.service';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../../constants/config';
import PageHeader from '../../components/ui/PageHeader';

const TIERS = [
  { name: 'Bronze',   min: 0,     max: 499,   color: '#CD7F32', bg: '#FDF3E7', next: 500 },
  { name: 'Silver',   min: 500,   max: 1999,  color: '#9CA3AF', bg: '#F3F4F6', next: 2000 },
  { name: 'Gold',     min: 2000,  max: 4999,  color: '#F59E0B', bg: '#FFFBEB', next: 5000 },
  { name: 'Platinum', min: 5000,  max: 9999,  color: '#6366F1', bg: '#EEF2FF', next: 10000 },
  { name: 'Diamond',  min: 10000, max: Infinity, color: '#06B6D4', bg: '#ECFEFF', next: null },
] as const;

function getTier(lifetime: number) {
  return TIERS.find(t => lifetime >= t.min && lifetime <= t.max) ?? TIERS[0];
}

function getProgress(lifetime: number) {
  const tier = getTier(lifetime);
  if (!tier.next) return 1;
  return Math.min((lifetime - tier.min) / (tier.next - tier.min), 1);
}

const avatarSource = (url: string | null | undefined) =>
  url ? { uri: CONFIG.STORAGE_URL + url } : null;


const { width } = Dimensions.get('window');
const RED = '#E62A27';

const MenuItem = ({
  icon, label, onPress, badge,
}: { icon: string; label: string; onPress: () => void; badge?: number }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuItemLeft}>
      <Feather name={icon as any} size={20} color="#1a1a1a" />
      <Text style={styles.menuItemLabel}>{label}</Text>
    </View>
    <View style={styles.menuItemRight}>
      {badge != null && badge > 0 && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={18} color="#C0C0C0" />
    </View>
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { notifCount, refreshNotifCount } = useNotification();
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [orderCount, setOrderCount] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      try {
        const [prof, orders] = await Promise.all([
          ProfileService.getProfile(),
          ProfileService.listOrders(),
        ]);
        if (!active) return;
        setProfile(prof);
        setOrderCount(orders.length);
        setTotalSpent(orders.reduce((sum, o) => sum + o.total_ttc, 0));
      } catch (err) {
        console.log('Error loading profile:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    refreshNotifCount();
    return () => { active = false; };
  }, []));

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    router.replace('/auth/login' as any);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <PageHeader title="Profil" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {avatarSource(profile?.avatar_url) ? (
              <Image source={avatarSource(profile?.avatar_url)!} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {profile?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{profile?.name || '—'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || '—'}</Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardRed]}>
            <Text style={styles.statValueWhite}>{orderCount}</Text>
            <Text style={styles.statLabelWhite}>Commandes</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWhite]}>
            <Text style={styles.statValueDark}>{totalSpent.toFixed(0)} DH</Text>
            <Text style={styles.statLabelGray}>Total dépensé</Text>
          </View>
        </View>

        {/* ── Fidélité ── */}
        {(() => {
          const lifetime = profile?.points_lifetime ?? 0;
          const balance  = profile?.points_balance  ?? 0;
          const tier     = getTier(lifetime);
          const nextTier = TIERS[TIERS.indexOf(tier) + 1] ?? null;
          const progress = getProgress(lifetime);
          const toNext   = tier.next ? tier.next - lifetime : 0;
          return (
            <View style={[styles.loyaltyCard, { borderColor: tier.color + '40' }]}>
              <View style={styles.loyaltyTop}>
                <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
                  <Text style={[styles.tierName, { color: tier.color }]}>{tier.name}</Text>
                </View>
                <View style={styles.loyaltyPointsWrap}>
                  <Text style={styles.loyaltyPointsValue}>{balance.toLocaleString()}</Text>
                  <Text style={styles.loyaltyPointsLabel}>pts disponibles</Text>
                </View>
              </View>

              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: tier.color }]} />
              </View>

              <View style={styles.loyaltyBottom}>
                <Text style={styles.loyaltyLifetime}>{lifetime.toLocaleString()} pts cumulés</Text>
                {nextTier ? (
                  <Text style={styles.loyaltyNext}>
                    {toNext} pts → <Text style={{ color: nextTier.color, fontWeight: '700' }}>{nextTier.name}</Text>
                  </Text>
                ) : (
                  <Text style={[styles.loyaltyNext, { color: tier.color }]}>Niveau maximum ✦</Text>
                )}
              </View>
            </View>
          );
        })()}

        {/* ── Menu ── */}
        <View style={styles.menuCard}>
          <MenuItem icon="map-pin"       label="Mes adresses"              onPress={() => router.push('/profile/addresses' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="shopping-bag"  label="Historique des commandes"  onPress={() => router.push('/order/orders' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="heart"         label="Favoris"                   onPress={() => router.push('/main/favorites' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="tag"           label="Mes Coupons"               onPress={() => router.push('/profile/coupons' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="bell"          label="Notifications"             onPress={() => router.push('/profile/notifications' as any)} badge={notifCount} />
          <View style={styles.menuDivider} />
          <MenuItem icon="settings"      label="Paramètres"                onPress={() => router.push('/profile/settings' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="headphones"    label="Support / Contact"         onPress={() => router.push('/support/faq' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="alert-triangle" label="Mes réclamations"         onPress={() => router.push('/claims/claims' as any)} />
        </View>

        {/* ── Edit button ── */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push('/main/edit-profile' as any)}
          activeOpacity={0.85}
        >
          <Feather name="edit-2" size={16} color="#fff" />
          <Text style={styles.editBtnText}>Modifier profil</Text>
        </TouchableOpacity>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={16} color="#9CA3AF" />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  avatarSection:   { alignItems: 'center', marginBottom: 24 },
  avatarWrapper:   { position: 'relative', marginBottom: 12 },
  avatar:          { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  profileName:  { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#9CA3AF' },

  statsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 24,
  },
  statCard: {
    flex: 1, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  statCardRed:   { backgroundColor: RED },
  statCardWhite: { backgroundColor: '#F7F7F7' },
  statValueWhite: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statLabelWhite: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginTop: 2 },
  statValueDark:  { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  statLabelGray:  { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },

  loyaltyCard: {
    borderRadius: 20, borderWidth: 1.5,
    padding: 18, marginBottom: 24,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  loyaltyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tierBadge: { borderRadius: 50, paddingHorizontal: 16, paddingVertical: 6 },
  tierName:  { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  loyaltyPointsWrap: { alignItems: 'flex-end' },
  loyaltyPointsValue: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  loyaltyPointsLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  progressBarBg: {
    height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginBottom: 10, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },

  loyaltyBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyLifetime: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  loyaltyNext:     { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1, borderColor: '#F0F0F0',
    paddingHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 16,
  },
  menuItemLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItemLabel: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  menuDivider:   { height: 1, backgroundColor: '#F5F5F5' },
  menuBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E62A27', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  menuBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 50,
    paddingVertical: 16, marginBottom: 16,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  logoutText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});