import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/dashboard/presentation/screens/dashboard_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ref.watch(authProvider.notifier);
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: _Refresh(ref),
    redirect: (context, state) {
      final status = ref.read(authProvider).status;
      final loc    = state.matchedLocation;
      if (status == AuthStatus.loading || status == AuthStatus.initial) return null;
      if (status == AuthStatus.unauthenticated) return loc == '/login' ? null : '/login';
      if (status == AuthStatus.authenticated) return loc == '/login' ? '/dashboard' : null;
      return null;
    },
    routes: [
      GoRoute(path: '/login',     builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
      GoRoute(path: '/sessions',  builder: (_, __) => const Scaffold(body: Center(child: Text('Sessions — À brancher sur API')))),
      GoRoute(path: '/session/:id', builder: (_, s) => Scaffold(appBar: AppBar(title: Text('Session ${s.pathParameters['id']?.substring(0,8)}')), body: const Center(child: Text('Détail session')))),
      GoRoute(path: '/scan',      builder: (_, __) => const Scaffold(body: Center(child: Text('Scanner EAN — mobile_scanner')))),
    ],
  );
});

class _Refresh extends ChangeNotifier {
  _Refresh(ProviderRef ref) { ref.listen(authProvider, (_, __) => notifyListeners()); }
}
