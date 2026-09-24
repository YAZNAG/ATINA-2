import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/prefs.dart';
import 'core/token_storage.dart';
import 'i18n/i18n.dart';
import 'router.dart';
import 'theme/atina.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Le démarrage ne doit jamais rester bloqué : chaque étape est tolérante à l'échec
  // et l'ensemble est plafonné, comme sur l'app Expo où l'ouverture posait problème.
  await Future.any([
    _warmUp(),
    Future.delayed(const Duration(milliseconds: 1500)),
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));

  runApp(const ProviderScope(child: AtinaApp()));
}

Future<void> _warmUp() async {
  await Prefs.init();
  await Future.wait([TokenStorage.init(), I18n.init()]);
}

class AtinaApp extends StatelessWidget {
  const AtinaApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Changer de langue bascule aussi le sens d'écriture, sans recharger l'app.
    return ValueListenableBuilder<String>(
      valueListenable: I18n.langNotifier,
      builder: (_, lang, __) {
        return MaterialApp.router(
          title: 'Atina',
          debugShowCheckedModeBanner: false,
          theme: atinaTheme(),
          routerConfig: router,
          locale: Locale(lang),
          supportedLocales: const [Locale('fr'), Locale('ar')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) => MediaQuery.withClampedTextScaling(
            maxScaleFactor: 1.3,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
