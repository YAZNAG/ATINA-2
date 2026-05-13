import '../../catalog/models/product_model.dart';

class CartItem {
  final ProductModel product;
  final int          qty;

  const CartItem({required this.product, required this.qty});

  double get subtotal => product.priceTtc * qty;

  CartItem copyWith({int? qty}) => CartItem(
    product: product,
    qty:     qty ?? this.qty,
  );
}
