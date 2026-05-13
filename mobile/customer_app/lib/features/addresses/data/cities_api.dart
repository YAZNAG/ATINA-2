import 'package:dio/dio.dart';


import '../../../core/network/dio_client.dart';
import '../models/city_model.dart';

class CitiesApi {
  CitiesApi._();
  static final CitiesApi instance = CitiesApi._();

  final Dio _dio = DioClient.instance.dio;

  /// GET /api/cities?all=true
  Future<List<CityModel>> getAllCities() async {
    final res = await _dio.get('/cities', queryParameters: {'all': true});
    // expected shape: { data: [...] }
    final list = (res.data['data'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    return list.map((e) => CityModel.fromJson(e)).toList();
  }
}

