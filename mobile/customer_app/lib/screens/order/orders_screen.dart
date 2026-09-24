import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/cart_service.dart';
import '../../services/checkout_service.dart';
import '../../state/cart_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Couleur de la pastille d'état, reprise de l'app Expo.
Color statusColor(String? code) {
  switch (code) {
    case 'delivered':
    case 'completed':
      return const Color(0xFF16A34A);
    case 'cancelled':
      return const Color(0xFFDC2626);
    case 'returned':
      return const Color(0xFFF97316);
    case 'in_delivery':
    case 'out_for_delivery':
    case 'picked_up':
      return const Color(0xFF2563EB);
    case 'ready':
      return const Color(0xFF7C3AED);
    case 'picking':
      return const Color(0xFFD97706);
    case 'awaiting_stock':
      return const Color(0xFF9CA3AF);
    default:
      return C.red;
  }
}

/// Historique des commandes : total dépensé, liste des commandes, recommander.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  List<Map<String, dynamic>> _orders = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await OrderService.list();
      if (mounted) setState(() => _orders = list);
    } catch (_) {
      if (mounted) setState(() => _orders = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reorder(Map<String, dynamic> order) async {
    try {
      final cart = await CartService.reorder('${order['id']}');
      ref.read(cartProvider.notifier).apply(cart);
      if (mounted) context.go('/main/cart');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    }
  }

  num get _spent => _orders
      .where((o) => (o['status']?['code'] ?? o['status_code']) != 'cancelled')
      .fold<num>(0, (sum, o) => sum + ((o['total_ttc'] as num?) ?? 0));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Historique des commandes'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _orders.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: Icons.receipt_long_outlined,
                                title: t('Aucune commande'),
                                text: t('Vos commandes apparaîtront ici'),
                                actionLabel: t('Commencer mes achats'),
                                onAction: () => context.go('/main/products'),
                              ),
                            ],
                          )
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 120),
                            children: [
                              Container(
                                padding: const EdgeInsets.all(S.md),
                                margin: const EdgeInsets.only(bottom: S.lg),
                                decoration: BoxDecoration(
                                  color: C.redSoft,
                                  borderRadius: BorderRadius.circular(R.md),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(t('Total dépensé'),
                                        style: ts(13, weight: F.semi, color: C.red)),
                                    Text(fmtPrice(_spent),
                                        style: ts(16, weight: F.black, color: C.red)),
                                  ],
                                ),
                              ),
                              for (final order in _orders)
                                _OrderCard(
                                  order: order,
                                  onOpen: () => context.push('/order/${order['id']}'),
                                  onReorder: () => _reorder(order),
                                ),
                            ],
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onOpen, required this.onReorder});

  final Map<String, dynamic> order;
  final VoidCallback onOpen;
  final VoidCallback onReorder;

  @override
  Widget build(BuildContext context) {
    final status = order['status'];
    final code = (status is Map ? status['code'] : order['status_code']) as String?;
    final label = status is Map ? tName(Map<String, dynamic>.from(status)) : (code ?? '—');
    final color = statusColor(code);
    final date = DateTime.tryParse('${order['created_at']}');
    final items = (order['items'] as List?)?.length ?? 0;

    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(R.md),
      child: Container(
        margin: const EdgeInsets.only(bottom: S.md),
        padding: const EdgeInsets.all(S.md),
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: C.line),
          boxShadow: cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${order['reference'] ?? order['id']}',
                    style: ts(14, weight: F.bold),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(R.pill),
                  ),
                  child: Text(label, style: ts(11, weight: F.semi, color: color)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (date != null) fmtDate(date),
                if (items > 0) '$items ${t('produits')}',
              ].join(' · '),
              style: ts(12, color: C.grey),
            ),
            const SizedBox(height: S.sm),
            Row(
              children: [
                Text(
                  fmtPrice((order['total_ttc'] as num?) ?? 0),
                  style: ts(16, weight: F.black, color: C.red),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: onReorder,
                  icon: const Icon(Icons.refresh, size: 16, color: C.red),
                  label: Text(t('Recommander'),
                      style: ts(12.5, weight: F.semi, color: C.red)),
                ),
                TextButton(
                  onPressed: onOpen,
                  child: Text(t('Voir détails'),
                      style: ts(12.5, weight: F.semi, color: C.grey)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
