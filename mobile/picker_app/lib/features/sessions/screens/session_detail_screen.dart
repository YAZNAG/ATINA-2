import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/theme/app_theme.dart';
import '../data/picker_portal_api.dart';
import '../models/session_models.dart';
import '../providers/sessions_provider.dart';

// ── Status badge colors ────────────────────────────────────────────────────────
Color _statusColor(String code) => switch (code) {
  'picked'      => AppTheme.success,
  'substituted' => const Color(0xFF3B82F6),
  'out_of_stock'=> const Color(0xFFEF4444),
  _             => const Color(0xFF9CA3AF),
};

// ── EAN Scanner modal ─────────────────────────────────────────────────────────
class _ScannerModal extends StatefulWidget {
  final String expectedEan;
  final String itemId;
  final double qtyExpected;
  final Function(PickingSessionModel) onSuccess;

  const _ScannerModal({required this.expectedEan, required this.itemId, required this.qtyExpected, required this.onSuccess});

  @override
  State<_ScannerModal> createState() => _ScannerModalState();
}

class _ScannerModalState extends State<_ScannerModal> {
  final MobileScannerController _ctrl = MobileScannerController();
  bool   _processing = false;
  String _manualEan  = '';
  bool   _manualMode = false;
  final _manualCtrl  = TextEditingController();

  @override
  void dispose() { _ctrl.dispose(); _manualCtrl.dispose(); super.dispose(); }

  Future<void> _process(String ean) async {
    if (_processing) return;
    setState(() => _processing = true);
    try {
      final session = await PickerPortalApi.instance.pickItem(
        widget.itemId, scannedEan: ean, qtyPicked: widget.qtyExpected,
      );
      if (mounted) {
        widget.onSuccess(session);
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString()), backgroundColor: const Color(0xFFEF4444), duration: const Duration(seconds: 4),
        ));
        setState(() => _processing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        title: const Text('Scanner EAN'),
        actions: [
          TextButton(
            onPressed: () => setState(() => _manualMode = !_manualMode),
            child: Text(_manualMode ? 'Caméra' : 'Manuel', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Column(children: [
        if (!_manualMode) Expanded(
          child: MobileScanner(
            controller: _ctrl,
            onDetect: (capture) {
              final ean = capture.barcodes.firstOrNull?.rawValue;
              if (ean != null && !_processing) _process(ean);
            },
          ),
        ),

        if (_manualMode) Expanded(child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            TextField(
              controller: _manualCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: Colors.white, fontSize: 20, fontFamily: 'monospace'),
              decoration: InputDecoration(
                hintText: 'Saisir EAN…', hintStyle: const TextStyle(color: Colors.grey),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white54)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppTheme.primary)),
                filled: true, fillColor: Colors.white12,
              ),
              onChanged: (v) => setState(() => _manualEan = v),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity, height: 52,
              child: ElevatedButton(
                onPressed: (_manualEan.isNotEmpty && !_processing) ? () => _process(_manualEan) : null,
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: _processing ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Confirmer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
          ]),
        )),

        Container(
          width: double.infinity,
          color: Colors.black87,
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('EAN attendu', style: TextStyle(color: Colors.white60, fontSize: 12.sp)),
            Text(widget.expectedEan.isNotEmpty ? widget.expectedEan : '—',
              style: TextStyle(color: Colors.white, fontSize: 18.sp, fontFamily: 'monospace', fontWeight: FontWeight.w800)),
          ]),
        ),
      ]),
    );
  }
}

// ── Item card ─────────────────────────────────────────────────────────────────
class _ItemCard extends StatelessWidget {
  final PickingItemModel item;
  final bool canInteract;
  final Function(PickingSessionModel) onUpdate;

  const _ItemCard({required this.item, required this.canInteract, required this.onUpdate});

