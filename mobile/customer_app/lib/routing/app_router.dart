import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/home/presentation/screens/home_screen.dart';

// ── Splash ─────────────────────────────────────────────────────────────────────
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: CircularProgressIndicator()));
}

// ── Register placeholder ───────────────────────────────────────────────────────
class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Inscription')),
    body:   const Center(child: Text('Inscription — À développer')),
  );
}

// ── Router provider ────────────────────────────────────────────────────────────
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: _GoRouterRefreshStream(ref, authState),
    redirect: (context, state) {
      final status = ref.read(authProvider).status;
      final loc    = state.matchedLocation;

      if (status == AuthStatus.initial || status == AuthStatus.loading) {
        return loc == '/splash' ? null : '/splash';
      }
      if (status == AuthStatus.unauthenticated) {
        final publicPaths = ['/login', '/register', '/otp', '/splash'];
        return publicPaths.contains(loc) ? null : '/login';
      }
      if (status == AuthStatus.authenticated) {
        final publicPaths = ['/login', '/register', '/otp', '/splash'];
        return publicPaths.contains(loc) ? '/home' : null;
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash',   builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login',    builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/otp',      builder: (_, __) => const Scaffold(body: Center(child: Text('OTP — À développer')))),
      GoRoute(path: '/home',     builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/categories', builder: (_, __) => const Scaffold(body: Center(child: Text('Catégories')))),
      GoRoute(path: '/cart',     builder: (_, __) => const Scaffold(body: Center(child: Text('Panier')))),
      GoRoute(path: '/profile',  builder: (_, __) => const Scaffold(body: Center(child: Text('Profil')))),
    ],
  );
});

class _GoRouterRefreshStream extends ChangeNotifier {
  _GoRouterRefreshStream(ProviderRef ref, AuthState state) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}
