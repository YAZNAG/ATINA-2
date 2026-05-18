import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/picker_portal_api.dart';
import '../models/session_models.dart';

final _api = PickerPortalApi.instance;

final availableOrdersProvider = FutureProvider<List<AvailableOrderModel>>((ref) => _api.getAvailableOrders());

final myOrdersProvider = FutureProvider<Map<String, List<PickingSessionModel>>>((ref) => _api.getMyOrders());

final sessionProvider = FutureProvider.family<PickingSessionModel, String>((ref, id) => _api.getSession(id));
