class PickupNodeModel {
  final String id;
  final String nameFr;
  final String? nameAr;
  final String? address;
  final String? city;
  final double? lat;
  final double? lng;
  final double? distance;
  final bool acceptsPickup;
  final bool isActive;

  const PickupNodeModel({
    required this.id,
    required this.nameFr,
    this.nameAr,
    this.address,
    this.city,
    this.lat,
    this.lng,
    this.distance,
    required this.acceptsPickup,
    required this.isActive,
  });

  factory PickupNodeModel.fromJson(Map<String, dynamic> j) => PickupNodeModel(
    id:           j['id']?.toString() ?? '',
    nameFr:       j['name_fr']?.toString() ?? '',
    nameAr:       j['name_ar']?.toString(),
    address:      j['address']?.toString(),
    city:         j['city']?.toString(),
    lat:          double.tryParse(j['lat']?.toString() ?? ''),
    lng:          double.tryParse(j['lng']?.toString() ?? ''),
    distance:     double.tryParse(j['distance']?.toString() ?? ''),
    acceptsPickup: j['accepts_pickup'] as bool? ?? true,
    isActive:     j['is_active'] as bool? ?? true,
  );
}
