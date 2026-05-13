import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/address_model.dart';
import '../../profile/providers/profile_provider.dart';

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressAsync = ref.watch(addressesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor:  Colors.white,
        elevation:        0,
        surfaceTintColor: Colors.transparent,
        leading:          IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title:            Text('Mes adresses', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle:      true,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            color: AppTheme.primary,
            onPressed: () async {
              await context.push('/addresses/new');
              ref.read(addressesProvider.notifier).load();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color:    AppTheme.primary,
        onRefresh: () => ref.read(addressesProvider.notifier).load(),
        child: addressAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          error:   (e, _) => _ErrorState(onRetry: () => ref.read(addressesProvider.notifier).load()),
          data:    (list) => list.isEmpty
              ? _EmptyState(onAdd: () async {
                  await context.push('/addresses/new');
                  ref.read(addressesProvider.notifier).load();
                })
              : ListView.separated(
                  padding:         EdgeInsets.all(16.w),
                  itemCount:       list.length,
                  separatorBuilder: (_, __) => SizedBox(height: 12.h),
                  itemBuilder:     (_, i)   => _AddressCard(address: list[i]),
                ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push('/addresses/new');
          ref.read(addressesProvider.notifier).load();
        },
        backgroundColor: AppTheme.primary,
        icon:  const Icon(Icons.add_rounded, color: Colors.white),
        label: Text('Ajouter', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14.sp)),
      ),
    );
  }
}

// ── Address card ──────────────────────────────────────────────────────────────
class _AddressCard extends ConsumerWidget {
  final AddressModel address;
  const _AddressCard({required this.address});

  static const _labelIcons = <String, IconData>{
    'maison':  Icons.home_rounded,
    'travail': Icons.work_rounded,
    'autre':   Icons.location_on_rounded,
  };

  static const _labelColors = <String, Color>{
    'maison':  Color(0xFF3B82F6),
    'travail': Color(0xFF10B981),
    'autre':   Color(0xFFF59E0B),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final labelKey = address.displayLabel.toLowerCase();
    final color    = _labelColors[labelKey] ?? AppTheme.primary;
    final icon     = _labelIcons[labelKey]  ?? Icons.location_on_rounded;

    return Container(
      decoration: BoxDecoration(
        color:        Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border:       address.isDefault ? Border.all(color: AppTheme.primary, width: 1.5) : null,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Header row
        Padding(
          padding: EdgeInsets.fromLTRB(16.w, 14.h, 16.w, 0),
          child: Row(children: [
            Container(
              width: 36.w, height: 36.w,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(icon, size: 18.sp, color: color),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Text(address.displayLabel, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
            ),
            if (address.isDefault)
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(20.r)),
                child: Text('Par défaut', style: TextStyle(color: Colors.white, fontSize: 10.sp, fontWeight: FontWeight.w700)),
              ),
          ]),
        ),

        // Address details
        Padding(
          padding: EdgeInsets.fromLTRB(16.w, 10.h, 16.w, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(address.fullAddress, style: TextStyle(fontSize: 13.sp, color: const Color(0xFF374151), height: 1.4)),
            if (address.deliveryNotes != null && address.deliveryNotes!.isNotEmpty) ...[
              SizedBox(height: 6.h),
              Row(children: [
                Icon(Icons.note_outlined, size: 13.sp, color: const Color(0xFF9CA3AF)),
                SizedBox(width: 4.w),
                Expanded(child: Text(address.deliveryNotes!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF), fontStyle: FontStyle.italic))),
              ]),
            ],
          ]),
        ),

        // Actions
        Padding(
          padding: EdgeInsets.fromLTRB(8.w, 6.h, 8.w, 4.h),
          child: Row(children: [
            TextButton.icon(
              onPressed: () async {
                await context.push('/addresses/${address.id}/edit', extra: address);
                ref.read(addressesProvider.notifier).load();
              },
              icon:  Icon(Icons.edit_outlined, size: 15.sp),
              label: const Text('Modifier'),
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF6B7280), textStyle: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600)),
            ),
            if (!address.isDefault) ...[
              TextButton.icon(
                onPressed: () async {
                  final ok = await ref.read(addressesProvider.notifier).setDefault(address.id);
                  if (context.mounted) _snack(context, ok ? 'Adresse par défaut définie' : 'Erreur', ok);
                },
                icon:  Icon(Icons.check_circle_outline_rounded, size: 15.sp),
                label: const Text('Par défaut'),
                style: TextButton.styleFrom(foregroundColor: AppTheme.primary, textStyle: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600)),
              ),
            ],
            const Spacer(),
            TextButton.icon(
              onPressed: () => _confirmDelete(context, ref),
              icon:  Icon(Icons.delete_outline_rounded, size: 15.sp),
              label: const Text('Supprimer'),
              style: TextButton.styleFrom(foregroundColor: const Color(0xFFEF4444), textStyle: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600)),
            ),
          ]),
        ),
      ]),
    );
  }

  void _snack(BuildContext ctx, String msg, bool ok) {
    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
      content:         Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: ok ? AppTheme.success : const Color(0xFFEF4444),
      behavior:        SnackBarBehavior.floating,
      duration:        const Duration(seconds: 2),
    ));
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        title:   Text('Supprimer l\'adresse', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
        content: Text('Cette adresse sera supprimée définitivement.', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Supprimer', style: TextStyle(color: const Color(0xFFEF4444), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      final ok = await ref.read(addressesProvider.notifier).delete(address.id);
      if (context.mounted) _snack(context, ok ? 'Adresse supprimée' : 'Erreur', ok);
    }
  }
}

// ── Empty / Error states ───────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyState({required this.onAdd});

  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.location_off_outlined, size: 72.sp, color: const Color(0xFFD1D5DB)),
    SizedBox(height: 16.h),
    Text('Aucune adresse enregistrée', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
    SizedBox(height: 8.h),
    Text('Ajoutez une adresse pour faciliter vos livraisons', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF9CA3AF)), textAlign: TextAlign.center),
    SizedBox(height: 28.h),
    GestureDetector(
      onTap: onAdd,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 14.h),
        decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]), borderRadius: BorderRadius.circular(14.r)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.add_rounded, color: Colors.white),
          SizedBox(width: 8.w),
          Text('Ajouter une adresse', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15.sp)),
        ]),
      ),
    ),
  ]));
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.wifi_off_rounded, size: 56.sp, color: const Color(0xFF9CA3AF)),
    SizedBox(height: 12.h),
    Text('Impossible de charger les adresses', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF6B7280))),
    SizedBox(height: 16.h),
    TextButton(onPressed: onRetry, child: const Text('Réessayer')),
  ]));
}
