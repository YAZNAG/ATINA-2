import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/profile_provider.dart';

class PointsScreen extends ConsumerWidget {
  const PointsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    const amber = Color(0xFFF59E0B);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor:  Colors.white,
        elevation:        0,
        surfaceTintColor: Colors.transparent,
        leading:     IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title:       Text('Points fidélité', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
        error:   (e, _) => Center(child: Text('Erreur', style: TextStyle(color: const Color(0xFF9CA3AF), fontSize: 14.sp))),
        data:    (profile) => SingleChildScrollView(
          padding: EdgeInsets.all(20.w),
          child: Column(children: [
            // Main balance card
            Container(
              width:       double.infinity,
              padding:     EdgeInsets.symmetric(vertical: 36.h, horizontal: 24.w),
              decoration:  BoxDecoration(
                gradient:     const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [amber, Color(0xFFD97706)]),
                borderRadius: BorderRadius.circular(24.r),
                boxShadow: [BoxShadow(color: amber.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 10))],
              ),
              child: Column(children: [
                Icon(Icons.stars_rounded, color: Colors.white.withValues(alpha: 0.8), size: 44.sp),
                SizedBox(height: 14.h),
                Text('Points disponibles', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 14.sp)),
                SizedBox(height: 8.h),
                Text('${profile.pointsBalance}', style: TextStyle(color: Colors.white, fontSize: 48.sp, fontWeight: FontWeight.w800, letterSpacing: -1)),
                Text('points', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 16.sp)),
              ]),
            ),

            SizedBox(height: 16.h),

            // Lifetime stat
            Container(
              padding:    EdgeInsets.all(16.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r)),
              child: Row(children: [
                Container(
                  width: 44.w, height: 44.w,
                  decoration: BoxDecoration(color: amber.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Icon(Icons.workspace_premium_rounded, size: 22.sp, color: amber),
                ),
                SizedBox(width: 14.w),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Points accumulés au total', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
                  SizedBox(height: 4.h),
                  Text('${profile.pointsLifetime} points', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
                ]),
              ]),
            ),

            SizedBox(height: 16.h),

            // How it works
            _InfoTile(icon: Icons.info_outline_rounded, color: amber,
              title: 'Comment gagner des points ?',
              content: 'Vous gagnez des points à chaque commande passée. Plus vous commandez, plus vous accumulez de points fidélité.',
            ),
            SizedBox(height: 12.h),
            _InfoTile(icon: Icons.redeem_rounded, color: AppTheme.primary,
              title: 'Comment utiliser vos points ?',
              content: 'Vos points peuvent être convertis en réduction lors du paiement. La conversion est gérée automatiquement lors du checkout.',
            ),
            SizedBox(height: 12.h),
            _InfoTile(icon: Icons.card_giftcard_rounded, color: const Color(0xFF10B981),
              title: 'Code de parrainage',
              content: profile.referralCode != null
                  ? 'Partagez votre code ${profile.referralCode} et gagnez des points bonus pour chaque ami qui s\'inscrit.'
                  : 'Partagez votre code de parrainage et gagnez des points bonus.',
            ),
          ]),
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final Color    color;
  final String   title, content;
  const _InfoTile({required this.icon, required this.color, required this.title, required this.content});

  @override
  Widget build(BuildContext context) => Container(
    padding:    EdgeInsets.all(16.w),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 6)]),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 36.w, height: 36.w,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
        child: Icon(icon, size: 18.sp, color: color)),
      SizedBox(width: 14.w),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
        SizedBox(height: 6.h),
        Text(content, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280), height: 1.5)),
      ])),
    ]),
  );
}
