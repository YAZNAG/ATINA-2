import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../features/sessions/screens/available_orders_screen.dart';
import '../features/sessions/screens/my_orders_screen.dart';
import '../features/sessions/screens/session_detail_screen.dart';
import '../features/profile/screens/profile_screen.dart';

final routerProvider = Provider<GoRouter>((ref) => GoRouter(
  initialLocation: '/login',
  refreshListenable: _Refresh(ref),
  redirect: (context, state) {
    final status = ref.read(authProvider).status;
    final loc    = state.matchedLocation;
    if (status == AuthStatus.loading || status == AuthStatus.initial) return null;
    if (status == AuthStatus.unauthenticated) return loc == '/login' ? null : '/login';
    if (status == AuthStatus.authenticated)   return loc == '/login' ? '/dashboard' : null;
    return null;
  },
  routes: [
    GoRoute(path: '/login',            builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/dashboard',        builder: (_, __) => const DashboardScreen()),
    GoRoute(path: '/available-orders', builder: (_, __) => const AvailableOrdersScreen()),
    GoRoute(path: '/my-orders',        builder: (_, __) => const MyOrdersScreen()),
    GoRoute(path: '/session/:id',      builder: (_, s)  => SessionDetailScreen(sessionId: s.pathParameters['id']!)),
    GoRoute(path: '/profile',          builder: (_, __) => const ProfileScreen()),
  ],
));

class _Refresh extends ChangeNotifier {
  _Refresh(Ref ref) { ref.listen(authProvider, (_, __) => notifyListeners()); }
}
