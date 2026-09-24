import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../state/cart_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// Détail d'une vente flash ou d'un pack : visuel, description, produits inclus,
/// et ajout au panier pour un pack.
class PromotionDetailScreen extends ConsumerStatefulWidget {
  const PromotionDetailScreen({super.key, required this.id, this.isPack = false});

  final String id;
  final bool isPack;

  @override
  ConsumerState<PromotionDetailScreen> createState() => _PromotionDetailScreenState();
}

class _PromotionDetailScreenState extends ConsumerState<PromotionDetailScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _adding = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = widget.isPack
          ? await PromotionsService.pack(widget.id)
          : await PromotionsService.detail(widget.id);
      if (mounted) setState(() => _data = data);
    } catch (_) {
      // L'écran affiche un état vide.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addPack() async {
    setState(() => _adding = true);
    try {
      await ref.read(cartProvider.notifier).addPack(widget.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(t('Ajouté au panier'), style: ts(13.5, color: Colors.white)),
            backgroundColor: C.ink,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final width = MediaQuery.sizeOf(context).width;
    final card = (width - 48) / 2;
    final articles = data == null
        ? const <Map<String, dynamic>>[]
        : Api.asList(data['articles'] ?? data['items'] ?? data['products']);

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: data == null ? t('Offre') : tName(data),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/offers'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : data == null
                    ? EmptyState(
                        icon: Icons.local_offer_outlined,
                        title: t('Offre introuvable'),
                      )
                    : ListView(
                        padding: const EdgeInsets.only(bottom: 110),
                        children: [
                          SizedBox(
                            height: 180,
                            child: RemoteImage(
                              url: (data['image_url'] ?? data['banner_url']) as String?,
                              fit: BoxFit.contain,
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.lg, S.lg, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(tName(data), style: ts(19, weight: F.bold)),
                                if (data['description_fr'] != null) ...[
                                  const SizedBox(height: 6),
                                  Text('${data['description_fr']}',
                                      style: ts(13.5, color: C.body, height: 1.55)),
                                ],
                                if (data['price_ttc'] != null) ...[
                                  const SizedBox(height: S.md),
                                  Text(fmtPrice(data['price_ttc'] as num),
                                      style: ts(22, weight: F.black, color: C.red)),
                                ],
                              ],
                            ),
                          ),
                          if (articles.isNotEmpty) ...[
                            SectionTitle(
                              title: widget.isPack
                                  ? t('Produits inclus')
                                  : t('Produits en promotion'),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: S.lg),
                              child: Wrap(
                                spacing: S.lg,
                                runSpacing: S.lg,
                                children: [
                                  for (final article in articles)
                                    ProductCard(
                                      article: article,
                                      width: card,
                                      onTap: () =>
                                          context.push('/main/product/${article['id']}'),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
          ),
          if (widget.isPack && _data != null)
            Padding(
              padding: EdgeInsets.fromLTRB(
                S.lg,
                S.sm,
                S.lg,
                MediaQuery.paddingOf(context).bottom + S.lg,
              ),
              child: PrimaryButton(
                label: t('Ajouter au panier'),
                icon: Icons.shopping_cart_outlined,
                loading: _adding,
                onPressed: _addPack,
              ),
            ),
        ],
      ),
    );
  }
}
