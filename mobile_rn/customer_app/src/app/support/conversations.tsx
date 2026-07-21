import React, { useCallback, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import supportService, {
  SupportCategory,
  SupportConversation,
  ConversationStatus,
} from '../../services/support.service';

const RED = '#E10600';

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  ORDER: 'Commande',
  ACCOUNT: 'Compte',
  LOYALTY: 'Fidélité',
  PRODUCT: 'Produit',
  OTHER: 'Autre',
};

const CATEGORY_ICONS: Record<SupportCategory, keyof typeof Feather.glyphMap> = {
  ORDER: 'package',
  ACCOUNT: 'user',
  LOYALTY: 'award',
  PRODUCT: 'shopping-bag',
  OTHER: 'help-circle',
};

const CATEGORY_OPTIONS: Array<{ value: SupportCategory; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { value: 'ORDER', label: CATEGORY_LABELS.ORDER, icon: 'package' },
  { value: 'ACCOUNT', label: CATEGORY_LABELS.ACCOUNT, icon: 'user' },
  { value: 'LOYALTY', label: CATEGORY_LABELS.LOYALTY, icon: 'award' },
  { value: 'PRODUCT', label: CATEGORY_LABELS.PRODUCT, icon: 'shopping-bag' },
  { value: 'OTHER', label: CATEGORY_LABELS.OTHER, icon: 'help-circle' },
];

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string }> = {
  OPEN: { label: 'Ouverte', color: '#22C55E' },
  PENDING: { label: 'En attente', color: '#F59E0B' },
  RESOLVED: { label: 'Résolue', color: '#F59E0B' },
  CLOSED: { label: 'Fermée', color: '#94A3B8' },
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function ConversationCard({
  item,
  onPress,
  onDelete,
}: {
  item: SupportConversation;
  onPress: () => void;
  onDelete: () => void;
}) {
  const statusInfo = STATUS_CONFIG[item.status] ?? { label: 'Inconnu', color: '#64748B' };
  const icon = CATEGORY_ICONS[item.category] ?? 'help-circle';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={20} color={RED} />
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.subject} numberOfLines={1}>
            {item.subject}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}16` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.category}>{CATEGORY_LABELS[item.category] ?? item.category}</Text>
          <Text style={styles.date}>{formatDate(item.last_message_at)}</Text>
        </View>

        <Text style={styles.agent} numberOfLines={1}>
          {item.assigned_agent ? `Assignée à ${item.assigned_agent.full_name}` : "En attente d'agent"}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
        <Feather name="chevron-right" size={18} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );
}

// Modal de confirmation de suppression (même pattern que RemoveFavoriteModal)
function DeleteConversationModal({
  visible,
  subject,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  subject: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.confirmModalCard}>
          <Text style={styles.confirmModalTitle}>Supprimer la conversation ?</Text>
          <Text style={styles.confirmModalSubtitle}>
            Êtes-vous sûr de vouloir supprimer cette conversation ? Cette action est irréversible.
          </Text>
          <TouchableOpacity style={styles.btnConfirmDelete} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={styles.btnConfirmDeleteText}>Supprimer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function ConversationsScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupportConversation | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState<SupportCategory | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await supportService.getMyConversations();
      setConversations(data ?? []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openConversation = (conversationId: string) => {
    router.push({ pathname: '/support/chat' as any, params: { id: conversationId } });
  };

  const createConversationWithCategory = async (category: SupportCategory) => {
    setCreatingCategory(category);
    setCategoryModalVisible(false);

    try {
      const created = await supportService.createConversation({
        subject: 'Demande de support',
        category,
      });
      router.push({
        pathname: '/support/chat' as any,
        params: {
          id: created.id,
          initialText: 'Bonjour, j’ai besoin d’aide.',
        },
      });
    } catch {
      Alert.alert('Erreur', 'Impossible de créer la conversation. Réessayez plus tard.');
    } finally {
      setCreatingCategory(null);
    }
  };

  const openCategoryPicker = () => {
    setCategoryModalVisible(true);
  };

  const handleDeleteConversation = (conversation: SupportConversation) => {
    setDeleteTarget(conversation);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supportService.deleteConversation(deleteTarget.id);
      setConversations((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    } catch {
      Alert.alert('Erreur', 'Impossible de supprimer la conversation');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <PageHeader
          title="Mes conversations"
          rightIcon="plus"
          onRightPress={openCategoryPicker}
        />

        <Modal
          visible={categoryModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Sélectionnez une catégorie</Text>
              {CATEGORY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.categoryOption}
                  activeOpacity={0.8}
                  onPress={() => createConversationWithCategory(option.value)}
                >
                  <View style={styles.categoryOptionLeft}>
                    <View style={styles.categoryIconWrap}>
                      <Feather name={option.icon} size={18} color={RED} />
                    </View>
                    <Text style={styles.categoryOptionLabel}>{option.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setCategoryModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {loading ? (
          <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="message-circle" size={52} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>Aucune conversation</Text>
            <Text style={styles.emptySubtitle}>Besoin d'aide ? Lancez une nouvelle discussion.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={openCategoryPicker}
            >
              <Text style={styles.emptyBtnText}>Créer une conversation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationCard
                item={item}
                onPress={() => openConversation(item.id)}
                onDelete={() => handleDeleteConversation(item)}
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

      <DeleteConversationModal
        visible={deleteTarget !== null}
        subject={deleteTarget?.subject ?? null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  list: { paddingBottom: 32, paddingTop: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subject: { flex: 1, fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  category: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#64748B' },
  date: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  agent: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#475569', marginTop: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginTop: 8 },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: RED,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: '#111827',
    marginBottom: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: '#111827',
  },
  modalCancel: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },

  // Modal de confirmation de suppression (style repris de FavoritesScreen)
  confirmModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
    minHeight: 320,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmModalTitle: {
    fontSize: 22,
    color: '#1a1a1a',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  confirmModalSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    fontFamily: 'Inter_400Regular',
  },
  btnConfirmDelete: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: RED,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnConfirmDeleteText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnCancel: { paddingVertical: 12 },
  btnCancelText: { fontSize: 15, color: '#1a1a1a', fontFamily: 'Inter_600SemiBold' },
});