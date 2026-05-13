import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../customer_auth/controllers/customer_auth_controller.dart';
import '../data/profile_api.dart';
import '../providers/profile_provider.dart';

class AccountSettingsScreen extends ConsumerWidget {
  const AccountSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor:  Colors.white,
        elevation:        0,
        surfaceTintColor: Colors.transparent,
        leading:     IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title:       Text('Paramètres', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

          // ── Langue ───────────────────────────────────────────────────────
          _SectionTitle('Langue'),
          _Card(children: [
            _LangOption(
              label:    '🇫🇷  Français',
              selected: profile?.preferredLang != 'ar',
              onTap:    () => _changeLang(context, ref, 'fr'),
            ),
            Divider(height: 1, color: const Color(0xFFF3F4F6), indent: 16.w),
            _LangOption(
              label:    '🇲🇦  العربية',
              selected: profile?.preferredLang == 'ar',
              onTap:    () => _changeLang(context, ref, 'ar'),
            ),
          ]),

          SizedBox(height: 20.h),

          // ── Compte ───────────────────────────────────────────────────────
          _SectionTitle('Sécurité du compte'),
          _Card(children: [
            _MenuItem(
              icon: Icons.phone_android_rounded, color: const Color(0xFF3B82F6),
              label: 'Téléphone', subtitle: profile?.displayPhone,
              onTap: () {},
            ),
            Divider(height: 1, color: const Color(0xFFF3F4F6), indent: 52.w),
            _MenuItem(
              icon: Icons.verified_rounded, color: const Color(0xFF10B981),
              label: 'Statut téléphone',
              subtitle: profile?.phoneVerified == true ? 'Vérifié' : 'Non vérifié',
              subtitleColor: profile?.phoneVerified == true ? const Color(0xFF10B981) : const Color(0xFFEF4444),
              onTap: () {},
            ),
          ]),

          SizedBox(height: 20.h),

          // ── Application ──────────────────────────────────────────────────
          _SectionTitle('Application'),
          _Card(children: [
            _MenuItem(
              icon: Icons.info_outline_rounded, color: const Color(0xFF6B7280),
              label: 'Version', subtitle: '1.0.0',
              onTap: () {},
            ),
            Divider(height: 1, color: const Color(0xFFF3F4F6), indent: 52.w),
            _MenuItem(
              icon: Icons.support_agent_rounded, color: const Color(0xFF6366F1),
              label: 'Support client',
              onTap: () {},
            ),
          ]),

          SizedBox(height: 20.h),

          // ── Actions dangereuses ───────────────────────────────────────────
          _SectionTitle('Zone sensible'),
          _Card(children: [
            _MenuItem(
              icon: Icons.logout_rounded, color: const Color(0xFFEF4444),
              label: 'Se déconnecter',
              onTap: () => _logout(context, ref),
            ),
            Divider(height: 1, color: const Color(0xFFF3F4F6), indent: 52.w),
            _MenuItem(
              icon: Icons.delete_forever_rounded, color: const Color(0xFF9CA3AF),
              label: 'Supprimer mon compte',
              subtitle: 'Cette action est irréversible',
              subtitleColor: const Color(0xFF9CA3AF),
              onTap: () => _requestDelete(context),
            ),
          ]),

          SizedBox(height: 40.h),
        ]),
      ),
    );
  }

  Future<void> _changeLang(BuildContext context, WidgetRef ref, String lang) async {
    final profile = ref.read(profileProvider).valueOrNull;
    if (profile == null || profile.preferredLang == lang) return;
    try {
      await ProfileApi.instance.updateProfile(preferredLang: lang);
      ref.invalidate(profileProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(lang == 'ar' ? 'Langue changée en Arabe' : 'Langue changée en Français',
              style: const TextStyle(color: Colors.white)),
          backgroundColor: AppTheme.success,
          behavior:        SnackBarBehavior.floating,
          margin:          EdgeInsets.all(16.w),
          shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
        ));
      }
    } catch (_) {}
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape:   RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        title:   Text('Déconnexion', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        content: Text('Voulez-vous vous déconnecter ?', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Déconnecter', style: TextStyle(color: const Color(0xFFEF4444), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await ref.read(customerAuthProvider.notifier).logout();
      if (context.mounted) context.go('/customer/login');
    }
  }

  Future<void> _requestDelete(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        shape:   RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        title:   Row(children: [
          Icon(Icons.warning_amber_rounded, color: const Color(0xFFEF4444), size: 22.sp),
          SizedBox(width: 8.w),
          Text('Supprimer mon compte', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
        ]),
        content: Text(
          'Pour supprimer votre compte, veuillez contacter notre support client. '
          'Toutes vos données seront effacées de manière permanente.',
          style: TextStyle(fontSize: 13.sp, color: const Color(0xFF6B7280), height: 1.5),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Fermer')),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Contacter le support', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(left: 4.w, bottom: 8.h),
    child: Text(text, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF6B7280), letterSpacing: 0.4)),
  );
}

class _Card extends StatelessWidget {
  final List<Widget> children;
  const _Card({required this.children});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color:        Colors.white,
      borderRadius: BorderRadius.circular(16.r),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(children: children),
  );
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final Color    color;
  final String   label;
  final String?  subtitle;
  final Color?   subtitleColor;
  final VoidCallback onTap;
  const _MenuItem({required this.icon, required this.color, required this.label, this.subtitle, this.subtitleColor, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap:        onTap,
    borderRadius: BorderRadius.circular(16.r),
    child: Padding(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
      child: Row(children: [
        Container(
          width: 36.w, height: 36.w,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10.r)),
          child: Icon(icon, size: 18.sp, color: color),
        ),
        SizedBox(width: 14.w),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w500, color: const Color(0xFF374151))),
          if (subtitle != null)
            Text(subtitle!, style: TextStyle(fontSize: 12.sp, color: subtitleColor ?? const Color(0xFF9CA3AF))),
        ])),
        Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFFD1D5DB)),
      ]),
    ),
  );
}

class _LangOption extends StatelessWidget {
  final String label;
  final bool   selected;
  final VoidCallback onTap;
  const _LangOption({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap:        onTap,
    borderRadius: BorderRadius.circular(16.r),
    child: Padding(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
      child: Row(children: [
        SizedBox(width: 36.w, height: 36.w,
          child: selected
              ? Container(decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Icon(Icons.check_rounded, size: 18.sp, color: AppTheme.primary))
              : null),
        SizedBox(width: 14.w),
        Expanded(child: Text(label, style: TextStyle(fontSize: 14.sp, fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? AppTheme.primary : const Color(0xFF374151)))),
      ]),
    ),
  );
}
