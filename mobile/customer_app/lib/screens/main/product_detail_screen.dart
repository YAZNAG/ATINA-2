import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../services/profile_service.dart';
import '../../services/support_service.dart';
import '../../state/cart_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// Fiche produit : galerie, prix, quantité, description, badges, avis clients,
/// produits similaires, et la barre de total avec « Ajouter au panier ».
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.articleId});

  final String articleId;

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  Map<String, dynamic>? _article;
  List<Map<String, dynamic>> _reviews = const [];
  List<Map<String, dynamic>> _similar = const [];
  bool _loading = true;
  bool _adding = false;
  bool _favorite = false;
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final article = await CatalogService.article(widget.articleId);
      if (!mounted) return;
      setState(() => _article = article);

      // Le reste complète la page sans la bloquer.
      ProfileService.favorites().then((favs) {
        if (mounted) {
          setState(() => _favorite = favs.any((f) => '${f['id']}' == widget.articleId));
        }
      }).catchError((Object _) {});

      _loadReviews();

      final categoryId = article['category'] is Map ? article['category']['id'] : null;
      if (categoryId != null) {
        CatalogService.categoryArticles('$categoryId', limit: 8).then((list) {
          if (mounted) {
            setState(() => _similar =
                list.where((a) => '${a['id']}' != widget.articleId).take(8).toList());
          }
        }).catchError((Object _) {});
      }
    } catch (_) {
      // L'écran affiche « Produit introuvable ».
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadReviews() async {
    try {
      final envelope = await ReviewsService.list(widget.articleId);
      if (mounted) setState(() => _reviews = envelope);
    } catch (_) {
      // Avis indisponibles : la section ne s'affiche pas.
    }
  }

  Future<void> _toggleFavorite() async {
    final article = _article;
    if (article == null) return;
    final next = !_favorite;
    setState(() => _favorite = next);
    try {
      if (next) {
        await ProfileService.addFavorite('${article['id']}');
      } else {
        await ProfileService.removeFavorite('${article['id']}');
      }
    } catch (_) {
      if (mounted) setState(() => _favorite = !next);
    }
  }

  Future<void> _addToCart() async {
    final skuId = _article?['sku_id'] as String?;
    if (skuId == null) {
      _snack(t("Ce produit n'est pas disponible à la commande."));
      return;
    }
    setState(() => _adding = true);
    try {
      await ref.read(cartProvider.notifier).addSku(skuId, quantity: _quantity);
      if (mounted) _snack(t('Ajouté au panier'));
    } catch (e) {
      _snack('$e');
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(message, style: ts(13.5, color: Colors.white)),
        backgroundColor: C.ink,
        behavior: SnackBarBehavior.floating,
      ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: C.bg,
        body: Center(child: CircularProgressIndicator(color: C.red)),
      );
    }

    final article = _article;
    if (article == null) {
      return Scaffold(
        backgroundColor: C.bg,
        body: Column(
          children: [
            ScreenHeader(title: t('Produit'), onBack: () => context.pop()),
            Expanded(
              child: EmptyState(
                icon: Icons.error_outline,
                title: t('Produit introuvable'),
              ),
            ),
          ],
        ),
      );
    }

    final size = MediaQuery.sizeOf(context);
    final price = (article['price_ttc'] as num?) ?? 0;
    final oldPrice = article['old_price_ttc'] as num?;
    final discount = article['discount_pct'] as num?;
    final images = _imagesOf(article);
    final description = article['description_fr'] as String?;
    final similarCard = (size.width - 40 - 12) / 2;

    return Scaffold(
      backgroundColor: C.bg,
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 100),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Gallery(images: images, height: size.height * 0.42),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              (article['category'] is Map
                                      ? tName(Map<String, dynamic>.from(article['category']))
                                      : '')
                                  .toUpperCase(),
                              style: ts(11, weight: F.semi, color: C.grey),
                            ),
                          ),
                          if (_reviews.isNotEmpty) _RatingBadge(reviews: _reviews),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(tName(article), style: ts(20, weight: F.bold, height: 1.3)),
                      const SizedBox(height: S.md),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(fmtPrice(price), style: ts(22, weight: F.black, color: C.red)),
                              if (oldPrice != null && oldPrice > price)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Row(
                                    children: [
                                      Text(
                                        fmtPrice(oldPrice),
                                        style: ts(13, color: C.grey).copyWith(
                                          decoration: TextDecoration.lineThrough,
                                        ),
                                      ),
                                      if (discount != null && discount > 0) ...[
                                        const SizedBox(width: S.sm),
                                        DiscountBadge(value: discount),
                                      ],
                                    ],
                                  ),
                                ),
                            ],
                          ),
                          QtyStepper(
                            value: _quantity,
                            onChanged: (v) => setState(() => _quantity = v < 1 ? 1 : v),
                          ),
                        ],
                      ),
                      if (description != null && description.isNotEmpty) ...[
                        const SizedBox(height: S.xl),
                        Text(t('Description'), style: ts(15, weight: F.bold)),
                        const SizedBox(height: 6),
                        Text(description, style: ts(13.5, color: C.body, height: 1.55)),
                      ],
                      const SizedBox(height: S.lg),
                      Row(
                        children: [
                          const Expanded(
                            child: _InfoBadge(
                              icon: Icons.check_circle_outline,
                              iconColor: Color(0xFF059669),
                              border: Color(0xFF25CF77),
                              background: Color(0xFFE4F3EC),
                              title: 'Qualité',
                              subtitle: 'Certifiée',
                            ),
                          ),
                          const SizedBox(width: S.md),
                          Expanded(
                            child: _InfoBadge(
                              icon: Icons.info_outline,
                              iconColor: C.red,
                              border: const Color(0xFFE5EAE6),
                              background: C.bgSoft,
                              title: 'Stock',
                              subtitle: (article['stock_qty'] as num?) == 0
                                  ? 'Rupture'
                                  : 'Disponible',
                            ),
                          ),
                        ],
                      ),
                      if (_reviews.isNotEmpty) ...[
                        const SizedBox(height: S.xl),
                        Text(t('Avis clients'), style: ts(15, weight: F.bold)),
                        const SizedBox(height: S.sm),
                        for (final review in _reviews.take(3)) _ReviewCard(review: review),
                      ],
                      if (_similar.isNotEmpty) ...[
                        const SizedBox(height: S.xl),
                        Text(t('Produits similaires'), style: ts(15, weight: F.bold)),
                        const SizedBox(height: S.md),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            for (final sim in _similar)
                              SizedBox(
                                width: similarCard,
                                child: ProductCard(
                                  article: sim,
                                  width: similarCard,
                                  onTap: () => context.push('/main/product/${sim['id']}'),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Boutons flottants sur la photo : retour et favori.
          Positioned(
            top: MediaQuery.paddingOf(context).top + 10,
            left: S.lg,
            right: S.lg,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _RoundIcon(
                  icon: Icons.chevron_left,
                  onTap: () => context.canPop() ? context.pop() : context.go('/main/home'),
                  label: t('Retour'),
                ),
                _RoundIcon(
                  icon: _favorite ? Icons.favorite : Icons.favorite_border,
                  onTap: _toggleFavorite,
                  label: t('Favoris'),
                ),
              ],
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: _Footer(
              total: price * _quantity,
              adding: _adding,
              onAdd: _addToCart,
            ),
          ),
        ],
      ),
    );
  }

  List<String> _imagesOf(Map<String, dynamic> article) {
    final raw = article['images'];
    if (raw is List && raw.isNotEmpty) {
      return raw
          .map((e) => e is Map ? e['url'] as String? : e as String?)
          .whereType<String>()
          .toList();
    }
    final single = article['image_url'] as String?;
    return single != null && single.isNotEmpty ? [single] : const [];
  }
}

