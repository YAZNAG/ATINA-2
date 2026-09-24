import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/prefs.dart';
import '../services/auth_service.dart';
import '../theme/atina.dart';

/// Écran d'ouverture : logo Atina puis redirection.
///
/// L'ouverture de l'app Expo restait parfois bloquée ici ; la règle est donc la même
/// qu'après correction — la redirection part dès la première image affichée, et un
/// garde-fou l'envoie de toute façon vers la connexion au bout de trois secondes.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  bool _left = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _route());
    Future.delayed(const Duration(seconds: 3), () => _go('/auth/login'));
  }

  void _route() {
    if (AuthService.hasValidSession()) {
      _go('/main/home');
    } else if (Prefs.get(Prefs.onboardingKey) == '1') {
      _go('/auth/login');
    } else {
      _go('/onboarding');
    }
  }

  void _go(String path) {
    if (_left || !mounted) return;
    _left = true;
    context.go(path);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/images/atina/app_icon.png', width: 120, height: 120),
            const SizedBox(height: 26),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: C.red),
            ),
          ],
        ),
      ),
    );
  }
}
