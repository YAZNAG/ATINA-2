import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';
import '../models/customer_full_profile.dart';
import '../../addresses/models/address_model.dart';

class ProfileApi {
  ProfileApi._();
  static final ProfileApi instance = ProfileApi._();
  final Dio _dio = DioClient.instance.dio;

  Future<CustomerFullProfile> getProfile() async {
    try {
      final res = await _dio.get(ApiConstants.customerMeProfile);
      return CustomerFullProfile.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<CustomerFullProfile> updateProfile({
    String? name,
    String? preferredLang,
    String? city,
  }) async {
    try {
      final res = await _dio.put(ApiConstants.customerMeProfile, data: {
        if (name != null)          'name':           name,
        if (preferredLang != null) 'preferred_lang': preferredLang,
        if (city != null)          'city':           city,
      });
      return CustomerFullProfile.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<List<AddressModel>> getAddresses() async {
    try {
      final res  = await _dio.get(ApiConstants.customerMeAddresses);
      final list = res.data['data'] as List<dynamic>? ?? [];
      return list.map((e) => AddressModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<AddressModel> createAddress(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post(ApiConstants.customerMeAddresses, data: body);
      return AddressModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<AddressModel> updateAddress(String id, Map<String, dynamic> body) async {
    try {
      final res = await _dio.put('${ApiConstants.customerMeAddresses}/$id', data: body);
      return AddressModel.fromJson(res.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<void> setDefaultAddress(String id) async {
    try {
      await _dio.patch('${ApiConstants.customerMeAddresses}/$id/set-default');
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }

  Future<void> deleteAddress(String id) async {
    try {
      await _dio.delete('${ApiConstants.customerMeAddresses}/$id');
    } on DioException catch (e) { throw ApiException.fromDio(e); }
  }
}
