import '../core/api.dart';

/// Profil du client connecté : identité, adresses, favoris, notifications.
class ProfileService {
  static Future<Map<String, dynamic>> get() async =>
      Api.asMap(await Api.get('/customer/me'));

  static Future<Map<String, dynamic>> update(Map<String, dynamic> data) async =>
      Api.asMap(await Api.put('/customer/me', body: data));

  // ── Adresses de livraison ─────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> addresses() async =>
      Api.asList(await Api.get('/customer/me/addresses'));

  static Future<Map<String, dynamic>> addAddress(Map<String, dynamic> data) async =>
      Api.asMap(await Api.post('/customer/me/addresses', body: data));

  static Future<Map<String, dynamic>> updateAddress(
    String id,
    Map<String, dynamic> data,
  ) async =>
      Api.asMap(await Api.put('/customer/me/addresses/$id', body: data));

  static Future<void> deleteAddress(String id) async =>
      Api.delete('/customer/me/addresses/$id');

  // ── Favoris ───────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> favorites() async =>
      Api.asList(await Api.get('/customer/me/favorites'));

  static Future<void> addFavorite(String articleId) async =>
      Api.post('/customer/me/favorites', body: {'article_id': articleId});

  static Future<void> removeFavorite(String articleId) async =>
      Api.delete('/customer/me/favorites/$articleId');

  // ── Notifications ─────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> notifications() async =>
      Api.asList(await Api.get('/customer/me/notifications'));

  /// Nombre de notifications non lues, pour la pastille de l'accueil.
  static Future<int> unreadCount() async {
    final list = await notifications();
    return list.where((n) => n['read_at'] == null && n['is_read'] != true).length;
  }

  // ── Commandes et portefeuille ─────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> orders() async =>
      Api.asList(await Api.get('/customer/me/orders'));

  static Future<Map<String, dynamic>> wallet() async =>
      Api.asMap(await Api.get('/customer/me/wallet'));
}
