import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Image, KeyboardAvoidingView,
  Platform, ActivityIndicator, Dimensions, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { register, requestOtp } from '../../services/customer_auth.service';
import COUNTRIES from '../../constants/countries.json';

const { width, height } = Dimensions.get('window');
const RED = '#E62A27';
type Country = { code: string; flag: string; name: string };

export default function RegisterPhoneScreen() {
  const router = useRouter();

  const [phone, setPhone]                     = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [showPicker, setShowPicker]           = useState(false);
  const [countrySearch, setCountrySearch]     = useState('');
  const [loading, setLoading]                 = useState<'sms' | 'whatsapp' | null>(null);
  const [error, setError]                     = useState('');

  const filteredCountries = useMemo(() =>
    (COUNTRIES as Country[]).filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
    ), [countrySearch]
  );

  const handleSend = async (channel: 'sms' | 'whatsapp') => {
    if (!phone.trim()) { setError('Entrez votre numéro de téléphone.'); return; }

    try {
      setLoading(channel);
      setError('');

      // Récupère les données de l'étape 1
      const pendingStr = await SecureStore.getItemAsync('pending_registration');
      if (!pendingStr) { router.replace('/auth/register'); return; }
      const pending = JSON.parse(pendingStr);

      // Crée le compte
      await register({
        phone_number:  phone.trim(),
        full_name:     pending.full_name,
        password:      pending.password,
        phone_country: selectedCountry.code,
        email:         pending.email ?? undefined,
      });

      // Envoie l'OTP
      await requestOtp(phone.trim(), selectedCountry.code);

      // Sauvegarde le téléphone pour l'étape 3
      await SecureStore.setItemAsync('pending_registration', JSON.stringify({
        ...pending,
        phone_number:  phone.trim(),
        phone_country: selectedCountry.code,
        channel,
      }));

      router.push({
        pathname: '/auth/verify-otp' as any,
        params: {
          phone_number:  phone.trim(),
          phone_country: selectedCountry.code,
          channel,
        },
      });
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── Red section ── */}
        <View style={styles.redSection}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image source={require('../../../assets/images/app/ElHerri.png')} style={styles.logoTextLeft} resizeMode="contain" />
            <Image source={require('../../../assets/images/app/chariot.png')} style={styles.logoIcon} resizeMode="contain" />
            <Image source={require('../../../assets/images/app/arab.png')} style={styles.logoTextRight} resizeMode="contain" />
          </View>
        </View>

        {/* ── White card ── */}
        <View style={styles.card}>
          <Text style={styles.title}>Votre numéro</Text>
          <Text style={styles.subtitle}>Nous allons vérifier votre numéro par SMS ou WhatsApp.</Text>

          {/* ── Phone input ── */}
          <View style={styles.phoneRow}>
            <TouchableOpacity style={styles.countrySelector} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
              <Text style={styles.flag}>{selectedCountry.flag}</Text>
              <Text style={styles.countryCode}>{selectedCountry.code}</Text>
              <Feather name="chevron-down" size={14} color="#9CA3AF" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TextInput
              style={styles.phoneInput}
              placeholder="6 12 34 56 78"
              placeholderTextColor="#C4C4C4"
              value={phone}
              onChangeText={t => {
                const cleaned = t.startsWith('0') ? t.slice(1) : t;
                setPhone(cleaned);
                setError('');
              }}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* ── Boutons ── */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.btnSMS}
              onPress={() => handleSend('sms')}
              disabled={loading !== null}
              activeOpacity={0.85}
            >
              {loading === 'sms'
                ? <ActivityIndicator color={RED} size="small" />
                : <Text style={styles.btnSMSText}>SMS</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnWhatsApp}
              onPress={() => handleSend('whatsapp')}
              disabled={loading !== null}
              activeOpacity={0.85}
            >
              {loading === 'whatsapp'
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnWhatsAppText}>WhatsApp</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={styles.termsText}>
            En continuant, j'accepte les{' '}
            <Text style={styles.termsLink}>Conditions générales</Text>
            {' '}et la{' '}
            <Text style={styles.termsLink}>Politique de confidentialité</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* ── Country Picker Modal ── */}
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
                placeholder="Rechercher..."
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
              keyExtractor={item => item.code}
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
  safeArea: { flex: 1, backgroundColor: RED },
  flex:     { flex: 1, backgroundColor: RED },

  redSection: { height: height * 0.28, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  backBtn:    { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  logoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoTextLeft:  { height: 44, width: width * 0.28, tintColor: '#FFFFFF' },
  logoIcon:      { height: 44, width: width * 0.12, tintColor: '#FFFFFF' },
  logoTextRight: { height: 38, width: width * 0.22, tintColor: '#FFFFFF' },

  card: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 40,
  },
  title:    { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 28, lineHeight: 20 },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 16, marginBottom: 8,
    backgroundColor: '#FAFAFA', overflow: 'hidden',
  },
  countrySelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  flag:        { fontSize: 20 },
  countryCode: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  divider:     { width: 1, height: 28, backgroundColor: '#E5E7EB' },
  phoneInput:  { flex: 1, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 16 : 14, fontSize: 15, color: '#1a1a1a' },

  errorText: { color: RED, fontSize: 13, marginBottom: 12 },

  btnRow:          { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 24 },
  btnSMS:          { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 2, borderColor: RED, alignItems: 'center', justifyContent: 'center' },
  btnSMSText:      { color: RED, fontSize: 16, fontWeight: '700' },
  btnWhatsApp:     { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  btnWhatsAppText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  termsText: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  termsLink: { color: RED, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, maxHeight: height * 0.7 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  modalTitle:   { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  searchRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput:  { flex: 1, fontSize: 14, color: '#1a1a1a' },
  countryItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  countryItemSelected: { backgroundColor: '#FFF5F5' },
  countryFlag:         { fontSize: 24 },
  countryName:         { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  countryDialCode:     { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  emptyList:  { alignItems: 'center', padding: 32 },
  emptyText:  { color: '#9CA3AF', fontSize: 14 },
});