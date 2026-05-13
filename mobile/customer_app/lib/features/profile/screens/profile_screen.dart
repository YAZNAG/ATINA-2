import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../customer_auth/controllers/customer_auth_controller.dart';
import '../providers/profile_provider.dart';
import '../models/customer_full_profile.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: () async => ref.invalidate(profileProvider),
        child: profileAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          error:   (e, _) => _ErrorState(onRetry: () => ref.invalidate(profileProvider), message: e.toString()),
          data:    (profile) => _ProfileBody(profile: profile),
        ),
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────
class _ProfileBody extends ConsumerWidget {
  final CustomerFullProfile profile;
  const _ProfileBody({required this.profile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CustomScrollView(
      slivers: [
        // ── Header ──────────────────────────────────────────────────────────
        SliverToBoxAdapter(child: _ProfileHeader(profile: profile)),

        // ── Stats ────────────────────────────────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 0),
            child: Row(children: [
              Expanded(child: _StatCard(icon: Icons.account_balance_wallet_rounded, label: 'Wallet',    value: '${profile.walletBalance.toStringAsFixed(2)} MAD', color: const Color(0xFF8B5CF6))),
              SizedBox(width: 10.w),
              Expanded(child: _StatCard(icon: Icons.stars_rounded,                  label: 'Points',    value: '${profile.pointsBalance} pts',                    color: const Color(0xFFF59E0B))),
              SizedBox(width: 10.w),
              Expanded(child: _StatCard(icon: Icons.location_on_rounded,            label: 'Adresses',  value: '${profile.addressCount}',                         color: AppTheme.primary)),
            ]),
          ),
        ),

        SliverToBoxAdapter(child: SizedBox(height: 20.h)),

        // ── Sections ─────────────────────────────────────────────────────────
        SliverToBoxAdapter(child: _MenuSection(title: 'Mon compte', items: [
          _MenuItem(icon: Icons.person_outline_rounded,    label: 'Modifier le profil',  onTap: () => context.push('/profile/edit')),
          _MenuItem(icon: Icons.location_on_outlined,      label: 'Mes adresses',        trailing: '${profile.addressCount}', onTap: () => context.push('/addresses')),
          _MenuItem(icon: Icons.account_balance_wallet_outlined, label: 'Wallet',       trailing: '${profile.walletBalance.toStringAsFixed(2)} MAD', onTap: () => context.push('/wallet')),
          _MenuItem(icon: Icons.star_outline_rounded,      label: 'Points fidélité',     trailing: '${profile.pointsBalance} pts', onTap: () => context.push('/points')),
          if (profile.referralCode != null)
            _MenuItem(icon: Icons.card_giftcard_rounded,   label: 'Code parrainage',     trailing: profile.referralCode, onTap: () {}),
        ])),

        SliverToBoxAdapter(child: SizedBox(height: 12.h)),

        SliverToBoxAdapter(child: _MenuSection(title: 'Mes commandes', items: [
          _MenuItem(icon: Icons.receipt_long_outlined, label: 'Historique commandes', onTap: () => context.push('/orders')),
          _MenuItem(icon: Icons.pending_outlined,      label: 'Commandes en cours',   onTap: () => context.push('/orders')),
        ])),

        SliverToBoxAdapter(child: SizedBox(height: 12.h)),

        SliverToBoxAdapter(child: _MenuSection(title: 'Paramètres', items: [
          _MenuItem(icon: Icons.language_rounded,       label: 'Langue',        trailing: profile.langLabel, onTap: () => context.push('/profile/settings')),
          _MenuItem(icon: Icons.logout_rounded,         label: 'Déconnexion',   color: const Color(0xFFEF4444),
            onTap: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (_) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                  title: Text('Déconnexion', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
                  content: Text('Voulez-vous vous déconnecter ?', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
                    TextButton(onPressed: () => Navigator.pop(context, true),  child: Text('Déconnecter', style: const TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700))),
                  ],
                ),
              );
              if (confirm == true && context.mounted) {
                await ref.read(customerAuthProvider.notifier).logout();
                if (context.mounted) context.go('/customer/login');
              }
            },
          ),
        ])),

        SliverToBoxAdapter(child: SizedBox(height: 32.h)),
      ],
    );
  }
}

