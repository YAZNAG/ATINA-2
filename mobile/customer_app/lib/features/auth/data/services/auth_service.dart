import 'dart:convert';
import 'package:dio/dio.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/auth_storage.dart';
import '../models/auth_response.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final Dio _dio = DioClient.instance.dio;

  Future<AuthResponse> login({
    required String phoneCountry,
    required String phoneNumber,
    required String password,
  }) async {
    try {
      // Customer login via main auth endpoint using phone as email fallback,
      // or use customers custom login if available
      final response = await _dio.post(ApiConstants.login, data: {
        'email':    '$phoneCountry$phoneNumber',   // fallback
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber,
        'password': password,
      });
      final auth = AuthResponse.fromJson(response.data['data'] ?? response.data);
      await AuthStorage.instance.saveToken(auth.token);
      await AuthStorage.instance.saveUser(jsonEncode(auth.user.toJson()));
      return auth;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<UserProfile> getMe() async {
    try {
      final response = await _dio.get(ApiConstants.me);
      final data     = response.data['data'] ?? response.data;
      return UserProfile.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> logout() async {
    try { await _dio.post(ApiConstants.logout); } catch (_) {}
    await AuthStorage.instance.clear();
  }

  Future<UserProfile?> restoreSession() async {
    final token = await AuthStorage.instance.getToken();
    if (token == null) return null;
    final raw = await AuthStorage.instance.getUser();
    if (raw != null) {
      try { return UserProfile.fromJson(jsonDecode(raw) as Map<String, dynamic>); } catch (_) {}
    }
    try { return await getMe(); } catch (_) { await AuthStorage.instance.clear(); return null; }
  }
}
