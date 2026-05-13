class DeliverySlotModel {
  final String id;
  final String nameFr;
  final String? nameAr;
  final String startTime;
  final String endTime;
  final int dayOfWeek;
  final bool isActive;
  final int? maxOrders;
  final int? currentOrders;
  final int? remainingCapacity;

  const DeliverySlotModel({
    required this.id,
    required this.nameFr,
    this.nameAr,
    required this.startTime,
    required this.endTime,
    required this.dayOfWeek,
    required this.isActive,
    this.maxOrders,
    this.currentOrders,
    this.remainingCapacity,
  });

  int get availableSpaces {
    if (remainingCapacity != null) return remainingCapacity!;
    if (maxOrders != null && currentOrders != null) return maxOrders! - currentOrders!;
    return -1;
  }

  bool get hasCapacity => availableSpaces == -1 || availableSpaces > 0;

  factory DeliverySlotModel.fromJson(Map<String, dynamic> j) => DeliverySlotModel(
    id:              j['id']?.toString() ?? '',
    nameFr:          j['name_fr']?.toString() ?? '',
    nameAr:          j['name_ar']?.toString(),
    startTime:       j['start_time']?.toString() ?? '',
    endTime:         j['end_time']?.toString() ?? '',
    dayOfWeek:       (j['day_of_week'] as int?) ?? 0,
    isActive:        j['is_active'] as bool? ?? true,
    maxOrders:       (j['max_orders'] as int?),
    currentOrders:   (j['current_orders'] as int?),
    remainingCapacity: (j['remaining_capacity'] as int?),
  );
}
