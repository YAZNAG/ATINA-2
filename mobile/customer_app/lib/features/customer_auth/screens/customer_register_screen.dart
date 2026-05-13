import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../controllers/customer_auth_controller.dart';

const _red     = Color(0xFFDC2626);
const _darkRed = Color(0xFFB91C1C);

class CustomerRegisterScreen extends ConsumerStatefulWidget {
  const CustomerRegisterScreen({super.key});

  @override
  ConsumerState<CustomerRegisterScreen> createState() => _State();
}

class _State extends ConsumerState<CustomerRegisterScreen>
    with SingleTickerProviderStateMixin {

  final _formKey      = GlobalKey<FormState>();
  final _firstCtrl    = TextEditingController();
  final _lastCtrl     = TextEditingController();
  final _phoneCtrl    = TextEditingController();
  final _emailCtrl    = TextEditingController();
  final _passCtrl     = TextEditingController();
  final _confirmCtrl  = TextEditingController();

  final _firstFocus   = FocusNode();
  final _lastFocus    = FocusNode();
  final _phoneFocus   = FocusNode();
  final _emailFocus   = FocusNode();
  final _passFocus    = FocusNode();
  final _confirmFocus = FocusNode();

  String _countryCode = '+212';
  String _countryFlag = '🇲🇦';
  bool   _showPass    = false;
  bool   _showConfirm = false;

  late final AnimationController _anim;
  late final Animation<double>   _fade;
  late final Animation<Offset>   _slide;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor:          Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    _anim  = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _fade  = CurvedAnimation(parent: _anim, curve: Curves.easeIn);
    _slide = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _anim, curve: Curves.easeOut));
    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    for (final c in [_firstCtrl, _lastCtrl, _phoneCtrl, _emailCtrl, _passCtrl, _confirmCtrl]) c.dispose();
    for (final f in [_firstFocus, _lastFocus, _phoneFocus, _emailFocus, _passFocus, _confirmFocus]) f.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final fullName = '${_firstCtrl.text.trim()} ${_lastCtrl.text.trim()}';
    final ok = await ref.read(customerAuthProvider.notifier).register(
      phoneCountry: _countryCode,
      phone:        _phoneCtrl.text.trim(),
      fullName:     fullName,
      password:     _passCtrl.text,
      email:        _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
    );

    if (!ok && mounted) {
      _showSnack(ref.read(customerAuthProvider).error ?? 'Erreur lors de l\'inscription');
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

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(customerAuthProvider).isLoading;

    ref.listen(customerAuthProvider, (_, next) {
      if (!mounted) return;
      if (next.flow == CustomerAuthFlow.otpPending) {
        context.pushReplacement('/customer/otp');
      }
    });

    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        body: Stack(children: [
          // Red header background
          Positioned(
            top: 0, left: 0, right: 0,
            height: MediaQuery.of(context).size.height * 0.34,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [_red, _darkRed]),
              ),
            ),
          ),

          SafeArea(
            child: Column(children: [
              // ── Header ──────────────────────────────────────────────────────
              Padding(
                padding: EdgeInsets.fromLTRB(20.w, 8.h, 20.w, 0),
                child: Row(children: [
                  _BackBtn(onTap: () => context.pop()),
                  SizedBox(width: 12.w),
                  FadeTransition(
                    opacity: _fade,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Créer un compte', style: TextStyle(color: Colors.white, fontSize: 20.sp, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                      Text('Rejoignez El Herri dès maintenant', style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 12.sp)),
                    ]),
                  ),
                ]),
              ),

              // ── White scrollable card ────────────────────────────────────
              Expanded(
                child: SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: FadeTransition(
                    opacity: _fade,
                    child: SlideTransition(
                      position: _slide,
                      child: Container(
                        margin: EdgeInsets.only(top: 24.h),
                        decoration: BoxDecoration(
                          color:        Colors.white,
                          borderRadius: BorderRadius.only(topLeft: Radius.circular(32.r), topRight: Radius.circular(32.r)),
                          boxShadow:    [BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, -4))],
                        ),
                        padding: EdgeInsets.fromLTRB(24.w, 32.h, 24.w, 32.h),
                        child: Form(
                          key: _formKey,
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                            Text('Informations personnelles', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827), letterSpacing: -0.2)),
                            SizedBox(height: 4.h),
                            Text('Tous les champs marqués * sont requis', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF))),

                            SizedBox(height: 24.h),

                            // ── First + Last name row ──────────────────────
                            Row(children: [
                              Expanded(
                                child: _FieldGroup(
                                  label: 'Prénom *',
                                  child: _Field(
                                    ctrl:       _firstCtrl,
                                    focus:      _firstFocus,
                                    next:       _lastFocus,
                                    hint:       'Yassine',
                                    capitalization: TextCapitalization.words,
                                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                                  ),
                                ),
                              ),
                              SizedBox(width: 12.w),
                              Expanded(
                                child: _FieldGroup(
                                  label: 'Nom *',
                                  child: _Field(
                                    ctrl:       _lastCtrl,
                                    focus:      _lastFocus,
                                    next:       _phoneFocus,
                                    hint:       'Naggaz',
                                    capitalization: TextCapitalization.words,
                                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null,
                                  ),
                                ),
                              ),
                            ]),

                            SizedBox(height: 16.h),

                            // ── Phone ──────────────────────────────────────
                            _FieldGroup(
                              label: 'Téléphone *',
                              child: Row(children: [
                                // Country code selector
                                GestureDetector(
                                  onTap: () => _pickCountry(context),
                                  child: Container(
                                    height:  54.h,
                                    padding: EdgeInsets.symmetric(horizontal: 12.w),
                                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(14.r)),
                                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                                      Text(_countryFlag, style: TextStyle(fontSize: 18.sp)),
                                      SizedBox(width: 4.w),
                                      Text(_countryCode, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
                                      SizedBox(width: 2.w),
                                      Icon(Icons.expand_more_rounded, size: 16.sp, color: const Color(0xFF9CA3AF)),
                                    ]),
                                  ),
                                ),
                                SizedBox(width: 8.w),
                                Expanded(
                                  child: TextFormField(
                                    controller:      _phoneCtrl,
                                    focusNode:       _phoneFocus,
                                    keyboardType:    TextInputType.phone,
                                    textInputAction: TextInputAction.next,
                                    onFieldSubmitted: (_) => _emailFocus.requestFocus(),
                                    style: TextStyle(fontSize: 15.sp, color: const Color(0xFF111827)),
                                    decoration: _deco('6X XX XX XX'),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) return 'Requis';
                                      if (v.trim().replaceAll(RegExp(r'\D'), '').length < 9) return 'Invalide';
                                      return null;
                                    },
                                  ),
                                ),
                              ]),
                            ),

                            SizedBox(height: 16.h),

                            // ── Email (optional) ───────────────────────────
                            _FieldGroup(
                              label: 'Email (optionnel)',
                              child: _Field(
                                ctrl:            _emailCtrl,
                                focus:           _emailFocus,
                                next:            _passFocus,
                                hint:            'votre@email.com',
                                keyboard:        TextInputType.emailAddress,
                                prefix:          Icon(Icons.mail_outline_rounded, size: 20.sp, color: const Color(0xFF9CA3AF)),
                              ),
                            ),

                            SizedBox(height: 16.h),

                            // ── Password ───────────────────────────────────
                            _FieldGroup(
                              label: 'Mot de passe *',
                              child: TextFormField(
                                controller:      _passCtrl,
                                focusNode:       _passFocus,
                                obscureText:     !_showPass,
                                textInputAction: TextInputAction.next,
                                onFieldSubmitted: (_) => _confirmFocus.requestFocus(),
                                style: TextStyle(fontSize: 15.sp, color: const Color(0xFF111827)),
                                decoration: _deco('Minimum 6 caractères').copyWith(
                                  prefixIcon: Icon(Icons.lock_outline_rounded, size: 20.sp, color: const Color(0xFF9CA3AF)),
                                  suffixIcon: IconButton(
                                    icon: Icon(_showPass ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20.sp, color: const Color(0xFF9CA3AF)),
                                    onPressed: () => setState(() => _showPass = !_showPass),
                                  ),
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Requis';
                                  if (v.length < 6) return 'Minimum 6 caractères';
                                  return null;
                                },
                              ),
                            ),

                            SizedBox(height: 16.h),

                            // ── Confirm password ───────────────────────────
                            _FieldGroup(
                              label: 'Confirmer le mot de passe *',
                              child: TextFormField(
                                controller:      _confirmCtrl,
                                focusNode:       _confirmFocus,
                                obscureText:     !_showConfirm,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _submit(),
                                style: TextStyle(fontSize: 15.sp, color: const Color(0xFF111827)),
                                decoration: _deco('Répétez le mot de passe').copyWith(
                                  prefixIcon: Icon(Icons.lock_outline_rounded, size: 20.sp, color: const Color(0xFF9CA3AF)),
                                  suffixIcon: IconButton(
                                    icon: Icon(_showConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20.sp, color: const Color(0xFF9CA3AF)),
                                    onPressed: () => setState(() => _showConfirm = !_showConfirm),
                                  ),
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Requis';
                                  if (v != _passCtrl.text) return 'Les mots de passe ne correspondent pas';
                                  return null;
                                },
                              ),
                            ),

                            SizedBox(height: 32.h),

                            // ── Submit button ──────────────────────────────
                            _SubmitButton(loading: isLoading, onPressed: _submit),

                            SizedBox(height: 20.h),

                            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Text('Déjà un compte ? ', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
                              GestureDetector(
                                onTap: () => context.pop(),
                                child: Text('Se connecter', style: TextStyle(fontSize: 13.sp, color: _red, fontWeight: FontWeight.w700)),
                              ),
                            ]),

                            SizedBox(height: MediaQuery.of(context).viewInsets.bottom + 16.h),
                          ]),
                        ),
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

  void _pickCountry(BuildContext ctx) {
    const options = [
      ('🇲🇦', '+212', 'Maroc'),
      ('🇫🇷', '+33',  'France'),
      ('🇩🇿', '+213', 'Algérie'),
      ('🇹🇳', '+216', 'Tunisie'),
      ('🇪🇸', '+34',  'Espagne'),
      ('🇧🇪', '+32',  'Belgique'),
    ];
    showModalBottomSheet<void>(
      context:            ctx,
      isScrollControlled: true,
      backgroundColor:    Colors.transparent,
      builder: (_) => Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24.r))),
        padding: EdgeInsets.fromLTRB(0, 12.h, 0, 32.h),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40.w, height: 4.h, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2.r))),
          SizedBox(height: 20.h),
          Text('Choisir un pays', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
          SizedBox(height: 8.h),
          ...options.map((o) => ListTile(
            leading:  Text(o.$1, style: TextStyle(fontSize: 24.sp)),
            title:    Text(o.$3, style: TextStyle(fontSize: 15.sp)),
            trailing: Text(o.$2, style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280))),
            selected: o.$2 == _countryCode,
            selectedColor: _red,
            selectedTileColor: const Color(0xFFFEF2F2),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
            onTap: () {
              setState(() { _countryCode = o.$2; _countryFlag = o.$1; });
              Navigator.pop(ctx);
            },
          )),
        ]),
      ),
    );
  }

  InputDecoration _deco(String hint) => InputDecoration(
    hintText:   hint,
    hintStyle:  TextStyle(color: const Color(0xFF9CA3AF), fontSize: 13.sp),
    filled:     true,
    fillColor:  const Color(0xFFF3F4F6),
    border:          OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: BorderSide.none),
    focusedBorder:   OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: _red, width: 2)),
    errorBorder:     OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444))),
    focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2)),
    contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
  );
}

