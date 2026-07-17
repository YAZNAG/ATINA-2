import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image,
} from 'react-native';
import { Category } from '../../services/catalog.service';
import {
  useFonts,
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Feather } from '@expo/vector-icons';

const RED = '#E10600';

interface CategoryListProps {
  categories: Category[];
  selectedId?: number | null;
  onSelect: (category: Category) => void;
}

export default function CategoryList({ categories, selectedId, onSelect }: CategoryListProps) {
  const [fontsLoaded] = useFonts({
      Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* All categories */}
      <TouchableOpacity
        style={styles.item}
        onPress={() => onSelect({ id: 0 } as Category)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, selectedId === null && styles.iconBoxSelected]}>
          <Feather name="grid" size={24} color={selectedId === null ? RED : '#6B7280'} />
          </View>
        <Text style={[styles.label, selectedId === null && styles.labelSelected]}>
          Tout
        </Text>
      </TouchableOpacity>

      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={styles.item}
          onPress={() => onSelect(cat)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, selectedId === cat.id && styles.iconBoxSelected]}>
            {cat.icon_path ? (
              <Image source={{ uri: cat.icon_path }} style={styles.iconImage} resizeMode="contain" />
            ) : (
              <Text style={styles.emoji}></Text>
            )}
          </View>
          <Text style={[styles.label, selectedId === cat.id && styles.labelSelected]} numberOfLines={1}>
            {cat.name_fr}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  item:      { alignItems: 'center', width: 72 },

  iconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconBoxSelected: {
    borderColor: RED,
    shadowColor: RED,
    shadowOpacity: 0.2,
    elevation: 4,
  },

  iconImage: { width: 32, height: 32 },
  emoji:     { fontSize: 22 },

  label: {
    fontSize: 11, color: '#6B7280',
    textAlign: 'center', fontFamily: 'Inter_500Medium',
  },
  labelSelected: { color: RED, fontFamily:'Inter_700Bold' },
});