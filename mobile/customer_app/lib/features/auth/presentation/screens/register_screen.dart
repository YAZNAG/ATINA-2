import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey    = GlobalKey<FormState>();
  final _nameCtrl   = TextEditingController();
  final _phoneCtrl  = TextEditingController();
  final _passCtrl   = TextEditingController();
  final _confCtrl   = TextEditingController();
  String _country   = '+212';
  bool   _obscure1  = true;
  bool   _obscure2  = true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    _confCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    // TODO: appel API inscription
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 24.h),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Back
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_rounded),
                  onPressed: () => context.go('/login'),
                  padding: EdgeInsets.zero,
                ),

                SizedBox(height: 16.h),

                Text(
                  'Créer un compte',
                  style: TextStyle(fontSize: 26.sp, fontWeight: FontWeight.w700, color: AppTheme.text),
                ),
                SizedBox(height: 6.h),
                Text(
                  'Rejoignez Dark Store et commandez en quelques clics',
                  style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub),
                ),

                SizedBox(height: 32.h),

                // Nom
                _Label('Nom complet'),
                SizedBox(height: 8.h),
                TextFormField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'Yassine Benali',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                  validator: (v) => (v?.trim().isEmpty ?? true) ? 'Nom requis' : null,
                ),

                SizedBox(height: 16.h),

                // Téléphone
                _Label('Téléphone'),
                SizedBox(height: 8.h),
                Row(children: [
                  _CountryPicker(
                    value: _country,
                    onChanged: (v) => setState(() => _country = v),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: TextFormField(
                      controller:   _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration:   const InputDecoration(hintText: '6 12 34 56 78'),
                      validator:    (v) => (v?.isEmpty ?? true) ? 'Téléphone requis' : null,
                    ),
                  ),
                ]),

                SizedBox(height: 16.h),

                // Mot de passe
                _Label('Mot de passe'),
                SizedBox(height: 8.h),
                TextFormField(
                  controller:  _passCtrl,
                  obscureText: _obscure1,
                  decoration:  InputDecoration(
                    hintText:    '••••••••',
                    prefixIcon:  const Icon(Icons.lock_outline_rounded),
                    suffixIcon:  IconButton(
                      icon: Icon(_obscure1 ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                      onPressed: () => setState(() => _obscure1 = !_obscure1),
                    ),
                  ),
                  validator: (v) => (v?.length ?? 0) < 6 ? 'Min 6 caractères' : null,
                ),

                SizedBox(height: 16.h),

                // Confirmation
                _Label('Confirmer le mot de passe'),
                SizedBox(height: 8.h),
                TextFormField(
                  controller:  _confCtrl,
                  obscureText: _obscure2,
                  decoration:  InputDecoration(
                    hintText:   '••••••••',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure2 ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                      onPressed: () => setState(() => _obscure2 = !_obscure2),
                    ),
                  ),
                  validator: (v) => v != _passCtrl.text ? 'Mots de passe différents' : null,
                ),

                SizedBox(height: 32.h),

                ElevatedButton(
                  onPressed: _submit,
                  child: const Text('Créer mon compte'),
                ),

                SizedBox(height: 20.h),

                Center(
                  child: GestureDetector(
                    onTap: () => context.go('/login'),
                    child: RichText(
                      text: TextSpan(
                        text: 'Déjà un compte ? ',
                        style: TextStyle(color: AppTheme.textSub, fontSize: 14.sp),
                        children: [
                          TextSpan(
                            text: 'Se connecter',
                            style: TextStyle(
                              color:      AppTheme.primary,
                              fontWeight: FontWeight.w600,
                              fontSize:   14.sp,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                SizedBox(height: 24.h),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: TextStyle(
      fontSize:   13.sp,
      fontWeight: FontWeight.w600,
      color:      AppTheme.text,
    ),
  );
}

class _CountryPicker extends StatelessWidget {
  final String value;
  final void Function(String) onChanged;
  const _CountryPicker({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 16.h),
    decoration: BoxDecoration(
      color:        const Color(0xFFF3F4F6),
      borderRadius: BorderRadius.circular(14.r),
    ),
    child: DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value:   value,
        isDense: true,
        items: const [
          DropdownMenuItem(value: '+212', child: Text('+212 🇲🇦')),
          DropdownMenuItem(value: '+33',  child: Text('+33 🇫🇷')),
          DropdownMenuItem(value: '+213', child: Text('+213 🇩🇿')),
        ],
        onChanged: (v) => onChanged(v!),
      ),
    ),
  );
}
