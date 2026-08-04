import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address } from '../../../services/profile.service';
import { CONFIG } from '../../../constants/config';
import { useNotification } from '../../../context/NotificationContext';

const RED = '#E10600';

interface Props {
  defaultAddress: Address | null;
  user: any;
  avatarUrl?: string | null;
}

export default function HomeHeader({ defaultAddress, user, avatarUrl }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifCount } = useNotification();

  const resolvedAvatar = avatarUrl
    ? (avatarUrl.startsWith('http') ? avatarUrl : `${CONFIG.STORAGE_URL}${avatarUrl}`)
    : null;

  const initial = (
    user?.name?.charAt(0) ||
    user?.full_name?.charAt(0) ||
    '?'
  )?.toUpperCase();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => router.push('/profile/addresses' as any)}>
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={14} color={RED} />
          <Text style={styles.locationLabel}>Livrer à</Text>
          <Feather name="chevron-down" size={14} color="#1a1a1a" />
        </View>
        <Text style={styles.locationCity} numberOfLines={1}>
          {defaultAddress
            ? `Rue ${defaultAddress.street_name}, Quartier ${defaultAddress.quartier}, ${defaultAddress.city}`
            : 'Ajouter une adresse'}
        </Text>
      </TouchableOpacity>

      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push('/profile/notifications' as any)}
        >
          <Feather name="bell" size={20} color="#1a1a1a" />
          {notifCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {notifCount > 9 ? '9+' : notifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.avatar}
          onPress={() => router.push('/profile/profile' as any)}
          activeOpacity={0.8}
        >
          {resolvedAvatar ? (
            <Image source={{ uri: resolvedAvatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
  },
  locationRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Poppins_400Regular' },
  locationCity:  { fontSize: 15, color: '#1a1a1a', fontFamily: 'Poppins_700Bold', maxWidth: 240 },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 12 },

  notifBtn: { position: 'relative', padding: 2 },
  notifBadge: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: RED, borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  avatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText:  { color: '#fff', fontSize: 15, fontFamily: 'Poppins_700Bold' },
});
