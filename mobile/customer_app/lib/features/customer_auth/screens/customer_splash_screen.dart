import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

class CustomerSplashScreen extends ConsumerStatefulWidget {
  const CustomerSplashScreen({super.key});

  @override
  ConsumerState<CustomerSplashScreen> createState() => _CustomerSplashScreenState();
}

class _CustomerSplashScreenState extends ConsumerState<CustomerSplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double>   _scale;
  late final Animation<double>   _fade;
  late final Animation<Offset>   _slide;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor:          Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    _ctrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _scale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0, 0.7, curve: Curves.elasticOut)),
    );
    _fade  = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0.2, 0.8, curve: Curves.easeIn)),
    );
    _slide = Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0.3, 0.9, curve: Curves.easeOut)),
    );
    _ctrl.forward();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Listen to auth flow once the widget is built
    ref.listenManual(customerAuthProvider, (_, next) {
      if (!mounted) return;
      switch (next.flow) {
        case CustomerAuthFlow.authenticated:
          context.go('/home');
        case CustomerAuthFlow.unauthenticated:
          context.go('/customer/login');
        default:
          break;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width:  double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end:   Alignment.bottomRight,
            colors: [Color(0xFFDC2626), Color(0xFF991B1B)],
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(flex: 2),

              // Logo animated
              ScaleTransition(
                scale: _scale,
                child: Container(
                  width:  100.w,
                  height: 100.w,
                  decoration: BoxDecoration(
                    color:        Colors.white,
                    borderRadius: BorderRadius.circular(28.r),
                    boxShadow: [
                      BoxShadow(
                        color:      Colors.black.withValues(alpha: 0.20),
                        blurRadius: 40,
                        offset:     const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Stack(alignment: Alignment.center, children: [
                    Icon(Icons.shopping_bag_rounded, color: const Color(0xFFDC2626), size: 52.sp),
                    Positioned(
                      bottom: 14.h, right: 14.w,
                      child: Container(
                        width: 26.w, height: 26.w,
                        decoration: const BoxDecoration(color: Color(0xFFDC2626), shape: BoxShape.circle),
                        child: Icon(Icons.check_rounded, color: Colors.white, size: 16.sp),
                      ),
                    ),
                  ]),
                ),
              ),

              SizedBox(height: 28.h),

              // Brand name
              FadeTransition(
                opacity: _fade,
                child: SlideTransition(
                  position: _slide,
                  child: Column(children: [
                    Text(
                      'El Herri',
                      style: TextStyle(
                        color:       Colors.white,
                        fontSize:    34.sp,
                        fontWeight:  FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 8.h),
                    Text(
                      'Livraison rapide au Maroc',
                      style: TextStyle(
                        color:    Colors.white.withValues(alpha: 0.75),
                        fontSize: 15.sp,
                        fontWeight: FontWeight.w400,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ]),
                ),
              ),

              const Spacer(flex: 2),

              // Loader dots
              FadeTransition(
                opacity: _fade,
                child: const _DotLoader(),
              ),

              SizedBox(height: 48.h),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Animated dots loader ───────────────────────────────────────────────────────
class _DotLoader extends StatefulWidget {
  const _DotLoader();

  @override
  State<_DotLoader> createState() => _DotLoaderState();
}

class _DotLoaderState extends State<_DotLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (i) {
          final t = (_ctrl.value - i * 0.15).clamp(0.0, 1.0);
          final opacity = (t < 0.5) ? t * 2 : (1 - t) * 2;
          return Container(
            margin: EdgeInsets.symmetric(horizontal: 4.w),
            width:  8.w,
            height: 8.w,
            decoration: BoxDecoration(
              color:  Colors.white.withValues(alpha: opacity.clamp(0.25, 1.0)),
              shape:  BoxShape.circle,
            ),
          );
        }),
      ),
    );
  }
}
