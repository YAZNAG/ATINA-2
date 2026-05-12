import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/register_screen.dart';
import '../features/home/presentation/screens/home_screen.dart';
import '../features/customer_auth/controllers/customer_auth_controller.dart';
import '../features/customer_auth/screens/customer_login_screen.dart';
import '../features/customer_auth/screens/customer_otp_screen.dart';
import '../features/customer_auth/screens/customer_success_screen.dart';

final routerProvider = Provider<GoRouter>((_) {
  return GoRouter(
    initialLocation: '/customer/login',
    routes: [
      GoRoute(path: '/customer/login', builder: (_, __) => const CustomerLoginScreen()),
      GoRoute(
        path: '/customer/otp',
        builder: (_, state) => CustomerOtpScreen(channel: state.extra as String? ?? 'sms'),
      ),
      GoRoute(path: '/customer/success', builder: (_, __) => const CustomerSuccessScreen()),
      GoRoute(path: '/home',     builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/login',    builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
    ],
  );
});
