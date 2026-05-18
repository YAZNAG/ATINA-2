import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../data/picker_portal_api.dart';
import '../models/session_models.dart';
import '../providers/sessions_provider.dart';

class AvailableOrdersScreen extends ConsumerWidget {
  const AvailableOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(availableOrdersProvider);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title: Text('Commandes disponibles', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () => ref.invalidate(availableOrdersProvider)),
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => _ErrorState(e.toString(), () => ref.invalidate(availableOrdersProvider)),
        data:    (orders) => orders.isEmpty
            ? _EmptyState()
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(availableOrdersProvider),
                child: ListView.separated(
                  padding: EdgeInsets.all(16.w),
                  itemCount: orders.length,
                  separatorBuilder: (_, __) => SizedBox(height: 10.h),
                  itemBuilder: (_, i) => _OrderCard(order: orders[i], onAccepted: () => ref.invalidate(availableOrdersProvider)),
                ),
              ),
      ),
    );
  }
}

class _OrderCard extends ConsumerStatefulWidget {
  final AvailableOrderModel order;
  final VoidCallback onAccepted;
  const _OrderCard({required this.order, required this.onAccepted});
  @override
  ConsumerState<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<_OrderCard> {
  bool _accepting = false;

  Future<void> _accept() async {
    setState(() => _accepting = true);
    try {
      final session = await PickerPortalApi.instance.acceptOrder(widget.order.id);
      widget.onAccepted();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Commande acceptée ✓'), backgroundColor: Color(0xFF10B981)));
        context.push('/session/${session.id}');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFEF4444), duration: const Duration(seconds: 5)));
    } finally { if (mounted) setState(() => _accepting = false); }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    return Container(
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: AppTheme.border),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('#${o.id.substring(0, 8).toUpperCase()}', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w800, fontFamily: 'monospace', color: AppTheme.primary)),
            if (o.customerName != null)
              Text(o.customerName!, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
            if (o.customerPhone != null)
              Text(o.customerPhone!, style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${o.totalTtc.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w800, color: AppTheme.text)),
            Text('${o.itemCount} art.', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
          ]),
        ]),

        if (o.slotStart != null) ...[
          SizedBox(height: 6.h),
          Row(children: [
            Icon(Icons.schedule_rounded, size: 14.sp, color: AppTheme.textSub),
            SizedBox(width: 4.w),
            Text('${o.slotStart}–${o.slotEnd}', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
          ]),
        ],

        SizedBox(height: 10.h),

        SizedBox(
          width: double.infinity, height: 44.h,
          child: ElevatedButton.icon(
            onPressed: _accepting ? null : _accept,
            icon: _accepting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Icon(Icons.check_rounded, size: 18.sp),
            label: Text(_accepting ? 'Acceptation…' : 'Accepter cette commande',
              style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary, foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              elevation: 0,
            ),
          ),
        ),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.inbox_rounded, size: 64.sp, color: const Color(0xFFD1D5DB)),
    SizedBox(height: 16.h),
    Text('Aucune commande disponible', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
    SizedBox(height: 6.h),
    Text('Les commandes confirmées apparaîtront ici', style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
  ]));
}

class _ErrorState extends StatelessWidget {
  final String msg; final VoidCallback onRetry;
  const _ErrorState(this.msg, this.onRetry);
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.wifi_off_rounded, size: 48.sp, color: const Color(0xFF9CA3AF)),
    SizedBox(height: 12.h),
    Text(msg, textAlign: TextAlign.center, style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
    SizedBox(height: 20.h),
    ElevatedButton(onPressed: onRetry, child: const Text('Réessayer')),
  ]));
}
