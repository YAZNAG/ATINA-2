import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import { ProfileService } from '../../services/profile.service';

const RED = '#E62A27';

const LANGUAGES = [
  { code: 'fr', label: 'Français', native: 'FR' },
  { code: 'ar', label: 'العربية', native: 'AR' },
  { code: 'en', label: 'English', native: 'EN' },
];

export default function LangueScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState<string>('fr');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const profile = await ProfileService.getProfile();
        if (active) setCurrent(profile.preferred_lang ?? 'fr');
      } catch {
        // silencieux, on garde la valeur par défaut
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []));

  const handleSelect = async (code: string) => {
    if (saving || code === current) return;
    setSaving(code);
    try {
      await ProfileService.updateProfile({ preferred_lang: code });
      setCurrent(code);
      router.back();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Erreur lors de la mise à jour de la langue');
    } finally {
      setSaving(null);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title="Langue" />

      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Choisissez votre langue</Text>

        {loading ? (
          <ActivityIndicator color={RED} style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => {
              const isSelected = lang.code === current;
              return (
                <React.Fragment key={lang.code}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => handleSelect(lang.code)}
                    activeOpacity={0.7}
                    disabled={saving !== null}
                  >
                    <View style={styles.rowLeft}>
                      <View style={[styles.flagCircle, isSelected && styles.flagCircleActive]}>
                        <Text style={[styles.flagText, isSelected && styles.flagTextActive]}>
                          {lang.native}
                        </Text>
                      </View>
                      <Text style={styles.rowLabel}>{lang.label}</Text>
                    </View>

                    {saving === lang.code ? (
                      <ActivityIndicator size="small" color={RED} />
                    ) : isSelected ? (
                      <View style={styles.checkCircle}>
                        <Feather name="check" size={13} color="#fff" />
                      </View>
                    ) : (
                      <View style={styles.emptyCircle} />
                    )}
                  </TouchableOpacity>
                  {index < LANGUAGES.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  sectionLabel: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: '#9CA3AF',
    marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.4,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  flagCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  flagCircleActive: { backgroundColor: '#FFEAEA' },
  flagText:       { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#9CA3AF' },
  flagTextActive: { color: RED },

  rowLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },

  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  emptyCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },

  divider: { height: 1, backgroundColor: '#F0F0F0' },
});