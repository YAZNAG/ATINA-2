import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import ClaimsService, { Claim, ClaimStatus } from '../../services/claims.service';

const RED = '#E10600';

const STATUS_CONFIG: Record<ClaimStatus, { color: string }> = {
  OPEN:        { color: '#22C55E' },
  IN_PROGRESS: { color: '#F59E0B' },
  RESOLVED:    { color: '#3B82F6' },
  CLOSED:      { color: '#94A3B8' },
};

const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  MISSING_PRODUCT: 'package',
  DAMAGED_PRODUCT: 'alert-triangle',
  WRONG_PRODUCT:   'shuffle',
  REFUND_REQUEST:  'credit-card',
  OTHER:           'help-circle',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ClaimCard({ item, onPress }: { item: Claim; onPress: () => void }) {
  const statusInfo = STATUS_CONFIG[item.status] ?? { color: '#64748B' };
  const icon = TYPE_ICONS[item.type] ?? 'help-circle';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={20} color={RED} />
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.type} numberOfLines={1}>{item.type_label}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}16` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{item.status_label}</Text>
          </View>
        </View>

        {item.order && (
          <Text style={styles.orderRef}>Commande #{item.order.reference}</Text>
        )}

        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ClaimsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await ClaimsService.listMyClaims();
      setClaims(res.data ?? []);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <PageHeader
        title="Mes réclamations" rightIcon="plus" onRightPress={() => router.push('/claims/create' as any)}/>
        {loading ? (
          <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
        ) : claims.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="file-text" size={52} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>Aucune réclamation</Text>
            <Text style={styles.emptySubtitle}>
              Un souci avec une commande ? Signalez-le ici.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/claims/create' as any)}>
              <Text style={styles.emptyBtnText}>Créer une réclamation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={claims}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ClaimCard item={item} onPress={() => router.push({ pathname: '/claims/claim_detail', params: { id: item.id } })} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[RED]} tintColor={RED} />
            }
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  list: { paddingBottom: 32, paddingTop: 8 },

  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF1F1',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  type: { flex: 1, fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  orderRef: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#64748B', marginTop: 4 },
  description: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#475569', marginTop: 6, lineHeight: 18 },
  date: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginTop: 8 },
  emptySubtitle: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF',
    textAlign: 'center', paddingHorizontal: 32,
  },
  emptyBtn: { marginTop: 16, backgroundColor: RED, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});