import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { t, isRTL } from '../../i18n';

/** Barre d'en-tête de la maquette : retour rond + titre centré. */
export function ScreenTitle({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.back} accessibilityLabel={t('Retour')}>
        <Feather name={isRTL() ? 'chevron-right' : 'chevron-left'} size={20} color="#0A0A0A" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 34 }} />
    </View>
  );
}

/** Champ « Rechercher des produits… » de la maquette. */
export function SearchField({
  value, onChangeText, onSubmit, placeholder = 'Rechercher des produits....',
}: { value: string; onChangeText: (t: string) => void; onSubmit?: () => void; placeholder?: string }) {
  return (
    <View style={styles.search}>
      <Feather name="search" size={16} color="#8A8A8A" />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9A9A9A"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <Feather name="x" size={16} color="#8A8A8A" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  back: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, color: '#0A0A0A', fontFamily: 'Inter_700Bold', marginHorizontal: 8 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#D9D9D9', backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 13.5, color: '#0A0A0A', fontFamily: 'Inter_400Regular', paddingVertical: 0 },
});
