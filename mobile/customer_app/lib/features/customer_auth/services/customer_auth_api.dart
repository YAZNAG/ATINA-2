import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../models/customer_auth_response.dart';

class CustomerAuthApi {
  CustomerAuthApi._();
  static final CustomerAuthApi instance = CustomerAuthApi._();

  final Dio _dio = DioClient.instance.dio;

  static const String _base = '/customer/auth';

  Future<OtpRequestResponse> requestOtp({
    required String phoneCountry,
    required String phoneNumber,
  }) async {
    try {
      final res = await _dio.post('$_base/request-otp', data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
      });
      final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
      return OtpRequestResponse.fromJson(data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<OtpVerifyResponse> verifyOtp({
    required String phoneCountry,
    required String phoneNumber,
    required String otp,
  }) async {
    try {
      final res = await _dio.post('$_base/verify-otp', data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
        'otp':           otp,
      });
      final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
      return OtpVerifyResponse.fromJson(data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
