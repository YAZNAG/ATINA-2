import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/profile_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/address_form.dart';

/// Mes adresses : liste, ajout, modification, suppression, adresse par défaut.
///
/// En mode sélection (tunnel de commande), toucher une adresse la renvoie à
/// l'écran précédent au lieu de l'ouvrir en modification.
class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key, this.selecting = false});

  final bool selecting;

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<Map<String, dynamic>> _addresses = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ProfileService.addresses();
      if (mounted) setState(() => _addresses = list);
    } catch (_) {
      if (mounted) setState(() => _addresses = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit([Map<String, dynamic>? address]) async {
    final saved = await AddressForm.show(
      context,
      initial: address,
      onSubmit: (data) async {
        if (address == null) {
          await ProfileService.addAddress(data);
        } else {
          await ProfileService.updateAddress('${address['id']}', data);
        }
      },
    );
    if (saved == true) _load();
  }

  Future<void> _delete(Map<String, dynamic> address) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: C.bg,
        title: Text(t('Supprimer'), style: ts(16, weight: F.bold)),
        content: Text(t('Supprimer cette adresse ?'), style: ts(14, color: C.body)),
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
      await ProfileService.deleteAddress('${address['id']}');
      _load();
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
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Mes adresses'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
            right: IconButton(
              tooltip: t('Ajouter'),
              onPressed: () => _edit(),
              icon: const Icon(Icons.add, color: C.red),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _addresses.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: Icons.location_off_outlined,
                                title: t('Aucune adresse'),
                                text: t('Ajoutez une adresse pour être livré.'),
                                actionLabel: t('Ajouter une adresse'),
                                onAction: () => _edit(),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 120),
                            itemCount: _addresses.length,
                            itemBuilder: (context, i) {
                              final address = _addresses[i];
                              return _AddressCard(
                                address: address,
                                selecting: widget.selecting,
                                onTap: () => widget.selecting
                                    ? context.pop(address)
                                    : _edit(address),
                                onDelete: () => _delete(address),
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

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.selecting,
    required this.onTap,
    required this.onDelete,
  });

  final Map<String, dynamic> address;
  final bool selecting;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final label = address['label'] as String?;
    final line = [
      [address['street_number'], address['street_name']]
          .whereType<String>()
          .join(' ')
          .trim(),
      address['quartier'],
      address['city'],
    ].whereType<String>().where((s) => s.isNotEmpty).join(', ');

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(R.md),
      child: Container(
        margin: const EdgeInsets.only(bottom: S.md),
        padding: const EdgeInsets.all(S.md),
        decoration: BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: address['is_default'] == true ? C.red : C.line),
          boxShadow: cardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(color: C.redSoft, shape: BoxShape.circle),
              child: const Icon(Icons.location_on_outlined, size: 20, color: C.red),
            ),
            const SizedBox(width: S.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(
                        label == null || label.isEmpty ? t('Adresse') : label,
                        style: ts(14, weight: F.semi),
                      ),
                      if (address['is_default'] == true) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: C.redSoft,
                            borderRadius: BorderRadius.circular(R.pill),
                          ),
                          child: Text(
                            t('Par défaut'),
                            style: ts(10, weight: F.semi, color: C.red),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(line, style: ts(12.5, color: C.grey, height: 1.4)),
                ],
              ),
            ),
            if (selecting)
              const Icon(Icons.chevron_right, color: C.grey)
            else
              IconButton(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline, size: 18, color: C.grey),
                tooltip: t('Supprimer'),
              ),
          ],
        ),
      ),
    );
  }
}
