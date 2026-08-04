import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, TextInput,
  ActivityIndicator, Modal, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import ClaimsService, { ClaimTypeOption, ClaimType } from '../../services/claims.service';
import { ProfileService, OrderSummary } from '../../services/profile.service';

const RED = '#E10600';

const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  MISSING_PRODUCT: 'box',
  DAMAGED_PRODUCT: 'alert-circle',
  WRONG_PRODUCT:   'refresh-cw',
  REFUND_REQUEST:  'credit-card',
  DELIVERY_ISSUE:  'truck',   
  OTHER:           'help-circle',
};

// ── Modal générique (remplace Alert.alert) ──
type InfoModalState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'default' | 'success';
  onConfirm?: () => void;
};

const INITIAL_INFO_MODAL: InfoModalState = {
  visible: false, title: '', message: '',
};

function InfoModal({
  state, onClose,
}: {
  state: InfoModalState;
  onClose: () => void;
}) {
  const isSuccess = state.variant === 'success';
  return (
    <Modal visible={state.visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlayAlert} onPress={onClose} activeOpacity={1}>
        <TouchableOpacity style={styles.modalCardAlert} activeOpacity={1} onPress={() => {}}>
          {isSuccess && (
            <View style={styles.successIconWrap}>
              <Feather name="check-circle" size={40} color="#22C55E" />
            </View>
          )}
          <Text style={styles.modalTitleAlert}>{state.title}</Text>
          <Text style={styles.modalSubtitleAlert}>{state.message}</Text>

          <TouchableOpacity
            style={[styles.btnConfirmAlert, isSuccess && styles.btnConfirmAlertSuccess]}
            onPress={() => {
              state.onConfirm?.();
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnConfirmAlertText}>{state.confirmLabel ?? 'OK'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function CreateClaimScreen() {
  const router = useRouter();
  const { order_id: presetOrderId } = useLocalSearchParams<{ order_id?: string }>();

  const [types, setTypes] = useState<ClaimTypeOption[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(presetOrderId ?? null);
  const [selectedType, setSelectedType] = useState<ClaimType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const [infoModal, setInfoModal] = useState<InfoModalState>(INITIAL_INFO_MODAL);

  const showInfo = (
    title: string,
    message: string,
    opts?: { confirmLabel?: string; variant?: 'default' | 'success'; onConfirm?: () => void }
  ) => {
    setInfoModal({
      visible: true,
      title,
      message,
      confirmLabel: opts?.confirmLabel,
      variant: opts?.variant,
      onConfirm: opts?.onConfirm,
    });
  };

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [typesRes, ordersRes, profile] = await Promise.all([
          ClaimsService.getTypes(),
          ProfileService.listOrders().catch(() => []),
          ProfileService.getProfile().catch(() => null),
        ]);
        setTypes(typesRes);
        setOrders(ordersRes);
        if (profile) {
          setPhone(`${profile.phone_country ?? ''}${profile.phone_number ?? ''}`);
        }
      } catch {
        setTypes([]);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  const handlePickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showInfo('Permission requise', "L'accès à la caméra est nécessaire pour prendre une photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handlePickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showInfo('Permission requise', "L'accès à vos photos est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!selectedOrderId) return showInfo('Commande requise', 'Sélectionnez la commande concernée.');
    if (!selectedType) return showInfo('Type requis', 'Sélectionnez le type de réclamation.');
    if (!description.trim()) return showInfo('Description requise', 'Décrivez le problème rencontré.');

    setSubmitting(true);
    try {
      const claim = await ClaimsService.createClaim({
        order_id: selectedOrderId,
        type: selectedType,
        description: description.trim(),
        priority: priority === 'urgent' ? 'URGENT' : 'NORMAL',
        contact_phone: phone.trim() || undefined,
      });

      if (photoUri) {
        try {
          await ClaimsService.attachPhoto(claim.id, photoUri);
        } catch {

        }
      }

      showInfo('Réclamation envoyée', 'Nous la traiterons dans les plus brefs délais.', {
        variant: 'success',
        confirmLabel: 'OK',
        onConfirm: () => router.back(),
      });
    } catch (e: any) {
      showInfo('Erreur', e.message ?? "Impossible d'envoyer la réclamation");
    } finally {
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <PageHeader title="Réclamation" />

        {loadingData ? (
          <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* ── Commande concernée (dropdown) ── */}
            <Text style={styles.label}>Commande concernée</Text>
            <TouchableOpacity
              style={styles.orderSelector}
              onPress={() => setOrderPickerOpen(true)}
              activeOpacity={0.8}
              disabled={orders.length === 0}
            >
              <View style={styles.orderSelectorIcon}>
                <Feather name="box" size={18} color="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                {selectedOrder ? (
                  <Text style={styles.orderSelectorValue}>Commande #{selectedOrder.reference}</Text>
                ) : (
                  <Text style={styles.orderSelectorPlaceholder}>
                    {orders.length === 0 ? 'Aucune commande disponible' : 'Sélectionnez une commande'}
                  </Text>
                )}
              </View>
              <Feather name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* ── Type de réclamation (grille 2 colonnes) ── */}
            <Text style={styles.label}>Type de réclamation</Text>
            <View style={styles.typeGrid}>
              {types.map((t) => {
                const active = selectedType === t.code;
                const icon = TYPE_ICONS[t.code] ?? 'help-circle';
                return (
                  <TouchableOpacity
                    key={t.code}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => setSelectedType(t.code)}
                    activeOpacity={0.85}
                  >
                    <Feather name={icon} size={22} color={active ? '#fff' : RED} />
                    <Text style={[styles.typeCardText, active && styles.typeCardTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Description ── */}
            <View style={styles.descHeader}>
              <Text style={styles.label}>Décrivez votre problème</Text>
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="Expliquez ce qui s'est passé..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              maxLength={500}
            />

            {/* ── Photo */}
            <Text style={styles.label}>Ajouter une photo</Text>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setPhotoUri(null)}>
                  <Feather name="x" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoBox} onPress={handlePickCamera} activeOpacity={0.8}>
                  <Feather name="camera" size={22} color="#9CA3AF" />
                  <Text style={styles.photoBoxText}>Prendre une photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBox} onPress={handlePickGallery} activeOpacity={0.8}>
                  <Feather name="image" size={22} color="#9CA3AF" />
                  <Text style={styles.photoBoxText}>Choisir une image</Text>
                  <Text style={styles.photoBoxSubtext}>JPG • PNG</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Téléphone  */}
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              placeholder="+212 6 XX XX XX XX"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {/* ── Priorité  */}
            <Text style={styles.label}>Niveau de priorité</Text>
            <View style={styles.priorityRow}>
              <TouchableOpacity
                style={[styles.priorityBtn, priority === 'normal' && styles.priorityBtnActive]}
                onPress={() => setPriority('normal')}
                activeOpacity={0.8}
              >
                <Text style={[styles.priorityText, priority === 'normal' && styles.priorityTextActive]}>
                  Normal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priorityBtn, priority === 'urgent' && styles.priorityBtnUrgentActive]}
                onPress={() => setPriority('urgent')}
                activeOpacity={0.8}
              >
                <Text style={[styles.priorityText, priority === 'urgent' && styles.priorityTextActive]}>
                  Urgent
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Submit ── */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Envoyer la réclamation</Text>
              )}
            </TouchableOpacity>

            {/* ── Info box ── */}
            <View style={styles.infoBox}>
              <Feather name="info" size={16} color="#3B82F6" />
              <Text style={styles.infoBoxText}>
                Notre équipe répond généralement sous <Text style={styles.infoBoxBold}>24 heures</Text>.
              </Text>
            </View>
            
          </ScrollView>
        )}
      </View>

      {/* ── Modal sélection commande ── */}
      <Modal visible={orderPickerOpen} transparent animationType="slide" onRequestClose={() => setOrderPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionnez une commande</Text>
              <TouchableOpacity onPress={() => setOrderPickerOpen(false)}>
                <Feather name="x" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {orders.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.orderOption}
                  onPress={() => {
                    setSelectedOrderId(o.id);
                    setOrderPickerOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderOptionIcon}>
                    <Feather name="box" size={16} color={RED} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderOptionRef}>Commande #{o.reference}</Text>
                    <Text style={styles.orderOptionMeta}>
                      {new Date(o.created_at).toLocaleDateString('fr-FR')} · {Number(o.total_ttc).toFixed(2)} DH
                    </Text>
                  </View>
                  {selectedOrderId === o.id && <Feather name="check" size={18} color={RED} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal générique (remplace tous les Alert.alert) ── */}
      <InfoModal state={infoModal} onClose={() => setInfoModal(INITIAL_INFO_MODAL)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  label: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a', marginTop: 22, marginBottom: 10 },

  // Order selector
  orderSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14,
  },
  orderSelectorIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  orderSelectorPlaceholder: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  orderSelectorValue: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#1a1a1a' },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '47%',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16,
    padding: 16, gap: 10,
  },
  typeCardActive: { backgroundColor: RED, borderColor: RED },
  typeCardText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#374151', lineHeight: 19 },
  typeCardTextActive: { color: '#fff' },

  // Description
  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22 },
  charCount: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  textArea: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1a1a1a',
    textAlignVertical: 'top', minHeight: 110, marginTop: 10,
  },

  submitBtn: {
    marginTop: 24, backgroundColor: RED, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // Photo
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBox: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 6,
  },
  photoBoxText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  photoBoxSubtext: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  photoPreviewWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
  photoPreview: { width: '100%', height: 180, borderRadius: 14 },
  photoRemoveBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Phone
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1a1a1a',
  },

  // Priority
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
  },
  priorityBtnActive: { backgroundColor: RED, borderColor: RED },
  priorityBtnUrgentActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  priorityText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  priorityTextActive: { color: '#fff' },

  // Info box
  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginTop: 24,
  },
  infoBoxText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#1E3A8A', lineHeight: 19 },
  infoBoxBold: { fontFamily: 'Inter_700Bold' },

  // Modal order picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },
  orderOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  orderOptionIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF1F1',
    alignItems: 'center', justifyContent: 'center',
  },
  orderOptionRef: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  orderOptionMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },

  // ── Info/Alert modal ──
  modalOverlayAlert: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCardAlert: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  successIconWrap: { marginBottom: 14 },
  modalTitleAlert: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  modalSubtitleAlert: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 19,
  },
  btnConfirmAlert: {
    backgroundColor: RED,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  btnConfirmAlertSuccess: {
    backgroundColor: '#22C55E',
  },
  btnConfirmAlertText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});