import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/theme/app_theme.dart';
import '../models/delivery_slot_model.dart';

class DeliverySlotSelector extends StatelessWidget {
  final List<DeliverySlotModel> slots;
  final String? selectedSlotId;
  final ValueChanged<DeliverySlotModel> onSelected;
  final bool loading;
  final String? error;

  const DeliverySlotSelector({
    super.key,
    required this.slots,
    required this.selectedSlotId,
    required this.onSelected,
    this.loading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 20.h),
        child: const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
      );
    }

    if (slots.isEmpty) {
      return Container(
        padding: EdgeInsets.all(16.w),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(14.r),
        ),
        child: Row(children: [
          Icon(Icons.info_outline_rounded, size: 20.sp, color: const Color(0xFFF59E0B)),
          SizedBox(width: 10.w),
          Expanded(
            child: Text('Aucun créneau disponible pour cette date', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF92400E), fontWeight: FontWeight.w500)),
          ),
        ]),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Créneau horaire *', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
      SizedBox(height: 10.h),
      ...slots.map((slot) {
        final sel = selectedSlotId == slot.id;
        final hasCapacity = slot.hasCapacity;
        return Padding(
          padding: EdgeInsets.only(bottom: 8.h),
          child: GestureDetector(
            onTap: hasCapacity ? () => onSelected(slot) : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: EdgeInsets.all(14.w),
              decoration: BoxDecoration(
                color: sel ? AppTheme.primary.withValues(alpha: 0.06) : Colors.white,
                borderRadius: BorderRadius.circular(14.r),
                border: Border.all(
                  color: sel ? AppTheme.primary : hasCapacity ? const Color(0xFFE5E7EB) : const Color(0xFFFEE2E2),
                  width: sel ? 2 : 1,
                ),
              ),
              child: Row(children: [
                Container(
                  width: 44.w, height: 44.w,
                  decoration: BoxDecoration(
                    color: sel ? AppTheme.primary : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                  child: Icon(Icons.schedule_rounded, size: 22.sp, color: sel ? Colors.white : const Color(0xFF6B7280)),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(slot.nameFr, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: hasCapacity ? const Color(0xFF111827) : const Color(0xFF9CA3AF))),
                    SizedBox(height: 2.h),
                    Text('${slot.startTime} - ${slot.endTime}', style: TextStyle(fontSize: 12.sp, color: hasCapacity ? const Color(0xFF6B7280) : const Color(0xFFD1D5DB))),
                  ]),
                ),
                if (!hasCapacity)
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                    decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8.r)),
                    child: Text('Complet', style: TextStyle(fontSize: 10.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w700)),
                  )
                else if (slot.availableSpaces > 0 && slot.availableSpaces <= 5)
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                    decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8.r)),
                    child: Text('${slot.availableSpaces} places', style: TextStyle(fontSize: 10.sp, color: const Color(0xFF92400E), fontWeight: FontWeight.w600)),
                  ),
              ]),
            ),
          ),
        );
      }),
      if (error != null) ...[
        SizedBox(height: 6.h),
        Text(error!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFFEF4444))),
      ],
    ]);
  }
}
