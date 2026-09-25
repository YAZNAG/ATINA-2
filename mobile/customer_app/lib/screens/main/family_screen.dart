import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

const _all = '__all__';

/// Page d'une famille (maquette « Pâte, Riz & Couscous ») : recherche et pastilles
/// de sous-familles fixes sous l'en-tête, grille de produits paginée.
class FamilyScreen extends StatefulWidget {
  const FamilyScreen({super.key, required this.familyId, this.familyName});

  final String familyId;
  final String? familyName;

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  final _scroll = ScrollController();

  Map<String, dynamic>? _family;
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
    _loadFamily();
    _fetch(1, reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadFamily() async {
    try {
      final res = await CatalogService.familyWithSubs(widget.familyId);
      if (!mounted) return;
      setState(() {
        _family = res.family;
        _subs = res.subFamilies;
      });
    } catch (_) {
      // Sans sous-familles, la grille reste utilisable.
    }
  }

  void _onScroll() {
    if (_scroll.position.pixels >
            _scroll.position.maxScrollExtent - 400 &&
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
        familyId: widget.familyId,
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
    // Court délai de frappe pour la recherche, immédiat pour les pastilles.
    _debounce = Timer(
      Duration(milliseconds: value.isEmpty ? 0 : 300),
      () => _fetch(1, reset: true),
    );
  }

  void _selectSub(String id) {
    if (_selected == id) return;
    setState(() => _selected = id);
    _fetch(1, reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    const gap = 12.0;
    final card = (width - 32 - gap) / 2;
    final title = _family != null ? tName(_family) : (widget.familyName ?? t('Produits'));

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: title,
            onBack: () => context.canPop() ? context.pop() : context.go('/main/products'),
          ),
          // Bloc fixe : la recherche et les sous-familles restent visibles au défilement.
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
                            imageUrl: _family?['image_url'] as String?,
                            selected: _selected == _all,
                            onTap: () => _selectSub(_all),
                          );
                        }
                        final sub = _subs[i - 1];
                        return SubFamilyChip(
                          label: tName(sub),
                          imageUrl: sub['image_url'] as String?,
                          selected: _selected == sub['id'],
                          onTap: () => _selectSub(sub['id'] as String),
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
                            icon: _error.isNotEmpty ? Icons.wifi_off : Icons.inventory_2_outlined,
                            title: _error.isNotEmpty
                                ? _error
                                : t('Aucun produit disponible pour le moment.'),
                            actionLabel: _error.isNotEmpty ? t('Réessayer') : null,
                            onAction: _error.isNotEmpty ? () => _fetch(1, reset: true) : null,
                          ),
                        ],
                      )
                    : GridView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(S.lg, S.md, S.lg, 120),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: gap,
                          mainAxisSpacing: gap,
                          mainAxisExtent: 228,
                        ),
                        itemCount: _items.length + (_loadingMore ? 1 : 0),
                        itemBuilder: (context, i) {
                          if (i >= _items.length) {
                            return const Center(
                              child: CircularProgressIndicator(color: C.red),
                            );
                          }
                          return ProductCard(
                            article: _items[i],
                            width: card,
                            onTap: () => context.push('/main/product/${_items[i]['id']}'),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
