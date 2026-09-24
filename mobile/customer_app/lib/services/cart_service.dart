import '../core/api.dart';

/// Panier du client : articles à l'unité et packs, mêmes routes que l'app Expo.
class CartService {
  static Future<Map<String, dynamic>> get() async =>
      Api.asMap(await Api.get('/customer/cart'));

  static Future<Map<String, dynamic>> addSku(String skuId, {int quantity = 1}) async =>
      Api.asMap(await Api.post(
        '/customer/cart',
        body: {'sku_id': skuId, 'quantity': quantity},
      ));

  static Future<Map<String, dynamic>> setQuantity(String itemId, int quantity) async =>
      Api.asMap(await Api.put('/customer/cart/$itemId', body: {'quantity': quantity}));

  static Future<Map<String, dynamic>> removeItem(String itemId) async =>
      Api.asMap(await Api.delete('/customer/cart/$itemId'));

  static Future<Map<String, dynamic>> addPack(String packId, {int quantity = 1}) async =>
      Api.asMap(await Api.post(
        '/customer/cart/pack',
        body: {'pack_id': packId, 'quantity': quantity},
      ));

  static Future<Map<String, dynamic>> setPackQuantity(String packId, int quantity) async =>
      Api.asMap(await Api.put('/customer/cart/pack/$packId', body: {'quantity': quantity}));

  static Future<Map<String, dynamic>> removePack(String packId) async =>
      Api.asMap(await Api.delete('/customer/cart/pack/$packId'));

  static Future<Map<String, dynamic>> clear() async =>
      Api.asMap(await Api.delete('/customer/cart'));

  static Future<Map<String, dynamic>> reorder(String orderId, {String mode = 'available'}) async =>
      Api.asMap(await Api.post(
        '/customer/cart/reorder',
        body: {'order_id': orderId, 'mode': mode},
      ));

  /// Nombre d'articles affiché sur la pastille du panier : un pack compte pour un.
  static int countOf(Map<String, dynamic> cart) {
    final items = cart['items'];
    if (items is! List) return 0;
    final packs = <Object>{};
    var count = 0;
    for (final item in items) {
      if (item is! Map) continue;
      final packId = (item['pack'] is Map) ? item['pack']['id'] : null;
      if (packId != null) {
        if (packs.add(packId as Object)) count++;
      } else {
        count++;
      }
    }
    return count;
  }
}
