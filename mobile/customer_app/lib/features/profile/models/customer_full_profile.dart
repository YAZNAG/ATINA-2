class CustomerFullProfile {
  final String  id;
  final String  name;
  final String  phoneCountry;
  final String  phoneNumber;
  final String? email;
  final String  preferredLang;
  final String? city;
  final String? lat;
  final String? lng;
  final double  walletBalance;
  final int     pointsBalance;
  final int     pointsLifetime;
  final String? referralCode;
  final bool    isActive;
  final bool    phoneVerified;
  final int     addressCount;
  final DateTime? createdAt;

  const CustomerFullProfile({
    required this.id,
    required this.name,
    required this.phoneCountry,
    required this.phoneNumber,
    this.email,
    required this.preferredLang,
    this.city,
    this.lat,
    this.lng,
    required this.walletBalance,
    required this.pointsBalance,
    required this.pointsLifetime,
    this.referralCode,
    required this.isActive,
    required this.phoneVerified,
    required this.addressCount,
    this.createdAt,
  });

  factory CustomerFullProfile.fromJson(Map<String, dynamic> j) => CustomerFullProfile(
    id:             j['id']?.toString()            ?? '',
    name:           j['name']?.toString()          ?? '',
    phoneCountry:   j['phone_country']?.toString() ?? '+212',
    phoneNumber:    j['phone_number']?.toString()  ?? '',
    email:          j['email']?.toString(),
    preferredLang:  j['preferred_lang']?.toString() ?? 'fr',
    city:           j['city']?.toString(),
    lat:            j['lat']?.toString(),
    lng:            j['lng']?.toString(),
    walletBalance:  double.tryParse(j['wallet_balance']?.toString() ?? '0') ?? 0,
    pointsBalance:  int.tryParse(j['points_balance']?.toString() ?? '0') ?? 0,
    pointsLifetime: int.tryParse(j['points_lifetime']?.toString() ?? '0') ?? 0,
    referralCode:   j['referral_code']?.toString(),
    isActive:       j['is_active'] as bool? ?? true,
    phoneVerified:  j['phone_verified'] as bool? ?? false,
    addressCount:   j['address_count'] as int? ?? 0,
    createdAt: j['created_at'] != null ? DateTime.tryParse(j['created_at'].toString()) : null,
  );

  String get displayPhone => '$phoneCountry $phoneNumber';
  String get initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
  String get langLabel => preferredLang == 'ar' ? 'العربية' : 'Français';
}
