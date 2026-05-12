import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';

class CustomerSuccessScreen extends StatefulWidget {
  const CustomerSuccessScreen({super.key});

  @override
  State<CustomerSuccessScreen> createState() => _State();
}

class _State extends State<CustomerSuccessScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double>   _scale;
  late final Animation<double>   _fade;

  static const Color _red = Color(0xFFCC0A0A);

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut);
    _fade  = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _ctrl.forward();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.light),
      child: Scaffold(
        body: Stack(children: [
          // Red top half
          Positioned(
            top: 0, left: 0, right: 0,
            height: MediaQuery.of(context).size.height * 0.52,
            child: Container(color: _red),
          ),
          // White bottom half
          Positioned(
            bottom: 0, left: 0, right: 0,
            height: MediaQuery.of(context).size.height * 0.48,
            child: const ColoredBox(color: Colors.white),
          ),

          // Content
          SafeArea(
            child: Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 28.w),
                child: FadeTransition(
                  opacity: _fade,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    // Card
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 40.h),
                      decoration: BoxDecoration(
                        color:        Colors.white,
                        borderRadius: BorderRadius.circular(28.r),
                        boxShadow: [
                          BoxShadow(
                            color:      Colors.black.withValues(alpha: 0.10),
                            blurRadius: 32,
                            spreadRadius: 0,
                            offset:     const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(children: [
                        // Green check circle
                        ScaleTransition(
                          scale: _scale,
                          child: Container(
                            width: 90.w, height: 90.w,
                            decoration: const BoxDecoration(
                              color:  Color(0xFF22C55E),
                              shape:  BoxShape.circle,
                            ),
                            child: Icon(Icons.check_rounded, color: Colors.white, size: 50.sp),
                          ),
                        ),

                        SizedBox(height: 28.h),

                        Text(
                          'Bienvenue sur El Herri',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize:   22.sp,
                            fontWeight: FontWeight.w800,
                            color:      const Color(0xFF1A1A1A),
                            letterSpacing: -0.3,
                          ),
                        ),

                        SizedBox(height: 10.h),

                        Text(
                          'Votre compte a été créé avec succès',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14.sp,
                            color:    const Color(0xFF6B7280),
                            height:   1.5,
                          ),
                        ),

                        SizedBox(height: 36.h),

                        // Commencer button
                        GestureDetector(
                          onTap: () => context.go('/home'),
                          child: Container(
                            width:  double.infinity,
                            height: 54.h,
                            decoration: BoxDecoration(
                              color:        _red,
                              borderRadius: BorderRadius.circular(16.r),
                              boxShadow: [
                                BoxShadow(
                                  color:      const Color(0x40CC0A0A),
                                  blurRadius: 16,
                                  offset:     const Offset(0, 6),
                                ),
                              ],
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              'Commencer',
                              style: TextStyle(
                                color:      Colors.white,
                                fontSize:   17.sp,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
