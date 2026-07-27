import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import ProductCard from '../ProductCard';
import SectionHeader from '../SectionHeader';
import { withSeeAllSentinel } from './listHelpers';
import { Article } from '../../../services/catalog.service';

interface SuggestionsSectionProps {
  suggestions: Article[];
  onPressProduct: (articleId: number) => void;
  onSeeAll: () => void;
}

function SuggestionsSection({ suggestions, onPressProduct, onSeeAll }: SuggestionsSectionProps) {
  const rows = useMemo(() => {
    const { trimmed } = withSeeAllSentinel(suggestions);
    const result: Article[][] = [];
    for (let i = 0; i < trimmed.length; i += 2) result.push(trimmed.slice(i, i + 2));
    return result;
  }, [suggestions]);

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Suggestions pour vous" onSeeAll={onSeeAll} />
      {rows.map((row, ri) => (
        <View key={ri} style={styles.suggestionRow}>
          {row.map((item) => (
            <ProductCard
              key={item.id}
              article={item}
              onPress={() => onPressProduct(item.id)}
            />
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  suggestionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 16, marginBottom: 16 },
});

export default React.memo(SuggestionsSection);