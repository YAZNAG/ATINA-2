import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/checkout_service.dart';
import '../../state/cart_state.dart';
import '../../state/checkout_state.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Étape « Date & Heure » : sept jours en pastilles, créneaux du jour choisi.
/// Un article en rupture décale la première date possible (US-074).
class DeliveryDatetimeScreen extends ConsumerStatefulWidget {
  const DeliveryDatetimeScreen({super.key});

  @override
  ConsumerState<DeliveryDatetimeScreen> createState() => _DeliveryDatetimeScreenState();
}

class _DeliveryDatetimeScreenState extends ConsumerState<DeliveryDatetimeScreen> {
  late DateTime _date = DateTime.now();
  List<Map<String, dynamic>> _slots = const [];
  String? _slotId;
  bool _loading = true;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _dateKey =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _slotId = null;
      _message = '';
    });
    final checkout = ref.read(checkoutProvider);
    final cart = ref.read(cartProvider).value ?? {};
    try {
      final res = await CheckoutService.deliverySlots(
        addressId: checkout.addressId,
        nodeId: checkout.nodeId,
        deliveryTypeCode: checkout.deliveryTypeCode,
        date: _dateKey,
        cartItems: CheckoutService.itemsOf(cart),
      );
      if (!mounted) return;
      setState(() {
        _slots = res.slots;
        _message = res.message ?? '';
        // Rupture de stock : la livraison ne peut pas partir avant cette date.
        if (res.needsBackorder && res.earliestDate != null) {
          final earliest = DateTime.tryParse(res.earliestDate!);
          if (earliest != null && earliest.isAfter(_date)) {
            _date = earliest;
            _message = t("Le créneau vous sera confirmé par l'équipe.");
          }
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _slots = const [];
          _message = t('Erreur chargement des créneaux');
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final days = List.generate(7, (i) => DateTime.now().add(Duration(days: i)));

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(title: t('Date & Heure'), onBack: () => context.pop()),
          SizedBox(
            height: 78,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: S.lg),
              itemCount: days.length,
              separatorBuilder: (_, __) => const SizedBox(width: S.sm),
              itemBuilder: (context, i) {
                final day = days[i];
                final selected = day.day == _date.day && day.month == _date.month;
                return InkWell(
                  onTap: () {
                    setState(() => _date = day);
                    _load();
                  },
                  borderRadius: BorderRadius.circular(R.md),
                  child: Container(
                    width: 62,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? C.red : C.bgSoft,
                      borderRadius: BorderRadius.circular(R.md),
                      border: Border.all(color: selected ? C.red : C.line),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          fmtDate(day, pattern: 'EEE'),
                          style: ts(11, color: selected ? Colors.white : C.grey),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${day.day}',
                          style: ts(17,
                              weight: F.bold, color: selected ? Colors.white : C.ink),
                        ),
                        Text(
                          fmtDate(day, pattern: 'MMM'),
                          style: ts(10, color: selected ? Colors.white : C.grey),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const Divider(height: S.lg),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _slots.isEmpty
                    ? EmptyState(
                        icon: Icons.event_busy_outlined,
                        title: _message.isEmpty
                            ? t('Aucun créneau disponible ce jour')
                            : _message,
                        text: t('Choisissez une autre date'),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(S.lg, 0, S.lg, S.lg),
                        children: [
                          if (_message.isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(bottom: S.md),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: C.redSoft,
                                borderRadius: BorderRadius.circular(R.sm),
                              ),
                              child: Text(_message,
                                  style: ts(12.5, color: C.red, height: 1.4)),
                            ),
                          for (final slot in _slots) _slotTile(slot),
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
              label: t('Confirmer la planification'),
              onPressed: _slotId == null
                  ? null
                  : () {
                      final slot = _slots.firstWhere((s) => '${s['id']}' == _slotId);
                      ref.read(checkoutProvider.notifier).setSlot(
                            id: _slotId!,
                            label: _labelOf(slot),
                            date: _date,
                          );
                      context.push('/order/payment');
                    },
            ),
          ),
        ],
      ),
    );
  }

  String _labelOf(Map<String, dynamic> slot) {
    final start = (slot['slot_start'] ?? slot['start_time'] ?? '').toString();
    final end = (slot['slot_end'] ?? slot['end_time'] ?? '').toString();
    final name = (slot['name_fr'] ?? slot['name'] ?? '').toString();
    final hours = [start, end].where((s) => s.isNotEmpty).join(' - ');
    return [name, hours].where((s) => s.isNotEmpty).join(' · ');
  }

  Widget _slotTile(Map<String, dynamic> slot) {
    final id = '${slot['id']}';
    final full = slot['is_full'] == true || slot['is_past'] == true;
    final selected = _slotId == id;

    return Opacity(
      opacity: full ? 0.45 : 1,
      child: InkWell(
        onTap: full ? null : () => setState(() => _slotId = id),
        borderRadius: BorderRadius.circular(R.md),
        child: Container(
          margin: const EdgeInsets.only(bottom: S.sm),
          padding: const EdgeInsets.symmetric(horizontal: S.md, vertical: 14),
          decoration: BoxDecoration(
            color: selected ? C.redSoft : C.bg,
            borderRadius: BorderRadius.circular(R.md),
            border: Border.all(color: selected ? C.red : C.line),
          ),
          child: Row(
            children: [
              Icon(Icons.schedule,
                  size: 18, color: selected ? C.red : C.grey),
              const SizedBox(width: S.md),
              Expanded(
                child: Text(
                  _labelOf(slot),
                  style: ts(14, weight: selected ? F.semi : F.regular,
                      color: selected ? C.red : C.ink),
                ),
              ),
              if (selected) const Icon(Icons.check_circle, size: 18, color: C.red),
            ],
          ),
        ),
      ),
    );
  }
}
