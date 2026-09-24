import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// Recherche : champ en haut, recherches populaires, onglets de tri, résultats.
/// Sans saisie, la grille montre les produits populaires.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialQuery = ''});

  final String initialQuery;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

enum _Sort { all, priceAsc, popular, newest }

class _SearchScreenState extends State<SearchScreen> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialQuery);

  List<Map<String, dynamic>> _results = const [];
  List<Map<String, dynamic>> _popular = const [];
  String _query = '';
  _Sort _sort = _Sort.all;
  bool _loading = false;
  Timer? _debounce;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery;
    CatalogService.popular(limit: 20)
        .then((list) => mounted ? setState(() => _popular = list) : null)
        .catchError((Object _) {});
    if (_query.isNotEmpty) _run(_query);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _run(String text) async {
    final term = text.trim();
    if (term.isEmpty) {
      setState(() {
        _results = const [];
        _loading = false;
      });
      return;
    }
    final id = ++_request;
    setState(() => _loading = true);
    try {
      final res = await CatalogService.search(query: term, limit: 40);
      if (id != _request || !mounted) return;
      setState(() => _results = res.items);
    } catch (_) {
      if (id == _request && mounted) setState(() => _results = const []);
    } finally {
      if (id == _request && mounted) setState(() => _loading = false);
    }
  }

  void _onChanged(String value) {
    setState(() => _query = value);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 320), () => _run(value));
  }

  /// Premier mot des produits populaires : les suggestions de la maquette.
  List<String> get _keywords {
    final seen = <String>{};
    for (final a in _popular) {
      final name = (a['name_fr'] as String? ?? '').split(' ').first;
      if (name.length > 2) seen.add(name);
      if (seen.length >= 6) break;
    }
    return seen.toList();
  }

  List<Map<String, dynamic>> get _shown {
    final base = _query.trim().isEmpty ? _popular : _results;
    final list = [...base];
    switch (_sort) {
      case _Sort.priceAsc:
        list.sort((a, b) =>
            ((a['price_ttc'] as num?) ?? 0).compareTo((b['price_ttc'] as num?) ?? 0));
      case _Sort.popular:
        list.sort((a, b) => ((b['sales_count'] as num?) ?? 0)
            .compareTo((a['sales_count'] as num?) ?? 0));
      case _Sort.newest:
        list.sort((a, b) => '${b['updated_at'] ?? ''}'.compareTo('${a['updated_at'] ?? ''}'));
      case _Sort.all:
        break;
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final card = (width - 32 - 12) / 2;
    final keywords = _keywords;

    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(S.md, 6, S.lg, S.md),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () =>
                        context.canPop() ? context.pop() : context.go('/main/home'),
                    icon: const Icon(Icons.chevron_left, color: C.red),
                    tooltip: t('Retour'),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      autofocus: widget.initialQuery.isEmpty,
                      textInputAction: TextInputAction.search,
                      onChanged: _onChanged,
                      onSubmitted: _run,
                      style: ts(14),
                      decoration: InputDecoration(
                        hintText: t('Rechercher un produit'),
                        prefixIcon: const Icon(Icons.search, color: C.grey, size: 20),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.close, size: 18, color: C.grey),
                                onPressed: () {
                                  _controller.clear();
                                  _onChanged('');
                                },
                              ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(R.pill),
                          borderSide: const BorderSide(color: C.line),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(R.pill),
                          borderSide: const BorderSide(color: C.line),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(R.pill),
                          borderSide: const BorderSide(color: C.red, width: 1.4),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: CustomScrollView(
                slivers: [
                  if (keywords.isNotEmpty && _query.isEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, S.sm),
                        child: Text(
                          t('Recherches populaires'),
                          style: ts(14, weight: F.bold),
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: S.lg),
                        child: Wrap(
                          spacing: S.sm,
                          runSpacing: S.sm,
                          children: [
                            for (final term in keywords)
                              AtinaChip(
                                label: term,
                                active: _query.toLowerCase() == term.toLowerCase(),
                                onTap: () {
                                  _controller.text = term;
                                  _onChanged(term);
                                },
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(S.lg, S.lg, S.lg, S.md),
                      child: Row(
                        children: [
                          for (final entry in const {
                            _Sort.all: 'Tous',
                            _Sort.priceAsc: 'Prix bas',
                            _Sort.popular: 'Populaire',
                            _Sort.newest: 'Nouveaux',
                          }.entries)
                            Padding(
                              padding: const EdgeInsets.only(right: S.sm),
                              child: AtinaChip(
                                label: t(entry.value),
                                active: _sort == entry.key,
                                onTap: () => setState(() => _sort = entry.key),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (_loading)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.only(top: 40),
                        child: Center(child: CircularProgressIndicator(color: C.red)),
                      ),
                    )
                  else if (_shown.isEmpty)
                    SliverToBoxAdapter(
                      child: EmptyState(
                        icon: Icons.search_off,
                        title: t('Aucun produit trouvé'),
                        text: t('Essayez un autre mot-clé.'),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, 40),
                      sliver: SliverGrid(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          mainAxisExtent: 216,
                        ),
                        delegate: SliverChildBuilderDelegate(
                          (context, i) => ProductCard(
                            article: _shown[i],
                            width: card,
                            onTap: () => context.push('/main/product/${_shown[i]['id']}'),
                          ),
                          childCount: _shown.length,
                        ),
                      ),
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
