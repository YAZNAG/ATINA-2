import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/rewards_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Échange de points (WF #19) : catalogue des produits accessibles avec les
/// points, ajoutés au panier et débités seulement à la confirmation.
class ExchangeScreen extends ConsumerStatefulWidget {
  const ExchangeScreen({super.key});

  @override
  ConsumerState<ExchangeScreen> createState() => _ExchangeScreenState();
}

class _ExchangeScreenState extends ConsumerState<ExchangeScreen> {
  List<Map<String, dynamic>> _catalog = const [];
  num _points = 0;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        PointsExchangeService.catalog(),
        LoyaltyService.summary(),
      ]);
      if (!mounted) return;
      setState(() {
        _catalog = results[0] as List<Map<String, dynamic>>;
        _points = ((results[1] as Map<String, dynamic>)['points_balance'] as num?) ?? 0;
        _error = '';
      });
    } catch (_) {
      if (mounted) setState(() => _error = t('Impossible de charger le catalogue'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Produits échangeables'),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/cart'),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: S.lg),
            padding: const EdgeInsets.all(S.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(R.md),
              border: Border.all(color: const Color(0xFFFEF3C7)),
            ),
            child: Row(
              children: [
                Image.asset('assets/images/atina/coin.png', width: 26, height: 26),
                const SizedBox(width: S.sm),
                Expanded(
                  child: Text(t('Points disponibles'), style: ts(13, weight: F.medium)),
                ),
                Text('${fmtNumber(_points, digits: 0)} pts',
                    style: ts(15, weight: F.black, color: const Color(0xFFF59E0B))),
              ],
            ),
          ),
          const SizedBox(height: S.md),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _catalog.isEmpty
                    ? EmptyState(
                        icon: Icons.redeem_outlined,
                        title: _error.isEmpty
                            ? t("Aucun produit n'est échangeable pour le moment.")
                            : t('Catalogue indisponible'),
                        actionLabel: t('Réessayer'),
                        onAction: _load,
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, 100),
                        itemCount: _catalog.length,
                        itemBuilder: (context, i) => _row(_catalog[i]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> item) {
    final cost = (item['points_cost'] as num?) ?? 0;
    final enough = _points >= cost;

    return Container(
      margin: const EdgeInsets.only(bottom: S.md),
      padding: const EdgeInsets.all(S.sm),
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(R.md),
        border: Border.all(color: C.line),
        boxShadow: cardShadow,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(R.sm),
            child: SizedBox(
              width: 56,
              height: 56,
              child: RemoteImage(
                url: item['image_url'] as String?,
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
                  tName(item),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: ts(13.5, weight: F.semi, height: 1.3),
                ),
                Text('${fmtNumber(cost, digits: 0)} pts',
                    style: ts(13, weight: F.bold, color: const Color(0xFFF59E0B))),
              ],
            ),
          ),
          Opacity(
            opacity: enough ? 1 : 0.4,
            child: TextButton(
              onPressed: enough
                  ? () => ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(t('Produits échangés dans le panier'),
                              style: ts(13.5, color: Colors.white)),
                          backgroundColor: C.ink,
                          behavior: SnackBarBehavior.floating,
                        ),
                      )
                  : null,
              style: TextButton.styleFrom(
                backgroundColor: C.red,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(R.pill),
                ),
              ),
              child: Text(
                enough ? t('Ajouter') : t('Points insuffisants'),
                style: ts(12.5, weight: F.semi, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
