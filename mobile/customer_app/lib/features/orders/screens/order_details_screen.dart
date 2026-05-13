import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/orders_provider.dart';
import '../widgets/order_status_badge.dart';
import '../widgets/order_timeline.dart';

class OrderDetailsScreen extends ConsumerWidget {
  final String orderId;
  const OrderDetailsScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        title: Text('Détail commande',
            style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
        error: (e, _) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.wifi_off_rounded, size: 56.sp, color: const Color(0xFF9CA3AF)),
            SizedBox(height: 12.h),
            Text('Impossible de charger la commande', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
            SizedBox(height: 16.h),
            TextButton(onPressed: () => ref.invalidate(orderDetailProvider(orderId)), child: const Text('Réessayer')),
          ]),
        ),
        data: (order) => RefreshIndicator(
          color: AppTheme.primary,
          onRefresh: () async => ref.invalidate(orderDetailProvider(orderId)),
          child: SingleChildScrollView(
            padding: EdgeInsets.all(16.w),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _StatusHeader(order: order),
              SizedBox(height: 16.h),
              if (order.timeline != null && order.timeline!.isNotEmpty) ...[
                _Card(child: OrderTimeline(entries: order.timeline!)),
                SizedBox(height: 16.h),
              ],
              _Card(child: _OrderInfo(order: order)),
              SizedBox(height: 16.h),
              if (order.items.isNotEmpty) ...[
                _Card(child: _ItemsSection(order: order)),
                SizedBox(height: 16.h),
              ],
              _Card(child: _PaymentSection(order: order)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _StatusHeader extends StatelessWidget {
  final dynamic order;
  const _StatusHeader({required this.order});

  @override
  Widget build(BuildContext context) {
    final dateStr = '${order.createdAt.day.toString().padLeft(2, '0')}/${order.createdAt.month.toString().padLeft(2, '0')}/${order.createdAt.year}';
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
        borderRadius: BorderRadius.circular(20.r),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Expanded(
            child: Text(order.reference, style: TextStyle(color: Colors.white, fontSize: 18.sp, fontWeight: FontWeight.w800)),
          ),
          OrderStatusBadge(status: order.status),
        ]),
        SizedBox(height: 8.h),
        Text(dateStr, style: TextStyle(color: Colors.white70, fontSize: 13.sp)),
        SizedBox(height: 12.h),
        Row(children: [
          Icon(Icons.local_shipping_rounded, color: Colors.white70, size: 16.sp),
          SizedBox(width: 6.w),
          Text(order.deliveryType == 'pickup' ? 'Retrait magasin' : 'Livraison à domicile',
              style: TextStyle(color: Colors.white, fontSize: 13.sp, fontWeight: FontWeight.w600)),
        ]),
        if (order.nodeName != null) ...[
          SizedBox(height: 4.h),
          Row(children: [
            Icon(Icons.business_rounded, color: Colors.white70, size: 16.sp),
            SizedBox(width: 6.w),
            Expanded(child: Text(order.nodeName, style: TextStyle(color: Colors.white, fontSize: 13.sp, fontWeight: FontWeight.w500))),
          ]),
        ],
      ]),
    );
  }
}

class _OrderInfo extends StatelessWidget {
  final dynamic order;
  const _OrderInfo({required this.order});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Informations', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
    SizedBox(height: 12.h),
    if (order.addressFull != null) ...[
      _InfoRow(icon: Icons.location_on_outlined, label: 'Adresse', value: order.addressFull),
      SizedBox(height: 8.h),
    ],
    if (order.slotName != null && order.slotDate != null) ...[
      _InfoRow(icon: Icons.schedule_rounded, label: 'Créneau', value: '${order.slotDate} - ${order.slotName}'),
      SizedBox(height: 8.h),
    ],
    if (order.notes != null && order.notes!.isNotEmpty) ...[
      _InfoRow(icon: Icons.note_outlined, label: 'Notes', value: order.notes),
    ],
  ]);
}

class _ItemsSection extends StatelessWidget {
  final dynamic order;
  const _ItemsSection({required this.order});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Articles (${order.items.length})', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
    SizedBox(height: 12.h),
    ...order.items.map<Widget>((item) => Padding(
      padding: EdgeInsets.only(bottom: 10.h),
      child: Row(children: [
        Container(
          width: 44.w, height: 44.w,
          decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(10.r)),
          child: Center(child: Text('${item.qty}x', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: AppTheme.primary))),
        ),
        SizedBox(width: 10.w),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.nameFr ?? 'Article', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827))),
            if (item.skuCode != null)
              Text('Ref: ${item.skuCode}', style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF))),
          ]),
        ),
        SizedBox(width: 8.w),
        Text('${item.totalTtc.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
      ]),
    )),
    const Divider(color: Color(0xFFF3F4F6)),
    SizedBox(height: 4.h),
    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text('Total', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
      Text('${order.totalTtc.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
    ]),
  ]);
}

class _PaymentSection extends StatelessWidget {
  final dynamic order;
  const _PaymentSection({required this.order});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Paiement', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
    SizedBox(height: 12.h),
    if (order.paymentMethodName != null)
      _InfoRow(icon: Icons.payment_rounded, label: 'Méthode', value: order.paymentMethodName),
    if (order.walletUsed != null && order.walletUsed! > 0) ...[
      SizedBox(height: 8.h),
      _InfoRow(icon: Icons.account_balance_wallet_rounded, label: 'Wallet utilisé', value: '${order.walletUsed!.toStringAsFixed(2)} MAD'),
    ],
    if (order.pointsGained != null && order.pointsGained! > 0) ...[
      SizedBox(height: 8.h),
      _InfoRow(icon: Icons.stars_rounded, label: 'Points gagnés', value: '${order.pointsGained} pts'),
    ],
    SizedBox(height: 8.h),
    _InfoRow(icon: Icons.check_circle_outline_rounded, label: 'Statut paiement', value: _paymentLabel(order.paymentStatus)),
  ]);

  String _paymentLabel(String s) {
    switch (s) {
      case 'paid': return 'Payé';
      case 'failed': return 'Échoué';
      default: return 'En attente';
    }
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Icon(icon, size: 16.sp, color: const Color(0xFF6B7280)),
    SizedBox(width: 8.w),
    SizedBox(width: 100.w, child: Text(label, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280)))),
    Expanded(child: Text(value, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827)))),
  ]);
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: EdgeInsets.all(16.w),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16.r),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: child,
  );
}
