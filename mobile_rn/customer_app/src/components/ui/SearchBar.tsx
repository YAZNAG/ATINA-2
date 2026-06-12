import React from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const RED = '#E10600';

interface SearchBarProps {
  value:        string;
  onChangeText: (text: string) => void;
  onPress?:     () => void;
  onFilter?:    () => void;
  placeholder?: string;
}

export default function SearchBar({
  value, onChangeText, onPress, onFilter, placeholder = 'Rechercher des produits....',
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Feather name="search" size={20} color="#9CA3AF" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          onFocus={onPress}
        />

        {/* Bouton clear */}
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} style={{ marginRight: 8 }}>
            <Feather name="x" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}

        {/* ── Bouton filtre rond rouge À L'INTÉRIEUR ── */}
        <TouchableOpacity style={styles.filterBtn} onPress={onFilter} activeOpacity={0.85}>
          <Feather name="sliders" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16, marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 16,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  icon:  { marginRight: 10 },
  input: {
    flex: 1, fontSize: 15, color: '#1a1a1a',
    fontFamily: 'Inter_400Regular', padding: 0,
    paddingVertical: 8,
  },
  filterBtn: {
    width: 40, height: 40, borderRadius: 15,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
});