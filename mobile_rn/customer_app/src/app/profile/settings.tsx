import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, StatusBar, Platform, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Dimensions, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as ImagePicker from 'expo-image-picker';
import { ProfileService, Profile, Address } from '../../services/profile.service';
import { CONFIG } from '../../constants/config';
import PageHeader from '../../components/ui/PageHeader';
import { t } from '../../i18n';

const RED = '#E10600';
const { height } = Dimensions.get('window');

export default function EditProfileScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [profile, setProfile] = useState<Profile | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // ── Champs édités ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [quartier, setQuartier] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // ⚠️ TODO backend — aucun champ de préférences notifications n'existe encore
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifPromos, setNotifPromos] = useState(true);
  const [notifNews, setNotifNews] = useState(false);

  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpStep, setOtpStep] = useState<'confirm' | 'code'>('confirm');
  const [otp, setOtp] = useState('');
  const [otpSaving, setOtpSaving] = useState(false);

  const load = async () => {
    try {
      const [p, addresses] = await Promise.all([
        ProfileService.getProfile(),
        ProfileService.listAddresses().catch(() => []),
      ]);
      setProfile(p);
      setName(p.name || '');
      setEmail(p.email || '');
      setPhoneNumber(p.phone_number || '');

      const def = addresses.find((a) => a.is_default) ?? addresses[0] ?? null;
      setDefaultAddress(def);
      setCity(def?.city || '');
      setQuartier(def?.quartier || '');
      setFullAddress([def?.street_number, def?.street_name].filter(Boolean).join(', '));
      setPostalCode(def?.postal_code || '');
    } catch (e: any) {
      Alert.alert(t('Erreur'), e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const avatarUrl = profile?.avatar_url ? CONFIG.STORAGE_URL + profile.avatar_url : null;

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('Permission refusée'), "Autorisez l'accès à la galerie dans les paramètres.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarLoading(true);
    try {
      const updated = await ProfileService.uploadAvatar(result.assets[0].uri);
      setProfile(updated);
    } catch (e: any) {
      Alert.alert(t('Erreur'), e.message);
    } finally {
      setAvatarLoading(false);
    }
  };

  const phoneChanged = () => {
    return phoneNumber.trim() !== (profile?.phone_number || '').trim();
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t('Erreur'), t('Le nom est requis')); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert(t('Erreur'), t('Email invalide')); return; }

    if (phoneChanged()) {
      setOtpStep('confirm');
      setOtpModalVisible(true);
      return;
    }

    await persistChanges();
  };

  const persistChanges = async () => {
    setSaving(true);
    try {
      if (name.trim() !== profile?.name) {
        await ProfileService.updateProfile({ name: name.trim() });
      }

      if (email.trim() !== profile?.email) {
        await ProfileService.updateEmail(email.trim());
      }

      const trimmed = fullAddress.trim();
      const m = trimmed.match(/^(\d+)\s*,?\s*(.+)$/);
      const street_number = m ? m[1] : null;
      const street_name   = m ? m[2] : trimmed;

      const addressPayload: Partial<Address> = {
        city: city.trim() || t('Rabat'),
        quartier: quartier.trim() || null,
        street_number,
        street_name: street_name || t('Non renseignée'),
        postal_code: postalCode.trim() || null,
        is_default: true,
      };

      if (defaultAddress) {
        await ProfileService.updateAddress(defaultAddress.id, addressPayload);
      } else if (trimmed) {
        await ProfileService.createAddress(addressPayload);
      }

      Alert.alert(t('Succès'), t('Profil mis à jour'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(t('Erreur'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpSaving(true);
    try {
      await ProfileService.requestPhoneChange(phoneNumber.trim(), profile?.phone_country || '+212');
      setOtpStep('code');
    } catch (e: any) {
      Alert.alert(t('Erreur'), e.message);
    } finally {
      setOtpSaving(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) { Alert.alert(t('Erreur'), t('Code à 4 chiffres')); return; }
    setOtpSaving(true);
    try {
      await ProfileService.confirmPhoneChange(phoneNumber.trim(), otp, profile?.phone_country || '+212');
      setOtpModalVisible(false);
      setOtp('');
      await persistChanges();
    } catch (e: any) {
      Alert.alert(t('Erreur'), e.message);
    } finally {
      setOtpSaving(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title={t('Modifier le profil')} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* ── Avatar ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} disabled={avatarLoading}>
              <View style={styles.avatarWrap}>
                {avatarLoading ? (
                  <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                    <ActivityIndicator size="small" color={RED} />
                  </View>
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                    <Feather name="user" size={32} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Feather name="camera" size={14} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
              <Text style={styles.editPhotoLink}>{t('Modifier la photo')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Informations personnelles ── */}
          <Text style={styles.sectionTitle}>{t('Informations personnelles')}</Text>
          <View style={styles.card}>
            <FieldRow icon="user" label={t('Nom complet')} value={name} onChangeText={setName} placeholder={t('Votre nom')} />
            <Divider />
            <FieldRow icon="mail" label={t('Adresse e-mail')} value={email} onChangeText={setEmail} placeholder={t('exemple@email.com')} keyboardType="email-address" autoCapitalize="none" />
            <Divider />

            {/* ── Téléphone : préfixe séparé du numéro local ── */}
            <View style={styles.fieldRow}>
              <View style={styles.rowIcon}>
                <Feather name="phone" size={18} color="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t('Numéro de téléphone')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.phonePrefix}>{profile?.phone_country || '+212'}</Text>
                  <TextInput
                    style={[styles.rowInput, { flex: 1 }]}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder={t('6 XX XX XX XX')}
                    placeholderTextColor="#C4C4C4"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Adresse de livraison ── */}
          <Text style={styles.sectionTitle}>{t('Adresse de livraison')}</Text>
          <View style={styles.card}>
            <FieldRow icon="briefcase" label={t('Ville')} value={city} onChangeText={setCity} placeholder={t('Casablanca')} />
            <Divider />
            <FieldRow icon="map-pin" label={t('Quartier')} value={quartier} onChangeText={setQuartier} placeholder={t('Maârif')} />
            <Divider />
            <FieldRow icon="home" label={t('Adresse complète')} value={fullAddress} onChangeText={setFullAddress} placeholder={t('Rue, numéro...')} />
            <Divider />
            <FieldRow icon="hash" label={t('Code postal')} value={postalCode} onChangeText={setPostalCode} placeholder="20330" keyboardType="number-pad" maxLength={5} />
          </View>

          {/* ── Préférences (⚠️ non persistées — pas de champ backend) ── */}
          <Text style={styles.sectionTitle}>{t('Préférences')}</Text>
          <View style={styles.card}>
            <ToggleRow icon="bell" label={t('Notifications des commandes')} value={notifOrders} onChange={setNotifOrders} />
            <Divider />
            <ToggleRow icon="tag" label={t('Recevoir les promotions')} value={notifPromos} onChange={setNotifPromos} />
            <Divider />
            <ToggleRow icon="star" label={t('Recevoir les nouveautés')} value={notifNews} onChange={setNotifNews} />
          </View>

          {/* ── Boutons ── */}
          <TouchableOpacity style={[styles.btnSave, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{t('Enregistrer les modifications')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.btnCancelText}>{t('Annuler')}</Text>
          </TouchableOpacity>

        </ScrollView>
      )}

      {/* ── Modal OTP téléphone ── */}
      <Modal visible={otpModalVisible} transparent animationType="slide" onRequestClose={() => setOtpModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Confirmer le nouveau numéro')}</Text>
              <TouchableOpacity onPress={() => setOtpModalVisible(false)}>
                <Feather name="x" size={22} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            {otpStep === 'confirm' ? (
              <>
                <Text style={styles.otpInfo}>
                  Vous avez modifié votre numéro de téléphone. Un code de vérification va être envoyé au {profile?.phone_country || '+212'} {phoneNumber}.
                </Text>
                <TouchableOpacity style={[styles.btnSave, otpSaving && { opacity: 0.7 }]} onPress={handleSendOtp} disabled={otpSaving} activeOpacity={0.85}>
                  {otpSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{t('Envoyer le code')}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabelModal}>{t('Code de vérification')}</Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="0000"
                  placeholderTextColor="#C4C4C4"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity style={[styles.btnSave, otpSaving && { opacity: 0.7 }]} onPress={handleVerifyOtp} disabled={otpSaving} activeOpacity={0.85}>
                  {otpSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{t('Vérifier et enregistrer')}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sous-composants ──

const FieldRow = ({
  icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength,
}: {
  icon: string; label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
}) => (
  <View style={styles.fieldRow}>
    <View style={styles.rowIcon}>
      <Feather name={icon as any} size={17} color={RED} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={styles.rowInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#C4C4C4"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  </View>
);

const ToggleRow = ({
  icon, label, value, onChange,
}: {
  icon: string; label: string; value: boolean; onChange: (v: boolean) => void;
}) => (
  <View style={styles.toggleRow}>
    <View style={styles.rowIcon}>
      <Feather name={icon as any} size={18} color={RED} />
    </View>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#E5E7EB', true: RED }}
      thumbColor="#fff"
    />
  </View>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16, backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
  },
  editPhotoLink: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: RED, marginTop: 12 },

  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 10, marginTop: 20, marginLeft: 2, letterSpacing: 0.3 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 16, borderWidth: 1, borderColor: '#F3F3F3',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  phonePrefix: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  rowIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: '#FDECEC',
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginBottom: 2 },
  rowInput: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a', padding: 0 },
  divider: { height: 1, backgroundColor: '#F5F5F5' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: '#1a1a1a' },

  btnSave: { backgroundColor: RED, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 24, shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  btnSaveText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnCancel: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#8A8A8A' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxHeight: height * 0.6 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1a1a1a', flex: 1 },
  otpInfo: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#6B7280', lineHeight: 20, marginBottom: 8 },
  fieldLabelModal: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280', marginBottom: 8 },
  otpInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14,
    fontSize: 22, letterSpacing: 8, fontFamily: 'Inter_700Bold', color: '#1a1a1a',
    backgroundColor: '#FAFAFA', textAlign: 'center',
  },
});