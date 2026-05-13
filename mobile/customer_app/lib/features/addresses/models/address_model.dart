class AddressModel {
  final String  id;
  final String? label;
  final String? streetNumber;
  final String  streetName;
  final String? quartier;
  final String  city;
  final String? cityId;
  final String? postalCode;

  final String? lat;
  final String? lng;
  final String? deliveryNotes;
  final bool    isDefault;
  final DateTime? createdAt;

  const AddressModel({
    required this.id,
    this.label,
    this.streetNumber,
    required this.streetName,
    this.quartier,
    required this.city,
    this.cityId,
    this.postalCode,

    this.lat,
    this.lng,
    this.deliveryNotes,
    required this.isDefault,
    this.createdAt,
  });

  factory AddressModel.fromJson(Map<String, dynamic> j) => AddressModel(
    id:            j['id']?.toString()             ?? '',
    label:         j['label']?.toString(),
    streetNumber:  j['street_number']?.toString(),
    streetName:    j['street_name']?.toString()    ?? '',
    quartier:      j['quartier']?.toString(),
    city:          j['city']?.toString()           ?? '',
    cityId:        j['city_id']?.toString(),
    postalCode:    j['postal_code']?.toString(),

    lat:           j['lat']?.toString(),
    lng:           j['lng']?.toString(),
    deliveryNotes: j['delivery_notes']?.toString(),
    isDefault:     j['is_default'] as bool?        ?? false,
    createdAt: j['created_at'] != null ? DateTime.tryParse(j['created_at'].toString()) : null,
  );

  String get displayLabel => label?.isNotEmpty == true ? label! : 'Adresse';

  String get fullAddress {
    final parts = <String>[
      if (streetNumber != null && streetNumber!.isNotEmpty) streetNumber!,
      streetName,
      if (quartier != null && quartier!.isNotEmpty) quartier!,
      city,
      if (postalCode != null && postalCode!.isNotEmpty) postalCode!,
    ];
    return parts.join(', ');
  }
}
