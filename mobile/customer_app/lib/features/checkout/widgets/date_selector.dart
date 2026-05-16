import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/theme/app_theme.dart';

class DateSelector extends StatelessWidget {
  final DateTime selectedDate;
  final ValueChanged<DateTime> onSelected;
  final List<DateTime>? availableDates;
  final String? error;

  const DateSelector({
    super.key,
    required this.selectedDate,
    required this.onSelected,
    this.availableDates,
    this.error,
  });

  List<DateTime> _getDates() {
    if (availableDates != null && availableDates!.isNotEmpty) return availableDates!;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return List.generate(7, (i) => today.add(Duration(days: i)));
  }

  String _dayName(DateTime dt) {
    final names = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return names[dt.weekday % 7];
  }

  String _dayNumber(DateTime dt) => dt.day.toString().padLeft(2, '0');

  String _monthName(DateTime dt) {
    final names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return names[dt.month - 1];
  }

  @override
  Widget build(BuildContext context) {
    final dates = _getDates();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Date de livraison *', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
      SizedBox(height: 10.h),
      SizedBox(
        height: 80.h,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: dates.length,
          separatorBuilder: (_, __) => SizedBox(width: 8.w),
          itemBuilder: (_, i) {
            final dt = dates[i];
            final sel = dt.year == selectedDate.year && dt.month == selectedDate.month && dt.day == selectedDate.day;
            return GestureDetector(
              onTap: () => onSelected(dt),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 64.w,
                decoration: BoxDecoration(
                  color: sel ? AppTheme.primary : Colors.white,
                  borderRadius: BorderRadius.circular(14.r),
                  border: Border.all(color: sel ? AppTheme.primary : const Color(0xFFE5E7EB)),
                ),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(_dayName(dt), style: TextStyle(fontSize: 11.sp, color: sel ? Colors.white70 : const Color(0xFF9CA3AF), fontWeight: FontWeight.w600)),
                  SizedBox(height: 4.h),
                  Text(_dayNumber(dt), style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w800, color: sel ? Colors.white : const Color(0xFF111827))),
                  Text(_monthName(dt), style: TextStyle(fontSize: 10.sp, color: sel ? Colors.white70 : const Color(0xFF9CA3AF))),
                ]),
              ),
            );
          },
        ),
      ),
      if (error != null) ...[
        SizedBox(height: 6.h),
        Text(error!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFFEF4444))),
      ],
    ]);
  }
}