  Future<void> _openScanner(BuildContext context) async {
    await Navigator.push(context, MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _ScannerModal(
        expectedEan: item.ean13 ?? '',
        itemId: item.id,
        qtyExpected: item.qtyExpected,
        onSuccess: onUpdate,
      ),
    ));
  }

  Future<void> _outOfStock(BuildContext context) async {
    final reasons = ['Rupture rayon', 'Produit endommagé', 'Introuvable', 'Autre'];
    final selected = await showModalBottomSheet<String>(
      context: context,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.all(20.w),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Raison de rupture', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          SizedBox(height: 12.h),
          ...reasons.map((r) => ListTile(
            title: Text(r),
            onTap: () => Navigator.pop(ctx, r),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
          )),
        ]),
      ),
    );
    if (selected == null) return;
    try {
      final session = await PickerPortalApi.instance.outOfStock(item.id, reason: selected);
      onUpdate(session);
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFEF4444)));
    }
  }

  Future<void> _substitute(BuildContext context) async {
    final eanCtrl    = TextEditingController();
    final reasonCtrl = TextEditingController();
    final confirmed  = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, MediaQuery.of(ctx).viewInsets.bottom + 20.h),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Substitution', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w700)),
          SizedBox(height: 12.h),
          TextField(controller: eanCtrl, keyboardType: TextInputType.number,
            decoration: InputDecoration(hintText: 'EAN du produit substitut *', labelText: 'EAN substitut',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)))),
          SizedBox(height: 10.h),
          TextField(controller: reasonCtrl,
            decoration: InputDecoration(hintText: 'Raison (optionnel)', labelText: 'Raison',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r)))),
          SizedBox(height: 16.h),
          SizedBox(width: double.infinity, height: 48.h,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(ctx, eanCtrl.text.isNotEmpty),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3B82F6), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r))),
              child: const Text('Confirmer substitution', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    );
    if (confirmed != true || eanCtrl.text.isEmpty) return;
    try {
      final session = await PickerPortalApi.instance.substitute(item.id, substituteEan: eanCtrl.text.trim(), reason: reasonCtrl.text.trim().isEmpty ? null : reasonCtrl.text.trim());
      onUpdate(session);
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFEF4444)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final sc = _statusColor(item.status.code);
    return Container(
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: item.isDone ? sc.withValues(alpha: 0.3) : AppTheme.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.nameFr ?? 'Article', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
            if (item.ean13 != null)
              Text(item.ean13!, style: TextStyle(fontSize: 11.sp, color: AppTheme.textSub, fontFamily: 'monospace')),
            if (item.locationLabel != null)
              Text('📍 ${item.locationLabel}', style: TextStyle(fontSize: 11.sp, color: const Color(0xFF6366F1))),
          ])),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
            decoration: BoxDecoration(color: sc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20.r)),
            child: Text(item.status.nameFr, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w700, color: sc)),
          ),
        ]),

        SizedBox(height: 6.h),
        Text('Attendu: ${item.qtyExpected.toInt()} • Prélevé: ${item.qtyPicked.toInt()}',
          style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),

        if (canInteract && item.isPending) ...[
          SizedBox(height: 10.h),
          Row(children: [
            Expanded(child: ElevatedButton.icon(
              onPressed: () => _openScanner(context),
              icon: Icon(Icons.qr_code_scanner_rounded, size: 18.sp),
              label: Text('Scanner', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
                padding: EdgeInsets.symmetric(vertical: 10.h),
                elevation: 0,
              ),
            )),
            SizedBox(width: 8.w),
            OutlinedButton(
              onPressed: () => _outOfStock(context),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFFEF4444)), foregroundColor: const Color(0xFFEF4444), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)), padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 12.w)),
              child: Text('Rupture', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700)),
            ),
            SizedBox(width: 8.w),
            OutlinedButton(
              onPressed: () => _substitute(context),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF3B82F6)), foregroundColor: const Color(0xFF3B82F6), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)), padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 12.w)),
              child: Text('Substituer', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700)),
            ),
          ]),
        ],
      ]),
    );
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────
class SessionDetailScreen extends ConsumerStatefulWidget {
  final String sessionId;
  const SessionDetailScreen({super.key, required this.sessionId});
  @override
  ConsumerState<SessionDetailScreen> createState() => _SessionDetailState();
}

class _SessionDetailState extends ConsumerState<SessionDetailScreen> {
  bool _acting = false;

  Future<void> _start() async {
    setState(() => _acting = true);
    try {
      await PickerPortalApi.instance.startSession(widget.sessionId);
      ref.invalidate(sessionProvider(widget.sessionId));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Préparation démarrée ✓'), backgroundColor: Color(0xFF10B981)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFEF4444)));
    } finally { if (mounted) setState(() => _acting = false); }
  }

