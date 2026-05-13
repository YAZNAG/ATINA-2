import '../../../core/constants/api_constants.dart';

class CategoryModel {
  final int     id;
  final String  nameFr;
  final String  nameAr;
  final String? code;
  final String? imagePath;
  final String? iconPath;
  final int     sortOrder;
  final int     articleCount;

  const CategoryModel({
    required this.id,
    required this.nameFr,
    required this.nameAr,
    this.code,
    this.imagePath,
    this.iconPath,
    this.sortOrder    = 0,
    this.articleCount = 0,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> j) => CategoryModel(
    id:           j['id'] as int,
    nameFr:       j['name_fr']?.toString()   ?? '',
    nameAr:       j['name_ar']?.toString()   ?? '',
    code:         j['code']?.toString(),
    imagePath:    j['image_path']?.toString(),
    iconPath:     j['icon_path']?.toString(),
    sortOrder:    j['sort_order'] as int?     ?? 0,
    articleCount: j['article_count'] as int? ?? 0,
  );

  String get imageUrl {
    final p = imagePath;
    if (p == null || p.isEmpty) return '';
    if (p.startsWith('http')) return p;
    return '${ApiConstants.imageBaseUrl}$p';
  }

  String get iconUrl {
    final p = iconPath;
    if (p == null || p.isEmpty) return '';
    if (p.startsWith('http')) return p;
    return '${ApiConstants.imageBaseUrl}$p';
  }

  bool get hasImage => imagePath != null && imagePath!.isNotEmpty;
}
