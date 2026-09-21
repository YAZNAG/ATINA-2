import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { t } from '../../i18n';

const RED = '#E10600';

export type SelectOption = { value: string; label: string; hint?: string | null };

/** Liste de choix en feuille basse (ville, point de distribution…). */
export default function SelectSheet({
  visible, title, options, selected, onSelect, onClose, emptyText = 'Aucun élément disponible.',
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selected?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  emptyText?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grip} />
        <Text style={styles.title}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          style={{ maxHeight: 420 }}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <TouchableOpacity
                style={[styles.row, active && styles.rowActive]}
                onPress={() => { onSelect(item.value); onClose(); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, active && styles.labelActive]}>{t(item.label)}</Text>
                  {!!item.hint && <Text style={styles.hint}>{t(item.hint)}</Text>}
                </View>
                {active && <Feather name="check-circle" size={18} color={RED} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18, paddingTop: 10,
  },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E2E2', marginBottom: 12 },
  title: { fontSize: 16, color: '#0A0A0A', fontFamily: 'Poppins_700Bold', marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 4,
  },
  rowActive: { backgroundColor: '#FDECEC' },
  label: { fontSize: 14.5, color: '#0A0A0A', fontFamily: 'Poppins_500Medium' },
  labelActive: { color: RED, fontFamily: 'Poppins_600SemiBold' },
  hint: { fontSize: 12, color: '#8A8A8A', fontFamily: 'Poppins_400Regular', marginTop: 2 },
  empty: { textAlign: 'center', color: '#8A8A8A', paddingVertical: 24, fontFamily: 'Poppins_400Regular' },
});
