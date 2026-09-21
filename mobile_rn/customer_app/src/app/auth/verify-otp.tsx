import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  KeyboardAvoidingView, Platform, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { verifyOtp, requestOtp } from '../../services/customer_auth.service';
import { RED, RED_SOFT, INK, PrimaryButton } from '../../components/onboarding/onboardingKit';
import { t, isRTL } from '../../i18n';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 105; // 01:45 comme sur la maquette

function mmss(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Maquette « page vérification » : code SMS à 4 chiffres, minuteur, renvoi. */
export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone_number: string; phone_country: string }>();
  const phone = String(params.phone_number ?? '');
  const country = String(params.phone_country ?? '+212');

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const code = otp.join('');
  const complete = code.length === OTP_LENGTH;

  const verify = async (value = code) => {
    if (value.length < OTP_LENGTH) { setError(t('Entrez le code complet.')); return; }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp(phone, value, country);
      // Profil à compléter : premier accès ou nom encore générique.
      const needsProfile = res.user?.is_new || !res.customer?.name || res.customer.name === 'Client';
      router.replace((needsProfile ? '/auth/complete-profile' : '/main/main_nav/home') as any);
    } catch (e: any) {
      setError(e?.message ?? t('Code incorrect. Réessayez.'));
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const onChange = (text: string, i: number) => {
    const digits = text.replace(/\D/g, '');
    const next = [...otp];
    if (digits.length > 1) {
      // Collage ou remplissage automatique du code SMS.
      digits.slice(0, OTP_LENGTH).split('').forEach((d, k) => { if (i + k < OTP_LENGTH) next[i + k] = d; });
    } else {
      next[i] = digits;
    }
    setOtp(next);
    setError('');
    const firstEmpty = next.findIndex((d) => !d);
    if (digits && firstEmpty !== -1) inputs.current[firstEmpty]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  const onKey = (e: any, i: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const resend = async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await requestOtp(phone, country);
      setTimer(RESEND_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      setInfo(t('Un nouveau code vous a été envoyé.'));
      inputs.current[0]?.focus();
    } catch (e: any) {
      setError(e?.message ?? t('Erreur lors du renvoi.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <SafeAreaView edges={['top']} style={styles.redTop} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.card} contentContainerStyle={styles.cardContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel={t('Retour')}>
              <Feather name={isRTL() ? 'chevron-right' : 'chevron-left'} size={20} color={INK} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('Vérification du numéro')}</Text>
            <View style={{ width: 36 }} />
          </View>

          <Image source={require('../../../assets/images/app/otp.png')} style={styles.icon} resizeMode="contain" />

          <Text style={styles.help}>
            {t('Saisissez le code à {n} chiffres reçu par SMS au', { n: OTP_LENGTH })}{' '}
            <Text style={styles.phone}>{country} {phone}</Text>
          </Text>

          <View style={styles.boxes}>
            {otp.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputs.current[i] = r; }}
                style={[styles.box, !!d && styles.boxFilled, !!error && styles.boxError]}
                value={d}
                onChangeText={(t) => onChange(t, i)}
                onKeyPress={(e) => onKey(e, i)}
                keyboardType="number-pad"
                maxLength={i === 0 ? OTP_LENGTH : 1}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                autoFocus={i === 0}
                selectTextOnFocus
                accessibilityLabel={t('Chiffre {n}', { n: i + 1 })}
              />
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!error && !!info && <Text style={styles.info}>{info}</Text>}

          <View style={styles.timerPill}>
            <Text style={styles.timerText}>{mmss(Math.max(timer, 0))}</Text>
          </View>
          <TouchableOpacity onPress={resend} disabled={timer > 0 || resending} hitSlop={10}>
            <Text style={[styles.resend, timer <= 0 && styles.resendActive]}>
              {resending ? t('Envoi…') : t('Renvoyer le code')}
            </Text>
          </TouchableOpacity>

          <View style={styles.cta}>
            <PrimaryButton label={t('Confirmer')} onPress={() => verify()} disabled={!complete} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RED },
  redTop: { backgroundColor: RED, height: 44 },
  card: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 34, borderTopRightRadius: 34 },
  cardContent: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  back: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  headerTitle: { fontSize: 17, color: INK, fontFamily: 'Poppins_700Bold' },
  icon: { width: 110, height: 130, alignSelf: 'center', marginBottom: 20 },
  help: { fontSize: 14.5, lineHeight: 22, color: '#6B6B6B', fontFamily: 'Poppins_400Regular', marginBottom: 26 },
  phone: { color: INK, fontFamily: 'Poppins_600SemiBold' },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 14 },
  box: {
    width: 50, height: 50, borderRadius: 12, borderWidth: 1.2, borderColor: '#9A9A9A',
    textAlign: 'center', fontSize: 20, color: INK, fontFamily: 'Poppins_700Bold', padding: 0,
  },
  boxFilled: { borderColor: RED, backgroundColor: '#FFF7F7' },
  boxError: { borderColor: RED },
  error: { color: RED, fontSize: 12.5, textAlign: 'center', fontFamily: 'Poppins_500Medium', marginBottom: 8 },
  info: { color: '#15803D', fontSize: 12.5, textAlign: 'center', fontFamily: 'Poppins_500Medium', marginBottom: 8 },
  timerPill: {
    alignSelf: 'center', backgroundColor: RED_SOFT, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 14, marginBottom: 10,
  },
  timerText: { color: RED, fontSize: 13, fontFamily: 'Poppins_700Bold' },
  resend: { textAlign: 'center', color: '#8A8A8A', fontSize: 13.5, fontFamily: 'Poppins_500Medium' },
  resendActive: { color: RED, textDecorationLine: 'underline' },
  cta: { marginTop: 22 },
});
