class PickerModel {
  final String  id;
  final String  name;
  final String  phoneCountry;
  final String  phoneNumber;
  final String  nodeId;
  final bool    isActive;
  final String  token;

  const PickerModel({
    required this.id,
    required this.name,
    required this.phoneCountry,
    required this.phoneNumber,
    required this.nodeId,
    required this.isActive,
    required this.token,
  });

  factory PickerModel.fromJson(Map<String, dynamic> json, String token) {
    final picker = json['picker'] ?? json;
    return PickerModel(
      id:           picker['id']?.toString()            ?? '',
      name:         picker['name']?.toString()          ?? '',
      phoneCountry: picker['phone_country']?.toString() ?? '+212',
      phoneNumber:  picker['phone_number']?.toString()  ?? '',
      nodeId:       picker['node_id']?.toString()       ?? json['node_id']?.toString() ?? '',
      isActive:     picker['is_active'] as bool?        ?? true,
      token:        token,
    );
  }

  String get displayPhone   => '$phoneCountry $phoneNumber';
  String get initials       => name.isNotEmpty ? name.substring(0, 1).toUpperCase() : 'P';
}
