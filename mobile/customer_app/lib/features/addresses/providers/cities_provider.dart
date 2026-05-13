import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/cities_api.dart';
import '../models/city_model.dart';

final citiesProvider = FutureProvider<List<CityModel>>((ref) async {
  return CitiesApi.instance.getAllCities();
});

