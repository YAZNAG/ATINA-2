import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Notification } from '../../services/profile.service';

const RED = '#E62A27';

// ─── Icône + couleur selon le type d'événement ───────────────────────────────
const eventStyle = (code: string): { icon: string; color: string; bg: string } => {
  const c = code.toLowerCase();
  if (c.includes('order') || c.includes('commande'))
    return { icon: 'shopping-bag', color: RED, bg: '#FFF0F0' };
  if (c.includes('delivery') || c.includes('livr'))
    return { icon: 'truck', color: '#2563EB', bg: '#EFF6FF' };
  if (c.includes('payment') || c.includes('paiement'))
    return { icon: 'credit-card', color: '#22C55E', bg: '#F0FDF4' };
  if (c.includes('promo') || c.includes('offre'))
    return { icon: 'tag', color: '#F59E0B', bg: '#FFFBEB' };
  if (c.includes('wallet') || c.includes('points'))
    return { icon: 'gift', color: '#8B5CF6', bg: '#F5F3FF' };
  return { icon: 'bell', color: '#6B7280', bg: '#F5F5F5' };
};

// ─── Temps relatif ────────────────────────────────────────────────────────────
const timeAgo = (date: string): string => {
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "À l'instant";
  if (mins < 60)  return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days < 7)   return `Il y a ${days} j`;
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await ProfileService.listNotifications();
      setNotifications(data);
    } catch (err: any) {
      console.log('Error loading notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadNotifications(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadNotifications(); }, []);

  const handleMarkRead = async (notif: Notification) => {
    if (notif.is_read) return;
    setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
    try { await ProfileService.markNotificationRead(notif.id); }
    catch (err) { console.log(err); }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try { await ProfileService.markAllNotificationsRead(); }
    catch (err) { console.log(err); }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <Text style={styles.unreadInfo}>
          {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
        </Text>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Feather name="bell-off" size={40} color="#E0E0E0" />
          </View>
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptySubtitle}>
            Vous serez notifié des mises à jour de vos commandes ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          renderItem={({ item }) => {
            const st = eventStyle(item.event_code);
            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
                onPress={() => handleMarkRead(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.notifIcon, { backgroundColor: st.bg }]}>
                  <Feather name={st.icon as any} size={20} color={st.color} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={1}>
                    {item.title_fr || 'Notification'}
                  </Text>
                  {item.body_fr && (
                    <Text style={styles.notifBody} numberOfLines={2}>{item.body_fr}</Text>
                  )}
                  <Text style={styles.notifTime}>{timeAgo(item.sent_at)}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  markAllText: { fontSize: 13, color: RED, fontWeight: '600', width: 60, textAlign: 'right' },

  unreadInfo: { fontSize: 13, color: '#9CA3AF', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },

  list: { padding: 16, gap: 10 },

  notifCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12, alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  notifCardUnread: { backgroundColor: '#FFFDFD', borderWidth: 1, borderColor: '#FFE5E5' },
  notifIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  notifTitleUnread: { fontWeight: '800' },
  notifBody: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#9CA3AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED, marginTop: 6 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});