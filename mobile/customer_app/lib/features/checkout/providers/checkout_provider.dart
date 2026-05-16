import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/checkout_api.dart';
import '../models/checkout_meta_model.dart';
import '../models/pickup_node_model.dart';

final _checkoutApi = CheckoutApi.instance;

final checkoutMetaProvider = FutureProvider<CheckoutMetaModel>((ref) async {
  return _checkoutApi.getCheckoutMeta();
});

final deliverySlotsProvider = FutureProvider.family<DeliverySlotsResult, Map<String, dynamic>?>((ref, params) async {
  return _checkoutApi.getDeliverySlots(
    addressId:        params?['address_id'] as String?,
    deliveryTypeId:   params?['delivery_type_id'] as String?,
    deliveryTypeCode: params?['delivery_type_code'] as String?,
    nodeId:           params?['node_id'] as String?,
    date:             params?['date'] as String?,
  );
});

final pickupNodesProvider = FutureProvider<List<PickupNodeModel>>((ref) async {
  return _checkoutApi.getPickupNodes();
});

final activeDeliveryTypesProvider = Provider<List<DeliveryTypeModel>>((ref) {
  final meta = ref.watch(checkoutMetaProvider);
  return meta.valueOrNull?.deliveryTypes.where((t) => t.isActive).toList() ?? [];
});

final activePaymentMethodsProvider = Provider<List<PaymentMethodModel>>((ref) {
  final meta = ref.watch(checkoutMetaProvider);
  return meta.valueOrNull?.paymentMethods.where((m) => m.isActive).toList() ?? [];
});
