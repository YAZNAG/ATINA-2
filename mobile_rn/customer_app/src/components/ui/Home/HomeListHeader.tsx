import React, { useCallback } from 'react';
import { View } from 'react-native';
import SearchBar from '../SearchBar';
import { Category, Article } from '../../../services/catalog.service';
import { SlideItem, BestDeal, EndingSoonResponse } from '../../../services/promotions.service';

import PromoSlidesSection  from './PromoSlidesSection';
import FlashSaleSection    from '../FlashSaleSection';
import CategoriesSection   from './CategoriesSection';
import BestDealsSection    from './BestDealsSection';
import PopularSection      from './PopularSection';
import TopRatedSection     from './TopRatedSection';
import SuggestionsSection  from './SuggestionsSection';
import ActiveFilterRow     from './ActiveFilterRow';

interface HomeListHeaderProps {
  hasCategoryFilter: boolean;
  slides: SlideItem[];
  activeSlide: number;
  onSlideScrollEnd: (e: any) => void;

  endingSoon: EndingSoonResponse;

  categories: Category[];
  selectedCat: number | null;
  onSelectCategory: (cat: Category) => void;
  onSeeAllCategories: () => void;

  bestDeals: BestDeal[];
  popular: Article[];
  topRated: Article[];
  suggestions: Article[];

  onPressProduct: (articleId: number) => void;

  activeCategoryName: string | null;
  onClearCategoryFilter: () => void;

  onOpenSearch: () => void;
  onOpenFilter: () => void;
  onSeeAllProductList: (source: string, title: string) => void;
}

function HomeListHeader({
  hasCategoryFilter,
  slides, activeSlide, onSlideScrollEnd,
  endingSoon,
  categories, selectedCat, onSelectCategory, onSeeAllCategories,
  bestDeals, popular, topRated, suggestions,
  onPressProduct,
  activeCategoryName, onClearCategoryFilter,
  onOpenSearch, onOpenFilter, onSeeAllProductList,
}: HomeListHeaderProps) {
  const seeAllBestDeals   = useCallback(() => onSeeAllProductList('bestDeals', 'Meilleures offres'), [onSeeAllProductList]);
  const seeAllPopular     = useCallback(() => onSeeAllProductList('popular', 'Produits populaires'), [onSeeAllProductList]);
  const seeAllTopRated    = useCallback(() => onSeeAllProductList('topRated', 'Notés 5 étoiles'), [onSeeAllProductList]);
  const seeAllSuggestions = useCallback(() => onSeeAllProductList('suggestions', 'Suggestions pour vous'), [onSeeAllProductList]);
  const seeAllProducts    = useCallback(() => onSeeAllProductList('allProducts', 'Tous les produits'), [onSeeAllProductList]);

  return (
    <View>
      <SearchBar
        value=""
        onChangeText={() => {}}
        onFilter={onOpenFilter}
        onPress={onOpenSearch}
      />

      {!hasCategoryFilter && (
        <PromoSlidesSection
          slides={slides}
          activeSlide={activeSlide}
          onScrollEnd={onSlideScrollEnd}
        />
      )}

      {!hasCategoryFilter && (
        <FlashSaleSection
          endsAt={endingSoon.ends_at}
          products={endingSoon.products}
        />
      )}

      {!hasCategoryFilter && (
        <CategoriesSection
          categories={categories}
          selectedId={selectedCat}
          onSelect={onSelectCategory}
          onSeeAll={onSeeAllCategories}
        />
      )}

      {!hasCategoryFilter && (
        <BestDealsSection
          bestDeals={bestDeals}
          onPressProduct={onPressProduct}
          onSeeAll={seeAllBestDeals}
        />
      )}

      {!hasCategoryFilter && (
        <PopularSection
          popular={popular}
          onPressProduct={onPressProduct}
          onSeeAll={seeAllPopular}
        />
      )}

      {!hasCategoryFilter && (
        <TopRatedSection
          topRated={topRated}
          onPressProduct={onPressProduct}
          onSeeAll={seeAllTopRated}
        />
      )}

      {!hasCategoryFilter && (
        <SuggestionsSection
          suggestions={suggestions}
          onPressProduct={onPressProduct}
          onSeeAll={seeAllSuggestions}
        />
      )}

      <ActiveFilterRow
        hasCategoryFilter={hasCategoryFilter}
        activeCategoryName={activeCategoryName}
        onClear={onClearCategoryFilter}
        onSeeAllProducts={seeAllProducts}
      />
    </View>
  );
}

export default React.memo(HomeListHeader);