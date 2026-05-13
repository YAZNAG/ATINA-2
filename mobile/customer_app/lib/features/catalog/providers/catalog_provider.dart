import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/catalog_api.dart';
import '../models/category_model.dart';
import '../models/product_model.dart';

final _api = CatalogApi.instance;

// ── Categories ─────────────────────────────────────────────────────────────────
final categoriesProvider = FutureProvider<List<CategoryModel>>((ref) async {
  return _api.getCategories();
});

// ── Products by category ───────────────────────────────────────────────────────
final productsByCategoryProvider =
    FutureProvider.family<List<ProductModel>, int>((ref, categoryId) async {
  final result = await _api.getProductsByCategory(categoryId, limit: 50);
  return result.data;
});

// ── Product detail ─────────────────────────────────────────────────────────────
final productDetailProvider =
    FutureProvider.family<ProductModel, int>((ref, productId) async {
  return _api.getProductDetail(productId);
});

// ── Search products ────────────────────────────────────────────────────────────
class SearchParams {
  final String? query;
  final int?    categoryId;
  const SearchParams({this.query, this.categoryId});

  @override
  bool operator ==(Object other) =>
      other is SearchParams && other.query == query && other.categoryId == categoryId;

  @override
  int get hashCode => Object.hash(query, categoryId);
}

final searchProductsProvider =
    FutureProvider.family<List<ProductModel>, SearchParams>((ref, params) async {
  if ((params.query == null || params.query!.isEmpty) && params.categoryId == null) return [];
  final result = await _api.searchProducts(
    search:     params.query,
    categoryId: params.categoryId,
    limit:      30,
  );
  return result.data;
});
