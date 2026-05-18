import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/session_models.dart';
import '../providers/sessions_provider.dart';

class MyOrdersScreen extends ConsumerWidget {
  const MyOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title: Text('Mes préparations', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () => ref.invalidate(myOrdersProvider)),
        ],
      ),
      body: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(e.toString(), textAlign: TextAlign.center),
          ElevatedButton(onPressed: () => ref.invalidate(myOrdersProvider), child: const Text('Réessayer')),
        ])),
        data: (groups) {
          final active    = groups['active']    ?? [];
          final completed = groups['completed'] ?? [];
          final all = [...active, ...completed];
          if (all.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.assignment_outlined, size: 64.sp, color: const Color(0xFFD1D5DB)),
            SizedBox(height: 16.h),
            Text('Aucune préparation', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          ]));
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myOrdersProvider),
            child: CustomScrollView(slivers: [
              if (active.isNotEmpty) ...[
                _SliverHeader('En cours (${active.length})'),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 8.h),
                  sliver: SliverList(delegate: SliverChildBuilderDelegate(
                    (_, i) => Padding(padding: EdgeInsets.only(bottom: 10.h), child: _SessionCard(session: active[i])),
                    childCount: active.length,
                  )),
                ),
              ],
              if (completed.isNotEmpty) ...[
                _SliverHeader('Terminées (${completed.length})'),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 24.h),
                  sliver: SliverList(delegate: SliverChildBuilderDelegate(
                    (_, i) => Padding(padding: EdgeInsets.only(bottom: 10.h), child: _SessionCard(session: completed[i])),
                    childCount: completed.length,
                  )),
                ),
              ],
            ]),
          );
        },
      ),
    );
  }
}

class _SliverHeader extends StatelessWidget {
  final String text;
  const _SliverHeader(this.text);
  @override
  Widget build(BuildContext context) => SliverToBoxAdapter(
    child: Padding(
      padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 8.h),
      child: Text(text, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: AppTheme.textSub, letterSpacing: 0.5)),
    ),
  );
}

class _SessionCard extends StatelessWidget {
  final PickingSessionModel session;
  const _SessionCard({required this.session});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (session.status.code) {
      'open'        => const Color(0xFF3B82F6),
      'in_progress' => AppTheme.warning,
      'completed'   => AppTheme.success,
      _             => const Color(0xFF9CA3AF),
    };
    final order = session.order;
    final total = session.items.length;
    final done  = session.doneCount;

    return GestureDetector(
      onTap: () => context.push('/session/${session.id}'),
      child: Container(
        padding: EdgeInsets.all(14.w),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14.r),
          border: Border.all(color: session.isCompleted ? AppTheme.success.withValues(alpha: 0.3) : AppTheme.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20.r)),
              child: Text(session.status.nameFr, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w700, color: statusColor)),
            ),
            const Spacer(),
            if (session.errorCount > 0)
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10.r)),
                child: Text('${session.errorCount} erreur(s)', style: TextStyle(fontSize: 10.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w600)),
              ),
          ]),

          SizedBox(height: 8.h),

          if (order?.customerName != null)
            Text(order!.customerName!, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),

          if (total > 0) ...[
            SizedBox(height: 8.h),
            Row(children: [
              Expanded(child: ClipRRect(
                borderRadius: BorderRadius.circular(4.r),
                child: LinearProgressIndicator(
                  value: total > 0 ? done / total : 0,
                  backgroundColor: const Color(0xFFF3F4F6),
                  color: session.isCompleted ? AppTheme.success : AppTheme.primary,
                  minHeight: 6,
                ),
              )),
              SizedBox(width: 10.w),
              Text('$done/$total', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: AppTheme.textSub)),
            ]),
          ],

          SizedBox(height: 6.h),

          Row(children: [
            Icon(Icons.arrow_forward_ios_rounded, size: 14.sp, color: const Color(0xFFD1D5DB)),
          ], mainAxisAlignment: MainAxisAlignment.end),
        ]),
      ),
    );
  }
}
