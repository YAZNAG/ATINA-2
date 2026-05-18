import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driver = ref.watch(authProvider).driver;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title: Text('Mon profil', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(children: [
          // Avatar
          Container(
            width: 88.w, height: 88.w,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF059669), Color(0xFF10B981)]),
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: const Color(0xFF10B981).withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
            ),
            child: Center(child: Text(driver?.initials ?? 'D', style: TextStyle(color: Colors.white, fontSize: 32.sp, fontWeight: FontWeight.w800))),
          ),
          SizedBox(height: 12.h),
          Text(driver?.name ?? '—', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800)),
          Text(driver?.displayPhone ?? '', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),
          SizedBox(height: 24.h),

          // Info card
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(16.w),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _Row(icon: Icons.person_rounded,         label: 'Nom',         value: driver?.name ?? '—'),
              _Divider(),
              _Row(icon: Icons.phone_rounded,          label: 'Téléphone',   value: driver?.displayPhone ?? '—'),
              if (driver?.vehicleType != null) ...[
                _Divider(),
                _Row(icon: Icons.directions_car_rounded, label: 'Véhicule', value: driver!.vehicleType!),
              ],
              if (driver?.vehiclePlate != null) ...[
                _Divider(),
                _Row(icon: Icons.badge_rounded,        label: 'Plaque',      value: driver!.vehiclePlate!),
              ],
              _Divider(),
              Row(children: [
                Container(width: 10.w, height: 10.w, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                SizedBox(width: 8.w),
                Text('En ligne', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF10B981))),
              ]),
            ]),
          ),

          SizedBox(height: 24.h),

          // Logout
          SizedBox(
            width: double.infinity, height: 50.h,
            child: ElevatedButton.icon(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                    title: Text('Déconnexion', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
                    content: Text('Voulez-vous vous déconnecter ?', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
                      TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Déconnecter', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700))),
                    ],
                  ),
                );
                if (ok == true) await ref.read(authProvider.notifier).logout();
              },
              icon: Icon(Icons.logout_rounded, size: 20.sp),
              label: const Text('Se déconnecter'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFEF2F2),
                foregroundColor: const Color(0xFFEF4444),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                elevation: 0,
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon; final String label, value;
  const _Row({required this.icon, required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 10.h),
    child: Row(children: [
      Icon(icon, size: 18.sp, color: AppTheme.textSub),
      SizedBox(width: 10.w),
      Text(label, style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
      const Spacer(),
      Text(value, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.text)),
    ]),
  );
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Divider(height: 1, color: AppTheme.border);
}
