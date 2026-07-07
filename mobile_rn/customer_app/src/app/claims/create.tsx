// app/claims/create.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, TextInput,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import ClaimsService, { ClaimTypeOption, ClaimType } from '../../services/claims.service';
import { ProfileService, OrderSummary } from '../../services/profile.service';

const RED = '#E10600';

export default function CreateClaimScreen() {
  const router = useRouter();
  const { order_id: presetOrderId } = useLocalSearchParams<{ order_id?: string }>();

  const [types, setTypes] = useState<ClaimTypeOption[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(presetOrderId ?? null);
  const [selectedType, setSelectedType] = useState<ClaimType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [typesRes, ordersRes] = await Promise.all([
          ClaimsService.getTypes(),
          ProfileService.listOrders().catch(() => []),
        ]);
        setTypes(typesRes);
        setOrders(ordersRes);
      } catch {
        setTypes([]);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async () => {
    if (!selectedOrderId) return Alert.alert('Commande requise', 'Sélectionnez la commande concernée.');
    if (!selectedType) return Alert.alert('Type requis', 'Sélectionnez le type de réclamation.');
    if (!description.trim()) return Alert.alert('Description requise', 'Décrivez le problème rencontré.');

    setSubmitting(true);
    try {
      await ClaimsService.createClaim({
        order_id: selectedOrderId,
        type: selectedType,
        description: description.trim(),
      });
      Alert.alert('Réclamation envoyée', 'Nous la traiterons dans les plus brefs délais.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Impossible d'envoyer la réclamation");
    } finally {
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <PageHeader title="Nouvelle réclamation" />

        {loadingData ? (
          <ActivityIndicator color={RED} style={{ marginTop: 48 }} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Commande */}
            <Text style={styles.label}>Commande concernée</Text>
            {orders.length === 0 ? (
              <Text style={styles.noOrders}>Aucune commande disponible</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {orders.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.chip, selectedOrderId === o.id && styles.chipActive]}
                    onPress={() => setSelectedOrderId(o.id)}
                  >
                    <Text style={[styles.chipText, selectedOrderId === o.id && styles.chipTextActive]}>
                      #{o.reference}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Type */}
            <Text style={styles.label}>Type de problème</Text>
            <View style={styles.typeList}>
              {types.map((t) => (
                <TouchableOpacity
                  key={t.code}
                  style={[styles.typeCard, selectedType === t.code && styles.typeCardActive]}
                  onPress={() => setSelectedType(t.code)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.radio, selectedType === t.code && styles.radioActive]}>
                    {selectedType === t.code && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.typeCardText, selectedType === t.code && styles.typeCardTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Décrivez le problème rencontré..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              maxLength={1000}
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Envoyer la réclamation</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#374151', marginTop: 20, marginBottom: 10 },
  noOrders: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipActive: { borderColor: RED, backgroundColor: '#FFF1F1' },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  chipTextActive: { color: RED, fontFamily: 'Inter_600SemiBold' },

  typeList: { gap: 10 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14,
  },
  typeCardActive: { borderColor: RED, backgroundColor: '#FFF1F1' },
  typeCardText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#374151' },
  typeCardTextActive: { color: RED, fontFamily: 'Inter_600SemiBold' },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: RED },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },

  textArea: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#1a1a1a',
    textAlignVertical: 'top', minHeight: 120,
  },

  submitBtn: {
    marginTop: 24, backgroundColor: RED, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});