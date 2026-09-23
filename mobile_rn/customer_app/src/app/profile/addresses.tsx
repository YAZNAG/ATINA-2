import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView, Platform, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ProfileService, Address } from '../../services/profile.service';
import { CatalogService } from '../../services/catalog.service';
import PageHeader from '../../components/ui/PageHeader';
import { t } from '../../i18n';

const RED = '#E62A27';

/** Comparaison de noms de villes sans accents ni casse (GPS ↔ liste du back-office). */
const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
            <Text style={styles.pickerTitle}>{t('Choisir la ville')}</Text>
            <TouchableOpacity onPress={() => { setSearch(''); onClose(); }}>
              <Feather name="x" size={22} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Feather name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('Rechercher une ville...')}
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
                <Text style={styles.pickerEmptyText}>{t('Aucune ville trouvée')}</Text>
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
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone]                 = useState('');
  const [fullAddress, setFullAddress]     = useState(''); 
  const [quartier, setQuartier]           = useState('');
  const [city, setCity]                   = useState('');
  const [postalCode, setPostalCode]       = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isDefault, setIsDefault]         = useState(false);
  const [lat, setLat]                     = useState<number | null>(null);
  const [lng, setLng]                     = useState<number | null>(null);
  const [locating, setLocating]           = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  /** Adresse trouvée par le GPS, affichée sous le bouton (plus de fenêtre bloquante). */
  const [located, setLocated] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLabel(address?.label || '');
      setRecipientName(address?.recipient_name || '');
      setPhone(address?.phone || '');
      const combined = [address?.street_number, address?.street_name].filter(Boolean).join(', ');
      setFullAddress(combined);
      setQuartier(address?.quartier || '');
      setCity(address?.city || '');
      setPostalCode(address?.postal_code || '');
      setDeliveryNotes(address?.delivery_notes || '');
      setIsDefault(address?.is_default || false);
      setLat(address?.lat != null ? Number(address.lat) : null);
      setLng(address?.lng != null ? Number(address.lng) : null);
      setLocated(null);
    }
  }, [visible, address]);

  const handleGetLocation = async () => {
    try {
      setLocating(true);
      setLocated(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('Permission refusée'), t('Autorisez la localisation pour utiliser votre position actuelle.'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);

      let summary = t('Position enregistrée');
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (place) {
          // Rue et numéro : l'adresse trouvée remplace le champ (l'utilisateur peut la corriger).
          const street = [place.streetNumber, place.street || place.name].filter(Boolean).join(' ').trim();
          if (street) setFullAddress(street);
          const district = place.district || place.subregion || '';
          if (district) setQuartier(district);
          if (place.postalCode) setPostalCode(place.postalCode);
          if (place.city) {
            // La ville du GPS est reprise telle quelle si elle n'est pas dans la liste.
            const match = cities.find((c) => norm(c.name_fr) === norm(place.city!));
            setCity(match ? match.name_fr : place.city);
            if (match?.postal_code && !place.postalCode) setPostalCode(match.postal_code);
          }
          summary = [street, district, place.city].filter(Boolean).join(', ') || summary;
        }
      } catch { /* géocodage inverse optionnel */ }

      setLocated(summary);
    } catch (e) {
      Alert.alert(t('Erreur'), "Impossible d'obtenir votre position. Vérifiez que le GPS est activé.");
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
    if (!fullAddress.trim()) {
      Alert.alert(t('Adresse incomplète'), t('Saisissez la rue et le numéro, ou appuyez sur « Utiliser ma position actuelle ».'));
      return;
    }
    if (!city.trim()) {
      Alert.alert(t('Adresse incomplète'), t('Choisissez votre ville.'));
      return;
    }

    // Decoupe fullAddress en street_number/street_name l
    const trimmed = fullAddress.trim();
    const m = trimmed.match(/^(\d+)\s*,?\s*(.+)$/);
    const street_number = m ? m[1] : null;
    const street_name   = m ? m[2] : trimmed;

    onSave({
      label:          label.trim() || null,
      recipient_name: recipientName.trim() || null,
      phone:          phone.trim() || null,
      street_number,
      street_name,
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
            <Text style={styles.modalTitle}>{address ? "Modifier l'adresse" : 'Nouvelle adresse'}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Text style={styles.fieldLabel}>{t('Nom de l\'adresse')}</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder={t('Ex : Maison, Travail')}
              placeholderTextColor="#C4C4C4"
            />

            <Text style={styles.fieldLabel}>{t('Nom du destinataire')}</Text>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder={t('Ahmed Benali')}
              placeholderTextColor="#C4C4C4"
            />

            <Text style={styles.fieldLabel}>{t('Téléphone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('+212 6 XX XX XX XX')}
              placeholderTextColor="#C4C4C4"
              keyboardType="phone-pad"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>{t('Ville *')}</Text>
                <TouchableOpacity
                  style={styles.citySelector}
                  onPress={() => setCityPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.citySelectorText, !city && styles.citySelectorPlaceholder]} numberOfLines={1}>
                    {city || t('Agadir')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t('Quartier')}</Text>
                <TextInput
                  style={styles.input}
                  value={quartier}
                  onChangeText={setQuartier}
                  placeholder={t('Hay Salam')}
                  placeholderTextColor="#C4C4C4"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>{t('Adresse complète')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={fullAddress}
              onChangeText={setFullAddress}
              placeholder={t('Rue 25, N°18...')}
              placeholderTextColor="#C4C4C4"
              multiline
            />

            <Text style={styles.fieldLabel}>{t('Code postal')}</Text>
            <TextInput
              style={styles.input}
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="80000"
              placeholderTextColor="#C4C4C4"
              keyboardType="number-pad"
              maxLength={5}
            />

            <View style={styles.notesHeader}>
              <Text style={styles.fieldLabel}>{t('Instructions de livraison')}</Text>
              <Text style={styles.optionalTag}>(Optionnel)</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder={t('Code interphone, bâtiment...')}
              placeholderTextColor="#C4C4C4"
              multiline
            />

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
                    {lat != null ? t('Position enregistrée') : t('Utiliser ma position actuelle')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {!!located && (
              <View style={styles.locatedBox}>
                <Feather name="check-circle" size={15} color="#15803D" />
                <Text style={styles.locatedText} numberOfLines={2}>{located}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.defaultRow} onPress={() => setIsDefault(!isDefault)} activeOpacity={0.7}>
              <View style={[styles.checkbox, isDefault && styles.checkboxChecked]}>
                {isDefault && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={styles.defaultLabel}>{t('Définir comme adresse par défaut')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnSave, saving && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{address ? 'Enregistrer' : "Ajouter l'adresse"}</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

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
      Alert.alert(t('Erreur'), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addr: Address) => {
    Alert.alert("Supprimer l'adresse", 'Voulez-vous supprimer cette adresse ?', [
      { text: t('Annuler'), style: 'cancel' },
      { text: t('Supprimer'), style: 'destructive', onPress: async () => {
        try { await ProfileService.deleteAddress(addr.id); await loadAddresses(); }
        catch (err: any) { Alert.alert(t('Erreur'), err.message); }
      }},
    ]);
  };

  const openAdd  = () => { setEditAddress(null); setModalVisible(true); };
  const openEdit = (addr: Address) => { setEditAddress(addr); setModalVisible(true); };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <PageHeader title={t('Mes adresses')} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Feather name="map-pin" size={40} color={RED} />
              </View>
              <Text style={styles.emptyTitle}>{t('Aucune adresse')}</Text>
              <Text style={styles.emptySubtitle}>{t('Ajoutez une adresse de livraison pour vos commandes')}</Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
              <Feather name="plus" size={20} color="#fff" />
              <Text style={styles.addBtnText}>{t('Ajouter une adresse')}</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <View style={styles.addressCard}>
              <View style={styles.cardTop}>
                <View style={styles.addressIcon}>
                  <Feather name={item.label?.toLowerCase().includes('travail') || item.label?.toLowerCase().includes('bureau') ? 'briefcase' : 'home'} size={20} color={RED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>{item.label || t('Adresse')}</Text>
                  {item.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>{t('ADRESSE PAR DÉFAUT')}</Text>
                    </View>
                  )}
                </View>
              </View>

              {item.recipient_name && (
                <>
                  <Text style={styles.sectionLabel}>{t('NOM')}</Text>
                  <Text style={styles.sectionValue}>{item.recipient_name}</Text>
                </>
              )}

              <Text style={styles.sectionLabel}>{t('ADRESSE')}</Text>
              <Text style={styles.sectionValue}>
                {[item.quartier, item.street_number, item.street_name, item.city, item.postal_code]
                  .filter(Boolean).join(', ')}
              </Text>

              {item.phone && (
                <>
                  <Text style={styles.sectionLabel}>{t('TÉLÉPHONE')}</Text>
                  <Text style={styles.sectionValue}>{item.phone}</Text>
                </>
              )}

              <View style={styles.cardDivider} />

              <View style={styles.addressActions}>
                <TouchableOpacity style={styles.actionBtnOutline} onPress={() => openEdit(item)} activeOpacity={0.8}>
                  <Feather name="edit-2" size={15} color="#6B7280" />
                  <Text style={styles.actionBtnOutlineText}>{t('Modifier')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnDanger} onPress={() => handleDelete(item)} activeOpacity={0.8}>
                  <Feather name="trash-2" size={15} color={RED} />
                  <Text style={styles.actionBtnDangerText}>{t('Supprimer')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

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
  locatedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EAF7EE', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  locatedText: { flex: 1, fontSize: 13, color: '#15803D', fontFamily: 'Inter_500Medium' },
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, gap: 16, paddingBottom: 40 },

  addressCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  addressIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  defaultBadge: { alignSelf: 'flex-start', backgroundColor: '#FFE5E5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  defaultBadgeText: { fontSize: 10, color: RED, fontWeight: '800', letterSpacing: 0.4 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  sectionValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', lineHeight: 20 },

  cardDivider: { height: 1, backgroundColor: '#F0F0F0', marginTop: 16, marginBottom: 14 },

  addressActions: { flexDirection: 'row', gap: 10 },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F5F5F5', borderRadius: 12, paddingVertical: 12,
  },
  actionBtnOutlineText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFEAEA', borderRadius: 12, paddingVertical: 12,
  },
  actionBtnDangerText: { fontSize: 14, fontWeight: '700', color: RED },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 50, paddingVertical: 18, marginTop: 8,
    shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, maxHeight: height * 0.9 },
  modalHandle: { display: 'none' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center' },

  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 18 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  optionalTag: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 15 : 12, fontSize: 15, color: '#1a1a1a', backgroundColor: '#F9FAFB' },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  citySelector: { justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 15 : 13, backgroundColor: '#F9FAFB' },
  citySelectorText: { fontSize: 15, color: '#1a1a1a' },
  citySelectorPlaceholder: { color: '#C4C4C4' },

  locationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: RED, borderRadius: 14, paddingVertical: 14, marginTop: 18, backgroundColor: '#FFF8F8' },
  locationBtnDone: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
  locationBtnText: { fontSize: 14, fontWeight: '600', color: RED },

  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },
  defaultLabel: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },

  btnSave: { backgroundColor: RED, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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