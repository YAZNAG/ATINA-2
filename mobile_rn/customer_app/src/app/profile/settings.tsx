import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, StatusBar, Platform, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as ImagePicker from 'expo-image-picker';
import { ProfileService, Profile } from '../../services/profile.service';
import { CONFIG } from '../../constants/config';
import PageHeader from '../../components/ui/PageHeader';

const RED = '#E10600';
const { height } = Dimensions.get('window');

type EditField = 'name' | 'email' | 'phone' | 'password' | null;

export default function SettingsScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editField, setEditField] = useState<EditField>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [langSaving, setLangSaving] = useState(false);

  const loadProfile = async () => {
    try {
      const p = await ProfileService.getProfile();
      setProfile(p);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const avatarUrl = profile?.avatar_url ? CONFIG.STORAGE_URL + profile.avatar_url : null;

  const handleLangChange = async (lang: 'fr' | 'ar') => {
    if (langSaving || profile?.preferred_lang === lang) return;
    setLangSaving(true);
    try {
      await ProfileService.updateProfile({ preferred_lang: lang });
      setProfile(prev => prev ? { ...prev, preferred_lang: lang } : prev);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLangSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les paramètres.");
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
      Alert.alert('Erreur', e.message);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = () => {
    Alert.alert(
      'Retirer la photo',
      'Êtes-vous sûr de vouloir supprimer votre photo de profil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            setAvatarLoading(true);
            try {
              const updated = await ProfileService.deleteAvatar();
              setProfile(updated);
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
            } finally {
              setAvatarLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <PageHeader title="Paramètres" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* ── Section Photo ── */}
          <Text style={styles.sectionTitle}>Photo de profil</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.photoRow} onPress={handlePickAvatar} activeOpacity={0.7} disabled={avatarLoading}>
              <View style={styles.photoPreview}>
                {avatarLoading ? (
                  <View style={[styles.photoThumb, styles.photoPlaceholder]}>
                    <ActivityIndicator size="small" color={RED} />
                  </View>
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.photoThumb} />
                ) : (
                  <View style={[styles.photoThumb, styles.photoPlaceholder]}>
                    <Feather name="camera" size={20} color="#9CA3AF" />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Photo de profil</Text>
                <Text style={styles.rowValue}>{avatarUrl ? 'Modifier la photo' : 'Ajouter une photo'}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#C0C0C0" />
            </TouchableOpacity>
            {avatarUrl && (
              <>
                <Divider />
                <TouchableOpacity style={styles.row} onPress={handleRemoveAvatar} activeOpacity={0.7}>
                  <View style={[styles.rowIcon, { backgroundColor: '#FFF5F5' }]}>
                    <Feather name="trash-2" size={18} color="#E10600" />
                  </View>
                  <Text style={[styles.rowValue, { color: '#E10600' }]}>Retirer la photo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Section Informations ── */}
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <View style={styles.card}>
            <Row icon="user"  label="Nom"       value={profile?.name || '—'}         onPress={() => setEditField('name')} />
            <Divider />
            <Row icon="mail"  label="Email"      value={profile?.email || '—'}        onPress={() => setEditField('email')} />
            <Divider />
            <Row icon="phone" label="Téléphone"  value={`${profile?.phone_country || ''} ${profile?.phone_number || ''}`.trim() || '—'}
                 verified={profile?.phone_verified} onPress={() => setEditField('phone')} />
          </View>

          {/* ── Section Sécurité ── */}
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.card}>
            <Row icon="lock" label="Mot de passe" value="••••••••" onPress={() => setEditField('password')} />
          </View>

          {/* ── Section Préférences ── */}
          <Text style={styles.sectionTitle}>Préférences</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Feather name="globe" size={18} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Langue</Text>
                <View style={styles.langPills}>
                  {([
                    { code: 'fr', label: 'Français', flag: '' },
                    { code: 'ar', label: 'العربية',  flag: '' },
                  ] as const).map(opt => {
                    const active = (profile?.preferred_lang ?? 'fr') === opt.code;
                    return (
                      <TouchableOpacity
                        key={opt.code}
                        style={[styles.langPill, active && styles.langPillActive]}
                        onPress={() => handleLangChange(opt.code)}
                        activeOpacity={0.75}
                        disabled={langSaving}
                      >
                        <Text style={styles.langFlag}>{opt.flag}</Text>
                        <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                          {opt.label}
                        </Text>
                        {active && <Feather name="check" size={13} color={RED} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

        </ScrollView>
      )}

      {/* ── Modals ── */}
      <EditNameModal
        visible={editField === 'name'}
        currentName={profile?.name || ''}
        onClose={() => setEditField(null)}
        onSaved={() => { setEditField(null); loadProfile(); }}
      />
      <EditEmailModal
        visible={editField === 'email'}
        currentEmail={profile?.email || ''}
        onClose={() => setEditField(null)}
        onSaved={() => { setEditField(null); loadProfile(); }}
      />
      <EditPhoneModal
        visible={editField === 'phone'}
        currentCountry={profile?.phone_country || '+212'}
        onClose={() => setEditField(null)}
        onSaved={() => { setEditField(null); loadProfile(); }}
      />
      <ChangePasswordModal
        visible={editField === 'password'}
        onClose={() => setEditField(null)}
        onSaved={() => setEditField(null)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Row
// ─────────────────────────────────────────────────────────────────────────────
const Row = ({ icon, label, value, verified, onPress }: {
  icon: string; label: string; value: string; verified?: boolean; onPress: () => void;
}) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.rowIcon}><Feather name={icon as any} size={18} color={RED} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
        {verified && <Feather name="check-circle" size={13} color="#22C55E" />}
      </View>
    </View>
    <Feather name="chevron-right" size={18} color="#C0C0C0" />
  </TouchableOpacity>
);

const Divider = () => <View style={styles.divider} />;

// ─────────────────────────────────────────────────────────────────────────────
//  Modal — Nom
// ─────────────────────────────────────────────────────────────────────────────
const EditNameModal = ({ visible, currentName, onClose, onSaved }: {
  visible: boolean; currentName: string; onClose: () => void; onSaved: () => void;
}) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setName(currentName); }, [visible]);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Erreur', 'Le nom est requis'); return; }
    setSaving(true);
    try {
      await ProfileService.updateProfile({ name: name.trim() });
      onSaved();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setSaving(false); }
  };

  return (
    <BaseModal visible={visible} title="Modifier le nom" onClose={onClose}>
      <Text style={styles.fieldLabel}>Nom complet</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Votre nom" placeholderTextColor="#C4C4C4" />
      <SaveButton saving={saving} onPress={save} label="Enregistrer" />
    </BaseModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Modal — Email
// ─────────────────────────────────────────────────────────────────────────────
const EditEmailModal = ({ visible, currentEmail, onClose, onSaved }: {
  visible: boolean; currentEmail: string; onClose: () => void; onSaved: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setEmail(currentEmail); }, [visible]);

  const save = async () => {
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email invalide'); return; }
    setSaving(true);
    try {
      await ProfileService.updateEmail(email.trim());
      Alert.alert('Succès', 'Email mis à jour');
      onSaved();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setSaving(false); }
  };

  return (
    <BaseModal visible={visible} title="Modifier l'email" onClose={onClose}>
      <Text style={styles.fieldLabel}>Adresse email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="exemple@email.com"
        placeholderTextColor="#C4C4C4" keyboardType="email-address" autoCapitalize="none" />
      <SaveButton saving={saving} onPress={save} label="Enregistrer" />
    </BaseModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Modal — Téléphone + OTP
// ─────────────────────────────────────────────────────────────────────────────
const EditPhoneModal = ({ visible, currentCountry, onClose, onSaved }: {
  visible: boolean; currentCountry: string; onClose: () => void; onSaved: () => void;
}) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp]     = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setStep('phone'); setPhone(''); setOtp(''); } }, [visible]);

  const sendOtp = async () => {
    if (!phone.trim()) { Alert.alert('Erreur', 'Entrez un numéro'); return; }
    setSaving(true);
    try {
      await ProfileService.requestPhoneChange(phone.trim(), currentCountry);
      setStep('otp');
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    if (otp.length < 4) { Alert.alert('Erreur', 'Code à 4 chiffres'); return; }
    setSaving(true);
    try {
      await ProfileService.confirmPhoneChange(phone.trim(), otp, currentCountry);
      Alert.alert('Succès', 'Téléphone vérifié et mis à jour');
      onSaved();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setSaving(false); }
  };

  return (
    <BaseModal visible={visible} title="Modifier le téléphone" onClose={onClose}>
      {step === 'phone' ? (
        <>
          <Text style={styles.fieldLabel}>Nouveau numéro</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryPill}><Text style={styles.countryCode}>{currentCountry}</Text></View>
            <TextInput style={styles.phoneInput} value={phone} onChangeText={setPhone}
              placeholder="6 12 34 56 78" placeholderTextColor="#C4C4C4" keyboardType="phone-pad" />
          </View>
          <SaveButton saving={saving} onPress={sendOtp} label="Envoyer le code" />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Code de vérification (envoyé par SMS)</Text>
          <TextInput style={[styles.input, styles.otpInput]} value={otp} onChangeText={setOtp}
            placeholder="0000" placeholderTextColor="#C4C4C4" keyboardType="number-pad" maxLength={6} />
          <SaveButton saving={saving} onPress={verify} label="Vérifier et enregistrer" />
          <TouchableOpacity onPress={() => setStep('phone')} style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={styles.linkText}>Modifier le numéro</Text>
          </TouchableOpacity>
        </>
      )}
    </BaseModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Modal — Mot de passe
// ─────────────────────────────────────────────────────────────────────────────
const ChangePasswordModal = ({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
}) => {
  const [oldPwd, setOldPwd]   = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving]   = useState(false);
  const [show, setShow]       = useState(false);

  useEffect(() => { if (visible) { setOldPwd(''); setNewPwd(''); setConfirm(''); } }, [visible]);

  const save = async () => {
    if (!oldPwd || !newPwd)   { Alert.alert('Erreur', 'Remplissez tous les champs'); return; }
    if (newPwd.length < 6)    { Alert.alert('Erreur', 'Min. 6 caractères'); return; }
    if (newPwd !== confirm)   { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas'); return; }
    setSaving(true);
    try {
      await ProfileService.changePassword(oldPwd, newPwd);
      Alert.alert('Succès', 'Mot de passe modifié');
      onSaved();
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setSaving(false); }
  };

  return (
    <BaseModal visible={visible} title="Changer le mot de passe" onClose={onClose}>
      <Text style={styles.fieldLabel}>Mot de passe actuel</Text>
      <TextInput style={styles.input} value={oldPwd} onChangeText={setOldPwd}
        secureTextEntry={!show} placeholder="••••••••" placeholderTextColor="#C4C4C4" />
      <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
      <TextInput style={styles.input} value={newPwd} onChangeText={setNewPwd}
        secureTextEntry={!show} placeholder="••••••••" placeholderTextColor="#C4C4C4" />
      <Text style={styles.fieldLabel}>Confirmer le nouveau</Text>
      <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
        secureTextEntry={!show} placeholder="••••••••" placeholderTextColor="#C4C4C4" />
      <TouchableOpacity onPress={() => setShow(!show)} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Feather name={show ? 'eye-off' : 'eye'} size={16} color="#9CA3AF" />
        <Text style={styles.linkText}>{show ? 'Masquer' : 'Afficher'} les mots de passe</Text>
      </TouchableOpacity>
      <SaveButton saving={saving} onPress={save} label="Modifier" />
    </BaseModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Base Modal + Save Button
// ─────────────────────────────────────────────────────────────────────────────
const BaseModal = ({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#1a1a1a" /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

const SaveButton = ({ saving, onPress, label }: { saving: boolean; onPress: () => void; label: string }) => (
  <TouchableOpacity style={[styles.btnSave, saving && { opacity: 0.7 }]} onPress={onPress} disabled={saving} activeOpacity={0.85}>
    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>{label}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9CA3AF', marginBottom: 10, marginTop: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e1dfdf' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  rowValue: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  divider: { height: 1, backgroundColor: '#F5F5F5' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: height * 0.8 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },

  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#1a1a1a', backgroundColor: '#FAFAFA' },
  otpInput: { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontFamily: 'Inter_700Bold' },

  phoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  countryPill: { paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 12, borderRightWidth: 1, borderRightColor: '#E0E0E0' },
  countryCode: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#1a1a1a' },

  linkText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: RED },

  btnSave: { backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnSaveText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  photoPreview: { width: 38, height: 38 },
  photoThumb: { width: 38, height: 38, borderRadius: 19 },
  photoPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  langPills:      { flexDirection: 'row', gap: 8, marginTop: 8 },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  langPillActive:  { borderColor: RED, backgroundColor: '#FFF0F0' },
  langFlag:        { fontSize: 16 },
  langLabel:       { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  langLabelActive: { color: RED, fontFamily: 'Inter_600SemiBold' },
});