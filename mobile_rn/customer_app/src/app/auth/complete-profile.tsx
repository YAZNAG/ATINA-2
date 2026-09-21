import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ProfileService } from '../../services/profile.service';
import { CatalogService, City, DistributionNode } from '../../services/catalog.service';
import { setNodeId } from '../../store/nodePref';
import SelectSheet from '../../components/ui/SelectSheet';
import { RED, RED_SOFT, INK, getSavedLang, Lang } from '../../components/onboarding/onboardingKit';

/** Maquette « page les informations de client » : nom, ville, point de distribution, parrainage (US-104). */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('fr');
  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DistributionNode[]>([]);
  const [nodeId, setNode] = useState<string | null>(null);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [referral, setReferral] = useState('');
  const [picker, setPicker] = useState<'city' | 'node' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const label = (o: { name_fr: string; name_ar?: string | null }) => (lang === 'ar' && o.name_ar ? o.name_ar : o.name_fr);

  useEffect(() => {
    getSavedLang().then(setLang);
    CatalogService.getCities().then(setCities).catch(() => setCities([]));
  }, []);

  useEffect(() => {
    setNode(null);
    setNodes([]);
    if (!cityId) return;
    setLoadingNodes(true);
    CatalogService.getNodes(cityId)
      .then((list) => {
        setNodes(list);
        if (list.length === 1) setNode(list[0].id);
      })
      .catch(() => setNodes([]))
      .finally(() => setLoadingNodes(false));
  }, [cityId]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("L'accès à vos photos est nécessaire pour ajouter une photo."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] });
    if (!res.canceled) setAvatarUri(res.assets[0].uri);
  };

  const canSubmit = name.trim().length >= 2 && !!cityId && !!nodeId;

  const submit = async () => {
    if (!canSubmit) {
      setError(!name.trim() ? 'Saisissez votre nom complet.' : !cityId ? 'Choisissez votre ville.' : 'Choisissez un point de distribution.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await ProfileService.updateProfile({
        name: name.trim(),
        city_id: cityId!,
        preferred_lang: lang,
        ...(referral.trim() ? { referral_code: referral.trim().toUpperCase() } : {}),
      });
      await setNodeId(nodeId);
      if (avatarUri) {
        try { await ProfileService.uploadAvatar(avatarUri); } catch { /* la photo peut être ajoutée plus tard */ }
      }
      router.replace('/main/main_nav/home');
    } catch (e: any) {
      setError(e?.message ?? 'Enregistrement impossible. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const city = cities.find((c) => c.id === cityId);
  const node = nodes.find((n) => n.id === nodeId);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={RED} />
      <SafeAreaView edges={['top']} style={styles.redTop} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.card} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} accessibilityLabel="Ajouter une photo">
            <View style={styles.avatar}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : <Feather name="user" size={42} color={RED} />}
            </View>
            <View style={styles.plus}><Feather name="plus" size={14} color="#fff" /></View>
          </TouchableOpacity>

          <Text style={styles.title}>Complétez votre profil</Text>

          <Text style={styles.label}>Nom complet</Text>
          <View style={styles.field}>
            <Feather name="user" size={16} color="#6B6B6B" />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => { setName(t); setError(''); }}
              placeholder="Ex: Mohammed Alami"
              placeholderTextColor="#A0A0A0"
              autoCapitalize="words"
              maxLength={80}
            />
          </View>

          <Text style={styles.label}>Choisir une ville</Text>
          <TouchableOpacity style={styles.field} onPress={() => setPicker('city')}>
            <Feather name="map-pin" size={16} color="#6B6B6B" />
            <Text style={[styles.select, !city && styles.placeholder]} numberOfLines={1}>
              {city ? label(city) : 'Sélectionnez votre ville'}
            </Text>
            <Feather name="chevron-down" size={18} color="#6B6B6B" />
          </TouchableOpacity>

          <Text style={styles.label}>Point de distribution le plus proche</Text>
          <TouchableOpacity
            style={[styles.field, !cityId && styles.fieldDisabled]}
            onPress={() => cityId && setPicker('node')}
            disabled={!cityId}
          >
            <Feather name="home" size={16} color="#6B6B6B" />
            <Text style={[styles.select, !node && styles.placeholder]} numberOfLines={1}>
              {node ? label(node) : cityId ? 'Sélectionnez un point de distribution' : "Sélectionnez d'abord une ville"}
            </Text>
            {loadingNodes ? <ActivityIndicator size="small" color={RED} /> : <Feather name="chevron-down" size={18} color="#6B6B6B" />}
          </TouchableOpacity>

          {showReferral ? (
            <>
              <Text style={styles.label}>Code de parrainage (facultatif)</Text>
              <View style={styles.field}>
                <Feather name="gift" size={16} color="#6B6B6B" />
                <TextInput
                  style={styles.input}
                  value={referral}
                  onChangeText={(t) => setReferral(t.replace(/\s/g, '').toUpperCase())}
                  placeholder="Ex: ATN12345"
                  placeholderTextColor="#A0A0A0"
                  autoCapitalize="characters"
                  maxLength={20}
                  autoFocus
                />
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setShowReferral(true)} hitSlop={8}>
              <Text style={styles.referralLink}>Code de Parrainage (facultatif)</Text>
            </TouchableOpacity>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, (!canSubmit || saving) && styles.buttonDisabled]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={styles.buttonText}>Continuer</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={picker === 'city'}
        title="Choisir une ville"
        options={cities.map((c) => ({ value: c.id, label: label(c) }))}
        selected={cityId}
        onSelect={(v) => { setCityId(v); setError(''); }}
        onClose={() => setPicker(null)}
      />
      <SelectSheet
        visible={picker === 'node'}
        title="Point de distribution le plus proche"
        options={nodes.map((n) => ({ value: n.id, label: label(n), hint: n.address_line1 }))}
        selected={nodeId}
        onSelect={(v) => { setNode(v); setError(''); }}
        onClose={() => setPicker(null)}
        emptyText="Aucun point de distribution dans cette ville pour le moment."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RED },
  redTop: { backgroundColor: RED, height: 44 },
  card: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 34, borderTopRightRadius: 34 },
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 36 },
  avatarWrap: { alignSelf: 'center', marginBottom: 22 },
  avatar: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: RED_SOFT,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 96, height: 96 },
  plus: {
    position: 'absolute', right: -2, bottom: 4, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  title: { fontSize: 22, color: INK, fontFamily: 'Poppins_700Bold', marginBottom: 22 },
  label: { fontSize: 13, color: INK, fontFamily: 'Poppins_600SemiBold', marginBottom: 8, marginTop: 4 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#E4E4E4', backgroundColor: '#fff', marginBottom: 14,
  },
  fieldDisabled: { backgroundColor: '#FAFAFA' },
  input: { flex: 1, fontSize: 14, color: INK, fontFamily: 'Poppins_400Regular', paddingVertical: 0 },
  select: { flex: 1, fontSize: 14, color: INK, fontFamily: 'Poppins_400Regular' },
  placeholder: { color: '#A0A0A0' },
  referralLink: {
    color: RED, fontSize: 13, fontFamily: 'Poppins_600SemiBold', textDecorationLine: 'underline', marginBottom: 8,
  },
  error: { color: RED, fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginTop: 6 },
  button: {
    marginTop: 40, backgroundColor: RED, borderRadius: 14, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: RED, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
});
