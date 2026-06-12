import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProfileService, Address } from '../../services/profile.service';
import PageHeader from '../../components/ui/PageHeader';


const RED = '#E62A27';
const { height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
//  Address Form Modal
// ─────────────────────────────────────────────────────────────────────────────
const AddressFormModal = ({
  visible, address, onSave, onClose, saving,
}: {
  visible:  boolean;
  address:  Address | null;
  onSave:   (data: Partial<Address>) => void;
  onClose:  () => void;
  saving:   boolean;
}) => {
  const [label, setLabel]                 = useState('');
  const [streetNumber, setStreetNumber]   = useState('');
  const [streetName, setStreetName]       = useState('');
  const [quartier, setQuartier]           = useState('');
  const [city, setCity]                   = useState('');
  const [postalCode, setPostalCode]       = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isDefault, setIsDefault]         = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel(address?.label || '');
      setStreetNumber(address?.street_number || '');
      setStreetName(address?.street_name || '');
      setQuartier(address?.quartier || '');
      setCity(address?.city || '');
      setPostalCode(address?.postal_code || '');
      setDeliveryNotes(address?.delivery_notes || '');
      setIsDefault(address?.is_default || false);
    }
  }, [visible, address]);

  const handleSubmit = () => {
    if (!streetName.trim()) { Alert.alert('Erreur', 'Le nom de rue est requis'); return; }
    if (!city.trim())       { Alert.alert('Erreur', 'La ville est requise'); return; }
    onSave({
      label:          label.trim() || null,
      street_number:  streetNumber.trim() || null,
      street_name:    streetName.trim(),
      quartier:       quartier.trim() || null,
      city:           city.trim(),
      postal_code:    postalCode.trim() || null,
      delivery_notes: deliveryNotes.trim() || null,
      is_default:     isDefault,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{address ? 'Modifier l\'adresse' : 'Nouvelle adresse'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Libellé (ex: Maison, Bureau)</Text>
            <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Maison" placeholderTextColor="#C4C4C4" />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>N°</Text>
                <TextInput style={styles.input} value={streetNumber} onChangeText={setStreetNumber} placeholder="12" placeholderTextColor="#C4C4C4" />
              </View>
              <View style={{ flex: 3 }}>
                <Text style={styles.fieldLabel}>Nom de rue *</Text>
                <TextInput style={styles.input} value={streetName} onChangeText={setStreetName} placeholder="Avenue Hassan II" placeholderTextColor="#C4C4C4" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Quartier</Text>
            <TextInput style={styles.input} value={quartier} onChangeText={setQuartier} placeholder="Centre-ville" placeholderTextColor="#C4C4C4" />

            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Ville *</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Agadir" placeholderTextColor="#C4C4C4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Code postal</Text>
                <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="80000" placeholderTextColor="#C4C4C4" keyboardType="number-pad" maxLength={5} />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Notes de livraison</Text>
            <TextInput style={[styles.input, styles.textArea]} value={deliveryNotes} onChangeText={setDeliveryNotes} placeholder="Étage, code porte..." placeholderTextColor="#C4C4C4" multiline />

            <TouchableOpacity style={styles.defaultRow} onPress={() => setIsDefault(!isDefault)} activeOpacity={0.7}>
              <View style={[styles.checkbox, isDefault && styles.checkboxChecked]}>
                {isDefault && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.defaultLabel}>Définir comme adresse par défaut</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnSave, saving && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{address ? 'Enregistrer' : 'Ajouter l\'adresse'}</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AddressesScreen() {
  const router = useRouter();

  const [addresses, setAddresses]   = useState<Address[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editAddress, setEditAddress]   = useState<Address | null>(null);
  const [saving, setSaving]         = useState(false);

  const loadAddresses = async () => {
    try {
      const data = await ProfileService.listAddresses();
      setAddresses(data);
    } catch (err: any) {
      console.log('Error loading addresses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAddresses(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadAddresses(); }, []);

  const handleSave = async (data: Partial<Address>) => {
    setSaving(true);
    try {
      if (editAddress) {
        await ProfileService.updateAddress(editAddress.id, data);
      } else {
        await ProfileService.createAddress(data);
      }
      setModalVisible(false);
      setEditAddress(null);
      await loadAddresses();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr: Address) => {
    Alert.alert('Supprimer l\'adresse', 'Voulez-vous supprimer cette adresse ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await ProfileService.deleteAddress(addr.id); await loadAddresses(); }
        catch (err: any) { Alert.alert('Erreur', err.message); }
      }},
    ]);
  };

  const handleSetDefault = async (addr: Address) => {
    try { await ProfileService.setDefaultAddress(addr.id); await loadAddresses(); }
    catch (err: any) { Alert.alert('Erreur', err.message); }
  };

  const openAdd  = () => { setEditAddress(null); setModalVisible(true); };
  const openEdit = (addr: Address) => { setEditAddress(addr); setModalVisible(true); };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <PageHeader title="Mes adresses" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Feather name="map-pin" size={40} color="#E0E0E0" />
          </View>
          <Text style={styles.emptyTitle}>Aucune adresse</Text>
          <Text style={styles.emptySubtitle}>Ajoutez une adresse de livraison pour vos commandes</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          renderItem={({ item }) => (
            <View style={styles.addressCard}>
              <View style={styles.addressIcon}>
                <Feather name={item.label?.toLowerCase().includes('bureau') ? 'briefcase' : 'home'} size={20} color={RED} />
              </View>
              <View style={styles.addressInfo}>
                <View style={styles.addressTop}>
                  <Text style={styles.addressLabel}>{item.label || 'Adresse'}</Text>
                  {item.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Par défaut</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addressText} numberOfLines={2}>
                  {[item.street_number, item.street_name, item.quartier, item.city].filter(Boolean).join(', ')}
                </Text>
                {!item.is_default && (
                  <TouchableOpacity onPress={() => handleSetDefault(item)}>
                    <Text style={styles.setDefaultLink}>Définir par défaut</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.addressActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                  <Feather name="edit-2" size={16} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
                  <Feather name="trash-2" size={16} color={RED} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* ── Add button ── */}
      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
        <Feather name="plus" size={22} color="#fff" />
        <Text style={styles.fabText}>Ajouter une adresse</Text>
      </TouchableOpacity>

      {/* ── Form Modal ── */}
      <AddressFormModal
        visible={modalVisible}
        address={editAddress}
        saving={saving}
        onSave={handleSave}
        onClose={() => { setModalVisible(false); setEditAddress(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },

  list: { padding: 16, gap: 12, paddingBottom: 100 },

  addressCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  addressIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  addressInfo: { flex: 1 },
  addressTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  defaultBadge: { backgroundColor: '#E8F5E9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { fontSize: 10, color: '#22C55E', fontWeight: '700' },
  addressText: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 4 },
  setDefaultLink: { fontSize: 12, color: RED, fontWeight: '600' },
  addressActions: { gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  fab: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: RED, borderRadius: 50, paddingVertical: 16, shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: height * 0.85 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11, fontSize: 15, color: '#1a1a1a', backgroundColor: '#FAFAFA' },
  textArea: { height: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },
  defaultLabel: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },

  btnSave: { backgroundColor: RED, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});