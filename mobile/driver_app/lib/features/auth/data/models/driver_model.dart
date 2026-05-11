class DriverModel {
  final String  id, name, phoneCountry, phoneNumber, nodeId;
  final String? vehicleType, vehiclePlate;
  final bool    isActive;
  final String  token;

  const DriverModel({required this.id, required this.name, required this.phoneCountry, required this.phoneNumber, required this.nodeId, this.vehicleType, this.vehiclePlate, required this.isActive, required this.token});

  factory DriverModel.fromJson(Map<String, dynamic> json, String token) {
    final d = json['driver'] ?? json;
    return DriverModel(
      id: d['id']?.toString() ?? '', name: d['name']?.toString() ?? '',
      phoneCountry: d['phone_country']?.toString() ?? '+212', phoneNumber: d['phone_number']?.toString() ?? '',
      nodeId: d['node_id']?.toString() ?? json['node_id']?.toString() ?? '',
      vehicleType: d['vehicle_type']?.toString(), vehiclePlate: d['vehicle_plate']?.toString(),
      isActive: d['is_active'] as bool? ?? true, token: token,
    );
  }

  String get displayPhone => '$phoneCountry $phoneNumber';
  String get initials     => name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'D';
  String get vehicleEmoji => switch (vehicleType?.toLowerCase()) {
    String t when t.contains('moto')   => '🏍',
    String t when t.contains('camion') => '🚛',
    String t when t.contains('van')    => '🚐',
    String t when t.contains('vélo')   => '🚴',
    _ => '🚚',
  };
}
