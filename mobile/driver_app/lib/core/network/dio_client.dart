import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/auth_storage.dart';

class DioClient {
  DioClient._();
  static final DioClient instance = DioClient._();
  late final Dio _dio = _build();
  Dio get dio => _dio;
  Dio _build() {
    final d = Dio(BaseOptions(baseUrl: ApiConstants.baseUrl, connectTimeout: ApiConstants.connectTimeout, receiveTimeout: ApiConstants.receiveTimeout, headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}));
    d.interceptors.add(_AuthInterceptor());
    return d;
  }
}

class _AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions o, RequestInterceptorHandler h) async {
    final t = await AuthStorage.instance.getToken();
    if (t != null) o.headers['Authorization'] = 'Bearer $t';
    h.next(o);
  }
  @override
  void onError(DioException e, ErrorInterceptorHandler h) async {
    if (e.response?.statusCode == 401) await AuthStorage.instance.clear();
    h.next(e);
  }
}

class ApiException implements Exception {
  final String message; final int? statusCode;
  ApiException(this.message, {this.statusCode});
  factory ApiException.fromDio(DioException e) {
    final body = e.response?.data;
    final msg  = (body is Map ? body['message'] : null) ?? e.message ?? 'Erreur réseau';
    return ApiException(msg.toString(), statusCode: e.response?.statusCode);
  }
  @override String toString() => message;
}
