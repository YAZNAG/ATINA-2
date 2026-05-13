import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../models/order_status_model.dart';

class OrderStatusBadge extends StatelessWidget {
  final OrderStatusModel status;
  final double? fontSize;

  const OrderStatusBadge({super.key, required this.status, this.fontSize});

  Color _parseColor() {
    final hex = status.color.replaceFirst('#', '');
    if (hex.length == 6) {
      return Color(int.parse('FF$hex', radix: 16));
    }
    if (hex.length == 8) {
      return Color(int.parse(hex, radix: 16));
    }
    return const Color(0xFF6B7280);
  }

  @override
  Widget build(BuildContext context) {
    final color = _parseColor();
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20.r),
      ),
      child: Text(
        status.nameFr,
        style: TextStyle(
          fontSize: fontSize ?? 11.sp,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