  Future<void> _complete(PickingSessionModel session) async {
    if (session.pendingCount > 0) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${session.pendingCount} article(s) encore en attente'),
        backgroundColor: AppTheme.warning,
      ));
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
        title: Text('Terminer la préparation ?', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        content: Text('La commande passera à "Prête". Cette action est irréversible.', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success, foregroundColor: Colors.white),
            child: const Text('Terminer', style: TextStyle(fontWeight: FontWeight.w700))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _acting = true);
    try {
      await PickerPortalApi.instance.completeSession(widget.sessionId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Commande prête ✓'), backgroundColor: Color(0xFF10B981), duration: Duration(seconds: 4)));
        context.go('/my-orders');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: const Color(0xFFEF4444)));
    } finally { if (mounted) setState(() => _acting = false); }
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync = ref.watch(sessionProvider(widget.sessionId));

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
        title: Text('Préparation', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () => ref.invalidate(sessionProvider(widget.sessionId))),
        ],
      ),
      body: sessionAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(e.toString(), textAlign: TextAlign.center),
          ElevatedButton(onPressed: () => ref.invalidate(sessionProvider(widget.sessionId)), child: const Text('Réessayer')),
        ])),
        data: (session) {
          final order    = session.order;
          final items    = session.items;
          final total    = items.length;
          final done     = session.doneCount;
          final statusColor = switch (session.status.code) {
            'open'        => const Color(0xFF3B82F6),
            'in_progress' => AppTheme.warning,
            'completed'   => AppTheme.success,
            _             => const Color(0xFF9CA3AF),
          };

          return CustomScrollView(slivers: [
            // Header
            SliverToBoxAdapter(child: Padding(
              padding: EdgeInsets.all(16.w),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Status + error count
                Row(children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 5.h),
                    decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20.r)),
                    child: Text(session.status.nameFr, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: statusColor)),
                  ),
                  if (session.errorCount > 0) ...[
                    SizedBox(width: 8.w),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                      decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10.r)),
                      child: Text('${session.errorCount} erreur(s)', style: TextStyle(fontSize: 11.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w600)),
                    ),
                  ],
                ]),

                if (order != null) ...[
                  SizedBox(height: 10.h),
                  Text(order.customerName ?? '—', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.w800, color: AppTheme.text)),
                  if (order.customerPhone != null && order.customerPhone!.trim().isNotEmpty)
                    Text(order.customerPhone!, style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
                  if (order.slotStart != null)
                    Text('🕐 ${order.slotStart}–${order.slotEnd}', style: TextStyle(fontSize: 12.sp, color: AppTheme.textSub)),
                ],

                if (total > 0) ...[
                  SizedBox(height: 12.h),
                  Row(children: [
                    Expanded(child: ClipRRect(
                      borderRadius: BorderRadius.circular(4.r),
                      child: LinearProgressIndicator(
                        value: total > 0 ? done / total : 0,
                        backgroundColor: const Color(0xFFF3F4F6),
                        color: session.isCompleted ? AppTheme.success : AppTheme.primary,
                        minHeight: 8,
                      ),
                    )),
                    SizedBox(width: 10.w),
                    Text('$done/$total', style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w800, color: AppTheme.textSub)),
                  ]),
                ],

                SizedBox(height: 12.h),

                // Action buttons
                if (session.isOpen)
                  SizedBox(
                    width: double.infinity, height: 50.h,
                    child: ElevatedButton.icon(
                      onPressed: _acting ? null : _start,
                      icon: _acting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Icon(Icons.play_arrow_rounded, size: 22.sp),
                      label: Text(_acting ? 'Démarrage…' : 'Démarrer la préparation', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF3B82F6), foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)), elevation: 0,
                      ),
                    ),
                  ),

                if (session.isInProgress)
                  SizedBox(
                    width: double.infinity, height: 50.h,
                    child: ElevatedButton.icon(
                      onPressed: (_acting || !session.allDone) ? null : () => _complete(session),
                      icon: _acting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Icon(Icons.check_circle_rounded, size: 22.sp),
                      label: Text(
                        _acting ? 'Finalisation…' :
                        session.allDone ? 'Terminer la préparation' :
                        '${session.pendingCount} article(s) restant(s)',
                        style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: session.allDone ? AppTheme.success : const Color(0xFFD1D5DB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)), elevation: 0,
                      ),
                    ),
                  ),

                if (session.isCompleted)
                  Container(
                    width: double.infinity, padding: EdgeInsets.all(14.w),
                    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(14.r), border: Border.all(color: AppTheme.success.withValues(alpha: 0.3))),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.check_circle_rounded, color: AppTheme.success, size: 20.sp),
                      SizedBox(width: 8.w),
                      Text('Préparation terminée — commande prête', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: AppTheme.success)),
                    ]),
                  ),
              ]),
            )),

            // Items list
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 24.h),
              sliver: SliverList(delegate: SliverChildBuilderDelegate(
                (_, i) => Padding(
                  padding: EdgeInsets.only(bottom: 10.h),
                  child: _ItemCard(
                    item: items[i],
                    canInteract: session.isInProgress,
                    onUpdate: (updated) {
                      ref.invalidate(sessionProvider(widget.sessionId));
                    },
                  ),
                ),
                childCount: items.length,
              )),
            ),
          ]);
        },
      ),
    );
  }
}
