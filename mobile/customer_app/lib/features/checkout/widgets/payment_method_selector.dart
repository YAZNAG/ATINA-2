import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/theme/app_theme.dart';
import '../models/checkout_meta_model.dart';

class PaymentMethodSelector extends StatelessWidget {
  final List<PaymentMethodModel> methods;
  final String? selectedMethodId;
  final double? walletBalance;
  final int? pointsBalance;
  final double? pointsConversionRate;
  final double? totalAmount;
  final ValueChanged<PaymentMethodModel> onSelected;
  final String? error;

  const PaymentMethodSelector({
    super.key,
    required this.methods,
    required this.selectedMethodId,
    this.walletBalance,
    this.pointsBalance,
    this.pointsConversionRate,
    this.totalAmount,
    required this.onSelected,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    final activeMethods = methods.where((m) => m.isActive).toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Méthode de paiement *', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
      SizedBox(height: 10.h),
      ...activeMethods.map((method) {
        final sel = selectedMethodId == method.id;
        final info = _getMethodInfo(method);

        return Padding(
          padding: EdgeInsets.only(bottom: 8.h),
          child: GestureDetector(
            onTap: info.enabled ? () => onSelected(method) : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: EdgeInsets.all(14.w),
              decoration: BoxDecoration(
                color: sel ? AppTheme.primary.withValues(alpha: 0.06) : Colors.white,
                borderRadius: BorderRadius.circular(14.r),
                border: Border.all(
                  color: sel ? AppTheme.primary : const Color(0xFFE5E7EB),
                  width: sel ? 2 : 1,
                ),
              ),
              child: Row(children: [
                Container(
                  width: 44.w, height: 44.w,
                  decoration: BoxDecoration(
                    color: sel ? AppTheme.primary : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                  child: Icon(info.icon, size: 22.sp, color: sel ? Colors.white : const Color(0xFF6B7280)),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(method.nameFr, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: info.enabled ? const Color(0xFF111827) : const Color(0xFF9CA3AF))),
                    if (info.subtitle != null) ...[
                      SizedBox(height: 2.h),
                      Text(info.subtitle!, style: TextStyle(fontSize: 11.sp, color: info.enabled ? const Color(0xFF6B7280) : const Color(0xFFD1D5DB))),
                    ],
                  ]),
                ),
                if (!info.enabled)
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                    decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8.r)),
                    child: Text('Indisponible', style: TextStyle(fontSize: 10.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w700)),
                  ),
              ]),
            ),
          ),
        );
      }),
      if (error != null) ...[
        SizedBox(height: 6.h),
        Text(error!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFFEF4444))),
      ],
    ]);
  }

  _MethodInfo _getMethodInfo(PaymentMethodModel method) {
    switch (method.code) {
      case 'cod':
        final enabled = totalAmount == null || method.codMaxAmount == null || totalAmount! <= method.codMaxAmount!;
        final subtitle = method.codMaxAmount != null && totalAmount != null && totalAmount! > method.codMaxAmount!
            ? 'Montant max COD: ${method.codMaxAmount!.toStringAsFixed(2)} MAD'
            : null;
        return _MethodInfo(icon: Icons.money_rounded, enabled: enabled, subtitle: subtitle);

      case 'wallet':
        final enabled = walletBalance != null && totalAmount != null && walletBalance! >= totalAmount!;
        final subtitle = 'Solde: ${walletBalance?.toStringAsFixed(2) ?? '0.00'} MAD';
        return _MethodInfo(icon: Icons.account_balance_wallet_rounded, enabled: enabled, subtitle: !enabled ? 'Solde insuffisant' : subtitle);

      case 'points':
        final pointsValue = pointsBalance != null && pointsConversionRate != null
            ? pointsBalance! * pointsConversionRate!
            : 0.0;
        final enabled = totalAmount != null && pointsValue >= totalAmount!;
        final subtitle = '${pointsBalance ?? 0} pts (${pointsValue.toStringAsFixed(2)} MAD)';
        return _MethodInfo(icon: Icons.stars_rounded, enabled: enabled, subtitle: !enabled ? 'Points insuffisants' : subtitle);

      case 'mixed':
        final walletOk = walletBalance != null && walletBalance! > 0;
        return _MethodInfo(icon: Icons.compare_arrows_rounded, enabled: walletOk, subtitle: walletOk ? 'Wallet + reste en COD' : 'Wallet requis');

      default:
        return _MethodInfo(icon: Icons.payment_rounded, enabled: false, subtitle: 'Méthode non disponible');
    }
  }
}

class _MethodInfo {
  final IconData icon;
  final bool enabled;
  final String? subtitle;
  const _MethodInfo({required this.icon, required this.enabled, this.subtitle});
}
