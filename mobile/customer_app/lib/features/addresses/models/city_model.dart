class CityModel {
  final String id;
  final String nameFr;
  final String? nameAr;
  final String postalCode;

  const CityModel({
    required this.id,
    required this.nameFr,
    this.nameAr,
    required this.postalCode,
  });

  factory CityModel.fromJson(Map<String, dynamic> j) {
    return CityModel(
      id: j['id']?.toString() ?? '',
      nameFr: (j['name_fr']?.toString() ?? '').trim(),
      nameAr: j['name_ar']?.toString(),
      postalCode: (j['postal_code']?.toString() ?? '').trim(),
    );
  }
}

