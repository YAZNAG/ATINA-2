class CheckoutMetaModel {
  final List<DeliveryTypeModel> deliveryTypes;
  final List<PaymentMethodModel> paymentMethods;
  final Map<String, dynamic>? configs;

  const CheckoutMetaModel({
    required this.deliveryTypes,
    required this.paymentMethods,
    this.configs,
  });

  factory CheckoutMetaModel.fromJson(Map<String, dynamic> j) {
    final types = (j['delivery_types'] as List<dynamic>? ?? [])
        .map((e) => DeliveryTypeModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final methods = (j['payment_methods'] as List<dynamic>? ?? [])
        .map((e) => PaymentMethodModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return CheckoutMetaModel(
      deliveryTypes: types,
      paymentMethods: methods,
      configs: j['configs'] as Map<String, dynamic>?,
    );
  }
}

class DeliveryTypeModel {
  final String id;
  final String code;
  final String nameFr;
  final String? nameAr;
  final bool isActive;

  const DeliveryTypeModel({
    required this.id,
    required this.code,
    required this.nameFr,
    this.nameAr,
    required this.isActive,
  });

  factory DeliveryTypeModel.fromJson(Map<String, dynamic> j) => DeliveryTypeModel(
    id:       j['id']?.toString() ?? '',
    code:     j['code']?.toString() ?? '',
    nameFr:   j['name_fr']?.toString() ?? '',
    nameAr:   j['name_ar']?.toString(),
    isActive: j['is_active'] as bool? ?? true,
  );
}

class PaymentMethodModel {
  final String id;
  final String code;
  final String nameFr;
  final String? nameAr;
  final bool isActive;
  final double? codMaxAmount;

  const PaymentMethodModel({
    required this.id,
    required this.code,
    required this.nameFr,
    this.nameAr,
    required this.isActive,
    this.codMaxAmount,
  });

  factory PaymentMethodModel.fromJson(Map<String, dynamic> j) => PaymentMethodModel(
    id:           j['id']?.toString() ?? '',
    code:         j['code']?.toString() ?? '',
    nameFr:       j['name_fr']?.toString() ?? '',
    nameAr:       j['name_ar']?.toString(),
    isActive:     j['is_active'] as bool? ?? true,
    codMaxAmount: double.tryParse(j['cod_max_amount']?.toString() ?? ''),
  );
}
