class OtpRequestResponse {
  final String  message;
  final bool    isNew;
  final String  phoneCountry;
  final String  phoneNumber;

  const OtpRequestResponse({
    required this.message,
    required this.isNew,
    required this.phoneCountry,
    required this.phoneNumber,
  });

  factory OtpRequestResponse.fromJson(Map<String, dynamic> j) => OtpRequestResponse(
    message:      j['message']?.toString()       ?? '',
    isNew:        j['is_new']  as bool?           ?? true,
    phoneCountry: j['phone_country']?.toString()  ?? '+212',
    phoneNumber:  j['phone_number']?.toString()   ?? '',
  );
}

class OtpVerifyResponse {
  final String  token;
  final int     userId;
  final String  phoneCountry;
  final String  phoneNumber;
  final String? customerId;
  final String? customerName;
  final bool    isNew;

  const OtpVerifyResponse({
    required this.token,
    required this.userId,
    required this.phoneCountry,
    required this.phoneNumber,
    this.customerId,
    this.customerName,
    required this.isNew,
  });

  factory OtpVerifyResponse.fromJson(Map<String, dynamic> j) {
    final user     = j['user']     as Map<String, dynamic>? ?? {};
    final customer = j['customer'] as Map<String, dynamic>?;
    return OtpVerifyResponse(
      token:        j['token']?.toString()                    ?? '',
      userId:       int.tryParse(user['id']?.toString() ?? '0') ?? 0,
      phoneCountry: user['phone_country']?.toString()         ?? '+212',
      phoneNumber:  user['phone_number']?.toString()          ?? '',
      customerId:   customer?['id']?.toString(),
      customerName: customer?['name']?.toString(),
      isNew:        user['is_new'] as bool? ?? true,
    );
  }
}
