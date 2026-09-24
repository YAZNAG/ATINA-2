import '../core/api.dart';

/// Fidélité : solde de points, historique, conversion en bon d'achat.
class LoyaltyService {
  static Future<Map<String, dynamic>> summary() async =>
      Api.asMap(await Api.get('/customer/loyalty/summary'));

  static Future<List<Map<String, dynamic>>> history() async =>
      Api.asList(await Api.get('/customer/loyalty/history'));

  static Future<Map<String, dynamic>> redeem(int points) async =>
      Api.asMap(await Api.post('/customer/loyalty/redeem', body: {'points': points}));
}

/// Catalogue des produits échangeables contre des points (WF #19).
class PointsExchangeService {
  static Future<List<Map<String, dynamic>>> catalog() async =>
      Api.asList(await Api.get('/customer/points-exchange'));
}

/// Jeux : roue de la chance, grattage, lots gagnés.
class GamesService {
  static Future<List<Map<String, dynamic>>> list() async =>
      Api.asList(await Api.get('/customer/games'));

  static Future<List<Map<String, dynamic>>> prizes() async =>
      Api.asList(await Api.get('/customer/games/prizes'));

  static Future<Map<String, dynamic>> play(String gameId) async =>
      Api.asMap(await Api.post('/customer/games/$gameId/play'));
}

/// Portefeuille : solde et mouvements.
class WalletService {
  static Future<Map<String, dynamic>> balance() async =>
      Api.asMap(await Api.get('/customer/wallet'));

  static Future<List<Map<String, dynamic>>> transactions() async =>
      Api.asList(await Api.get('/customer/wallet/transactions'));
}

/// Coupons de réduction du client.
class CouponsService {
  static Future<List<Map<String, dynamic>>> list() async =>
      Api.asList(await Api.get('/customer/coupons'));

  static Future<Map<String, dynamic>> validate(String code) async =>
      Api.asMap(await Api.post('/customer/coupons/validate', body: {'code': code}));
}
