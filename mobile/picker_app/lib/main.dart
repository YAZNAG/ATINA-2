import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'core/theme/app_theme.dart';
import 'features/realtime/realtime_provider.dart';
import 'routing/app_router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));
  runApp(const ProviderScope(child: PickerApp()));
}

class PickerApp extends ConsumerWidget {
  const PickerApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Initialise le provider temps réel au démarrage
    ref.watch(realtimeProvider);
    return ScreenUtilInit(
      designSize: const Size(390, 844),
      minTextAdapt: true,
      builder: (_, __) => MaterialApp.router(
        title:          'Picker App — Dark Store',
        theme:          AppTheme.light,
        routerConfig:   ref.watch(routerProvider),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}
