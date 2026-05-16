import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;

class ApiConstants {
  ApiConstants._();

  // ── Base URL ───────────────────────────────────────────────────────────────
  // Override at build time:
  //   flutter run --dart-define=API_URL=http://192.168.100.4:5000/api  (physical Android)
  //   flutter run --dart-define=API_URL=http://10.0.2.2:5000/api       (Android emulator)
  static String get baseUrl {
    const envUrl = String.fromEnvironment('API_URL', defaultValue: '');
    if (envUrl.isNotEmpty) return envUrl;
    if (kIsWeb) return 'http://localhost:5000/api';
    if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:5000/api';
    return 'http://localhost:5000/api';
  }

  // Base URL for static assets (images, storage) — strips /api suffix
  static String get imageBaseUrl {
    final url = baseUrl;
    return url.endsWith('/api') ? url.substring(0, url.length - 4) : url;
  }

  // ── Admin auth ─────────────────────────────────────────────────────────────
  static const String login        = '/auth/login';
  static const String me           = '/auth/me';
  static const String logout       = '/auth/logout';

  // ── Customer auth ──────────────────────────────────────────────────────────
  static const String customerLogin       = '/customer/auth/login';
  static const String customerRegister    = '/customer/auth/register';
  static const String customerRequestOtp  = '/customer/auth/request-otp';
  static const String customerVerifyOtp   = '/customer/auth/verify-otp';
  static const String customerMe          = '/customer/auth/me';

  // ── Customer catalog (public) ──────────────────────────────────────────────
  static const String catalogCategories   = '/customer/catalog/categories';
  static const String catalogArticles     = '/customer/catalog/articles';
  static const String cities              = '/customer/catalog/cities';

  // ── Customer Me (authenticated) ────────────────────────────────────────────
  static const String customerMeProfile   = '/customer/me';
  static const String customerMeAddresses = '/customer/me/addresses';
  static const String customerOrders      = '/customer/me/orders';

  // ── Customer checkout (authenticated) ──────────────────────────────────────
  static const String checkoutMeta        = '/customer/checkout/meta';
  static const String checkoutSlots       = '/customer/checkout/delivery-slots';
  static const String eligibleNodes       = '/customer/checkout/eligible-nodes';
  static const String pickupNodes         = '/customer/checkout/pickup-nodes';
  static const String createOrder         = '/customer/checkout/create-order';

  // ── Admin resources (back-office only) ────────────────────────────────────
  static const String customers    = '/customers';
  static const String orders       = '/orders-mgmt';

  // ── Timeouts ───────────────────────────────────────────────────────────────
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
