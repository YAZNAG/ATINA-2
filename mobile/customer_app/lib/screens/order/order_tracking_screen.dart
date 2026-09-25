import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/checkout_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Étapes du suivi, reprises de l'app Expo.
const _deliverySteps = [
  (codes: ['pending', 'confirmed'], label: 'Commande placée', sub: 'Votre commande a été reçue'),
  (codes: ['picking'], label: 'En préparation', sub: 'Nous préparons vos articles'),
  (codes: ['ready'], label: 'Prête', sub: 'Votre commande est prête'),
  (codes: ['in_delivery', 'out_for_delivery'], label: 'En livraison', sub: 'Votre commande est en route'),
  (codes: ['delivered', 'completed'], label: 'Livrée', sub: 'Commande livrée'),
];

const _pickupSteps = [
  (codes: ['pending', 'confirmed'], label: 'Commande placée', sub: 'Votre commande a été reçue'),
  (codes: ['picking'], label: 'En préparation', sub: 'Nous préparons vos articles'),
  (codes: ['ready'], label: 'Prête à retirer', sub: 'Votre commande est disponible en magasin'),
  (codes: ['picked_up'], label: 'Retirée en magasin', sub: 'Commande récupérée — merci !'),
];

/// Suivi de commande : progression par étapes, créneau, adresse, remplacements
/// proposés par le préparateur.
class OrderTrackingScreen extends StatefulWidget {
  const OrderTrackingScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  Map<String, dynamic>? _order;
  List<Map<String, dynamic>> _substitutions = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final order = await OrderService.detail(widget.orderId);
      if (mounted) setState(() => _order = order);
      final subs = await OrderService.substitutions(widget.orderId);
      if (mounted) setState(() => _substitutions = subs);
    } catch (_) {
      // Les remplacements sont facultatifs ; l'écran reste utilisable.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _respond(Map<String, dynamic> sub, String decision) async {
    try {
      await OrderService.respondSubstitution('${sub['id']}', decision);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    final statusCode = order == null
        ? null
        : ((order['status'] is Map ? order['status']['code'] : order['status_code'])
            as String?);
    final isPickup = '${order?['delivery_type']?['code'] ?? ''}'.contains('pickup');
    final steps = isPickup ? _pickupSteps : _deliverySteps;
    final current = steps.indexWhere((s) => s.codes.contains(statusCode));

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Suivi de commande'),
            subtitle: order == null ? null : '${order['reference'] ?? ''}',
            onBack: () => context.canPop() ? context.pop() : context.go('/order/orders'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : order == null
                    ? EmptyState(
                        icon: Icons.error_outline,
                        title: t('Commande introuvable'),
                      )
                    : RefreshIndicator(
                        color: C.red,
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(S.lg, S.md, S.lg, 100),
                          children: [
                            for (var i = 0; i < steps.length; i++)
                              _StepTile(
                                label: t(steps[i].label),
                                sub: t(steps[i].sub),
                                done: current >= i && current != -1,
                                active: current == i,
                                last: i == steps.length - 1,
                              ),
                            if (_substitutions.isNotEmpty) ...[
                              const SizedBox(height: S.lg),
                              Text(t('Remplacements proposés'),
                                  style: ts(15, weight: F.bold)),
                              const SizedBox(height: S.sm),
                              for (final sub in _substitutions) _substitutionCard(sub),
                            ],
                            const SizedBox(height: S.lg),
                            _infoCard(order, isPickup),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _substitutionCard(Map<String, dynamic> sub) {
    final original = (sub['original_sku'] as Map?)?.cast<String, dynamic>() ?? const {};
    final replacement =
        (sub['replacement_sku'] as Map?)?.cast<String, dynamic>() ?? const {};
    final pending = (sub['status'] ?? sub['decision']) == null ||
        '${sub['status']}'.toLowerCase() == 'pending';

    return Container(
      margin: const EdgeInsets.only(bottom: S.md),
      padding: const EdgeInsets.all(S.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(R.md),
        border: Border.all(color: const Color(0xFFFEF3C7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tName(original), style: ts(13, color: C.grey)),
          Row(
            children: [
              const Icon(Icons.arrow_downward, size: 14, color: C.grey),
              const SizedBox(width: 6),
              Expanded(
                child: Text(tName(replacement), style: ts(13.5, weight: F.semi)),
              ),
            ],
          ),
          if (pending) ...[
            const SizedBox(height: S.sm),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _respond(sub, 'accept'),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: C.green),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(R.sm),
                      ),
                    ),
                    child: Text(t('Accepter'),
                        style: ts(13, weight: F.semi, color: C.green)),
                  ),
                ),
                const SizedBox(width: S.sm),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _respond(sub, 'reject'),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: C.red),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(R.sm),
                      ),
                    ),
                    child: Text(t('Refuser'),
                        style: ts(13, weight: F.semi, color: C.red)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoCard(Map<String, dynamic> order, bool isPickup) {
    // Selon la route, l'API renvoie l'adresse comme objet ou comme liste : on
    // accepte les deux plutôt que de laisser l'écran planter.
    final address = _premierObjet(order['address']);
    final slot = _premierObjet(order['slot']);

    return Container(
      padding: const EdgeInsets.all(S.md),
      decoration: BoxDecoration(
        color: C.bgSoft,
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t('N° de commande'), style: ts(12, color: C.grey)),
          Text('${order['reference'] ?? order['id']}', style: ts(14, weight: F.semi)),
          if (slot != null) ...[
            const SizedBox(height: S.md),
            Text(t('Créneau de livraison'), style: ts(12, color: C.grey)),
            Text(
              [slot['slot_start'], slot['slot_end']]
                  .whereType<String>()
                  .join(' - '),
              style: ts(14, weight: F.semi),
            ),
          ],
          if (!isPickup && address != null) ...[
            const SizedBox(height: S.md),
            Text(t('Adresse de livraison'), style: ts(12, color: C.grey)),
            Text(
              [
                address['street_name'],
                address['quartier'],
                address['city'],
              ].whereType<String>().where((s) => s.isNotEmpty).join(', '),
              style: ts(14, weight: F.semi, height: 1.4),
            ),
          ],
        ],
      ),
    );
  }
}

/// Objet unique, qu'il arrive seul ou dans une liste.
Map<String, dynamic>? _premierObjet(dynamic valeur) {
  if (valeur is Map) return valeur.cast<String, dynamic>();
  if (valeur is List) {
    for (final element in valeur) {
      if (element is Map) return element.cast<String, dynamic>();
    }
  }
  return null;
}

class _StepTile extends StatelessWidget {
  const _StepTile({
    required this.label,
    required this.sub,
    required this.done,
    required this.active,
    required this.last,
  });

  final String label;
  final String sub;
  final bool done;
  final bool active;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final color = done ? C.red : C.line;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: done ? C.red : C.bg,
                  shape: BoxShape.circle,
                  border: Border.all(color: color, width: 2),
                ),
                child: done
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : null,
              ),
              if (!last)
                Expanded(
                  child: Container(width: 2, color: color),
                ),
            ],
          ),
          const SizedBox(width: S.md),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: S.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: ts(14.5,
                        weight: active ? F.bold : F.semi,
                        color: done ? C.ink : C.grey),
                  ),
                  const SizedBox(height: 2),
                  Text(sub, style: ts(12.5, color: C.grey, height: 1.4)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
