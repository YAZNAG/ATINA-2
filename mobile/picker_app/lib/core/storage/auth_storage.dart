import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  AuthStorage._();
  static final AuthStorage instance = AuthStorage._();

  // Stream émis quand le token est effacé (401 → redirect login)
  final _tokenClearedCtrl = StreamController<void>.broadcast();
  Stream<void> get tokenCleared => _tokenClearedCtrl.stream;

  static const _tokenKey = 'ds_picker_token';
  static const _userKey  = 'ds_picker_user';

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void>  saveToken(String t)  => _storage.write(key: _tokenKey, value: t);
  Future<String?> getToken()         => _storage.read(key: _tokenKey);
  Future<void>  removeToken()        => _storage.delete(key: _tokenKey);
  Future<void>  saveUser(String j)   => _storage.write(key: _userKey, value: j);
  Future<String?> getUser()          => _storage.read(key: _userKey);
  Future<void>  clear() async {
    await _storage.deleteAll();
    _tokenClearedCtrl.add(null); // notifie authProvider → logout
  }
  Future<bool>  hasToken() async     { final t = await getToken(); return t != null && t.isNotEmpty; }
}
