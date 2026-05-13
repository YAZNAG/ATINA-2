// ── Customer profile ───────────────────────────────────────────────────────────
class CustomerProfile {
  final String  id;
  final String  name;
  final String  phoneCountry;
  final String  phoneNumber;
  final String? email;
  final String? customerId;
  final String? customerName;
  final String? referralCode;
  final double  walletBalance;
  final int     pointsBalance;

  const CustomerProfile({
    required this.id,
    required this.name,
    required this.phoneCountry,
    required this.phoneNumber,
    this.email,
    this.customerId,
    this.customerName,
    this.referralCode,
    this.walletBalance = 0,
    this.pointsBalance = 0,
  });

  factory CustomerProfile.fromAuthJson(Map<String, dynamic> j) {
    final user     = j['user']     as Map<String, dynamic>? ?? {};
    final customer = j['customer'] as Map<String, dynamic>?;
    return CustomerProfile(
      id:           user['id']?.toString()            ?? '',
      name:         user['name']?.toString()          ?? 'Client',
      phoneCountry: user['phone_country']?.toString() ?? '+212',
      phoneNumber:  user['phone_number']?.toString()  ?? '',
      email:        user['email']?.toString(),
      customerId:   customer?['id']?.toString(),
      customerName: customer?['name']?.toString(),
    );
  }

  factory CustomerProfile.fromMeJson(Map<String, dynamic> j) {
    final customer = j['customer'] as Map<String, dynamic>?;
    return CustomerProfile(
      id:           j['id']?.toString()            ?? '',
      name:         j['name']?.toString()          ?? 'Client',
      phoneCountry: j['phone_country']?.toString() ?? '+212',
      phoneNumber:  j['phone_number']?.toString()  ?? '',
      email:        j['email']?.toString(),
      customerId:   customer?['id']?.toString(),
      customerName: customer?['name']?.toString(),
      referralCode: customer?['referral_code']?.toString(),
      walletBalance: double.tryParse(customer?['wallet_balance']?.toString() ?? '0') ?? 0,
      pointsBalance: int.tryParse(customer?['points_balance']?.toString() ?? '0') ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id, 'name': name, 'phone_country': phoneCountry,
    'phone_number': phoneNumber, 'email': email,
    'customer_id': customerId, 'customer_name': customerName,
    'referral_code': referralCode,
    'wallet_balance': walletBalance, 'points_balance': pointsBalance,
  };

  String get displayPhone => '$phoneCountry $phoneNumber';
  String get initials => name.isNotEmpty ? name[0].toUpperCase() : '?';
  String get displayName => customerName ?? name;
}

// ── Login/register API response ────────────────────────────────────────────────
class CustomerAuthResult {
  final String          token;
  final CustomerProfile profile;
  final bool            isNew;

  const CustomerAuthResult({
    required this.token,
    required this.profile,
    required this.isNew,
  });

  factory CustomerAuthResult.fromJson(Map<String, dynamic> j) {
    final user = j['user'] as Map<String, dynamic>? ?? {};
    return CustomerAuthResult(
      token:   j['token']?.toString()           ?? '',
      profile: CustomerProfile.fromAuthJson(j),
      isNew:   user['is_new'] as bool?          ?? false,
    );
  }
}

// ── OTP request response ───────────────────────────────────────────────────────
class OtpRequestResponse {
  final String message;
  final bool   isNew;
  final String phoneCountry;
  final String phoneNumber;

  const OtpRequestResponse({
    required this.message,
    required this.isNew,
    required this.phoneCountry,
    required this.phoneNumber,
  });

  factory OtpRequestResponse.fromJson(Map<String, dynamic> j) => OtpRequestResponse(
    message:      j['message']?.toString()      ?? '',
    isNew:        j['is_new']  as bool?         ?? true,
    phoneCountry: j['phone_country']?.toString() ?? '+212',
    phoneNumber:  j['phone_number']?.toString()  ?? '',
  );
}

// Legacy alias kept for existing imports
typedef OtpVerifyResponse = CustomerAuthResult;
