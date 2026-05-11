import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey    = GlobalKey<FormState>();
  final _phonCtrl   = TextEditingController();
  final _passCtrl   = TextEditingController();
  String _country   = '+212';
  bool   _obscure   = true;

  @override
  void dispose() {
    _phonCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final phone = _phonCtrl.text.trim().replaceFirst(RegExp(r'^0'), '');
    final ok = await ref.read(authProvider.notifier).login(
      phoneCountry: _country,
      phoneNumber:  phone,
      password:     _passCtrl.text.trim(),
    );
    if (!ok && mounted) {
      final err = ref.read(authProvider).errorMessage ?? 'Erreur de connexion';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: AppTheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authProvider).isLoading;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 32.h),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 40.h),

                // Logo / Brand
                Center(
                  child: Container(
                    width: 72.w,
                    height: 72.w,
                    decoration: BoxDecoration(
                      color:        AppTheme.primary,
                      borderRadius: BorderRadius.circular(20.r),
                      boxShadow: [
                        BoxShadow(color: AppTheme.primary.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8)),
                      ],
                    ),
                    child: Icon(Icons.storefront_rounded, color: Colors.white, size: 36.sp),
                  ),
                ),

                SizedBox(height: 24.h),
                Center(child: Text('Dark Store', style: TextStyle(fontSize: 26.sp, fontWeight: FontWeight.w700, color: AppTheme.text))),
                Center(child: Text('Commandez en quelques clics', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub))),

                SizedBox(height: 48.h),

                Text('Connexion', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w600, color: AppTheme.text)),
                SizedBox(height: 8.h),
                Text('Entrez votre téléphone et mot de passe', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),

                SizedBox(height: 28.h),

                // Phone field
                Text('Téléphone', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.text)),
                SizedBox(height: 8.h),
                Row(children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 16.h),
                    decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(14.r)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value:   _country,
                        isDense: true,
                        items: const [
                          DropdownMenuItem(value: '+212', child: Text('+212 🇲🇦')),
                          DropdownMenuItem(value: '+33',  child: Text('+33 🇫🇷')),
                          DropdownMenuItem(value: '+213', child: Text('+213 🇩🇿')),
                        ],
                        onChanged: (v) => setState(() => _country = v!),
                      ),
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: TextFormField(
                      controller:   _phonCtrl,
                      keyboardType: TextInputType.phone,
                      decoration:   const InputDecoration(hintText: '6 12 34 56 78'),
                      validator:    (v) => (v?.isEmpty ?? true) ? 'Téléphone requis' : null,
                    ),
                  ),
                ]),

                SizedBox(height: 16.h),

                // Password field
                Text('Mot de passe', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.text)),
                SizedBox(height: 8.h),
                TextFormField(
                  controller:     _passCtrl,
                  obscureText:    _obscure,
                  decoration:     InputDecoration(
                    hintText: '••••••••',
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) => (v?.length ?? 0) < 6 ? 'Mot de passe trop court' : null,
                ),

                SizedBox(height: 28.h),

                ElevatedButton(
                  onPressed: loading ? null : _submit,
                  child: loading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text('Se connecter'),
                ),

                SizedBox(height: 16.h),
                Center(
                  child: TextButton(
                    onPressed: () => context.go('/register'),
                    child: Text("Pas encore de compte ? S'inscrire", style: TextStyle(color: AppTheme.primary, fontSize: 13.sp)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
