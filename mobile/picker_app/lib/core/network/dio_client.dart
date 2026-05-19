import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/auth_storage.dart';

class DioClient {
  DioClient._();
  static final DioClient instance = DioClient._();
  late final Dio _dio = _build();
  Dio get dio => _dio;

  Dio _build() {
    final d = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.connectTimeout,
      receiveTimeout: ApiConstants.receiveTimeout,
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    ));
    d.interceptors.add(_AuthInterceptor());
    return d;
  }
}

class _AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions o, RequestInterceptorHandler h) async {
    final t = await AuthStorage.instance.getToken();
    if (t != null && t.isNotEmpty) {
      o.headers['Authorization'] = 'Bearer $t';
      // ignore: avoid_print
      // print('[DioClient] → ${o.method} ${o.path} (with token)');
    } else {
      // ignore: avoid_print
      // print('[DioClient] → ${o.method} ${o.path} (NO token)');
    }
    h.next(o);
  }

  @override
  void onResponse(Response r, ResponseInterceptorHandler h) {
    // ignore: avoid_print
    print('[DioClient] ← ${r.statusCode} ${r.requestOptions.path}');
    h.next(r);
  }

  @override
  void onError(DioException e, ErrorInterceptorHandler h) async {
    final code = e.response?.statusCode;
    // ignore: avoid_print
    print('[DioClient] ✗ $code ${e.requestOptions.path} — ${e.response?.data?['message'] ?? e.message}');

    if (code == 401) {
      // Token invalide ou expiré → vider storage → le stream notifie authProvider
      await AuthStorage.instance.clear();
    }
    h.next(e);
  }
}

class ApiException implements Exception {
  final String message;
  final int?   statusCode;
  ApiException(this.message, {this.statusCode});
  factory ApiException.fromDio(DioException e) {
    final code = e.response?.statusCode;
    final body = e.response?.data;
    final msg  = (body is Map ? body['message'] : null) ?? e.message ?? 'Erreur réseau';
    return ApiException(msg.toString(), statusCode: code);
  }
  @override String toString() => message;
}
