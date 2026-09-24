import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// « Voir tout » d'une section de l'accueil : meilleures offres, produits
/// populaires, notés 5 étoiles, suggestions ou tout le catalogue.
class ProductListScreen extends StatefulWidget {
  const ProductListScreen({super.key, required this.source, this.title});

  final String source;
  final String? title;

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = switch (widget.source) {
        'popular' => await CatalogService.popular(limit: 40),
        'topRated' => await CatalogService.topRated(limit: 40),
        'suggestions' => await CatalogService.recommended(limit: 40),
        'bestDeals' => await PromotionsService.home(limit: 40)
            .then((data) => data['bestDeals'] is List
                ? (data['bestDeals'] as List)
                    .whereType<Map>()
                    .map((e) => e.cast<String, dynamic>())
                    .toList()
                : <Map<String, dynamic>>[]),
        _ => await CatalogService.articles(limit: 50),
      };
      if (mounted) setState(() => _items = items);
    } catch (_) {
      if (mounted) setState(() => _items = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final card = (width - 48) / 2;

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t(widget.title ?? 'Produits'),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/home'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _items.isEmpty
                    ? EmptyState(
                        icon: Icons.inventory_2_outlined,
                        title: t('Aucun produit trouvé'),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(S.lg, S.md, S.lg, 120),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: S.lg,
                          mainAxisSpacing: S.lg,
                          mainAxisExtent: 216,
                        ),
                        itemCount: _items.length,
                        itemBuilder: (context, i) => ProductCard(
                          article: _items[i],
                          width: card,
                          onTap: () => context.push('/main/product/${_items[i]['id']}'),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
