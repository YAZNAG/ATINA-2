import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

 import apiClient from '../../../api/client'; 
 import { usePickerAuth } from '../../../context/PickerAuthContext';

const COLORS = {
  primary: '#D90404',
  background: '#FFFFFF',
  text: '#111827',
  secondary: '#6B7280',
  border: '#F3F4F6',
  iconBg: '#FDE7E7',
  green: '#16A34A',
};

// -----------------------------------------------------------------------
// MOCK — à remplacer par le vrai picker connecté
// (ex: GET /pickers/me ou GET /pickers/:id via ton controller pickers.read)
// -----------------------------------------------------------------------
interface PickerProfile {
  id: string;
  agentCode: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  salesCount: number;
  status: 'ACTIVE' | 'INACTIVE';
}
/*
const MOCK_PICKER: PickerProfile = {
  id: 'pk_01',
  agentCode: '44021',
  fullName: 'Jean Dupont',
  email: 'j.dupont@elherri.com',
  phone: '+33 6 12 34 56 78',
  avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
  salesCount: 128,
  status: 'ACTIVE',
};*/

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, picker } = usePickerAuth();

  const profile: PickerProfile = picker
    ? {
        id: picker.id,
        agentCode: picker.node_id || picker.id,
        fullName: picker.name || 'Picker',
        email: '',
        phone: [picker.phone_country, picker.phone_number].filter(Boolean).join(' ').trim(),
        avatarUrl: '',
        salesCount: 0,
        status: picker.is_active ? 'ACTIVE' : 'INACTIVE',
      }
    : {
        id: '',
        agentCode: '',
        fullName: 'Picker',
        email: '',
        phone: '',
        avatarUrl: '',
        salesCount: 0,
        status: 'INACTIVE',
      };

  // -----------------------------------------------------------------------
  // Actions — versions mock. Décommente le bloc apiClient quand le backend
  // sera prêt, et supprime le Alert/console.log de simulation.
  // -----------------------------------------------------------------------

  const handleEditProfile = () => {
    router.push('/main/edit_profil' as any);
  };

  const handleChangePassword = async () => {
    if (!profile.id) {
      Alert.alert('Erreur', 'Profil non chargé.');
      return;
    }

    try {
      await apiClient.patch(`/pickers/${profile.id}/reset-password`);
      router.push('/main/change_password' as any);
    } catch (error) {
      console.error('Erreur reset password:', error);
      Alert.alert('Erreur', 'Impossible de lancer le changement de mot de passe.');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarBorder}>
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          </View>
          <TouchableOpacity style={styles.editAvatarBadge} onPress={handleEditProfile}>
            <Ionicons name="pencil" size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>Agent {profile.fullName.split(' ')[0]} El Herri</Text>
        <Text style={styles.agentId}>ID Agent: #{profile.agentCode}</Text>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>VENTES</Text>
            <Text style={styles.statValue}>{profile.salesCount}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>STATUT</Text>
            <Text style={[styles.statValue, styles.statusActive]}>
              {profile.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>

        {/* Infos personnelles */}
        <Text style={styles.sectionTitle}>INFORMATIONS PERSONNELLES</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={16} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Nom</Text>
              <Text style={styles.infoValue}>{profile.fullName}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="call-outline" size={16} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Téléphone</Text>
              <Text style={styles.infoValue}>{profile.phone}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleEditProfile}>
          <Ionicons name="create-outline" size={17} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Modifier profil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleChangePassword}>
          <Ionicons name="refresh-outline" size={17} color={COLORS.primary} />
          <Text style={styles.secondaryButtonText}>Changer mot de passe</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={COLORS.primary} />
          <Text style={styles.logoutText}>Déconnexion</Text>
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
    marginBottom: 14,
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
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  agentId: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 20,
  },
  statsCard: {
    flexDirection: 'row',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusActive: {
    color: COLORS.green,
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
    paddingVertical: 6,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
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
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoutText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
