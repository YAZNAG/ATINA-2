import '../../../features/cart/models/cart_item_model.dart';

class CreateOrderPayload {
  final String customerId;
  final String? addressId;
  final String deliveryTypeId;
  final String nodeId;
  final String selectedSlotId;
  final String selectedDate;
  final String paymentMethodId;
  final double walletUsed;
  final int pointsUsed;
  final List<CartItemPayload> cartItems;
  final String? notes;

  const CreateOrderPayload({
    required this.customerId,
    this.addressId,
    required this.deliveryTypeId,
    required this.nodeId,
    required this.selectedSlotId,
    required this.selectedDate,
    required this.paymentMethodId,
    this.walletUsed = 0,
    this.pointsUsed = 0,
    required this.cartItems,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
    'customer_id': customerId,
    if (addressId != null) 'address_id': addressId,
    'delivery_type_id': deliveryTypeId,
    'node_id': nodeId,
    'selected_slot_id': selectedSlotId,
    'selected_date': selectedDate,
    'payment_method_id': paymentMethodId,
    'wallet_used': walletUsed,
    'points_used': pointsUsed,
    'cart_items': cartItems.map((e) => e.toJson()).toList(),
    if (notes != null) 'notes': notes,
  };
}

class CartItemPayload {
  final String skuId;
  final int qty;
  final double unitPrice;
  final double vatRate;

  const CartItemPayload({
    required this.skuId,
    required this.qty,
    required this.unitPrice,
    required this.vatRate,
  });

  factory CartItemPayload.fromCartItem(CartItem item) => CartItemPayload(
    skuId:     item.product.skuCode,
    qty:       item.qty,
    unitPrice: item.product.price,
    vatRate:   item.product.vatRate,
  );

  Map<String, dynamic> toJson() => {
    'sku_id': skuId,
    'qty': qty,
    'unit_price': unitPrice,
    'vat_rate': vatRate,
  };
}
