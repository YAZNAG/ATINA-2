import 'dart:convert';

import '../core/api.dart';
import '../core/token_storage.dart';

/// Connexion du client : numéro de téléphone puis code à quatre chiffres.
/// Mêmes routes que l'app Expo (`/customer/auth/...`), aucun changement côté serveur.
class AuthService {
  /// Le numéro est-il déjà connu et vérifié ?
  static Future<({bool exists, bool isVerified})> checkPhone(
    String phoneNumber, {
    String country = '+212',
  }) async {
    final data = Api.asMap(await Api.post(
      '/customer/auth/check-phone',
      body: {'phone_country': country, 'phone_number': phoneNumber},
    ));
    return (
      exists: data['exists'] == true,
      isVerified: data['is_verified'] == true,
    );
  }

  /// Envoi du code par SMS.
  static Future<({bool isNew, String message})> requestOtp(
    String phoneNumber, {
    String country = '+212',
  }) async {
    final data = Api.asMap(await Api.post(
      '/customer/auth/request-otp',
      body: {'phone_country': country, 'phone_number': phoneNumber},
    ));
    return (
      isNew: data['is_new'] == true,
      message: (data['message'] as String?) ?? '',
    );
  }

  /// Vérification du code : le jeton renvoyé est stocké immédiatement.
  static Future<({bool isNew, Map<String, dynamic> user, Map<String, dynamic>? customer})>
      verifyOtp(
    String phoneNumber,
    String otp, {
    String country = '+212',
  }) async {
    final data = Api.asMap(await Api.post(
      '/customer/auth/verify-otp',
      body: {
        'phone_country': country,
        'phone_number': phoneNumber,
        'otp': otp,
      },
    ));
    final token = data['token'];
    if (token is String && token.isNotEmpty) await TokenStorage.save(token);
    final user = Api.asMap(data['user']);
    return (
      isNew: user['is_new'] == true,
      user: user,
      customer: data['customer'] is Map ? Api.asMap(data['customer']) : null,
    );
  }

  /// Profil complet du client connecté (solde de points, portefeuille, parrainage).
  static Future<Map<String, dynamic>> me() async =>
      Api.asMap(await Api.get('/customer/auth/me'));

  static Future<void> logout() => TokenStorage.clear();

  /// Session valable : un jeton présent et non expiré.
  static bool hasValidSession() {
    final token = TokenStorage.current;
    if (token == null || token.isEmpty) return false;
    final exp = _expiry(token);
    return exp == null || exp.isAfter(DateTime.now());
  }

  /// Date d'expiration lue dans le JWT, sans dépendance externe.
  static DateTime? _expiry(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final exp = (jsonDecode(payload) as Map)['exp'];
      if (exp is! num) return null;
      return DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
    } catch (_) {
      return null;
    }
  }
}
