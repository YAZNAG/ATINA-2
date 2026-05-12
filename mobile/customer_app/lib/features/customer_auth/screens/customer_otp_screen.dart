import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

class CustomerOtpScreen extends ConsumerStatefulWidget {
  final String channel; // 'sms' | 'whatsapp'
  const CustomerOtpScreen({super.key, required this.channel});

  @override
  ConsumerState<CustomerOtpScreen> createState() => _State();
}

class _State extends ConsumerState<CustomerOtpScreen> {
  final List<TextEditingController> _ctrls = List.generate(4, (_) => TextEditingController());
  final List<FocusNode>             _nodes = List.generate(4, (_) => FocusNode());
  String _errorMsg = '';

  static const Color _red   = Color(0xFFCC0A0A);
  static const Color _grey  = Color(0xFFF3F4F6);
  static const Color _text  = Color(0xFF1A1A1A);

  @override
  void dispose() {
    for (final c in _ctrls) c.dispose();
    for (final n in _nodes) n.dispose();
    super.dispose();
  }

  String get _otp => _ctrls.map((c) => c.text).join();
  bool   get _full => _otp.length == 4;

  void _onDigit(String d) {
    for (int i = 0; i < 4; i++) {
      if (_ctrls[i].text.isEmpty) {
        _ctrls[i].text = d;
        setState(() => _errorMsg = '');
        if (i < 3) _nodes[i + 1].requestFocus();
        if (i == 3) FocusScope.of(context).unfocus();
        return;
      }
    }
  }

  void _onBackspace() {
    for (int i = 3; i >= 0; i--) {
      if (_ctrls[i].text.isNotEmpty) {
        _ctrls[i].text = '';
        setState(() => _errorMsg = '');
        if (i > 0) _nodes[i - 1].requestFocus();
        return;
      }
    }
  }

  void _clear() { for (final c in _ctrls) c.text = ''; setState(() => _errorMsg = ''); }

  Future<void> _verify() async {
    if (!_full) return;
    final ok = await ref.read(customerAuthProvider.notifier).verifyOtp(_otp);
    if (ok && mounted) {
      context.go('/customer/success');
    } else if (mounted) {
      final err = ref.read(customerAuthProvider).errorMessage ?? 'Code incorrect';
      setState(() => _errorMsg = err);
      _clear();
      _nodes[0].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state   = ref.watch(customerAuthProvider);
    final phone   = '${state.phoneCountry}${state.phoneNumber}';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(statusBarColor: Colors.white, statusBarIconBrightness: Brightness.dark),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(children: [
            // ── App bar ───────────────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
              child: Row(children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_rounded, color: Color(0xFF374151)),
                  onPressed: () => context.pop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                SizedBox(width: 8.w),
                Text(
                  'Vérification par téléphone',
                  style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: _text),
                ),
              ]),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(horizontal: 24.w),
                child: Column(children: [
                  SizedBox(height: 24.h),

                  // App icon
                  Container(
                    width: 80.w, height: 80.w,
                    decoration: BoxDecoration(
                      color:        _red,
                      borderRadius: BorderRadius.circular(22.r),
                      boxShadow: [BoxShadow(color: const Color(0x33CC0A0A), blurRadius: 20, offset: const Offset(0, 8))],
                    ),
                    child: Stack(alignment: Alignment.center, children: [
                      Icon(Icons.shopping_bag_rounded, color: Colors.white, size: 36.sp),
                      Positioned(
                        bottom: 12.h, right: 12.w,
                        child: Container(
                          width: 22.w, height: 22.w,
                          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                          child: Icon(Icons.check_rounded, color: _red, size: 14.sp),
                        ),
                      ),
                    ]),
                  ),

                  SizedBox(height: 32.h),

                  // OTP boxes
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(4, (i) => Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6.w),
                    child: _OtpBox(
                      controller: _ctrls[i],
                      focusNode:  _nodes[i],
                      hasValue:   _ctrls[i].text.isNotEmpty,
                      hasError:   _errorMsg.isNotEmpty,
                    ),
                  ))),

                  SizedBox(height: 20.h),

