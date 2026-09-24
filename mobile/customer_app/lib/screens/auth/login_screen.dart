import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../i18n/i18n.dart';
import '../../services/auth_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Maquette « page numéro de téléphone » : connexion sans mot de passe, par code SMS.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _controller = TextEditingController();
  bool _loading = false;
  String _error = '';

  /// Numéro marocain : 9 chiffres commençant par 5, 6 ou 7 (le 0 initial est toléré).
  String get _digits =>
      _controller.text.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^0'), '');

  bool get _valid => RegExp(r'^[5-7]\d{8}$').hasMatch(_digits);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    if (!_valid) {
      setState(() => _error = t('Saisissez un numéro marocain valide (ex. 6XX XXX XXX).'));
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      await AuthService.requestOtp(_digits);
      if (!mounted) return;
      context.push('/auth/verify-otp', extra: _digits);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = t('Impossible d\'envoyer le code. Réessayez.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: ConstrainedBox(
              // La feuille blanche descend jusqu'en bas de l'écran, comme sur la
              // maquette, et devient défilante dès que le clavier réduit la place.
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Visuel du panier, comme sur la maquette.
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Image.asset(
                        'assets/images/atina/basket.png',
                        width: width * 0.86,
                        height: width * 0.5,
                        fit: BoxFit.contain,
                      ),
                    ),
                    Expanded(child: _sheet()),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Feuille blanche à bord rouge qui remonte sur le visuel.
  Widget _sheet() {
    return Transform.translate(
      offset: const Offset(0, -6),
      child: Container(
        decoration: const BoxDecoration(
          color: C.bg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(34)),
          border: Border(top: BorderSide(color: C.red, width: 3)),
          boxShadow: [
            BoxShadow(color: Color(0x0F000000), blurRadius: 14, offset: Offset(0, -4)),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(22, 30, 22, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t('Bienvenue'), style: ts(26, weight: F.bold)),
            const SizedBox(height: 8),
            Text(
              t('Connectez-vous avec votre numéro de téléphone.'),
              style: ts(15, color: const Color(0xFF6B6B6B), height: 1.47),
            ),
            const SizedBox(height: 30),
            _phoneBox(),
            if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error, style: ts(12.5, weight: F.medium, color: C.red)),
              ),
            const SizedBox(height: 44),
            PrimaryButton(
              label: t('Continuer'),
              loading: _loading,
              onPressed: _valid ? _continue : null,
            ),
            const SizedBox(height: 40),
            _legal(),
          ],
        ),
      ),
    );
  }

  Widget _phoneBox() {
    return Container(
      height: 58,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: C.bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _error.isEmpty ? const Color(0xFFF0F0F0) : C.red),
        boxShadow: cardShadow,
      ),
      child: Row(
        children: [
          Image.asset('assets/images/atina/flag_ma.png', width: 18, height: 12),
          const SizedBox(width: 8),
          Text('+212', style: ts(15, weight: F.semi)),
          Container(
            width: 1,
            height: 24,
            color: const Color(0xFFE5E5E5),
            margin: const EdgeInsets.symmetric(horizontal: 12),
          ),
          Expanded(
            child: TextField(
              controller: _controller,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              maxLength: 12,
              onChanged: (_) => setState(() => _error = ''),
              onSubmitted: (_) => _continue(),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d ]'))],
              style: ts(15),
              decoration: InputDecoration(
                counterText: '',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                hintText: t('6XX XXX XXX'),
                hintStyle: ts(15, color: const Color(0xFFB0B0B0)),
              ),
            ),
          ),
          const Icon(Icons.smartphone, size: 18, color: C.grey),
        ],
      ),
    );
  }

  Widget _legal() {
    final link = ts(12, weight: F.medium, height: 1.58).copyWith(
      decoration: TextDecoration.underline,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Text.rich(
        TextSpan(
          style: ts(12, color: C.grey, height: 1.58),
          children: [
            TextSpan(text: '${t("En me connectant, j'accepte tous les")} '),
            TextSpan(text: t('Conditions générales'), style: link),
            TextSpan(text: ' ${t('et')} '),
            TextSpan(text: t('Politique de confidentialité'), style: link),
          ],
        ),
      ),
    );
  }
}
