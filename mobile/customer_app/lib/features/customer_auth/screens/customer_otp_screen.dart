import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

const _red     = Color(0xFFDC2626);
const _darkRed = Color(0xFFB91C1C);

class CustomerOtpScreen extends ConsumerStatefulWidget {
  // channel: 'sms' | 'whatsapp' (kept for compatibility)
  final String channel;
  const CustomerOtpScreen({super.key, this.channel = 'sms'});

  @override
  ConsumerState<CustomerOtpScreen> createState() => _State();
}

class _State extends ConsumerState<CustomerOtpScreen>
    with SingleTickerProviderStateMixin {

  final List<TextEditingController> _ctrls = List.generate(4, (_) => TextEditingController());
  final List<FocusNode>             _nodes = List.generate(4, (_) => FocusNode());
  String _errorMsg = '';

  // Resend timer
  static const _resendSeconds = 60;
  int   _remaining = _resendSeconds;
  Timer? _timer;

  late final AnimationController _anim;
  late final Animation<double>   _fade;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.white,
      statusBarIconBrightness: Brightness.dark,
    ));
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _fade = CurvedAnimation(parent: _anim, curve: Curves.easeIn);
    _anim.forward();
    _startTimer();
    // Auto-focus first box
    WidgetsBinding.instance.addPostFrameCallback((_) => _nodes[0].requestFocus());
    // Rebuild on focus change to animate OTP boxes
    for (final n in _nodes) {
      n.addListener(() { if (mounted) setState(() {}); }
      );
    }
  }

  @override
  void dispose() {
    _anim.dispose();
    _timer?.cancel();
    for (final c in _ctrls) { c.dispose(); }
    for (final n in _nodes) { n.dispose(); }
    super.dispose();
  }

  void _startTimer() {
    _remaining = _resendSeconds;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_remaining <= 0) {
        t.cancel();
      } else {
        if (mounted) setState(() => _remaining--);
      }
    });
  }

  String get _otp  => _ctrls.map((c) => c.text).join();
  bool   get _full => _otp.length == 4;

  void _onDigit(String d) {
    for (int i = 0; i < 4; i++) {
      if (_ctrls[i].text.isEmpty) {
        setState(() { _ctrls[i].text = d; _errorMsg = ''; });
        if (i < 3) { _nodes[i + 1].requestFocus(); }
        if (i == 3) { FocusScope.of(context).unfocus(); }
        return;
      }
    }
  }

  void _onBackspace() {
    for (int i = 3; i >= 0; i--) {
      if (_ctrls[i].text.isNotEmpty) {
        setState(() { _ctrls[i].text = ''; _errorMsg = ''; });
        if (i > 0) { _nodes[i - 1].requestFocus(); }
        return;
      }
    }
  }

  Future<void> _verify() async {
    if (!_full) return;
    final ok = await ref.read(customerAuthProvider.notifier).verifyOtp(_otp);
    if (!ok && mounted) {
      final err = ref.read(customerAuthProvider).error ?? 'Code incorrect';
      // Clear boxes first, then show error (don't call _clearBoxes which resets error)
      for (final c in _ctrls) { c.text = ''; }
      setState(() => _errorMsg = err);
      _nodes[0].requestFocus();
    }
  }

  Future<void> _resend() async {
    if (_remaining > 0) return;
    await ref.read(customerAuthProvider.notifier).resendOtp();
    _startTimer();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('Code renvoyé avec succès', style: TextStyle(color: Colors.white)),
        backgroundColor: const Color(0xFF10B981),
        behavior:        SnackBarBehavior.floating,
        margin:          EdgeInsets.all(16.w),
        shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
        duration:        const Duration(seconds: 2),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state    = ref.watch(customerAuthProvider);
    final phone    = '${state.phoneCountry} ${state.phoneNumber}';

    ref.listen(customerAuthProvider, (_, next) {
      if (!mounted) return;
      switch (next.flow) {
        case CustomerAuthFlow.success:
          context.go('/customer/success');
        case CustomerAuthFlow.authenticated:
          context.go('/home');
        default:
          break;
      }
    });

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fade,
          child: Column(children: [
            // ── App bar ──────────────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
              child: Row(children: [
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    width: 40.w, height: 40.w,
                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), shape: BoxShape.circle),
                    child: Icon(Icons.arrow_back_ios_rounded, color: const Color(0xFF374151), size: 18.sp),
                  ),
                ),
                SizedBox(width: 12.w),
                Text('Vérification OTP', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
              ]),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(24.w, 16.h, 24.w, 0),
                child: Column(children: [
                  // ── Icon ──────────────────────────────────────────────────
                  Container(
                    width: 88.w, height: 88.w,
                    decoration: BoxDecoration(
                      gradient:     const LinearGradient(colors: [_red, _darkRed]),
                      borderRadius: BorderRadius.circular(24.r),
                      boxShadow:    [const BoxShadow(color: Color(0x44DC2626), blurRadius: 24, offset: Offset(0, 8))],
                    ),
                    child: Stack(alignment: Alignment.center, children: [
                      Icon(Icons.phone_android_rounded, color: Colors.white, size: 42.sp),
                      Positioned(
                        bottom: 12.h, right: 12.w,
                        child: Container(
                          width: 26.w, height: 26.w,
                          decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                          child: Icon(Icons.lock_rounded, color: _red, size: 16.sp),
                        ),
                      ),
                    ]),
                  ),

                  SizedBox(height: 28.h),

                  Text('Code de vérification', style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827), letterSpacing: -0.3)),
                  SizedBox(height: 8.h),
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280), height: 1.5),
                      children: [
                        const TextSpan(text: 'Entrez le code envoyé au\n'),
                        TextSpan(
                          text: phone,
                          style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                        ),
                      ],
                    ),
                  ),

                  SizedBox(height: 36.h),

                  // ── OTP boxes ─────────────────────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(4, (i) => Padding(
                      padding: EdgeInsets.symmetric(horizontal: 7.w),
                      child: _OtpBox(
                        controller: _ctrls[i],
                        focusNode:  _nodes[i],
                        hasValue:   _ctrls[i].text.isNotEmpty,
                        hasError:   _errorMsg.isNotEmpty,
                      ),
                    )),
                  ),

                  // ── Error message ─────────────────────────────────────────
                  AnimatedSize(
                    duration: const Duration(milliseconds: 200),
                    child: _errorMsg.isNotEmpty
                        ? Padding(
                            padding: EdgeInsets.only(top: 16.h),
                            child: Container(
                              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
                              decoration: BoxDecoration(
                                color:        const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(10.r),
                                border:       Border.all(color: const Color(0xFFFECACA)),
                              ),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 16),
                                SizedBox(width: 8.w),
                                Text(_errorMsg, style: TextStyle(color: const Color(0xFFDC2626), fontSize: 13.sp, fontWeight: FontWeight.w600)),
                              ]),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),

                  SizedBox(height: 32.h),

                  // ── Continue button ───────────────────────────────────────
                  AnimatedOpacity(
                    opacity:  _full ? 1.0 : 0.45,
                    duration: const Duration(milliseconds: 200),
                    child: AnimatedContainer(
                      duration:     const Duration(milliseconds: 200),
                      width:        double.infinity,
                      height:       54.h,
                      decoration: BoxDecoration(
                        gradient:     _full ? const LinearGradient(colors: [_red, _darkRed]) : null,
                        color:        _full ? null : const Color(0xFFE5E7EB),
                        borderRadius: BorderRadius.circular(16.r),
                        boxShadow:    _full && !state.isLoading ? [const BoxShadow(color: Color(0x55DC2626), blurRadius: 20, offset: Offset(0, 6))] : null,
                      ),
                      child: Material(
                        color:        Colors.transparent,
                        borderRadius: BorderRadius.circular(16.r),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16.r),
                          onTap: (_full && !state.isLoading) ? _verify : null,
                          child: Center(
                            child: state.isLoading
                                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                                : Text('Continuer', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
                          ),
                        ),
                      ),
                    ),
                  ),

                  SizedBox(height: 20.h),

                  // ── Resend row ────────────────────────────────────────────
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('Vous n\'avez pas reçu le code ? ', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
                    GestureDetector(
                      onTap: _remaining == 0 ? _resend : null,
                      child: Text(
                        _remaining > 0 ? 'Renvoyer (${_remaining}s)' : 'Renvoyer',
                        style: TextStyle(
                          fontSize:   13.sp,
                          fontWeight: FontWeight.w700,
                          color:      _remaining == 0 ? _red : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ),
                  ]),

                  SizedBox(height: 20.h),

                  // ── Test mode hint ────────────────────────────────────────
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
                    decoration: BoxDecoration(
                      color:        const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(10.r),
                      border:       Border.all(color: const Color(0xFFFED7AA)),
                    ),
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

// ── OTP box ───────────────────────────────────────────────────────────────────
class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode             focusNode;
  final bool                  hasValue;
  final bool                  hasError;
  const _OtpBox({required this.controller, required this.focusNode, required this.hasValue, required this.hasError});

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    final filled  = hasValue;
    final error   = hasError;

    Color border = error ? const Color(0xFFEF4444)
        : focused         ? _red
        : filled          ? _red
        :                   const Color(0xFFE5E7EB);

    return AnimatedContainer(
      duration:     const Duration(milliseconds: 150),
      width:  62.w, height: 68.h,
      decoration: BoxDecoration(
        color:        filled ? const Color(0xFFFFF5F5) : (focused ? const Color(0xFFFEF2F2) : const Color(0xFFF9FAFB)),
        borderRadius: BorderRadius.circular(16.r),
        border:       Border.all(color: border, width: (focused || filled) ? 2 : 1.5),
        boxShadow:    focused ? [BoxShadow(color: _red.withValues(alpha: 0.15), blurRadius: 12, offset: const Offset(0, 4))] : null,
      ),
      alignment: Alignment.center,
      child: filled
          ? Container(
              width:  12.w, height: 12.w,
              decoration: const BoxDecoration(color: _red, shape: BoxShape.circle),
            )
          : Text(
              focused ? '|' : '',
              style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w700, color: _red),
            ),
    );
  }
}

