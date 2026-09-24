import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../i18n/i18n.dart';
import '../../services/auth_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

const _otpLength = 4;
const _resendSeconds = 105; // 01:45 comme sur la maquette

/// Maquette « page vérification » : code SMS à quatre chiffres, minuteur, renvoi.
class VerifyOtpScreen extends StatefulWidget {
  const VerifyOtpScreen({super.key, required this.phoneNumber, this.country = '+212'});

  final String phoneNumber;
  final String country;

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  final _digits = List.filled(_otpLength, '');
  final _nodes = List.generate(_otpLength, (_) => FocusNode());
  final _controllers = List.generate(_otpLength, (_) => TextEditingController());

  bool _loading = false;
  bool _resending = false;
  String _error = '';
  String _info = '';
  int _timer = _resendSeconds;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _startTicker();
    WidgetsBinding.instance.addPostFrameCallback((_) => _nodes.first.requestFocus());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    for (final n in _nodes) {
      n.dispose();
    }
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timer <= 0) {
        timer.cancel();
        return;
      }
      setState(() => _timer--);
    });
  }

  String get _code => _digits.join();
  bool get _complete => _code.length == _otpLength && !_digits.contains('');

  String _mmss(int s) {
    final v = s < 0 ? 0 : s;
    return '${(v ~/ 60).toString().padLeft(2, '0')}:${(v % 60).toString().padLeft(2, '0')}';
  }

  Future<void> _verify() async {
    if (!_complete) {
      setState(() => _error = t('Entrez le code complet.'));
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final res = await AuthService.verifyOtp(
        widget.phoneNumber,
        _code,
        country: widget.country,
      );
      // Profil à compléter : premier accès ou nom encore générique.
      final name = res.customer?['name'] as String?;
      final needsProfile = res.isNew || name == null || name.isEmpty || name == 'Client';
      if (!mounted) return;
      context.go(needsProfile ? '/auth/complete-profile' : '/main/home');
    } on ApiError catch (e) {
      _reset(e.message);
    } catch (_) {
      _reset(t('Code incorrect. Réessayez.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _reset(String message) {
    if (!mounted) return;
    setState(() {
      _error = message;
      for (var i = 0; i < _otpLength; i++) {
        _digits[i] = '';
        _controllers[i].clear();
      }
    });
    _nodes.first.requestFocus();
  }

  void _onChanged(String text, int index) {
    final digits = text.replaceAll(RegExp(r'\D'), '');
    setState(() {
      _error = '';
      if (digits.length > 1) {
        // Collage ou remplissage automatique du code reçu par SMS.
        for (var k = 0; k < digits.length && index + k < _otpLength; k++) {
          _digits[index + k] = digits[k];
          _controllers[index + k].text = digits[k];
        }
      } else {
        _digits[index] = digits;
        _controllers[index].text = digits;
      }
    });

    final firstEmpty = _digits.indexWhere((d) => d.isEmpty);
    if (digits.isNotEmpty && firstEmpty != -1) {
      _nodes[firstEmpty].requestFocus();
    } else if (_complete) {
      _nodes[_otpLength - 1].unfocus();
      _verify();
    }
  }

  Future<void> _resend() async {
    if (_timer > 0 || _resending) return;
    setState(() {
      _resending = true;
      _error = '';
    });
    try {
      await AuthService.requestOtp(widget.phoneNumber, country: widget.country);
      setState(() {
        _timer = _resendSeconds;
        _info = t('Un nouveau code vous a été envoyé.');
        for (var i = 0; i < _otpLength; i++) {
          _digits[i] = '';
          _controllers[i].clear();
        }
      });
      _startTicker();
      _nodes.first.requestFocus();
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = t('Erreur lors du renvoi.'));
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: C.red,
        statusBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: C.red,
        body: Column(
          children: [
            // Bandeau rouge sous la barre d'état, comme sur la maquette.
            Container(color: C.red, height: MediaQuery.paddingOf(context).top + 44),
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: C.bg,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(34)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(22, 22, 22, 32),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  child: Column(
                    children: [
                      _header(),
                      Image.asset(
                        'assets/images/app/otp.png',
                        width: 110,
                        height: 130,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 20),
                      Text.rich(
                        TextSpan(
                          style: ts(14.5, color: const Color(0xFF6B6B6B), height: 1.52),
                          children: [
                            TextSpan(
                              text: '${t('Saisissez le code à {n} chiffres reçu par SMS au', {'n': _otpLength})} ',
                            ),
                            TextSpan(
                              text: '${widget.country} ${widget.phoneNumber}',
                              style: ts(14.5, weight: F.semi),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 26),
                      _boxes(),
                      if (_error.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            _error,
                            textAlign: TextAlign.center,
                            style: ts(12.5, weight: F.medium, color: C.red),
                          ),
                        )
                      else if (_info.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            _info,
                            textAlign: TextAlign.center,
                            style: ts(12.5, weight: F.medium, color: C.green),
                          ),
                        ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: C.redSoft,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(_mmss(_timer), style: ts(13, weight: F.bold, color: C.red)),
                      ),
                      const SizedBox(height: 10),
                      InkWell(
                        onTap: _timer > 0 || _resending ? null : _resend,
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text(
                            _resending ? t('Envoi…') : t('Renvoyer le code'),
                            style: ts(
                              13.5,
                              weight: F.medium,
                              color: _timer <= 0 ? C.red : C.grey,
                            ).copyWith(
                              decoration:
                                  _timer <= 0 ? TextDecoration.underline : TextDecoration.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      PrimaryButton(
                        label: t('Confirmer'),
                        loading: _loading,
                        onPressed: _complete ? _verify : null,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          InkWell(
            onTap: () => context.pop(),
            customBorder: const CircleBorder(),
            child: Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: C.bg,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Color(0x1A000000), blurRadius: 8, offset: Offset(0, 2)),
                ],
              ),
              child: const Icon(Icons.chevron_left, size: 22, color: C.ink),
            ),
          ),
          Text(t('Vérification du numéro'), style: ts(17, weight: F.bold)),
          const SizedBox(width: 36),
        ],
      ),
    );
  }

  Widget _boxes() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(_otpLength, (i) {
          final filled = _digits[i].isNotEmpty;
          return Container(
            width: 50,
            height: 50,
            margin: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              color: filled ? const Color(0xFFFFF7F7) : C.bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: filled || _error.isNotEmpty ? C.red : const Color(0xFF9A9A9A),
                width: 1.2,
              ),
            ),
            child: Semantics(
              label: t('Chiffre {n}', {'n': i + 1}),
              child: TextField(
                controller: _controllers[i],
                focusNode: _nodes[i],
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: i == 0 ? _otpLength : 1,
                style: ts(20, weight: F.bold),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (v) => _onChanged(v, i),
                onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                decoration: const InputDecoration(
                  counterText: '',
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
