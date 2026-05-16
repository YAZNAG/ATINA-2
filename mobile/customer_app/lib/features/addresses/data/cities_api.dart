import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';
import '../models/city_model.dart';

class CitiesApi {
  CitiesApi._();
  static final CitiesApi instance = CitiesApi._();
  final Dio _dio = DioClient.instance.dio;

  Future<List<CityModel>> getAllCities() async {
    try {
      final res = await _dio.get(ApiConstants.cities);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => CityModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}

