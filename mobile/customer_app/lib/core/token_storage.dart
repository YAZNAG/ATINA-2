import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'prefs.dart';

/// Jeton de connexion : coffre chiffré sur mobile, préférences en web.
///
/// Le coffre n'existe pas côté navigateur ; l'aperçu web sert aux captures et aux
/// vérifications de design, il ne doit pas échouer à chaque appel d'API.
class TokenStorage {
  static const _key = 'auth_token';
  static const _store = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static String? _cached;

  /// Lu une fois au démarrage : les intercepteurs Dio sont synchrones.
  static Future<void> init() async {
    _cached = await read();
  }

  static String? get current => _cached;

  static Future<String?> read() async {
    try {
      if (kIsWeb) return Prefs.get(_key);
      return await _store.read(key: _key);
    } catch (_) {
      return null;
    }
  }

  static Future<void> save(String token) async {
    _cached = token;
    try {
      if (kIsWeb) {
        await Prefs.set(_key, token);
      } else {
        await _store.write(key: _key, value: token);
      }
    } catch (_) {
      // Coffre indisponible : la session reste valable en mémoire.
    }
  }

  static Future<void> clear() async {
    _cached = null;
    try {
      if (kIsWeb) {
        await Prefs.set(_key, null);
      } else {
        await _store.delete(key: _key);
      }
    } catch (_) {
      // Rien à faire.
    }
  }
}
