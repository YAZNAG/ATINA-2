import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { requestOtp } from '../../services/customer_auth.service';
import { openLegal } from '../../services/appInfo.service';
import { RED, INK, GREY, PrimaryButton } from '../../components/onboarding/onboardingKit';
import { t } from '../../i18n';

const { width } = Dimensions.get('window');

/** Numéro marocain : 9 chiffres commençant par 5, 6 ou 7 (le 0 initial est toléré). */
function normalizePhone(raw: string) {
  return raw.replace(/\D/g, '').replace(/^0/, '');
}

/** Maquette « page numéro de téléphone » : connexion sans mot de passe, par code SMS. */
export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const digits = normalizePhone(phone);
  const valid = /^[5-7]\d{8}$/.test(digits);

  const handleContinue = async () => {
    if (!valid) { setError(t('Saisissez un numéro marocain valide (ex. 6XX XXX XXX).')); return; }
    setLoading(true);
    setError('');
    try {
      await requestOtp(digits, '+212');
      router.push({ pathname: '/auth/verify-otp', params: { phone_number: digits, phone_country: '+212' } } as any);
    } catch (e: any) {
      setError(e?.message ?? t('Impossible d\'envoyer le code. Réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  const legal = async (kind: 'cgu' | 'privacy') => {
    if (!(await openLegal(kind))) setError(t('Document indisponible pour le moment.'));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          <SafeAreaView edges={['top']} style={styles.hero}>
            <Image source={require('../../../assets/images/atina/basket.png')} style={styles.heroImg} resizeMode="contain" />
          </SafeAreaView>

          <View style={styles.sheet}>
            <Text style={styles.title}>{t('Bienvenue')}</Text>
            <Text style={styles.subtitle}>{t('Connectez-vous avec votre numéro de téléphone.')}</Text>

            <View style={[styles.phoneBox, !!error && styles.phoneBoxError]}>
              <View style={styles.prefix}>
                <Image source={require('../../../assets/images/atina/flag_ma.png')} style={styles.flag} />
                <Text style={styles.prefixText}>+212</Text>
              </View>
              <View style={styles.sep} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(t) => { setPhone(t.replace(/[^\d ]/g, '')); setError(''); }}
                placeholder={t('6XX XXX XXX')}
                placeholderTextColor="#B0B0B0"
                keyboardType="phone-pad"
                maxLength={12}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                accessibilityLabel={t('Numéro de téléphone')}
              />
              <Feather name="smartphone" size={18} color="#8A8A8A" />
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.cta}>
              <PrimaryButton label={t('Continuer')} onPress={handleContinue} disabled={!valid} loading={loading} />
            </View>

            <Text style={styles.legal}>
              {t("En me connectant, j'accepte tous les")}{' '}
              <Text style={styles.link} onPress={() => legal('cgu')}>{t('Conditions générales')}</Text>
              {' '}{t('et')}{' '}
              <Text style={styles.link} onPress={() => legal('privacy')}>{t('Politique de confidentialité')}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  hero: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: 12, backgroundColor: '#fff' },
  heroImg: { width: width * 0.86, height: width * 0.5 },
  sheet: {
    flex: 1, backgroundColor: '#fff', marginTop: -6,
    borderTopLeftRadius: 34, borderTopRightRadius: 34,
    borderTopWidth: 3, borderColor: RED,
    paddingHorizontal: 22, paddingTop: 30, paddingBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 4,
  },
  title: { fontSize: 26, color: INK, fontFamily: 'Poppins_700Bold', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6B6B6B', fontFamily: 'Poppins_400Regular', marginBottom: 30 },

  phoneBox: {
    flexDirection: 'row', alignItems: 'center', height: 58, paddingHorizontal: 16,
    borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  phoneBoxError: { borderColor: RED },
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { width: 18, height: 12, borderRadius: 2 },
  prefixText: { fontSize: 15, color: INK, fontFamily: 'Poppins_600SemiBold' },
  sep: { width: 1, height: 24, backgroundColor: '#E5E5E5', marginHorizontal: 12 },
  input: { flex: 1, fontSize: 15, color: INK, fontFamily: 'Poppins_400Regular', paddingVertical: 0 },
  error: { color: RED, fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginTop: 8 },

  cta: { marginTop: 44 },
  legal: {
    marginTop: 40, fontSize: 12, lineHeight: 19, color: GREY,
    fontFamily: 'Poppins_400Regular', paddingHorizontal: 8,
  },
  link: { color: INK, textDecorationLine: 'underline', fontFamily: 'Poppins_500Medium' },
});
