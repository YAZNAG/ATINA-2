import 'package:flutter/material.dart';

/// Charte de la maquette Figma « app client » : rouge Atina, fonds blancs, coins
/// arrondis, ombres douces, police Inter. Valeurs reprises une à une de la version
/// Expo (`src/theme/atina.tsx`) pour que les deux apps soient identiques à l'écran.
class C {
  static const red = Color(0xFFE10600);
  static const redDark = Color(0xFFB80500);
  static const redSoft = Color(0xFFFDECEC);
  static const redTint = Color(0xFFFFF4F4);
  static const yellow = Color(0xFFFFD400);
  static const ink = Color(0xFF0A0A0A);
  static const body = Color(0xFF4B4B4B);
  static const grey = Color(0xFF8A8A8A);
  static const greyLight = Color(0xFFB5B5B5);
  static const line = Color(0xFFEFEFEF);
  static const bg = Color(0xFFFFFFFF);
  static const bgSoft = Color(0xFFF7F7F7);
  static const green = Color(0xFF15803D);
  static const greenSoft = Color(0xFFEAF7EE);
}

/// Rayons d'arrondi.
class R {
  static const sm = 10.0;
  static const md = 14.0;
  static const lg = 18.0;
  static const xl = 24.0;
  static const pill = 999.0;
}

/// Échelle d'espacement.
class S {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
}

/// Graisses Inter utilisées par la maquette.
class F {
  static const regular = FontWeight.w400;
  static const medium = FontWeight.w500;
  static const semi = FontWeight.w600;
  static const bold = FontWeight.w700;
  static const black = FontWeight.w800;
}

/// Ombre douce des cartes de la maquette.
const cardShadow = [
  BoxShadow(
    color: Color(0x0F000000),
    blurRadius: 12,
    offset: Offset(0, 3),
  ),
];

/// Ombre colorée du bouton principal.
const buttonShadow = [
  BoxShadow(
    color: Color(0x40E10600),
    blurRadius: 10,
    offset: Offset(0, 4),
  ),
];

/// Police arabe de repli : Inter n'a pas de glyphes arabes, les textes du
/// dictionnaire AR s'afficheraient en carrés. Noto Sans Arabic (SIL OFL) prend le
/// relais caractère par caractère, sans changer le rendu du français.
const _fallback = ['NotoSansArabic'];

TextStyle ts(
  double size, {
  FontWeight weight = F.regular,
  Color color = C.ink,
  double? height,
}) =>
    TextStyle(
      fontFamily: 'Inter',
      fontFamilyFallback: _fallback,
      fontSize: size,
      fontWeight: weight,
      // L'arabe est une police variable : l'axe wght suit la graisse demandée.
      fontVariations: [FontVariation('wght', weight.value.toDouble())],
      color: color,
      height: height,
    );

ThemeData atinaTheme() {
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    fontFamilyFallback: _fallback,
    colorScheme: ColorScheme.fromSeed(
      seedColor: C.red,
      primary: C.red,
      surface: C.bg,
    ),
    scaffoldBackgroundColor: C.bg,
  );

  return base.copyWith(
    splashFactory: InkRipple.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: C.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
    ),
    dividerTheme: const DividerThemeData(color: C.line, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.bgSoft,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: S.lg, vertical: S.md + 2),
      hintStyle: ts(14, color: C.greyLight),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(R.md),
        borderSide: const BorderSide(color: C.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(R.md),
        borderSide: const BorderSide(color: C.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(R.md),
        borderSide: const BorderSide(color: C.red, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(R.md),
        borderSide: const BorderSide(color: C.red),
      ),
    ),
    textSelectionTheme: const TextSelectionThemeData(cursorColor: C.red),
  );
}
