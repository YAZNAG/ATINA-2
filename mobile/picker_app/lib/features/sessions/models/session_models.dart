// ── Status helper models ───────────────────────────────────────────────────────
class StatusModel {
  final String code, nameFr;
  const StatusModel({required this.code, required this.nameFr});
  factory StatusModel.fromJson(Map<String, dynamic> j) =>
      StatusModel(code: j['code']?.toString() ?? '', nameFr: j['name_fr']?.toString() ?? '');
}

// ── Order (inside a session) ───────────────────────────────────────────────────
class SessionOrderModel {
  final String   id;
  final double   totalTtc;
  final String?  customerName, customerPhone;
  final String?  slotStart, slotEnd;
  final DateTime createdAt;

  const SessionOrderModel({
    required this.id, required this.totalTtc,
    this.customerName, this.customerPhone,
    this.slotStart, this.slotEnd, required this.createdAt,
  });

  factory SessionOrderModel.fromJson(Map<String, dynamic> j) {
    final customer = j['customer'] as Map<String, dynamic>? ?? {};
    final slot     = j['confirmed_slot'] as Map<String, dynamic>?;
    final slotS    = slot?['slot_start']?.toString();
    final slotE    = slot?['slot_end']?.toString();

    // Extract HH:MM from time string
    String? fmtTime(String? t) {
      if (t == null) return null;
      final m = t.contains('T') ? t.split('T').last.substring(0, 5) : t.substring(0, 5);
      return m.length >= 5 ? m : t;
    }

    return SessionOrderModel(
      id:           j['id']?.toString() ?? '',
      totalTtc:     double.tryParse(j['total_ttc']?.toString() ?? '0') ?? 0,
      customerName: customer['name']?.toString(),
      customerPhone:'${customer['phone_country'] ?? ''} ${customer['phone_number'] ?? ''}'.trim(),
      slotStart:    fmtTime(slotS),
      slotEnd:      fmtTime(slotE),
      createdAt:    DateTime.tryParse(j['created_at']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

// ── Picking Item ───────────────────────────────────────────────────────────────
class PickingItemModel {
  final String  id;
  final String  orderItemId;
  final StatusModel status;
  final double  qtyExpected, qtyPicked;
  final String? scannedEan;
  final String? nameFr, ean13, skuCode;
  final String? locationLabel, locationAisle, locationShelf;
  final DateTime? pickedAt;

  const PickingItemModel({
    required this.id, required this.orderItemId, required this.status,
    required this.qtyExpected, required this.qtyPicked,
    this.scannedEan, this.nameFr, this.ean13, this.skuCode,
    this.locationLabel, this.locationAisle, this.locationShelf,
    this.pickedAt,
  });

  factory PickingItemModel.fromJson(Map<String, dynamic> j) {
    final s        = j['status']     as Map<String, dynamic>? ?? {};
    final orderItem = j['order_item'] as Map<String, dynamic>?;
    final sku      = orderItem?['sku'] as Map<String, dynamic>?;
    final article  = sku?['article']  as Map<String, dynamic>?;
    final location = j['location']   as Map<String, dynamic>?;

    return PickingItemModel(
      id:            j['id']?.toString() ?? '',
      orderItemId:   j['order_item_id']?.toString() ?? '',
      status:        StatusModel.fromJson(s),
      qtyExpected:   double.tryParse(j['qty_expected']?.toString() ?? '1') ?? 1,
      qtyPicked:     double.tryParse(j['qty_picked']?.toString() ?? '0') ?? 0,
      scannedEan:    j['scanned_ean']?.toString(),
      nameFr:        article?['name_fr']?.toString(),
      ean13:         article?['ean13']?.toString(),
      skuCode:       article?['sku_code']?.toString(),
      locationLabel: location?['label']?.toString(),
      locationAisle: location?['aisle']?.toString(),
      locationShelf: location?['shelf']?.toString(),
      pickedAt:      j['picked_at'] != null ? DateTime.tryParse(j['picked_at'].toString()) : null,
    );
  }

  bool get isPending    => status.code == 'pending';
  bool get isPicked     => status.code == 'picked';
  bool get isSubstituted=> status.code == 'substituted';
  bool get isOutOfStock => status.code == 'out_of_stock';
  bool get isDone       => !isPending;
}

// ── Picking Session ────────────────────────────────────────────────────────────
class PickingSessionModel {
  final String             id;
  final String             orderId;
  final StatusModel        status;
  final int                errorCount;
  final DateTime?          startedAt, completedAt;
  final SessionOrderModel? order;
  final List<PickingItemModel> items;

  const PickingSessionModel({
    required this.id, required this.orderId, required this.status,
    required this.errorCount, this.startedAt, this.completedAt,
    this.order, this.items = const [],
  });

  factory PickingSessionModel.fromJson(Map<String, dynamic> j) {
    final s         = j['status'] as Map<String, dynamic>? ?? {};
    final orderData = j['order']  as Map<String, dynamic>?;
    final itemsData = (j['items'] as List<dynamic>? ?? [])
        .map((e) => PickingItemModel.fromJson(e as Map<String, dynamic>)).toList();

    itemsData.sort((a, b) => a.isPending == b.isPending ? 0 : (a.isPending ? -1 : 1));

    return PickingSessionModel(
      id:          j['id']?.toString() ?? '',
      orderId:     j['order_id']?.toString() ?? orderData?['id']?.toString() ?? '',
      status:      StatusModel.fromJson(s),
      errorCount:  (j['error_count'] as int?) ?? 0,
      startedAt:   j['started_at'] != null ? DateTime.tryParse(j['started_at'].toString()) : null,
      completedAt: j['completed_at'] != null ? DateTime.tryParse(j['completed_at'].toString()) : null,
      order:       orderData != null ? SessionOrderModel.fromJson(orderData) : null,
      items:       itemsData,
    );
  }

  bool get isOpen        => status.code == 'open';
  bool get isInProgress  => status.code == 'in_progress';
  bool get isCompleted   => status.code == 'completed';
  int get doneCount      => items.where((i) => i.isDone).length;
  int get pendingCount   => items.where((i) => i.isPending).length;
  bool get allDone       => pendingCount == 0 && items.isNotEmpty;
}

// ── Available Order (list item) ───────────────────────────────────────────────
class AvailableOrderModel {
  final String   id;
  final String?  customerName, customerPhone;
  final double   totalTtc;
  final int      itemCount;
  final DateTime createdAt;
  final String?  slotStart, slotEnd;

  const AvailableOrderModel({
    required this.id, this.customerName, this.customerPhone,
    required this.totalTtc, required this.itemCount,
    required this.createdAt, this.slotStart, this.slotEnd,
  });

  factory AvailableOrderModel.fromJson(Map<String, dynamic> j) {
    final customer = j['customer']       as Map<String, dynamic>? ?? {};
    final slot     = j['confirmed_slot'] as Map<String, dynamic>?;
    final count    = j['_count']         as Map<String, dynamic>?;
    final items    = j['items']          as List<dynamic>?;
    String? fmtTime(String? t) {
      if (t == null) return null;
      final s = t.contains('T') ? t.split('T').last : t;
      return s.length >= 5 ? s.substring(0, 5) : s;
    }
    return AvailableOrderModel(
      id:           j['id']?.toString() ?? '',
      customerName: customer['name']?.toString(),
      customerPhone:'${customer['phone_country'] ?? ''} ${customer['phone_number'] ?? ''}'.trim(),
      totalTtc:     double.tryParse(j['total_ttc']?.toString() ?? '0') ?? 0,
      itemCount:    (count?['items'] as int?) ?? (items?.length ?? 0),
      createdAt:    DateTime.tryParse(j['created_at']?.toString() ?? '') ?? DateTime.now(),
      slotStart:    fmtTime(slot?['slot_start']?.toString()),
      slotEnd:      fmtTime(slot?['slot_end']?.toString()),
    );
  }
}
