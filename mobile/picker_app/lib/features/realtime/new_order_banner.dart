import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'realtime_provider.dart';

/// Bannière flottante affichée quand une nouvelle commande arrive en temps réel.
/// À placer dans le Scaffold.body via [NewOrderOverlay].
class NewOrderBanner extends ConsumerWidget {
  const NewOrderBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(realtimeProvider).pendingNotifications;
    if (notifications.isEmpty) return const SizedBox.shrink();

    final notif = notifications.first;

    return Positioned(
      top: 0, left: 0, right: 0,
      child: Material(
        color: Colors.transparent,
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(12.w, 8.h, 12.w, 0),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              decoration: BoxDecoration(
                color: const Color(0xFF059669),
                borderRadius: BorderRadius.circular(16.r),
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
              child: Row(children: [
                Container(
                  width: 40.w, height: 40.w,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), shape: BoxShape.circle),
                  child: Icon(Icons.inventory_2_rounded, color: Colors.white, size: 20.sp),
                ),
                SizedBox(width: 12.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Nouvelle commande !', style: TextStyle(color: Colors.white, fontSize: 13.sp, fontWeight: FontWeight.w700)),
                  Text('${notif.customerName} — ${notif.totalTtc.toStringAsFixed(2)} MAD (${notif.itemsCount} art.)',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12.sp)),
                ])),
                Column(mainAxisSize: MainAxisSize.min, children: [
                  GestureDetector(
                    onTap: () {
                      ref.read(realtimeProvider.notifier).dismissNotification(notif.orderId);
                      context.push('/available-orders');
                    },
                    child: Container(
                      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20.r)),
                      child: Text('Voir', style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w800, color: const Color(0xFF059669))),
                    ),
                  ),
                  SizedBox(height: 4.h),
                  GestureDetector(
                    onTap: () => ref.read(realtimeProvider.notifier).dismissNotification(notif.orderId),
                    child: Icon(Icons.close_rounded, color: Colors.white.withValues(alpha: 0.7), size: 16.sp),
                  ),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
