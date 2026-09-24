import 'package:dio/dio.dart';

import '../i18n/i18n.dart';
import 'config.dart';
import 'prefs.dart';
import 'token_storage.dart';

/// Erreur d'API telle que la présentent les écrans : un message déjà traduit et le
/// code HTTP, sans détail technique.
class ApiError implements Exception {
  ApiError(this.message, this.statusCode);

  final String message;
  final int statusCode;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}

/// Client HTTP de l'application.
///
/// Trois en-têtes sont posés à chaque appel : le jeton de connexion, le point de
/// distribution choisi (`X-Node-Id`, qui détermine catalogue, prix et stock) et la
/// langue (`X-Lang`, pour les messages du serveur). Les réponses passent par
/// [localizeData] afin que les écrans n'aient qu'un champ `*_fr` à lire.
class Api {
  Api._();

  static final Dio _dio = _build();

  static Dio _build() {
    final dio = Dio(
      BaseOptions(
        baseUrl: Config.apiUrl,
        connectTimeout: Config.timeout,
        receiveTimeout: Config.timeout,
        headers: {'Content-Type': 'application/json'},
        // Les erreurs métier sont traitées ici, pas levées par Dio.
        validateStatus: (_) => true,
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = TokenStorage.current;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final nodeId = NodePref.get();
          if (nodeId != null && !options.headers.containsKey('X-Node-Id')) {
            options.headers['X-Node-Id'] = nodeId;
          }
          options.headers['X-Lang'] = I18n.lang;
          handler.next(options);
        },
        onResponse: (response, handler) {
          response.data = localizeData(response.data);
          handler.next(response);
        },
      ),
    );

    return dio;
  }

  /// Corps utile d'une réponse : le backend enveloppe dans `{ data: … }`.
  static dynamic _unwrap(Response res) {
    final data = res.data;
    if (data is Map && data.containsKey('data')) return data['data'];
    return data;
  }

  static String _message(Response? res) {
    final data = res?.data;
    if (data is Map && data['message'] is String) return data['message'] as String;
    return t('Erreur réseau');
  }

  static Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) async {
    Response res;
    try {
      res = await _dio.request(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, headers: headers),
      );
    } on DioException catch (e) {
      throw ApiError(t('Erreur réseau'), e.response?.statusCode ?? 0);
    }
    if (res.statusCode == null || res.statusCode! >= 400) {
      throw ApiError(_message(res), res.statusCode ?? 500);
    }
    return _unwrap(res);
  }

  static Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);

  /// Réponse complète, enveloppe comprise : nécessaire quand la pagination est
  /// posée à côté de `data` (listes d'articles).
  static Future<Map<String, dynamic>> envelope(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    Response res;
    try {
      res = await _dio.get(path, queryParameters: query);
    } on DioException catch (e) {
      throw ApiError(t('Erreur réseau'), e.response?.statusCode ?? 0);
    }
    if (res.statusCode == null || res.statusCode! >= 400) {
      throw ApiError(_message(res), res.statusCode ?? 500);
    }
    return asMap(res.data);
  }

  static Future<dynamic> post(String path, {Object? body}) =>
      _send('POST', path, body: body);

  static Future<dynamic> put(String path, {Object? body}) =>
      _send('PUT', path, body: body);

  static Future<dynamic> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  static Future<dynamic> delete(String path, {Object? body}) =>
      _send('DELETE', path, body: body);

  /// Liste typée : le backend renvoie soit un tableau, soit `{ items: [...] }`.
  static List<Map<String, dynamic>> asList(dynamic data, [String key = 'items']) {
    final raw = data is Map ? (data[key] ?? data['rows'] ?? data['data']) : data;
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
  }

  static Map<String, dynamic> asMap(dynamic data) =>
      data is Map ? data.cast<String, dynamic>() : <String, dynamic>{};
}
