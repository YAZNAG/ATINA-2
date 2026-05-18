import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../data/tours_api.dart';
import '../models/stop_model.dart';
import '../providers/tours_provider.dart';

class StopDetailScreen extends ConsumerWidget {
  final String stopId;
  const StopDetailScreen({super.key, required this.stopId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stopAsync = ref.watch(stopProvider(stopId));
    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title: Text('Livraison', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () => ref.invalidate(stopProvider(stopId)))],
      ),
      body: stopAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: ElevatedButton(onPressed: () => ref.invalidate(stopProvider(stopId)), child: Text('Réessayer: $e'))),
        data:    (stop) => _StopBody(stop: stop, onRefresh: () => ref.invalidate(stopProvider(stopId))),
      ),
    );
  }
}

class _StopBody extends ConsumerStatefulWidget {
  final TourStopModel stop;
  final VoidCallback onRefresh;
  const _StopBody({required this.stop, required this.onRefresh});
  @override
  ConsumerState<_StopBody> createState() => _StopBodyState();
}

class _StopBodyState extends ConsumerState<_StopBody> {
  bool _loading = false;
  final _amountCtrl = TextEditingController();
  final _notesCtrl  = TextEditingController();
  bool  _codChecked = false;

  @override
  void dispose() { _amountCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  Future<void> _doAction(Future<TourStopModel> Function() action, String successMsg) async {
    setState(() => _loading = true);
    try {
      await action();
      widget.onRefresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMsg), backgroundColor: const Color(0xFF10B981)));
        context.pop();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.error, duration: const Duration(seconds: 5)));
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _arrive() => _doAction(
    () => ToursApi.instance.arriveStop(widget.stop.id), 'Arrivé au client ✓');

  Future<void> _deliver() async {
    final order  = widget.stop.order;
    final isCOD  = order?.isCOD ?? false;
    final total  = order?.totalTtc ?? 0;
    final amount = double.tryParse(_amountCtrl.text) ?? total;

    if (isCOD && !_codChecked) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Confirmez l\'encaissement du COD'), backgroundColor: Color(0xFFF59E0B)));
      return;
    }
    if (isCOD && amount < total) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Montant insuffisant (min ${total.toStringAsFixed(2)} MAD)'), backgroundColor: AppTheme.error));
      return;
    }

    await _doAction(
      () => ToursApi.instance.deliverStop(widget.stop.id,
        codCollected: isCOD,
        amountCollected: isCOD ? amount : null,
        driverNotes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      ), 'Livraison confirmée ✓');
  }

  Future<void> _fail(String reason) => _doAction(
    () => ToursApi.instance.failStop(widget.stop.id,
      failureReason: reason,
      driverNotes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
    ), 'Échec enregistré');

  Future<void> _openMaps(TourStopModel stop) async {
    final order = stop.order;
    final lat = order?.lat;
    final lng = order?.lng;

    Uri uri;
    if (lat != null && lng != null) {
      uri = Uri.parse('google.navigation:q=$lat,$lng&mode=d');
      if (!await launchUrl(uri)) {
        uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } else if (order?.displayAddress.isNotEmpty == true) {
      final encoded = Uri.encodeComponent(order!.displayAddress);
      uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encoded');
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _showFailDialog() async {
    final reasons = [
      ('absent_customer',     'Client absent'),
      ('wrong_address',       'Mauvaise adresse'),
      ('refused_order',       'Commande refusée'),
      ('unreachable_customer','Client injoignable'),
    ];
    final selected = await showModalBottomSheet<String>(
      context: context,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.all(20.w),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Raison de l\'échec', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          SizedBox(height: 16.h),
          ...reasons.map((r) => ListTile(
            title: Text(r.$2),
            onTap: () => Navigator.pop(ctx, r.$1),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
          )),
          SizedBox(height: 8.h),
        ]),
      ),
    );
    if (selected != null && mounted) await _fail(selected);
  }

  @override
  Widget build(BuildContext context) {
    final stop  = widget.stop;
    final order = stop.order;
    final isCOD = order?.isCOD ?? false;
    final canAct = stop.isPending || stop.isArrived;

    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

        // Status banner
        Container(
          width: double.infinity, padding: EdgeInsets.all(14.w),
          decoration: BoxDecoration(
            color: switch (stop.status.code) {
              'delivered' => const Color(0xFFECFDF5),
              'failed'    => const Color(0xFFFEF2F2),
              'arrived'   => const Color(0xFFEFF6FF),
              _           => const Color(0xFFF9FAFB),
            },
            borderRadius: BorderRadius.circular(14.r),
            border: Border.all(color: switch (stop.status.code) {
              'delivered' => const Color(0xFF10B981),
              'failed'    => const Color(0xFFEF4444),
              'arrived'   => const Color(0xFF3B82F6),
              _           => const Color(0xFFE5E7EB),
            }.withValues(alpha: 0.3)),
          ),
          child: Row(children: [
            Icon(switch (stop.status.code) {
              'delivered' => Icons.check_circle_rounded,
              'failed'    => Icons.cancel_rounded,
              'arrived'   => Icons.location_on_rounded,
              _           => Icons.pending_rounded,
            }, color: switch (stop.status.code) {
              'delivered' => const Color(0xFF10B981),
              'failed'    => const Color(0xFFEF4444),
              'arrived'   => const Color(0xFF3B82F6),
              _           => const Color(0xFF9CA3AF),
            }, size: 24.sp),
            SizedBox(width: 10.w),
            Text(stop.status.nameFr, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
            if (stop.deliveredAt != null) ...[
              const Spacer(),
              Text(
                '${stop.deliveredAt!.hour.toString().padLeft(2, '0')}:${stop.deliveredAt!.minute.toString().padLeft(2, '0')}',
                style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub),
              ),
            ],
          ]),
        ),

        SizedBox(height: 16.h),

        // Client card
        _Section(title: 'Client', child: Column(children: [
          _InfoTile(icon: Icons.person_rounded, label: order?.customerName ?? '—'),
          _InfoTile(icon: Icons.phone_rounded,  label: order?.displayPhone ?? '—'),
        ])),

        SizedBox(height: 12.h),

        // Address card + GPS
        _Section(title: 'Adresse', child: Column(children: [
          _InfoTile(icon: Icons.location_on_rounded, label: order?.displayAddress ?? '—'),
          if (canAct) ...[
            SizedBox(height: 10.h),
            SizedBox(
              width: double.infinity, height: 42.h,
              child: OutlinedButton.icon(
                onPressed: () => _openMaps(stop),
                icon: Icon(Icons.navigation_rounded, size: 18.sp),
                label: const Text('Ouvrir navigation GPS'),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.primary),
                  foregroundColor: AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
                ),
              ),
            ),
          ],
        ])),

        SizedBox(height: 12.h),

        // Payment
        _Section(title: 'Paiement', child: Column(children: [
          _InfoTile(icon: Icons.payment_rounded, label: order?.paymentMethodName ?? '—'),
          _InfoTile(
            icon: Icons.circle,
            label: '${order?.totalTtc.toStringAsFixed(2) ?? 0} MAD',
            labelColor: AppTheme.text,
            iconColor: isCOD ? const Color(0xFFF59E0B) : const Color(0xFF10B981),
          ),
          if (isCOD)
            _InfoTile(
              icon: Icons.payments_outlined,
              label: order?.isCODCollected == true ? 'COD encaissé ✓' : 'COD à collecter',
              iconColor: order?.isCODCollected == true ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
            ),
        ])),

        SizedBox(height: 12.h),

        // Items
        if ((order?.items.isNotEmpty) == true)
          _Section(title: 'Articles (${order!.items.length})', child: Column(
            children: order.items.map((item) => Padding(
              padding: EdgeInsets.symmetric(vertical: 6.h),
              child: Row(children: [
                Icon(Icons.inventory_2_outlined, size: 16.sp, color: AppTheme.textSub),
                SizedBox(width: 8.w),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(item.nameFr, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w500)),
                  Text(item.skuCode, style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub, fontFamily: 'monospace')),
                ])),
                Text('×${item.qty.toInt()}', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700)),
              ]),
            )).toList(),
          )),

        SizedBox(height: 20.h),

        // Actions
        if (canAct) ...[
          // COD section
          if (isCOD && !order!.isCODCollected) ...[
            Container(
              padding: EdgeInsets.all(14.w),
              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14.r), border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('💵 Collecte COD', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFFD97706))),
                SizedBox(height: 10.h),
                Row(children: [
                  Expanded(child: TextField(
                    controller: _amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      hintText: '${order.totalTtc.toStringAsFixed(2)} MAD',
                      prefixIcon: Icon(Icons.attach_money_rounded, size: 18.sp),
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10.r), borderSide: BorderSide.none),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
                    ),
                  )),
                ]),
                SizedBox(height: 8.h),
                GestureDetector(
                  onTap: () => setState(() => _codChecked = !_codChecked),
                  child: Row(children: [
                    Icon(_codChecked ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                      color: _codChecked ? const Color(0xFF10B981) : const Color(0xFFD97706), size: 20.sp),
                    SizedBox(width: 8.w),
                    Text('J\'ai encaissé le montant en espèces', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFFD97706))),
                  ]),
                ),
              ]),
            ),
            SizedBox(height: 12.h),
          ],

          // Notes
          TextField(
            controller: _notesCtrl,
            decoration: InputDecoration(
              hintText: 'Note (optionnel)…',
              filled: true, fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: AppTheme.primary, width: 2)),
              contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
            ),
            maxLines: 2,
          ),
          SizedBox(height: 12.h),

          // Arrive button
          if (stop.isPending)
            _ActionBtn(
              label: '📍 Je suis arrivé',
              color: const Color(0xFF3B82F6),
              onPressed: _loading ? null : _arrive,
              loading: _loading,
            ),

          SizedBox(height: 8.h),

          // Deliver button
          _ActionBtn(
            label: '✓ Confirmer la livraison',
            color: const Color(0xFF10B981),
            onPressed: _loading ? null : _deliver,
            loading: _loading,
          ),

          SizedBox(height: 8.h),

          // Fail button
          SizedBox(
            width: double.infinity, height: 46.h,
            child: OutlinedButton.icon(
              onPressed: _loading ? null : _showFailDialog,
              icon: Icon(Icons.close_rounded, size: 18.sp),
              label: const Text('Échec livraison'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFEF4444)),
                foregroundColor: const Color(0xFFEF4444),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
              ),
            ),
          ),
        ],

        if (stop.failureReason != null)
          Padding(
            padding: EdgeInsets.only(top: 12.h),
            child: Container(
              padding: EdgeInsets.all(12.w),
              decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12.r)),
              child: Text('Raison : ${stop.failureReason}', style: TextStyle(fontSize: 13.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w600)),
            ),
          ),

        SizedBox(height: 32.h),
      ]),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  final String title; final Widget child;
  const _Section({required this.title, required this.child});
  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.all(14.w),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14.r), border: Border.all(color: const Color(0xFFE5E7EB))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: AppTheme.textSub, letterSpacing: 0.5)),
      SizedBox(height: 10.h),
      child,
    ]),
  );
}

class _InfoTile extends StatelessWidget {
  final IconData icon; final String label; final Color? iconColor, labelColor;
  const _InfoTile({required this.icon, required this.label, this.iconColor, this.labelColor});
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(vertical: 4.h),
    child: Row(children: [
      Icon(icon, size: 16.sp, color: iconColor ?? AppTheme.textSub),
      SizedBox(width: 8.w),
      Expanded(child: Text(label, style: TextStyle(fontSize: 14.sp, color: labelColor ?? AppTheme.text, fontWeight: FontWeight.w500))),
    ]),
  );
}

class _ActionBtn extends StatelessWidget {
  final String label; final Color color; final VoidCallback? onPressed; final bool loading;
  const _ActionBtn({required this.label, required this.color, required this.onPressed, this.loading = false});
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity, height: 52.h,
    child: ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: color, foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
        elevation: 0,
      ),
      child: loading
          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
          : Text(label, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
    ),
  );
}
