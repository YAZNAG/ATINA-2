import 'package:flutter/material.dart';

import '../../theme/atina.dart';
import '../../widgets/bottom_nav.dart';
import '../profile/profile_screen.dart';
import 'cart_screen.dart';
import 'home_screen.dart';
import 'offers_screen.dart';
import 'products_screen.dart';

/// Coquille des cinq onglets : les écrans restent montés, la barre du bas ne
/// disparaît jamais et le retour matériel revient à l'accueil.
class MainShell extends StatefulWidget {
  const MainShell({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  late int _index = widget.initialTab;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _index = 0);
      },
      child: Scaffold(
        backgroundColor: C.bg,
        body: IndexedStack(
          index: _index,
          children: const [
            HomeScreen(),
            ProductsScreen(),
            CartScreen(),
            OffersScreen(),
            ProfileScreen(),
          ],
        ),
        bottomNavigationBar: BottomNav(
          index: _index,
          onTap: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}
