import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/orders_provider.dart';
import '../widgets/order_card.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(customerOrdersProvider);

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
        title: Text('Mes commandes',
            style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: () async => ref.invalidate(customerOrdersProvider),
        child: ordersAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(customerOrdersProvider)),
          data: (list) => list.isEmpty
              ? _EmptyState()
              : ListView.separated(
                  padding: EdgeInsets.all(16.w),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => SizedBox(height: 12.h),
                  itemBuilder: (_, i) => OrderCard(order: list[i]),
                ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.receipt_long_outlined, size: 72.sp, color: const Color(0xFFD1D5DB)),
      SizedBox(height: 16.h),
      Text('Aucune commande', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
      SizedBox(height: 8.h),
      Text('Vos commandes apparaîtront ici', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF9CA3AF))),
      SizedBox(height: 28.h),
      GestureDetector(
        onTap: () => context.go('/home'),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 14.h),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
            borderRadius: BorderRadius.circular(14.r),
          ),
          child: Text('Commencer mes achats', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15.sp)),
        ),
      ),
    ]),
  );
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.wifi_off_rounded, size: 56.sp, color: const Color(0xFF9CA3AF)),
      SizedBox(height: 12.h),
      Text('Impossible de charger les commandes', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
      SizedBox(height: 16.h),
      TextButton(onPressed: onRetry, child: const Text('Réessayer')),
    ]),
  );
}
