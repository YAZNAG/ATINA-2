import 'package:flutter/foundation.dart';

class ApiConstants {
  ApiConstants._();

  static String get baseUrl {
    const env = String.fromEnvironment('API_URL', defaultValue: '');
    if (env.isNotEmpty) return env;
    if (kIsWeb) return 'http://localhost:5000/api';
    return 'http://10.0.2.2:5000/api'; // Android emulator → host
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  static const String driverLogin = '/driver/login';

  // ── Driver tours ──────────────────────────────────────────────────────────────
  static const String driverTours = '/driver/tours';
  static String driverTour(String id)          => '/driver/tours/$id';
  static String driverTourStart(String id)     => '/driver/tours/$id/start';

  // ── Driver stops ──────────────────────────────────────────────────────────────
  static String driverStop(String id)          => '/driver/stops/$id';
  static String driverStopArrive(String id)    => '/driver/stops/$id/arrive';
  static String driverStopDeliver(String id)   => '/driver/stops/$id/deliver';
  static String driverStopFail(String id)      => '/driver/stops/$id/fail';

  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
