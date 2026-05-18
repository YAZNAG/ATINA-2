class StopStatusModel {
  final String code, nameFr;
  const StopStatusModel({required this.code, required this.nameFr});
  factory StopStatusModel.fromJson(Map<String, dynamic> j) =>
      StopStatusModel(code: j['code']?.toString() ?? '', nameFr: j['name_fr']?.toString() ?? '');
}

class StopOrderModel {
  final String id;
  final String statusCode, statusNameFr, statusColor;
  final String customerName, customerPhone, customerPhoneCountry;
  final double totalTtc;
  final String? paymentMethodCode, paymentMethodName, paymentStatusCode;
  final String? addressStreet, addressCity, addressPostal;
  final double? lat, lng;
  final List<StopOrderItemModel> items;

  const StopOrderModel({
    required this.id, required this.statusCode, required this.statusNameFr, required this.statusColor,
    required this.customerName, required this.customerPhone, required this.customerPhoneCountry,
    required this.totalTtc, this.paymentMethodCode, this.paymentMethodName, this.paymentStatusCode,
    this.addressStreet, this.addressCity, this.addressPostal, this.lat, this.lng,
    this.items = const [],
  });

  factory StopOrderModel.fromJson(Map<String, dynamic> j) {
    final status  = j['status']   as Map<String, dynamic>? ?? {};
    final customer= j['customer'] as Map<String, dynamic>? ?? {};
    final address = j['address']  as Map<String, dynamic>?;
    final payments= (j['payments'] as List<dynamic>? ?? []);
    final payment = payments.isNotEmpty ? payments.first as Map<String, dynamic> : null;
    final pm      = payment?['payment_method'] as Map<String, dynamic>?;
    final ps      = payment?['status'] as Map<String, dynamic>?;
    final items   = (j['items'] as List<dynamic>? ?? [])
        .map((e) => StopOrderItemModel.fromJson(e as Map<String, dynamic>)).toList();

    return StopOrderModel(
      id:                   j['id']?.toString() ?? '',
      statusCode:           status['code']?.toString()    ?? '',
      statusNameFr:         status['name_fr']?.toString() ?? '',
      statusColor:          status['color']?.toString()   ?? '#9CA3AF',
      customerName:         customer['name']?.toString()          ?? '',
      customerPhone:        customer['phone_number']?.toString()   ?? '',
      customerPhoneCountry: customer['phone_country']?.toString()  ?? '+212',
      totalTtc:             double.tryParse(j['total_ttc']?.toString() ?? '0') ?? 0,
      paymentMethodCode:    pm?['code']?.toString(),
      paymentMethodName:    pm?['name_fr']?.toString(),
      paymentStatusCode:    ps?['code']?.toString(),
      addressStreet: address != null
          ? [address['street_number'], address['street_name']].where((v) => v != null && v.toString().isNotEmpty).join(' ')
          : null,
      addressCity:   address?['city']?.toString(),
      addressPostal: address?['postal_code']?.toString(),
      lat: address?['lat'] != null ? double.tryParse(address!['lat'].toString()) : null,
      lng: address?['lng'] != null ? double.tryParse(address!['lng'].toString()) : null,
      items: items,
    );
  }

  bool get isCOD          => paymentMethodCode == 'cod';
  bool get isCODCollected  => paymentStatusCode == 'collected';
  String get displayPhone  => '$customerPhoneCountry $customerPhone';
  String get displayAddress => [addressStreet, addressCity, addressPostal].whereType<String>().where((v) => v.trim().isNotEmpty).join(', ');
}

class StopOrderItemModel {
  final String nameFr, skuCode;
  final double qty, price;
  const StopOrderItemModel({required this.nameFr, required this.skuCode, required this.qty, required this.price});
  factory StopOrderItemModel.fromJson(Map<String, dynamic> j) {
    final sku     = j['sku']     as Map<String, dynamic>?;
    final article = sku?['article'] as Map<String, dynamic>?;
    return StopOrderItemModel(
      nameFr:  article?['name_fr']?.toString()   ?? j['name_fr']?.toString() ?? 'Article',
      skuCode: article?['sku_code']?.toString()  ?? '',
      qty:     double.tryParse(j['qty']?.toString() ?? '1') ?? 1,
      price:   double.tryParse(j['unit_price_sold']?.toString() ?? '0') ?? 0,
    );
  }
}

class TourStopModel {
  final String          id;
  final int             sortOrder;
  final StopStatusModel status;
  final StopOrderModel? order;
  final DateTime?       deliveredAt;
  final String?         failureReason, driverNotes;
  final bool            codCollected;
  final double?         amountCollected;

  const TourStopModel({
    required this.id, required this.sortOrder, required this.status,
    this.order, this.deliveredAt, this.failureReason, this.driverNotes,
    this.codCollected = false, this.amountCollected,
  });

  factory TourStopModel.fromJson(Map<String, dynamic> j) {
    final statusData = j['status'] as Map<String, dynamic>? ?? {};
    final orderData  = j['order']  as Map<String, dynamic>?;
    return TourStopModel(
      id:              j['id']?.toString() ?? '',
      sortOrder:       (j['sort_order'] as int?) ?? 0,
      status:          StopStatusModel.fromJson(statusData),
      order:           orderData != null ? StopOrderModel.fromJson(orderData) : null,
      deliveredAt:     j['delivered_at'] != null ? DateTime.tryParse(j['delivered_at'].toString()) : null,
      failureReason:   j['failure_reason']?.toString(),
      driverNotes:     j['driver_notes']?.toString(),
      codCollected:    j['cod_collected'] as bool? ?? false,
      amountCollected: j['amount_collected'] != null ? double.tryParse(j['amount_collected'].toString()) : null,
    );
  }

  bool get isPending   => status.code == 'pending';
  bool get isArrived   => status.code == 'arrived';
  bool get isDelivered => status.code == 'delivered';
  bool get isFailed    => status.code == 'failed';
  bool get isDone      => isDelivered || isFailed || status.code == 'skipped';
}
