import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/profile_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// Mes favoris : grille des articles mis de côté, retrait avec confirmation.
class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ProfileService.favorites();
      if (mounted) setState(() => _items = list);
    } catch (_) {
      if (mounted) setState(() => _items = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(Map<String, dynamic> article) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: C.bg,
        title: Text(t('Retirer des favoris'), style: ts(16, weight: F.bold)),
        content: Text(
          tName(article),
          style: ts(14, color: C.body),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(t('Annuler'), style: ts(14, color: C.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(t('Supprimer'), style: ts(14, weight: F.semi, color: C.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ProfileService.removeFavorite('${article['id']}');
      if (mounted) setState(() => _items = _items.where((a) => a['id'] != article['id']).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(t('Erreur réseau'), style: ts(13.5, color: Colors.white))),
        );
      }
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
            title: t('Mes favoris'),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/home'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: Icons.favorite_border,
                                title: t('Aucun favori'),
                                text: t('Ajoutez des produits à vos favoris pour les retrouver ici.'),
                                actionLabel: t('Voir les produits'),
                                onAction: () => context.go('/main/products'),
                              ),
                            ],
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
                            itemBuilder: (context, i) {
                              final article = _items[i];
                              return Stack(
                                children: [
                                  ProductCard(
                                    article: article,
                                    width: card,
                                    onTap: () =>
                                        context.push('/main/product/${article['id']}'),
                                  ),
                                  PositionedDirectional(
                                    top: 6,
                                    end: 6,
                                    child: InkWell(
                                      onTap: () => _remove(article),
                                      customBorder: const CircleBorder(),
                                      child: Container(
                                        width: 28,
                                        height: 28,
                                        decoration: const BoxDecoration(
                                          color: C.bg,
                                          shape: BoxShape.circle,
                                          boxShadow: cardShadow,
                                        ),
                                        child: const Icon(Icons.favorite,
                                            size: 15, color: C.red),
                                      ),
                                    ),
                                  ),
                                ],
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
