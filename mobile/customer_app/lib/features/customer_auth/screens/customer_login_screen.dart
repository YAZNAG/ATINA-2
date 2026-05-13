import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

// ── Country option ─────────────────────────────────────────────────────────────
class _Country {
  final String flag, code, name;
  const _Country(this.flag, this.code, this.name);
}

const _countries = [
  _Country('🇲🇦', '+212', 'Maroc'),
  _Country('🇫🇷', '+33',  'France'),
  _Country('🇩🇿', '+213', 'Algérie'),
  _Country('🇹🇳', '+216', 'Tunisie'),
  _Country('🇪🇸', '+34',  'Espagne'),
  _Country('🇧🇪', '+32',  'Belgique'),
];

// ─────────────────────────────────────────────────────────────────────────────
class CustomerLoginScreen extends ConsumerStatefulWidget {
  const CustomerLoginScreen({super.key});

  @override
  ConsumerState<CustomerLoginScreen> createState() => _CustomerLoginScreenState();
}

class _CustomerLoginScreenState extends ConsumerState<CustomerLoginScreen>
    with SingleTickerProviderStateMixin {

  final _phoneCtrl    = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey      = GlobalKey<FormState>();
  final _phoneFocus   = FocusNode();
  final _passFocus    = FocusNode();

  _Country _country  = _countries[0];
  bool     _showPass = false;

  late final AnimationController _anim;
  late final Animation<double>   _fadeAnim;
  late final Animation<Offset>   _slideAnim;

  static const _red     = Color(0xFFDC2626);
  static const _darkRed = Color(0xFFB91C1C);

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor:          Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _fadeAnim  = CurvedAnimation(parent: _anim, curve: Curves.easeIn);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _anim, curve: Curves.easeOut));
    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    _phoneFocus.dispose();
    _passFocus.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final ok = await ref.read(customerAuthProvider.notifier).login(
      phoneCountry: _country.code,
      phone:        _phoneCtrl.text.trim(),
      password:     _passwordCtrl.text,
    );
    if (!ok && mounted) {
      _showSnack(ref.read(customerAuthProvider).error ?? 'Erreur de connexion');
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:         Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: const Color(0xFFEF4444),
      behavior:        SnackBarBehavior.floating,
      margin:          EdgeInsets.all(16.w),
      shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
      duration:        const Duration(seconds: 3),
    ));
  }

  void _pickCountry() {
    showModalBottomSheet<void>(
      context:             context,
      isScrollControlled:  true,
      backgroundColor:     Colors.transparent,
      builder: (_) => _CountrySheet(
        selected: _country,
        onPick:   (c) => setState(() => _country = c),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(customerAuthProvider).isLoading;

    ref.listen(customerAuthProvider, (_, next) {
      if (!mounted) return;
      if (next.flow == CustomerAuthFlow.authenticated) context.go('/home');
    });

    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        body: Stack(children: [
          // ── Red gradient header bg ────────────────────────────────────────
          Positioned(
            top: 0, left: 0, right: 0,
            height: MediaQuery.of(context).size.height * 0.44,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end:   Alignment.bottomRight,
                  colors: [_red, _darkRed],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(children: [
              // ── Header ────────────────────────────────────────────────────
              Padding(
                padding: EdgeInsets.fromLTRB(28.w, 24.h, 28.w, 0),
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      // Logo row
                      Row(children: [
                        Container(
                          width: 46.w, height: 46.w,
                          decoration: BoxDecoration(
                            color:        Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(14.r),
                          ),
                          child: Stack(alignment: Alignment.center, children: [
                            Icon(Icons.shopping_bag_rounded, color: Colors.white, size: 26.sp),
                            Positioned(
                              bottom: 6.h, right: 6.w,
                              child: Container(
                                width: 14.w, height: 14.w,
                                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                                child: Icon(Icons.check_rounded, color: _red, size: 9.sp),
                              ),
                            ),
                          ]),
                        ),
                        SizedBox(width: 12.w),
                        Text('El Herri', style: TextStyle(color: Colors.white, fontSize: 22.sp, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                      ]),

                      SizedBox(height: 22.h),

                      Text(
                        'Prêt à\ncommander ?',
                        style: TextStyle(color: Colors.white, fontSize: 30.sp, fontWeight: FontWeight.w800, height: 1.2, letterSpacing: -0.5),
                      ),
                      SizedBox(height: 6.h),
                      Text(
                        'Connectez-vous pour accéder à votre compte',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 13.sp),
                      ),
                    ]),
                  ),
                ),
              ),

              // ── White card ────────────────────────────────────────────────
              Expanded(
                child: SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: Container(
                      margin: EdgeInsets.only(top: 20.h),
                      decoration: BoxDecoration(
                        color:        Colors.white,
                        borderRadius: BorderRadius.only(
                          topLeft:  Radius.circular(32.r),
                          topRight: Radius.circular(32.r),
                        ),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, -4))],
                      ),
                      padding: EdgeInsets.fromLTRB(24.w, 32.h, 24.w, 32.h),
                      child: Form(
                        key: _formKey,
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                          Text('Bon retour 👋', style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827), letterSpacing: -0.3)),
                          SizedBox(height: 4.h),
                          Text('Entrez vos identifiants pour continuer', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),

                          SizedBox(height: 28.h),

                          // Phone
                          _Label('Téléphone'),
                          SizedBox(height: 8.h),
                          Row(children: [
                            GestureDetector(
                              onTap: _pickCountry,
                              child: Container(
                                height:  54.h,
                                padding: EdgeInsets.symmetric(horizontal: 14.w),
                                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(14.r)),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Text(_country.flag, style: TextStyle(fontSize: 20.sp)),
                                  SizedBox(width: 6.w),
                                  Text(_country.code, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
                                  SizedBox(width: 4.w),
                                  Icon(Icons.expand_more_rounded, size: 18.sp, color: const Color(0xFF9CA3AF)),
                                ]),
                              ),
                            ),
                            SizedBox(width: 10.w),
                            Expanded(
                              child: TextFormField(
                                controller:      _phoneCtrl,
                                focusNode:       _phoneFocus,
                                keyboardType:    TextInputType.phone,
                                textInputAction: TextInputAction.next,
                                onFieldSubmitted: (_) => _passFocus.requestFocus(),
                                style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w500, color: const Color(0xFF111827)),
                                decoration: _inputDeco('6X XX XX XX'),
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return 'Numéro requis';
                                  if (v.trim().replaceAll(RegExp(r'\D'), '').length < 9) return 'Numéro invalide';
                                  return null;
                                },
                              ),
                            ),
                          ]),

                          SizedBox(height: 16.h),

                          // Password
                          _Label('Mot de passe'),
                          SizedBox(height: 8.h),
                          TextFormField(
                            controller:      _passwordCtrl,
                            focusNode:       _passFocus,
                            obscureText:     !_showPass,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _login(),
                            style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w500, color: const Color(0xFF111827)),
                            decoration: _inputDeco('••••••••').copyWith(
                              prefixIcon: Icon(Icons.lock_outline_rounded, size: 20.sp, color: const Color(0xFF9CA3AF)),
                              suffixIcon: IconButton(
                                icon: Icon(_showPass ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20.sp, color: const Color(0xFF9CA3AF)),
                                onPressed: () => setState(() => _showPass = !_showPass),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Mot de passe requis';
                              if (v.length < 6) return 'Minimum 6 caractères';
                              return null;
                            },
                          ),

                          SizedBox(height: 32.h),

                          _PrimaryButton(label: 'Se connecter', loading: isLoading, onPressed: _login),

                          SizedBox(height: 20.h),

                          Row(children: [
                            const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: 14.w),
                              child: Text('ou', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF9CA3AF))),
                            ),
                            const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                          ]),

                          SizedBox(height: 20.h),

                          _SecondaryButton(label: 'Créer un compte', onPressed: () => context.push('/customer/register')),

                          SizedBox(height: 32.h),

                          Center(
                            child: Wrap(alignment: WrapAlignment.center, children: [
                              Text('En continuant, vous acceptez nos ', style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
                              GestureDetector(child: Text('Conditions', style: TextStyle(fontSize: 11.sp, color: _red, fontWeight: FontWeight.w600))),
                              Text(' et notre ', style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
                              GestureDetector(child: Text('Confidentialité', style: TextStyle(fontSize: 11.sp, color: _red, fontWeight: FontWeight.w600))),
                            ]),
                          ),

                          SizedBox(height: MediaQuery.of(context).viewInsets.bottom),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  InputDecoration _inputDeco(String hint) => InputDecoration(
    hintText:    hint,
    hintStyle:   TextStyle(color: const Color(0xFF9CA3AF), fontSize: 14.sp),
    filled:      true,
    fillColor:   const Color(0xFFF3F4F6),
    border:           OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: BorderSide.none),
    focusedBorder:    OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: _red, width: 2)),
    errorBorder:      OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444))),
    focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2)),
    contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
  );
}

