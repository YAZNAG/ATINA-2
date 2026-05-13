import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../catalog/models/product_model.dart';
import '../models/cart_item_model.dart';

class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super([]);

  void addProduct(ProductModel product, {int qty = 1}) {
    final idx = state.indexWhere((i) => i.product.id == product.id);
    if (idx >= 0) {
      final updated = List<CartItem>.from(state);
      updated[idx] = state[idx].copyWith(qty: state[idx].qty + qty);
      state = updated;
    } else {
      state = [...state, CartItem(product: product, qty: qty)];
    }
  }

  void removeProduct(int productId) {
    state = state.where((i) => i.product.id != productId).toList();
  }

  void updateQty(int productId, int qty) {
    if (qty <= 0) { removeProduct(productId); return; }
    state = state.map((i) => i.product.id == productId ? i.copyWith(qty: qty) : i).toList();
  }

  void clear() => state = [];

  int qtyOf(int productId) {
    final idx = state.indexWhere((i) => i.product.id == productId);
    return idx >= 0 ? state[idx].qty : 0;
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>(
  (_) => CartNotifier(),
);

final cartTotalProvider = Provider<double>((ref) {
  return ref.watch(cartProvider).fold(0.0, (sum, i) => sum + i.subtotal);
});

final cartCountProvider = Provider<int>((ref) {
  return ref.watch(cartProvider).fold(0, (sum, i) => sum + i.qty);
});
