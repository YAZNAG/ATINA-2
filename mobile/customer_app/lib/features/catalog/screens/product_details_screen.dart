import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../cart/providers/cart_provider.dart';
import '../providers/catalog_provider.dart';

class ProductDetailsScreen extends ConsumerStatefulWidget {
  final int productId;
  const ProductDetailsScreen({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailsScreen> createState() => _State();
}

class _State extends ConsumerState<ProductDetailsScreen> {
  int _qty = 1;

  @override
  Widget build(BuildContext context) {
    final detail    = ref.watch(productDetailProvider(widget.productId));
    final cartCount = ref.watch(cartCountProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
        error:   (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.error_outline_rounded, size: 48.sp, color: const Color(0xFF9CA3AF)),
          SizedBox(height: 12.h),
          Text('Produit introuvable', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
          TextButton(onPressed: () => context.pop(), child: const Text('Retour')),
        ])),
        data: (product) {
          final inCart = ref.watch(cartProvider.select((list) {
            final idx = list.indexWhere((i) => i.product.id == product.id);
            return idx >= 0 ? list[idx].qty : 0;
          }));

          return Stack(children: [
            CustomScrollView(slivers: [
              // ── Image app bar ──────────────────────────────────────────────
              SliverAppBar(
                expandedHeight: 300.h,
                pinned:         true,
                backgroundColor: Colors.white,
                leading: GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    margin: EdgeInsets.all(8.w),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.9), shape: BoxShape.circle),
                    child: Icon(Icons.arrow_back_ios_rounded, size: 18.sp, color: const Color(0xFF374151)),
                  ),
                ),
                actions: [
                  GestureDetector(
                    onTap: () => context.push('/cart'),
                    child: Container(
                      margin: EdgeInsets.all(8.w),
                      width: 38.w, height: 38.w,
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.9), shape: BoxShape.circle),
                      child: Stack(alignment: Alignment.center, children: [
                        Icon(Icons.shopping_cart_outlined, size: 20.sp, color: const Color(0xFF374151)),
                        if (cartCount > 0)
                          Positioned(
                            right: 4.w, top: 4.h,
                            child: Container(
                              width: 14.w, height: 14.w,
                              decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                              child: Center(child: Text('$cartCount', style: TextStyle(color: Colors.white, fontSize: 8.sp, fontWeight: FontWeight.w700))),
                            ),
                          ),
                      ]),
                    ),
                  ),
                  SizedBox(width: 8.w),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: product.hasImage
                      ? Image.network(product.imageUrl, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _PlaceholderImage())
                      : _PlaceholderImage(),
                ),
              ),

              // ── Content ────────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 120.h),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                    // Brand
                    if (product.brandName != null)
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                        decoration: BoxDecoration(
                          color:        AppTheme.primary.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8.r),
                        ),
                        child: Text(product.brandName!, style: TextStyle(fontSize: 12.sp, color: AppTheme.primary, fontWeight: FontWeight.w600)),
                      ),

                    SizedBox(height: 10.h),

                    // Name
                    Text(product.nameFr,
                        style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827), height: 1.3)),

                    if (product.categoryName != null) ...[
                      SizedBox(height: 6.h),
                      Text(product.categoryName!, style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
                    ],

                    SizedBox(height: 20.h),

                    // Price block
                    Container(
                      padding: EdgeInsets.all(16.w),
                      decoration: BoxDecoration(
                        color:        const Color(0xFFF9FAFB),
                        borderRadius: BorderRadius.circular(16.r),
                        border:       Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Prix TTC', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF))),
                          SizedBox(height: 4.h),
                          Text('${product.priceTtc.toStringAsFixed(2)} MAD',
                              style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                          Text('HT: ${product.price.toStringAsFixed(2)} MAD · TVA: ${product.vatRate.toStringAsFixed(0)}%',
                              style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
                        ]),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 6.h),
                          decoration: BoxDecoration(
                            color:        product.isActive ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(10.r),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(
                              product.isActive ? Icons.check_circle_rounded : Icons.cancel_rounded,
                              size: 14.sp,
                              color: product.isActive ? const Color(0xFF059669) : const Color(0xFFDC2626),
                            ),
                            SizedBox(width: 4.w),
                            Text(
                              product.isActive ? 'Disponible' : 'Indisponible',
                              style: TextStyle(
                                fontSize:   11.sp,
                                fontWeight: FontWeight.w600,
                                color: product.isActive ? const Color(0xFF059669) : const Color(0xFFDC2626),
                              ),
                            ),
                          ]),
                        ),
                      ]),
                    ),

                    SizedBox(height: 20.h),

                    // Unit
                    _InfoRow(label: 'Unité de vente', value: product.displayUnit),
                    if (product.ean13 != null && product.ean13!.isNotEmpty)
                      _InfoRow(label: 'EAN13', value: product.ean13!),
                    _InfoRow(label: 'Référence', value: product.skuCode),

                    // Description
                    if (product.descriptionFr != null && product.descriptionFr!.isNotEmpty) ...[
                      SizedBox(height: 20.h),
                      Text('Description', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
                      SizedBox(height: 8.h),
                      Text(product.descriptionFr!, style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280), height: 1.6)),
                    ],

                    SizedBox(height: 24.h),

                    // Quantity selector
                    Row(children: [
                      Text('Quantité', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
                      const Spacer(),
                      _QtySelector(
                        qty:       _qty,
                        onMinus:   () { if (_qty > 1) setState(() => _qty--); },
                        onPlus:    ()  => setState(() => _qty++),
                      ),
                    ]),

                    if (inCart > 0) ...[
                      SizedBox(height: 12.h),
                      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(Icons.shopping_cart_rounded, size: 16.sp, color: AppTheme.success),
                        SizedBox(width: 6.w),
                        Text('$inCart ${inCart > 1 ? "unités" : "unité"} dans le panier',
                            style: TextStyle(fontSize: 13.sp, color: AppTheme.success, fontWeight: FontWeight.w600)),
                      ]),
                    ],
                  ]),
                ),
              ),
            ]),

            // ── Bottom action bar ────────────────────────────────────────────
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Container(
                padding: EdgeInsets.fromLTRB(20.w, 12.h, 20.w, 24.h),
                decoration: BoxDecoration(
                  color:   Colors.white,
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 16, offset: const Offset(0, -4))],
                ),
                child: Row(children: [
                  // Add to cart
                  Expanded(
                    child: GestureDetector(
                      onTap: product.isActive ? () {
                        ref.read(cartProvider.notifier).addProduct(product, qty: _qty);
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text('$_qty × ${product.nameFr} ajouté', style: const TextStyle(color: Colors.white)),
                          backgroundColor: AppTheme.success,
                          duration: const Duration(seconds: 2),
                          behavior: SnackBarBehavior.floating,
                          margin: EdgeInsets.all(12.w),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
                        ));
                      } : null,
                      child: Container(
                        height: 54.h,
                        decoration: BoxDecoration(
                          gradient: product.isActive
                              ? const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark])
                              : null,
                          color:        product.isActive ? null : const Color(0xFFE5E7EB),
                          borderRadius: BorderRadius.circular(16.r),
                          boxShadow: product.isActive
                              ? [const BoxShadow(color: Color(0x44DC2626), blurRadius: 16, offset: Offset(0, 6))]
                              : null,
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 20.sp),
                          SizedBox(width: 8.w),
                          Text('Ajouter au panier', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700)),
                        ]),
                      ),
                    ),
                  ),

                  SizedBox(width: 12.w),

                  // Go to cart
                  GestureDetector(
                    onTap: () => context.push('/cart'),
                    child: Container(
                      height: 54.h, width: 54.h,
                      decoration: BoxDecoration(
                        border:       Border.all(color: AppTheme.primary, width: 2),
                        borderRadius: BorderRadius.circular(16.r),
                      ),
                      child: Icon(Icons.shopping_bag_outlined, color: AppTheme.primary, size: 24.sp),
                    ),
                  ),
                ]),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _PlaceholderImage extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    color: const Color(0xFFF3F4F6),
    child: Center(child: Icon(Icons.inventory_2_outlined, size: 80.sp, color: const Color(0xFFD1D5DB))),
  );
}

