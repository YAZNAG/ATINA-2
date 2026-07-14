import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_700Bold, Poppins_400Regular,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { usePickerAuth } from '../../context/PickerAuthContext';
import { pickerLogin } from '../../api/picker.api';

const RED = '#db1818';

export default function PickerLoginScreen() {
  const { login } = usePickerAuth();

  const [fontsLoaded] = useFonts({
    Poppins_700Bold, Poppins_400Regular,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  if (!fontsLoaded) return null;

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    try {
      const data = await pickerLogin({
        phone_country: '+212',
        phone_number:  phone.trim(),
        password:      password.trim(),
      });
      await login(data.token, data.picker);
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header rouge */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Feather name="package" size={32} color="#fff" />
          </View>
          <Text style={styles.appName}>Dark Store</Text>
          <Text style={styles.subtitle}>Espace agent préparateur</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Connexion</Text>

          <View style={styles.inputWrap}>
            <Feather name="phone" size={16} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Numéro de téléphone"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrap}>
            <Feather name="lock" size={16} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Mot de passe"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding: 4 }}>
              <Feather name={showPwd ? 'eye-off' : 'eye'} size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Se connecter</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: RED },
  container: { flex: 1 },

  header: {
    backgroundColor: RED,
    alignItems: 'center',
    paddingTop: 48, paddingBottom: 40,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  appName:  { fontSize: 24, fontFamily: 'Poppins_700Bold', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },

  form: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 32,
  },
  formTitle: {
    fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginBottom: 24,
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, height: 46,
    fontSize: 14, fontFamily: 'Inter_400Regular', color: '#1a1a1a',
  },

  btn: {
    backgroundColor: RED, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
