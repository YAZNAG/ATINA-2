import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/constants/api_constants.dart';

class StripePaymentScreen extends ConsumerStatefulWidget {
  final String orderId;
  final double amount;

  const StripePaymentScreen({
    super.key,
    required this.orderId,
    required this.amount,
  });

  @override
  ConsumerState<StripePaymentScreen> createState() => _StripePaymentScreenState();
}

class _StripePaymentScreenState extends ConsumerState<StripePaymentScreen> {
  bool _loading = true;
  String? _error;
  String? _checkoutUrl;

  @override
  void initState() {
    super.initState();
    _createSession();
  }

  Future<void> _createSession() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = DioClient.instance.dio;
      final res = await dio.post(ApiConstants.stripeCreateSession, data: {
        'order_id': widget.orderId,
      });
      final data = res.data['data'] as Map<String, dynamic>? ?? {};
      setState(() {
        _checkoutUrl = data['checkout_url'] as String?;
        _loading = false;
      });
      if (_checkoutUrl != null) {
        await _openStripe();
      }
    } on DioException catch (e) {
      setState(() { _error = e.response?.data?['message'] ?? 'Erreur Stripe'; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _openStripe() async {
    if (_checkoutUrl == null) return;
    final uri = Uri.parse(_checkoutUrl!);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      setState(() => _error = 'Impossible d\'ouvrir Stripe Checkout');
    }
  }

  @override
  Widget build(BuildContext context) {
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
        title: Text('Paiement par carte', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24.w),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_loading) ...[
                const CircularProgressIndicator(color: AppTheme.primary),
                SizedBox(height: 16.h),
                Text('Chargement de Stripe...', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
              ] else if (_error != null) ...[
                Icon(Icons.error_outline_rounded, size: 56.sp, color: const Color(0xFFEF4444)),
                SizedBox(height: 16.h),
                Text(_error!, style: TextStyle(fontSize: 14.sp, color: const Color(0xFFEF4444)), textAlign: TextAlign.center),
                SizedBox(height: 24.h),
                GestureDetector(
                  onTap: _createSession,
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 14.h),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
                      borderRadius: BorderRadius.circular(14.r),
                    ),
                    child: Text('Réessayer', style: TextStyle(color: Colors.white, fontSize: 15.sp, fontWeight: FontWeight.w700)),
                  ),
                ),
              ] else ...[
                Container(
                  width: 80.w, height: 80.w,
                  decoration: BoxDecoration(color: const Color(0xFF635BFF).withValues(alpha: 0.1), shape: BoxShape.circle),
                  child: Icon(Icons.credit_card_rounded, size: 40.sp, color: const Color(0xFF635BFF)),
                ),
                SizedBox(height: 20.h),
                Text('Stripe Checkout', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
                SizedBox(height: 8.h),
                Text('${widget.amount.toStringAsFixed(2)} MAD',
                    style: TextStyle(fontSize: 28.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
                SizedBox(height: 24.h),
                Container(
                  padding: EdgeInsets.all(16.w),
                  decoration: BoxDecoration(color: const Color(0xFFF0F4FF), borderRadius: BorderRadius.circular(14.r)),
                  child: Column(children: [
                    Row(children: [
                      Icon(Icons.info_outline_rounded, size: 16.sp, color: const Color(0xFF6366F1)),
                      SizedBox(width: 8.w),
                      Text('Carte test :', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
                    ]),
                    SizedBox(height: 4.h),
                    Text('4242 4242 4242 4242', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w800, color: const Color(0xFF635BFF), fontFamily: 'monospace')),
                    Text('Date future / CVC libre', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280))),
                  ]),
                ),
                SizedBox(height: 24.h),
                GestureDetector(
                  onTap: _openStripe,
                  child: Container(
                    width: double.infinity, height: 56.h,
                    decoration: BoxDecoration(
                      color: const Color(0xFF635BFF),
                      borderRadius: BorderRadius.circular(16.r),
                      boxShadow: [BoxShadow(color: const Color(0xFF635BFF).withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.open_in_new_rounded, size: 20.sp, color: Colors.white),
                      SizedBox(width: 8.w),
                      Text('Ouvrir Stripe Checkout', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ),
                SizedBox(height: 12.h),
                TextButton(
                  onPressed: () => context.pop(),
                  child: Text('Annuler', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF9CA3AF))),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
