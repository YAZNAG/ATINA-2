import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../data/tours_api.dart';
import '../models/tour_model.dart';
import '../models/stop_model.dart';
import '../providers/tours_provider.dart';

class TourDetailScreen extends ConsumerWidget {
  final String tourId;
  const TourDetailScreen({super.key, required this.tourId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tourAsync = ref.watch(tourProvider(tourId));

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title: Text('Tournée', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () => ref.invalidate(tourProvider(tourId))),
        ],
      ),
      body: tourAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(e.toString(), textAlign: TextAlign.center),
          ElevatedButton(onPressed: () => ref.invalidate(tourProvider(tourId)), child: const Text('Réessayer')),
        ])),
        data: (tour) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(tourProvider(tourId)),
          child: _TourBody(tour: tour, onRefresh: () => ref.invalidate(tourProvider(tourId))),
        ),
      ),
    );
  }
}

class _TourBody extends ConsumerStatefulWidget {
  final TourModel tour;
  final VoidCallback onRefresh;
  const _TourBody({required this.tour, required this.onRefresh});
  @override
  ConsumerState<_TourBody> createState() => _TourBodyState();
}

class _TourBodyState extends ConsumerState<_TourBody> {
  bool _loading = false;

  Future<void> _startTour() async {
    setState(() => _loading = true);
    try {
      await ToursApi.instance.startTour(widget.tour.id);
      widget.onRefresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tournée démarrée ✓'), backgroundColor: Color(0xFF10B981)));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.error));
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final tour   = widget.tour;
    final stops  = tour.stops;

    final statusColor = switch (tour.status.code) {
      'planned'     => const Color(0xFF3B82F6),
      'in_progress' => const Color(0xFFF59E0B),
      'completed'   => const Color(0xFF10B981),
      _             => const Color(0xFF9CA3AF),
    };

    return CustomScrollView(slivers: [
      // Header
      SliverToBoxAdapter(child: Padding(
        padding: EdgeInsets.all(16.w),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Status + info
          Container(
            padding: EdgeInsets.all(16.w),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [statusColor.withValues(alpha: 0.08), Colors.white]),
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(color: statusColor.withValues(alpha: 0.2)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 5.h),
                  decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20.r)),
                  child: Text(tour.status.nameFr, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: statusColor)),
                ),
                const Spacer(),
                if (tour.slotDisplay.isNotEmpty)
                  Text(tour.slotDisplay, style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub, fontWeight: FontWeight.w600)),
              ]),
              SizedBox(height: 12.h),
              _InfoRow(icon: Icons.warehouse_rounded, label: tour.nodeNameFr ?? '—'),
              if (tour.zone != null) _InfoRow(icon: Icons.location_on_outlined, label: tour.zone!),

              // COD summary
              if (tour.totalCOD > 0) ...[
                SizedBox(height: 8.h),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(10.r)),
                  child: Row(children: [
                    Icon(Icons.payments_outlined, size: 16.sp, color: const Color(0xFFD97706)),
                    SizedBox(width: 6.w),
                    Text('COD total : ${tour.totalCOD.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: const Color(0xFFD97706))),
                    const Spacer(),
                    Text('Collecté : ${tour.collectedCOD.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 11.sp, color: const Color(0xFFD97706))),
                  ]),
                ),
              ],
            ]),
          ),

          SizedBox(height: 12.h),

          // Progress
          if (stops.isNotEmpty) Row(children: [
            Expanded(child: ClipRRect(
              borderRadius: BorderRadius.circular(4.r),
              child: LinearProgressIndicator(
                value: stops.isEmpty ? 0 : tour.deliveredCount / stops.length,
                backgroundColor: const Color(0xFFF3F4F6),
                color: const Color(0xFF10B981), minHeight: 8,
              ),
            )),
            SizedBox(width: 10.w),
            Text('${tour.deliveredCount}/${stops.length}', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w800, color: AppTheme.textSub)),
          ]),

          SizedBox(height: 12.h),

          // Start button
          if (tour.isPlanned)
            SizedBox(
              width: double.infinity, height: 50.h,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _startTour,
                icon: _loading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Icon(Icons.play_arrow_rounded, size: 22.sp),
                label: Text(_loading ? 'Démarrage…' : 'Démarrer la tournée', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6), foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                ),
              ),
            ),

          if (tour.isCompleted)
            Container(
              width: double.infinity, padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(14.r),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3))),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.check_circle_rounded, color: const Color(0xFF10B981), size: 20.sp),
                SizedBox(width: 8.w),
                Text('Tournée terminée', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF10B981))),
              ]),
            ),

          SizedBox(height: 8.h),
          Text('Stops (${stops.length})', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
        ]),
      )),

      // Stops list
      SliverPadding(
        padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 24.h),
        sliver: SliverList(delegate: SliverChildBuilderDelegate(
          (_, i) => Padding(
            padding: EdgeInsets.only(bottom: 10.h),
            child: _StopCard(stop: stops[i], tourStatus: tour.status.code),
          ),
          childCount: stops.length,
        )),
      ),
    ]);
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon; final String label;
  const _InfoRow({required this.icon, required this.label});
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(top: 6.h),
    child: Row(children: [
      Icon(icon, size: 14.sp, color: AppTheme.textSub),
      SizedBox(width: 6.w),
      Text(label, style: TextStyle(fontSize: 13.sp, color: AppTheme.text, fontWeight: FontWeight.w500)),
    ]),
  );
}

class _StopCard extends StatelessWidget {
  final TourStopModel stop;
  final String tourStatus;
  const _StopCard({required this.stop, required this.tourStatus});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (stop.status.code) {
      'delivered' => const Color(0xFF10B981),
      'failed'    => const Color(0xFFEF4444),
      'arrived'   => const Color(0xFF3B82F6),
      _           => const Color(0xFF9CA3AF),
    };
    final order = stop.order;

    return GestureDetector(
      onTap: () => context.push('/stop/${stop.id}'),
      child: Container(
        padding: EdgeInsets.all(14.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14.r),
          border: Border.all(color: stop.isDone ? statusColor.withValues(alpha: 0.3) : const Color(0xFFE5E7EB)),
        ),
        child: Row(children: [
          // Stop number
          Container(
            width: 32.w, height: 32.w,
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Center(child: Text('${stop.sortOrder}', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w800, color: statusColor))),
          ),
          SizedBox(width: 12.w),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(order?.customerName ?? '—', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10.r)),
                child: Text(stop.status.nameFr, style: TextStyle(fontSize: 10.sp, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ]),
            if (order?.addressCity != null)
              Text(order!.addressCity!, style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
            if (order?.isCOD == true)
              Text('💵 COD ${order!.totalTtc.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 11.sp, color: const Color(0xFFD97706), fontWeight: FontWeight.w600)),
          ])),
          Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFFD1D5DB)),
        ]),
      ),
    );
  }
}
