import 'order_status_model.dart';
import 'order_item_model.dart';

class OrderModel {
  final String            id;
  final String            reference;
  final DateTime          createdAt;
  final String            deliveryType;
  final String?           nodeName;
  final double            totalTtc;
  final String            paymentStatus;
  final int               itemCount;
  final String?           notes;
  final OrderStatusModel  status;
  final List<OrderItemModel> items;
  final String?           addressLabel;
  final String?           addressFull;
  final String?           slotName;
  final String?           slotDate;
  final double?           walletUsed;
  final int?              pointsGained;
  final String?           paymentMethodName;
  final List<OrderTimelineEntry>? timeline;

  const OrderModel({
    required this.id,
    required this.reference,
    required this.createdAt,
    required this.deliveryType,
    this.nodeName,
    required this.totalTtc,
    required this.paymentStatus,
    required this.itemCount,
    this.notes,
    required this.status,
    this.items = const [],
    this.addressLabel,
    this.addressFull,
    this.slotName,
    this.slotDate,
    this.walletUsed,
    this.pointsGained,
    this.paymentMethodName,
    this.timeline,
  });

  factory OrderModel.fromJson(Map<String, dynamic> j) {
    final statusData = j['status'] as Map<String, dynamic>? ?? j['order_status'] as Map<String, dynamic>?;
    final itemsData  = j['items'] as List<dynamic>? ?? [];
    final timelineData = j['timeline'] as List<dynamic>? ?? [];

    return OrderModel(
      id:         j['id']?.toString() ?? '',
      reference:  j['reference']?.toString() ?? j['ref']?.toString() ?? '',
      createdAt:  DateTime.tryParse(j['created_at']?.toString() ?? '') ?? DateTime.now(),
      deliveryType: j['delivery_type']?.toString() ?? 'home',
      nodeName:   j['node_name']?.toString() ?? j['node']?['name_fr']?.toString(),
      totalTtc:   double.tryParse(j['total_ttc']?.toString() ?? '0') ?? 0,
      paymentStatus: j['payment_status']?.toString() ?? 'pending',
      itemCount:  (j['item_count'] as int?) ?? itemsData.length,
      notes:      j['notes']?.toString(),
      status:     statusData != null ? OrderStatusModel.fromJson(statusData) : OrderStatusModel(code: 'pending', nameFr: 'En attente', color: '#6B7280'),
      items:      itemsData.map((e) => OrderItemModel.fromJson(e as Map<String, dynamic>)).toList(),
      addressLabel: j['address_label']?.toString(),
      addressFull: j['address_full']?.toString(),
      slotName:   j['slot_name']?.toString(),
      slotDate:   j['slot_date']?.toString(),
      walletUsed: double.tryParse(j['wallet_used']?.toString() ?? ''),
      pointsGained: int.tryParse(j['points_gained']?.toString() ?? ''),
      paymentMethodName: j['payment_method_name']?.toString(),
      timeline:   timelineData.map((e) => OrderTimelineEntry.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}

class OrderTimelineEntry {
  final String statusCode;
  final String statusName;
  final String? statusColor;
  final DateTime createdAt;
  final String? note;

  const OrderTimelineEntry({
    required this.statusCode,
    required this.statusName,
    this.statusColor,
    required this.createdAt,
    this.note,
  });

  factory OrderTimelineEntry.fromJson(Map<String, dynamic> j) => OrderTimelineEntry(
    statusCode:  j['status']?.toString() ?? j['status_code']?.toString() ?? '',
    statusName:  j['name_fr']?.toString() ?? j['status_name']?.toString() ?? '',
    statusColor: j['color']?.toString(),
    createdAt:   DateTime.tryParse(j['created_at']?.toString() ?? '') ?? DateTime.now(),
    note:        j['note']?.toString(),
  );
}
