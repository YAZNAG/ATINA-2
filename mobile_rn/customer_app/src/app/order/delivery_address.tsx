import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ScrollView,
  ActivityIndicator, Alert, Modal, FlatList, KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { ProfileService, Address } from '../../services/profile.service';
import { CatalogService } from '../../services/catalog.service';
import { getMe } from '../../services/customer_auth.service';
import PageHeader from '../../components/ui/PageHeader';
import CheckoutStepper from '../../components/ui/CheckoutStepper';

const RED = '#E10600';
const { height } = Dimensions.get('window');

type City = { id: string; name_fr: string; name_ar: string; postal_code?: string | null };

export default function CheckoutDeliveryAddressScreen() {
  const router = useRouter();
  const { cart_items } = useLocalSearchParams<{ cart_items: string }>();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
    Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
  });

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [cities, setCities]     = useState<City[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);

  // form
  const [streetName, setStreetName]   = useState('');
  const [apartment, setApartment]     = useState('');
  const [city, setCity]               = useState('');
  const [phone, setPhone]             = useState('');
  const [lat, setLat]                 = useState<number | null>(null);
  const [lng, setLng]                 = useState<number | null>(null);
  const [locating, setLocating]       = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  // ── Chargement initial ──
  useEffect(() => {
    (async () => {
      try {
        const [addrs, cityList] = await Promise.all([
          ProfileService.listAddresses(),
          CatalogService.getCities(),
        ]);
        setCities(cityList as City[]);

        // pré-remplit avec l'adresse par défaut
        const def = addrs.find((a) => a.is_default) || addrs[0] || null;
        if (def) {
          setDefaultAddress(def);
          setStreetName([def.street_number, def.street_name].filter(Boolean).join(' '));
          setApartment(def.delivery_notes || '');
          setCity(def.city || '');
          setLat(def.lat != null ? Number(def.lat) : null);
          setLng(def.lng != null ? Number(def.lng) : null);
        }

        // pré-remplit le téléphone avec celui du client connecté
        try {
          const me = await getMe();
          const phoneCountry = me?.phone_country || '';
          const phoneNumber  = me?.phone_number || '';
          if (phoneNumber) {
            setPhone(`${phoneCountry} ${phoneNumber}`.trim());
          }
        } catch { /* si getMe échoue, on laisse vide */ }

      } catch (e: any) {
        console.log('Error loading address data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Géolocalisation ──
  const handleGetLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisez la localisation pour utiliser votre position.');
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
          if (place.street) setStreetName(place.street);
          if (place.city) {
            const match = cities.find((c) => c.name_fr.toLowerCase() === place.city!.toLowerCase());
            if (match) setCity(match.name_fr);
          }
        }
      } catch { /* optionnel */ }

      Alert.alert('Position capturée', 'Votre localisation a été enregistrée.');
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'obtenir votre position.");
    } finally {
      setLocating(false);
    }
  };

  // ── Confirmer ──
  const handleConfirm = async () => {
    if (!streetName.trim()) { Alert.alert('Erreur', 'Veuillez entrer une adresse complète'); return; }
    if (!city.trim())       { Alert.alert('Erreur', 'Veuillez choisir une ville'); return; }
    if (!phone.trim())      { Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone'); return; }

    setSaving(true);
    try {
      let addressId = defaultAddress?.id;

      const payload: Partial<Address> = {
        label:          defaultAddress?.label || 'Livraison',
        street_number:  null,
        street_name:    streetName.trim(),
        city:           city.trim(),
        delivery_notes: apartment.trim() || null,
        lat,
        lng,
        is_default:     true,
      };

      if (defaultAddress) {
        await ProfileService.updateAddress(defaultAddress.id, payload);
        addressId = defaultAddress.id;
      } else {
        const created = await ProfileService.createAddress(payload);
        addressId = (created as any)?.id;
      }

      router.push({
        pathname: '/order/delivery_datetime' as any,
        params: {
          delivery_type_code: 'home',
          address_id:         addressId,
          cart_items,
        },
      });
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCity = (selected: City) => {
    setCity(selected.name_fr);
    setCityPickerVisible(false);
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>

          <PageHeader title="Adresse de livraison" />
          <CheckoutStepper currentStep={1} />

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={RED} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

              {/* ── Bannière position ── */}
              <View style={styles.locationBanner}>
                <View style={styles.locationPin}>
                  <Feather name="map-pin" size={26} color="#fff" />
                </View>
                <Text style={styles.locationBannerText}>
                  {lat != null ? 'Position enregistrée' : 'Aucune position GPS'}
                </Text>
                {lat != null && (
                  <Text style={styles.locationBannerCoords}>{lat.toFixed(4)}, {lng?.toFixed(4)}</Text>
                )}
              </View>

              {/* ── Utiliser ma position ── */}
              <TouchableOpacity style={styles.locBtn} onPress={handleGetLocation} disabled={locating} activeOpacity={0.8}>
                {locating
                  ? <ActivityIndicator color={RED} size="small" />
                  : <>
                      <Feather name="navigation" size={16} color={RED} />
                      <Text style={styles.locBtnText}>Utiliser ma position actuelle</Text>
                    </>
                }
              </TouchableOpacity>

              {/* ── Adresse complète ── */}
              <Text style={styles.fieldLabel}>Adresse complète</Text>
              <View style={styles.inputWrap}>
                <Feather name="map-pin" size={18} color={RED} />
                <TextInput
                  style={styles.input}
                  placeholder="Rue Mohammed V, Guéliz"
                  placeholderTextColor="#C4C4C4"
                  value={streetName}
                  onChangeText={setStreetName}
                />
              </View>

              {/* ── Appartement / Étage ── */}
              <Text style={styles.fieldLabel}>Appartement / Étage / Notes (optionnel)</Text>
              <View style={styles.inputWrap}>
                <Feather name="home" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder="Numéro appartement"
                  placeholderTextColor="#C4C4C4"
                  value={apartment}
                  onChangeText={setApartment}
                />
              </View>

              {/* ── Ville ── */}
              <Text style={styles.fieldLabel}>Ville</Text>
              <TouchableOpacity style={styles.inputWrap} onPress={() => setCityPickerVisible(true)} activeOpacity={0.7}>
                <Feather name="map" size={18} color={RED} />
                <Text style={[styles.input, !city && styles.placeholder]}>
                  {city || 'Choisir une ville'}
                </Text>
                <Feather name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              {/* ── Téléphone (pré-rempli) ── */}
              <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
              <View style={styles.inputWrap}>
                <Feather name="phone" size={18} color={RED} />
                <TextInput
                  style={styles.input}
                  placeholder="06 45 27 81 94"
                  placeholderTextColor="#C4C4C4"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* ── Badge vérifié ── */}
              {lat != null && (
                <View style={styles.verifiedRow}>
                  <Feather name="check-circle" size={14} color={RED} />
                  <Text style={styles.verifiedText}>Adresse vérifiée pour la livraison</Text>
                </View>
              )}

            </ScrollView>
          )}

          {/* ── Confirmer ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btnConfirm, saving && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Confirmer l'adresse</Text>
              }
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* ── City Picker ── */}
      <Modal visible={cityPickerVisible} transparent animationType="slide" onRequestClose={() => setCityPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir la ville</Text>
              <TouchableOpacity onPress={() => setCityPickerVisible(false)}>
                <Feather name="x" size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={cities}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cityItem, city === item.name_fr && styles.cityItemSelected]}
                  onPress={() => handleSelectCity(item)}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={16} color={city === item.name_fr ? RED : '#9CA3AF'} />
                  <Text style={styles.cityName}>{item.name_fr}</Text>
                  {item.postal_code && <Text style={styles.cityPostal}>{item.postal_code}</Text>}
                  {city === item.name_fr && <Feather name="check" size={16} color={RED} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  flex:      { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  locationBanner: { height: 150, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 8 },
  locationPin: { width: 52, height: 52, borderRadius: 26, backgroundColor: RED, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff', shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  locationBannerText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  locationBannerCoords: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: RED, borderRadius: 12, paddingVertical: 13, marginBottom: 20, backgroundColor: '#fff' },
  locBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: RED },

  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280', marginBottom: 8, marginTop: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 8 : 6, marginBottom: 16, backgroundColor: '#FAFAFA' },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#1a1a1a' },
  placeholder: { color: '#C4C4C4' },

  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  verifiedText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: RED },

  footer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 20, left: 16, right: 16 },
  btnConfirm: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, maxHeight: height * 0.7 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  pickerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  cityItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  cityItemSelected: { backgroundColor: '#FFF5F5' },
  cityName: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: '#1a1a1a' },
  cityPostal: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
});