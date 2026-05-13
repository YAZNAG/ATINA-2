import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/theme/app_theme.dart';

class CheckoutSummaryCard extends StatelessWidget {
  final double subtotal;
  final double delivery;
  final double total;
  final String? walletUsed;
  final String? pointsUsed;
  final String? paymentMethod;

  const CheckoutSummaryCard({
    super.key,
    required this.subtotal,
    this.delivery = 0,
    required this.total,
    this.walletUsed,
    this.pointsUsed,
    this.paymentMethod,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(16.w),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16.r),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(children: [
      _Row(label: 'Sous-total', value: '${subtotal.toStringAsFixed(2)} MAD'),
      SizedBox(height: 6.h),
      _Row(label: 'Livraison', value: delivery > 0 ? '${delivery.toStringAsFixed(2)} MAD' : 'Gratuite', valueColor: delivery > 0 ? null : AppTheme.success),
      if (walletUsed != null) ...[
        SizedBox(height: 6.h),
        _Row(label: 'Wallet', value: '-$walletUsed MAD', valueColor: AppTheme.warning),
      ],
      if (pointsUsed != null) ...[
        SizedBox(height: 6.h),
        _Row(label: 'Points', value: '-$pointsUsed pts', valueColor: AppTheme.warning),
      ],
      SizedBox(height: 8.h),
      const Divider(color: Color(0xFFE5E7EB)),
      SizedBox(height: 8.h),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text('Total TTC', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
        Text('${total.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
      ]),
      if (paymentMethod != null) ...[
        SizedBox(height: 4.h),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Paiement', style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
          Text(paymentMethod!, style: TextStyle(fontSize: 11.sp, color: const Color(0xFF6B7280), fontWeight: FontWeight.w600)),
        ]),
      ],
    ]),
  );
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _Row({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(label, style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
      Text(value, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: valueColor ?? const Color(0xFF374151))),
    ],
  );
}
