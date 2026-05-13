import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/orders_api.dart';
import '../models/order_model.dart';

final _ordersApi = OrdersApi.instance;

final customerOrdersProvider = FutureProvider<List<OrderModel>>((ref) async {
  return _ordersApi.getCustomerOrders();
});

final orderDetailProvider = FutureProvider.family<OrderModel, String>((ref, orderId) async {
  return _ordersApi.getOrderDetail(orderId);
});
