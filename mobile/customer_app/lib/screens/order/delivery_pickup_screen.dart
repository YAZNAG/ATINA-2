import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../i18n/i18n.dart';
import '../../services/checkout_service.dart';
import '../../state/cart_state.dart';
import '../../state/checkout_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Étape « Retrait en magasin » : magasins capables de préparer ce panier,
/// triés par distance, avec lien vers l'itinéraire.
class DeliveryPickupScreen extends ConsumerStatefulWidget {
  const DeliveryPickupScreen({super.key});

  @override
  ConsumerState<DeliveryPickupScreen> createState() => _DeliveryPickupScreenState();
}

class _DeliveryPickupScreenState extends ConsumerState<DeliveryPickupScreen> {
  List<Map<String, dynamic>> _nodes = const [];
  String? _selectedId;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final cart = ref.read(cartProvider).value ?? {};
      final list = await CheckoutService.pickupNodes(CheckoutService.itemsOf(cart));
      if (!mounted) return;
      setState(() {
        _nodes = list;
        if (list.isNotEmpty) _selectedId = '${list.first['id']}';
      });
    } catch (_) {
      if (mounted) setState(() => _error = t('Erreur chargement magasins'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openMaps(Map<String, dynamic> node) async {
    final lat = node['lat'];
    final lng = node['lng'];
    if (lat == null || lng == null) return;
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _addressOf(Map<String, dynamic> node) => [
        node['address_line1'],
        node['quartier'],
        node['city'] is Map ? node['city']['name_fr'] : node['city'],
        node['address'],
      ].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(title: t('Retrait en magasin'), onBack: () => context.pop()),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _nodes.isEmpty
                    ? EmptyState(
                        icon: Icons.store_mall_directory_outlined,
                        title: _error.isEmpty ? t('Aucun magasin disponible') : _error,
                        actionLabel: t('Réessayer'),
                        onAction: _load,
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                        children: [
                          Text(t('Magasins à proximité'), style: ts(14, weight: F.bold)),
                          const SizedBox(height: S.md),
                          for (final node in _nodes) _nodeCard(node),
                        ],
                      ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              S.lg,
              S.sm,
              S.lg,
              MediaQuery.paddingOf(context).bottom + S.lg,
            ),
            child: PrimaryButton(
              label: t('Confirmer le magasin'),
              onPressed: _selectedId == null
                  ? null
                  : () {
                      final node = _nodes.firstWhere((n) => '${n['id']}' == _selectedId);
                      ref.read(checkoutProvider.notifier).setNode(node);
                      context.push('/order/datetime');
                    },
            ),
          ),
        ],
      ),
    );
  }

  Widget _nodeCard(Map<String, dynamic> node) {
    final id = '${node['id']}';
    final selected = _selectedId == id;
    final distance = node['distance'];

    return InkWell(
      onTap: () => setState(() => _selectedId = id),
      borderRadius: BorderRadius.circular(R.md),
      child: Container(
        margin: const EdgeInsets.only(bottom: S.md),
        padding: const EdgeInsets.all(S.md),
        decoration: BoxDecoration(
          color: selected ? C.redSoft : C.bg,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: selected ? C.red : C.line),
          boxShadow: selected ? null : cardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: selected ? C.bg : C.bgSoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.storefront_outlined, size: 20, color: C.red),
            ),
            const SizedBox(width: S.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    (node['name_fr'] ?? node['name'] ?? '').toString(),
                    style: ts(14, weight: F.semi, color: selected ? C.red : C.ink),
                  ),
                  const SizedBox(height: 2),
                  Text(_addressOf(node), style: ts(12.5, color: C.grey, height: 1.4)),
                  if (distance is num)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '${t('Distance')} : ${fmtNumber(distance, digits: 1)} km',
                        style: ts(11.5, weight: F.medium, color: C.grey),
                      ),
                    ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => _openMaps(node),
              icon: const Icon(Icons.map_outlined, size: 20, color: C.red),
              tooltip: t('Itinéraire'),
            ),
          ],
        ),
      ),
    );
  }
}
