import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../cart/providers/cart_provider.dart';
import '../models/product_model.dart';
import '../providers/catalog_provider.dart';

class ProductsByCategoryScreen extends ConsumerStatefulWidget {
  final int    categoryId;
  final String categoryName;
  const ProductsByCategoryScreen({super.key, required this.categoryId, required this.categoryName});

  @override
  ConsumerState<ProductsByCategoryScreen> createState() => _State();
}

class _State extends ConsumerState<ProductsByCategoryScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(productsByCategoryProvider(widget.categoryId));
    final cartCount = ref.watch(cartCountProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: Column(children: [
          // ── Header ──────────────────────────────────────────────────────────
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
                  child: Text(widget.categoryName, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
                ),
                // Cart badge
                GestureDetector(
                  onTap: () => context.push('/cart'),
                  child: Stack(children: [
                    Container(
                      width: 38.w, height: 38.w,
                      decoration: BoxDecoration(color: const Color(0xFFF3F4F6), shape: BoxShape.circle),
                      child: Icon(Icons.shopping_cart_outlined, size: 20.sp, color: const Color(0xFF374151)),
                    ),
                    if (cartCount > 0)
                      Positioned(
                        right: 0, top: 0,
                        child: Container(
                          width: 16.w, height: 16.w,
                          decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                          child: Center(child: Text('$cartCount', style: TextStyle(color: Colors.white, fontSize: 9.sp, fontWeight: FontWeight.w700))),
                        ),
                      ),
                  ]),
                ),
              ]),
              SizedBox(height: 12.h),
              Container(
                height: 44.h,
                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12.r)),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged:  (v) => setState(() => _query = v.toLowerCase()),
                  style: TextStyle(fontSize: 14.sp, color: const Color(0xFF111827)),
                  decoration: InputDecoration(
                    hintText:       'Rechercher dans ${widget.categoryName}...',
                    hintStyle:      TextStyle(fontSize: 13.sp, color: const Color(0xFF9CA3AF)),
                    prefixIcon:     Icon(Icons.search_rounded, size: 20.sp, color: const Color(0xFF9CA3AF)),
                    suffixIcon:     _query.isNotEmpty
                        ? IconButton(icon: Icon(Icons.close_rounded, size: 18.sp, color: const Color(0xFF9CA3AF)), onPressed: () { _searchCtrl.clear(); setState(() => _query = ''); })
                        : null,
                    border:         InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12.h),
                  ),
                ),
              ),
            ]),
          ),

          // ── Grid ────────────────────────────────────────────────────────────
          Expanded(
            child: products.when(
              loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
              error:   (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.wifi_off_rounded, size: 48.sp, color: const Color(0xFF9CA3AF)),
                SizedBox(height: 12.h),
                Text('Erreur de chargement', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
                TextButton(onPressed: () => ref.invalidate(productsByCategoryProvider(widget.categoryId)), child: const Text('Réessayer')),
              ])),
              data: (list) {
                final filtered = _query.isEmpty
                    ? list
                    : list.where((p) => p.nameFr.toLowerCase().contains(_query)).toList();

                if (filtered.isEmpty) {
                  return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.inventory_2_outlined, size: 56.sp, color: const Color(0xFF9CA3AF)),
                    SizedBox(height: 12.h),
                    Text('Aucun produit trouvé', style: TextStyle(fontSize: 15.sp, color: const Color(0xFF6B7280))),
                  ]));
                }

                return GridView.builder(
                  padding:      EdgeInsets.all(12.w),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount:   2,
                    crossAxisSpacing: 10.w,
                    mainAxisSpacing:  10.h,
                    childAspectRatio: 0.70,
                  ),
                  itemCount:   filtered.length,
                  itemBuilder: (_, i) => _ProductCard(product: filtered[i]),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Product card ──────────────────────────────────────────────────────────────
class _ProductCard extends ConsumerWidget {
  final ProductModel product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qty = ref.watch(cartProvider.select((list) {
      final idx = list.indexWhere((i) => i.product.id == product.id);
      return idx >= 0 ? list[idx].qty : 0;
    }));

    return GestureDetector(
      onTap: () => context.push('/products/${product.id}'),
      child: Container(
        decoration: BoxDecoration(
          color:        Colors.white,
          borderRadius: BorderRadius.circular(16.r),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Image
          Expanded(
            flex: 3,
            child: Stack(children: [
              Container(
                width:  double.infinity,
                decoration: BoxDecoration(
                  color:        const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16.r)),
                ),
                child: product.hasImage
                    ? ClipRRect(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(16.r)),
                        child: Image.network(product.imageUrl, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Icon(Icons.inventory_2_outlined, size: 36.sp, color: const Color(0xFFD1D5DB))),
                      )
                    : Center(child: Icon(Icons.inventory_2_outlined, size: 40.sp, color: const Color(0xFFD1D5DB))),
              ),
              // Availability badge
              if (!product.isActive)
                Positioned(
                  top: 8.h, left: 8.w,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                    decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(6.r)),
                    child: Text('Indispo', style: TextStyle(color: Colors.white, fontSize: 9.sp, fontWeight: FontWeight.w700)),
                  ),
                ),
            ]),
          ),

          // Info
          Expanded(
            flex: 2,
            child: Padding(
              padding: EdgeInsets.fromLTRB(10.w, 8.h, 10.w, 10.h),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (product.brandName != null)
                    Text(product.brandName!, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF), fontWeight: FontWeight.w500)),
                  Text(product.nameFr, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827), height: 1.3)),
                ]),

                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.center, children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${product.priceTtc.toStringAsFixed(2)} MAD',
                        style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                    Text(product.displayUnit, style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF))),
                  ]),

                  // Cart button
                  qty == 0
                      ? GestureDetector(
                          onTap: () {
                            ref.read(cartProvider.notifier).addProduct(product);
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: const Text('Ajouté au panier', style: TextStyle(color: Colors.white)),
                              backgroundColor: AppTheme.success,
                              duration: const Duration(seconds: 1),
                              behavior: SnackBarBehavior.floating,
                              margin: EdgeInsets.all(12.w),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
                            ));
                          },
                          child: Container(
                            width: 30.w, height: 30.w,
                            decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                            child: Icon(Icons.add_rounded, color: Colors.white, size: 18.sp),
                          ),
                        )
                      : _MiniQtyControl(product: product, qty: qty),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _MiniQtyControl extends ConsumerWidget {
  final ProductModel product;
  final int          qty;
  const _MiniQtyControl({required this.product, required this.qty});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(cartProvider.notifier);
    return Container(
      height: 30.h,
      decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(10.r)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        GestureDetector(
          onTap: () => notifier.updateQty(product.id, qty - 1),
          child: Padding(padding: EdgeInsets.symmetric(horizontal: 6.w), child: Icon(Icons.remove_rounded, color: Colors.white, size: 14.sp)),
        ),
        Text('$qty', style: TextStyle(color: Colors.white, fontSize: 12.sp, fontWeight: FontWeight.w700)),
        GestureDetector(
          onTap: () => notifier.updateQty(product.id, qty + 1),
          child: Padding(padding: EdgeInsets.symmetric(horizontal: 6.w), child: Icon(Icons.add_rounded, color: Colors.white, size: 14.sp)),
        ),
      ]),
    );
  }
}
