import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/prefs.dart';
import '../../i18n/i18n.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Les deux slides de présentation (maquette) : « Ignorer » en haut à droite,
/// illustration, titre, texte, points de progression, bouton rouge.
///
/// Les deux écrans séparés de la version Expo deviennent un seul `PageView` :
/// le geste horizontal marche aussi, ce que la maquette suggérait sans l'obtenir.
class SlidesScreen extends StatefulWidget {
  const SlidesScreen({super.key, this.initialPage = 0});

  final int initialPage;

  @override
  State<SlidesScreen> createState() => _SlidesScreenState();
}

class _SlidesScreenState extends State<SlidesScreen> {
  late final PageController _controller =
      PageController(initialPage: widget.initialPage);
  late int _page = widget.initialPage;

  static const _slides = [
    (
      image: 'assets/images/app/onboarding1.png',
      title: 'Tous vos essentiels au même endroit',
      body: 'Faites vos courses facilement : snacks, produits ménagers, hygiène et bien plus encore',
    ),
    (
      image: 'assets/images/atina/gifts.png',
      title: 'Gagnez des cadeaux exclusifs',
      body: "Cumulez des points, gagnez des produits gratuits et profitez d'offres exclusives à chaque achat.",
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await Prefs.set(Prefs.onboardingKey, '1');
    if (mounted) context.go('/auth/login');
  }

  void _next() {
    if (_page < _slides.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    } else {
      _finish();
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isLast = _page == _slides.length - 1;

    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 24, left: 24, top: 12),
              child: Align(
                alignment: AlignmentDirectional.centerEnd,
                child: InkWell(
                  onTap: _finish,
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: Text(
                      t('Ignorer'),
                      style: ts(14.5, weight: F.semi, color: C.red),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) {
                  final slide = _slides[i];
                  return Column(
                    children: [
                      SizedBox(
                        height: size.height * 0.4,
                        child: Center(
                          child: Image.asset(
                            slide.image,
                            width: size.width * 0.78,
                            height: size.height * 0.38,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(32, 18, 32, 0),
                        child: Column(
                          children: [
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 300),
                              child: Text(
                                t(slide.title),
                                textAlign: TextAlign.center,
                                style: ts(24, weight: F.bold, height: 1.33),
                              ),
                            ),
                            const SizedBox(height: 10),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 320),
                              child: Text(
                                t(slide.body),
                                textAlign: TextAlign.center,
                                style: ts(13.5, color: C.grey, height: 1.55),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: Column(
                children: [
                  _Dots(count: _slides.length, active: _page),
                  const SizedBox(height: 22),
                  PrimaryButton(
                    label: t(isLast ? 'Commencer' : 'Suivant'),
                    onPressed: _next,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Points de progression : le point actif est une pilule rouge.
class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});

  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final on = i == active;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: on ? 22 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: on ? C.red : C.line,
            borderRadius: BorderRadius.circular(R.pill),
          ),
        );
      }),
    );
  }
}
