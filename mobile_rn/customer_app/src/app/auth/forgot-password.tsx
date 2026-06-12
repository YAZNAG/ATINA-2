import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator, Dimensions, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { forgotPassword } from '../../services/customer_auth.service';
import COUNTRIES from '../../constants/countries.json';

const { height } = Dimensions.get('window');
const RED = '#E62A27';

type Country = { code: string; flag: string; name: string };

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
  });

  const [phoneNumber, setPhoneNumber]         = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [showPicker, setShowPicker]           = useState(false);
  const [countrySearch, setCountrySearch]     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const filteredCountries = useMemo(() =>
    (COUNTRIES as Country[]).filter((c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
    ),
    [countrySearch]
  );

  if (!fontsLoaded) return null;

  const handleSend = async () => {
    if (!phoneNumber) {
      setError('Veuillez entrer votre numéro de téléphone');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await forgotPassword(phoneNumber, selectedCountry.code);
      router.push({
        pathname: '/auth/forgot-otp' as any,
        params: {
          phone_country: selectedCountry.code,
          phone_number:  phoneNumber,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Numéro introuvable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.container}>

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mot de passe oublié</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>Entrez votre numéro de téléphone</Text>

            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                <Feather name="chevron-down" size={13} color="#9CA3AF" />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TextInput
                style={styles.input}
                placeholder="XXXXXXXXX"
                placeholderTextColor="#C4C4C4"
                value={phoneNumber}
                onChangeText={(t) => {
                  const cleaned = t.startsWith('0') ? t.slice(1) : t;
                  setPhoneNumber(cleaned);
                  setError('');
                }}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.infoText}>
              Nous vous enverrons un code de vérification pour réinitialiser votre mot de passe.
            </Text>

            <TouchableOpacity
              style={[styles.btnSend, loading && { opacity: 0.7 }]}
              onPress={handleSend}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnSendText}>Envoyer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir le pays</Text>
              <TouchableOpacity onPress={() => { setShowPicker(false); setCountrySearch(''); }}>
                <Feather name="x" size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <Feather name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un pays ou code..."
                placeholderTextColor="#9CA3AF"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <Feather name="x-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, selectedCountry.code === item.code && styles.countryItemSelected]}
                  onPress={() => { setSelectedCountry(item); setShowPicker(false); setCountrySearch(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryDialCode}>{item.code}</Text>
                  {selectedCountry.code === item.code && <Feather name="check" size={16} color={RED} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>Aucun pays trouvé</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: RED },
  flex:      { flex: 1 },
  container: { flex: 1, backgroundColor: RED, paddingHorizontal: 20, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  inputLabel: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: '#7A7A7A', marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 16, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  countrySelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 14 : 12, gap: 4 },
  flag:        { fontSize: 18 },
  countryCode: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: '#1a1a1a' },
  divider:     { width: 1, height: 26, backgroundColor: '#E5E7EB' },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 14 : 12, fontSize: 15, fontFamily: 'Poppins_400Regular', color: '#1a1a1a' },
  errorText: { color: RED, fontSize: 12, fontFamily: 'Poppins_400Regular', marginBottom: 8 },
  infoText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#000000', lineHeight: 20, marginBottom: 24 },
  btnSend: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnSendText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, maxHeight: height * 0.7 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  searchRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a' },
  countryItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  countryItemSelected: { backgroundColor: '#FFF5F5' },
  countryFlag:         { fontSize: 24 },
  countryName:         { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  countryDialCode:     { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  emptyList: { alignItems: 'center', padding: 32 },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
});