// ── Custom numeric keyboard ───────────────────────────────────────────────────
class _NumericKeyboard extends StatelessWidget {
  final void Function(String) onDigit;
  final VoidCallback           onBackspace;
  const _NumericKeyboard({required this.onDigit, required this.onBackspace});

  static const _rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['',  '0', 'del'],
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color:   const Color(0xFFF9FAFB),
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      child: Column(
        children: _rows.map((row) => Padding(
          padding: EdgeInsets.only(bottom: 6.h),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: row.map((k) {
              if (k.isEmpty) return SizedBox(width: 96.w, height: 54.h);
              return _Key(label: k, onTap: k == 'del' ? onBackspace : () => onDigit(k));
            }).toList(),
          ),
        )).toList(),
      ),
    );
  }
}

class _Key extends StatefulWidget {
  final String       label;
  final VoidCallback onTap;
  const _Key({required this.label, required this.onTap});

  @override
  State<_Key> createState() => _KeyState();
}

class _KeyState extends State<_Key> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDel = widget.label == 'del';
    return GestureDetector(
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) { setState(() => _pressed = false); widget.onTap(); },
      onTapCancel: ()  => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration:     const Duration(milliseconds: 80),
        width:  96.w, height: 54.h,
        decoration: BoxDecoration(
          color:        _pressed ? const Color(0xFFE5E7EB) : Colors.white,
          borderRadius: BorderRadius.circular(12.r),
          boxShadow:    _pressed ? null : [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 2))],
        ),
        alignment: Alignment.center,
        child: isDel
            ? Icon(Icons.backspace_outlined, size: 22.sp, color: const Color(0xFF374151))
            : Text(widget.label, style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827))),
      ),
    );
  }
}
