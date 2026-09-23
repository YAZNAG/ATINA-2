import React, { useState, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Image, ActivityIndicator, Switch, ScrollView, Share,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Profile } from '../../services/profile.service';
import { GamesService } from '../../services/games.service';
import { logout } from '../../services/customer_auth.service';
import { openLegal } from '../../services/appInfo.service';
import { setNodeId } from '../../store/nodePref';
import { CONFIG } from '../../constants/config';
import PageHeader from '../../components/ui/PageHeader';
import { t, getLang, isRTL } from '../../i18n';

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
      <View style={styles.menuRowIcon}>
        <Feather name={icon as any} size={17} color={RED} />
      </View>
      <Text style={styles.menuRowLabel}>{label}</Text>
    </View>
    <View style={styles.menuRowRight}>
      {rightContent}
      {showChevron && <Feather name={isRTL() ? 'chevron-left' : 'chevron-right'} size={17} color="#C5C5C5" />}
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
  const [gamesBadge,   setGamesBadge]   = useState(0);
const langLabel = getLang() === 'ar' ? 'العربية (AR)' : 'Français (FR)';

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
    // Badge « Jeux » : tours disponibles + lots à réclamer (feuille Déblocage : badge sur l'onglet)
    GamesService.list()
      .then((g) => { if (active) setGamesBadge((g.badge_count ?? 0) + (g.prizes_to_claim ?? 0)); })
      .catch(() => {});
    return () => { active = false; };
  }, []));

  const handleLogout = async () => {
    await logout();
    await setNodeId(null);
    router.replace('/auth/login' as any);
  };

  // Parrainage (US-104) : partage du code personnel.
  const shareReferral = async () => {
    if (!profile?.referral_code) return;
    try {
      await Share.share({
        message: `Rejoignez-moi sur Atina et profitez de vos courses livrées ! Utilisez mon code de parrainage ${profile.referral_code} à l'inscription.`,
      });
    } catch { /* partage annulé */ }
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
      <PageHeader title={t('Profil')} />

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
          <Text style={styles.profileEmail}>
            {profile?.phone_number ? `${profile.phone_country ?? '+212'} ${profile.phone_number}` : (profile?.email ?? '—')}
          </Text>
        </View>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="star"
            value={(profile?.points_balance ?? 0).toLocaleString()}
            label={t('POINTS')}
          />
          <StatCard
            icon="box"
            value={String(orderCount)}
            label={t('COMMANDES')}
          />
          <StatCard
            icon="calendar"
            value={totalSpent.toFixed(0)}
            label={t('MAD')}
          />
        </View>

        {/* ── Mon Compte ────────────────────────────────────────────────── */}
        <SectionHeader title={t('Mon Compte')} />
        <View style={styles.card}>
          <MenuRow
            icon="map-pin"
            label={t('Mes adresses')}
            onPress={() => router.push('/profile/addresses' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="shopping-bag"
            label={t('Historique des commandes')}
            onPress={() => router.push('/order/orders' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="heart"
            label={t('Mes favoris')}
            onPress={() => router.push({
              pathname: '/main/main_nav/favorites' as any,
              params: { from: 'profile' },
            })}
          />
        </View>

        {/* ── Promotions & Récompenses ──────────────────────────────────── */}
        <SectionHeader title={t('Promotions & Récompenses')} />
        <View style={styles.card}>
          <MenuRow
            icon="tag"
            label={t('Mes coupons')}
            onPress={() => router.push('/profile/coupons' as any)}
            /*rightContent={<RedBadge text="2 Nouveaux" />}*/
          />
          <View style={styles.divider} />
          <MenuRow
            icon="award"
            label={t('Mes points fidélité')}
            onPress={() => router.push('/profile/loyalty' as any)}
            rightContent={
              <RedBadge text={`${(profile?.points_balance ?? 0).toLocaleString()} pts`} />
            }
          />
          <View style={styles.divider} />
          <MenuRow
            icon="repeat"
            label={t('Échanger mes points')}
            onPress={() => router.push('/rewards/exchange' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="play-circle"
            label={t('Jeux')}
            onPress={() => router.push('/games' as any)}
            rightContent={gamesBadge > 0 ? <RedBadge text={`${gamesBadge} dispo`} /> : undefined}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="award"
            label={t('Mes gains')}
            onPress={() => router.push('/games/prizes' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="credit-card"
            label={t('Wallet')}
            onPress={() => router.push('/profile/WalletScreen' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="share-2"
            label={t('Parrainer un ami')}
            onPress={shareReferral}
            rightContent={profile?.referral_code ? <Text style={styles.infoText}>{profile.referral_code}</Text> : undefined}
          />
        </View>

        {/* ── Paramètres ────────────────────────────────────────────────── */}
        <SectionHeader title={t('Paramètres')} />
        <View style={styles.card}>

          {/* Langue */}
          <MenuRow
          icon="globe"
          label={t('Langue')}
          onPress={() => router.push('/profile/langue' as any)}
          rightContent={<Text style={styles.infoText}>{langLabel}</Text>}/>
          <View style={styles.divider} />

          <MenuRow
            icon="message-circle"
            label={t('Chat avec le support')}
            onPress={() => router.push('/support/conversations' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="help-circle"
            label={t('Centre d\'aide')}
            onPress={() => router.push('/support/faq' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="phone"
            label={t('Contact')}
            onPress={() => router.push('/support/contact' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="flag"
            label={t('Réclamation')}
            onPress={() => router.push('/claims/claims' as any)}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="file-text"
            label={t('Conditions d\'utilisation')}
            onPress={() => openLegal('cgu')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="lock"
            label={t('Politique de confidentialité')}
            onPress={() => openLegal('privacy')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="trash-2"
            label={t('Supprimer mon compte')}
            onPress={() => router.push('/profile/delete-account' as any)}
          />
        </View>

        {/* ── Edit Button ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push('/profile/edit_profile' as any)}
          activeOpacity={0.85}
        >
          <Feather name="edit" size={16} color="#fff" />
          <Text style={styles.editBtnText}>{t('Modifier profil')}</Text>
        </TouchableOpacity>

        {/* ── Logout ────────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={15} color="#9CA3AF" />
          <Text style={styles.logoutText}>{t('Déconnexion')}</Text>
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
  avatarFallback: { backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 34, fontFamily: 'Inter_700Bold', color: RED },
  editAvatarBtn:  {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#F5F5F5',
  },
  profileName:  { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0A0A0A', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#8A8A8A', fontFamily: 'Inter_400Regular' },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#FFF7F7', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#FCE4E4',
  },
  statIcon:  { marginBottom: 6, backgroundColor: RED, borderRadius: 18, padding: 9 },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0A0A0A' },
  statLabel: { fontSize: 10, color: '#8A8A8A', fontFamily: 'Inter_600SemiBold', marginTop: 2, letterSpacing: 0.6 },

  /* Section header */
  sectionHeader: {
    fontSize: 16, fontFamily: 'Inter_700Bold', color: '#0A0A0A',
    marginBottom: 10, marginTop: 2,
  },

  /* Card */
  card: {
    backgroundColor: '#fff', borderRadius: 18,
    paddingHorizontal: 16, marginBottom: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: '#F3F3F3',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },

  /* Menu rows */
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 13,
  },
  menuRowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuRowIcon:  {
    width: 34, height: 34, borderRadius: 12, backgroundColor: '#FDECEC',
    alignItems: 'center', justifyContent: 'center',
  },
  menuRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuRowLabel: { fontSize: 14.5, color: '#0A0A0A', fontFamily: 'Inter_500Medium' },
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
