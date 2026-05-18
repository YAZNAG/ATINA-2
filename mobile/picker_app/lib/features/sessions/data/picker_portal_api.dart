import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../models/session_models.dart';

class PickerPortalApi {
  PickerPortalApi._();
  static final PickerPortalApi instance = PickerPortalApi._();
  final Dio _dio = DioClient.instance.dio;

  // ── Available orders ───────────────────────────────────────────────────────
  Future<List<AvailableOrderModel>> getAvailableOrders() async {
    try {
      final res  = await _dio.get(ApiConstants.availableOrders);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => AvailableOrderModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── My orders / sessions ───────────────────────────────────────────────────
  Future<Map<String, List<PickingSessionModel>>> getMyOrders() async {
    try {
      final res  = await _dio.get(ApiConstants.myOrders);
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      List<PickingSessionModel> parseList(dynamic raw) {
        if (raw is! List) return [];
        return raw.map((e) => PickingSessionModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return {
        'active':    parseList(data['active']),
        'completed': parseList(data['completed']),
        'cancelled': parseList(data['cancelled']),
      };
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Accept order ───────────────────────────────────────────────────────────
  Future<PickingSessionModel> acceptOrder(String orderId) async {
    try {
      final res = await _dio.post(ApiConstants.acceptOrder(orderId));
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Session detail ─────────────────────────────────────────────────────────
  Future<PickingSessionModel> getSession(String sessionId) async {
    try {
      final res = await _dio.get(ApiConstants.getSession(sessionId));
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Start session ──────────────────────────────────────────────────────────
  Future<PickingSessionModel> startSession(String sessionId) async {
    try {
      final res = await _dio.patch(ApiConstants.startSession(sessionId));
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Pick item ──────────────────────────────────────────────────────────────
  Future<PickingSessionModel> pickItem(String itemId, {required String scannedEan, required double qtyPicked}) async {
    try {
      final res = await _dio.patch(ApiConstants.pickItem(itemId), data: {
        'scanned_ean': scannedEan,
        'qty_picked':  qtyPicked,
      });
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Out of stock ───────────────────────────────────────────────────────────
  Future<PickingSessionModel> outOfStock(String itemId, {String? reason}) async {
    try {
      final res = await _dio.patch(ApiConstants.outOfStockItem(itemId), data: {
        if (reason != null) 'reason': reason,
      });
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Substitute ─────────────────────────────────────────────────────────────
  Future<PickingSessionModel> substitute(String itemId, {
    String? substituteEan, String? substituteSkuId, double qtyPicked = 1, String? reason,
  }) async {
    try {
      final res = await _dio.patch(ApiConstants.substituteItem(itemId), data: {
        if (substituteEan   != null) 'substitute_ean':    substituteEan,
        if (substituteSkuId != null) 'substitute_sku_id': substituteSkuId,
        'qty_picked':  qtyPicked,
        if (reason != null) 'reason': reason,
      });
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Complete session ───────────────────────────────────────────────────────
  Future<PickingSessionModel> completeSession(String sessionId) async {
    try {
      final res = await _dio.patch(ApiConstants.completeSession(sessionId));
      return PickingSessionModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}
