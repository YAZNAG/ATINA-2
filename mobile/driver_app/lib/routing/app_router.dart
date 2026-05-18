import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../features/tours/screens/tours_screen.dart';
import '../features/tours/screens/tour_detail_screen.dart';
import '../features/tours/screens/stop_detail_screen.dart';
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
    GoRoute(path: '/login',      builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/dashboard',  builder: (_, __) => const DashboardScreen()),
    GoRoute(path: '/tours',      builder: (_, __) => const ToursScreen()),
    GoRoute(path: '/tour/:id',   builder: (_, s)  => TourDetailScreen(tourId: s.pathParameters['id']!)),
    GoRoute(path: '/stop/:id',   builder: (_, s)  => StopDetailScreen(stopId: s.pathParameters['id']!)),
    GoRoute(path: '/profile',    builder: (_, __) => const ProfileScreen()),
  ],
));

class _Refresh extends ChangeNotifier {
  _Refresh(Ref ref) { ref.listen(authProvider, (_, __) => notifyListeners()); }
}
