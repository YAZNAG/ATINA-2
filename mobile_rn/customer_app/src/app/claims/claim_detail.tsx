import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView,
  ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Modal de confirmation d'annulation
function CancelClaimModal({
  visible, onConfirm, onCancel, loading,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.modalTitle}>Annuler la réclamation ?</Text>
          <Text style={styles.modalSubtitle}>
            Voulez-vous vraiment annuler cette réclamation ?
          </Text>

          <TouchableOpacity
            style={[styles.btnConfirmDelete, loading && { opacity: 0.6 }]}
            onPress={onConfirm}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnConfirmDeleteText}>Oui</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7} disabled={loading}>
            <Text style={styles.btnCancelText}>Non</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function ClaimDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await ClaimsService.getClaimById(id);
      setClaim(data);
    } catch {
      setClaim(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const handleCancel = () => {
    setCancelModalVisible(true);
  };

  const confirmCancel = async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await ClaimsService.cancelClaim(id);
      setCancelModalVisible(false);
      router.back();
    } catch (e: any) {
      setCancelModalVisible(false);
      // Vous pouvez remplacer par un toast si vous en avez un dans l'app
      console.warn(e.message ?? "Impossible d'annuler");
    } finally {
      setCancelling(false);
    }
  };

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!claim) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.container}>
          <PageHeader title="Réclamation" />
          <View style={styles.centered}>
            <Feather name="alert-circle" size={40} color="#E5E7EB" />
            <Text style={styles.notFoundText}>Réclamation introuvable</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = STATUS_CONFIG[claim.status] ?? { color: '#64748B' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <PageHeader title="Détail réclamation" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Statut */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}16` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{claim.status_label}</Text>
            </View>
            <Text style={styles.date}>{formatDate(claim.created_at)}</Text>
          </View>

          <Text style={styles.typeTitle}>{claim.type_label}</Text>

          {claim.order && (
            <View style={styles.orderCard}>
              <Feather name="package" size={16} color={RED} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.orderRef}>Commande #{claim.order.reference}</Text>
                <Text style={styles.orderTotal}>{claim.order.total_ttc.toFixed(2)} DH</Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>Description</Text>
          <Text style={styles.description}>{claim.description}</Text>

          {claim.admin_note && (
            <>
              <Text style={styles.label}>Réponse du support</Text>
              <View style={styles.adminNoteBox}>
                <Feather name="message-square" size={14} color="#3B82F6" style={{ marginBottom: 6 }} />
                <Text style={styles.adminNoteText}>{claim.admin_note}</Text>
              </View>
            </>
          )}

          {claim.resolved_at && (
            <Text style={styles.resolvedText}>Résolue le {formatDate(claim.resolved_at)}</Text>
          )}

          {claim.status === 'OPEN' && (
            <TouchableOpacity
              style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.85}
            >
              {cancelling ? (
                <ActivityIndicator color={RED} />
              ) : (
                <Text style={styles.cancelBtnText}>Annuler la réclamation</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <CancelClaimModal
        visible={cancelModalVisible}
        onConfirm={confirmCancel}
        onCancel={() => setCancelModalVisible(false)}
        loading={cancelling}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 48 },
  notFoundText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#9CA3AF' },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  date: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  typeTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginTop: 14, marginBottom: 16 },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F1',
    borderRadius: 14, padding: 14, marginBottom: 20,
  },
  orderRef: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  orderTotal: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#6B7280', marginTop: 2 },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151', marginBottom: 8, marginTop: 8 },
  description: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#475569', lineHeight: 21 },

  adminNoteBox: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginTop: 4 },
  adminNoteText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#1E3A8A', lineHeight: 20 },

  resolvedText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#22C55E', marginTop: 16 },

  cancelBtn: {
    marginTop: 28, borderWidth: 1.5, borderColor: RED, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: RED },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 19,
  },
  btnConfirmDelete: {
    backgroundColor: RED,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  btnConfirmDeleteText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  btnCancel: {
    marginTop: 16,
    paddingVertical: 6,
  },
  btnCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
  },
});