import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/cart_item_model.dart';
import '../providers/cart_provider.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(cartProvider);
    final total = ref.watch(cartTotalProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: Column(children: [
          // ── Header ──────────────────────────────────────────────────────────
          Container(
            color:   Colors.white,
            padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 14.h),
            child: Row(children: [
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
                child: Text('Mon panier', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
              ),
              if (items.isNotEmpty)
                TextButton(
                  onPressed: () => _confirmClear(context, ref),
                  child: Text('Vider', style: TextStyle(fontSize: 13.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w600)),
                ),
            ]),
          ),

          // ── Body ────────────────────────────────────────────────────────────
          Expanded(
            child: items.isEmpty
                ? _EmptyCart()
                : ListView.separated(
                    padding:          EdgeInsets.all(12.w),
                    itemCount:        items.length,
                    separatorBuilder: (_, __) => SizedBox(height: 10.h),
                    itemBuilder:      (_, i)  => _CartItemTile(item: items[i]),
                  ),
          ),

          // ── Bottom summary ───────────────────────────────────────────────────
          if (items.isNotEmpty)
            Container(
              padding: EdgeInsets.fromLTRB(20.w, 16.h, 20.w, 28.h),
              decoration: BoxDecoration(
                color:     Colors.white,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 16, offset: const Offset(0, -4))],
              ),
              child: Column(children: [
                // Summary rows
                _SummaryRow(label: 'Sous-total', value: '${total.toStringAsFixed(2)} MAD'),
                SizedBox(height: 6.h),
                _SummaryRow(label: 'Livraison', value: 'Gratuite', valueColor: AppTheme.success),
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 12.h),
                  child: const Divider(color: Color(0xFFE5E7EB)),
                ),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('Total', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
                  Text('${total.toStringAsFixed(2)} MAD',
                      style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                ]),
                SizedBox(height: 16.h),
                // Order button
                GestureDetector(
                  onTap: () => context.push('/checkout'),
                  child: Container(
                    width:  double.infinity, height: 54.h,
                    decoration: BoxDecoration(
                      gradient:     const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
                      borderRadius: BorderRadius.circular(16.r),
                      boxShadow:    const [BoxShadow(color: Color(0x44DC2626), blurRadius: 16, offset: Offset(0, 6))],
                    ),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('Passer la commande', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700)),
                      SizedBox(width: 8.w),
                      Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20.sp),
                    ]),
                  ),
                ),
              ]),
            ),
        ]),
      ),
    );
  }

  void _confirmClear(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        title: Text('Vider le panier ?', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
        content: Text('Tous les articles seront supprimés.', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          TextButton(
            onPressed: () { ref.read(cartProvider.notifier).clear(); Navigator.pop(context); },
            child: Text('Vider', style: TextStyle(color: const Color(0xFFEF4444), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

// ── Cart item tile ─────────────────────────────────────────────────────────────
class _CartItemTile extends ConsumerWidget {
  final CartItem item;
  const _CartItemTile({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(cartProvider.notifier);
    final product  = item.product;

    return Container(
      padding:     EdgeInsets.all(12.w),
      decoration:  BoxDecoration(
        color:        Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Row(children: [
        // Thumbnail
        Container(
          width: 70.w, height: 70.w,
          decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12.r)),
          child: product.hasImage
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(12.r),
                  child: Image.network(product.imageUrl, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Icon(Icons.inventory_2_outlined, size: 30.sp, color: const Color(0xFFD1D5DB))),
                )
              : Center(child: Icon(Icons.inventory_2_outlined, size: 30.sp, color: const Color(0xFFD1D5DB))),
        ),

        SizedBox(width: 12.w),

        // Info
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (product.brandName != null)
              Text(product.brandName!, style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF), fontWeight: FontWeight.w500)),
            Text(product.nameFr, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827), height: 1.3)),
            SizedBox(height: 4.h),
            Text('${product.priceTtc.toStringAsFixed(2)} MAD / ${product.displayUnit}',
                style: TextStyle(fontSize: 12.sp, color: AppTheme.primary, fontWeight: FontWeight.w700)),
          ]),
        ),

        SizedBox(width: 8.w),

        // Controls
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          // Delete
          GestureDetector(
            onTap: () => notifier.removeProduct(product.id),
            child: Container(
              width: 28.w, height: 28.w,
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8.r)),
              child: Icon(Icons.delete_outline_rounded, size: 16.sp, color: const Color(0xFFEF4444)),
            ),
          ),
          SizedBox(height: 8.h),
          // Qty control
          Container(
            height: 32.h,
            decoration: BoxDecoration(
              border:       Border.all(color: const Color(0xFFE5E7EB)),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              GestureDetector(
                onTap: () => notifier.updateQty(product.id, item.qty - 1),
                child: Container(
                  width: 30.w,
                  decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.horizontal(left: Radius.circular(9.r))),
                  child: Center(child: Icon(Icons.remove_rounded, size: 14.sp, color: const Color(0xFF374151))),
                ),
              ),
              SizedBox(
                width: 32.w,
                child: Center(child: Text('${item.qty}', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700))),
              ),
              GestureDetector(
                onTap: () => notifier.updateQty(product.id, item.qty + 1),
                child: Container(
                  width: 30.w,
                  decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.horizontal(right: Radius.circular(9.r))),
                  child: Center(child: Icon(Icons.add_rounded, size: 14.sp, color: Colors.white)),
                ),
              ),
            ]),
          ),
          SizedBox(height: 8.h),
          Text('${item.subtotal.toStringAsFixed(2)} MAD',
              style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        ]),
      ]),
    );
  }
}

// ── Summary row ───────────────────────────────────────────────────────────────
class _SummaryRow extends StatelessWidget {
  final String label, value;
  final Color? valueColor;
  const _SummaryRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(label, style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
      Text(value,  style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: valueColor ?? const Color(0xFF374151))),
    ],
  );
}

// ── Empty cart ─────────────────────────────────────────────────────────────────
class _EmptyCart extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.shopping_cart_outlined, size: 80.sp, color: const Color(0xFFD1D5DB)),
      SizedBox(height: 16.h),
      Text('Votre panier est vide', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
      SizedBox(height: 8.h),
      Text('Ajoutez des produits pour commencer', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF9CA3AF))),
      SizedBox(height: 28.h),
      GestureDetector(
        onTap: () => context.push('/categories'),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 14.h),
          decoration: BoxDecoration(
            gradient:     const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
            borderRadius: BorderRadius.circular(14.r),
          ),
          child: Text('Explorer les produits', style: TextStyle(color: Colors.white, fontSize: 15.sp, fontWeight: FontWeight.w700)),
        ),
      ),
    ]),
  );
}
