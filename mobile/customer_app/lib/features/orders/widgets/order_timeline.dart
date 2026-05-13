import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../models/order_model.dart';

class OrderTimeline extends StatelessWidget {
  final List<OrderTimelineEntry> entries;
  const OrderTimeline({super.key, required this.entries});

  Color _parseColor(String? hex) {
    if (hex == null) return const Color(0xFFD1D5DB);
    final h = hex.replaceFirst('#', '');
    if (h.length == 6) return Color(int.parse('FF$h', radix: 16));
    if (h.length == 8) return Color(int.parse(h, radix: 16));
    return const Color(0xFFD1D5DB);
  }

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) return const SizedBox.shrink();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Historique', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
      SizedBox(height: 12.h),
      ...List.generate(entries.length, (i) {
        final entry = entries[i];
        final isLast = i == entries.length - 1;
        final color = _parseColor(entry.statusColor);
        final dateStr = '${entry.createdAt.day.toString().padLeft(2, '0')}/${entry.createdAt.month.toString().padLeft(2, '0')} ${entry.createdAt.hour.toString().padLeft(2, '0')}:${entry.createdAt.minute.toString().padLeft(2, '0')}';

        return IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 24.w,
              child: Column(children: [
                Container(
                  width: 12.w, height: 12.w,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                ),
                if (!isLast)
                  Expanded(child: Container(width: 2, color: color.withValues(alpha: 0.3))),
              ]),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 16.h),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(entry.statusName, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827))),
                  SizedBox(height: 2.h),
                  Text(dateStr, style: TextStyle(fontSize: 11.sp, color: const Color(0xFF9CA3AF))),
                  if (entry.note != null && entry.note!.isNotEmpty) ...[
                    SizedBox(height: 4.h),
                    Text(entry.note!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280), fontStyle: FontStyle.italic)),
                  ],
                ]),
              ),
            ),
          ]),
        );
      }),
    ]);
  }
}
