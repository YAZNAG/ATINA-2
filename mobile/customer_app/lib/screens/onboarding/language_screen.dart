import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../i18n/i18n.dart';
import '../../services/auth_service.dart';
import '../../services/profile_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Choix de la langue (maquette « page choix langue »).
///
/// Sur Flutter, passer à l'arabe bascule le sens d'écriture sans redémarrer l'app :
/// le détour par un rechargement, nécessaire côté React Native, disparaît.
class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key});

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen> {
  static const _languages = [
    (code: 'fr', label: 'Français', hint: 'Continuer en français.', flag: 'flag_fr'),
    (code: 'ar', label: 'العربية', hint: 'المتابعة باللغة العربية.', flag: 'flag_ma'),
  ];

  String? _selected;
  bool _saving = false;

  Future<void> _continue() async {
    final choice = _selected;
    if (choice == null) return;
    setState(() => _saving = true);
    try {
      await I18n.setLanguage(choice);
      if (AuthService.hasValidSession()) {
        // Le choix local suffit si le serveur ne répond pas.
        try {
          await ProfileService.update({'preferred_lang': choice});
        } catch (_) {}
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
    if (mounted) context.push('/onboarding/slides');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 36, 24, 24),
                child: Column(
                  children: [
                    const _Globe(),
                    const SizedBox(height: 22),
                    Text(
                      t('Choisissez votre langue'),
                      textAlign: TextAlign.center,
                      style: ts(24, weight: F.bold),
                    ),
                    const SizedBox(height: 10),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: Text(
                        t('Sélectionnez la langue que vous souhaitez utiliser. Vous pourrez la modifier à tout moment dans les paramètres.'),
                        textAlign: TextAlign.center,
                        style: ts(13.5, color: C.grey, height: 1.48),
                      ),
                    ),
                    const SizedBox(height: 28),
                    for (final lang in _languages) ...[
                      _LanguageCard(
                        label: lang.label,
                        hint: lang.hint,
                        flag: lang.flag,
                        active: _selected == lang.code,
                        onTap: () => setState(() => _selected = lang.code),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
              child: PrimaryButton(
                label: t('Continuer'),
                loading: _saving,
                onPressed: _selected == null ? null : _continue,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Illustration de la maquette : globe rouge et bulles « A » / « ع ».
class _Globe extends StatelessWidget {
  const _Globe();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      height: 130,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 116,
            height: 116,
            decoration: const BoxDecoration(color: C.redSoft, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Container(
              width: 78,
              height: 78,
              decoration: const BoxDecoration(
                color: C.bg,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Color(0x26E10600), blurRadius: 8, offset: Offset(0, 3)),
                ],
              ),
              child: const Icon(Icons.public, size: 40, color: C.red),
            ),
          ),
          const Positioned(top: 4, right: 10, child: _Bubble('A')),
          const Positioned(bottom: 8, left: 8, child: _Bubble('ع')),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: C.bg,
        shape: BoxShape.circle,
        border: Border.all(color: C.red, width: 1.5),
      ),
      child: Text(text, style: ts(15, weight: F.bold, color: C.red)),
    );
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({
    required this.label,
    required this.hint,
    required this.flag,
    required this.active,
    required this.onTap,
  });

  final String label;
  final String hint;
  final String flag;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      inMutuallyExclusiveGroup: true,
      selected: active,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            color: active ? C.redSoft : C.bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: active ? C.red : Colors.transparent),
            boxShadow: active ? null : cardShadow,
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: Image.asset(
                  'assets/images/atina/$flag.png',
                  width: 26,
                  height: 18,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: ts(15.5, weight: F.semi, color: active ? C.red : C.ink),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      hint,
                      style: ts(12, color: active ? C.red : C.grey),
                    ),
                  ],
                ),
              ),
              if (active) const Icon(Icons.check_circle, size: 18, color: C.red),
            ],
          ),
        ),
      ),
    );
  }
}
