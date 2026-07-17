import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, FlatList, ActivityIndicator,
  RefreshControl, ScrollView, Image, Alert, Modal,
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
import { CartService } from '../../services/cart.service';

const RED = '#E10600';

type TabKey = 'all' | 'active' | 'delivered' | 'cancelled'|'pickup' ;
const TABS: { key: TabKey; label: string; statusCodes: string[] }[] = [
  { key: 'all',       label: 'Toutes',   statusCodes: [] },
  { key: 'active',    label: 'En cours', statusCodes: ['pending', 'awaiting_stock', 'confirmed', 'picking', 'ready', 'in_delivery'] },
  { key: 'delivered', label: 'Livrées',  statusCodes: ['delivered'] },
  { key: 'pickup',    label: 'Retirées', statusCodes: ['picked_up'] }, 
  { key: 'cancelled', label: 'Annulées', statusCodes: ['cancelled', 'returned'] },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ● '
    + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getStatusColor(code?: string): string {
  switch (code?.toLowerCase()) {
    case 'delivered':      return '#16A34A'; // vert
    case 'cancelled':      return '#DC2626'; // rouge
    case 'returned':       return '#F97316'; // orange
    case 'in_delivery':    return '#2563EB'; // bleu
    case 'ready':          return '#7C3AED'; // violet
    case 'picking':        return '#D97706'; // ambre
    case 'awaiting_stock': return '#9CA3AF'; // gris
    case 'picked_up': return '#2563EB';
    case 'pending':
    case 'confirmed':      return RED;
    default:               return '#6B7280';
  }
}

function StatsRow({ orders }: { orders: OrderSummary[] }) {
  const total   = orders.length;
  const spent   = orders.reduce((sum, o) => sum + Number(o.total_ttc ?? 0), 0);
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={styles.statIconBox}>
          <Feather name="shopping-bag" size={16} color="#6B7280" />
        </View>
        <Text style={styles.statLabel}>Total{'\n'}commandes</Text>
        <Text style={styles.statValue}>{total}</Text>
      </View>
      <View style={[styles.statCard, styles.statCardRed]}>
        <View style={[styles.statIconBox, { backgroundColor: '#FEE2E2' }]}>
          <Feather name="credit-card" size={16} color={RED} />
        </View>
        <Text style={[styles.statLabel, { color: RED }]}>Total dépensé</Text>
        <Text style={[styles.statValueBig, { color: RED }]}>
          {spent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <Text style={styles.statCurrency}> MAD</Text>
        </Text>
      </View>
    </View>
  );
}

function ArticleThumbs({ items, count }: { items: { image_url?: string }[]; count: number }) {
  const visible = items.slice(0, 3);
  const extra   = count - visible.length;
  return (
    <View style={styles.thumbsRow}>
      {visible.map((it, i) => (
        <View key={i} style={styles.thumbWrap}>
          {it.image_url
            ? <Image source={{ uri: it.image_url }} style={styles.thumb} resizeMode="cover" />
            : <View style={styles.thumbPlaceholder}>
                <Feather name="package" size={14} color="#D1D5DB" />
              </View>
          }
        </View>
      ))}
      {extra > 0 && (
        <View style={styles.thumbExtra}>
          <Text style={styles.thumbExtraText}>+{extra}</Text>
          <Text style={styles.thumbExtraLabel}>AUTRES</Text>
        </View>
      )}
    </View>
  );
}

function OrderCard({ order, onPress, onReorder, reordering }: {
  order: OrderSummary;
  onPress: () => void;
  onReorder: () => void;
  reordering?: boolean;
}) {
  const statusCode  = order.status?.code ?? '';
  const statusColor = order.status?.color ?? getStatusColor(statusCode);
  const statusName  = order.status?.name_fr ?? '—';

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.cardIconBox}>
            <Feather name="file-text" size={18} color={RED} />
          </View>
          <View>
            <Text style={styles.cardRef}>Commande #{order.reference ?? order.id.slice(0, 4).toUpperCase()}</Text>
            <Text style={styles.cardDate}>{formatDate(order.created_at)}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
          {statusCode === 'delivered'
            ? <Feather name="check" size={11} color={statusColor} style={{ marginRight: 3 }} />
            : <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
          }
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusName}</Text>
        </View>
      </View>

      {/* ── Articles + prix ── */}
      <View style={styles.cardBody}>
        <ArticleThumbs
          items={order.items ?? []}
          count={order.item_count ?? 0}
        />
        <View style={styles.priceBlock}>
          <Text style={styles.priceValue}>
            {Number(order.total_ttc).toFixed(2)}
          </Text>
          <Text style={styles.priceCurrency}>MAD</Text>
        </View>
      </View>

      {/* ── Boutons ── */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.btnOutline} onPress={onPress} activeOpacity={0.8}>
          <Feather name="eye" size={14} color={RED} />
          <Text style={styles.btnOutlineText}>Voir détails</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnRed, reordering && { opacity: 0.6 }]}
          onPress={onReorder}
          disabled={reordering}
          activeOpacity={0.85}
        >
          {reordering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.btnRedText}>Re-cmder</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReorderModal({
  visible, onMerge, onReplace, onCancel,
}: {
  visible:   boolean;
  onMerge:   () => void;
  onReplace: () => void;
  onCancel:  () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconBox}>
            <Feather name="shopping-cart" size={22} color={RED} />
          </View>
          <Text style={styles.modalTitle}>Panier non vide</Text>
          <Text style={styles.modalSubtitle}>
            Votre panier contient déjà des articles. Que voulez-vous faire avec cette commande ?
          </Text>

          <TouchableOpacity style={styles.btnMerge} onPress={onMerge} activeOpacity={0.85}>
            <Feather name="git-merge" size={16} color="#fff" />
            <Text style={styles.btnMergeText}>Fusionner avec le panier</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnReplace} onPress={onReplace} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={16} color={RED} />
            <Text style={styles.btnReplaceText}>Remplacer le panier</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders,     setOrders]     = useState<OrderSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<TabKey>('all');
  const [reordering, setReordering] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState<OrderSummary | null>(null);

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

  const performReorder = async (order: OrderSummary, mode: 'merge' | 'replace') => {
    setReorderTarget(null);
    setReordering(order.id);
    try {
      await CartService.reorder(order.id, mode);
      router.push('/main/cart' as any);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Impossible d'ajouter les articles au panier");
    } finally {
      setReordering(null);
    }
  };

  const handleReorder = async (order: OrderSummary) => {
    try {
      const currentCart = await CartService.getCart();
      if (currentCart.count > 0) {
        setReorderTarget(order);
      } else {
        performReorder(order, 'merge');
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de vérifier le panier');
    }
  };

  if (!fontsLoaded) return null;

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter(o => {
        const tab = TABS.find(t => t.key === activeTab);
        return tab?.statusCodes.includes(o.status?.code ?? '');
      });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title="Historique des commandes" />

      {/* ── Tabs ── */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            const count  = tab.key === 'all' ? orders.length
              : orders.filter(o => tab.statusCodes.includes(o.status?.code ?? '')).length;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {count > 0 && !active && (
                  <View style={styles.tabCount}>
                    <Text style={styles.tabCountText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-bag" size={52} color="#E5E7EB" />
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptySub}>Vos commandes apparaîtront ici</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/main/home' as any)}>
            <Text style={styles.emptyBtnText}>Commencer mes achats</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => o.id}
          ListHeaderComponent={<StatsRow orders={orders} />}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push({ pathname: '/order/order-detail' as any, params: { id: item.id } })}
              onReorder={() => handleReorder(item)}
              reordering={reordering === item.id}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[RED]} tintColor={RED} />
          }
        />
      )}

      <ReorderModal
        visible={!!reorderTarget}
        onMerge={() => reorderTarget && performReorder(reorderTarget, 'merge')}
        onReplace={() => reorderTarget && performReorder(reorderTarget, 'replace')}
        onCancel={() => setReorderTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#ffffff' },
  list:    { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },

  tabsWrap:    { backgroundColor: '#fff' },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 50, backgroundColor: '#F3F4F6',
  },
  tabActive:      { backgroundColor: RED },
  tabLabel:       { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  tabLabelActive: { color: '#fff' },
  tabCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabCountText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },

  statsRow:      { flexDirection: 'row', gap: 12, marginBottom: 16, marginTop: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statCardRed:   { borderWidth: 1, borderColor: '#FEE2E2' },
  statIconBox:   {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  statLabel:     { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#6B7280', marginBottom: 4 },
  statValue:     { fontSize: 28, fontFamily: 'Poppins_700Bold', color: '#1A1A1A' },
  statValueBig:  { fontSize: 22, fontFamily: 'Poppins_700Bold' },
  statCurrency:  { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
  },
  cardRef:  { fontSize: 13.5, fontFamily: 'Poppins_600SemiBold', color: '#1A1A1A' },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 1 },

  badge:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  cardBody:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  thumbsRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumbWrap:   { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  thumb:       { width: '100%', height: '100%' },
  thumbPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbExtra:  {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
  },
  thumbExtraText:  { fontSize: 13, fontFamily: 'Poppins_700Bold', color: RED },
  thumbExtraLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: RED },

  priceBlock:   { alignItems: 'flex-end' },
  priceValue:   { fontSize: 22, fontFamily: 'Poppins_700Bold', color: RED, lineHeight: 32 },
  priceCurrency:{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },

  cardActions:  { flexDirection: 'row', gap: 10 },
  btnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: RED, backgroundColor: '#fff',
  },
  btnOutlineText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: RED },
  btnRed: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, backgroundColor: RED,
    shadowColor: RED, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  btnRedText: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle:  { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1A1A1A', marginTop: 8 },
  emptySub:    { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  emptyBtn:    { marginTop: 16, backgroundColor: RED, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // ── Modal reorder ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  modalIconBox: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF0F0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  modalTitle:    { fontSize: 19, fontFamily: 'Poppins_700Bold', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 13.5, fontFamily: 'Inter_400Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  btnMerge: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 14, paddingVertical: 15, marginBottom: 10,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  btnMergeText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  btnReplace: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: RED, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, marginBottom: 10,
  },
  btnReplaceText: { color: RED, fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  btnCancel: { paddingVertical: 10 },
  btnCancelText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },
});
