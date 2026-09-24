import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/rewards_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Mes coupons : disponibles, utilisés, expirés. Le code se copie d'un geste.
class CouponsScreen extends StatefulWidget {
  const CouponsScreen({super.key});

  @override
  State<CouponsScreen> createState() => _CouponsScreenState();
}

enum _Filter { all, available, used, expired }

class _CouponsScreenState extends State<CouponsScreen> {
  List<Map<String, dynamic>> _coupons = const [];
  _Filter _filter = _Filter.all;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await CouponsService.list();
      if (mounted) setState(() => _coupons = list);
    } catch (_) {
      if (mounted) setState(() => _coupons = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isExpired(Map<String, dynamic> c) {
    final date = DateTime.tryParse('${c['expires_at']}');
    return date != null && date.isBefore(DateTime.now());
  }

  bool _isUsed(Map<String, dynamic> c) =>
      c['used_at'] != null || c['is_used'] == true;

  List<Map<String, dynamic>> get _shown => switch (_filter) {
        _Filter.all => _coupons,
        _Filter.available =>
          _coupons.where((c) => !_isUsed(c) && !_isExpired(c)).toList(),
        _Filter.used => _coupons.where(_isUsed).toList(),
        _Filter.expired => _coupons.where(_isExpired).toList(),
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Mes Coupons'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.lg),
            child: Row(
              children: [
                for (final entry in const {
                  _Filter.all: 'Tous',
                  _Filter.available: 'Disponibles',
                  _Filter.used: 'Utilisés',
                  _Filter.expired: 'Expirés',
                }.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: S.sm),
                    child: AtinaChip(
                      label: t(entry.value),
                      active: _filter == entry.key,
                      onTap: () => setState(() => _filter = entry.key),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: S.md),
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
                                icon: Icons.confirmation_number_outlined,
                                title: t('Aucun coupon'),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, 100),
                            itemCount: _shown.length,
                            itemBuilder: (context, i) => _card(_shown[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _card(Map<String, dynamic> coupon) {
    final used = _isUsed(coupon);
    final expired = _isExpired(coupon);
    final off = used || expired;
    final code = '${coupon['code'] ?? ''}';
    final expires = DateTime.tryParse('${coupon['expires_at']}');
    final value = (coupon['value'] ?? coupon['amount']) as num?;
    final isPercent = '${coupon['type'] ?? ''}'.contains('percent');

    return Opacity(
      opacity: off ? 0.55 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: S.md),
        padding: const EdgeInsets.all(S.md),
        decoration: BoxDecoration(
          color: off ? C.bgSoft : C.redTint,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: off ? C.line : C.redSoft),
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: C.bg, shape: BoxShape.circle),
              child: Text(
                value == null
                    ? '%'
                    : isPercent
                        ? '-${fmtNumber(value, digits: 0)}%'
                        : fmtNumber(value, digits: 0),
                style: ts(13, weight: F.black, color: C.red),
              ),
            ),
            const SizedBox(width: S.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(code, style: ts(15, weight: F.bold)),
                  if (expires != null)
                    Text(
                      expired
                          ? t('Expiré')
                          : '${t('Valable jusqu\'au')} ${fmtDate(expires)}',
                      style: ts(12, color: C.grey),
                    ),
                  if (used) Text(t('Déjà utilisé'), style: ts(12, color: C.grey)),
                ],
              ),
            ),
            if (!off)
              Builder(
                builder: (tileContext) => IconButton(
                  tooltip: t('Copier'),
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(tileContext);
                    await Clipboard.setData(ClipboardData(text: code));
                    messenger.showSnackBar(
                      SnackBar(
                        content:
                            Text(t('Copié !'), style: ts(13.5, color: Colors.white)),
                        backgroundColor: C.ink,
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  icon: const Icon(Icons.copy, size: 18, color: C.red),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
