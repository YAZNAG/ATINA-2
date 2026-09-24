import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Onglet « Produits » (maquette) : grille des familles illustrées sur trois
/// colonnes, recherche en haut.
class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  List<Map<String, dynamic>> _families = const [];
  bool _loading = true;
  String _error = '';
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await CatalogService.families();
      if (!mounted) return;
      setState(() {
        _families = list;
        _error = '';
      });
    } catch (e) {
      if (mounted) setState(() => _error = t('Impossible de charger les produits.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _shown {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _families;
    return _families
        .where((f) =>
            (f['name_fr'] as String? ?? '').toLowerCase().contains(q) ||
            (f['name_ar'] as String? ?? '').contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    const cols = 3;
    const gap = 12.0;
    final tile = (width - 32 - gap * (cols - 1)) / cols;

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          // Onglet : pas de bouton retour, la barre du bas sert de navigation.
          ScreenHeader(title: t('Produits')),
          Padding(
            padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, S.md),
            child: SearchField(
              value: _query,
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _shown.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: _error.isNotEmpty
                                    ? Icons.wifi_off
                                    : Icons.search_off,
                                title: _error.isNotEmpty
                                    ? _error
                                    : _query.isNotEmpty
                                        ? t('Aucune famille ne correspond. Validez pour chercher un produit.')
                                        : t('Aucun produit disponible.'),
                                actionLabel: _error.isNotEmpty ? t('Réessayer') : null,
                                onAction: _error.isNotEmpty ? _load : null,
                              ),
                            ],
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.fromLTRB(S.lg, 6, S.lg, 120),
                            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: cols,
                              crossAxisSpacing: gap,
                              mainAxisSpacing: S.lg,
                              mainAxisExtent: tile * 0.82 + 26,
                            ),
                            itemCount: _shown.length,
                            itemBuilder: (context, i) {
                              final family = _shown[i];
                              return InkWell(
                                onTap: () => context.push('/main/family/${family['id']}'),
                                borderRadius: BorderRadius.circular(12),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: SizedBox(
                                        width: tile,
                                        height: tile * 0.82,
                                        child: RemoteImage(
                                          url: family['image_url'] as String?,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      tName(family),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.center,
                                      style: ts(12, weight: F.semi),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
