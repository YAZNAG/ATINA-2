import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/checkout_service.dart';
import '../../services/support_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/select_sheet.dart';

/// Mes réclamations : liste et suivi de leur traitement.
class ClaimsScreen extends StatefulWidget {
  const ClaimsScreen({super.key});

  @override
  State<ClaimsScreen> createState() => _ClaimsScreenState();
}

class _ClaimsScreenState extends State<ClaimsScreen> {
  List<Map<String, dynamic>> _claims = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ClaimsService.list();
      if (mounted) setState(() => _claims = list);
    } catch (_) {
      if (mounted) setState(() => _claims = const []);
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
            title: t('Mes réclamations'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
            right: IconButton(
              tooltip: t('Nouvelle réclamation'),
              onPressed: () async {
                final created = await context.push<bool>('/claims/new');
                if (created == true) _load();
              },
              icon: const Icon(Icons.add, color: C.red),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _claims.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: Icons.report_problem_outlined,
                                title: t('Aucune réclamation'),
                                text: t('Signalez un problème sur une commande livrée.'),
                                actionLabel: t('Nouvelle réclamation'),
                                onAction: () async {
                                  final created =
                                      await context.push<bool>('/claims/new');
                                  if (created == true) _load();
                                },
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                            itemCount: _claims.length,
                            itemBuilder: (context, i) {
                              final claim = _claims[i];
                              final date = DateTime.tryParse('${claim['created_at']}');
                              final status = '${claim['status'] ?? ''}';
                              return Card(
                                color: C.bg,
                                elevation: 0,
                                margin: const EdgeInsets.only(bottom: S.md),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(R.md),
                                  side: const BorderSide(color: C.line),
                                ),
                                child: ListTile(
                                  onTap: () => context.push('/claims/${claim['id']}'),
                                  title: Text(
                                    '${claim['type']?['name_fr'] ?? claim['subject'] ?? t('Réclamation')}',
                                    style: ts(14, weight: F.semi),
                                  ),
                                  subtitle: Text(
                                    [
                                      if (date != null) fmtDate(date),
                                      if (status.isNotEmpty) status,
                                    ].join(' · '),
                                    style: ts(12, color: C.grey),
                                  ),
                                  trailing: const Icon(Icons.chevron_right,
                                      size: 20, color: C.greyLight),
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

/// Nouvelle réclamation : commande concernée, motif et description.
class CreateClaimScreen extends StatefulWidget {
  const CreateClaimScreen({super.key});

  @override
  State<CreateClaimScreen> createState() => _CreateClaimScreenState();
}

class _CreateClaimScreenState extends State<CreateClaimScreen> {
  final _description = TextEditingController();

  List<Map<String, dynamic>> _orders = const [];
  List<Map<String, dynamic>> _types = const [];
  String? _orderId;
  String? _typeId;
  bool _loading = true;
  bool _saving = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    await Future.wait([
      OrderService.list()
          .then((v) => mounted ? setState(() => _orders = v) : null)
          .catchError((Object _) {}),
      ClaimsService.types()
          .then((v) => mounted ? setState(() => _types = v) : null)
          .catchError((Object _) {}),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit() async {
    if (_orderId == null || _typeId == null || _description.text.trim().isEmpty) {
      setState(() => _error = t('Remplissez tous les champs.'));
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await ClaimsService.create({
        'order_id': _orderId,
        'claim_type_id': _typeId,
        'description': _description.text.trim(),
      });
      if (mounted) context.pop(true);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _orders.where((o) => '${o['id']}' == _orderId);
    final type = _types.where((t) => '${t['id']}' == _typeId);

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Nouvelle réclamation'),
            onBack: () => context.pop(),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                    children: [
                      _selector(
                        label: t('Commande concernée'),
                        value: order.isEmpty
                            ? t('Choisir une commande')
                            : '${order.first['reference'] ?? order.first['id']}',
                        empty: order.isEmpty,
                        onTap: () => SelectSheet.show(
                          context,
                          title: t('Commande concernée'),
                          options: _orders
                              .map((o) => SelectOption(
                                    '${o['id']}',
                                    '${o['reference'] ?? o['id']}',
                                    hint: fmtPrice((o['total_ttc'] as num?) ?? 0),
                                  ))
                              .toList(),
                          selected: _orderId,
                          onSelect: (v) => setState(() => _orderId = v),
                        ),
                      ),
                      _selector(
                        label: t('Motif'),
                        value: type.isEmpty ? t('Choisir un motif') : tName(type.first),
                        empty: type.isEmpty,
                        onTap: () => SelectSheet.show(
                          context,
                          title: t('Motif'),
                          options: _types
                              .map((e) => SelectOption('${e['id']}', tName(e)))
                              .toList(),
                          selected: _typeId,
                          onSelect: (v) => setState(() => _typeId = v),
                        ),
                      ),
                      TextField(
                        controller: _description,
                        maxLines: 5,
                        style: ts(14),
                        decoration: InputDecoration(labelText: t('Description')),
                      ),
                      if (_error.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: S.md),
                          child: Text(_error,
                              style: ts(12.5, weight: F.medium, color: C.red)),
                        ),
                      const SizedBox(height: S.xl),
                      PrimaryButton(
                        label: t('Envoyer'),
                        loading: _saving,
                        onPressed: _submit,
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _selector({
    required String label,
    required String value,
    required bool empty,
    required VoidCallback onTap,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: S.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(R.md),
          child: InputDecorator(
            decoration: InputDecoration(labelText: label),
            child: Row(
              children: [
                Expanded(
                  child: Text(value,
                      style: ts(14, color: empty ? C.greyLight : C.ink)),
                ),
                const Icon(Icons.keyboard_arrow_down, color: C.grey),
              ],
            ),
          ),
        ),
      );
}

/// Détail d'une réclamation : état, description et réponse de l'équipe.
class ClaimDetailScreen extends StatefulWidget {
  const ClaimDetailScreen({super.key, required this.claimId});

  final String claimId;

  @override
  State<ClaimDetailScreen> createState() => _ClaimDetailScreenState();
}

class _ClaimDetailScreenState extends State<ClaimDetailScreen> {
  Map<String, dynamic>? _claim;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    ClaimsService.detail(widget.claimId).then((data) {
      if (mounted) {
        setState(() {
          _claim = data;
          _loading = false;
        });
      }
    }).catchError((Object _) {
      if (mounted) setState(() => _loading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final claim = _claim;
    final date = claim == null ? null : DateTime.tryParse('${claim['created_at']}');

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Réclamation'),
            onBack: () => context.canPop() ? context.pop() : context.go('/claims'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : claim == null
                    ? EmptyState(
                        icon: Icons.error_outline,
                        title: t('Réclamation introuvable'),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(S.md),
                            decoration: BoxDecoration(
                              color: C.bgSoft,
                              borderRadius: BorderRadius.circular(R.md),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${claim['type']?['name_fr'] ?? t('Réclamation')}',
                                  style: ts(15, weight: F.bold),
                                ),
                                if (date != null)
                                  Text(fmtDate(date), style: ts(12, color: C.grey)),
                                const SizedBox(height: S.md),
                                Text('${claim['description'] ?? ''}',
                                    style: ts(13.5, color: C.body, height: 1.55)),
                              ],
                            ),
                          ),
                          if ((claim['resolution'] ?? claim['answer']) != null) ...[
                            const SizedBox(height: S.lg),
                            Text(t('Réponse de l\'équipe'),
                                style: ts(15, weight: F.bold)),
                            const SizedBox(height: S.sm),
                            Container(
                              padding: const EdgeInsets.all(S.md),
                              decoration: BoxDecoration(
                                color: C.greenSoft,
                                borderRadius: BorderRadius.circular(R.md),
                              ),
                              child: Text(
                                '${claim['resolution'] ?? claim['answer']}',
                                style: ts(13.5, color: C.green, height: 1.55),
                              ),
                            ),
                          ],
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}
