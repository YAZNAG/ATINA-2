import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';

class AuthStorage {
  AuthStorage._();
  static const AuthStorage instance = AuthStorage._();

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  Future<void> saveToken(String token) =>
      _storage.write(key: AppConstants.tokenKey, value: token);

  Future<String?> getToken() =>
      _storage.read(key: AppConstants.tokenKey);

  Future<void> removeToken() =>
      _storage.delete(key: AppConstants.tokenKey);

  Future<void> saveUser(String json) =>
      _storage.write(key: AppConstants.userKey, value: json);

  Future<String?> getUser() =>
      _storage.read(key: AppConstants.userKey);

  Future<void> clear() => _storage.deleteAll();

  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
