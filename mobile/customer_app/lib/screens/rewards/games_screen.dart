import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/rewards_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Jeux : roue de la chance et grattage. Un tour se joue quand le seuil de
/// commande est atteint ; le lot gagné s'affiche aussitôt.
class GamesScreen extends StatefulWidget {
  const GamesScreen({super.key});

  @override
  State<GamesScreen> createState() => _GamesScreenState();
}

class _GamesScreenState extends State<GamesScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _wheel = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  List<Map<String, dynamic>> _games = const [];
  bool _loading = true;
  bool _playing = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _wheel.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await GamesService.list();
      if (mounted) setState(() => _games = list);
    } catch (_) {
      if (mounted) setState(() => _error = t('Impossible de charger les jeux'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _play(Map<String, dynamic> game) async {
    if (_playing) return;
    setState(() => _playing = true);
    _wheel.repeat();
    try {
      final result = await GamesService.play('${game['id']}');
      if (!mounted) return;
      _wheel.stop();
      _wheel.reset();
      await _showResult(result);
      _load();
    } catch (e) {
      _wheel.stop();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    } finally {
      if (mounted) setState(() => _playing = false);
    }
  }

  Future<void> _showResult(Map<String, dynamic> result) {
    final prize = result['prize'] is Map
        ? Map<String, dynamic>.from(result['prize'] as Map)
        : null;
    final won = prize != null;

    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: C.bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.lg)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              won ? 'assets/images/atina/gift.png' : 'assets/images/atina/wheel.png',
              width: 90,
              height: 90,
            ),
            const SizedBox(height: S.md),
            Text(
              won ? t('Gagné !') : t('Pas de chance cette fois'),
              style: ts(18, weight: F.bold),
            ),
            if (won) ...[
              const SizedBox(height: 6),
              Text(
                tName(prize),
                textAlign: TextAlign.center,
                style: ts(14, color: C.body, height: 1.5),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(t('Fermer'), style: ts(14, weight: F.semi, color: C.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Jeux'),
            onBack: () => context.canPop() ? context.pop() : context.go('/main/offers'),
            right: IconButton(
              tooltip: t('Mes gains'),
              onPressed: () => context.push('/games/prizes'),
              icon: const Icon(Icons.emoji_events_outlined, color: C.red),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _games.isEmpty
                    ? EmptyState(
                        icon: Icons.casino_outlined,
                        title: _error.isEmpty
                            ? t("Aucun jeu n'est disponible pour le moment.")
                            : _error,
                        actionLabel: t('Réessayer'),
                        onAction: _load,
                      )
                    : RefreshIndicator(
                        color: C.red,
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                          itemCount: _games.length,
                          itemBuilder: (context, i) => _gameCard(_games[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _gameCard(Map<String, dynamic> game) {
    final plays = (game['available_plays'] as num?)?.toInt() ?? 0;
    final canPlay = plays > 0 && !_playing;
    final isScratch = '${game['type'] ?? ''}'.contains('scratch');

    return Container(
      margin: const EdgeInsets.only(bottom: S.lg),
      padding: const EdgeInsets.all(S.lg),
      decoration: BoxDecoration(
        color: C.redTint,
        borderRadius: BorderRadius.circular(R.lg),
        border: Border.all(color: C.redSoft),
      ),
      child: Column(
        children: [
          RotationTransition(
            turns: _wheel,
            child: Image.asset(
              isScratch ? 'assets/images/atina/gift.png' : 'assets/images/atina/wheel.png',
              width: 110,
              height: 110,
            ),
          ),
          const SizedBox(height: S.md),
          Text(tName(game), textAlign: TextAlign.center, style: ts(16, weight: F.bold)),
          const SizedBox(height: 4),
          Text(
            plays > 0
                ? '$plays ${plays > 1 ? t('tours disponibles') : t('tour disponible')}'
                : t('Atteignez le seuil de commande pour jouer'),
            textAlign: TextAlign.center,
            style: ts(12.5, color: C.grey, height: 1.4),
          ),
          const SizedBox(height: S.md),
          PrimaryButton(
            label: _playing
                ? (isScratch ? t('Grattage en cours…') : t('La roue tourne…'))
                : (isScratch ? t('Gratter') : t('Jouer')),
            loading: _playing,
            onPressed: canPlay ? () => _play(game) : null,
          ),
        ],
      ),
    );
  }
}

/// Mes gains : coupons, produits offerts et points gagnés en jouant.
class PrizesScreen extends StatefulWidget {
  const PrizesScreen({super.key});

  @override
  State<PrizesScreen> createState() => _PrizesScreenState();
}

class _PrizesScreenState extends State<PrizesScreen> {
  List<Map<String, dynamic>> _prizes = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await GamesService.prizes();
      if (mounted) setState(() => _prizes = list);
    } catch (_) {
      if (mounted) setState(() => _prizes = const []);
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
            title: t('Mes gains'),
            onBack: () => context.canPop() ? context.pop() : context.go('/games'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _prizes.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: Icons.emoji_events_outlined,
                                title: t('Aucun produit ou pack gagné pour le moment.'),
                                actionLabel: t('Jouer'),
                                onAction: () => context.push('/games'),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                            itemCount: _prizes.length,
                            itemBuilder: (context, i) {
                              final prize = _prizes[i];
                              final expires = DateTime.tryParse('${prize['expires_at']}');
                              return Container(
                                margin: const EdgeInsets.only(bottom: S.md),
                                padding: const EdgeInsets.all(S.md),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFFBEB),
                                  borderRadius: BorderRadius.circular(R.md),
                                  border: Border.all(color: const Color(0xFFFEF3C7)),
                                ),
                                child: Row(
                                  children: [
                                    Image.asset('assets/images/atina/trophy.png',
                                        width: 34, height: 34),
                                    const SizedBox(width: S.md),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(tName(prize),
                                              style: ts(13.5, weight: F.semi)),
                                          Text(
                                            expires == null
                                                ? t('Il sera offert (0 MAD) dans votre prochaine commande, sur le magasin du jeu.')
                                                : '${t("Valable jusqu'au")} ${fmtDate(expires)}',
                                            style: ts(11.5, color: C.grey, height: 1.4),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
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
