import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

class CustomerSuccessScreen extends ConsumerStatefulWidget {
  const CustomerSuccessScreen({super.key});

  @override
  ConsumerState<CustomerSuccessScreen> createState() => _State();
}

class _State extends ConsumerState<CustomerSuccessScreen>
    with TickerProviderStateMixin {

  late final AnimationController _checkCtrl;
  late final AnimationController _cardCtrl;
  late final Animation<double>   _checkScale;
  late final Animation<double>   _checkOpacity;
  late final Animation<double>   _cardFade;
  late final Animation<Offset>   _cardSlide;

  static const _red   = Color(0xFFDC2626);
  static const _green = Color(0xFF10B981);

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor:          Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));

    _checkCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _cardCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));

    _checkScale   = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _checkCtrl, curve: Curves.elasticOut),
    );
    _checkOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _checkCtrl, curve: const Interval(0, 0.4, curve: Curves.easeIn)),
    );
    _cardFade  = CurvedAnimation(parent: _cardCtrl, curve: Curves.easeIn);
    _cardSlide = Tween<Offset>(begin: const Offset(0, 0.12), end: Offset.zero).animate(
      CurvedAnimation(parent: _cardCtrl, curve: Curves.easeOutCubic),
    );

    // Staggered: check first, then card content fades in
    Future.delayed(const Duration(milliseconds: 200), () {
      if (mounted) _checkCtrl.forward();
    });
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _cardCtrl.forward();
    });
  }

  @override
  void dispose() {
    _checkCtrl.dispose();
    _cardCtrl.dispose();
    super.dispose();
  }

  void _goHome() {
    ref.read(customerAuthProvider.notifier).proceedToHome();
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(customerProfileProvider);
    final firstName = profile?.displayName.split(' ').first ?? 'chez vous';

    return Scaffold(
      body: Stack(children: [
        // ── Red top half ───────────────────────────────────────────────────
        Positioned(
          top: 0, left: 0, right: 0,
          height: MediaQuery.of(context).size.height * 0.50,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end:   Alignment.bottomRight,
                colors: [_red, Color(0xFFB91C1C)],
              ),
            ),
          ),
        ),

        // ── Light grey bottom half ─────────────────────────────────────────
        Positioned(
          bottom: 0, left: 0, right: 0,
          height: MediaQuery.of(context).size.height * 0.50,
          child: const ColoredBox(color: Color(0xFFF9FAFB)),
        ),

        // ── Centered card ──────────────────────────────────────────────────
        SafeArea(
          child: Center(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 24.w),
              child: FadeTransition(
                opacity: _cardFade,
                child: SlideTransition(
                  position: _cardSlide,
                  child: Container(
                    width:   double.infinity,
                    padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 44.h),
                    decoration: BoxDecoration(
                      color:        Colors.white,
                      borderRadius: BorderRadius.circular(28.r),
                      boxShadow: [
                        BoxShadow(
                          color:      Colors.black.withValues(alpha: 0.10),
                          blurRadius: 40,
                          spreadRadius: 0,
                          offset:     const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [

                      // ── Animated check circle ──────────────────────────
                      ScaleTransition(
                        scale: _checkScale,
                        child: FadeTransition(
                          opacity: _checkOpacity,
                          child: Container(
                            width:  92.w, height: 92.w,
                            decoration: BoxDecoration(
                              color:  _green,
                              shape:  BoxShape.circle,
                              boxShadow: [
                                BoxShadow(color: _green.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 8)),
                              ],
                            ),
                            child: Icon(Icons.check_rounded, color: Colors.white, size: 52.sp),
                          ),
                        ),
                      ),

                      SizedBox(height: 32.h),

                      // ── Confetti dots decoration ──────────────────────
                      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        _Dot(color: _red,   size: 8),
                        SizedBox(width: 6.w),
                        _Dot(color: _green, size: 6),
                        SizedBox(width: 6.w),
                        _Dot(color: const Color(0xFFF59E0B), size: 8),
                        SizedBox(width: 6.w),
                        _Dot(color: const Color(0xFF3B82F6), size: 6),
                        SizedBox(width: 6.w),
                        _Dot(color: _red,   size: 8),
                      ]),

                      SizedBox(height: 20.h),

                      Text(
                        'Bienvenue, $firstName !',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize:   24.sp,
                          fontWeight: FontWeight.w800,
                          color:      const Color(0xFF111827),
                          letterSpacing: -0.4,
                          height: 1.2,
                        ),
                      ),

                      SizedBox(height: 10.h),

                      Text(
                        'Votre compte a été créé\navec succès 🎉',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15.sp,
                          color:    const Color(0xFF6B7280),
                          height:   1.6,
                        ),
                      ),

                      SizedBox(height: 12.h),

                      // ── Feature pills ─────────────────────────────────
                      Wrap(spacing: 8.w, runSpacing: 8.h, alignment: WrapAlignment.center, children: [
                        _Pill(icon: Icons.rocket_launch_rounded, label: 'Livraison rapide', color: _red),
                        _Pill(icon: Icons.local_offer_rounded,   label: 'Meilleures offres', color: const Color(0xFFF59E0B)),
                        _Pill(icon: Icons.security_rounded,       label: 'Paiement sécurisé', color: const Color(0xFF10B981)),
                      ]),

                      SizedBox(height: 36.h),

                      // ── CTA button ────────────────────────────────────
                      _StartButton(onTap: _goHome),

                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

// ── Small decoration dot ──────────────────────────────────────────────────────
class _Dot extends StatelessWidget {
  final Color  color;
  final double size;
  const _Dot({required this.color, required this.size});

  @override
  Widget build(BuildContext context) => Container(
    width: size.w, height: size.w,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

// ── Feature pill ──────────────────────────────────────────────────────────────
class _Pill extends StatelessWidget {
  final IconData icon;
  final String   label;
  final Color    color;
  const _Pill({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 7.h),
    decoration: BoxDecoration(
      color:        color.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(20.r),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14.sp, color: color),
      SizedBox(width: 5.w),
      Text(label, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: color)),
    ]),
  );
}

// ── Start button ──────────────────────────────────────────────────────────────
class _StartButton extends StatefulWidget {
  final VoidCallback onTap;
  const _StartButton({required this.onTap});

  @override
  State<_StartButton> createState() => _StartButtonState();
}

class _StartButtonState extends State<_StartButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown:   (_) => setState(() => _pressed = true),
    onTapUp:     (_) { setState(() => _pressed = false); widget.onTap(); },
    onTapCancel: ()  => setState(() => _pressed = false),
    child: AnimatedContainer(
      duration:     const Duration(milliseconds: 100),
      width:        double.infinity,
      height:       54.h,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: _pressed
              ? [const Color(0xFFB91C1C), const Color(0xFF991B1B)]
              : [const Color(0xFFDC2626), const Color(0xFFB91C1C)],
        ),
        borderRadius: BorderRadius.circular(16.r),
        boxShadow: _pressed ? null : [
          const BoxShadow(color: Color(0x55DC2626), blurRadius: 20, offset: Offset(0, 6)),
        ],
      ),
      alignment: Alignment.center,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text('Commencer à commander', style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
        SizedBox(width: 8.w),
        Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20.sp),
      ]),
    ),
  );
}
