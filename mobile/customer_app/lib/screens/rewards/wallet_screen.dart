import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/rewards_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Portefeuille : solde disponible et mouvements.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  Map<String, dynamic> _wallet = const {};
  List<Map<String, dynamic>> _transactions = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await Future.wait([
      WalletService.balance()
          .then((v) => mounted ? setState(() => _wallet = v) : null)
          .catchError((Object _) {}),
      WalletService.transactions()
          .then((v) => mounted ? setState(() => _transactions = v) : null)
          .catchError((Object _) {}),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final balance = (_wallet['balance'] as num?) ?? 0;

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Wallet'),
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
                          padding: const EdgeInsets.all(S.xl),
                          decoration: BoxDecoration(
                            color: C.bgSoft,
                            borderRadius: BorderRadius.circular(R.lg),
                            border: Border.all(color: C.line),
                          ),
                          child: Column(
                            children: [
                              Text(t('Solde disponible'), style: ts(13, color: C.grey)),
                              const SizedBox(height: 6),
                              Text(fmtPrice(balance),
                                  style: ts(28, weight: F.black, color: C.red)),
                            ],
                          ),
                        ),
                        const SizedBox(height: S.xl),
                        Text(t('Historique'), style: ts(15, weight: F.bold)),
                        const SizedBox(height: S.sm),
                        if (_transactions.isEmpty)
                          Text(t('Aucune transaction pour le moment'),
                              style: ts(13, color: C.grey))
                        else
                          for (final tx in _transactions) _row(tx),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> tx) {
    final amount = (tx['amount'] as num?) ?? 0;
    final credit = amount >= 0;
    final date = DateTime.tryParse('${tx['created_at']}');

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
            credit ? Icons.arrow_downward : Icons.arrow_upward,
            size: 18,
            color: credit ? C.green : C.red,
          ),
          const SizedBox(width: S.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${tx['reason'] ?? tx['label'] ?? t('Mouvement')}',
                    style: ts(13, weight: F.medium)),
                if (date != null) Text(fmtDate(date), style: ts(11.5, color: C.grey)),
              ],
            ),
          ),
          Text(
            '${credit ? '+' : ''}${fmtPrice(amount)}',
            style: ts(14, weight: F.bold, color: credit ? C.green : C.red),
          ),
        ],
      ),
    );
  }
}