                  Text(
                    'Entrez le code de vérification (OTP)\nenvoyé à $phone',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280), height: 1.5),
                  ),

                  if (_errorMsg.isNotEmpty) ...[
                    SizedBox(height: 12.h),
                    Text(_errorMsg, style: TextStyle(color: Colors.red, fontSize: 13.sp, fontWeight: FontWeight.w600)),
                  ],

                  SizedBox(height: 28.h),

                  // Continue button
                  AnimatedOpacity(
                    opacity: _full ? 1.0 : 0.4,
                    duration: const Duration(milliseconds: 200),
                    child: GestureDetector(
                      onTap: _full ? (state.isLoading ? null : _verify) : null,
                      child: Container(
                        width: double.infinity,
                        height: 52.h,
                        decoration: BoxDecoration(
                          color:        _full ? _red : const Color(0xFFE5E7EB),
                          borderRadius: BorderRadius.circular(14.r),
                        ),
                        alignment: Alignment.center,
                        child: state.isLoading
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                            : Text('Continuer', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),

                  SizedBox(height: 16.h),

                  TextButton(
                    onPressed: () => ref.read(customerAuthProvider.notifier).requestOtp(
                      phoneCountry: state.phoneCountry,
                      phone:        state.phoneNumber,
                    ),
                    child: Text(
                      'Renvoyer le code',
                      style: TextStyle(color: _red, fontWeight: FontWeight.w600, fontSize: 14.sp),
                    ),
                  ),

                  // Hint for test
                  Container(
                    margin: EdgeInsets.only(top: 8.h),
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
                    decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(10.r), border: Border.all(color: const Color(0xFFFED7AA))),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.info_outline_rounded, color: Color(0xFFF97316), size: 16),
                      SizedBox(width: 8.w),
                      Text('Mode test — OTP : 0000', style: TextStyle(color: const Color(0xFFC2410C), fontSize: 12.sp, fontWeight: FontWeight.w600)),
                    ]),
                  ),

                  SizedBox(height: 24.h),
                ]),
              ),
            ),

            // ── Custom numeric keyboard ───────────────────────────────────────
            _NumericKeyboard(onDigit: _onDigit, onBackspace: _onBackspace),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 8.h),
          ]),
        ),
      ),
    );
  }
}

// ── Single OTP box ─────────────────────────────────────────────────────────────
class _OtpBox extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode             focusNode;
  final bool                  hasValue;
  final bool                  hasError;
  const _OtpBox({required this.controller, required this.focusNode, required this.hasValue, required this.hasError});

  @override
  State<_OtpBox> createState() => _OtpBoxState();
}

class _OtpBoxState extends State<_OtpBox> {
  @override
  void initState() { super.initState(); widget.focusNode.addListener(() => setState(() {})); }

  @override
  Widget build(BuildContext context) {
    final focused = widget.focusNode.hasFocus;
    final filled  = widget.hasValue;
    final error   = widget.hasError;

    Color borderColor = error ? Colors.red : (focused ? const Color(0xFFCC0A0A) : (filled ? const Color(0xFFCC0A0A) : const Color(0xFFD1D5DB)));

    return Container(
      width: 60.w, height: 64.h,
      decoration: BoxDecoration(
        color:        filled ? const Color(0xFFFFF5F5) : const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(14.r),
        border:       Border.all(color: borderColor, width: focused || filled ? 2 : 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        filled ? '•' : (focused ? '|' : ''),
        style: TextStyle(
          fontSize:   filled ? 28.sp : 22.sp,
          fontWeight: FontWeight.w800,
          color:      const Color(0xFFCC0A0A),
        ),
      ),
    );
  }
}

// ── Custom numeric keyboard ────────────────────────────────────────────────────
class _NumericKeyboard extends StatelessWidget {
  final void Function(String) onDigit;
  final VoidCallback           onBackspace;
  const _NumericKeyboard({required this.onDigit, required this.onBackspace});

  static const _keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF9FAFB),
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      child: Column(children: _keys.map((row) => Padding(
        padding: EdgeInsets.only(bottom: 4.h),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: row.map((k) {
          if (k.isEmpty) return SizedBox(width: 90.w, height: 52.h);
          return GestureDetector(
            onTap: k == 'del' ? onBackspace : () => onDigit(k),
            child: Container(
              width: 90.w, height: 52.h,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10.r), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 1))]),
              alignment: Alignment.center,
              child: k == 'del'
                  ? Icon(Icons.backspace_outlined, size: 22.sp, color: const Color(0xFF374151))
                  : Text(k, style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w600, color: const Color(0xFF1A1A1A))),
            ),
          );
        }).toList()),
      )).toList()),
    );
  }
}
