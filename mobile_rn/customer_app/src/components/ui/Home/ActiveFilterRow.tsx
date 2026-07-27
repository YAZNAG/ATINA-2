import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import SectionHeader from '../SectionHeader';

const RED = '#E10600';

interface ActiveFilterRowProps {
  hasCategoryFilter: boolean;
  activeCategoryName: string | null;
  onClear: () => void;
  onSeeAllProducts: () => void;
}

function ActiveFilterRow({ hasCategoryFilter, activeCategoryName, onClear, onSeeAllProducts }: ActiveFilterRowProps) {
  return (
    <View style={styles.section}>
      {hasCategoryFilter ? (
        <View style={styles.activeFilterRow}>
          <View style={styles.activeFilterChip}>
            <Feather name="filter" size={13} color={RED} />
            <Text style={styles.activeFilterText}>
              {activeCategoryName || 'Filtré'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={styles.clearFilterText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionHeader title="Tous les produits" onSeeAll={onSeeAllProducts} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  activeFilterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  activeFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF0F0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  activeFilterText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: RED },
  clearFilterText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#9CA3AF' },
});

export default React.memo(ActiveFilterRow);