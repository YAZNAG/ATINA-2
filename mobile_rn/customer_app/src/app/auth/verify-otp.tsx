import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator, Dimensions, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import * as SecureStore from 'expo-secure-store';
import { verifyOtp, requestOtp } from '../../services/customer_auth.service';

const { width } = Dimensions.get('window');
const RED = '#E62A27';
const OTP_LENGTH = 4;

export default function RegisterOtpScreen() {
  const router = useRouter();
  const { phone_number, phone_country, channel } = useLocalSearchParams<{
    phone_number:  string;
    phone_country: string;
    channel:       string;
  }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
  });

  const [otp, setOtp]             = useState(['', '', '', '']);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [timer, setTimer]         = useState(60);
  const inputs                    = useRef<TextInput[]>([]);

  const phoneStr   = Array.isArray(phone_number)  ? phone_number[0]  : (phone_number  || '');
  const countryStr = Array.isArray(phone_country) ? phone_country[0] : (phone_country || '+212');

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!fontsLoaded) return null;

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError('');
    if (text && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '') && text) handleVerify(newOtp.join(''));
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length < OTP_LENGTH) { setError('Entrez le code complet.'); return; }

    try {
      setLoading(true);
      setError('');
      await verifyOtp(phoneStr, otpCode, countryStr);
      await SecureStore.deleteItemAsync('pending_registration');
      router.replace('/auth/success');
    } catch (e: any) {
      setError(e.message ?? 'Code incorrect.');
      setOtp(['', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      setResending(true);
      setError('');
      await requestOtp(phoneStr, countryStr);
      setTimer(60);
      setOtp(['', '', '', '']);
      inputs.current[0]?.focus();
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du renvoi.');
    } finally {
      setResending(false);
    }
  };

  const isComplete = otp.every(d => d !== '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.container}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="chevron-left" size={22} color="#212121" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Vérification par téléphone</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* ── Icon ── */}
          <View style={styles.iconContainer}>
            <Image
              source={require('../../../assets/images/app/otp.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </View>

          {/* ── Info ── */}
          <Text style={styles.infoText}>
            Entrez le code de vérification (OTP){'\n'}envoyé à{' '}
            <Text style={styles.phoneText}>{countryStr}{phoneStr}</Text>
          </Text>

          {/* ── OTP inputs ── */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { if (ref) inputs.current[index] = ref; }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                value={digit}
                onChangeText={t => handleOtpChange(t.slice(-1), index)}
                onKeyPress={e => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={index === 0}
              />
            ))}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* ── Continuer ── */}
          <TouchableOpacity
            style={[styles.btnContinue, isComplete && styles.btnContinueActive]}
            onPress={() => handleVerify()}
            disabled={loading || !isComplete}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.btnContinueText, isComplete && styles.btnContinueTextActive]}>Continuer</Text>
            }
          </TouchableOpacity>

          {/* ── Renvoyer ── */}
          <TouchableOpacity onPress={handleResend} disabled={timer > 0 || resending} activeOpacity={0.7}>
            {resending
              ? <ActivityIndicator color={RED} size="small" />
              : <Text style={[styles.resendText, timer > 0 && styles.resendDisabled]}>
                  {timer > 0 ? `Renvoyer le code (${timer}s)` : 'Renvoyer le code'}
                </Text>
            }
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  flex:      { flex: 1 },
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 32 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#212121' },

  iconContainer: { width: 110, height: 110, marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  appIcon:       { width: 200, height: 180, borderRadius: 24 },

  infoText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  phoneText: { fontFamily: 'Poppins_700Bold', color: '#212121' },

  otpRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  otpInput: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 1.5, borderColor: '#E0E0E0',
    fontSize: 22, fontFamily: 'Poppins_700Bold',
    color: '#212121', backgroundColor: '#F5F5F5',
  },
  otpInputFilled: { borderColor: RED, backgroundColor: '#fff' },

  errorText: { color: RED, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginBottom: 16 },

  btnContinue: {
    width: width - 48, paddingVertical: 16, borderRadius: 50,
    backgroundColor: '#E5E7EB', alignItems: 'center', marginBottom: 20,
  },
  btnContinueActive:     { backgroundColor: RED },
  btnContinueText:       { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#9CA3AF' },
  btnContinueTextActive: { color: '#fff' },

  resendText:     { fontFamily: 'Poppins_600SemiBold', color: RED, fontSize: 14 },
  resendDisabled: { color: '#9CA3AF' },
});