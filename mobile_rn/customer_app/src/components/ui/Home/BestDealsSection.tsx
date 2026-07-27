import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import ProductCard from '../ProductCard';
import SectionHeader from '../SectionHeader';
import SeeAllCard from '../SeeAllCard';
import { withSeeAllSentinel } from './listHelpers';
import { BestDeal, bestDealToArticle } from '../../../services/promotions.service';

interface BestDealsSectionProps {
  bestDeals: BestDeal[];
  onPressProduct: (articleId: number) => void;
  onSeeAll: () => void;
}

function BestDealsSection({ bestDeals, onPressProduct, onSeeAll }: BestDealsSectionProps) {
  const renderItem = useCallback(({ item }: { item: BestDeal }) => (
    <ProductCard
      article={bestDealToArticle(item)}
      discount={item.discount_pct}
      oldPrice={item.old_price_ttc}
      onPress={() => onPressProduct(item.id)}
    />
  ), [onPressProduct]);

  if (bestDeals.length === 0) return null;

  const { trimmed, hasMore } = withSeeAllSentinel(bestDeals);

  return (
    <View style={styles.section}>
      <SectionHeader title="Meilleures offres" onSeeAll={onSeeAll} />
      <FlatList
        data={trimmed}
        keyExtractor={(item) => `deal-${item.id}`}
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

export default React.memo(BestDealsSection);