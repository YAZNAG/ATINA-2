import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Image, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import {
  useFonts, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

SplashScreen.preventAutoHideAsync();
const { width } = Dimensions.get('window');
const RED = '#E62A27';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Logo = () => (
  <View style={styles.logoContainer}>
    <Image source={require('../../../assets/images/app/ElHerri.png')} style={styles.logoTextLeft} resizeMode="stretch" />
    <Image source={require('../../../assets/images/app/chariot.png')} style={styles.logoIcon} resizeMode="stretch" />
    <Image source={require('../../../assets/images/app/arab.png')} style={styles.logoTextRight} resizeMode="stretch" />
  </View>
);

export default function RegisterScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });

  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);

  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms]   = useState(false);
  const [error, setError]               = useState('');

  if (!fontsLoaded) return null;

  const clearError = () => setError('');

  const handleNext = async () => {
    if (!fullName.trim())    { setError('Entrez votre nom complet'); return; }
    if (!email.trim())    { setError('Email obligatoire'); return; }
    if (email && !EMAIL_REGEX.test(email)) { setError('Adresse email invalide'); return; }
    if (password.length < 6) { setError('Mot de passe minimum 6 caractères'); return; }
    if (!acceptTerms)        { setError("Acceptez les conditions d'utilisation"); return; }

    // Sauvegarde temporaire
    await SecureStore.setItemAsync('pending_registration', JSON.stringify({
      full_name: fullName.trim(),
      email:     email.trim() || null,
      password,
    }));

    router.push('/auth/verify-phone' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.redBg}>
          <Logo />
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>

              {/* ── Tabs ── */}
              <View style={styles.tabRow}>
                <TouchableOpacity style={styles.tab} onPress={() => router.push('/auth/login')} activeOpacity={0.8}>
                  <Text style={styles.tabText}>Connexion</Text>
                </TouchableOpacity>
                <View style={[styles.tab, styles.tabActive]}>
                  <Text style={[styles.tabText, styles.tabTextActive]}>Inscription</Text>
                </View>
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* ── Nom complet ── */}
              <Text style={styles.label}>Nom complet</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Entrez votre nom"
                  placeholderTextColor="#9CA3AF"
                  value={fullName}
                  onChangeText={t => { setFullName(t); clearError(); }}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              {/* ── Email (optionnel) ── */}
              <Text style={styles.label}>
                Adresse e-mail 
              </Text>
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

              {/* ── Mot de passe ── */}
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Créer un mot de passe"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={t => { setPassword(t); clearError(); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.inputRightIcon} onPress={() => setShowPassword(v => !v)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>Au moins 6 caractères</Text>

              {/* ── Terms ── */}
              <TouchableOpacity style={styles.termsRow} onPress={() => setAcceptTerms(v => !v)} activeOpacity={0.8}>
                <View style={[styles.checkbox, acceptTerms && styles.checkboxActive]}>
                  {acceptTerms && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={styles.termsText}>
                  J'accepte les <Text style={styles.termsLink}>Conditions d'utilisation</Text> et la{' '}
                  <Text style={styles.termsLink}>Politique de confidentialité</Text>
                </Text>
              </TouchableOpacity>

              {/* ── Suivant ── */}
              <TouchableOpacity
                style={[styles.btnPrimary, !acceptTerms && styles.btnDisabled]}
                onPress={handleNext}
                activeOpacity={0.85}
                disabled={!acceptTerms}
              >
                <Text style={styles.btnPrimaryText}>Créer mon compte</Text>
              </TouchableOpacity>

                            {/* ── Séparateur ── */}
                            <View style={styles.sepRow}>
                              <View style={styles.sepLine} />
                              <Text style={styles.sepLabel}>OU</Text>
                              <View style={styles.sepLine} />
                            </View>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Déjà un compte ? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')} activeOpacity={0.8}>
                  <Text style={styles.loginLink}>Se connecter</Text>
                </TouchableOpacity>
              </View>



            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: RED },
  flex:     { flex: 1 },
  redBg:    { flex: 1, backgroundColor: RED, alignItems: 'center', paddingTop: 28 },
  scroll:   { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 },

  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 28, marginTop: 15 },
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
  tab:           { flex: 1, paddingVertical: 10, borderRadius: 50, alignItems: 'center' },
  tabActive:     { backgroundColor: RED, elevation: 3 },
  tabText:       { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF' },
  tabTextActive: { color: '#FFFFFF' },

  errorBox:  { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#B91C1C', textAlign: 'center' },

  label:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#212121', marginBottom: 8 },
  hint:     { fontSize: 12, color: '#9CA3AF', marginTop: -8, marginBottom: 16 },

  inputWrapper:  { position: 'relative', marginBottom: 16, justifyContent: 'center' },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 12,
    paddingLeft: 44, paddingRight: 44,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15, color: '#212121',
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  inputIcon:      { position: 'absolute', left: 14, zIndex: 1 },
  inputRightIcon: { position: 'absolute', right: 14 },

  termsRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 10 },
  checkbox:       { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: RED, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxActive: { backgroundColor: RED },
  termsText:      { flex: 1, fontSize: 13, color: '#555', lineHeight: 20 },
  termsLink:      { color: RED, fontFamily: 'Inter_700Bold' },

  btnPrimary: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24, shadowRadius: 24, elevation: 5, marginBottom: 16,
  },
  btnDisabled:    { opacity: 0.65 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },

  loginRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  loginText: { fontSize: 14, color: '#9CA3AF' },
  loginLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: RED },

    sepRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sepLine:  { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  sepLabel: { marginHorizontal: 12, fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_500Medium' },
});