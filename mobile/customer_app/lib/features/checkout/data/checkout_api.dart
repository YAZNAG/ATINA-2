import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';
import '../models/checkout_meta_model.dart';
import '../models/delivery_slot_model.dart';
import '../models/pickup_node_model.dart';
import '../models/create_order_payload.dart';

class CheckoutApi {
  CheckoutApi._();
  static final CheckoutApi instance = CheckoutApi._();
  final Dio _dio = DioClient.instance.dio;

  Future<CheckoutMetaModel> getCheckoutMeta() async {
    try {
      final res = await _dio.get(ApiConstants.checkoutMeta);
      return CheckoutMetaModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<List<DeliverySlotModel>> getDeliverySlots({
    String? addressId,
    String? deliveryTypeId,
    String? nodeId,
    String? date,
  }) async {
    try {
      final params = <String, dynamic>{
        if (addressId != null) 'address_id': addressId,
        if (deliveryTypeId != null) 'delivery_type_id': deliveryTypeId,
        if (nodeId != null) 'node_id': nodeId,
        if (date != null) 'date': date,
      };
      final res = await _dio.get(ApiConstants.checkoutSlots, queryParameters: params);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => DeliverySlotModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<List<PickupNodeModel>> getPickupNodes({String? cartItems}) async {
    try {
      final params = <String, dynamic>{
        if (cartItems != null) 'cart_items': cartItems,
      };
      final res = await _dio.get(ApiConstants.pickupNodes, queryParameters: params);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => PickupNodeModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<Map<String, dynamic>> createOrder(CreateOrderPayload payload) async {
    try {
      final res = await _dio.post(ApiConstants.createOrder, data: payload.toJson());
      return res.data['data'] as Map<String, dynamic>? ?? {};
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}
