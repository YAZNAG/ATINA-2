import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';
import '../models/customer_auth_response.dart';

class CustomerAuthApi {
  CustomerAuthApi._();
  static final CustomerAuthApi instance = CustomerAuthApi._();

  final Dio _dio = DioClient.instance.dio;

  Future<CustomerAuthResult> login({
    required String phoneCountry,
    required String phoneNumber,
    required String password,
  }) async {
    try {
      final res  = await _dio.post(ApiConstants.customerLogin, data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
        'password':      password,
      });
      return CustomerAuthResult.fromJson(_data(res));
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<OtpRequestResponse> register({
    required String phoneCountry,
    required String phoneNumber,
    required String fullName,
    required String password,
    String? email,
  }) async {
    try {
      final res = await _dio.post(ApiConstants.customerRegister, data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
        'full_name':     fullName,
        'password':      password,
        if (email != null && email.isNotEmpty) 'email': email,
      });
      return OtpRequestResponse.fromJson(_data(res));
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<OtpRequestResponse> requestOtp({
    required String phoneCountry,
    required String phoneNumber,
  }) async {
    try {
      final res = await _dio.post(ApiConstants.customerRequestOtp, data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
      });
      return OtpRequestResponse.fromJson(_data(res));
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<CustomerAuthResult> verifyOtp({
    required String phoneCountry,
    required String phoneNumber,
    required String otp,
  }) async {
    try {
      final res = await _dio.post(ApiConstants.customerVerifyOtp, data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
        'otp':           otp,
      });
      return CustomerAuthResult.fromJson(_data(res));
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<CustomerProfile> getMe() async {
    try {
      final res = await _dio.get(ApiConstants.customerMe);
      return CustomerProfile.fromMeJson(_data(res));
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Map<String, dynamic> _data(Response res) =>
      res.data['data'] as Map<String, dynamic>? ??
      res.data       as Map<String, dynamic>;
}
