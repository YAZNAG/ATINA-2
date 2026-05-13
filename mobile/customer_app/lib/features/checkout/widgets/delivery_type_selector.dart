import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/theme/app_theme.dart';
import '../models/checkout_meta_model.dart';

class DeliveryTypeSelector extends StatelessWidget {
  final List<DeliveryTypeModel> types;
  final String? selectedId;
  final ValueChanged<DeliveryTypeModel> onSelected;
  final String? error;

  const DeliveryTypeSelector({
    super.key,
    required this.types,
    required this.selectedId,
    required this.onSelected,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    final homeType = types.where((t) => t.code == 'home').firstOrNull;
    final pickupType = types.where((t) => t.code == 'pickup').firstOrNull;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Type de livraison *', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
      SizedBox(height: 10.h),
      Row(children: [
        if (homeType != null)
          Expanded(child: _TypeCard(
            icon: Icons.local_shipping_rounded,
            title: homeType.nameFr,
            subtitle: 'Livraison à domicile',
            selected: selectedId == homeType.id,
            onTap: () => onSelected(homeType),
          )),
        if (homeType != null && pickupType != null) SizedBox(width: 12.w),
        if (pickupType != null)
          Expanded(child: _TypeCard(
            icon: Icons.store_rounded,
            title: pickupType.nameFr,
            subtitle: 'Retrait en magasin',
            selected: selectedId == pickupType.id,
            onTap: () => onSelected(pickupType),
          )),
      ]),
      if (error != null) ...[
        SizedBox(height: 6.h),
        Text(error!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFFEF4444))),
      ],
    ]);
  }
}

class _TypeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  const _TypeCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: selected ? AppTheme.primary.withValues(alpha: 0.06) : Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(
          color: selected ? AppTheme.primary : const Color(0xFFE5E7EB),
          width: selected ? 2 : 1,
        ),
      ),
      child: Column(children: [
        Icon(icon, size: 32.sp, color: selected ? AppTheme.primary : const Color(0xFF9CA3AF)),
        SizedBox(height: 8.h),
        Text(title, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: selected ? AppTheme.primary : const Color(0xFF374151))),
        SizedBox(height: 2.h),
        Text(subtitle, style: TextStyle(fontSize: 10.sp, color: const Color(0xFF9CA3AF)), textAlign: TextAlign.center),
      ]),
    ),
  );
}
