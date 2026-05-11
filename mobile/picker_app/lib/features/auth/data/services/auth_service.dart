import 'package:dio/dio.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/auth_storage.dart';
import '../models/picker_model.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();
  final Dio _dio = DioClient.instance.dio;

  Future<PickerModel> login({required String phoneCountry, required String phoneNumber, required String password}) async {
    try {
      final res = await _dio.post(ApiConstants.pickerLogin, data: {
        'phone_country': phoneCountry,
        'phone_number':  phoneNumber.replaceFirst(RegExp(r'^0'), ''),
        'password':      password,
      });
      final data  = res.data['data'] ?? res.data;
      final token = data['token'] as String;
      final picker = PickerModel.fromJson(data as Map<String, dynamic>, token);
      await AuthStorage.instance.saveToken(token);
      return picker;
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<void> logout() async {
    try { await _dio.post(ApiConstants.logout); } catch (_) {}
    await AuthStorage.instance.clear();
  }

  Future<bool> isLoggedIn() => AuthStorage.instance.hasToken();
}
