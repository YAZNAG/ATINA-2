/// Backend hébergé par défaut ; surchargeable au build avec --dart-define.
///
///   flutter run --dart-define=API_URL=http://192.168.1.10:5002/api
class Config {
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://atina2.atina.ma/api',
  );

  static const storageUrl = String.fromEnvironment(
    'STORAGE_URL',
    defaultValue: 'https://atina2.atina.ma',
  );

  static const timeout = Duration(seconds: 10);

  /// Chemin d'image renvoyé par l'API (« /uploads/... ») complété en URL absolue.
  static String media(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http')) return path;
    return '$storageUrl${path.startsWith('/') ? '' : '/'}$path';
  }
}
