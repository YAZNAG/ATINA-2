import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../core/constants/api_constants.dart';
import '../../core/storage/auth_storage.dart';

/// Service Socket.IO temps réel pour le picker.
/// Singleton accessible via [PickerSocketService.instance].
class PickerSocketService {
  PickerSocketService._();
  static final PickerSocketService instance = PickerSocketService._();

  io.Socket? _socket;
  bool _connected = false;

  // Streams pour écouter les événements
  final _newOrderCtrl   = StreamController<Map<String, dynamic>>.broadcast();
  final _orderTakenCtrl = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get onNewOrder   => _newOrderCtrl.stream;
  Stream<Map<String, dynamic>> get onOrderTaken => _orderTakenCtrl.stream;

  bool get isConnected => _connected;

  // ── Connexion au socket ────────────────────────────────────────────────────
  Future<void> connect() async {
    if (_connected) return;

    final token = await AuthStorage.instance.getToken();
    if (token == null || token.isEmpty) return;

    // URL socket : même hôte que l'API mais sans '/api'
    final apiBase = ApiConstants.baseUrl; // ex: http://192.168.100.4:5000/api
    final socketUrl = apiBase.replaceFirst(RegExp(r'/api$'), '');

    _socket = io.io(socketUrl, <String, dynamic>{
      'transports': ['websocket'],
      'path': '/socket/picker',
      'auth': {'token': token},
      'autoConnect': false,
      'reconnection': true,
      'reconnectionDelay': 2000,
      'reconnectionAttempts': 10,
    });

    _socket!.onConnect((_) {
      _connected = true;
      // ignore: avoid_print
      print('[PickerSocket] ✓ Connecté au serveur temps réel');
      _socket!.emit('ping');
    });

    _socket!.onDisconnect((_) {
      _connected = false;
      // ignore: avoid_print
      print('[PickerSocket] Déconnecté');
    });

    _socket!.onConnectError((err) {
      // ignore: avoid_print
      print('[PickerSocket] Erreur connexion: $err');
    });

    // ── Écoute des événements picker ─────────────────────────────────────────
    _socket!.on('picker:new_order', (data) {
      // ignore: avoid_print
      print('[PickerSocket] ← picker:new_order $data');
      if (data is Map) {
        _newOrderCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('picker:order_taken', (data) {
      // ignore: avoid_print
      print('[PickerSocket] ← picker:order_taken $data');
      if (data is Map) {
        _orderTakenCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.connect();
  }

  // ── Déconnexion ────────────────────────────────────────────────────────────
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _connected = false;
  }

  void dispose() {
    disconnect();
    _newOrderCtrl.close();
    _orderTakenCtrl.close();
  }
}
