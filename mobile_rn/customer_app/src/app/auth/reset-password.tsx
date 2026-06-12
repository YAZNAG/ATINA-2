import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { resetPassword } from '../../services/customer_auth.service';

const RED = '#E62A27';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { phone_country, phone_number, code } = useLocalSearchParams<{
    phone_country: string;
    phone_number: string;
    code: string;
  }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
  });

  const phoneCountryStr = Array.isArray(phone_country) ? phone_country[0] : (phone_country?.trim() || '+212');
  const phoneNumberStr  = Array.isArray(phone_number)  ? phone_number[0]  : (phone_number || '');
  const codeStr         = Array.isArray(code)          ? code[0]          : (code || '');

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  if (!fontsLoaded) return null;

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await resetPassword(phoneNumberStr, codeStr, newPassword, phoneCountryStr);
      router.replace('/auth/login');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement');
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
            <Text style={styles.headerTitle}>Changer le mot de passe</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Nouveau mot de passe</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#C4C4C4"
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setError(''); }}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
                <Feather name={showNew ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#C4C4C4"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                <Feather name={showConfirm ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btnSubmit, loading && { opacity: 0.7 }]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnSubmitText}>Changer le mot de passe</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  label: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: '#7A7A7A', marginBottom: 8 },
  inputWrapper: { position: 'relative', marginBottom: 20, justifyContent: 'center' },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 50, paddingHorizontal: 20, paddingRight: 50, paddingVertical: Platform.OS === 'ios' ? 14 : 12, fontSize: 15, fontFamily: 'Poppins_400Regular', color: '#1a1a1a', backgroundColor: '#FAFAFA' },
  eyeBtn: { position: 'absolute', right: 16 },
  errorText: { color: RED, fontSize: 12, fontFamily: 'Poppins_400Regular', marginBottom: 12 },
  btnSubmit: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5, marginTop: 8 },
  btnSubmitText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
});