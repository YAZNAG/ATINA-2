import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'core/theme/app_theme.dart';
import 'routing/app_router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:      Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(const ProviderScope(child: CustomerApp()));
}

class CustomerApp extends ConsumerWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return ScreenUtilInit(
      designSize:        const Size(390, 844), // iPhone 14 base
      minTextAdapt:      true,
      splitScreenMode:   true,
      builder:           (_, child) => MaterialApp.router(
        title:             'Dark Store',
        theme:             AppTheme.light,
        routerConfig:      router,
        debugShowCheckedModeBanner: false,
        builder:           (context, child) => child!,
      ),
    );
  }
}
