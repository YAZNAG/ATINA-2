import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final picker  = ref.watch(authProvider).picker;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Column(children: [
          Text('Bonjour, ${picker?.name ?? 'Picker'} 👋', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          if (picker?.nodeId != null)
            Text('Node: ${picker!.nodeId.substring(0, 8)}…', style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.logout_rounded), onPressed: () => ref.read(authProvider.notifier).logout()),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(20.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(height: 8.h),

            // Stats row
            Row(children: [
              Expanded(child: _StatCard(label: 'Sessions ouvertes', value: '0', icon: Icons.lock_open_rounded,  color: AppTheme.warning)),
              SizedBox(width: 12.w),
              Expanded(child: _StatCard(label: 'En cours',          value: '0', icon: Icons.pending_rounded,    color: AppTheme.primary)),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: _StatCard(label: 'Terminées aujourd\'hui', value: '0', icon: Icons.check_circle_rounded, color: AppTheme.success)),
              SizedBox(width: 12.w),
              Expanded(child: _StatCard(label: 'Erreurs scan', value: '0', icon: Icons.error_outline_rounded, color: AppTheme.error)),
            ]),

            SizedBox(height: 32.h),

            Text('Actions rapides', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
            SizedBox(height: 16.h),

            _ActionTile(
              icon:  Icons.list_alt_rounded,
              title: 'Voir mes sessions',
              sub:   'Sessions picking assignées',
              color: AppTheme.primary,
              onTap: () => context.go('/sessions'),
            ),
            SizedBox(height: 12.h),
            _ActionTile(
              icon:  Icons.qr_code_scanner_rounded,
              title: 'Scanner un article',
              sub:   'Scan EAN13 rapide',
              color: AppTheme.warning,
              onTap: () => context.go('/scan'),
            ),

            const Spacer(),

            // Quick picker info
            Container(
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(
                color:        AppTheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16.r),
                border:       Border.all(color: AppTheme.primary.withOpacity(0.2)),
              ),
              child: Row(children: [
                CircleAvatar(radius: 22.r, backgroundColor: AppTheme.primary, child: Text(picker?.initials ?? 'P', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                SizedBox(width: 12.w),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(picker?.name ?? '', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.sp)),
                  Text(picker?.displayPhone ?? '', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
                ]),
              ]),
            ),
          ]),
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
        Container(width: 46.w, height: 46.w, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12.r)),
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
