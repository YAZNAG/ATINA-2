import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/customer_auth_response.dart';
import '../services/customer_auth_api.dart';

// ── Storage keys ───────────────────────────────────────────────────────────────
const _kToken      = 'ca_token';
const _kUserId     = 'ca_user_id';
const _kPhone      = 'ca_phone';
const _kCustomerId = 'ca_customer_id';

const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);

// ── Auth state ─────────────────────────────────────────────────────────────────
enum CustomerAuthStatus { initial, loading, otpSent, verified, error }

class CustomerAuthState {
  final CustomerAuthStatus status;
  final String?            errorMessage;
  final String             phoneCountry;
  final String             phoneNumber;
  final OtpVerifyResponse? verifyResponse;

  const CustomerAuthState({
    this.status       = CustomerAuthStatus.initial,
    this.errorMessage,
    this.phoneCountry = '+212',
    this.phoneNumber  = '',
    this.verifyResponse,
  });

  CustomerAuthState copyWith({
    CustomerAuthStatus? status,
    String?            errorMessage,
    String?            phoneCountry,
    String?            phoneNumber,
    OtpVerifyResponse? verifyResponse,
  }) => CustomerAuthState(
    status:          status          ?? this.status,
    errorMessage:    errorMessage,
    phoneCountry:    phoneCountry    ?? this.phoneCountry,
    phoneNumber:     phoneNumber     ?? this.phoneNumber,
    verifyResponse:  verifyResponse  ?? this.verifyResponse,
  );

  bool get isLoading => status == CustomerAuthStatus.loading;
}

// ── Notifier ───────────────────────────────────────────────────────────────────
class CustomerAuthNotifier extends StateNotifier<CustomerAuthState> {
  CustomerAuthNotifier() : super(const CustomerAuthState());

  final _api = CustomerAuthApi.instance;

  Future<bool> requestOtp({required String phoneCountry, required String phone}) async {
    state = state.copyWith(status: CustomerAuthStatus.loading, phoneCountry: phoneCountry, phoneNumber: phone);
    try {
      await _api.requestOtp(phoneCountry: phoneCountry, phoneNumber: phone);
      state = state.copyWith(status: CustomerAuthStatus.otpSent);
      return true;
    } catch (e) {
      state = state.copyWith(status: CustomerAuthStatus.error, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> verifyOtp(String otp) async {
    state = state.copyWith(status: CustomerAuthStatus.loading);
    try {
      final resp = await _api.verifyOtp(
        phoneCountry: state.phoneCountry,
        phoneNumber:  state.phoneNumber,
        otp:          otp,
      );
      // Persist token locally
      await _storage.write(key: _kToken,      value: resp.token);
      await _storage.write(key: _kUserId,     value: resp.userId.toString());
      await _storage.write(key: _kPhone,      value: resp.phoneNumber);
      if (resp.customerId != null) {
        await _storage.write(key: _kCustomerId, value: resp.customerId);
      }
      state = state.copyWith(status: CustomerAuthStatus.verified, verifyResponse: resp);
      return true;
    } catch (e) {
      state = state.copyWith(status: CustomerAuthStatus.error, errorMessage: e.toString());
      return false;
    }
  }

  void resetError() => state = state.copyWith(status: CustomerAuthStatus.otpSent);
}

// ── Provider ───────────────────────────────────────────────────────────────────
final customerAuthProvider =
    StateNotifierProvider<CustomerAuthNotifier, CustomerAuthState>((_) => CustomerAuthNotifier());

// ── Has stored token ───────────────────────────────────────────────────────────
Future<bool> hasStoredToken() async {
  final t = await _storage.read(key: _kToken);
  return t != null && t.isNotEmpty;
}

Future<void> clearStoredToken() async => _storage.deleteAll();