/// Galerie : défilement horizontal et points de position.
class _Gallery extends StatefulWidget {
  const _Gallery({required this.images, required this.height});

  final List<String> images;
  final double height;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.images.isEmpty) {
      return Container(
        height: widget.height,
        color: C.bgSoft,
        alignment: Alignment.center,
        child: const Icon(Icons.image_outlined, size: 48, color: C.greyLight),
      );
    }
    return SizedBox(
      height: widget.height,
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.images.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => RemoteImage(url: widget.images[i], fit: BoxFit.contain),
          ),
          if (widget.images.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  widget.images.length,
                  (i) => Container(
                    width: i == _index ? 18 : 7,
                    height: 7,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: i == _index ? C.red : C.line,
                      borderRadius: BorderRadius.circular(R.pill),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.onTap, required this.label});

  final IconData icon;
  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: C.bg,
            shape: BoxShape.circle,
            boxShadow: cardShadow,
          ),
          child: Icon(icon, size: 20, color: C.red),
        ),
      ),
    );
  }
}

class _RatingBadge extends StatelessWidget {
  const _RatingBadge({required this.reviews});

  final List<Map<String, dynamic>> reviews;

  @override
  Widget build(BuildContext context) {
    final ratings = reviews
        .map((r) => (r['rating'] as num?)?.toDouble() ?? 0)
        .where((r) => r > 0)
        .toList();
    if (ratings.isEmpty) return const SizedBox.shrink();
    final average = ratings.reduce((a, b) => a + b) / ratings.length;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: C.bgSoft,
        borderRadius: BorderRadius.circular(R.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star, size: 14, color: Color(0xFFFFD700)),
          const SizedBox(width: 3),
          Text(average.toStringAsFixed(1), style: ts(12, weight: F.bold)),
        ],
      ),
    );
  }
}

