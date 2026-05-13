import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/profile_provider.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);
    const purple = Color(0xFF8B5CF6);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor:  Colors.white,
        elevation:        0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title:   Text('Mon Wallet', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
        error:   (e, _) => Center(child: Text('Erreur', style: TextStyle(color: const Color(0xFF9CA3AF), fontSize: 14.sp))),
        data:    (profile) => SingleChildScrollView(
          padding: EdgeInsets.all(20.w),
          child: Column(children: [
            // Balance card
            Container(
              width:       double.infinity,
              padding:     EdgeInsets.symmetric(vertical: 36.h, horizontal: 24.w),
              decoration:  BoxDecoration(
                gradient:     const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [purple, Color(0xFF6D28D9)]),
                borderRadius: BorderRadius.circular(24.r),
                boxShadow: [BoxShadow(color: purple.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 10))],
              ),
              child: Column(children: [
                Icon(Icons.account_balance_wallet_rounded, color: Colors.white.withValues(alpha: 0.7), size: 40.sp),
                SizedBox(height: 16.h),
                Text('Solde disponible', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14.sp)),
                SizedBox(height: 8.h),
                Text('${profile.walletBalance.toStringAsFixed(2)} MAD',
                    style: TextStyle(color: Colors.white, fontSize: 36.sp, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
              ]),
            ),

            SizedBox(height: 24.h),

            // Info card
            _InfoCard(icon: Icons.info_outline_rounded, color: purple, title: 'Comment utiliser votre wallet ?',
              content: 'Votre solde wallet est utilisé automatiquement lors du checkout si vous choisissez le paiement par wallet. Le solde sera déduit de votre commande.',
            ),

            SizedBox(height: 16.h),

            _InfoCard(icon: Icons.lock_outline_rounded, color: const Color(0xFF6B7280), title: 'Recharge du wallet',
              content: 'La recharge du wallet est effectuée par l\'administration. Contactez le support pour toute demande.',
            ),

            SizedBox(height: 24.h),

            // Status row
            Container(
              padding:    EdgeInsets.all(16.w),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r)),
              child: Row(children: [
                Container(
                  width: 44.w, height: 44.w,
                  decoration: BoxDecoration(
                    color:  profile.walletBalance > 0 ? AppTheme.success.withValues(alpha: 0.12) : const Color(0xFFF3F4F6),
                    shape:  BoxShape.circle,
                  ),
                  child: Icon(
                    profile.walletBalance > 0 ? Icons.check_circle_outline_rounded : Icons.remove_circle_outline_rounded,
                    size:  22.sp,
                    color: profile.walletBalance > 0 ? AppTheme.success : const Color(0xFF9CA3AF),
                  ),
                ),
                SizedBox(width: 14.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    profile.walletBalance > 0 ? 'Wallet actif' : 'Solde insuffisant',
                    style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827)),
                  ),
                  Text(
                    profile.walletBalance > 0 ? 'Paiement par wallet disponible' : 'Aucun solde pour le moment',
                    style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF)),
                  ),
                ])),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final Color    color;
  final String   title, content;
  const _InfoCard({required this.icon, required this.color, required this.title, required this.content});

  @override
  Widget build(BuildContext context) => Container(
    padding:    EdgeInsets.all(16.w),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 6)]),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 36.w, height: 36.w, decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
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
