import 'package:flutter/material.dart';

import '../i18n/i18n.dart';
import '../theme/atina.dart';

/// Option d'une feuille de sélection : libellé et précision facultative.
class SelectOption {
  const SelectOption(this.value, this.label, {this.hint});

  final String value;
  final String label;
  final String? hint;
}

/// Feuille glissante de choix (ville, point de distribution, motif…), reprise de
/// `components/ui/SelectSheet` : titre, liste cochable, fermeture par le bas.
class SelectSheet extends StatelessWidget {
  const SelectSheet({
    super.key,
    required this.title,
    required this.options,
    required this.onSelect,
    this.selected,
    this.emptyText,
  });

  final String title;
  final List<SelectOption> options;
  final ValueChanged<String> onSelect;
  final String? selected;
  final String? emptyText;

  static Future<void> show(
    BuildContext context, {
    required String title,
    required List<SelectOption> options,
    required ValueChanged<String> onSelect,
    String? selected,
    String? emptyText,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => SelectSheet(
        title: title,
        options: options,
        onSelect: onSelect,
        selected: selected,
        emptyText: emptyText,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.7,
      ),
      decoration: const BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: C.line,
                borderRadius: BorderRadius.circular(R.pill),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.lg, 4, S.lg, S.md),
              child: Row(
                children: [
                  Expanded(child: Text(title, style: ts(16, weight: F.bold))),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, size: 20, color: C.grey),
                    tooltip: t('Fermer'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: options.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(28),
                      child: Text(
                        emptyText ?? t('Aucun résultat'),
                        textAlign: TextAlign.center,
                        style: ts(13.5, color: C.grey, height: 1.5),
                      ),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      itemCount: options.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, indent: S.lg),
                      itemBuilder: (context, i) {
                        final option = options[i];
                        final active = option.value == selected;
                        return ListTile(
                          onTap: () {
                            onSelect(option.value);
                            Navigator.of(context).pop();
                          },
                          title: Text(
                            option.label,
                            style: ts(
                              14.5,
                              weight: active ? F.semi : F.regular,
                              color: active ? C.red : C.ink,
                            ),
                          ),
                          subtitle: option.hint == null || option.hint!.isEmpty
                              ? null
                              : Text(option.hint!, style: ts(12, color: C.grey)),
                          trailing: active
                              ? const Icon(Icons.check_circle, size: 20, color: C.red)
                              : null,
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
