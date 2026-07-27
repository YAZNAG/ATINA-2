import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import ProductCard from '../ProductCard';
import SectionHeader from '../SectionHeader';
import SeeAllCard from '../SeeAllCard';
import { withSeeAllSentinel } from './listHelpers';
import { Article } from '../../../services/catalog.service';

interface TopRatedSectionProps {
  topRated: Article[];
  onPressProduct: (articleId: number) => void;
  onSeeAll: () => void;
}

function TopRatedSection({ topRated, onPressProduct, onSeeAll }: TopRatedSectionProps) {
  const renderItem = useCallback(({ item }: { item: Article }) => (
    <ProductCard
      article={item}
      onPress={() => onPressProduct(item.id)}
    />
  ), [onPressProduct]);

  if (topRated.length === 0) return null;

  const { trimmed, hasMore } = withSeeAllSentinel(topRated);

  return (
    <View style={styles.section}>
      <SectionHeader title="Notés 5 étoiles" onSeeAll={onSeeAll} />
      <FlatList
        data={trimmed}
        keyExtractor={(item) => `rated-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={renderItem}
        ListFooterComponent={hasMore ? <SeeAllCard onPress={onSeeAll} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16 },
  horizontalList: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
});

export default React.memo(TopRatedSection);