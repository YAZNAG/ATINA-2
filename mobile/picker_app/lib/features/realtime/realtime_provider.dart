import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'picker_socket_service.dart';
import '../auth/providers/auth_provider.dart';

// ── Modèle notification commande ──────────────────────────────────────────────
class NewOrderNotification {
  final String orderId, reference, customerName;
  final double totalTtc;
  final int    itemsCount;
  final DateTime receivedAt;

  const NewOrderNotification({
    required this.orderId, required this.reference,
    required this.customerName, required this.totalTtc,
    required this.itemsCount, required this.receivedAt,
  });

  factory NewOrderNotification.fromMap(Map<String, dynamic> m) => NewOrderNotification(
    orderId:      m['order_id']?.toString() ?? '',
    reference:    m['reference']?.toString() ?? '',
    customerName: m['customer_name']?.toString() ?? 'Client',
    totalTtc:     double.tryParse(m['total_ttc']?.toString() ?? '0') ?? 0,
    itemsCount:   (m['items_count'] as int?) ?? 0,
    receivedAt:   DateTime.now(),
  );
}

// ── État du temps réel ────────────────────────────────────────────────────────
class RealtimeState {
  final bool connected;
  final List<NewOrderNotification> pendingNotifications;
  final Set<String> takenOrderIds; // ordres acceptés par d'autres pickers

  const RealtimeState({
    this.connected = false,
    this.pendingNotifications = const [],
    this.takenOrderIds = const {},
  });

  RealtimeState copyWith({
    bool? connected,
    List<NewOrderNotification>? pendingNotifications,
    Set<String>? takenOrderIds,
  }) => RealtimeState(
    connected: connected ?? this.connected,
    pendingNotifications: pendingNotifications ?? this.pendingNotifications,
    takenOrderIds: takenOrderIds ?? this.takenOrderIds,
  );
}

// ── Notifier ──────────────────────────────────────────────────────────────────
class RealtimeNotifier extends StateNotifier<RealtimeState> {
  RealtimeNotifier(this._ref) : super(const RealtimeState()) {
    // Démarre le socket quand le picker est authentifié
    _authSub = _ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.isAuthenticated && !_socketConnected) {
        _initSocket();
      } else if (!next.isAuthenticated) {
        _disconnectSocket();
      }
    });
  }

  final Ref _ref;
  late final ProviderSubscription<AuthState> _authSub;
  StreamSubscription<Map<String, dynamic>>? _newOrderSub;
  StreamSubscription<Map<String, dynamic>>? _orderTakenSub;
  bool _socketConnected = false;

  Future<void> _initSocket() async {
    _socketConnected = true;
    final svc = PickerSocketService.instance;
    await svc.connect();

    _newOrderSub = svc.onNewOrder.listen((data) {
      final notif = NewOrderNotification.fromMap(data);
      state = state.copyWith(
        connected: true,
        pendingNotifications: [notif, ...state.pendingNotifications],
      );
    });

    _orderTakenSub = svc.onOrderTaken.listen((data) {
      final orderId = data['order_id']?.toString() ?? '';
      if (orderId.isNotEmpty) {
        state = state.copyWith(
          takenOrderIds: {...state.takenOrderIds, orderId},
          // Supprimer la notification si présente
          pendingNotifications: state.pendingNotifications
              .where((n) => n.orderId != orderId)
              .toList(),
        );
      }
    });
  }

  void _disconnectSocket() {
    _socketConnected = false;
    _newOrderSub?.cancel();
    _orderTakenSub?.cancel();
    PickerSocketService.instance.disconnect();
    state = const RealtimeState();
  }

  void dismissNotification(String orderId) {
    state = state.copyWith(
      pendingNotifications: state.pendingNotifications
          .where((n) => n.orderId != orderId)
          .toList(),
    );
  }

  void clearAllNotifications() {
    state = state.copyWith(pendingNotifications: []);
  }

  bool isOrderTaken(String orderId) => state.takenOrderIds.contains(orderId);

  @override
  void dispose() {
    _authSub.close();
    _newOrderSub?.cancel();
    _orderTakenSub?.cancel();
    super.dispose();
  }
}

// ── Provider global ───────────────────────────────────────────────────────────
final realtimeProvider = StateNotifierProvider<RealtimeNotifier, RealtimeState>(
  (ref) => RealtimeNotifier(ref),
);
