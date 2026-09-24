import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Écran de confirmation : coche verte, référence de la commande, suivi.
class OrderConfirmedScreen extends StatelessWidget {
  const OrderConfirmedScreen({super.key, required this.orderId, this.reference});

  final String orderId;
  final String? reference;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 40, 28, 24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 110,
                height: 110,
                decoration: const BoxDecoration(
                  color: C.greenSoft,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle, size: 62, color: C.green),
              ),
              const SizedBox(height: S.xl),
              Text(
                t('Commande confirmée !'),
                textAlign: TextAlign.center,
                style: ts(22, weight: F.bold),
              ),
              const SizedBox(height: S.sm),
              Text(
                t('Merci pour votre commande. Vous pouvez suivre sa préparation à tout moment.'),
                textAlign: TextAlign.center,
                style: ts(13.5, color: C.grey, height: 1.55),
              ),
              if (reference != null && reference!.isNotEmpty) ...[
                const SizedBox(height: S.lg),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: C.redSoft,
                    borderRadius: BorderRadius.circular(R.pill),
                  ),
                  child: Text(
                    '${t('Commande')} $reference',
                    style: ts(13.5, weight: F.bold, color: C.red),
                  ),
                ),
              ],
              const Spacer(),
              PrimaryButton(
                label: t('Suivre ma commande'),
                icon: Icons.local_shipping_outlined,
                onPressed: () => context.go('/order/track/$orderId'),
              ),
              const SizedBox(height: S.md),
              TextButton(
                onPressed: () => context.go('/main/home'),
                child: Text(
                  t("Retour à l'accueil"),
                  style: ts(14, weight: F.semi, color: C.grey),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
