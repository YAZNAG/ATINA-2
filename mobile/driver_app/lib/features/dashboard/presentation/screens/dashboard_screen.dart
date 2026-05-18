import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';
import '../../../tours/providers/tours_provider.dart';
import '../../../tours/models/tour_model.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final driver     = ref.watch(authProvider).driver;
    final toursAsync = ref.watch(toursProvider);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Column(children: [
          Text('${driver?.vehicleEmoji ?? '🚚'} ${driver?.name ?? 'Livreur'}', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          Text('Dark Store Driver', style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.person_outline_rounded), onPressed: () => context.push('/profile')),
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () => ref.invalidate(toursProvider)),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(toursProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.all(20.w),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

              // Vehicle card
              if (driver?.vehicleType != null || driver?.vehiclePlate != null)
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.all(16.w),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF059669), Color(0xFF10B981)]),
                    borderRadius: BorderRadius.circular(16.r),
                    boxShadow: [BoxShadow(color: const Color(0xFF10B981).withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Row(children: [
                    Text(driver?.vehicleEmoji ?? '🚚', style: TextStyle(fontSize: 36.sp)),
                    SizedBox(width: 16.w),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(driver?.vehicleType ?? 'Véhicule', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                      if (driver?.vehiclePlate != null)
                        Text(driver!.vehiclePlate!, style: const TextStyle(color: Colors.white70, fontFamily: 'monospace', fontSize: 14)),
                    ]),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20.r)),
                      child: Row(children: [
                        const Icon(Icons.circle, color: Colors.white, size: 8),
                        const SizedBox(width: 4),
                        const Text('En ligne', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  ]),
                ),

              SizedBox(height: 24.h),
              Text('Tableau de bord', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
              SizedBox(height: 14.h),

              // Stats from real tours
              toursAsync.when(
                loading: () => _StatsPlaceholder(),
                error:   (_, __) => _StatsPlaceholder(),
                data:    (tours) {
                  final today = DateTime.now();
                  final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
                  final todayTours = tours.where((t) => t.date == todayStr || t.isInProgress).toList();

                  final delivered     = tours.fold(0, (s, t) => s + t.deliveredCount);
                  final pending       = tours.fold(0, (s, t) => s + t.pendingCount);
                  final codToCollect  = tours.where((t) => t.isInProgress).fold(0.0, (s, t) => s + t.totalCOD - t.collectedCOD);
                  final inProgress    = tours.where((t) => t.isInProgress).toList();

                  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: _StatCard(label: 'Tournées', value: '${todayTours.length}', icon: Icons.route_rounded, color: AppTheme.primary)),
                      SizedBox(width: 12.w),
                      Expanded(child: _StatCard(label: 'Livrés', value: '$delivered', icon: Icons.check_circle_rounded, color: AppTheme.success)),
                    ]),
                    SizedBox(height: 12.h),
                    Row(children: [
                      Expanded(child: _StatCard(label: 'En attente', value: '$pending', icon: Icons.pending_rounded, color: AppTheme.warning)),
                      SizedBox(width: 12.w),
                      Expanded(child: _StatCard(label: 'COD restant', value: '${codToCollect.toStringAsFixed(0)} MAD', icon: Icons.payments_outlined, color: const Color(0xFF6366F1))),
                    ]),

                    if (inProgress.isNotEmpty) ...[
                      SizedBox(height: 24.h),
                      Text('Tournée en cours', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
                      SizedBox(height: 10.h),
                      ...inProgress.map((t) => _ActiveTourCard(tour: t)),
                    ],

                    SizedBox(height: 24.h),
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('Mes tournées', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
                      TextButton(onPressed: () => context.push('/tours'), child: const Text('Voir tout')),
                    ]),
                    SizedBox(height: 8.h),
                    if (tours.isEmpty)
                      Container(
                        width: double.infinity, padding: EdgeInsets.all(24.w),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r), border: Border.all(color: AppTheme.border)),
                        child: Column(children: [
                          Icon(Icons.route_outlined, size: 40.sp, color: const Color(0xFFD1D5DB)),
                          SizedBox(height: 8.h),
                          Text('Aucune tournée', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),
                        ]),
                      )
                    else
                      ...tours.take(3).map((t) => Padding(
                        padding: EdgeInsets.only(bottom: 8.h),
                        child: GestureDetector(
                          onTap: () => context.push('/tour/${t.id}'),
                          child: Container(
                            padding: EdgeInsets.all(14.w),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14.r), border: Border.all(color: AppTheme.border)),
                            child: Row(children: [
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(t.nodeNameFr ?? '—', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700)),
                                Text('${t.deliveredCount}/${t.stops.length} livrés', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
                              ])),
                              Text(t.status.nameFr, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w600,
                                color: switch (t.status.code) {
                                  'in_progress' => AppTheme.warning,
                                  'completed'   => AppTheme.success,
                                  _             => const Color(0xFF3B82F6),
                                })),
                              SizedBox(width: 8.w),
                              Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFFD1D5DB)),
                            ]),
                          ),
                        ),
                      )),
                  ]);
                },
              ),
              SizedBox(height: 20.h),
            ]),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/tours'),
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.map_rounded, color: Colors.white),
        label: Text('Mes tournées', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: Colors.white)),
      ),
    );
  }
}

class _ActiveTourCard extends StatelessWidget {
  final TourModel tour;
  const _ActiveTourCard({required this.tour});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () => context.push('/tour/${tour.id}'),
    child: Container(
      width: double.infinity, padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AppTheme.primary.withValues(alpha: 0.08), Colors.white]),
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.local_shipping_rounded, color: AppTheme.primary, size: 20.sp),
          SizedBox(width: 8.w),
          Text(tour.nodeNameFr ?? '—', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: AppTheme.primary)),
          const Spacer(),
          Text('${tour.deliveredCount}/${tour.stops.length}', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
        ]),
        SizedBox(height: 8.h),
        ClipRRect(
          borderRadius: BorderRadius.circular(4.r),
          child: LinearProgressIndicator(
            value: tour.stops.isEmpty ? 0 : tour.deliveredCount / tour.stops.length,
            backgroundColor: AppTheme.primary.withValues(alpha: 0.15),
            color: AppTheme.primary,
            minHeight: 6,
          ),
        ),
        SizedBox(height: 6.h),
        Text('${tour.pendingCount} stop(s) restant(s) · ${tour.totalCOD.toStringAsFixed(2)} MAD COD',
          style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub)),
      ]),
    ),
  );
}

class _StatsPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(children: [
    Row(children: [
      Expanded(child: _StatCard(label: 'Tournées', value: '—', icon: Icons.route_rounded, color: AppTheme.primary)),
      SizedBox(width: 12.w),
      Expanded(child: _StatCard(label: 'Livrés', value: '—', icon: Icons.check_circle_rounded, color: AppTheme.success)),
    ]),
    SizedBox(height: 12.h),
    Row(children: [
      Expanded(child: _StatCard(label: 'En attente', value: '—', icon: Icons.pending_rounded, color: AppTheme.warning)),
      SizedBox(width: 12.w),
      Expanded(child: _StatCard(label: 'COD restant', value: '—', icon: Icons.payments_outlined, color: const Color(0xFF6366F1))),
    ]),
  ]);
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(16.w),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r), border: Border.all(color: const Color(0xFFE5E7EB))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color, size: 24.sp),
      SizedBox(height: 8.h),
      Text(value, style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.w800, color: color)),
      Text(label, style: TextStyle(fontSize: 11.sp, color: const Color(0xFF6B7280))),
    ]),
  );
}
