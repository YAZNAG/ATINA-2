import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold, Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { usePickerAuth } from '../../../context/PickerAuthContext';
import { getAvailableOrders, getMyOrders } from '../../../api/picker.api';

const RED = '#E10600';
const GREEN = '#1D9E75';
const BG_COLOR = '#F9FAFB';

export default function DashboardScreen() {
  const router = useRouter();
  const { picker, logout } = usePickerAuth();

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold, Poppins_400Regular,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const [available, setAvailable] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any>({ active: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [avail, mine] = await Promise.all([
        getAvailableOrders(),
        getMyOrders(),
      ]);
      setAvailable(avail ?? []);
      setMyOrders(mine ?? { active: [], completed: [] });
    } catch (err: any) {
      console.warn('Dashboard load error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (!fontsLoaded) return null;

  // Données fictives pour le graphique a  modifier pour dynamique 
  const chartData = [
    { time: '8h', value: '40%' },
    { time: '10h', value: '70%' },
    { time: '12h', value: '100%' },
    { time: '14h', value: '60%' },
    { time: '16h', value: '85%' },
    { time: '18h', value: '30%' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Bonjour  <Text style={styles.greetingName}>{picker?.name || 'Agent'}</Text>
          </Text>
          <Text style={styles.subGreeting}>Vos performances</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="bell" size={22} color="#1a1a1a" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={logout}>
            <Feather name="calendar" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RED]} />}
        >
          {/* Cartes de Statistiques */}
          <View style={styles.statsRow}>
            {/* Carte 1 : TOTAL */}
            <View style={styles.statCardOutlined}>
              <View style={styles.statCardHeader}>
                <Feather name="target" size={16} color={RED} />
                <Text style={styles.statCardTitle}>TOTAL</Text>
              </View>
              <Text style={styles.statValue}>{available.length}</Text>
              <Text style={styles.statLabel}>Commandes en attente</Text>
            </View>

            {/* Carte 2 : PRÊTES */}
            <View style={styles.statCardOutlined}>
              <View style={styles.statCardHeader}>
                <Feather name="check-circle" size={16} color={RED} />
                <Text style={styles.statCardTitle}>PRÊTES</Text>
              </View>
              <Text style={styles.statValue}>{myOrders.completed?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Succès préparation</Text>
            </View>
          </View>

          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Activité des Commandes</Text>
              <Text style={styles.chartSubtitle}>Aujourd'hui</Text>
            </View>
            <View style={styles.chartContainer}>
              {chartData.map((item, index) => (
                <View key={index} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: item.value as any }]} />
                  </View>
                  <Text style={styles.barLabel}>{item.time}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Liste des Commandes (Nouvelles & En cours combinées pour le visuel) */}
          <View style={styles.section}>
            <Text style={styles.sectionMainTitle}>Commandes à traiter</Text>

            {available.length === 0 && myOrders.active?.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={48} color="#D1FAE5" />
                <Text style={styles.emptyTitle}>Excellent travail !</Text>
                <Text style={styles.emptyText}>Aucune commande en attente pour l'instant.</Text>
              </View>
            ) : (
              <>
                {/* On mappe les commandes disponibles avec le nouveau design */}
                {available.slice(0, 5).map((order: any) => (
                  <View key={`avail-${order.id}`} style={styles.newOrderCard}>
                    <View style={styles.orderTopRow}>
                      <Text style={styles.orderId}>Commande #{order.id.slice(-6).toUpperCase()}</Text>
                      <View style={[styles.statusBadge, { borderColor: '#10B981' }]}>
                        <Text style={[styles.statusText, { color: '#10B981' }]}>EN ATTENTE</Text>
                      </View>
                    </View>
                    
                    <View style={styles.orderDetails}>
                      <View style={styles.detailRow}>
                        <Feather name="user" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>{order.customer?.name ?? 'Client Inconnu'} · <Text style={{fontWeight: 'bold'}}>{order.items_count} produits</Text></Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Feather name="clock" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>Reçue à l'instant</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Feather name="map-pin" size={14} color={RED} />
                        <Text style={[styles.detailText, { color: RED, fontWeight: 'bold' }]}>RETRAIT EN MAGASIN</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={() => router.push({ pathname: '/main/order-detail' as any, params: { order_id: order.id } })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.primaryButtonText}>Préparer la commande</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 }, // Espace en bas pour la BottomBar éventuelle

  // --- Header ---
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16,
  },
  greeting: { fontSize: 20, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  greetingName: { color: RED, fontFamily: 'Poppins_700Bold' },
  subGreeting: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: -2 },
  headerIcons: { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  notificationDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4, backgroundColor: RED,
    borderWidth: 1.5, borderColor: '#fff'
  },

  // --- Statistiques ---
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 24 },
  statCardOutlined: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  statCardTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6B7280', letterSpacing: 0.5 },
  statValue: { fontSize: 32, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', lineHeight: 36 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center' },

  // --- Graphique ---
  chartSection: { marginBottom: 32 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  chartSubtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: RED },
  chartContainer: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', 
    height: 120, paddingHorizontal: 10 
  },
  barCol: { alignItems: 'center', width: 30, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: 14, height: 90, backgroundColor: '#F3F4F6', borderRadius: 10, justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: RED, borderRadius: 10 },
  barLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 8 },

  // --- Liste des commandes ---
  section: { marginBottom: 20 },
  sectionMainTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginBottom: 16 },
  
  newOrderCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  statusBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  
  orderDetails: { gap: 8, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#4B5563' },

  primaryButton: {
    backgroundColor: RED, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center'
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

  // --- Empty State ---
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#374151' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', textAlign: 'center' },
});