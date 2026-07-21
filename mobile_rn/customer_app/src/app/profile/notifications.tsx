import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, ActivityIndicator, ScrollView,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Notification } from '../../services/profile.service';
import { useNotification } from '../../context/NotificationContext';
import PageHeader from '../../components/ui/PageHeader';
import SortBar from '../../components/ui/SortBar';

const RED = '#E10600';

type Tab = 'all' | 'orders' | 'promos' | 'important';

const NOTIF_TABS = [
  { value: 'all',       label: 'Tout' },
  { value: 'orders',    label: 'Commandes' },
  { value: 'promos',    label: 'Promotions' },
  { value: 'important', label: 'Importantes' },
];

function applyFilter(notifs: Notification[], tab: Tab): Notification[] {
  if (tab === 'all') return notifs;
  return notifs.filter(n => {
    const c = n.event_code.toLowerCase();
    if (tab === 'orders')    return c.includes('order') || c.includes('commande') || c.includes('delivery') || c.includes('livr') || c.includes('picking') || c.includes('ready');
    if (tab === 'promos')    return c.includes('promo') || c.includes('offre') || c.includes('discount') || c.includes('coupon');
    if (tab === 'important') return c.includes('wallet') || c.includes('points') || c.includes('payment') || c.includes('security') || c.includes('account') || c.includes('confirm');
    return true;
  });
}

function getStyle(code: string): { icon: string; color: string; bg: string } {
  const c = code.toLowerCase();
  if (c.includes('confirm'))
    return { icon: 'check-circle', color: '#22C55E', bg: '#F0FDF4' };
  if (c.includes('order') || c.includes('commande') || c.includes('picking') || c.includes('ready'))
    return { icon: 'package',      color: RED,        bg: '#FFF0F0' };
  if (c.includes('delivery') || c.includes('livr'))
    return { icon: 'truck',        color: '#2563EB',  bg: '#EFF6FF' };
  if (c.includes('payment') || c.includes('paiement'))
    return { icon: 'credit-card',  color: '#22C55E',  bg: '#F0FDF4' };
  if (c.includes('promo') || c.includes('offre') || c.includes('discount'))
    return { icon: 'tag',          color: '#F59E0B',  bg: '#FFFBEB' };
  if (c.includes('wallet') || c.includes('points'))
    return { icon: 'gift',         color: '#F97316',  bg: '#FFF7ED' };
  if (c.includes('security') || c.includes('account'))
    return { icon: 'shield',       color: '#6366F1',  bg: '#EEF2FF' };
  return   { icon: 'bell',         color: '#6B7280',  bg: '#F5F5F5' };
}


type Group = { title: string; count: number; items: Notification[] };

function groupByDate(notifs: Notification[]): Group[] {
  const now       = new Date();
  const todayStr  = now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const ydayStr   = yesterday.toDateString();
  const weekAgo   = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);

  const map: Record<string, Notification[]> = {};
  for (const n of notifs) {
    const d    = new Date(n.sent_at);
    const dStr = d.toDateString();
    const key  = dStr === todayStr   ? "Aujourd'hui"
               : dStr === ydayStr    ? 'Hier'
               : d >= weekAgo        ? 'Cette semaine'
               :                       'Plus ancien';
    (map[key] ??= []).push(n);
  }
  const ORDER = ["Aujourd'hui", 'Hier', 'Cette semaine', 'Plus ancien'];
  return ORDER.filter(k => map[k]).map(k => ({ title: k, count: map[k].length, items: map[k] }));
}

