import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../state/checkout_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Première étape du tunnel : livraison à domicile ou retrait en magasin.
class DeliveryTypeScreen extends ConsumerStatefulWidget {
  const DeliveryTypeScreen({super.key});

  @override
  ConsumerState<DeliveryTypeScreen> createState() => _DeliveryTypeScreenState();
}

class _DeliveryTypeScreenState extends ConsumerState<DeliveryTypeScreen> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Mode de réception'),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/cart'),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
              children: [
                Text(
                  t('Choisissez comment vous souhaitez recevoir votre commande.'),
                  style: ts(13.5, color: C.grey, height: 1.5),
                ),
                const SizedBox(height: S.xl),
                _Option(
                  icon: Icons.delivery_dining_outlined,
                  title: t('Livraison à domicile'),
                  text: t('Recevez votre commande rapidement chez vous.'),
                  selected: _selected == 'delivery',
                  onTap: () => setState(() => _selected = 'delivery'),
                ),
                const SizedBox(height: S.md),
                _Option(
                  icon: Icons.storefront_outlined,
                  title: t('Retrait en magasin'),
                  text: t('Récupérez votre commande directement au magasin.'),
                  selected: _selected == 'pickup',
                  onTap: () => setState(() => _selected = 'pickup'),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              S.lg,
              0,
              S.lg,
              MediaQuery.paddingOf(context).bottom + S.lg,
            ),
            child: PrimaryButton(
              label: t('Continuer'),
              onPressed: _selected == null
                  ? null
                  : () {
                      ref.read(checkoutProvider.notifier).setDeliveryType(_selected!);
                      context.push(
                        _selected == 'pickup' ? '/order/pickup' : '/order/address',
                      );
                    },
            ),
          ),
        ],
      ),
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({
    required this.icon,
    required this.title,
    required this.text,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String text;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(R.lg),
      child: Container(
        padding: const EdgeInsets.all(S.lg),
        decoration: BoxDecoration(
          color: selected ? C.redSoft : C.bg,
          borderRadius: BorderRadius.circular(R.lg),
          border: Border.all(color: selected ? C.red : C.line),
          boxShadow: selected ? null : cardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: selected ? C.bg : C.bgSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 22, color: C.red),
            ),
            const SizedBox(width: S.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: ts(15, weight: F.bold, color: selected ? C.red : C.ink),
                  ),
                  const SizedBox(height: 2),
                  Text(text, style: ts(12.5, color: C.grey, height: 1.4)),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              size: 20,
              color: selected ? C.red : C.greyLight,
            ),
          ],
        ),
      ),
    );
  }
}
