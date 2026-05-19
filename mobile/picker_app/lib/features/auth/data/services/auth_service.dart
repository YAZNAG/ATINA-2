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

  /// Vérifie que le token en storage est encore valide côté backend.
  /// Retourne null si token absent ou invalide.
  Future<PickerModel?> getMe() async {
    final t = await AuthStorage.instance.getToken();
    if (t == null || t.isEmpty) return null;
    try {
      final res = await _dio.get('/picker/me');
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      return PickerModel.fromJson({'picker': data}, t);
    } on DioException {
      return null; // 401 → _AuthInterceptor a déjà vidé le storage
    }
  }

  Future<void> logout() async {
    await AuthStorage.instance.clear();
  }

  Future<bool> isLoggedIn() => AuthStorage.instance.hasToken();
}
