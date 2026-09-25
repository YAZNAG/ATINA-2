import 'package:atina_client/i18n/i18n.dart';
import 'package:atina_client/theme/atina.dart';
import 'package:atina_client/theme/widgets.dart';
import 'package:atina_client/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'polices.dart';

/// Contrôle de la charte Figma et des tailles réservées dans les grilles.
///
/// Les valeurs viennent des maquettes « app client » ; ce test les fige pour
/// qu'une retouche ne les fasse pas dériver sans qu'on s'en aperçoive.
void main() {
  setUpAll(chargerPolices);

  test('couleurs de la maquette', () {
    expect(C.red, const Color(0xFFE10600), reason: 'rouge Atina');
    expect(C.redSoft, const Color(0xFFFDECEC), reason: 'rouge clair des cartes');
    expect(C.yellow, const Color(0xFFFFD400), reason: 'jaune des badges de remise');
    expect(C.ink, const Color(0xFF0A0A0A), reason: 'texte principal');
    expect(C.grey, const Color(0xFF8A8A8A), reason: 'texte secondaire');
  });

  test('rayons et espacements', () {
    expect(R.md, 14.0);
    expect(R.lg, 18.0);
    expect(S.lg, 16.0);
    expect(atinaTheme().textTheme.bodyMedium?.fontFamily ?? 'Inter', 'Inter');
  });

  testWidgets('bouton principal : 54 px de haut, rouge, pleine largeur',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: atinaTheme(),
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: PrimaryButton(label: 'Continuer', onPressed: () {}),
          ),
        ),
      ),
    );
    final taille = tester.getSize(find.byType(PrimaryButton));
    expect(taille.height, 54);
    expect(taille.width, 800 - 32);
  });

  testWidgets('carte produit : hauteur réservée par les grilles', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: atinaTheme(),
          home: Scaffold(
            body: Align(
              alignment: Alignment.topLeft,
              child: SizedBox(
                width: 171,
                child: ProductCard(
                  article: const {
                    'id': 'art-1',
                    'sku_id': 'sku-1',
                    'name_fr': 'Beurre doux Président 200 g extra fin',
                    'price_ttc': 26.5,
                    'old_price_ttc': 30.0,
                    'discount_pct': 12,
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));

    final taille = tester.getSize(find.byType(ProductCard));
    expect(
      taille.height,
      lessThanOrEqualTo(228),
      reason: 'les grilles réservent 228 px : la carte ne doit pas dépasser',
    );
  });

  testWidgets('arabe : sens d\'écriture inversé', (tester) async {
    await I18n.setLanguage('ar');
    addTearDown(() => I18n.setLanguage('fr'));

    expect(I18n.isRTL, isTrue);
    expect(I18n.direction, TextDirection.rtl);
    expect(t('Accueil'), 'الرئيسية');
  });
}
