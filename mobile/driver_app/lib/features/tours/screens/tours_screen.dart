import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/tour_model.dart';
import '../providers/tours_provider.dart';

class ToursScreen extends ConsumerWidget {
  const ToursScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final toursAsync = ref.watch(toursProvider);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Text('Mes tournées', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(toursProvider),
          ),
        ],
      ),
      body: toursAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => _ErrorState(message: e.toString(), onRetry: () => ref.invalidate(toursProvider)),
        data:    (tours) => tours.isEmpty
            ? _EmptyState()
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(toursProvider),
                child: ListView.separated(
                  padding: EdgeInsets.all(16.w),
                  itemCount: tours.length,
                  separatorBuilder: (_, __) => SizedBox(height: 10.h),
                  itemBuilder: (_, i) => _TourCard(tour: tours[i]),
                ),
              ),
      ),
    );
  }
}

class _TourCard extends StatelessWidget {
  final TourModel tour;
  const _TourCard({required this.tour});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (tour.status.code) {
      'planned'     => const Color(0xFF3B82F6),
      'in_progress' => const Color(0xFFF59E0B),
      'completed'   => const Color(0xFF10B981),
      _             => const Color(0xFF9CA3AF),
    };

    return GestureDetector(
      onTap: () => context.push('/tour/${tour.id}'),
      child: Container(
        padding: EdgeInsets.all(16.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16.r),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Row(children: [
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20.r)),
                child: Text(tour.status.nameFr, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w700, color: statusColor)),
              ),
              if (tour.zone != null) ...[
                SizedBox(width: 8.w),
                Text(tour.zone!, style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub)),
              ],
            ])),
            if (tour.slotDisplay.isNotEmpty)
              Text(tour.slotDisplay, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: AppTheme.textSub)),
          ]),

          SizedBox(height: 10.h),

          Row(children: [
            Icon(Icons.warehouse_rounded, size: 16.sp, color: AppTheme.primary),
            SizedBox(width: 6.w),
            Text(tour.nodeNameFr ?? '—', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600)),
          ]),

          SizedBox(height: 8.h),

          // Progress bar
          if (tour.stops.isNotEmpty) ...[
            Row(children: [
              Expanded(child: ClipRRect(
                borderRadius: BorderRadius.circular(4.r),
                child: LinearProgressIndicator(
                  value: tour.stops.isEmpty ? 0 : tour.deliveredCount / tour.stops.length,
                  backgroundColor: const Color(0xFFF3F4F6),
                  color: const Color(0xFF10B981),
                  minHeight: 6,
                ),
              )),
              SizedBox(width: 10.w),
              Text('${tour.deliveredCount}/${tour.stops.length}', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: AppTheme.textSub)),
            ]),
            SizedBox(height: 8.h),
          ],

          // Stats row
          Row(children: [
            _Chip(icon: Icons.map_outlined,    label: '${tour.stops.length} stops', color: AppTheme.primary),
            SizedBox(width: 8.w),
            _Chip(icon: Icons.check_rounded,   label: '${tour.deliveredCount} livrés', color: const Color(0xFF10B981)),
            if (tour.failedCount > 0) ...[
              SizedBox(width: 8.w),
              _Chip(icon: Icons.close_rounded, label: '${tour.failedCount} échoués', color: AppTheme.error),
            ],
            const Spacer(),
            Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFFD1D5DB)),
          ]),
        ]),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon; final String label; final Color color;
  const _Chip({required this.icon, required this.label, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(8.r)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 12.sp, color: color),
      SizedBox(width: 4.w),
      Text(label, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w600, color: color)),
    ]),
  );
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.route_outlined, size: 64.sp, color: const Color(0xFFD1D5DB)),
    SizedBox(height: 16.h),
    Text('Aucune tournée', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
    SizedBox(height: 6.h),
    Text('Vos tournées apparaîtront ici', style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
  ]));
}

class _ErrorState extends StatelessWidget {
  final String message; final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.wifi_off_rounded, size: 48.sp, color: const Color(0xFF9CA3AF)),
    SizedBox(height: 12.h),
    Text('Impossible de charger', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600)),
    SizedBox(height: 20.h),
    ElevatedButton(onPressed: onRetry, child: const Text('Réessayer')),
  ]));
}
