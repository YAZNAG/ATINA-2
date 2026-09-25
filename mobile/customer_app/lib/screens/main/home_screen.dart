import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../i18n/i18n.dart';
import '../../state/home_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// Accueil : localisation, recherche, promotions, catégories, sélections et la
/// grille de produits. Les blocs vides ne s'affichent pas.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeProvider);

    if (!home.ready) {
      return const Center(child: CircularProgressIndicator(color: C.red));
    }

    final width = MediaQuery.sizeOf(context).width;
    final cardWidth = (width - 48) / 2;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: C.red,
        onRefresh: () => ref.read(homeProvider.notifier).refresh(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _Header(home: home)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(S.lg, 4, S.lg, S.md),
                child: SearchField(
                  value: '',
                  readOnly: true,
                  onChanged: (_) {},
                  onTap: () => context.push('/main/search'),
                ),
              ),
            ),
            if (home.flashProducts.isNotEmpty)
              _Carousel(
                title: t('Offres à durée limitée'),
                articles: home.flashProducts,
                cardWidth: cardWidth,
                endsAt: home.flashEndsAt,
              ),
            if (home.categories.isNotEmpty)
              SliverToBoxAdapter(
                child: _Categories(
                  categories: home.categories,
                  onSeeAll: () => context.push('/main/categories'),
                ),
              ),
            if (home.bestDeals.isNotEmpty)
              _Carousel(
                title: t('Meilleures offres'),
                articles: home.bestDeals,
                cardWidth: cardWidth,
              ),
            if (home.popular.isNotEmpty)
              _Carousel(
                title: t('Produits populaires'),
                articles: home.popular,
                cardWidth: cardWidth,
              ),
            if (home.topRated.isNotEmpty)
              _Carousel(
                title: t('Notés 5 étoiles'),
                articles: home.topRated,
                cardWidth: cardWidth,
              ),
            if (home.suggestions.isNotEmpty)
              _Carousel(
                title: t('Suggestions pour vous'),
                articles: home.suggestions,
                cardWidth: cardWidth,
              ),
            SliverToBoxAdapter(child: SectionTitle(title: t('Tous les produits'))),
            if (home.articles.isEmpty)
              SliverToBoxAdapter(
                child: EmptyState(title: t('Aucun produit trouvé')),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, 120),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: S.lg,
                    crossAxisSpacing: S.lg,
                    mainAxisExtent: 228,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, i) => ProductCard(
                      article: home.articles[i],
                      onTap: () => context.push(
                        '/main/product/${home.articles[i]['id']}',
                      ),
                    ),
                    childCount: home.articles.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// En-tête : adresse de livraison, cloche de notifications, avatar.
class _Header extends StatelessWidget {
  const _Header({required this.home});

  final HomeData home;

  @override
  Widget build(BuildContext context) {
    final address = home.address;
    final name = (home.profile?['name'] as String?) ?? '';
    final avatar = home.profile?['avatar_url'] as String?;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: S.lg, vertical: S.md),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => context.push('/profile/addresses'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 14, color: C.red),
                      const SizedBox(width: 4),
                      Text(t('Livrer à'), style: ts(12, color: const Color(0xFF6B7280))),
                      const Icon(Icons.keyboard_arrow_down, size: 16, color: C.ink),
                    ],
                  ),
                  Text(
                    address != null
                        ? [
                            address['street_name'],
                            address['quartier'],
                            address['city'],
                          ].whereType<String>().where((s) => s.isNotEmpty).join(', ')
                        : t('Ajouter une adresse'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ts(15, weight: F.bold),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            onPressed: () => context.push('/profile/notifications'),
            icon: const Icon(Icons.notifications_none, size: 22, color: C.ink),
            tooltip: t('Notifications'),
          ),
          InkWell(
            onTap: () => context.push('/profile'),
            customBorder: const CircleBorder(),
            child: Container(
              width: 36,
              height: 36,
              clipBehavior: Clip.antiAlias,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: C.red, shape: BoxShape.circle),
              child: avatar != null && avatar.isNotEmpty
                  ? Image.network(Config.media(avatar), fit: BoxFit.cover, width: 36, height: 36)
                  : Text(
                      name.isEmpty ? '?' : name.characters.first.toUpperCase(),
                      style: ts(15, weight: F.bold, color: Colors.white),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bandeau de catégories rondes, avec lien « Voir tout ».
class _Categories extends StatelessWidget {
  const _Categories({required this.categories, required this.onSeeAll});

  final List<Map<String, dynamic>> categories;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(title: t('Catégories'), onSeeAll: onSeeAll),
        SizedBox(
          height: 104,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: S.lg),
            itemCount: categories.length,
            separatorBuilder: (_, __) => const SizedBox(width: S.md),
            itemBuilder: (context, i) {
              final cat = categories[i];
              return SizedBox(
                width: 72,
                child: InkWell(
                  onTap: () => context.push('/main/category/${cat['id']}'),
                  borderRadius: BorderRadius.circular(R.md),
                  child: Column(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        clipBehavior: Clip.antiAlias,
                        decoration: const BoxDecoration(
                          color: C.bgSoft,
                          shape: BoxShape.circle,
                        ),
                        child: RemoteImage(url: cat['image_url'] as String?),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        tName(cat),
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: ts(11, weight: F.medium, color: C.body, height: 1.2),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Section horizontale de produits (offres, populaires, suggestions…).
class _Carousel extends StatelessWidget {
  const _Carousel({
    required this.title,
    required this.articles,
    required this.cardWidth,
    this.endsAt,
  });

  final String title;
  final List<Map<String, dynamic>> articles;
  final double cardWidth;
  final String? endsAt;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(title: title),
          SizedBox(
            height: 228,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: S.lg),
              itemCount: articles.length,
              separatorBuilder: (_, __) => const SizedBox(width: S.md),
              itemBuilder: (context, i) {
                // Sur une vente flash, l'échéance du bloc s'applique à chaque carte.
                final article = endsAt == null
                    ? articles[i]
                    : {...articles[i], 'flash_ends_at': articles[i]['flash_ends_at'] ?? endsAt};
                return ProductCard(
                  article: article,
                  width: cardWidth,
                  onTap: () => context.push('/main/product/${article['id']}'),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
