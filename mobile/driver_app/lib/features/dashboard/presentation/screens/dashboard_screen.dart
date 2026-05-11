import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driver = ref.watch(authProvider).driver;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Column(children: [
          Text('${driver?.vehicleEmoji ?? '🚚'} ${driver?.name ?? 'Livreur'}', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          Text('Dark Store Driver', style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub)),
        ]),
        actions: [IconButton(icon: const Icon(Icons.logout_rounded), onPressed: () => ref.read(authProvider.notifier).logout())],
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(20.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Vehicle info card
            if (driver?.vehicleType != null || driver?.vehiclePlate != null)
              Container(
                width: double.infinity,
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF059669), Color(0xFF10B981)]),
                  borderRadius: BorderRadius.circular(16.r),
                ),
                child: Row(children: [
                  Text(driver?.vehicleEmoji ?? '🚚', style: TextStyle(fontSize: 36.sp)),
                  SizedBox(width: 16.w),
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(driver?.vehicleType ?? 'Véhicule', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                    if (driver?.vehiclePlate != null)
                      Text(driver!.vehiclePlate!, style: const TextStyle(color: Colors.white70, fontFamily: 'monospace', fontSize: 13)),
                  ]),
                ]),
              ),

            SizedBox(height: 24.h),
            Text('Tableau de bord', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
            SizedBox(height: 16.h),

            // Stats (placeholders)
            Row(children: [
              Expanded(child: _StatCard(label: 'Tournées du jour', value: '—', icon: Icons.route_rounded,        color: AppTheme.primary)),
              SizedBox(width: 12.w),
              Expanded(child: _StatCard(label: 'Livraisons',       value: '—', icon: Icons.check_circle_rounded, color: AppTheme.success)),
            ]),
            SizedBox(height: 12.h),
            Row(children: [
              Expanded(child: _StatCard(label: 'En attente',        value: '—', icon: Icons.pending_rounded,     color: AppTheme.warning)),
              SizedBox(width: 12.w),
              Expanded(child: _StatCard(label: 'COD à collecter',   value: '—', icon: Icons.payments_outlined,   color: const Color(0xFF6366F1))),
            ]),

            SizedBox(height: 32.h),

            // Module livraison placeholder
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(20.w),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.07),
                borderRadius: BorderRadius.circular(16.r),
                border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
              ),
              child: Column(children: [
                Icon(Icons.local_shipping_outlined, size: 40.sp, color: AppTheme.primary),
                SizedBox(height: 12.h),
                Text('Module Livraison', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16.sp, color: AppTheme.primary)),
                SizedBox(height: 6.h),
                Text('Les tournées et livraisons seront disponibles ici.\nModule en cours de développement.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
              ]),
            ),

            const Spacer(),

            // Driver info card
            Container(
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r), border: Border.all(color: AppTheme.border)),
              child: Row(children: [
                CircleAvatar(radius: 22.r, backgroundColor: AppTheme.primary, child: Text(driver?.initials ?? 'D', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
                SizedBox(width: 12.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(driver?.name ?? '', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14.sp)),
                  Text(driver?.displayPhone ?? '', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
                ])),
                Icon(Icons.circle, color: AppTheme.success, size: 10.sp),
                SizedBox(width: 4.w),
                Text('En ligne', style: TextStyle(fontSize: 11.sp, color: AppTheme.success, fontWeight: FontWeight.w600)),
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
      Icon(icon, color: color, size: 24.sp),
      SizedBox(height: 8.h),
      Text(value, style: TextStyle(fontSize: 24.sp, fontWeight: FontWeight.w800, color: color)),
      Text(label, style: TextStyle(fontSize: 11.sp, color: const Color(0xFF6B7280))),
    ]),
  );
}
