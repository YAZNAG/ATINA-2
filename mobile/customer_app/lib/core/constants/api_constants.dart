class ApiConstants {
  ApiConstants._();

  // Android emulator → 10.0.2.2, iOS simulator → localhost
  static const String baseUrl =
      String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:5000/api');

  // Auth
  static const String login        = '/auth/login';
  static const String me           = '/auth/me';
  static const String logout       = '/auth/logout';

  // Customers
  static const String customers    = '/customers';

  // Catalog
  static const String articles     = '/catalog/articles';
  static const String categories   = '/catalog/categories';

  // Checkout
  static const String checkout     = '/checkout';

  // Orders
  static const String orders       = '/orders-mgmt';

  // Timeouts
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