class _InfoRow extends StatelessWidget {
  final String label, value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: 8.h),
    child: Row(children: [
      Text('$label : ', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
      Text(value, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
    ]),
  );
}

class _QtySelector extends StatelessWidget {
  final int qty;
  final VoidCallback onMinus, onPlus;
  const _QtySelector({required this.qty, required this.onMinus, required this.onPlus});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      border:       Border.all(color: const Color(0xFFE5E7EB), width: 1.5),
      borderRadius: BorderRadius.circular(12.r),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      _Btn(icon: Icons.remove_rounded, onTap: onMinus, enabled: qty > 1),
      SizedBox(
        width: 40.w,
        child: Center(child: Text('$qty', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827)))),
      ),
      _Btn(icon: Icons.add_rounded, onTap: onPlus, enabled: true),
    ]),
  );
}

class _Btn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool enabled;
  const _Btn({required this.icon, required this.onTap, required this.enabled});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: enabled ? onTap : null,
    child: Container(
      width: 40.w, height: 40.h,
      decoration: BoxDecoration(color: enabled ? const Color(0xFFF3F4F6) : const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(10.r)),
      child: Icon(icon, size: 18.sp, color: enabled ? const Color(0xFF374151) : const Color(0xFFD1D5DB)),
    ),
  );
}