class _InfoBadge extends StatelessWidget {
  const _InfoBadge({
    required this.icon,
    required this.iconColor,
    required this.border,
    required this.background,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color iconColor;
  final Color border;
  final Color background;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
            child: Icon(icon, size: 14, color: iconColor),
          ),
          const SizedBox(width: S.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(t(title), style: ts(12, weight: F.semi)),
                Text(t(subtitle), style: ts(11, color: C.grey)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});

  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    final name = (review['customer'] is Map
            ? review['customer']['name'] as String?
            : null) ??
        t('Client');
    final rating = ((review['rating'] as num?) ?? 0).round();
    final comment = review['comment'] as String?;
    final date = DateTime.tryParse('${review['created_at']}');

    return Container(
      margin: const EdgeInsets.only(bottom: S.md),
      padding: const EdgeInsets.all(S.md),
      decoration: BoxDecoration(
        color: C.bgSoft,
        borderRadius: BorderRadius.circular(R.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: C.red, shape: BoxShape.circle),
                child: Text(
                  name.characters.first.toUpperCase(),
                  style: ts(13, weight: F.bold, color: Colors.white),
                ),
              ),
              const SizedBox(width: S.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: ts(13, weight: F.semi)),
                    Row(
                      children: [
                        for (var i = 0; i < 5; i++)
                          Icon(
                            i < rating ? Icons.star : Icons.star_border,
                            size: 12,
                            color: const Color(0xFFFFD700),
                          ),
                        if (date != null) ...[
                          const SizedBox(width: 6),
                          Text(fmtDate(date, pattern: 'd MMM y'), style: ts(11, color: C.grey)),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (comment != null && comment.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: S.sm),
              child: Text(comment, style: ts(13, color: C.body, height: 1.5)),
            ),
        ],
      ),
    );
  }
}

/// Barre du bas : total calculé sur la quantité et bouton d'ajout au panier.
class _Footer extends StatelessWidget {
  const _Footer({required this.total, required this.adding, required this.onAdd});

  final num total;
  final bool adding;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        S.lg,
        S.md,
        S.lg,
        MediaQuery.paddingOf(context).bottom + S.md,
      ),
      decoration: const BoxDecoration(
        color: C.bg,
        boxShadow: [
          BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -3)),
        ],
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t('TOTAL'), style: ts(10.5, weight: F.semi, color: C.grey)),
              Text(fmtPrice(total), style: ts(17, weight: F.black)),
            ],
          ),
          const SizedBox(width: S.lg),
          Expanded(
            child: PrimaryButton(
              label: t('Ajouter au panier'),
              icon: Icons.shopping_cart_outlined,
              loading: adding,
              onPressed: onAdd,
            ),
          ),
        ],
      ),
    );
  }
}
