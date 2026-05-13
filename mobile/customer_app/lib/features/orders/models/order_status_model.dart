class OrderStatusModel {
  final String code;
  final String nameFr;
  final String? nameAr;
  final String color;

  const OrderStatusModel({
    required this.code,
    required this.nameFr,
    this.nameAr,
    required this.color,
  });

  factory OrderStatusModel.fromJson(Map<String, dynamic> j) => OrderStatusModel(
    code:   j['code']?.toString()   ?? '',
    nameFr: j['name_fr']?.toString() ?? '',
    nameAr: j['name_ar']?.toString(),
    color:  j['color']?.toString()  ?? '#6B7280',
  );
}
