import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/checkout_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import 'orders_screen.dart';

/// Détail d'une commande : état, articles, adresse, créneau et totaux.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Map<String, dynamic>? _order;
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
    } catch (_) {
      // L'écran affiche « Commande introuvable ».
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Détail de la commande'),
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
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                        children: [
                          _statusCard(order),
                          const SizedBox(height: S.lg),
                          Text(t('Articles'), style: ts(15, weight: F.bold)),
                          const SizedBox(height: S.sm),
                          for (final item in _items(order)) _itemRow(item),
                          const SizedBox(height: S.lg),
                          _totals(order),
                        ],
                      ),
          ),
          if (order != null)
            Padding(
              padding: EdgeInsets.fromLTRB(
                S.lg,
                S.sm,
                S.lg,
                MediaQuery.paddingOf(context).bottom + S.lg,
              ),
              child: PrimaryButton(
                label: t('Suivre ma commande'),
                icon: Icons.local_shipping_outlined,
                onPressed: () => context.push('/order/track/${widget.orderId}'),
              ),
            ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _items(Map<String, dynamic> order) {
    final raw = order['items'];
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
  }

  Widget _statusCard(Map<String, dynamic> order) {
    final status = order['status'];
    final code = (status is Map ? status['code'] : order['status_code']) as String?;
    final label = status is Map ? tName(Map<String, dynamic>.from(status)) : (code ?? '—');
    final color = statusColor(code);
    final date = DateTime.tryParse('${order['created_at']}');

    return Container(
      padding: const EdgeInsets.all(S.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(R.md),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(Icons.local_mall_outlined, color: color),
          const SizedBox(width: S.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label, style: ts(15, weight: F.bold, color: color)),
                if (date != null)
                  Text(fmtDate(date), style: ts(12, color: C.grey)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _itemRow(Map<String, dynamic> item) {
    final article = (item['article'] as Map?)?.cast<String, dynamic>() ??
        (item['sku'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final qty = (item['qty'] ?? item['quantity'] as num?) ?? 1;
    final price = (item['unit_price_ttc'] ?? item['unit_price'] ?? article['price_ttc']) as num? ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: S.sm),
      padding: const EdgeInsets.all(S.sm),
      decoration: BoxDecoration(
        color: C.bgSoft,
        borderRadius: BorderRadius.circular(R.sm),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              width: 44,
              height: 44,
              child: RemoteImage(
                url: article['image_url'] as String?,
                fit: BoxFit.contain,
              ),
            ),
          ),
          const SizedBox(width: S.md),
          Expanded(
            child: Text(
              tName(article),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: ts(13, weight: F.medium),
            ),
          ),
          const SizedBox(width: S.sm),
          Text('×$qty', style: ts(13, color: C.grey)),
          const SizedBox(width: S.md),
          Text(fmtPrice(price), style: ts(13.5, weight: F.semi, color: C.red)),
        ],
      ),
    );
  }

  Widget _totals(Map<String, dynamic> order) {
    final delivery = (order['delivery_fee'] as num?) ?? 0;
    final discount = (order['discount_amount'] as num?) ?? 0;

    return Container(
      padding: const EdgeInsets.all(S.md),
      decoration: BoxDecoration(
        color: C.bgSoft,
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Column(
        children: [
          _line(t('Sous-total'), fmtPrice((order['subtotal_ttc'] as num?) ?? 0)),
          _line(t('Frais de livraison'),
              delivery == 0 ? t('Offert') : fmtPrice(delivery)),
          if (discount > 0) _line(t('Remise'), '- ${fmtPrice(discount)}'),
          const Divider(height: S.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(t('Total'), style: ts(15, weight: F.bold)),
              Text(fmtPrice((order['total_ttc'] as num?) ?? 0),
                  style: ts(18, weight: F.black, color: C.red)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _line(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: ts(13, color: C.grey)),
            Text(value, style: ts(13, weight: F.semi)),
          ],
        ),
      );
}
