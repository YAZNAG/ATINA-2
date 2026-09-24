import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/cart_service.dart';

/// Panier partagé par tous les écrans : la pastille de la barre du bas, la fiche
/// produit et l'écran panier lisent la même source.
class CartNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>>> {
  CartNotifier() : super(const AsyncValue.loading()) {
    refresh();
  }

  Future<void> refresh() async {
    try {
      state = AsyncValue.data(await CartService.get());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Applique un panier déjà renvoyé par l'API : évite un appel de plus après
  /// chaque ajout ou changement de quantité.
  void apply(Map<String, dynamic> cart) => state = AsyncValue.data(cart);

  Future<void> addSku(String skuId, {int quantity = 1}) async =>
      apply(await CartService.addSku(skuId, quantity: quantity));

  Future<void> addPack(String packId, {int quantity = 1}) async =>
      apply(await CartService.addPack(packId, quantity: quantity));

  Future<void> setQuantity(String itemId, int quantity) async {
    if (quantity <= 0) {
      apply(await CartService.removeItem(itemId));
    } else {
      apply(await CartService.setQuantity(itemId, quantity));
    }
  }

  Future<void> removeItem(String itemId) async =>
      apply(await CartService.removeItem(itemId));
}

final cartProvider =
    StateNotifierProvider<CartNotifier, AsyncValue<Map<String, dynamic>>>(
  (ref) => CartNotifier(),
);

/// Nombre d'articles du panier, pour la pastille de la barre de navigation.
final cartCountProvider = Provider<int>((ref) {
  return ref.watch(cartProvider).maybeWhen(
        data: CartService.countOf,
        orElse: () => 0,
      );
});

/// Quantité déjà au panier pour un SKU donné (fiche produit, grilles).
final cartQuantityProvider = Provider.family<int, String>((ref, skuId) {
  return ref.watch(cartProvider).maybeWhen(
        data: (cart) {
          final items = cart['items'];
          if (items is! List) return 0;
          for (final item in items) {
            if (item is Map && (item['sku']?['id'] ?? item['sku_id']) == skuId) {
              final q = item['quantity'];
              return q is num ? q.toInt() : 0;
            }
          }
          return 0;
        },
        orElse: () => 0,
      );
});
