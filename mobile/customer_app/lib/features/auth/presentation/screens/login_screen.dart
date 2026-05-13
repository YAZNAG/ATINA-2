import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey  = GlobalKey<FormState>();
  final _phonCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  String _country = '+212';
  bool   _obscure = true;
  bool   _loading = false;

  @override
  void dispose() { _phonCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    await Future.delayed(const Duration(milliseconds: 800));
    if (mounted) context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: 24.w),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 48.h),
                Center(
                  child: Column(children: [
                    Container(
                      width: 76.w, height: 76.w,
                      decoration: BoxDecoration(
                        color:        AppTheme.primary,
                        borderRadius: BorderRadius.circular(22.r),
                        boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.35), blurRadius: 24, offset: const Offset(0, 10))],
                      ),
                      child: Icon(Icons.storefront_rounded, color: Colors.white, size: 38.sp),
                    ),
                    SizedBox(height: 16.h),
                    Text("Dark Store", style: TextStyle(fontSize: 28.sp, fontWeight: FontWeight.w800, color: AppTheme.text, letterSpacing: -0.5)),
                    SizedBox(height: 4.h),
                    Text("Livraison rapide a votre porte", style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),
                  ]),
                ),
                SizedBox(height: 40.h),
                Container(
                  padding: EdgeInsets.all(24.w),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24.r),
                    border: Border.all(color: AppTheme.border),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 20, offset: const Offset(0, 4))],
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text("Connexion", style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
                    SizedBox(height: 4.h),
                    Text("Entrez vos identifiants pour continuer", style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
                    SizedBox(height: 24.h),
                    Text("Telephone", style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.text)),
                    SizedBox(height: 8.h),
                    Row(children: [
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 16.h),
                        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(14.r)),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _country, isDense: true,
                            items: const [
                              DropdownMenuItem(value: "+212", child: Text("+212 MA")),
                              DropdownMenuItem(value: "+33",  child: Text("+33 FR")),
                              DropdownMenuItem(value: "+213", child: Text("+213 DZ")),
                            ],
                            onChanged: (v) => setState(() => _country = v!),
                          ),
                        ),
                      ),
                      SizedBox(width: 8.w),
                      Expanded(child: TextFormField(
                        controller: _phonCtrl, keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(hintText: "6 12 34 56 78"),
                        validator: (v) => (v?.isEmpty ?? true) ? "Telephone requis" : null,
                      )),
                    ]),
                    SizedBox(height: 16.h),
                    Text("Mot de passe", style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.text)),
                    SizedBox(height: 8.h),
                    TextFormField(
                      controller: _passCtrl, obscureText: _obscure,
                      decoration: InputDecoration(
                        hintText: "........",
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) => (v?.length ?? 0) < 4 ? "Mot de passe requis" : null,
                    ),
                    SizedBox(height: 4.h),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        child: Text("Mot de passe oublie ?", style: TextStyle(color: AppTheme.primary, fontSize: 12.sp)),
                      ),
                    ),
                    SizedBox(height: 4.h),
                    ElevatedButton(
                      onPressed: _loading ? null : _submit,
                      child: _loading
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                          : const Text("Se connecter"),
                    ),
                  ]),
                ),
                SizedBox(height: 20.h),
                Container(
                  padding: EdgeInsets.all(20.w),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20.r), border: Border.all(color: AppTheme.border)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text("Pas encore de compte ? ", style: TextStyle(color: AppTheme.textSub, fontSize: 14.sp)),
                    GestureDetector(
                      onTap: () => context.go("/register"),
                      child: Text("Creer un compte", style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700, fontSize: 14.sp)),
                    ),
                  ]),
                ),
                SizedBox(height: 32.h),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
