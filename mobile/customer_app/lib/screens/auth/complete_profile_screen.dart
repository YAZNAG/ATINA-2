import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/prefs.dart';
import '../../i18n/i18n.dart';
import '../../services/catalog_service.dart';
import '../../services/profile_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';
import '../../widgets/select_sheet.dart';

/// Maquette « page les informations de client » : nom, ville, point de distribution,
/// code de parrainage facultatif (US-104).
class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _name = TextEditingController();
  final _referral = TextEditingController();

  List<Map<String, dynamic>> _cities = const [];
  List<Map<String, dynamic>> _nodes = const [];
  String? _cityId;
  String? _nodeId;
  bool _loadingNodes = false;
  bool _showReferral = false;
  bool _saving = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    CatalogService.cities()
        .then((list) => mounted ? setState(() => _cities = list) : null)
        .catchError((Object _) {});
  }

  @override
  void dispose() {
    _name.dispose();
    _referral.dispose();
    super.dispose();
  }

  Future<void> _selectCity(String id) async {
    setState(() {
      _cityId = id;
      _nodeId = null;
      _nodes = const [];
      _loadingNodes = true;
      _error = '';
    });
    try {
      final list = await CatalogService.nodes(id);
      if (!mounted) return;
      setState(() {
        _nodes = list;
        // Une seule adresse dans la ville : inutile de la faire choisir.
        if (list.length == 1) _nodeId = list.first['id'] as String?;
      });
    } catch (_) {
      if (mounted) setState(() => _nodes = const []);
    } finally {
      if (mounted) setState(() => _loadingNodes = false);
    }
  }

  bool get _canSubmit =>
      _name.text.trim().length >= 2 && _cityId != null && _nodeId != null;

  Future<void> _submit() async {
    if (!_canSubmit) {
      setState(() => _error = _name.text.trim().isEmpty
          ? t('Saisissez votre nom complet.')
          : _cityId == null
              ? t('Choisissez votre ville.')
              : t('Choisissez un point de distribution.'));
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      final referral = _referral.text.trim().toUpperCase();
      await ProfileService.update({
        'name': _name.text.trim(),
        'city_id': _cityId,
        'preferred_lang': I18n.lang,
        if (referral.isNotEmpty) 'referral_code': referral,
      });
      await NodePref.set(_nodeId);
      if (!mounted) return;
      context.go('/main/home');
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = t('Enregistrement impossible. Réessayez.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Map<String, dynamic>? _find(List<Map<String, dynamic>> list, String? id) {
    if (id == null) return null;
    for (final item in list) {
      if (item['id'] == id) return item;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final city = _find(_cities, _cityId);
    final node = _find(_nodes, _nodeId);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: C.red,
        statusBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: C.red,
        body: Column(
          children: [
            Container(color: C.red, height: MediaQuery.paddingOf(context).top + 44),
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: C.bg,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(34)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(22, 26, 22, 36),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Center(child: _AvatarPicker()),
                      const SizedBox(height: 22),
                      Text(t('Complétez votre profil'), style: ts(22, weight: F.bold)),
                      const SizedBox(height: 22),
                      _label(t('Nom complet')),
                      _FieldBox(
                        icon: Icons.person_outline,
                        child: TextField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          maxLength: 80,
                          onChanged: (_) => setState(() => _error = ''),
                          style: ts(14),
                          decoration: _inputDecoration(t('Ex: Mohammed Alami')),
                        ),
                      ),
                      _label(t('Choisir une ville')),
                      _SelectBox(
                        icon: Icons.location_on_outlined,
                        text: city != null ? tName(city) : t('Sélectionnez votre ville'),
                        empty: city == null,
                        onTap: () => SelectSheet.show(
                          context,
                          title: t('Choisir une ville'),
                          options: _cities
                              .map((c) => SelectOption(c['id'] as String, tName(c)))
                              .toList(),
                          selected: _cityId,
                          onSelect: _selectCity,
                        ),
                      ),
                      _label(t('Point de distribution le plus proche')),
                      _SelectBox(
                        icon: Icons.storefront_outlined,
                        text: node != null
                            ? tName(node)
                            : _cityId != null
                                ? t('Sélectionnez un point de distribution')
                                : t("Sélectionnez d'abord une ville"),
                        empty: node == null,
                        disabled: _cityId == null,
                        loading: _loadingNodes,
                        onTap: _cityId == null
                            ? null
                            : () => SelectSheet.show(
                                  context,
                                  title: t('Point de distribution le plus proche'),
                                  options: _nodes
                                      .map((n) => SelectOption(
                                            n['id'] as String,
                                            tName(n),
                                            hint: n['address_line1'] as String?,
                                          ))
                                      .toList(),
                                  selected: _nodeId,
                                  emptyText: t('Aucun point de distribution dans cette ville pour le moment.'),
                                  onSelect: (v) => setState(() {
                                    _nodeId = v;
                                    _error = '';
                                  }),
                                ),
                      ),
                      if (_showReferral) ...[
                        _label(t('Code de parrainage (facultatif)')),
                        _FieldBox(
                          icon: Icons.card_giftcard,
                          child: TextField(
                            controller: _referral,
                            autofocus: true,
                            maxLength: 20,
                            textCapitalization: TextCapitalization.characters,
                            inputFormatters: [
                              FilteringTextInputFormatter.deny(RegExp(r'\s')),
                              TextInputFormatter.withFunction(
                                (_, next) => next.copyWith(text: next.text.toUpperCase()),
                              ),
                            ],
                            style: ts(14),
                            decoration: _inputDecoration(t('Ex: ATN12345')),
                          ),
                        ),
                      ] else
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: InkWell(
                            onTap: () => setState(() => _showReferral = true),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Text(
                                t('Code de Parrainage (facultatif)'),
                                style: ts(13, weight: F.semi, color: C.red).copyWith(
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (_error.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(_error, style: ts(12.5, weight: F.medium, color: C.red)),
                        ),
                      const SizedBox(height: 24),
                      PrimaryButton(
                        label: t('Continuer'),
                        icon: Icons.check_circle_outline,
                        loading: _saving,
                        onPressed: _canSubmit ? _submit : null,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 8),
        child: Text(text, style: ts(13, weight: F.semi)),
      );

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        counterText: '',
        hintText: hint,
        hintStyle: ts(14, color: const Color(0xFFA0A0A0)),
        filled: false,
        isDense: true,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: EdgeInsets.zero,
      );
}

/// Avatar rond avec le bouton « + » de la maquette.
///
/// Le choix de la photo se fait depuis « Mon profil » : l'écran d'inscription ne
/// demande pas la permission d'accès aux images au premier lancement.
class _AvatarPicker extends StatelessWidget {
  const _AvatarPicker();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: 96,
          height: 96,
          decoration: const BoxDecoration(color: C.redSoft, shape: BoxShape.circle),
          child: const Icon(Icons.person_outline, size: 42, color: C.red),
        ),
        PositionedDirectional(
          end: 2,
          bottom: 2,
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: C.red,
              shape: BoxShape.circle,
              border: Border.all(color: C.bg, width: 2),
            ),
            child: const Icon(Icons.add, size: 14, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

/// Champ encadré de la maquette : icône à gauche, saisie à droite.
class _FieldBox extends StatelessWidget {
  const _FieldBox({required this.icon, required this.child});

  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: C.line),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF6B6B6B)),
          const SizedBox(width: 10),
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// Même champ, mais ouvrant une feuille de sélection.
class _SelectBox extends StatelessWidget {
  const _SelectBox({
    required this.icon,
    required this.text,
    required this.empty,
    this.onTap,
    this.disabled = false,
    this.loading = false,
  });

  final IconData icon;
  final String text;
  final bool empty;
  final VoidCallback? onTap;
  final bool disabled;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: disabled ? const Color(0xFFFAFAFA) : C.bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: C.line),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF6B6B6B)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ts(14, color: empty ? const Color(0xFFA0A0A0) : C.ink),
              ),
            ),
            if (loading)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: C.red),
              )
            else
              const Icon(Icons.keyboard_arrow_down, size: 20, color: Color(0xFF6B6B6B)),
          ],
        ),
      ),
    );
  }
}
