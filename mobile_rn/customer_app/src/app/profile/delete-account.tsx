import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PageHeader from '../../components/ui/PageHeader';
import { ProfileService } from '../../services/profile.service';
import { logout } from '../../services/customer_auth.service';
import { setNodeId } from '../../store/nodePref';
import { RED, RED_SOFT, INK, GREY, PrimaryButton } from '../../components/onboarding/onboardingKit';
import { t } from '../../i18n';

/**
 * Suppression du compte (loi 09-08) : le client reçoit un code SMS puis confirme.
 * Le serveur refuse tant qu'une commande est en cours ou que le wallet n'est pas vide.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'intro' | 'code'>('intro');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    setLoading(true);
    setError('');
    try {
      await ProfileService.requestDeleteAccountOtp();
      setStep('code');
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setLoading(true);
    setError('');
    try {
      await ProfileService.deleteAccount(code);
      await logout();
      await setNodeId(null);
      router.replace('/auth/login' as any);
    } catch (e: any) {
      setError(e?.message ?? t('Suppression impossible.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title={t('Supprimer mon compte')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Feather name="trash-2" size={34} color={RED} />
        </View>
        <Text style={styles.title}>{t('Cette action est définitive')}</Text>
        <Text style={styles.body}>
          {t('Vos informations personnelles, adresses, favoris et panier seront effacés. Vos points de fidélité et coupons seront perdus. L\'historique de vos commandes est conservé de manière anonyme pour nos obligations légales.')}
        </Text>
        <View style={styles.note}>
          <Feather name="info" size={16} color="#6B6B6B" />
          <Text style={styles.noteText}>
            {t('La suppression est impossible tant qu\'une commande est en cours ou que votre wallet contient un solde.')}
          </Text>
        </View>

        {step === 'code' && (
          <>
            <Text style={styles.label}>{t('Code reçu par SMS')}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(t) => { setCode(t.replace(/\D/g, '')); setError(''); }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor="#B0B0B0"
              textContentType="oneTimeCode"
              autoFocus
            />
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        {step === 'intro'
          ? <PrimaryButton label={t('Recevoir un code de confirmation')} onPress={sendCode} loading={loading} />
          : <PrimaryButton label={t('Supprimer définitivement')} onPress={confirm} disabled={code.length < 4} loading={loading} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 22 },
  iconWrap: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: RED_SOFT,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 16,
  },
  title: { fontSize: 20, color: INK, fontFamily: 'Poppins_700Bold', textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 21, color: GREY, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  note: { flexDirection: 'row', gap: 8, backgroundColor: '#F6F6F6', borderRadius: 12, padding: 12, marginTop: 18 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#555', fontFamily: 'Poppins_400Regular' },
  label: { fontSize: 13, color: INK, fontFamily: 'Poppins_600SemiBold', marginTop: 24, marginBottom: 8 },
  input: {
    height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#E4E4E4', paddingHorizontal: 16,
    fontSize: 20, letterSpacing: 8, textAlign: 'center', color: INK, fontFamily: 'Poppins_700Bold',
  },
  error: { color: RED, fontSize: 13, fontFamily: 'Poppins_500Medium', marginTop: 12, textAlign: 'center' },
  footer: { paddingHorizontal: 22, paddingBottom: 12 },
});
