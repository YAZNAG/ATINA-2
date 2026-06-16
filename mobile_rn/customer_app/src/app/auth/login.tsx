import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Image, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Dimensions,
  Modal, FlatList,
} from 'react-native';
import {
  useFonts, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { login } from '../../services/customer_auth.service';
import countries from '../../constants/countries.json';

SplashScreen.preventAutoHideAsync();
const { width, height } = Dimensions.get('window');
const RED = '#E10600';

type Country = { code: string; flag: string; name: string };
type LoginMode = 'phone' | 'email';

const Logo = () => (
  <View style={styles.logoContainer}>
    <Image source={require('../../../assets/images/app/ElHerri.png')} style={styles.logoTextLeft} resizeMode="stretch" />
    <Image source={require('../../../assets/images/app/chariot.png')} style={styles.logoIcon} resizeMode="stretch" />
    <Image source={require('../../../assets/images/app/arab.png')} style={styles.logoTextRight} resizeMode="stretch" />
  </View>
);

export default function LoginScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);

  const [mode, setMode]         = useState<LoginMode>('phone');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── Sélecteur de pays ──
  const countryList = countries as Country[];
  const [country, setCountry] = useState<Country>(
    countryList.find((c) => c.code === '+212') || countryList[0]
  );
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = useMemo(() =>
    countryList.filter((c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
    ), [countryList, countrySearch]
  );

  if (!fontsLoaded) return null;

  const clearError = () => setError('');

  const handleLogin = async () => {
    if (mode === 'phone' && !phone.trim()) { setError('Entrez votre numéro de téléphone.'); return; }
    if (mode === 'email' && !email.trim()) { setError('Entrez votre adresse email.'); return; }
    if (!password) { setError('Entrez votre mot de passe.'); return; }

    try {
      setLoading(true);
      clearError();
      if (mode === 'phone') {
        await login(phone.trim(), password, country.code);
      } else {
        await login('', password, country.code, email.trim());
      }
      router.replace('/main/home');
    } catch (e: any) {
      setError(e.message ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCountry = (c: Country) => {
    setCountry(c);
    setCountryPickerVisible(false);
    setCountrySearch('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.redBg}>
          <Logo />
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>

              {/* ── Tabs Connexion / Inscription ── */}
              <View style={styles.tabRow}>
                <View style={[styles.tab, styles.tabActive]}>
                  <Text style={[styles.tabText, styles.tabTextActive]}>Connexion</Text>
                </View>
                <TouchableOpacity style={styles.tab} onPress={() => router.push('/auth/register')} activeOpacity={0.8}>
                  <Text style={styles.tabText}>Inscription</Text>
                </TouchableOpacity>
              </View>

              {/* ── Toggle Phone / Email ── */}
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'phone' && styles.modeBtnActive]}
                  onPress={() => { setMode('phone'); clearError(); }}
                  activeOpacity={0.8}
                >
                  <Feather name="phone" size={14} color={mode === 'phone' ? RED : '#9CA3AF'} />
                  <Text style={[styles.modeBtnText, mode === 'phone' && styles.modeBtnTextActive]}>Téléphone</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
                  onPress={() => { setMode('email'); clearError(); }}
                  activeOpacity={0.8}
                >
                  <Feather name="mail" size={14} color={mode === 'email' ? RED : '#9CA3AF'} />
                  <Text style={[styles.modeBtnText, mode === 'email' && styles.modeBtnTextActive]}>Email</Text>
                </TouchableOpacity>
              </View>

              {/* ── Identifiant ── */}
              {mode === 'phone' ? (
                <>
                  <Text style={styles.label}>Numéro de téléphone</Text>
                  <View style={styles.phoneRow}>
                    {/* Sélecteur de pays */}
                    <TouchableOpacity
                      style={styles.countryPill}
                      onPress={() => setCountryPickerVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.countryFlag}>{country.flag}</Text>
                      <Text style={styles.countryCode}>{country.code}</Text>
                      <Feather name="chevron-down" size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="6 12 34 56 78"
                      placeholderTextColor="#9CA3AF"
                      value={phone}
                      onChangeText={t => { setPhone(t); clearError(); }}
                      keyboardType="phone-pad"
                      autoCorrect={false}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Adresse e-mail</Text>
                  <View style={styles.inputWrapper}>
                    <Feather name="mail" size={18} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="exemple@email.com"
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={t => { setEmail(t); clearError(); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </>
              )}

              {/* ── Mot de passe ── */}
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.pwdRow}>
                <Feather name="lock" size={18} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.pwdInput}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={t => { setPassword(t); clearError(); }}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd(v => !v)} activeOpacity={0.7}>
                  <Feather name={showPwd ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* ── Erreur ── */}
              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* ── Submit ── */}
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Se connecter</Text>}
              </TouchableOpacity>

              {/* ── Séparateur ── */}
              <View style={styles.sepRow}>
                <View style={styles.sepLine} />
                <Text style={styles.sepLabel}>OU</Text>
                <View style={styles.sepLine} />
              </View>

              {/* ── Créer un compte ── */}
              <View style={styles.signupRow}>
                <Text style={styles.signupLabel}>Nouveau ici ? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/register')} activeOpacity={0.8}>
                  <Text style={styles.signupLink}>Créer un compte</Text>
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* ── Country Picker Modal ── */}
      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisir un pays</Text>
              <TouchableOpacity onPress={() => { setCountryPickerVisible(false); setCountrySearch(''); }}>
                <Feather name="x" size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <Feather name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un pays..."
                placeholderTextColor="#9CA3AF"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code + item.name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, country.code === item.code && country.name === item.name && styles.countryItemSelected]}
                  onPress={() => handleSelectCountry(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemCode}>{item.code}</Text>
                  {country.code === item.code && country.name === item.name && (
                    <Feather name="check" size={18} color={RED} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>Aucun pays trouvé</Text>
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
  flex:     { flex: 1 },
  redBg:    { flex: 1, backgroundColor: RED, alignItems: 'center', paddingTop: 28 },
  scroll:   { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 },

  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 28, marginTop: 50 },
  logoTextLeft:  { height: 40, width: width * 0.30, tintColor: '#FFFFFF' },
  logoIcon:      { height: 32, width: width * 0.10, tintColor: '#FFFFFF' },
  logoTextRight: { height: 30, width: width * 0.20, tintColor: '#FFFFFF' },

  card: {
    width: width - 48, backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
  },

  tabRow:        { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 50, padding: 4, marginBottom: 20 },
  tab:           { flex: 1, paddingVertical: 8, borderRadius: 50, alignItems: 'center' },
  tabActive:     { backgroundColor: RED, elevation: 3 },
  tabText:       { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabTextActive: { color: '#FFFFFF' },

  modeRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 3, marginBottom: 20, gap: 3 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 6 },
  modeBtnActive:     { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  modeBtnText:       { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  modeBtnTextActive: { color: RED },

  label:        { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#212121', marginBottom: 8 },
  inputWrapper: { position: 'relative', marginBottom: 16, justifyContent: 'center' },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 12,
    paddingLeft: 44, paddingRight: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15, color: '#212121',
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 12,
    borderWidth: 1, borderColor: '#EEEEEE',
    marginBottom: 16, overflow: 'hidden',
  },
  countryPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRightWidth: 1, borderRightColor: '#E0E0E0', gap: 6,
  },
  countryFlag: { fontSize: 18 },
  countryCode: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#212121' },
  phoneInput:  { flex: 1, paddingHorizontal: 14, fontSize: 15, color: '#212121' },

  pwdRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 12,
    borderWidth: 1, borderColor: '#EEEEEE', marginBottom: 20,
  },
  pwdInput: {
    flex: 1, paddingLeft: 44, paddingRight: 8,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15, color: '#212121',
  },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 12 },

  errorBox:  { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#B91C1C', textAlign: 'center' },

  btnPrimary: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24, shadowRadius: 24, elevation: 5, marginBottom: 16,
  },
  btnDisabled:    { opacity: 0.65 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },

  sepRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sepLine:  { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  sepLabel: { marginHorizontal: 12, fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },

  signupRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  signupLabel: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  signupLink:  { fontSize: 14, fontFamily: 'Inter_700Bold', color: RED },

  // Country picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: height * 0.75 },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 12 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  pickerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#1a1a1a' },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  countryItemSelected: { backgroundColor: '#FFF5F5' },
  countryItemFlag: { fontSize: 22 },
  countryItemName: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: '#1a1a1a' },
  countryItemCode: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  pickerEmpty: { alignItems: 'center', padding: 32 },
  pickerEmptyText: { color: '#9CA3AF', fontSize: 14, fontFamily: 'Inter_400Regular' },
});