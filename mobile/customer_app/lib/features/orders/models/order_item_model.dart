class OrderItemModel {
  final String? skuCode;
  final String? nameFr;
  final String? nameAr;
  final int    qty;
  final double unitPrice;
  final double vatRate;
  final double totalTtc;

  const OrderItemModel({
    this.skuCode,
    this.nameFr,
    this.nameAr,
    required this.qty,
    required this.unitPrice,
    required this.vatRate,
    required this.totalTtc,
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> j) => OrderItemModel(
    skuCode:   j['sku_code']?.toString(),
    nameFr:    j['name_fr']?.toString(),
    nameAr:    j['name_ar']?.toString(),
    qty:       (j['qty'] as int?) ?? 0,
    unitPrice: double.tryParse(j['unit_price']?.toString() ?? '0') ?? 0,
    vatRate:   double.tryParse(j['vat_rate']?.toString() ?? '0') ?? 0,
    totalTtc:  double.tryParse(j['total_ttc']?.toString() ?? '0') ?? 0,
  );
}
