import React, { useState, useEffect } from 'react';
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
import { forgotPassword, resetPassword } from '../../services/customer_auth.service';

const RED = '#E62A27';

export default function ForgotOtpScreen() {
  const router = useRouter();
  const { phone_country, phone_number } = useLocalSearchParams<{
    phone_country: string;
    phone_number: string;
  }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
  });

  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [timer, setTimer]         = useState(60);

  const phoneCountryStr = Array.isArray(phone_country) ? phone_country[0] : (phone_country?.trim() || '+212');
  const phoneNumberStr  = Array.isArray(phone_number)  ? phone_number[0]  : (phone_number || '');

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  if (!fontsLoaded) return null;

  const handleVerify = async () => {
    if (!code || code.length < 4) {
      setError('Veuillez entrer le code complet');
      return;
    }
    // On passe le code à reset-password sans vérification intermédiaire
    // Le backend vérifie l'OTP dans resetPassword
    router.push({
      pathname: '/auth/reset-password' as any,
      params: { phone_country: phoneCountryStr, phone_number: phoneNumberStr, code },
    });
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      setResending(true);
      setError('');
      await forgotPassword(phoneNumberStr, phoneCountryStr);
      setTimer(60);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du renvoi');
    } finally {
      setResending(false);
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
            <Text style={styles.cardTitle}>Saisissez le code</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="0000"
                placeholderTextColor="#C4C4C4"
                value={code}
                onChangeText={(t) => { setCode(t); setError(''); }}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.btnRenvoyer, (timer > 0 || resending) && { opacity: 0.6 }]}
                onPress={handleResend}
                disabled={timer > 0 || resending}
                activeOpacity={0.85}
              >
                {resending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnRenvoyerText}>
                      {timer > 0 ? `${timer}s` : 'Renvoyer'}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.infoText}>
              Nous vous avons envoyé un code pour vérifier votre numéro de téléphone{' '}
              <Text style={styles.infoHighlight}>({phoneCountryStr})</Text>
            </Text>

            <Text style={styles.phoneDisplay}>{phoneCountryStr} {phoneNumberStr}</Text>

            <Text style={styles.expireText}>
              Ce code expirera 10 minutes après l'envoi du message. Si vous ne recevez rien, vous pouvez demander un{' '}
              <Text style={styles.newCodeLink} onPress={handleResend}>nouveau code.</Text>
            </Text>

            <TouchableOpacity
              style={[styles.btnSubmit, (loading || code.length < 4) && { opacity: 0.7 }]}
              onPress={handleVerify}
              disabled={loading || code.length < 4}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnSubmitText}>Continuer</Text>
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
  cardTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  codeInput: { flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 50, paddingHorizontal: 20, paddingVertical: Platform.OS === 'ios' ? 14 : 12, fontSize: 16, fontFamily: 'Poppins_500Medium', color: '#1a1a1a', backgroundColor: '#FAFAFA' },
  btnRenvoyer: { backgroundColor: RED, borderRadius: 50, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', minWidth: 100 },
  btnRenvoyerText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  errorText: { color: RED, fontSize: 12, fontFamily: 'Poppins_400Regular', marginBottom: 8 },
  infoText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: '#555', lineHeight: 20, marginBottom: 4 },
  infoHighlight: { color: RED, fontFamily: 'Poppins_600SemiBold' },
  phoneDisplay: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: RED, marginBottom: 12 },
  expireText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: '#9CA3AF', lineHeight: 18, marginBottom: 24 },
  newCodeLink: { color: RED, fontFamily: 'Poppins_700Bold' },
  btnSubmit: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
  btnSubmitText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
});