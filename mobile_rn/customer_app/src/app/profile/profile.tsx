import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, Image, ActivityIndicator,
  Dimensions, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Profile } from '../../services/profile.service';
import * as SecureStore from 'expo-secure-store';
import PageHeader from '../../components/ui/PageHeader';


const { width } = Dimensions.get('window');
const RED = '#E62A27';

const MenuItem = ({
  icon, label, onPress,
}: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuItemLeft}>
      <Feather name={icon as any} size={20} color="#1a1a1a" />
      <Text style={styles.menuItemLabel}>{label}</Text>
    </View>
    <Feather name="chevron-right" size={18} color="#C0C0C0" />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        console.log('[DEBUG] token:', token?.slice(0, 20));
        const [prof, orders] = await Promise.all([
          ProfileService.getProfile(),
          ProfileService.listOrders(),
        ]);
        console.log('[DEBUG] profile loaded:', prof.name, prof.email);
        setProfile(prof);
        setOrderCount(orders.length);
        setTotalSpent(orders.reduce((sum, o) => sum + o.total_ttc, 0));
      } catch (err) {
        console.log('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

        {/* ── Menu ── */}
        <View style={styles.menuCard}>
          <MenuItem icon="map-pin"       label="Mes adresses"              onPress={() => router.push('/profile/addresses' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="shopping-bag"  label="Historique des commandes"  onPress={() => router.push('/main/orders' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="heart"         label="Favoris"                   onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="bell"          label="Notifications"             onPress={() => router.push('/profile/notifications' as any)} />
          <View style={styles.menuDivider} />
          <MenuItem icon="settings"      label="Paramètres"                onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="headphones"    label="Support / Contact"         onPress={() => {}} />
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

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // ── Avatar ──────────────────────────────────────────────────────────────────
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

  // ── Stats ───────────────────────────────────────────────────────────────────
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

  // ── Menu ────────────────────────────────────────────────────────────────────
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
  menuItemLabel: { fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  menuDivider:   { height: 1, backgroundColor: '#F5F5F5' },

  // ── Edit button ─────────────────────────────────────────────────────────────
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 50,
    paddingVertical: 16, marginBottom: 16,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Logout ──────────────────────────────────────────────────────────────────
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  logoutText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});