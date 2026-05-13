import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';
import '../models/order_model.dart';

class OrdersApi {
  OrdersApi._();
  static final OrdersApi instance = OrdersApi._();
  final Dio _dio = DioClient.instance.dio;

  Future<List<OrderModel>> getCustomerOrders() async {
    try {
      final res = await _dio.get(ApiConstants.customerOrders);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => OrderModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<OrderModel> getOrderDetail(String orderId) async {
    try {
      final res = await _dio.get('${ApiConstants.customerOrders}/$orderId');
      return OrderModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}
