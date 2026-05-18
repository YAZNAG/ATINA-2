import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../sessions/providers/sessions_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final picker       = ref.watch(authProvider).picker;
    final available    = ref.watch(availableOrdersProvider);
    final myOrders     = ref.watch(myOrdersProvider);

    final availableCount = available.valueOrNull?.length ?? 0;
    final groups         = myOrders.valueOrNull ?? {};
    final active         = groups['active']    ?? [];
    final completed      = groups['completed'] ?? [];
    final openCount      = active.where((s) => s.status.code == 'open').length;
    final inProgCount    = active.where((s) => s.status.code == 'in_progress').length;
    final completedCount = completed.length;
    final errorCount     = active.fold(0, (s, sess) => s + sess.errorCount);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Column(children: [
          Text('Bonjour, ${picker?.name ?? 'Picker'} 👋', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          Text('Dark Store — Picker', style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () {
            ref.invalidate(availableOrdersProvider);
            ref.invalidate(myOrdersProvider);
          }),
          IconButton(icon: const Icon(Icons.person_outline_rounded), onPressed: () => context.push('/profile')),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(availableOrdersProvider);
            ref.invalidate(myOrdersProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.all(20.w),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(height: 8.h),

              // Stats
              Row(children: [
                Expanded(child: _StatCard(label: 'Disponibles', value: '$availableCount', icon: Icons.inbox_rounded,    color: const Color(0xFF3B82F6))),
                SizedBox(width: 12.w),
                Expanded(child: _StatCard(label: 'À démarrer',  value: '$openCount',     icon: Icons.lock_open_rounded,color: AppTheme.warning)),
              ]),
              SizedBox(height: 12.h),
              Row(children: [
                Expanded(child: _StatCard(label: 'En cours',    value: '$inProgCount',   icon: Icons.pending_rounded,   color: AppTheme.primary)),
                SizedBox(width: 12.w),
                Expanded(child: _StatCard(label: 'Terminées',   value: '$completedCount',icon: Icons.check_circle_rounded, color: AppTheme.success)),
              ]),
              if (errorCount > 0) ...[
                SizedBox(height: 10.h),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
                  decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: AppTheme.error.withValues(alpha: 0.3))),
                  child: Row(children: [
                    Icon(Icons.warning_rounded, color: AppTheme.error, size: 18.sp),
                    SizedBox(width: 8.w),
                    Text('$errorCount erreur(s) de scan en cours', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.error)),
                  ]),
                ),
              ],

              SizedBox(height: 28.h),
              Text('Actions rapides', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
              SizedBox(height: 14.h),

              _ActionTile(
                icon: Icons.inventory_2_rounded, color: const Color(0xFF3B82F6),
                title: 'Commandes disponibles', sub: '$availableCount commande(s) à accepter',
                onTap: () => context.push('/available-orders'),
              ),
              SizedBox(height: 10.h),
              _ActionTile(
                icon: Icons.assignment_rounded, color: AppTheme.primary,
                title: 'Mes préparations', sub: '${active.length} session(s) active(s)',
                onTap: () => context.push('/my-orders'),
              ),

              SizedBox(height: 28.h),

              // Picker info
              Container(
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(16.r),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2)),
                ),
                child: Row(children: [
                  CircleAvatar(radius: 22.r, backgroundColor: AppTheme.primary, child: Text(picker?.initials ?? 'P', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                  SizedBox(width: 12.w),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(picker?.name ?? '', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.sp)),
                    Text(picker?.displayPhone ?? '', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
                  ])),
                  Icon(Icons.circle, color: AppTheme.success, size: 10.sp),
                  SizedBox(width: 4.w),
                  Text('En service', style: TextStyle(fontSize: 11.sp, color: AppTheme.success, fontWeight: FontWeight.w600)),
                ]),
              ),
              SizedBox(height: 16.h),
            ]),
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(16.w),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r), border: Border.all(color: const Color(0xFFE5E7EB))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color, size: 26.sp),
      SizedBox(height: 8.h),
      Text(value, style: TextStyle(fontSize: 28.sp, fontWeight: FontWeight.w800, color: color)),
      Text(label, style: TextStyle(fontSize: 11.sp, color: const Color(0xFF6B7280))),
    ]),
  );
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title, sub;
  final Color color;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.title, required this.sub, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(16.r),
    child: Container(
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r), border: Border.all(color: const Color(0xFFE5E7EB))),
      child: Row(children: [
        Container(width: 46.w, height: 46.w, decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(12.r)),
          child: Icon(icon, color: color, size: 24.sp)),
        SizedBox(width: 14.w),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.sp)),
          Text(sub, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280))),
        ])),
        Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFF9CA3AF)),
      ]),
    ),
  );
}
