import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n/i18n.dart';
import '../state/cart_state.dart';
import '../theme/atina.dart';

/// Barre de navigation du bas : quatre onglets et le panier rouge en relief au
/// centre, comme sur la maquette.
class BottomNav extends ConsumerWidget {
  const BottomNav({super.key, required this.index, required this.onTap});

  /// Onglet courant : 0 Accueil, 1 Produits, 2 Panier, 3 Offres, 4 Profil.
  final int index;
  final ValueChanged<int> onTap;

  static const _tabs = [
    (label: 'Accueil', icon: Icons.home_outlined, active: Icons.home),
    (label: 'Produits', icon: Icons.grid_view_outlined, active: Icons.grid_view),
    (label: 'Panier', icon: Icons.shopping_cart_outlined, active: Icons.shopping_cart),
    (label: 'Offres', icon: Icons.card_giftcard_outlined, active: Icons.card_giftcard),
    (label: 'Profil', icon: Icons.person_outline, active: Icons.person),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final count = ref.watch(cartCountProvider);

    return Container(
      padding: EdgeInsets.only(top: 8, left: 4, right: 4, bottom: (bottom < 8 ? 8 : bottom) + 8),
      decoration: const BoxDecoration(
        color: C.bg,
        boxShadow: [
          BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -3)),
        ],
      ),
      child: Row(
        children: List.generate(_tabs.length, (i) {
          final tab = _tabs[i];
          final active = i == index;
          return Expanded(
            child: InkWell(
              onTap: active ? null : () => onTap(i),
              borderRadius: BorderRadius.circular(R.md),
              child: i == 2
                  ? _CartButton(count: count)
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 44,
                          height: 36,
                          decoration: BoxDecoration(
                            color: active ? const Color(0x1AE10600) : null,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            active ? tab.active : tab.icon,
                            size: 22,
                            color: active ? C.red : const Color(0xFF9CA3AF),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          t(tab.label),
                          style: ts(
                            10,
                            weight: active ? F.bold : F.medium,
                            color: active ? C.red : const Color(0xFF9CA3AF),
                          ),
                        ),
                      ],
                    ),
            ),
          );
        }),
      ),
    );
  }
}

/// Bouton panier central : disque rouge en relief et pastille de comptage.
class _CartButton extends StatelessWidget {
  const _CartButton({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: OverflowBox(
        maxHeight: 74,
        alignment: Alignment.topCenter,
        child: Transform.translate(
          offset: const Offset(0, -26),
          child: SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: const BoxDecoration(
                    color: C.red,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x73E10600),
                        blurRadius: 12,
                        offset: Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.shopping_cart, size: 22, color: Colors.white),
                ),
                if (count > 0)
                  Positioned(
                    top: 0,
                    right: 2,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 22),
                      height: 22,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A1A),
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(color: C.bg, width: 2),
                      ),
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: ts(11, weight: F.black, color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
