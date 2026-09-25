import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

const _all = '__all__';

/// Produits d'une catégorie thématique (US-024) : même présentation que la page
/// famille — recherche et pastilles fixes, grille paginée.
class CategoryProductsScreen extends StatefulWidget {
  const CategoryProductsScreen({super.key, required this.categoryId, this.categoryName});

  final String categoryId;
  final String? categoryName;

  @override
  State<CategoryProductsScreen> createState() => _CategoryProductsScreenState();
}

class _CategoryProductsScreenState extends State<CategoryProductsScreen> {
  final _scroll = ScrollController();

  List<Map<String, dynamic>> _subs = const [];
  List<Map<String, dynamic>> _items = const [];
  String _selected = _all;
  String _query = '';
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String _error = '';
  Timer? _debounce;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    CatalogService.subCategories(widget.categoryId)
        .then((list) => mounted ? setState(() => _subs = list) : null)
        .catchError((Object _) {});
    _fetch(1, reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400 &&
        !_loading &&
        !_loadingMore &&
        _page < _pages) {
      _fetch(_page + 1, reset: false);
    }
  }

  Future<void> _fetch(int page, {required bool reset}) async {
    final id = ++_request;
    setState(() {
      if (reset) {
        _loading = true;
      } else {
        _loadingMore = true;
      }
      _error = '';
    });
    try {
      final res = await CatalogService.search(
        page: page,
        categoryId: widget.categoryId,
        subFamilyId: _selected == _all ? null : _selected,
        query: _query.trim(),
      );
      if (id != _request || !mounted) return;
      setState(() {
        _items = reset ? res.items : [..._items, ...res.items];
        _page = page;
        _pages = res.pages;
      });
    } catch (_) {
      if (id == _request && mounted) {
        setState(() => _error = t('Impossible de charger les produits.'));
      }
    } finally {
      if (id == _request && mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  void _onQuery(String value) {
    setState(() => _query = value);
    _debounce?.cancel();
    _debounce = Timer(
      Duration(milliseconds: value.isEmpty ? 0 : 300),
      () => _fetch(1, reset: true),
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    const gap = 12.0;
    final card = (width - 32 - gap) / 2;

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: widget.categoryName ?? t('Produits'),
            onBack: () =>
                context.canPop() ? context.pop() : context.go('/main/categories'),
          ),
          Container(
            decoration: const BoxDecoration(
              color: C.bg,
              border: Border(bottom: BorderSide(color: Color(0xFFF2F2F2))),
            ),
            padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, 6),
            child: Column(
              children: [
                SearchField(value: _query, onChanged: _onQuery),
                if (_subs.isNotEmpty)
                  SizedBox(
                    height: 104,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.only(top: 10, bottom: 12),
                      itemCount: _subs.length + 1,
                      separatorBuilder: (_, __) => const SizedBox(width: 14),
                      itemBuilder: (context, i) {
                        if (i == 0) {
                          return SubFamilyChip(
                            label: t('Tout'),
                            selected: _selected == _all,
                            onTap: () {
                              setState(() => _selected = _all);
                              _fetch(1, reset: true);
                            },
                          );
                        }
                        final sub = _subs[i - 1];
                        final id = '${sub['id']}';
                        return SubFamilyChip(
                          label: tName(sub),
                          imageUrl: (sub['image_url'] ?? sub['image_path']) as String?,
                          selected: _selected == id,
                          onTap: () {
                            setState(() => _selected = id);
                            _fetch(1, reset: true);
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _items.isEmpty
                    ? ListView(
                        children: [
                          EmptyState(
                            icon: _error.isNotEmpty
                                ? Icons.wifi_off
                                : Icons.inventory_2_outlined,
                            title: _error.isNotEmpty
                                ? _error
                                : t('Aucun produit disponible pour le moment.'),
                            actionLabel: _error.isNotEmpty ? t('Réessayer') : null,
                            onAction:
                                _error.isNotEmpty ? () => _fetch(1, reset: true) : null,
                          ),
                        ],
                      )
                    : GridView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(S.lg, S.md, S.lg, 120),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: gap,
                          mainAxisSpacing: gap,
                          mainAxisExtent: 228,
                        ),
                        itemCount: _items.length + (_loadingMore ? 1 : 0),
                        itemBuilder: (context, i) => i >= _items.length
                            ? const Center(child: CircularProgressIndicator(color: C.red))
                            : ProductCard(
                                article: _items[i],
                                width: card,
                                onTap: () =>
                                    context.push('/main/product/${_items[i]['id']}'),
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}
