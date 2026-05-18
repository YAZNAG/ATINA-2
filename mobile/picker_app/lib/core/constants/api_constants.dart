import 'package:flutter/foundation.dart';

class ApiConstants {
  ApiConstants._();

  static String get baseUrl {
    const env = String.fromEnvironment('API_URL', defaultValue: '');
    if (env.isNotEmpty) return env;
    if (kIsWeb) return 'http://localhost:5000/api';
    return 'http://10.0.2.2:5000/api'; // Android emulator → host PC
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  static const String pickerLogin = '/picker/login';

  // ── Picker portal ─────────────────────────────────────────────────────────────
  static const String availableOrders          = '/picker/available-orders';
  static const String myOrders                 = '/picker/my-orders';
  static String acceptOrder(String id)         => '/picker/orders/$id/accept';
  static String getSession(String id)          => '/picker/sessions/$id';
  static String startSession(String id)        => '/picker/sessions/$id/start';
  static String completeSession(String id)     => '/picker/sessions/$id/complete';
  static String pickItem(String id)            => '/picker/items/$id/pick';
  static String outOfStockItem(String id)      => '/picker/items/$id/out-of-stock';
  static String substituteItem(String id)      => '/picker/items/$id/substitute';

  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
