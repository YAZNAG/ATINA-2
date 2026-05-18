import 'stop_model.dart';

class TourStatusModel {
  final String code, nameFr;
  const TourStatusModel({required this.code, required this.nameFr});
  factory TourStatusModel.fromJson(Map<String, dynamic> j) =>
      TourStatusModel(code: j['code']?.toString() ?? '', nameFr: j['name_fr']?.toString() ?? '');
}

class TourModel {
  final String           id;
  final TourStatusModel  status;
  final String?          nodeNameFr, driverName;
  final String?          date, slotStart, slotEnd, zone, notes;
  final DateTime         createdAt;
  final List<TourStopModel> stops;

  const TourModel({
    required this.id, required this.status, this.nodeNameFr, this.driverName,
    this.date, this.slotStart, this.slotEnd, this.zone, this.notes,
    required this.createdAt, this.stops = const [],
  });

  factory TourModel.fromJson(Map<String, dynamic> j) {
    final statusData = j['status'] as Map<String, dynamic>? ?? {};
    final nodeData   = j['node']   as Map<String, dynamic>?;
    final driverData = j['driver'] as Map<String, dynamic>?;
    final stopsData  = (j['stops'] as List<dynamic>? ?? [])
        .map((e) => TourStopModel.fromJson(e as Map<String, dynamic>)).toList();

    return TourModel(
      id:          j['id']?.toString() ?? '',
      status:      TourStatusModel.fromJson(statusData),
      nodeNameFr:  nodeData?['name_fr']?.toString(),
      driverName:  driverData?['name']?.toString(),
      date:        j['date']?.toString(),
      slotStart:   j['slot_start']?.toString(),
      slotEnd:     j['slot_end']?.toString(),
      zone:        j['zone']?.toString(),
      notes:       j['notes']?.toString(),
      createdAt:   DateTime.tryParse(j['created_at']?.toString() ?? '') ?? DateTime.now(),
      stops:       stopsData,
    );
  }

  bool get isPlanned    => status.code == 'planned';
  bool get isInProgress => status.code == 'in_progress';
  bool get isCompleted  => status.code == 'completed';

  int get deliveredCount => stops.where((s) => s.isDelivered).length;
  int get failedCount    => stops.where((s) => s.isFailed).length;
  int get pendingCount   => stops.where((s) => s.isPending || s.isArrived).length;

  double get totalCOD => stops
      .where((s) => s.order?.isCOD == true)
      .fold(0.0, (sum, s) => sum + (s.order?.totalTtc ?? 0));

  double get collectedCOD => stops
      .where((s) => s.isDelivered && s.codCollected)
      .fold(0.0, (sum, s) => sum + (s.amountCollected ?? s.order?.totalTtc ?? 0));

  String get slotDisplay => (slotStart != null && slotEnd != null)
      ? '$slotStart – $slotEnd'
      : date ?? '';
}
