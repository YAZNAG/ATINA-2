import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/rewards_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Mes points Atina : solde, conversion en bon d'achat, historique.
/// Les points sont validés une fois la commande livrée.
class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> {
  Map<String, dynamic> _summary = const {};
  List<Map<String, dynamic>> _history = const [];
  bool _loading = true;
  bool _redeeming = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await Future.wait([
      LoyaltyService.summary()
          .then((v) => mounted ? setState(() => _summary = v) : null)
          .catchError((Object _) {}),
      LoyaltyService.history()
          .then((v) => mounted ? setState(() => _history = v) : null)
          .catchError((Object _) {}),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  num get _balance => (_summary['points_balance'] as num?) ?? 0;
  num get _step => (_summary['redeem_step'] as num?) ?? 100;

  Future<void> _redeem() async {
    setState(() => _redeeming = true);
    try {
      await LoyaltyService.redeem(_step.toInt());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(t('Coupon débloqué 🎉'), style: ts(13.5, color: Colors.white)),
          backgroundColor: C.green,
        ),
      );
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    } finally {
      if (mounted) setState(() => _redeeming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Mes points Atina'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                      children: [
                        Container(
                          padding: const EdgeInsets.all(S.lg),
                          decoration: BoxDecoration(
                            color: C.red,
                            borderRadius: BorderRadius.circular(R.lg),
                            boxShadow: buttonShadow,
                          ),
                          child: Column(
                            children: [
                              Image.asset('assets/images/atina/coins.png',
                                  width: 48, height: 48),
                              const SizedBox(height: S.sm),
                              Text('${fmtNumber(_balance, digits: 0)} pts',
                                  style: ts(28, weight: F.black, color: Colors.white)),
                              Text(
                                t('Les points sont validés une fois la commande livrée.'),
                                textAlign: TextAlign.center,
                                style: ts(12,
                                    color: Colors.white.withValues(alpha: 0.9), height: 1.4),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: S.lg),
                        Row(
                          children: [
                            Expanded(
                              child: PrimaryButton(
                                label: t('Convertir en bon'),
                                loading: _redeeming,
                                onPressed: _balance >= _step ? _redeem : null,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: S.sm),
                        OutlinedButton.icon(
                          onPressed: () => context.push('/rewards/exchange'),
                          icon: const Icon(Icons.swap_horiz, size: 18, color: C.red),
                          label: Text(
                            t('Échanger mes points contre des produits'),
                            style: ts(13.5, weight: F.semi, color: C.red),
                          ),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                            side: const BorderSide(color: C.red),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(R.md),
                            ),
                          ),
                        ),
                        const SizedBox(height: S.xl),
                        Text(t('Historique'), style: ts(15, weight: F.bold)),
                        const SizedBox(height: S.sm),
                        if (_history.isEmpty)
                          Text(t('Aucune activité pour le moment.'),
                              style: ts(13, color: C.grey))
                        else
                          for (final entry in _history) _historyRow(entry),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _historyRow(Map<String, dynamic> entry) {
    final points = (entry['points'] as num?) ?? 0;
    final positive = points >= 0;
    final date = DateTime.tryParse('${entry['created_at']}');

    return Container(
      margin: const EdgeInsets.only(bottom: S.sm),
      padding: const EdgeInsets.all(S.md),
      decoration: BoxDecoration(
        color: C.bgSoft,
        borderRadius: BorderRadius.circular(R.sm),
      ),
      child: Row(
        children: [
          Icon(
            positive ? Icons.add_circle_outline : Icons.remove_circle_outline,
            size: 18,
            color: positive ? C.green : C.red,
          ),
          const SizedBox(width: S.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${entry['reason'] ?? entry['label'] ?? t('Mouvement de points')}',
                  style: ts(13, weight: F.medium),
                ),
                if (date != null)
                  Text(fmtDate(date), style: ts(11.5, color: C.grey)),
              ],
            ),
          ),
          Text(
            '${positive ? '+' : ''}${fmtNumber(points, digits: 0)}',
            style: ts(14, weight: F.bold, color: positive ? C.green : C.red),
          ),
        ],
      ),
    );
  }
}
