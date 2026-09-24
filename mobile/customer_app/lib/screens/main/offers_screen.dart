import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../services/rewards_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/product_card.dart';

/// Onglet « Offres » : points Atina, raccourcis (jeux, coupons, cadeaux),
/// ventes flash, packs et meilleures remises.
class OffersScreen extends StatefulWidget {
  const OffersScreen({super.key});

  @override
  State<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends State<OffersScreen> {
  List<Map<String, dynamic>> _promotions = const [];
  List<Map<String, dynamic>> _packs = const [];
  List<Map<String, dynamic>> _bestDeals = const [];
  num _points = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await Future.wait([
      PromotionsService.active()
          .then((v) => mounted ? setState(() => _promotions = v) : null)
          .catchError((Object _) {}),
      PromotionsService.packs()
          .then((v) => mounted ? setState(() => _packs = v) : null)
          .catchError((Object _) {}),
      PromotionsService.home().then((data) {
        if (!mounted) return;
        final deals = data['bestDeals'];
        setState(() => _bestDeals = deals is List
            ? deals.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
            : const []);
      }).catchError((Object _) {}),
      LoyaltyService.summary().then((data) {
        if (!mounted) return;
        setState(() => _points = (data['points_balance'] as num?) ?? 0);
      }).catchError((Object _) {}),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final card = (width - 48) / 2;

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          ScreenHeader(title: t('Offres')),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.only(bottom: 120),
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: S.lg),
                          child: _PointsCard(
                            points: _points,
                            onTap: () => context.push('/profile/loyalty'),
                          ),
                        ),
                        const SizedBox(height: S.lg),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: S.lg),
                          child: Row(
                            children: [
                              _Shortcut(
                                icon: Icons.casino_outlined,
                                label: t('Jeux'),
                                onTap: () => context.push('/games'),
                              ),
                              const SizedBox(width: S.md),
                              _Shortcut(
                                icon: Icons.confirmation_number_outlined,
                                label: t('Coupons'),
                                onTap: () => context.push('/profile/coupons'),
                              ),
                              const SizedBox(width: S.md),
                              _Shortcut(
                                icon: Icons.card_giftcard,
                                label: t('Cadeaux'),
                                onTap: () => context.push('/games/prizes'),
                              ),
                            ],
                          ),
                        ),
                        if (_promotions.isNotEmpty) ...[
                          SectionTitle(title: t('Vente flash')),
                          SizedBox(
                            height: 96,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: S.lg),
                              itemCount: _promotions.length,
                              separatorBuilder: (_, __) => const SizedBox(width: S.md),
                              itemBuilder: (context, i) => _PromoCard(
                                promotion: _promotions[i],
                                onTap: () =>
                                    context.push('/main/promotion/${_promotions[i]['id']}'),
                              ),
                            ),
                          ),
                        ],
                        if (_packs.isNotEmpty) ...[
                          SectionTitle(title: t('Packs')),
                          SizedBox(
                            height: 96,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: S.lg),
                              itemCount: _packs.length,
                              separatorBuilder: (_, __) => const SizedBox(width: S.md),
                              itemBuilder: (context, i) => _PromoCard(
                                promotion: _packs[i],
                                onTap: () => context.push('/main/pack/${_packs[i]['id']}'),
                              ),
                            ),
                          ),
                        ],
                        if (_bestDeals.isNotEmpty) ...[
                          SectionTitle(title: t('Meilleures remises')),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: S.lg),
                            child: Wrap(
                              spacing: S.lg,
                              runSpacing: S.lg,
                              children: [
                                for (final deal in _bestDeals)
                                  ProductCard(
                                    article: deal,
                                    width: card,
                                    onTap: () =>
                                        context.push('/main/product/${deal['id']}'),
                                  ),
                              ],
                            ),
                          ),
                        ],
                        if (_promotions.isEmpty && _packs.isEmpty && _bestDeals.isEmpty)
                          EmptyState(
                            icon: Icons.local_offer_outlined,
                            title: t('Aucune offre en cours'),
                            text: t('Revenez bientôt : de nouvelles offres arrivent régulièrement.'),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _PointsCard extends StatelessWidget {
  const _PointsCard({required this.points, required this.onTap});

  final num points;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(R.lg),
      child: Container(
        padding: const EdgeInsets.all(S.lg),
        decoration: BoxDecoration(
          color: C.red,
          borderRadius: BorderRadius.circular(R.lg),
          boxShadow: buttonShadow,
        ),
        child: Row(
          children: [
            Image.asset('assets/images/atina/coins.png', width: 42, height: 42),
            const SizedBox(width: S.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(t('Mes points Atina'),
                      style: ts(13, color: Colors.white.withValues(alpha: 0.9))),
                  Text('${fmtNumber(points, digits: 0)} pts',
                      style: ts(22, weight: F.black, color: Colors.white)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(R.md),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: S.md),
          decoration: BoxDecoration(
            color: C.bgSoft,
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(color: C.line),
          ),
          child: Column(
            children: [
              Icon(icon, size: 22, color: C.red),
              const SizedBox(height: 6),
              Text(label, style: ts(12, weight: F.semi)),
            ],
          ),
        ),
      ),
    );
  }
}

class _PromoCard extends StatelessWidget {
  const _PromoCard({required this.promotion, required this.onTap});

  final Map<String, dynamic> promotion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(R.md),
      child: Container(
        width: 230,
        padding: const EdgeInsets.all(S.md),
        decoration: BoxDecoration(
          color: C.redTint,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: C.redSoft),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(R.sm),
              child: SizedBox(
                width: 56,
                height: 56,
                child: RemoteImage(
                  url: (promotion['image_url'] ?? promotion['banner_url']) as String?,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(width: S.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tName(promotion),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: ts(13, weight: F.semi, height: 1.3),
                  ),
                  if (promotion['price_ttc'] != null)
                    Text(fmtPrice(promotion['price_ttc'] as num),
                        style: ts(14, weight: F.black, color: C.red)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
