import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/order_model.dart';
import 'order_status_badge.dart';

class OrderCard extends StatelessWidget {
  final OrderModel order;
  const OrderCard({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final dateStr = _formatDate(order.createdAt);
    final icon = order.deliveryType == 'pickup' ? Icons.store_rounded : Icons.local_shipping_rounded;
    final typeLabel = order.deliveryType == 'pickup' ? 'Retrait' : 'Livraison';

    return GestureDetector(
      onTap: () => context.push('/orders/${order.id}'),
      child: Container(
        padding: EdgeInsets.all(16.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16.r),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 40.w, height: 40.w,
              decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12.r)),
              child: Icon(icon, size: 20.sp, color: AppTheme.primary),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(order.reference, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
                SizedBox(height: 2.h),
                Row(children: [
                  Icon(Icons.calendar_today_rounded, size: 11.sp, color: const Color(0xFF9CA3AF)),
                  SizedBox(width: 4.w),
                  Text(dateStr, style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
                  SizedBox(width: 8.w),
                  Container(width: 3, height: 3, decoration: const BoxDecoration(color: Color(0xFFD1D5DB), shape: BoxShape.circle)),
                  SizedBox(width: 8.w),
                  Icon(Icons.inventory_2_outlined, size: 11.sp, color: const Color(0xFF9CA3AF)),
                  SizedBox(width: 4.w),
                  Text('${order.itemCount} art.', style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
                ]),
              ]),
            ),
          ]),

          SizedBox(height: 12.h),
          const Divider(height: 1, color: Color(0xFFF3F4F6)),
          SizedBox(height: 12.h),

          Row(children: [
            _InfoChip(icon: icon, label: typeLabel),
            SizedBox(width: 8.w),
            if (order.nodeName != null)
              _InfoChip(icon: Icons.business_rounded, label: order.nodeName!),
          ]),
          SizedBox(height: 10.h),

          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${order.totalTtc.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
              SizedBox(height: 2.h),
              Text(_paymentLabel(order.paymentStatus), style: TextStyle(fontSize: 10.sp, color: _paymentColor(order.paymentStatus))),
            ]),
            OrderStatusBadge(status: order.status),
          ]),
        ]),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }

  String _paymentLabel(String s) {
    switch (s) {
      case 'paid': return 'Payé';
      case 'failed': return 'Échoué';
      default: return 'En attente';
    }
  }

  Color _paymentColor(String s) {
    switch (s) {
      case 'paid': return AppTheme.success;
      case 'failed': return const Color(0xFFEF4444);
      default: return const Color(0xFFF59E0B);
    }
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(8.r)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12.sp, color: const Color(0xFF6B7280)),
      SizedBox(width: 4.w),
      Text(label, style: TextStyle(fontSize: 10.sp, color: const Color(0xFF6B7280), fontWeight: FontWeight.w500)),
    ]),
  );
}
