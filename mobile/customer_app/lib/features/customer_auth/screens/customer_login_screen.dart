import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

class CustomerLoginScreen extends ConsumerStatefulWidget {
  const CustomerLoginScreen({super.key});

  @override
  ConsumerState<CustomerLoginScreen> createState() => _State();
}

class _State extends ConsumerState<CustomerLoginScreen> {
  final _ctrl    = TextEditingController();
  String _country = '+212';

  static const Color _red   = Color(0xFFCC0A0A);
  static const Color _green = Color(0xFF25D366); // WhatsApp

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  String _formatted() => _ctrl.text.trim().replaceAll(' ', '').replaceFirst(RegExp(r'^0'), '');

  bool get _valid => _formatted().length >= 9;

  Future<void> _send(String channel) async {
    if (!_valid) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Entrez un numéro valide (9 chiffres minimum)'),
        backgroundColor: Colors.red,
      ));
      return;
    }
    final ok = await ref.read(customerAuthProvider.notifier).requestOtp(
      phoneCountry: _country,
      phone:        _formatted(),
    );
    if (ok && mounted) {
      context.push('/customer/otp', extra: channel);
    } else if (mounted) {
      final err = ref.read(customerAuthProvider).errorMessage;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err ?? 'Erreur réseau'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(customerAuthProvider).isLoading;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light),
      child: Scaffold(
        backgroundColor: _red,
        body: Stack(children: [
          // Red background — full screen
          Container(color: _red),

          // Content
          SafeArea(
            child: Column(children: [
              // ── Logo area ──────────────────────────────────────────────────
              Expanded(
                child: Center(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    // Logo placeholder (icon)
                    Container(
                      width: 90.w, height: 90.w,
                      decoration: BoxDecoration(
                        color:        Colors.white,
                        borderRadius: BorderRadius.circular(22.r),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.18), blurRadius: 20, offset: const Offset(0, 8))],
                      ),
                      child: Icon(Icons.storefront_rounded, color: _red, size: 46.sp),
                    ),
                    SizedBox(height: 18.h),
                    Text(
                      'El Herri',
                      style: TextStyle(color: Colors.white, fontSize: 32.sp, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                    ),
                    SizedBox(height: 4.h),
                    Text(
                      'الهري',
                      style: TextStyle(color: Colors.white70, fontSize: 20.sp, fontWeight: FontWeight.w500),
                    ),
                  ]),
                ),
              ),

              // ── White card ─────────────────────────────────────────────────
              Container(
                decoration: BoxDecoration(
                  color:        Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(32.r)),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, -4))],
                ),
                padding: EdgeInsets.fromLTRB(24.w, 32.h, 24.w, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                  Text(
                    'Prêt à commander ?',
                    style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w800, color: const Color(0xFF1A1A1A)),
                  ),
                  SizedBox(height: 6.h),
                  Text(
                    'Connectez-vous pour vivre une expérience Fantastic.',
                    style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280)),
                  ),

                  SizedBox(height: 28.h),

                  // Phone input
                  Container(
                    decoration: BoxDecoration(
                      border:       Border.all(color: const Color(0xFFE5E7EB), width: 1.5),
                      borderRadius: BorderRadius.circular(14.r),
                    ),
                    child: Row(children: [
                      // Flag + country
                      InkWell(
                        borderRadius: BorderRadius.horizontal(left: Radius.circular(14.r)),
                        onTap: () => _showCountryPicker(),
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 18.h),
                          decoration: BoxDecoration(
                            color:        _red.withOpacity(0.07),
                            borderRadius: BorderRadius.horizontal(left: Radius.circular(14.r)),
                            border:       Border(right: BorderSide(color: const Color(0xFFE5E7EB), width: 1.5)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Text(_countryFlag(), style: TextStyle(fontSize: 20.sp)),
                            SizedBox(width: 6.w),
                            Text(_country, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700, color: _red)),
                            SizedBox(width: 4.w),
                            Icon(Icons.expand_more, color: _red, size: 18.sp),
                          ]),
                        ),
                      ),
                      // Number field
                      Expanded(
                        child: TextField(
                          controller:   _ctrl,
                          keyboardType: TextInputType.phone,
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d\s]'))],
                          style:        TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w600, letterSpacing: 1),
                          decoration:   InputDecoration(
                            hintText:      'XXX-XXX-XXXXX',
                            hintStyle:     TextStyle(color: const Color(0xFFCBD5E0), fontSize: 16.sp),
                            border:        InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 18.h),
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                    ]),
                  ),

                  SizedBox(height: 20.h),

                  // SMS + WhatsApp buttons
                  Row(children: [
                    Expanded(
                      child: _AuthButton(
                        label:    'SMS',
                        icon:     Icons.sms_outlined,
                        color:    _red,
                        outlined: true,
                        loading:  loading,
                        onTap:    () => _send('sms'),
                      ),
                    ),
                    SizedBox(width: 12.w),
                    Expanded(
                      child: _AuthButton(
                        label:    'WhatsApp',
                        icon:     Icons.chat_outlined,
                        color:    _green,
                        outlined: false,
                        loading:  loading,
                        onTap:    () => _send('whatsapp'),
                      ),
                    ),
                  ]),

                  SizedBox(height: 24.h),

                  // Terms
                  Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8.w),
                      child: RichText(
                        textAlign: TextAlign.center,
                        text: TextSpan(
                          style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF), height: 1.6),
                          children: [
                            const TextSpan(text: 'En me connectant, j\'accepte tous les\n'),
                            TextSpan(
                              text: 'Conditions générales',
                              style: TextStyle(color: _red, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                            ),
                            const TextSpan(text: ' et '),
                            TextSpan(
                              text: 'Politique de confidentialité',
                              style: TextStyle(color: _red, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Bottom safe area
                  SizedBox(height: MediaQuery.of(context).padding.bottom + 20.h),
                ]),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  void _showCountryPicker() {
    showModalBottomSheet(
      context: context,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (_) => _CountrySheet(
        selected: _country,
        onSelect: (c) { setState(() => _country = c); Navigator.pop(context); },
      ),
    );
  }

  String _countryFlag() {
    switch (_country) {
      case '+212': return '🇲🇦';
      case '+33':  return '🇫🇷';
      case '+213': return '🇩🇿';
      case '+216': return '🇹🇳';
      default:     return '🌍';
    }
  }
}

// ── Auth button ────────────────────────────────────────────────────────────────
class _AuthButton extends StatelessWidget {
  final String   label;
  final IconData icon;
  final Color    color;
  final bool     outlined;
  final bool     loading;
  final VoidCallback onTap;

  const _AuthButton({required this.label, required this.icon, required this.color, required this.outlined, required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 52.h,
        decoration: BoxDecoration(
          color:        outlined ? Colors.white : color,
          border:       Border.all(color: color, width: 2),
          borderRadius: BorderRadius.circular(14.r),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (loading)
            SizedBox(width: 18.w, height: 18.w, child: CircularProgressIndicator(color: outlined ? color : Colors.white, strokeWidth: 2.5))
          else ...[
            Icon(icon, color: outlined ? color : Colors.white, size: 20.sp),
            SizedBox(width: 8.w),
            Text(label, style: TextStyle(color: outlined ? color : Colors.white, fontWeight: FontWeight.w700, fontSize: 15.sp)),
          ],
        ]),
      ),
    );
  }
}

// ── Country picker ─────────────────────────────────────────────────────────────
class _CountrySheet extends StatelessWidget {
  final String selected;
  final void Function(String) onSelect;
  const _CountrySheet({required this.selected, required this.onSelect});

  static const _countries = [
    ('+212', '🇲🇦', 'Maroc'),
    ('+33',  '🇫🇷', 'France'),
    ('+213', '🇩🇿', 'Algérie'),
    ('+216', '🇹🇳', 'Tunisie'),
  ];

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.all(20.w),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Choisir l\'indicatif', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w700)),
      SizedBox(height: 16.h),
      ..._countries.map((c) => ListTile(
        leading:  Text(c.$2, style: TextStyle(fontSize: 24.sp)),
        title:    Text('${c.$3} (${c.$1})', style: TextStyle(fontSize: 15.sp)),
        trailing: selected == c.$1 ? const Icon(Icons.check_circle, color: Color(0xFFCC0A0A)) : null,
        onTap:    () => onSelect(c.$1),
      )),
      SizedBox(height: 12.h),
    ]),
  );
}