// ── Widgets ────────────────────────────────────────────────────────────────────
class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Text(text, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151)));
}

class _CountrySheet extends StatelessWidget {
  final _Country selected;
  final void Function(_Country) onPick;
  const _CountrySheet({required this.selected, required this.onPick});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24.r))),
      padding: EdgeInsets.fromLTRB(0, 12.h, 0, 32.h),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40.w, height: 4.h, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2.r))),
        SizedBox(height: 20.h),
        Text('Choisir un pays', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        SizedBox(height: 8.h),
        ..._countries.map((c) => ListTile(
          leading:  Text(c.flag, style: TextStyle(fontSize: 24.sp)),
          title:    Text(c.name, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w500)),
          trailing: Text(c.code, style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
          selected: c.code == selected.code,
          selectedColor:     const Color(0xFFDC2626),
          selectedTileColor: const Color(0xFFFEF2F2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
          onTap: () { onPick(c); Navigator.pop(context); },
        )),
      ]),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final bool   loading;
  final VoidCallback onPressed;
  const _PrimaryButton({required this.label, required this.loading, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration:     const Duration(milliseconds: 200),
      width:        double.infinity,
      height:       54.h,
      decoration: BoxDecoration(
        gradient:     loading ? null : const LinearGradient(colors: [Color(0xFFDC2626), Color(0xFFB91C1C)]),
        color:        loading ? const Color(0xFFE5E7EB) : null,
        borderRadius: BorderRadius.circular(16.r),
        boxShadow:    loading ? null : [BoxShadow(color: const Color(0x55DC2626), blurRadius: 20, offset: const Offset(0, 6))],
      ),
      child: Material(
        color:        Colors.transparent,
        borderRadius: BorderRadius.circular(16.r),
        child: InkWell(
          borderRadius: BorderRadius.circular(16.r),
          onTap:       loading ? null : onPressed,
          child: Center(
            child: loading
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : Text(label, style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
          ),
        ),
      ),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  const _SecondaryButton({required this.label, required this.onPressed});

  @override
  Widget build(BuildContext context) => SizedBox(
    width:  double.infinity,
    height: 54.h,
    child: OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        side:            const BorderSide(color: Color(0xFFDC2626), width: 1.5),
        shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        foregroundColor: const Color(0xFFDC2626),
      ),
      child: Text(label, style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
    ),
  );
}
