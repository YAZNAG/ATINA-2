import React, { useState, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Image, ActivityIndicator,
  Switch, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Profile } from '../../services/profile.service';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../../constants/config';
import PageHeader from '../../components/ui/PageHeader';

const RED = '#E62A27';

/* ─── Stat Card ─────────────────────────────────────────────────────────── */
const StatCard = ({
  icon, value, label,
}: { icon: string; value: string; label: string }) => (
  <View style={styles.statCard}>
    <Feather name={icon as any} size={22} color={'#ffff'} style={styles.statIcon} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/* ─── Section Header ─────────────────────────────────────────────────────── */
const SectionHeader = ({ title }: { title: string }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

/* ─── Generic Menu Row ───────────────────────────────────────────────────── */
type RowProps = {
  icon: string;
  label: string;
  onPress?: () => void;
  rightContent?: React.ReactNode;
  showChevron?: boolean;
};

const MenuRow = ({ icon, label, onPress, rightContent, showChevron = true }: RowProps) => (
  <TouchableOpacity
    style={styles.menuRow}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.menuRowLeft}>
      <Feather name={icon as any} size={20} color="#333" />
      <Text style={styles.menuRowLabel}>{label}</Text>
    </View>
    <View style={styles.menuRowRight}>
      {rightContent}
      {showChevron && <Feather name="chevron-right" size={17} color="#C5C5C5" />}
    </View>
  </TouchableOpacity>
);

/* ─── Red Pill Badge ─────────────────────────────────────────────────────── */
const RedBadge = ({ text }: { text: string }) => (
  <View style={styles.redBadge}>
    <Text style={styles.redBadgeText}>{text}</Text>
  </View>
);

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export default function ProfileScreen() {
  const router = useRouter();
  const { notifCount, refreshNotifCount } = useNotification();

  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [totalSpent,   setTotalSpent]   = useState(0);
  const [orderCount,   setOrderCount]   = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const [prof, orders] = await Promise.all([
          ProfileService.getProfile(),
          ProfileService.listOrders(),
        ]);
        if (!active) return;
        setProfile(prof);
        setOrderCount(orders.length);
        setTotalSpent(orders.reduce((s, o) => s + o.total_ttc, 0));
      } catch (e) {
        console.log('Profile load error:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    refreshNotifCount();
    return () => { active = false; };
  }, []));

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    router.replace('/auth/login' as any);
  };

  const avatarSrc = profile?.avatar_url
    ? { uri: CONFIG.STORAGE_URL + profile.avatar_url }
    : null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      <PageHeader title="Profil" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── Avatar ────────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {avatarSrc ? (
              <Image source={avatarSrc} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {profile?.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => router.push('/profile/edit_profile' as any)}
              activeOpacity={0.8}
            >
              <Feather name="edit-2" size={10} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? '—'}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? '—'}</Text>
        </View>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="star"
            value={(profile?.points_balance ?? 0).toLocaleString()}
            label="POINTS"
          />
          <StatCard
            icon="box"
            value={String(orderCount)}
            label="COMMANDES"
          />
          <StatCard
            icon="calendar"
            value={totalSpent.toFixed(0)}
            label="MAD"
          />
        </View>

        {/* ── Mon Compte ────────────────────────────────────────────────── */}
        <SectionHeader title="Mon Compte" />
        <View style={styles.card}>
          <MenuRow
            icon="map-pin"
            label="Mes adresses"
            onPress={() => router.push('/profile/addresses' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="shopping-bag"
            label="Historique des commandes"
            onPress={() => router.push('/order/orders' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="heart"
            label="Mes favoris"
            onPress={() => router.push('/main/main_nav/favorites' as any)}
          />
        </View>

        {/* ── Promotions & Récompenses ──────────────────────────────────── */}
        <SectionHeader title="Promotions & Récompenses" />
        <View style={styles.card}>
          <MenuRow
            icon="tag"
            label="Mes coupons"
            onPress={() => router.push('/profile/coupons' as any)}
            /*rightContent={<RedBadge text="2 Nouveaux" />}*/
          />
          <View style={styles.divider} />
          <MenuRow
            icon="award"
            label="Mes points fidélité"
            onPress={() => router.push('/profile/loyalty' as any)}
            rightContent={
              <RedBadge text={`${(profile?.points_balance ?? 0).toLocaleString()} pts`} />
            }
          />
          <View style={styles.divider} />
          <MenuRow
            icon="credit-card"
            label="Wallet"
            onPress={() => router.push('/profile/WalletScreen' as any)}
          />
        </View>

        {/* ── Paramètres ────────────────────────────────────────────────── */}
        <SectionHeader title="Paramètres" />
        <View style={styles.card}>

          {/* Langue */}
          <MenuRow
            icon="globe"
            label="Langue"
            onPress={() => {}}
            rightContent={<Text style={styles.infoText}>Français (FR)</Text>}
          />
          <View style={styles.divider} />

          <MenuRow
            icon="message-circle"
            label="Chat avec le support"
            onPress={() => router.push('/support/conversations' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="help-circle"
            label="Centre d'aide"
            onPress={() => router.push('/support/faq' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="phone"
            label="Contact"
            onPress={() => router.push('/support/contact' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="flag"
            label="Réclamation"
            onPress={() => router.push('/claims/claims' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="file-text"
            label="Conditions d'utilisation"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="lock"
            label="Politique de confidentialité"
            onPress={() => {}}
          />
        </View>

        {/* ── Edit Button ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push('/profile/edit_profile' as any)}
          activeOpacity={0.85}
        >
          <Feather name="edit" size={16} color="#fff" />
          <Text style={styles.editBtnText}>Modifier profil</Text>
        </TouchableOpacity>

        {/* ── Logout ────────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={15} color="#9CA3AF" />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({

  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:   { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },

  /* Avatar */
  avatarSection:  { alignItems: 'center', marginVertical: 20 },
  avatarWrap:     { position: 'relative', marginBottom: 12 },
  avatar:         { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: { backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 34, fontWeight: '700', color: '#fff' },
  editAvatarBtn:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#F5F5F5',
  },
  profileName:  { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#9CA3AF' },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center',
  },
  statIcon:  { marginBottom: 6, backgroundColor:RED , borderRadius:18, padding:9},
  statValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginTop: 2, letterSpacing: 0.6 },

  /* Section header */
  sectionHeader: {
    fontSize: 16, fontWeight: '700', color: '#1a1a1a',
    marginBottom: 10, marginTop: 2,
  },

  /* Card */
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, marginBottom: 20,
    overflow: 'hidden',
  },

  /* Menu rows */
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 16,
  },
  menuRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuRowLabel: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  divider:      { height: 1, backgroundColor: '#F0F0F0' },

  /* Red badge */
  redBadge: {
    backgroundColor: RED, borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  redBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  /* Inline right content */
  inlineRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  infoText:    { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  /* Edit button */
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 50,
    paddingVertical: 15, marginTop: 4, marginBottom: 14,
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10,
  },
  logoutText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});
