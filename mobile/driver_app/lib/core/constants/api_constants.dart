class ApiConstants {
  ApiConstants._();
  static const String baseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:5000/api');
  static const String driverLogin = '/auth/driver/login';
  static const String me          = '/auth/me';
  static const String logout      = '/auth/logout';
  static const String tours       = '/tours';
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
