import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/category_model.dart';
import '../providers/catalog_provider.dart';

// Category icon map — fallback when no image available
const _catIcons = <String, IconData>{
  'HUILES':    Icons.water_drop_outlined,
  'FARINES':   Icons.grain_outlined,
  'PATES':     Icons.ramen_dining_outlined,
  'SUCRES':    Icons.cake_outlined,
  'EAUX':      Icons.local_drink_outlined,
  'JUSPURS':   Icons.local_bar_outlined,
  'GAZEUX':    Icons.bubble_chart_outlined,
  'LAITS':     Icons.egg_outlined,
  'FROMAGES':  Icons.lunch_dining_outlined,
  'YAOURTS':   Icons.icecream_outlined,
  'BEURRES':   Icons.breakfast_dining_outlined,
  'CONFITURE': Icons.set_meal_outlined,
  'SARDINES':  Icons.set_meal_outlined,
  'HARISSA':   Icons.soup_kitchen_outlined,
  'PAINS':     Icons.bakery_dining_outlined,
  'VIENNOIS':  Icons.bakery_dining_outlined,
  'BISCUITS':  Icons.cookie_outlined,
  'CHOCOLATS': Icons.emoji_food_beverage_outlined,
  'BONBONS':   Icons.stars_outlined,
  'SAVONS':    Icons.soap_outlined,
  'SHAMPOO':   Icons.shower_outlined,
  'DENTAIRE':  Icons.sanitizer_outlined,
  'DETERGENTS':Icons.cleaning_services_outlined,
  'VAISSELLE': Icons.countertops_outlined,
};

const _catColors = <String, Color>{
  'HUILES':    Color(0xFFF59E0B),
  'FARINES':   Color(0xFFD97706),
  'PATES':     Color(0xFFEF4444),
  'SUCRES':    Color(0xFFEC4899),
  'EAUX':      Color(0xFF3B82F6),
  'JUSPURS':   Color(0xFF10B981),
  'GAZEUX':    Color(0xFF6366F1),
  'LAITS':     Color(0xFF8B5CF6),
  'FROMAGES':  Color(0xFFF97316),
  'YAOURTS':   Color(0xFF14B8A6),
  'BEURRES':   Color(0xFFEAB308),
  'CONFITURE': Color(0xFFEF4444),
  'SARDINES':  Color(0xFF0EA5E9),
  'HARISSA':   Color(0xFFDC2626),
  'PAINS':     Color(0xFFD97706),
  'BISCUITS':  Color(0xFFF59E0B),
  'CHOCOLATS': Color(0xFF92400E),
  'BONBONS':   Color(0xFFDB2777),
  'SAVONS':    Color(0xFF6D28D9),
  'SHAMPOO':   Color(0xFF7C3AED),
  'DENTAIRE':  Color(0xFF0284C7),
  'DETERGENTS':Color(0xFF059669),
  'VAISSELLE': Color(0xFF0891B2),
};

Color _colorFor(String? code) =>
    _catColors[code?.toUpperCase()] ?? const Color(0xFFDC2626);

IconData _iconFor(String? code) =>
    _catIcons[code?.toUpperCase()] ?? Icons.grid_view_outlined;

// ─────────────────────────────────────────────────────────────────────────────
class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});

  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: Column(children: [
          // ── Header ────────────────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 12.h),
            child: Column(children: [
              Row(children: [
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    width: 38.w, height: 38.w,
                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), shape: BoxShape.circle),
                    child: Icon(Icons.arrow_back_ios_rounded, size: 16.sp, color: const Color(0xFF374151)),
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Text('Catégories', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
                ),
              ]),
              SizedBox(height: 12.h),
              // Search bar
              Container(
                height: 44.h,
                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12.r)),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged:  (v) => setState(() => _query = v.toLowerCase()),
                  style: TextStyle(fontSize: 14.sp, color: const Color(0xFF111827)),
                  decoration: InputDecoration(
                    hintText:        'Rechercher des produits...',
                    hintStyle:       TextStyle(fontSize: 14.sp, color: const Color(0xFF9CA3AF)),
                    prefixIcon:      Icon(Icons.search_rounded, size: 20.sp, color: const Color(0xFF9CA3AF)),
                    suffixIcon:      _query.isNotEmpty
                        ? IconButton(icon: Icon(Icons.close_rounded, size: 18.sp, color: const Color(0xFF9CA3AF)), onPressed: () { _searchCtrl.clear(); setState(() => _query = ''); })
                        : null,
                    border:          InputBorder.none,
                    contentPadding:  EdgeInsets.symmetric(vertical: 12.h),
                  ),
                ),
              ),
            ]),
          ),

          // ── Grid ──────────────────────────────────────────────────────────
          Expanded(
            child: cats.when(
              loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
              error:   (e, _) => _ErrorState(onRetry: () => ref.invalidate(categoriesProvider)),
              data:    (list) {
                final filtered = _query.isEmpty
                    ? list
                    : list.where((c) => c.nameFr.toLowerCase().contains(_query)).toList();

                if (filtered.isEmpty) {
                  return Center(child: Text('Aucune catégorie trouvée', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF9CA3AF))));
                }

                return GridView.builder(
                  padding:         EdgeInsets.all(16.w),
                  gridDelegate:    SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount:   3,
                    crossAxisSpacing: 10.w,
                    mainAxisSpacing:  10.h,
                    childAspectRatio: 0.82,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => _CategoryCard(cat: filtered[i]),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Category card ─────────────────────────────────────────────────────────────
class _CategoryCard extends StatelessWidget {
  final CategoryModel cat;
  const _CategoryCard({required this.cat});

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(cat.code);

    return GestureDetector(
      onTap: () => context.push('/categories/${cat.id}/products', extra: cat.nameFr),
      child: Container(
        decoration: BoxDecoration(
          color:        Colors.white,
          borderRadius: BorderRadius.circular(16.r),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          // Icon container
          Container(
            width:  54.w, height: 54.w,
            decoration: BoxDecoration(
              color:        color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14.r),
            ),
            child: cat.hasImage
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(14.r),
                    child: Image.network(cat.imageUrl, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Icon(_iconFor(cat.code), color: color, size: 28.sp)),
                  )
                : Icon(_iconFor(cat.code), color: color, size: 28.sp),
          ),
          SizedBox(height: 8.h),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 6.w),
            child: Text(
              cat.nameFr,
              textAlign:  TextAlign.center,
              maxLines:   2,
              overflow:   TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827), height: 1.3),
            ),
          ),
          if (cat.articleCount > 0) ...[
            SizedBox(height: 4.h),
            Text(
              '${cat.articleCount} article${cat.articleCount > 1 ? "s" : ""}',
              style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF)),
            ),
          ],
        ]),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.wifi_off_rounded, size: 48.sp, color: const Color(0xFF9CA3AF)),
    SizedBox(height: 12.h),
    Text('Impossible de charger les catégories', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
    SizedBox(height: 16.h),
    TextButton(onPressed: onRetry, child: const Text('Réessayer')),
  ]));
}
