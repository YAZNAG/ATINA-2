import '../../../core/constants/api_constants.dart';

class ProductModel {
  final int     id;
  final String  skuCode;
  final String? ean13;
  final String  nameFr;
  final String  nameAr;
  final String? descriptionFr;
  final String? descriptionAr;
  final double  price;
  final double  vatRate;
  final double  priceTtc;
  final String? unitSale;
  final bool    isActive;
  final String? brandName;
  final int?    categoryId;
  final String? categoryName;
  final String? rawImageUrl;

  const ProductModel({
    required this.id,
    required this.skuCode,
    this.ean13,
    required this.nameFr,
    required this.nameAr,
    this.descriptionFr,
    this.descriptionAr,
    required this.price,
    required this.vatRate,
    required this.priceTtc,
    this.unitSale,
    required this.isActive,
    this.brandName,
    this.categoryId,
    this.categoryName,
    this.rawImageUrl,
  });

  factory ProductModel.fromJson(Map<String, dynamic> j) {
    final brand    = j['brand']    as Map<String, dynamic>?;
    final category = j['category'] as Map<String, dynamic>?;
    return ProductModel(
      id:            j['id'] as int,
      skuCode:       j['sku_code']?.toString()       ?? '',
      ean13:         j['ean13']?.toString(),
      nameFr:        j['name_fr']?.toString()        ?? '',
      nameAr:        j['name_ar']?.toString()        ?? '',
      descriptionFr: j['description_fr']?.toString(),
      descriptionAr: j['description_ar']?.toString(),
      price:         double.tryParse(j['price']?.toString() ?? '0')     ?? 0,
      vatRate:       double.tryParse(j['vat_rate']?.toString() ?? '0')  ?? 0,
      priceTtc:      double.tryParse(j['price_ttc']?.toString() ?? '0') ?? 0,
      unitSale:      j['unit_sale']?.toString(),
      isActive:      j['is_active'] as bool? ?? true,
      brandName:     brand?['name_fr']?.toString(),
      categoryId:    category?['id'] as int?,
      categoryName:  category?['name_fr']?.toString(),
      rawImageUrl:   j['image_url']?.toString(),
    );
  }

  String get imageUrl {
    final url = rawImageUrl;
    if (url == null || url.isEmpty) return '';
    if (url.startsWith('http')) return url;
    return '${ApiConstants.imageBaseUrl}$url';
  }

  bool get hasImage => rawImageUrl != null && rawImageUrl!.isNotEmpty;

  String get displayUnit => unitSale ?? 'unité';
  String get displayPrice => '${priceTtc.toStringAsFixed(2)} MAD';
}
