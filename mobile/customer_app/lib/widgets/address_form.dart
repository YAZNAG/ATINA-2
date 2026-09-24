import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../i18n/i18n.dart';
import '../services/catalog_service.dart';
import '../theme/atina.dart';
import '../theme/widgets.dart';
import 'select_sheet.dart';

/// Formulaire d'adresse partagé par « Mes adresses » et le tunnel de commande.
///
/// Le bouton « Utiliser ma position actuelle » remplit la rue, le quartier, le code
/// postal et la ville ; le résultat s'affiche dans un encadré vert plutôt que dans
/// une alerte bloquante, comme demandé après le test sur téléphone.
class AddressForm extends StatefulWidget {
  const AddressForm({super.key, this.initial, required this.onSubmit});

  final Map<String, dynamic>? initial;
  final Future<void> Function(Map<String, dynamic> data) onSubmit;

  static Future<bool?> show(
    BuildContext context, {
    Map<String, dynamic>? initial,
    required Future<void> Function(Map<String, dynamic> data) onSubmit,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: AddressForm(initial: initial, onSubmit: onSubmit),
      ),
    );
  }

  @override
  State<AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<AddressForm> {
  late final _label = TextEditingController(text: widget.initial?['label'] as String? ?? '');
  late final _street = TextEditingController(
    text: [widget.initial?['street_number'], widget.initial?['street_name']]
        .whereType<String>()
        .join(', '),
  );
  late final _quartier =
      TextEditingController(text: widget.initial?['quartier'] as String? ?? '');
  late final _postal =
      TextEditingController(text: widget.initial?['postal_code'] as String? ?? '');
  late final _notes =
      TextEditingController(text: widget.initial?['delivery_notes'] as String? ?? '');

  List<Map<String, dynamic>> _cities = const [];
  String _city = '';
  double? _lat;
  double? _lng;
  bool _isDefault = false;
  bool _locating = false;
  String _located = '';
  String _error = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _city = widget.initial?['city'] as String? ?? '';
    _isDefault = widget.initial?['is_default'] == true;
    _lat = (widget.initial?['lat'] as num?)?.toDouble();
    _lng = (widget.initial?['lng'] as num?)?.toDouble();
    CatalogService.cities()
        .then((list) => mounted ? setState(() => _cities = list) : null)
        .catchError((Object _) {});
  }

  @override
  void dispose() {
    _label.dispose();
    _street.dispose();
    _quartier.dispose();
    _postal.dispose();
    _notes.dispose();
    super.dispose();
  }

  /// Comparaison de villes insensible aux accents et à la casse.
  String _norm(String s) => s
      .toLowerCase()
      .replaceAll(RegExp('[àâä]'), 'a')
      .replaceAll(RegExp('[éèêë]'), 'e')
      .replaceAll(RegExp('[îï]'), 'i')
      .replaceAll(RegExp('[ôö]'), 'o')
      .replaceAll(RegExp('[ûü]'), 'u')
      .trim();

  Future<void> _locate() async {
    setState(() {
      _locating = true;
      _located = '';
      _error = '';
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => _error = t('Autorisez la localisation pour utiliser votre position.'));
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      _lat = position.latitude;
      _lng = position.longitude;

      var summary = t('Position enregistrée');
      try {
        final places = await placemarkFromCoordinates(position.latitude, position.longitude);
        if (places.isNotEmpty) {
          final place = places.first;
          final street = [place.subThoroughfare, place.thoroughfare ?? place.name]
              .whereType<String>()
              .where((s) => s.isNotEmpty)
              .join(' ')
              .trim();
          if (street.isNotEmpty) _street.text = street;
          final district = place.subLocality ?? place.subAdministrativeArea ?? '';
          if (district.isNotEmpty) _quartier.text = district;
          if ((place.postalCode ?? '').isNotEmpty) _postal.text = place.postalCode!;
          final city = place.locality ?? '';
          if (city.isNotEmpty) {
            final match = _cities.where((c) => _norm('${c['name_fr']}') == _norm(city));
            _city = match.isNotEmpty ? '${match.first['name_fr']}' : city;
            final postal = match.isNotEmpty ? match.first['postal_code'] as String? : null;
            if (postal != null && _postal.text.isEmpty) _postal.text = postal;
          }
          final parts = [street, district, city].where((s) => s.isNotEmpty).toList();
          if (parts.isNotEmpty) summary = parts.join(', ');
        }
      } catch (_) {
        // Géocodage inverse facultatif : les coordonnées suffisent.
      }
      setState(() => _located = summary);
    } catch (_) {
      setState(() => _error =
          t("Impossible d'obtenir votre position. Vérifiez que le GPS est activé."));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _submit() async {
    if (_street.text.trim().isEmpty) {
      setState(() => _error =
          t('Saisissez la rue et le numéro, ou appuyez sur « Utiliser ma position actuelle ».'));
      return;
    }
    if (_city.trim().isEmpty) {
      setState(() => _error = t('Choisissez votre ville.'));
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });

    // « 12, rue des Orangers » → numéro et nom de rue séparés, comme l'attend l'API.
    final trimmed = _street.text.trim();
    final match = RegExp(r'^(\d+)\s*,?\s*(.+)$').firstMatch(trimmed);

    try {
      await widget.onSubmit({
        'label': _label.text.trim().isEmpty ? null : _label.text.trim(),
        'street_number': match?.group(1),
        'street_name': match?.group(2) ?? trimmed,
        'quartier': _quartier.text.trim().isEmpty ? null : _quartier.text.trim(),
        'city': _city.trim(),
        'postal_code': _postal.text.trim().isEmpty ? null : _postal.text.trim(),
        'delivery_notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'is_default': _isDefault,
        'lat': _lat,
        'lng': _lng,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      decoration: const BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(S.lg, S.md, S.lg, S.lg),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: C.line,
                  borderRadius: BorderRadius.circular(R.pill),
                ),
              ),
            ),
            const SizedBox(height: S.md),
            Text(
              widget.initial == null ? t('Nouvelle adresse') : t('Modifier l\'adresse'),
              style: ts(17, weight: F.bold),
            ),
            const SizedBox(height: S.lg),
            OutlinedButton.icon(
              onPressed: _locating ? null : _locate,
              icon: _locating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: C.red),
                    )
                  : const Icon(Icons.my_location, size: 18, color: C.red),
              label: Text(
                t('Utiliser ma position actuelle'),
                style: ts(13.5, weight: F.semi, color: C.red),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(46),
                side: const BorderSide(color: C.red),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.md)),
              ),
            ),
            if (_located.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: S.sm),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: C.greenSoft,
                  borderRadius: BorderRadius.circular(R.sm),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, size: 16, color: C.green),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_located, style: ts(12.5, color: C.green, height: 1.4)),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: S.lg),
            _field(t('Libellé (Maison, Bureau…)'), _label),
            _field(t('Adresse complète'), _street, hint: t('Ex : 12, rue des Orangers')),
            _field(t('Quartier'), _quartier),
            Padding(
              padding: const EdgeInsets.only(bottom: S.md),
              child: InkWell(
                onTap: () => SelectSheet.show(
                  context,
                  title: t('Choisir une ville'),
                  options: _cities
                      .map((c) => SelectOption(
                            '${c['name_fr']}',
                            tName(c),
                            hint: c['postal_code'] as String?,
                          ))
                      .toList(),
                  selected: _city,
                  onSelect: (value) {
                    setState(() => _city = value);
                    final match = _cities.where((c) => '${c['name_fr']}' == value);
                    final postal =
                        match.isNotEmpty ? match.first['postal_code'] as String? : null;
                    if (postal != null && _postal.text.isEmpty) _postal.text = postal;
                  },
                ),
                borderRadius: BorderRadius.circular(R.md),
                child: InputDecorator(
                  decoration: InputDecoration(labelText: t('Ville')),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _city.isEmpty ? t('Sélectionnez votre ville') : _city,
                          style: ts(14, color: _city.isEmpty ? C.greyLight : C.ink),
                        ),
                      ),
                      const Icon(Icons.keyboard_arrow_down, color: C.grey),
                    ],
                  ),
                ),
              ),
            ),
            _field(t('Code postal'), _postal, keyboard: TextInputType.number),
            _field(t('Instructions de livraison'), _notes, lines: 2),
            SwitchListTile.adaptive(
              value: _isDefault,
              onChanged: (v) => setState(() => _isDefault = v),
              activeThumbColor: C.red,
              contentPadding: EdgeInsets.zero,
              title: Text(t('Adresse par défaut'), style: ts(14)),
            ),
            if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: S.sm),
                child: Text(_error, style: ts(12.5, weight: F.medium, color: C.red)),
              ),
            const SizedBox(height: S.sm),
            PrimaryButton(
              label: t('Enregistrer'),
              loading: _saving,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? hint,
    int lines = 1,
    TextInputType? keyboard,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: S.md),
        child: TextField(
          controller: controller,
          maxLines: lines,
          keyboardType: keyboard,
          style: ts(14),
          decoration: InputDecoration(labelText: label, hintText: hint),
        ),
      );
}
