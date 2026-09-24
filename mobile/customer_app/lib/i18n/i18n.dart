import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../core/prefs.dart';
import 'ar.dart';

/// Traduction FR/AR de l'application (le classeur demande une app bilingue, arabe en RTL).
///
/// La clé est le texte français ; sans traduction connue, le français est affiché.
/// Contrairement à la version Expo, changer de langue ne recharge pas l'application :
/// Flutter bascule le sens d'écriture par `Directionality`, et [langNotifier] suffit à
/// reconstruire l'arbre.
class I18n {
  static String _lang = 'fr';

  static String get lang => _lang;
  static bool get isRTL => _lang == 'ar';
  static TextDirection get direction =>
      isRTL ? TextDirection.rtl : TextDirection.ltr;

  /// Notifie les widgets qui dépendent de la langue (racine de l'app).
  static final langNotifier = ValueNotifier<String>('fr');

  /// Lu au démarrage, avant le premier écran. Ne lève jamais.
  static Future<void> init() async {
    try {
      _lang = Prefs.get(Prefs.langKey) == 'ar' ? 'ar' : 'fr';
    } catch (_) {
      _lang = 'fr';
    }
    langNotifier.value = _lang;
  }

  static Future<void> setLanguage(String lang) async {
    if (lang != 'fr' && lang != 'ar') return;
    _lang = lang;
    langNotifier.value = lang;
    await Prefs.set(Prefs.langKey, lang);
  }

  /// Locale utilisée pour les nombres et les dates (chiffres latins en arabe marocain).
  static String get locale => isRTL ? 'ar_MA' : 'fr_FR';
}

/// `t('Bonjour {name}', {'name': nom})` — les {x} sont remplacés dans les deux langues.
String t(String fr, [Map<String, Object?>? vars]) {
  var out = I18n.isRTL ? (arStrings[fr] ?? fr) : fr;
  if (vars != null) {
    vars.forEach((k, v) => out = out.replaceAll('{$k}', '${v ?? ''}'));
  }
  return out;
}

/// Nom localisé d'une entité `{ name_fr, name_ar }` renvoyée par l'API.
String tName(Map<String, dynamic>? o, [String field = 'name']) {
  if (o == null) return '';
  final ar = o['${field}_ar'];
  if (I18n.isRTL && ar is String && ar.trim().isNotEmpty) return ar;
  final fr = o['${field}_fr'];
  return fr is String ? fr : '';
}

/// Montant en dirhams, format de la maquette : « 12,50 MAD ».
String fmtPrice(num? value) => '${fmtNumber(value ?? 0)} ${t('MAD')}';

String fmtNumber(num value, {int digits = 2}) {
  final pattern = value % 1 == 0 ? '#,##0' : '#,##0.${'0' * digits}';
  return NumberFormat(pattern, I18n.locale).format(value);
}

String fmtDate(DateTime? date, {String pattern = 'd MMMM y'}) {
  if (date == null) return '';
  return DateFormat(pattern, I18n.locale).format(date);
}

/// Données serveur bilingues : en arabe, chaque champ `xxx_fr` est remplacé par
/// `xxx_ar` lorsqu'il est renseigné, pour que les écrans n'aient qu'un champ à lire.
dynamic localizeData(dynamic data) {
  if (!I18n.isRTL || data == null) return data;
  if (data is List) {
    for (final item in data) {
      localizeData(item);
    }
    return data;
  }
  if (data is Map) {
    for (final key in data.keys.toList()) {
      final value = data[key];
      if (key is String && key.endsWith('_fr')) {
        final ar = data['${key.substring(0, key.length - 3)}_ar'];
        if (ar is String && ar.trim().isNotEmpty) data[key] = ar;
      } else if (value is Map || value is List) {
        localizeData(value);
      }
    }
  }
  return data;
}
