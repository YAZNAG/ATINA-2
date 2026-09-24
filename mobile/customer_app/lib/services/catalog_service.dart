import '../core/api.dart';

/// Catalogue : villes, points de distribution, familles, catégories, articles.
///
/// Le catalogue, les prix et le stock dépendent du point de distribution : il est
/// envoyé par l'en-tête `X-Node-Id` posé par [Api], rien à passer ici.
class CatalogService {
  // ── Géographie ────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> cities() async =>
      Api.asList(await Api.get('/customer/catalog/cities'));

  static Future<List<Map<String, dynamic>>> nodes(String cityId) async =>
      Api.asList(await Api.get(
        '/customer/catalog/nodes',
        query: {'city_id': cityId},
      ));

  // ── Hiérarchie produit ────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> families() async =>
      Api.asList(await Api.get('/customer/catalog/families'));

  /// Une famille et ses sous-familles (l'API renvoie les deux d'un coup).
  static Future<({Map<String, dynamic>? family, List<Map<String, dynamic>> subFamilies})>
      familyWithSubs(String familyId) async {
    final data = Api.asMap(
      await Api.get('/customer/catalog/families/$familyId/subfamilies'),
    );
    return (
      family: data['family'] is Map ? Api.asMap(data['family']) : null,
      subFamilies: Api.asList(data['subfamilies'] ?? data),
    );
  }

  // ── Catégories thématiques (US-024) ───────────────────────────────────────
  static Future<List<Map<String, dynamic>>> categories() async =>
      Api.asList(await Api.get('/customer/catalog/categories'));

  static Future<List<Map<String, dynamic>>> subCategories(String categoryId) async =>
      Api.asList(await Api.get('/customer/catalog/categories/$categoryId/sub-categories'));

  static Future<List<Map<String, dynamic>>> categoryArticles(
    String categoryId, {
    int limit = 50,
    int page = 1,
  }) async =>
      Api.asList(await Api.get(
        '/customer/catalog/categories/$categoryId/articles',
        query: {'limit': limit, 'page': page},
      ));

  // ── Articles ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> articles({
    int limit = 20,
    int page = 1,
    String? categoryId,
    String? familyId,
    String? subFamilyId,
    String? search,
  }) async =>
      Api.asList(await Api.get('/customer/catalog/articles', query: {
        'limit': limit,
        'page': page,
        if (categoryId != null) 'category_id': categoryId,
        if (familyId != null) 'family_id': familyId,
        if (subFamilyId != null) 'sub_family_id': subFamilyId,
        if (search != null && search.isNotEmpty) 'search': search,
      }));

  /// Recherche paginée : utilisée par la page famille, la catégorie et la recherche.
  static Future<({List<Map<String, dynamic>> items, int pages})> search({
    int page = 1,
    int limit = 20,
    String? query,
    String? familyId,
    String? subFamilyId,
    String? categoryId,
  }) async {
    final raw = await Api.envelope('/customer/catalog/articles', query: {
      'page': page,
      'limit': limit,
      if (query != null && query.isNotEmpty) 'search': query,
      if (familyId != null) 'family_id': familyId,
      if (subFamilyId != null) 'subfamily_id': subFamilyId,
      if (categoryId != null) 'category_id': categoryId,
    });
    final pagination = raw['pagination'];
    return (
      items: Api.asList(raw['data'] ?? raw),
      pages: pagination is Map ? (pagination['pages'] as num?)?.toInt() ?? 1 : 1,
    );
  }

  static Future<Map<String, dynamic>> article(String id) async =>
      Api.asMap(await Api.get('/customer/catalog/articles/$id'));

  static Future<List<Map<String, dynamic>>> recommended({int limit = 10}) async =>
      Api.asList(await Api.get(
        '/customer/catalog/recommendations',
        query: {'limit': limit},
      ));

  static Future<List<Map<String, dynamic>>> popular({int limit = 10}) async =>
      Api.asList(await Api.get('/customer/catalog/popular', query: {'limit': limit}));

  static Future<List<Map<String, dynamic>>> topRated({int limit = 10}) async =>
      Api.asList(await Api.get('/customer/catalog/top-rated', query: {'limit': limit}));

  /// Produits qui complètent le panier (affichés sous « Suggestions »).
  static Future<List<Map<String, dynamic>>> cartComplements(
    List<String> skuIds, {
    int limit = 10,
  }) async =>
      Api.asList(await Api.get('/customer/catalog/cart-complements', query: {
        'sku_ids': skuIds.join(','),
        'limit': limit,
      }));
}

/// Ventes flash et packs promotionnels.
class PromotionsService {
  static Future<List<Map<String, dynamic>>> active() async =>
      Api.asList(await Api.get('/customer/promotions'));

  static Future<Map<String, dynamic>> detail(String id) async =>
      Api.asMap(await Api.get('/customer/promotions/$id'));

  /// Bloc d'accueil : promotions qui se terminent bientôt et meilleures remises.
  static Future<Map<String, dynamic>> home({int hours = 24, int limit = 10}) async =>
      Api.asMap(await Api.get(
        '/customer/promotions/home',
        query: {'hours': hours, 'limit': limit},
      ));

  static Future<List<Map<String, dynamic>>> packs() async =>
      Api.asList(await Api.get('/customer/pack'));

  static Future<Map<String, dynamic>> pack(String id) async =>
      Api.asMap(await Api.get('/customer/pack/$id'));
}
