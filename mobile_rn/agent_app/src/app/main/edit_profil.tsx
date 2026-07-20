import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// import apiClient from '../../../api/client';
// import { usePickerAuth } from '../../../context/PickerAuthContext';

const COLORS = {
  primary: '#D90404',
  background: '#FFFFFF',
  text: '#111827',
  secondary: '#6B7280',
  border: '#F3F4F6',
  iconBg: '#FDE7E7',
};

// -----------------------------------------------------------------------
// MOCK — à remplacer par les vraies données du picker (via context ou un fetch `GET /pickers/:id`)
// -----------------------------------------------------------------------
interface PickerProfile {
  id: string;
  agentCode: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
}

const MOCK_PICKER: PickerProfile = {
  id: 'pk_01',
  agentCode: '44021',
  fullName: 'Jean Dupont',
  email: 'j.dupont@elherri.com',
  phone: '+33 6 12 34 56 78',
  avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
};

export default function EditProfileScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState(MOCK_PICKER.fullName);
  const [phone, setPhone] = useState(MOCK_PICKER.phone);
  const [avatarUri, setAvatarUri] = useState(MOCK_PICKER.avatarUrl);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    fullName.trim() !== MOCK_PICKER.fullName ||
    phone.trim() !== MOCK_PICKER.phone ||
    avatarUri !== MOCK_PICKER.avatarUrl;

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "L'accès à la galerie est nécessaire pour changer la photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Erreur', 'Le numéro de téléphone ne peut pas être vide.');
      return;
    }

    try {
      setSaving(true);

      // MOCK
      await new Promise((resolve) => setTimeout(resolve, 700));
      console.log('Mock: profil mis à jour ->', { fullName, phone, avatarUri });

      // RÉEL — utilise ta route PUT /pickers/:id
      // const formData = new FormData();
      // formData.append('fullName', fullName);
      // formData.append('phone', phone);
      // if (avatarUri !== MOCK_PICKER.avatarUrl) {
      //   formData.append('avatar', {
      //     uri: avatarUri,
      //     name: 'avatar.jpg',
      //     type: 'image/jpeg',
      //   } as any);
      // }
      // await apiClient.put(`/pickers/${MOCK_PICKER.id}`, formData, {
      //   headers: { 'Content-Type': 'multipart/form-data' },
      // });

      router.back();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarBorder}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </View>
          <TouchableOpacity style={styles.editAvatarBadge} onPress={pickImage}>
            <Ionicons name="camera" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={pickImage}>
          <Text style={styles.changePhotoText}>Changer la photo</Text>
        </TouchableOpacity>

        <Text style={styles.agentId}>ID Agent: #{MOCK_PICKER.agentCode}</Text>

        {/* Champs modifiables */}
        <Text style={styles.sectionTitle}>INFORMATIONS PERSONNELLES</Text>

        <View style={styles.infoCard}>
          <View style={styles.fieldRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={16} color={COLORS.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.infoLabel}>Nom</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nom complet"
                placeholderTextColor={COLORS.secondary}
              />
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.fieldRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="call-outline" size={16} color={COLORS.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={COLORS.secondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.infoDivider} />

          {/* Email just visible */}
          <View style={styles.fieldRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="mail-outline" size={16} color={COLORS.secondary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.readOnlyValue}>{MOCK_PICKER.email}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.primaryButton, (!hasChanges || saving) && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Enregistrer</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ededed',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
  },
  avatarWrap: {
    marginBottom: 10,
  },
  avatarBorder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 10,
  },
  agentId: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 22,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  fieldContent: {
    flex: 1,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  input: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    paddingVertical: 2,
  },
  readOnlyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  primaryButton: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
