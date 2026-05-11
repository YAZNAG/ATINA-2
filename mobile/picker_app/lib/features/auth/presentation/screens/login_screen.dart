import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey  = GlobalKey<FormState>();
  final _phonCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  String _country = '+212';
  bool   _obscure = true;

  @override
  void dispose() { _phonCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(authProvider.notifier).login(
      phoneCountry: _country,
      phoneNumber:  _phonCtrl.text.trim(),
      password:     _passCtrl.text.trim(),
    );
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(authProvider).error ?? 'Identifiants incorrects'), backgroundColor: AppTheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = ref.watch(authProvider).status == AuthStatus.loading;
    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 40.h),
          child: Form(
            key: _formKey,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(height: 40.h),
              Center(child: Container(
                width: 72.w, height: 72.w,
                decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(20.r),
                  boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.35), blurRadius: 20, offset: const Offset(0, 8))]),
                child: Icon(Icons.inventory_2_rounded, color: Colors.white, size: 36.sp),
              )),
              SizedBox(height: 20.h),
              Center(child: Text('Picker App', style: TextStyle(fontSize: 26.sp, fontWeight: FontWeight.w700))),
              Center(child: Text('Espace Préparateur', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub))),
              SizedBox(height: 48.h),

              Text('Connexion Picker', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w700)),
              SizedBox(height: 8.h),
              Text('Accès réservé aux préparateurs de commandes', style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
              SizedBox(height: 28.h),

              Text('Téléphone', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600)),
              SizedBox(height: 8.h),
              Row(children: [
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 16.h),
                  decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(14.r)),
                  child: DropdownButtonHideUnderline(child: DropdownButton<String>(
                    value: _country, isDense: true,
                    items: const [
                      DropdownMenuItem(value: '+212', child: Text('+212')),
                      DropdownMenuItem(value: '+33',  child: Text('+33')),
                    ],
                    onChanged: (v) => setState(() => _country = v!),
                  )),
                ),
                SizedBox(width: 8.w),
                Expanded(child: TextFormField(
                  controller: _phonCtrl, keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(hintText: '6 01 11 11 11'),
                  validator: (v) => (v?.isEmpty ?? true) ? 'Requis' : null,
                )),
              ]),
              SizedBox(height: 16.h),
              Text('Mot de passe', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600)),
              SizedBox(height: 8.h),
              TextFormField(
                controller: _passCtrl, obscureText: _obscure,
                decoration: InputDecoration(hintText: '••••••••',
                  suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined), onPressed: () => setState(() => _obscure = !_obscure))),
                validator: (v) => (v?.length ?? 0) < 6 ? 'Min 6 caractères' : null,
              ),
              SizedBox(height: 32.h),
              ElevatedButton(
                onPressed: loading ? null : _submit,
                child: loading ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5)) : const Text('Se connecter'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
