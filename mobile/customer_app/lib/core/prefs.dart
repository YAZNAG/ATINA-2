import 'package:shared_preferences/shared_preferences.dart';

/// Préférences locales de l'app : langue, point de distribution, onboarding, cache.
///
/// Les clés reprennent celles de l'app Expo pour qu'un même appareil retrouve ses
/// réglages après la migration (`preferred_lang`, `distribution_node_id`…).
class Prefs {
  static SharedPreferences? _sp;

  /// À appeler une fois au démarrage. Ne lève jamais : un stockage indisponible
  /// ne doit pas empêcher l'app de s'ouvrir.
  static Future<void> init() async {
    try {
      _sp = await SharedPreferences.getInstance();
    } catch (_) {
      _sp = null;
    }
  }

  static String? get(String key) {
    try {
      return _sp?.getString(key);
    } catch (_) {
      return null;
    }
  }

  static Future<void> set(String key, String? value) async {
    try {
      if (value == null || value.isEmpty) {
        await _sp?.remove(key);
      } else {
        await _sp?.setString(key, value);
      }
    } catch (_) {
      // Stockage plein ou indisponible : la valeur reste en mémoire pour la session.
    }
  }

  static const langKey = 'preferred_lang';
  static const nodeKey = 'distribution_node_id';
  static const onboardingKey = 'onboarding_done';
  static const homeCacheKey = 'home_cache_v1';
}

/// Point de distribution (node) choisi par le client sur « Complétez votre profil ».
///
/// Envoyé au backend dans l'en-tête `X-Node-Id` : le catalogue, les prix et le stock
/// sont ceux de ce node.
class NodePref {
  static String? _cached;

  static String? get() => _cached ??= Prefs.get(Prefs.nodeKey);

  static Future<void> set(String? id) async {
    _cached = id;
    await Prefs.set(Prefs.nodeKey, id);
  }
}
