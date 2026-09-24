import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../state/cart_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Mon panier : lignes avec quantité et suppression, récapitulatif et bouton
/// « Passer la commande ». Les packs comptent pour une ligne.
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  String? _busyId;

  Future<void> _setQuantity(String itemId, int quantity) async {
    setState(() => _busyId = itemId);
    try {
      await ref.read(cartProvider.notifier).setQuantity(itemId, quantity);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _remove(Map<String, dynamic> item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: C.bg,
        title: Text(t('Supprimer'), style: ts(16, weight: F.bold)),
        content: Text(
          t('Êtes-vous sûr de vouloir supprimer cet article de votre panier ?'),
          style: ts(14, color: C.body, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(t('Annuler'), style: ts(14, color: C.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(t('Supprimer'), style: ts(14, weight: F.semi, color: C.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _setQuantity('${item['id']}', 0);
  }

  @override
  Widget build(BuildContext context) {
    final cartState = ref.watch(cartProvider);

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          ScreenHeader(
            title: t('Mon panier'),
            right: IconButton(
              tooltip: t('Actualiser'),
              onPressed: () => ref.read(cartProvider.notifier).refresh(),
              icon: const Icon(Icons.refresh, size: 20, color: C.ink),
            ),
          ),
          Expanded(
            child: cartState.when(
              loading: () => const Center(child: CircularProgressIndicator(color: C.red)),
              error: (e, _) => EmptyState(
                icon: Icons.wifi_off,
                title: t('Erreur réseau'),
                actionLabel: t('Réessayer'),
                onAction: () => ref.read(cartProvider.notifier).refresh(),
              ),
              data: (cart) {
                final items = (cart['items'] as List?)
                        ?.whereType<Map>()
                        .map((e) => e.cast<String, dynamic>())
                        .toList() ??
                    const <Map<String, dynamic>>[];

                if (items.isEmpty) return const _EmptyCart();

                final total = (cart['total'] as num?) ?? _sum(items);

                return Column(
                  children: [
                    Expanded(
                      child: RefreshIndicator(
                        color: C.red,
                        onRefresh: () => ref.read(cartProvider.notifier).refresh(),
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                          itemCount: items.length,
                          itemBuilder: (context, i) {
                            final item = items[i];
                            final id = '${item['id']}';
                            final quantity = (item['quantity'] as num?)?.toInt() ?? 1;
                            return _CartRow(
                              item: item,
                              quantity: quantity,
                              busy: _busyId == id,
                              onChanged: (v) => _setQuantity(id, v),
                              onRemove: () => _remove(item),
                            );
                          },
                        ),
                      ),
                    ),
                    _Summary(total: total, onCheckout: () => context.push('/order/delivery-type')),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  num _sum(List<Map<String, dynamic>> items) {
    num total = 0;
    for (final item in items) {
      final article = item['article'];
      final price = article is Map ? (article['price_ttc'] as num?) ?? 0 : 0;
      total += price * ((item['quantity'] as num?) ?? 1);
    }
    return total;
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({
    required this.item,
    required this.quantity,
    required this.busy,
    required this.onChanged,
    required this.onRemove,
  });

  final Map<String, dynamic> item;
  final int quantity;
  final bool busy;
  final ValueChanged<int> onChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final article = (item['article'] as Map?)?.cast<String, dynamic>() ?? const {};
    final price = (article['price_ttc'] as num?) ?? 0;
    final oldPrice = article['original_price_ttc'] as num?;
    final discount = article['discount_pct'] as num?;
    final brand = article['brand'] is Map ? article['brand']['name_fr'] as String? : null;
    final isPack = item['pack'] is Map;

    return Container(
      margin: const EdgeInsets.only(bottom: S.md),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.md),
        border: Border.all(color: C.line),
        boxShadow: cardShadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(R.sm),
            child: SizedBox(
              width: 70,
              height: 70,
              child: RemoteImage(
                url: (article['image_url'] ?? '') as String?,
                fit: BoxFit.contain,
              ),
            ),
          ),
          const SizedBox(width: S.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isPack ? '${t('Pack')} · ${tName(article)}' : tName(article),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: ts(13.5, weight: F.semi, height: 1.3),
                ),
                if (brand != null || article['sku_code'] != null)
                  Text(
                    [brand, article['sku_code']].whereType<String>().join(' • '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ts(11.5, color: C.grey),
                  ),
                const SizedBox(height: 4),
                Text(fmtPrice(price), style: ts(14.5, weight: F.black, color: C.red)),
                if (oldPrice != null && discount != null && oldPrice > price)
                  Row(
                    children: [
                      Text(
                        fmtPrice(oldPrice),
                        style: ts(11.5, color: C.grey)
                            .copyWith(decoration: TextDecoration.lineThrough),
                      ),
                      const SizedBox(width: 6),
                      DiscountBadge(value: discount),
                    ],
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                onPressed: onRemove,
                icon: const Icon(Icons.delete_outline, size: 18, color: C.red),
                tooltip: t('Supprimer'),
                visualDensity: VisualDensity.compact,
              ),
              QtyStepper(
                value: quantity,
                busy: busy,
                removeAtMin: true,
                onChanged: onChanged,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Récapitulatif fixe en bas : sous-total, livraison, total, bouton de commande.
class _Summary extends StatelessWidget {
  const _Summary({required this.total, required this.onCheckout});

  final num total;
  final VoidCallback onCheckout;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(S.lg, S.md, S.lg, S.md),
      decoration: const BoxDecoration(
        color: C.bg,
        boxShadow: [
          BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -3)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _row(t('SOUS-TOTAL'), fmtPrice(total)),
          _row(
            t('LIVRAISON'),
            t('Calculée au checkout'),
            valueStyle: ts(13, color: const Color(0xFF9CA3AF)),
          ),
          const Divider(height: S.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(t('Total'), style: ts(15, weight: F.bold)),
              Text(fmtPrice(total), style: ts(18, weight: F.black, color: C.red)),
            ],
          ),
          const SizedBox(height: S.md),
          PrimaryButton(
            label: t('Passer la commande'),
            icon: Icons.arrow_forward,
            onPressed: onCheckout,
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {TextStyle? valueStyle}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: ts(11.5, weight: F.semi, color: C.grey)),
            Text(value, style: valueStyle ?? ts(14, weight: F.semi)),
          ],
        ),
      );
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(32, 20, 32, 40),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: C.redSoft,
              borderRadius: BorderRadius.circular(R.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.star, size: 14, color: C.red),
                const SizedBox(width: 6),
                Text(
                  t('Prêt pour votre prochaine commande'),
                  style: ts(12, weight: F.semi, color: C.red),
                ),
              ],
            ),
          ),
          const SizedBox(height: S.lg),
          Image.asset('assets/images/atina/empty_cart.png', height: 180, fit: BoxFit.contain),
          const SizedBox(height: S.lg),
          Text(t('Votre panier est vide'), style: ts(17, weight: F.bold)),
          const SizedBox(height: S.sm),
          Text(
            t('Ajoutez des produits pour commencer votre commande et retrouvez ici tous vos articles favoris.'),
            textAlign: TextAlign.center,
            style: ts(13.5, color: C.grey, height: 1.55),
          ),
          const SizedBox(height: S.xl),
          PrimaryButton(
            label: t('Découvrir les produits'),
            icon: Icons.shopping_bag_outlined,
            onPressed: () => context.go('/main/products'),
          ),
        ],
      ),
    );
  }
}
