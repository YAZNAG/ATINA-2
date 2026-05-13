import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';

class CheckoutSuccessScreen extends ConsumerWidget {
  final String orderId;
  const CheckoutSuccessScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24.w),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(
                width: 100.w, height: 100.w,
                decoration: BoxDecoration(
                  color: AppTheme.success.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check_circle_rounded, size: 56.sp, color: AppTheme.success),
              ),
              SizedBox(height: 24.h),
              Text('Commande confirmée !', style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
              SizedBox(height: 8.h),
              Text('Votre commande a été créée avec succès.', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280)), textAlign: TextAlign.center),
              SizedBox(height: 24.h),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 20.w, vertical: 16.h),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r)),
                child: Column(children: [
                  Text('Référence commande', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF))),
                  SizedBox(height: 6.h),
                  Text(orderId, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                  SizedBox(height: 4.h),
                  Text('Statut: En attente', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280))),
                ]),
              ),
              SizedBox(height: 32.h),
              GestureDetector(
                onTap: () => context.go('/orders/${orderId}'),
                child: Container(
                  width: double.infinity, height: 54.h,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
                    borderRadius: BorderRadius.circular(16.r),
                    boxShadow: const [BoxShadow(color: Color(0x44DC2626), blurRadius: 16, offset: Offset(0, 6))],
                  ),
                  child: Center(
                    child: Text('Voir ma commande', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700)),
                  ),
                ),
              ),
              SizedBox(height: 12.h),
              TextButton(
                onPressed: () => context.go('/home'),
                child: Text('Retour à l\'accueil', style: TextStyle(fontSize: 14.sp, color: AppTheme.primary, fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
