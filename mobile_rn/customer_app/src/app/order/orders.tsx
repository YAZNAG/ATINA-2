import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import { ProfileService, OrderSummary } from '../../services/profile.service';

const RED = '#E10600';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: OrderSummary['status'] }) {
  const color = status?.color ?? '#6B7280';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{status?.name_fr ?? '—'}</Text>
    </View>
  );
}

function OrderCard({ order, onPress }: { order: OrderSummary; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardRef}>#{order.reference}</Text>
          <Text style={styles.cardDate}>{formatDate(order.created_at)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardFooter}>
        <View style={styles.cardMeta}>
          <Feather name="package" size={13} color="#9CA3AF" />
          <Text style={styles.cardMetaText}>{order.item_count} article{order.item_count > 1 ? 's' : ''}</Text>
          <View style={styles.metaSep} />
          <Feather name="truck" size={13} color="#9CA3AF" />
          <Text style={styles.cardMetaText}>{order.delivery_type ?? '—'}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardTotal}>{Number(order.total_ttc).toFixed(2)} DH</Text>
          <Feather name="chevron-right" size={18} color="#D1D5DB" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await ProfileService.listOrders();
      setOrders(data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <PageHeader title="Mes commandes" />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>

        {loading ? (
          <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
        ) : orders.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={52} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.emptySubtitle}>Vos commandes apparaîtront ici</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/main/home' as any)}>
              <Text style={styles.emptyBtnText}>Commencer mes achats</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={o => o.id}
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                onPress={() => router.push({ pathname: '/order/order-detail' as any, params: { id: item.id } })}
              />
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
  safeArea:  { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  list:      { paddingBottom: 32, paddingTop: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardRef:       { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  cardDate:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  cardDivider:   { height: 1, backgroundColor: '#F5F5F5', marginBottom: 12 },
  cardFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  metaSep:       { width: 1, height: 12, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  cardRight:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTotal:     { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  badgeDot:  { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle:    { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginTop: 8 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  emptyBtn: {
    marginTop: 16, backgroundColor: RED, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
