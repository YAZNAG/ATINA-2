import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  AppTheme._();

  static const Color primary     = Color(0xFFDC2626);
  static const Color primaryDark = Color(0xFFB91C1C);
  static const Color surface     = Color(0xFFF9FAFB);
  static const Color card        = Colors.white;
  static const Color text        = Color(0xFF111827);
  static const Color textSub     = Color(0xFF6B7280);
  static const Color border      = Color(0xFFE5E7EB);
  static const Color success     = Color(0xFF10B981);
  static const Color warning     = Color(0xFFF59E0B);
  static const Color error       = Color(0xFFEF4444);

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      primary:   primary,
      onPrimary: Colors.white,
      surface:   surface,
    ),
    textTheme: GoogleFonts.poppinsTextTheme(),
    appBarTheme: const AppBarTheme(
      backgroundColor:  Colors.white,
      foregroundColor:  text,
      elevation:        0,
      centerTitle:      true,
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: CardThemeData(
      color:     card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side:         const BorderSide(color: border),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        minimumSize:     const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        elevation:  0,
        textStyle:  const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled:        true,
      fillColor:     const Color(0xFFF3F4F6),
      border:        OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: primary, width: 2)),
      errorBorder:   OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: error)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor:     Colors.white,
      selectedItemColor:   primary,
      unselectedItemColor: Color(0xFF9CA3AF),
      type:                BottomNavigationBarType.fixed,
      elevation:           8,
    ),
  );
}
