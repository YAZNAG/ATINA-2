import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Catégories thématiques (US-024) : grille illustrée, recherche en haut.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  List<Map<String, dynamic>> _categories = const [];
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
      final list = await CatalogService.categories();
      if (!mounted) return;
      setState(() {
        _categories = list;
        _error = '';
      });
    } catch (_) {
      if (mounted) setState(() => _error = t('Impossible de charger le catalogue'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _shown {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _categories;
    return _categories
        .where((c) =>
            (c['name_fr'] as String? ?? '').toLowerCase().contains(q) ||
            (c['name_ar'] as String? ?? '').contains(_query.trim()))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    const cols = 3;
    const gap = 12.0;
    final tile = (width - 32 - gap * (cols - 1)) / cols;

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Catégories'),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/home'),
          ),
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
                                icon: _error.isNotEmpty ? Icons.wifi_off : Icons.search_off,
                                title: _error.isNotEmpty
                                    ? t('Catalogue indisponible')
                                    : t('Aucune catégorie trouvée'),
                                text: _error.isNotEmpty ? _error : t('Essayez un autre mot-clé.'),
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
                              mainAxisExtent: tile * 0.82 + 40,
                            ),
                            itemCount: _shown.length,
                            itemBuilder: (context, i) {
                              final cat = _shown[i];
                              final count = (cat['article_count'] as num?)?.toInt() ?? 0;
                              return InkWell(
                                onTap: () => context.push('/main/category/${cat['id']}'),
                                borderRadius: BorderRadius.circular(R.md),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: tile,
                                      height: tile * 0.82,
                                      clipBehavior: Clip.antiAlias,
                                      decoration: BoxDecoration(
                                        color: C.bg,
                                        borderRadius: BorderRadius.circular(R.md),
                                        boxShadow: cardShadow,
                                      ),
                                      child: RemoteImage(
                                        url: (cat['image_path'] ?? cat['image_url']) as String?,
                                        fit: BoxFit.contain,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      tName(cat),
                                      maxLines: 2,
                                      textAlign: TextAlign.center,
                                      overflow: TextOverflow.ellipsis,
                                      style: ts(12, weight: F.semi, height: 1.2),
                                    ),
                                    if (count > 0)
                                      Text(
                                        '$count ${t('produits')}',
                                        style: ts(10.5, color: C.grey),
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
