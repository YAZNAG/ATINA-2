class AuthResponse {
  final String  token;
  final String  profileType;
  final String  role;
  final String? nodeId;
  final List<String> permissions;
  final UserProfile user;

  const AuthResponse({
    required this.token,
    required this.profileType,
    required this.role,
    this.nodeId,
    required this.permissions,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    final userData = json['user'] ?? json['customer'] ?? {};
    return AuthResponse(
      token:       json['token'] as String,
      profileType: json['profile_type'] as String? ?? 'customer',
      role:        json['role'] as String? ?? '',
      nodeId:      json['node_id'] as String?,
      permissions: (json['permissions'] as List<dynamic>?)?.cast<String>() ?? [],
      user:        UserProfile.fromJson(userData as Map<String, dynamic>),
    );
  }
}

class UserProfile {
  final String  id;
  final String  name;
  final String  phoneCountry;
  final String  phoneNumber;
  final String? email;
  final double  walletBalance;
  final int     pointsBalance;
  final String  preferredLang;

  const UserProfile({
    required this.id,
    required this.name,
    required this.phoneCountry,
    required this.phoneNumber,
    this.email,
    this.walletBalance = 0.0,
    this.pointsBalance = 0,
    this.preferredLang = 'fr',
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
    id:             json['id']?.toString()            ?? '',
    name:           json['name']?.toString()          ?? json['full_name']?.toString() ?? '',
    phoneCountry:   json['phone_country']?.toString() ?? '+212',
    phoneNumber:    json['phone_number']?.toString()  ?? '',
    email:          json['email']?.toString(),
    walletBalance:  double.tryParse(json['wallet_balance']?.toString() ?? '0') ?? 0,
    pointsBalance:  int.tryParse(json['points_balance']?.toString() ?? '0') ?? 0,
    preferredLang:  json['preferred_lang']?.toString() ?? 'fr',
  );

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'phone_country': phoneCountry,
    'phone_number': phoneNumber, 'email': email,
    'wallet_balance': walletBalance, 'points_balance': pointsBalance,
    'preferred_lang': preferredLang,
  };

  String get displayPhone => '$phoneCountry $phoneNumber';
  String get initials => name.isNotEmpty ? name.substring(0, 1).toUpperCase() : '?';
}
