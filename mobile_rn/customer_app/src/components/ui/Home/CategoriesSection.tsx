import React from 'react';
import { View, StyleSheet } from 'react-native';
import CategoryList from '../CategoryList';
import SectionHeader from '../SectionHeader';
import { Category, EntityId } from '../../../services/catalog.service';

interface CategoriesSectionProps {
  categories: Category[];
  selectedId: EntityId | null;
  onSelect: (cat: Category) => void;
  onSeeAll: () => void;
}

function CategoriesSection({ categories, selectedId, onSelect, onSeeAll }: CategoriesSectionProps) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Catégories" onSeeAll={onSeeAll} />
      <CategoryList
        categories={categories}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
});

export default React.memo(CategoriesSection);