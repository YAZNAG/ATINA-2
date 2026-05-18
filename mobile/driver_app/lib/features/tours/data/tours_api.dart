import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../models/tour_model.dart';
import '../models/stop_model.dart';

class ToursApi {
  ToursApi._();
  static final ToursApi instance = ToursApi._();
  final Dio _dio = DioClient.instance.dio;

  // ── Tours ─────────────────────────────────────────────────────────────────────
  Future<List<TourModel>> getMyTours() async {
    try {
      final res  = await _dio.get(ApiConstants.driverTours);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => TourModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<TourModel> getTour(String id) async {
    try {
      final res = await _dio.get(ApiConstants.driverTour(id));
      return TourModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<TourModel> startTour(String id) async {
    try {
      final res = await _dio.patch(ApiConstants.driverTourStart(id));
      return TourModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  // ── Stops ─────────────────────────────────────────────────────────────────────
  Future<TourStopModel> getStop(String id) async {
    try {
      final res = await _dio.get(ApiConstants.driverStop(id));
      return TourStopModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<TourStopModel> arriveStop(String id) async {
    try {
      final res = await _dio.patch(ApiConstants.driverStopArrive(id));
      return TourStopModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<TourStopModel> deliverStop(String id, {
    required bool codCollected, double? amountCollected, String? driverNotes,
  }) async {
    try {
      final res = await _dio.patch(ApiConstants.driverStopDeliver(id), data: {
        'cod_collected':    codCollected,
        if (amountCollected != null) 'amount_collected': amountCollected,
        if (driverNotes != null)     'driver_notes':     driverNotes,
      });
      return TourStopModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<TourStopModel> failStop(String id, {
    required String failureReason, String? driverNotes,
  }) async {
    try {
      final res = await _dio.patch(ApiConstants.driverStopFail(id), data: {
        'failure_reason': failureReason,
        if (driverNotes != null) 'driver_notes': driverNotes,
        'revert_to_ready': true,
      });
      return TourStopModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}
