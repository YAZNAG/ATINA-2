import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../data/profile_api.dart';
import '../providers/profile_provider.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _State();
}

class _State extends ConsumerState<EditProfileScreen> {
  final _formKey   = GlobalKey<FormState>();
  final _nameCtrl  = TextEditingController();
  final _cityCtrl  = TextEditingController();
  String _lang     = 'fr';
  bool   _loading  = false;
  bool   _ready    = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadProfile());
  }

  void _loadProfile() {
    final profile = ref.read(profileProvider).valueOrNull;
    if (profile != null) {
      _nameCtrl.text = profile.name;
      _cityCtrl.text = profile.city ?? '';
      setState(() { _lang = profile.preferredLang; _ready = true; });
    } else {
      setState(() => _ready = true);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _cityCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);
    try {
      await ProfileApi.instance.updateProfile(
        name:         _nameCtrl.text.trim(),
        preferredLang: _lang,
        city:         _cityCtrl.text.trim().isEmpty ? null : _cityCtrl.text.trim(),
      );
      ref.invalidate(profileProvider);
      if (mounted) {
        _showSnack('Profil mis à jour avec succès', success: true);
        await Future.delayed(const Duration(milliseconds: 600));
        if (mounted) context.pop();
      }
    } catch (e) {
      if (mounted) _showSnack(e.toString(), success: false);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showSnack(String msg, {required bool success}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:         Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: success ? AppTheme.success : const Color(0xFFEF4444),
      behavior:        SnackBarBehavior.floating,
      margin:          EdgeInsets.all(16.w),
      shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
      duration:        const Duration(seconds: 2),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F5F5),
        appBar: AppBar(
          backgroundColor:  Colors.white,
          elevation:        0,
          leading:          IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
          title:            Text('Modifier le profil', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
          centerTitle:      true,
          surfaceTintColor: Colors.transparent,
        ),
        body: !_ready
            ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
            : SingleChildScrollView(
                padding: EdgeInsets.all(20.w),
                child: Form(
                  key: _formKey,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                    // Avatar display
                    Center(
                      child: Container(
                        width: 80.w, height: 80.w,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
                          shape:    BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            ref.watch(profileProvider).valueOrNull?.initials ?? '?',
                            style: TextStyle(color: Colors.white, fontSize: 28.sp, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    ),

                    SizedBox(height: 28.h),

                    // Card
                    Container(
                      decoration: BoxDecoration(
                        color:        Colors.white,
                        borderRadius: BorderRadius.circular(16.r),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
                      ),
                      padding: EdgeInsets.all(20.w),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                        _Label('Nom complet *'),
                        SizedBox(height: 8.h),
                        TextFormField(
                          controller:      _nameCtrl,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.next,
                          style:           TextStyle(fontSize: 15.sp, color: const Color(0xFF111827)),
                          decoration:      _deco('Votre nom complet', Icons.person_outline_rounded),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) return 'Nom requis';
                            if (v.trim().length < 2) return 'Nom trop court';
                            return null;
                          },
                        ),

                        SizedBox(height: 16.h),

                        _Label('Ville'),
                        SizedBox(height: 8.h),
                        TextFormField(
                          controller:      _cityCtrl,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.done,
                          style:           TextStyle(fontSize: 15.sp, color: const Color(0xFF111827)),
                          decoration:      _deco('Ex: Rabat, Casablanca…', Icons.location_city_outlined),
                        ),

                        SizedBox(height: 16.h),

                        // Language picker
                        _Label('Langue préférée'),
                        SizedBox(height: 10.h),
                        Row(children: [
                          _LangBtn(code: 'fr', label: '🇫🇷  Français', selected: _lang == 'fr', onTap: () => setState(() => _lang = 'fr')),
                          SizedBox(width: 12.w),
                          _LangBtn(code: 'ar', label: '🇲🇦  العربية',   selected: _lang == 'ar', onTap: () => setState(() => _lang = 'ar')),
                        ]),

                        SizedBox(height: 8.h),

                        // Info: non-editable fields
                        Container(
                          margin:  EdgeInsets.only(top: 8.h),
                          padding: EdgeInsets.all(12.w),
                          decoration: BoxDecoration(
                            color:        const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(10.r),
                          ),
                          child: Row(children: [
                            Icon(Icons.info_outline_rounded, size: 16.sp, color: const Color(0xFF6B7280)),
                            SizedBox(width: 8.w),
                            Expanded(child: Text('Le téléphone et le wallet ne sont pas modifiables ici.', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280)))),
                          ]),
                        ),
                      ]),
                    ),

                    SizedBox(height: 28.h),

                    // Save button
                    SizedBox(
                      width:  double.infinity,
                      height: 54.h,
                      child: _loading
                          ? Container(
                              decoration: BoxDecoration(
                                color:        const Color(0xFFE5E7EB),
                                borderRadius: BorderRadius.circular(16.r),
                              ),
                              child: const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2.5))),
                            )
                          : ElevatedButton.icon(
                              onPressed: _save,
                              icon:      Icon(Icons.check_rounded, size: 20.sp),
                              label:     Text('Enregistrer', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
                              style:     ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.primary,
                                foregroundColor: Colors.white,
                                shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                                elevation:       0,
                              ),
                            ),
                    ),
                  ]),
                ),
              ),
      ),
    );
  }

  InputDecoration _deco(String hint, IconData icon) => InputDecoration(
    hintText:       hint,
    hintStyle:      TextStyle(color: const Color(0xFF9CA3AF), fontSize: 14.sp),
    prefixIcon:     Icon(icon, size: 20.sp, color: const Color(0xFF9CA3AF)),
    filled:         true,
    fillColor:      const Color(0xFFF3F4F6),
    border:              OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: BorderSide.none),
    focusedBorder:       OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: AppTheme.primary, width: 2)),
    errorBorder:         OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444))),
    focusedErrorBorder:  OutlineInputBorder(borderRadius: BorderRadius.circular(14.r), borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2)),
    contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
  );
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Text(text, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151)));
}

class _LangBtn extends StatelessWidget {
  final String code, label;
  final bool   selected;
  final VoidCallback onTap;
  const _LangBtn({required this.code, required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height:   48.h,
        decoration: BoxDecoration(
          color:        selected ? AppTheme.primary : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(12.r),
          border:       Border.all(color: selected ? AppTheme.primary : const Color(0xFFE5E7EB), width: 1.5),
        ),
        child: Center(
          child: Text(label, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: selected ? Colors.white : const Color(0xFF374151))),
        ),
      ),
    ),
  );
}
