import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';
import '../models/category_model.dart';
import '../models/product_model.dart';

class CatalogApi {
  CatalogApi._();
  static final CatalogApi instance = CatalogApi._();
  final Dio _dio = DioClient.instance.dio;

  Future<List<CategoryModel>> getCategories() async {
    try {
      final res  = await _dio.get(ApiConstants.catalogCategories);
      final data = (res.data['data'] as List<dynamic>? ?? []);
      return data.map((e) => CategoryModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<({List<ProductModel> data, int total, int page, int pages})>
      getProductsByCategory(int categoryId, {int page = 1, int limit = 20, String? search}) async {
    try {
      final res  = await _dio.get(
        '${ApiConstants.catalogCategories}/$categoryId/articles',
        queryParameters: {
          'page': page, 'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final data = (res.data['data'] as List<dynamic>? ?? [])
          .map((e) => ProductModel.fromJson(e as Map<String, dynamic>)).toList();
      final pag  = res.data['pagination'] as Map<String, dynamic>? ?? {};
      return (
        data:  data,
        total: pag['total'] as int? ?? 0,
        page:  pag['page']  as int? ?? 1,
        pages: pag['pages'] as int? ?? 1,
      );
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<ProductModel> getProductDetail(int productId) async {
    try {
      final res = await _dio.get('${ApiConstants.catalogArticles}/$productId');
      return ProductModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<({List<ProductModel> data, int total})> searchProducts({
    String? search, int? categoryId, int page = 1, int limit = 20,
  }) async {
    try {
      final res  = await _dio.get(
        ApiConstants.catalogArticles,
        queryParameters: {
          'page': page, 'limit': limit,
          if (search != null && search.isNotEmpty) 'search': search,
          if (categoryId != null) 'category_id': categoryId,
        },
      );
      final data = (res.data['data'] as List<dynamic>? ?? [])
          .map((e) => ProductModel.fromJson(e as Map<String, dynamic>)).toList();
      final total = (res.data['pagination'] as Map<String, dynamic>?)?['total'] as int? ?? 0;
      return (data: data, total: total);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}