function timeLabel(date: string): string {
  const diff  = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return "À l'instant";
  if (mins  < 60)  return `Il y a ${mins} min`;
  if (hours < 24)  return `Il y a ${hours} h`;
  if (days  === 1) return 'Hier';
  if (days  < 7)   return `Il y a ${days} j`;
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshNotifCount } = useNotification();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<Tab>('all');

  const load = useCallback(async () => {
    try {
      const data = await ProfileService.listNotifications();
      setNotifications(data);
      refreshNotifCount();
    } catch (err) {
      console.log('Error loading notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshNotifCount]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const handleMarkRead = async (notif: Notification) => {
    if (notif.is_read) return;
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    try {
      await ProfileService.markNotificationRead(notif.id);
      await refreshNotifCount();
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await ProfileService.markAllNotificationsRead();
      await refreshNotifCount();
    } catch {}
  };

  const handleDelete = async (id: string) => {
  setNotifications(prev => prev.filter(n => n.id !== id));
  try {
    await ProfileService.deleteNotification(id);
    await refreshNotifCount();
  } catch { load(); }
};

  const handleDeleteAll = () => {
    Alert.alert('Tout supprimer', 'Supprimer toutes les notifications ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          setNotifications([]);
          try {
            await ProfileService.deleteAllNotifications();
            await refreshNotifCount();
          } catch { load(); }
        },
      },
    ]);
  };

  const filtered = applyFilter(notifications, activeTab);
  const groups   = groupByDate(filtered);
  const unread   = notifications.filter(n => !n.is_read).length;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <PageHeader
        title="Notifications"
        rightIcon={unread > 0 ? 'check-square' : notifications.length > 0 ? 'trash-2' : undefined}
        onRightPress={unread > 0 ? handleMarkAllRead : handleDeleteAll}
      />

      {/* Filter tabs */}
      <SortBar
        value={activeTab}
        onChange={v => setActiveTab(v as Tab)}
        options={NOTIF_TABS}
      />

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <View style={styles.emptyPage}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyCardTop}>
              <View style={styles.emptyIconCircle}>
                <Feather name="bell-off" size={26} color={RED} />
              </View>
              <View style={styles.emptyCardText}>
                <Text style={styles.emptyTitle}>Aucune notification{'\n'}pour le moment</Text>
                <Text style={styles.emptyBody}>
                  Vous recevrez ici les mises à jour de vos commandes et offres.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.replace('/main/main_nav/home' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyBtnText}>Explorer les offres</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
        >
          {groups.map(group => (
            <View key={group.title}>
              {/* Section header */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{group.title}</Text>
                <Text style={styles.sectionCount}>
                  {group.count} notification{group.count > 1 ? 's' : ''}
                </Text>
              </View>

              {/* Cards */}
              {group.items.map(item => {
                const st = getStyle(item.event_code);
                return (
                  <Swipeable
      key={item.id}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => handleDelete(item.id)}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    >
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    onPress={() => handleMarkRead(item)}
                    activeOpacity={0.75}
                  >
                    {/* Icon circle */}
                    <View style={[styles.iconCircle, { backgroundColor: st.bg }]}>
                      <Feather name={st.icon as any} size={20} color={st.color} />
                    </View>

                    {/* Content */}
                    <View style={styles.cardContent}>
                      <View style={styles.cardRow}>
                        <Text style={[styles.cardTitle, !item.is_read && styles.cardTitleUnread]} numberOfLines={1}>
                          {item.title_fr || 'Notification'}
                        </Text>
                        {!item.is_read && <View style={styles.unreadDot} />}
                        <Text style={styles.cardTime}>{timeLabel(item.sent_at)}</Text>
                      </View>
                      {item.body_fr ? (
                        <Text style={styles.cardBody} numberOfLines={2}>{item.body_fr}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  </Swipeable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Styles 

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, marginTop: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  sectionCount: { fontSize: 12, color: '#9CA3AF' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  cardTitle:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  cardTitleUnread: { fontWeight: '800' },
  cardTime:    { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },
  cardBody:    { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  unreadDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: RED, flexShrink: 0 },

  // Empty state
  emptyPage: {
    flex: 1, backgroundColor: '#ffffff',
    padding: 16, justifyContent: 'flex-start', paddingTop: 20,
  },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 18, gap: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  emptyIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  emptyCardText: { flex: 1 },
  emptyTitle: {
    fontSize: 16, fontWeight: '700', color: '#1a1a1a',
    lineHeight: 22, marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13, color: '#9CA3AF', lineHeight: 19,
  },
  emptyBtn: {
    backgroundColor: RED, borderRadius: 24,
    paddingVertical: 14, alignItems: 'center',
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  deleteAction: {
  backgroundColor: '#EF4444',
  justifyContent: 'center',
  alignItems: 'center',
  width: 72,
  borderRadius: 16,
  marginBottom: 10,
},
});