// ── Shared sub-widgets ────────────────────────────────────────────────────────
class _FieldGroup extends StatelessWidget {
  final String label;
  final Widget child;
  const _FieldGroup({required this.label, required this.child});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
      SizedBox(height: 8.h),
      child,
    ],
  );
}

class _Field extends StatelessWidget {
  final TextEditingController ctrl;
  final FocusNode?            focus;
  final FocusNode?            next;
  final String                hint;
  final TextInputType?        keyboard;
  final TextCapitalization    capitalization;
  final Widget?               prefix;
  final String? Function(String?)? validator;

  const _Field({
    required this.ctrl,
    this.focus,
    this.next,
    required this.hint,
    this.keyboard,
    this.capitalization = TextCapitalization.none,
    this.prefix,
    this.validator,
  });

  @override
  Widget build(BuildContext context) => TextFormField(
    controller:         ctrl,
    focusNode:          focus,
    keyboardType:       keyboard,
    textCapitalization: capitalization,
    textInputAction:    next != null ? TextInputAction.next : TextInputAction.done,
    onFieldSubmitted:   (_) { if (next != null) next!.requestFocus(); },
    style: TextStyle(fontSize: 15.sp, color: const Color(0xFF111827)),
    decoration: InputDecoration(
      hintText:   hint,
      hintStyle:  TextStyle(color: const Color(0xFF9CA3AF), fontSize: 13.sp),
      filled:     true,
      fillColor:  const Color(0xFFF3F4F6),
      prefixIcon: prefix,
      border:          OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: BorderSide.none),
      focusedBorder:   OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: _red, width: 2)),
      errorBorder:     OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444))),
      focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2)),
      contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
    ),
    validator: validator,
  );
}

class _BackBtn extends StatelessWidget {
  final VoidCallback onTap;
  const _BackBtn({required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width:  40.w, height: 40.w,
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), shape: BoxShape.circle),
      child: Icon(Icons.arrow_back_ios_rounded, color: Colors.white, size: 18.sp),
    ),
  );
}

class _SubmitButton extends StatelessWidget {
  final bool loading;
  final VoidCallback onPressed;
  const _SubmitButton({required this.loading, required this.onPressed});

  @override
  Widget build(BuildContext context) => AnimatedContainer(
    duration:     const Duration(milliseconds: 200),
    width:        double.infinity,
    height:       54.h,
    decoration: BoxDecoration(
      gradient:     loading ? null : const LinearGradient(colors: [_red, _darkRed]),
      color:        loading ? const Color(0xFFE5E7EB) : null,
      borderRadius: BorderRadius.circular(16.r),
      boxShadow:    loading ? null : [const BoxShadow(color: Color(0x55DC2626), blurRadius: 20, offset: Offset(0, 6))],
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
              : Text("S'inscrire", style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
        ),
      ),
    ),
  );
}
