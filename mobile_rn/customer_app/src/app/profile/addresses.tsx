import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ProfileService, Address } from '../../services/profile.service';
import { CatalogService } from '../../services/catalog.service';
import PageHeader from '../../components/ui/PageHeader';

const RED = '#E62A27';
const { height } = Dimensions.get('window');

type City = { id: string; name_fr: string; name_ar: string; postal_code?: string | null };

const CityPickerModal = ({
  visible, cities, selectedCity, onSelect, onClose,
}: {
  visible: boolean;
  cities: City[];
  selectedCity: string;
  onSelect: (city: City) => void;
  onClose: () => void;
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    cities.filter((c) =>
      c.name_fr.toLowerCase().includes(search.toLowerCase()) ||
      c.name_ar.includes(search)
    ), [cities, search]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choisir la ville</Text>
            <TouchableOpacity onPress={() => { setSearch(''); onClose(); }}>
              <Feather name="x" size={22} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Feather name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une ville..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cityItem, selectedCity === item.name_fr && styles.cityItemSelected]}
                onPress={() => { onSelect(item); setSearch(''); }}
                activeOpacity={0.7}
              >
                <Feather name="map-pin" size={16} color={selectedCity === item.name_fr ? RED : '#9CA3AF'} />
                <Text style={styles.cityName}>{item.name_fr}</Text>
                {item.postal_code && <Text style={styles.cityPostal}>{item.postal_code}</Text>}
                {selectedCity === item.name_fr && <Feather name="check" size={16} color={RED} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>Aucune ville trouvée</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const AddressFormModal = ({
  visible, address, cities, onSave, onClose, saving,
}: {
  visible:  boolean;
  address:  Address | null;
  cities:   City[];
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
  const [lat, setLat]                     = useState<number | null>(null);
  const [lng, setLng]                     = useState<number | null>(null);
  const [locating, setLocating]           = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel(address?.label || '');
      let num  = address?.street_number || '';
      let name = address?.street_name   || '';
      if (!num && name) {
        const m = name.match(/^(\d+)\s+(.+)$/);
        if (m) { num = m[1]; name = m[2]; }
      }
      setStreetNumber(num);
      setStreetName(name);
      setQuartier(address?.quartier || '');
      setCity(address?.city || '');
      setPostalCode(address?.postal_code || '');
      setDeliveryNotes(address?.delivery_notes || '');
      setIsDefault(address?.is_default || false);
      setLat(address?.lat != null ? Number(address.lat) : null);
      setLng(address?.lng != null ? Number(address.lng) : null);
    }
  }, [visible, address]);

  // ── Géolocalisation ──
  const handleGetLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisez la localisation pour utiliser votre position actuelle.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);

      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (place) {
          if (place.street && !streetName)      setStreetName(place.street);
          if (place.district && !quartier)      setQuartier(place.district);
          if (place.postalCode && !postalCode)  setPostalCode(place.postalCode);
          if (place.city) {
            const match = cities.find((c) =>
              c.name_fr.toLowerCase() === place.city!.toLowerCase()
            );
            if (match) setCity(match.name_fr);
          }
        }
      } catch { /* géocodage inverse optionnel */ }

      Alert.alert('Position capturée', 'Votre localisation a été enregistrée pour cette adresse.');
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'obtenir votre position. Vérifiez que le GPS est activé.");
    } finally {
      setLocating(false);
    }
  };

  const handleSelectCity = (selected: City) => {
    setCity(selected.name_fr);
    if (selected.postal_code && !postalCode) setPostalCode(selected.postal_code);
    setCityPickerVisible(false);
  };

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
      lat,
      lng,
    } as Partial<Address>);
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

            {/* ── Bouton géolocalisation ── */}
            <TouchableOpacity
              style={[styles.locationBtn, lat != null && styles.locationBtnDone]}
              onPress={handleGetLocation}
              disabled={locating}
              activeOpacity={0.8}
            >
              {locating ? (
                <ActivityIndicator color={RED} size="small" />
              ) : (
                <>
                  <Feather name={lat != null ? 'check-circle' : 'map-pin'} size={18} color={RED} />
                  <Text style={styles.locationBtnText}>
                    {lat != null ? 'Position enregistrée' : 'Utiliser ma position actuelle'}
                  </Text>
                  {lat != null && (
                    <Text style={styles.locationCoords}>{lat.toFixed(4)}, {lng?.toFixed(4)}</Text>
                  )}
                </>
              )}
            </TouchableOpacity>

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
                {/* ── Sélecteur de ville ── */}
                <TouchableOpacity
                  style={styles.citySelector}
                  onPress={() => setCityPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.citySelectorText, !city && styles.citySelectorPlaceholder]}>
                    {city || 'Choisir une ville'}
                  </Text>
                  <Feather name="chevron-down" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Code postal</Text>
                <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="80000" placeholderTextColor="#C4C4C4" keyboardType="number-pad" maxLength={5} />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Appartement / Étage / Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} value={deliveryNotes} onChangeText={setDeliveryNotes} placeholder="Apt 3B, 2ème étage, code porte..." placeholderTextColor="#C4C4C4" multiline />

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

      {/* ── City Picker ── */}
      <CityPickerModal
        visible={cityPickerVisible}
        cities={cities}
        selectedCity={city}
        onSelect={handleSelectCity}
        onClose={() => setCityPickerVisible(false)}
      />
    </Modal>
  );
};

export default function AddressesScreen() {
  const router = useRouter();

  const [addresses, setAddresses]   = useState<Address[]>([]);
  const [cities, setCities]         = useState<City[]>([]);
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

  const loadCities = async () => {
    try {
      const data = await CatalogService.getCities();
      setCities(data as City[]);
    } catch (err: any) {
      console.log('Error loading cities:', err);
    }
  };

  useEffect(() => { loadAddresses(); loadCities(); }, []);
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

      <PageHeader title="Mes adresses" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Feather name="map-pin" size={40} color="#ffffff" />
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

      <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
        <Feather name="plus" size={22} color="#fff" />
        <Text style={styles.fabText}>Ajouter une adresse</Text>
      </TouchableOpacity>

      <AddressFormModal
        visible={modalVisible}
        address={editAddress}
        cities={cities}
        saving={saving}
        onSave={handleSave}
        onClose={() => { setModalVisible(false); setEditAddress(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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

  // Géoloc
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: RED, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginTop: 4, backgroundColor: '#FFF8F8' },
  locationBtnDone: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
  locationBtnText: { fontSize: 14, fontWeight: '600', color: RED },
  locationCoords:  { fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11, fontSize: 15, color: '#1a1a1a', backgroundColor: '#FAFAFA' },
  textArea: { height: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  // City selector
  citySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 12, backgroundColor: '#FAFAFA' },
  citySelectorText: { fontSize: 15, color: '#1a1a1a' },
  citySelectorPlaceholder: { color: '#C4C4C4' },

  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },
  defaultLabel: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },

  btnSave: { backgroundColor: RED, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // City picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, maxHeight: height * 0.7 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a' },
  cityItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  cityItemSelected: { backgroundColor: '#FFF5F5' },
  cityName: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  cityPostal: { fontSize: 13, color: '#9CA3AF' },
  pickerEmpty: { alignItems: 'center', padding: 32 },
  pickerEmptyText: { color: '#9CA3AF', fontSize: 14 },
});