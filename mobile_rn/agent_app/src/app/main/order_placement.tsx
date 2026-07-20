import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaProvider , SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// import apiClient from '@/services/apiClient'; // décommente quand le back sera prêt

// ----------------------------------------------------------------------------------
// MOCK DATA — à remplacer par un appel API (ex: GET /warehouse/zones, GET /warehouse/zones/:id/etageres)
// ----------------------------------------------------------------------------------
type Zone = { id: string; label: string };
type Etagere = { id: string; label: string; zoneId: string };
const COLORS = {
  primary: "#D90404",
  background: "#F8F8F8",
  card: "#FFFFFF",
  border: "#ECECEC",
  text: "#111827",
  secondaryText: "#6B7280",
};

const MOCK_ZONES: Zone[] = [
  { id: 'A', label: 'Zone A' },
  { id: 'B', label: 'Zone B' },
  { id: 'C', label: 'Zone C' },
];

const MOCK_ETAGERES: Etagere[] = [
  { id: '1', label: 'Étagère 1', zoneId: 'A' },
  { id: '2', label: 'Étagère 2', zoneId: 'A' },
  { id: '3', label: 'Étagère 3', zoneId: 'A' },
  { id: '1', label: 'Étagère 1', zoneId: 'B' },
  { id: '2', label: 'Étagère 2', zoneId: 'B' },
  { id: '1', label: 'Étagère 1', zoneId: 'C' },
  { id: '2', label: 'Étagère 2', zoneId: 'C' },
];


type OptionItem = { id: string; label: string };

interface SelectFieldProps {
  label: string;
  placeholder: string;
  value: OptionItem | null;
  options: OptionItem[];
  onSelect: (item: OptionItem) => void;
  disabled?: boolean;
}

function SelectField({ label, placeholder, value, options, onSelect, disabled }: SelectFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selectBox, disabled && styles.selectBoxDisabled]}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={value ? styles.selectValueText : styles.selectPlaceholderText}>
          {value ? value.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {value?.id === item.id && <Ionicons name="checkmark" size={18} color="#DC2626" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function OrderPlacementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [zone, setZone] = useState<OptionItem | null>(null);
  const [etagere, setEtagere] = useState<OptionItem | null>(null);
  const [numeroEmplacement, setNumeroEmplacement] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const etageresDeLaZone = useMemo(
    () => MOCK_ETAGERES.filter((e) => e.zoneId === zone?.id),
    [zone]
  );

  const isComplete = zone !== null && etagere !== null && numeroEmplacement.trim().length > 0;

  const handleZoneSelect = (item: OptionItem) => {
    setZone(item);
    setEtagere(null); // reset étagère si on change de zone
  };

  const confirmPlacement = async () => {
    if (!isComplete) return;
    try {
      setSubmitting(true);
      // MOCK — remplace par vrai appel API
      // await apiClient.patch(`/orders/${id}/emplacement`, {
      //   zone: zone!.id,
      //   etagere: etagere!.id,
      //   numeroEmplacement,
      // });
      console.log('Emplacement confirmé (mock):', { id, zone, etagere, numeroEmplacement });

      router.push({
        pathname: '/main/qr_ready',
        params: { id },
      } as any);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'emplacement:", error);
      Alert.alert('Erreur', "Impossible d'enregistrer l'emplacement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <SafeAreaProvider >
      <SafeAreaView style={styles.container} edges={["top"]}>
         {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleGoBack}
                  style={styles.backButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={26} color={COLORS.text} />
                </TouchableOpacity>
        
                <Text style={styles.headerTitle}>Emplacement  </Text>
        
                <View style={styles.headerSpacer} />
              </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.pinIconWrap}>
            <Ionicons name="location" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.cardTitle}>Emplacement commande</Text>
        </View>

        <SelectField
          label="Zone"
          placeholder="Sélectionner une zone"
          value={zone}
          options={MOCK_ZONES}
          onSelect={handleZoneSelect}
        />

        <SelectField
          label="Étagère / Position"
          placeholder="Sélectionner une étagère"
          value={etagere}
          options={etageresDeLaZone}
          onSelect={setEtagere}
          disabled={!zone}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Numéro emplacement</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: A3-001"
            placeholderTextColor="#9CA3AF"
            value={numeroEmplacement}
            onChangeText={setNumeroEmplacement}
            autoCapitalize="characters"
          />
        </View>

        {isComplete && (
          <View style={styles.confirmBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#DC2626" />
            <Text style={styles.confirmBannerText}>
              Emplacement: {zone?.label} – {etagere?.label}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom action */}
      <TouchableOpacity
        style={[styles.confirmButton, (!isComplete || submitting) && styles.confirmButtonDisabled]}
        onPress={confirmPlacement}
        disabled={!isComplete || submitting}
        activeOpacity={0.85}
      >
        <Ionicons name="cube" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.confirmButtonText}>
          {submitting ? 'Enregistrement...' : 'Commande prête'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ----------------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
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
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  card: {
    marginTop: 20,
    marginHorizontal: 25,
    width: 343,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  pinIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectBoxDisabled: {
    opacity: 0.5,
  },
  selectValueText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  selectPlaceholderText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    color: '#111827',
  },
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  confirmBannerText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    marginHorizontal: 25,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    backgroundColor: '#F3B4B4',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '55%',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItemText: {
    fontSize: 14,
    color: '#111827',
  },
});
