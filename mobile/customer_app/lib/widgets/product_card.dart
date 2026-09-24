import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../i18n/i18n.dart';
import '../state/cart_state.dart';
import '../theme/atina.dart';
import '../theme/widgets.dart';

/// Carte produit de la maquette : photo, badge de remise, compte à rebours de
/// vente flash, nom sur deux lignes, prix rouge, ancien prix barré, bouton « + ».
class ProductCard extends ConsumerStatefulWidget {
  const ProductCard({
    super.key,
    required this.article,
    this.onTap,
    this.width,
  });

  final Map<String, dynamic> article;
  final VoidCallback? onTap;
  final double? width;

  @override
  ConsumerState<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends ConsumerState<ProductCard> {
  bool _adding = false;

  num get _price => (widget.article['price_ttc'] as num?) ?? 0;
  num? get _oldPrice => widget.article['old_price_ttc'] as num?;
  num? get _discount => widget.article['discount_pct'] as num?;
  String? get _skuId => widget.article['sku_id'] as String?;

  Future<void> _add() async {
    final skuId = _skuId;
    if (skuId == null) {
      _toast(t("Ce produit n'est pas disponible à la commande."));
      return;
    }
    setState(() => _adding = true);
    try {
      await ref.read(cartProvider.notifier).addSku(skuId);
      if (mounted) _toast(t('Ajouté au panier'));
    } catch (e) {
      _toast(e is Exception ? '$e' : t("Erreur lors de l'ajout au panier"));
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(message, style: ts(13.5, color: Colors.white)),
        backgroundColor: C.ink,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ));
  }

  @override
  Widget build(BuildContext context) {
    final endsAt = widget.article['flash_ends_at'] as String?;
    final showOld = _oldPrice != null && _oldPrice! > _price;

    return InkWell(
      onTap: widget.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: widget.width,
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF0F0F0)),
          boxShadow: const [
            BoxShadow(color: Color(0x0D000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 128,
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: RemoteImage(
                      url: widget.article['image_url'] as String?,
                      fit: BoxFit.contain,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    right: 8,
                    child: Row(
                      children: [
                        if (_discount != null && _discount! > 0)
                          DiscountBadge(value: _discount!),
                        const Spacer(),
                        if (endsAt != null) _Countdown(endsAt: endsAt),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    height: 34,
                    child: Text(
                      tName(widget.article),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: ts(13, weight: F.bold, height: 1.31),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              fmtPrice(_price),
                              style: ts(15, weight: F.black, color: C.red),
                            ),
                            if (showOld)
                              Text(
                                fmtPrice(_oldPrice),
                                style: ts(11.5, weight: F.medium, color: C.grey)
                                    .copyWith(decoration: TextDecoration.lineThrough),
                              ),
                          ],
                        ),
                      ),
                      _AddButton(busy: _adding, onTap: _adding ? null : _add),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: t('Ajouter au panier'),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Opacity(
          opacity: busy ? 0.6 : 1,
          child: Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: C.red,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: Color(0x4DE10600), blurRadius: 6, offset: Offset(0, 3)),
              ],
            ),
            child: busy
                ? const Padding(
                    padding: EdgeInsets.all(9),
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.add, size: 20, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

/// Compte à rebours hh:mm:ss d'une vente flash (disparaît à l'échéance).
class _Countdown extends StatefulWidget {
  const _Countdown({required this.endsAt});

  final String endsAt;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  Timer? _timer;
  String? _left;

  @override
  void initState() {
    super.initState();
    _left = _remaining();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final value = _remaining();
      if (value != _left && mounted) setState(() => _left = value);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String? _remaining() {
    final end = DateTime.tryParse(widget.endsAt);
    if (end == null) return null;
    final ms = end.difference(DateTime.now()).inSeconds;
    if (ms <= 0) return null;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(ms ~/ 3600)}:${two((ms % 3600) ~/ 60)}:${two(ms % 60)}';
  }

  @override
  Widget build(BuildContext context) {
    final left = _left;
    if (left == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: C.redTint,
        border: Border.all(color: C.red),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        left,
        style: ts(11, weight: F.semi, color: C.red)
            .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
      ),
    );
  }
}
