import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/profile_api.dart';
import '../models/customer_full_profile.dart';
import '../../addresses/models/address_model.dart';

final _api = ProfileApi.instance;

// ── Full profile ───────────────────────────────────────────────────────────────
final profileProvider = FutureProvider<CustomerFullProfile>((ref) async {
  return _api.getProfile();
});

// ── Addresses ─────────────────────────────────────────────────────────────────
class AddressesNotifier extends StateNotifier<AsyncValue<List<AddressModel>>> {
  AddressesNotifier() : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      state = AsyncValue.data(await _api.getAddresses());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<bool> create(Map<String, dynamic> body) async {
    try {
      final addr = await _api.createAddress(body);
      final current = state.valueOrNull ?? [];
      state = AsyncValue.data([...current, addr]);
      return true;
    } catch (_) { return false; }
  }

  Future<bool> update(String id, Map<String, dynamic> body) async {
    try {
      final updated = await _api.updateAddress(id, body);
      final current = state.valueOrNull ?? [];
      state = AsyncValue.data(current.map((a) => a.id == id ? updated : a).toList());
      return true;
    } catch (_) { return false; }
  }

  Future<bool> setDefault(String id) async {
    try {
      await _api.setDefaultAddress(id);
      final current = state.valueOrNull ?? [];
      state = AsyncValue.data(
        current.map((a) => AddressModel.fromJson({
          'id': a.id, 'label': a.label, 'street_number': a.streetNumber,
          'street_name': a.streetName, 'quartier': a.quartier, 'city': a.city,
          'postal_code': a.postalCode, 'lat': a.lat, 'lng': a.lng,
          'delivery_notes': a.deliveryNotes,
          'is_default': a.id == id,
        })).toList(),
      );
      return true;
    } catch (_) { return false; }
  }

  Future<bool> delete(String id) async {
    try {
      await _api.deleteAddress(id);
      final current = state.valueOrNull ?? [];
      final remaining = current.where((a) => a.id != id).toList();
      // If we deleted the default, mark first as default
      if (remaining.isNotEmpty && !remaining.any((a) => a.isDefault)) {
        await setDefault(remaining[0].id);
      } else {
        state = AsyncValue.data(remaining);
      }
      return true;
    } catch (_) { return false; }
  }
}

final addressesProvider =
    StateNotifierProvider<AddressesNotifier, AsyncValue<List<AddressModel>>>(
  (_) => AddressesNotifier(),
);