// ── Profile header ────────────────────────────────────────────────────────────
class _ProfileHeader extends StatelessWidget {
  final CustomerFullProfile profile;
  const _ProfileHeader({required this.profile});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(20.w, 24.h, 20.w, 24.h),
      child: Column(children: [
        // Avatar
        Container(
          width: 88.w, height: 88.w,
          decoration: BoxDecoration(
            gradient:     const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
            shape:        BoxShape.circle,
            boxShadow: [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Center(child: Text(profile.initials, style: TextStyle(color: Colors.white, fontSize: 28.sp, fontWeight: FontWeight.w800))),
        ),

        SizedBox(height: 14.h),

        Text(profile.name, style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),

        SizedBox(height: 4.h),
        Text(profile.displayPhone, style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),

        SizedBox(height: 10.h),

        // Badges
        Wrap(spacing: 8.w, runSpacing: 6.h, alignment: WrapAlignment.center, children: [
          if (profile.phoneVerified)
            _Badge(icon: Icons.verified_rounded, label: 'Téléphone vérifié', color: const Color(0xFF10B981)),
          if (profile.city != null && profile.city!.isNotEmpty)
            _Badge(icon: Icons.location_on_rounded, label: profile.city!, color: AppTheme.primary),
          _Badge(
            icon:  profile.preferredLang == 'ar' ? Icons.translate_rounded : Icons.language_rounded,
            label: profile.langLabel,
            color: const Color(0xFF6366F1),
          ),
        ]),

        SizedBox(height: 16.h),

        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => context.push('/profile/edit'),
            icon:  Icon(Icons.edit_outlined, size: 16.sp),
            label: const Text('Modifier le profil'),
            style: OutlinedButton.styleFrom(
              side:            const BorderSide(color: AppTheme.primary, width: 1.5),
              foregroundColor: AppTheme.primary,
              shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              padding:         EdgeInsets.symmetric(vertical: 12.h),
            ),
          ),
        ),
      ]),
    );
  }
}

class _Badge extends StatelessWidget {
  final IconData icon;
  final String   label;
  final Color    color;
  const _Badge({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 5.h),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20.r)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 13.sp, color: color),
      SizedBox(width: 4.w),
      Text(label, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w600, color: color)),
    ]),
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final IconData icon;
  final String   label, value;
  final Color    color;
  const _StatCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 14.h),
    decoration: BoxDecoration(
      color:        Colors.white,
      borderRadius: BorderRadius.circular(14.r),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(children: [
      Container(
        width: 38.w, height: 38.w,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
        child: Icon(icon, size: 20.sp, color: color),
      ),
      SizedBox(height: 8.h),
      Text(value, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w800, color: const Color(0xFF111827))),
      SizedBox(height: 2.h),
      Text(label, style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF))),
    ]),
  );
}

// ── Menu section ──────────────────────────────────────────────────────────────
class _MenuSection extends StatelessWidget {
  final String       title;
  final List<Widget> items;
  const _MenuSection({required this.title, required this.items});

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(horizontal: 16.w),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: EdgeInsets.only(left: 4.w, bottom: 8.h),
        child: Text(title, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF6B7280), letterSpacing: 0.5)),
      ),
      Container(
        decoration: BoxDecoration(
          color:        Colors.white,
          borderRadius: BorderRadius.circular(16.r),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(
          children: items.asMap().entries.map((e) {
            final isLast = e.key == items.length - 1;
            return Column(children: [
              e.value,
              if (!isLast) Divider(height: 1, indent: 52.w, color: const Color(0xFFF3F4F6)),
            ]);
          }).toList(),
        ),
      ),
    ]),
  );
}

// ── Menu item ─────────────────────────────────────────────────────────────────
class _MenuItem extends StatelessWidget {
  final IconData   icon;
  final String     label;
  final String?    trailing;
  final Color?     color;
  final VoidCallback onTap;
  const _MenuItem({required this.icon, required this.label, this.trailing, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = color ?? const Color(0xFF374151);
    return InkWell(
      onTap:        onTap,
      borderRadius: BorderRadius.circular(16.r),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
        child: Row(children: [
          Container(
            width: 36.w, height: 36.w,
            decoration: BoxDecoration(
              color:        c.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10.r),
            ),
            child: Icon(icon, size: 18.sp, color: c),
          ),
          SizedBox(width: 14.w),
          Expanded(child: Text(label, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w500, color: c))),
          if (trailing != null)
            Text(trailing!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF))),
          SizedBox(width: 6.w),
          Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFFD1D5DB)),
        ]),
      ),
    );
  }
}

// ── Error state ────────────────────────────────────────────────────────────────
class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  final String       message;
  const _ErrorState({required this.onRetry, required this.message});

  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.wifi_off_rounded, size: 56.sp, color: const Color(0xFF9CA3AF)),
    SizedBox(height: 12.h),
    Text('Impossible de charger le profil', style: TextStyle(fontSize: 15.sp, color: const Color(0xFF374151), fontWeight: FontWeight.w600)),
    SizedBox(height: 6.h),
    Text(message, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF)), textAlign: TextAlign.center),
    SizedBox(height: 20.h),
    ElevatedButton(onPressed: onRetry, child: const Text('Réessayer')),
  ]));
}
