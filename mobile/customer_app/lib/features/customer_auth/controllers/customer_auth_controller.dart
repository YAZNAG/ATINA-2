import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/storage/auth_storage.dart';
import '../models/customer_auth_response.dart';
import '../services/customer_auth_api.dart';

// ── Auth flow ──────────────────────────────────────────────────────────────────
enum CustomerAuthFlow {
  splash,          // checking stored session on startup
  unauthenticated, // no session → show login
  authenticated,   // valid session → show home
  otpPending,      // waiting for OTP after register / phone-only login
  success,         // OTP verified for a new account → show success screen
  loading,
  error,
}

// ── State ──────────────────────────────────────────────────────────────────────
class CustomerAuthState {
  final CustomerAuthFlow  flow;
  final String?           error;
  final String            phoneCountry;
  final String            phoneNumber;
  final CustomerProfile?  profile;
  final bool              isNewAccount;

  const CustomerAuthState({
    this.flow         = CustomerAuthFlow.splash,
    this.error,
    this.phoneCountry = '+212',
    this.phoneNumber  = '',
    this.profile,
    this.isNewAccount = false,
  });

  bool get isLoading => flow == CustomerAuthFlow.loading;

  CustomerAuthState copyWith({
    CustomerAuthFlow? flow,
    String?           error,
    String?           phoneCountry,
    String?           phoneNumber,
    CustomerProfile?  profile,
    bool?             isNewAccount,
  }) => CustomerAuthState(
    flow:         flow         ?? this.flow,
    error:        error,               // allow clearing error with null
    phoneCountry: phoneCountry ?? this.phoneCountry,
    phoneNumber:  phoneNumber  ?? this.phoneNumber,
    profile:      profile      ?? this.profile,
    isNewAccount: isNewAccount ?? this.isNewAccount,
  );
}

// ── Notifier ───────────────────────────────────────────────────────────────────
class CustomerAuthNotifier extends StateNotifier<CustomerAuthState> {
  CustomerAuthNotifier() : super(const CustomerAuthState()) {
    initSession();
  }

  final _api     = CustomerAuthApi.instance;
  final _storage = AuthStorage.instance;

  // Called on app start — checks stored token
  Future<void> initSession() async {
    state = state.copyWith(flow: CustomerAuthFlow.splash);
    try {
      final hasToken = await _storage.hasToken();
      if (!hasToken) {
        state = state.copyWith(flow: CustomerAuthFlow.unauthenticated);
        return;
      }
      // Try to restore profile from storage first (fast path)
      final raw = await _storage.getUser();
      if (raw != null) {
        final profile = CustomerProfile.fromMeJson(
          jsonDecode(raw) as Map<String, dynamic>,
        );
        state = state.copyWith(flow: CustomerAuthFlow.authenticated, profile: profile);
        return;
      }
      // Fallback: call /me
      final profile = await _api.getMe();
      await _storage.saveUser(jsonEncode(profile.toJson()));
      state = state.copyWith(flow: CustomerAuthFlow.authenticated, profile: profile);
    } catch (_) {
      await _storage.clear();
      state = state.copyWith(flow: CustomerAuthFlow.unauthenticated);
    }
  }

  // Password-based login
  Future<bool> login({
    required String phoneCountry,
    required String phone,
    required String password,
  }) async {
    state = state.copyWith(flow: CustomerAuthFlow.loading, phoneCountry: phoneCountry, phoneNumber: phone);
    try {
      final result = await _api.login(
        phoneCountry: phoneCountry,
        phoneNumber:  phone,
        password:     password,
      );
      await _persistSession(result);
      state = state.copyWith(flow: CustomerAuthFlow.authenticated, profile: result.profile);
      return true;
    } catch (e) {
      state = state.copyWith(flow: CustomerAuthFlow.unauthenticated, error: e.toString());
      return false;
    }
  }

  // Register new account → moves to OTP
  Future<bool> register({
    required String phoneCountry,
    required String phone,
    required String fullName,
    required String password,
    String? email,
  }) async {
    state = state.copyWith(flow: CustomerAuthFlow.loading, phoneCountry: phoneCountry, phoneNumber: phone);
    try {
      await _api.register(
        phoneCountry: phoneCountry,
        phoneNumber:  phone,
        fullName:     fullName,
        password:     password,
        email:        email,
      );
      state = state.copyWith(
        flow:         CustomerAuthFlow.otpPending,
        isNewAccount: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(flow: CustomerAuthFlow.unauthenticated, error: e.toString());
      return false;
    }
  }

  // Request OTP for phone-only flow
  Future<bool> requestOtp({required String phoneCountry, required String phone}) async {
    state = state.copyWith(flow: CustomerAuthFlow.loading, phoneCountry: phoneCountry, phoneNumber: phone);
    try {
      await _api.requestOtp(phoneCountry: phoneCountry, phoneNumber: phone);
      state = state.copyWith(flow: CustomerAuthFlow.otpPending);
      return true;
    } catch (e) {
      state = state.copyWith(flow: CustomerAuthFlow.unauthenticated, error: e.toString());
      return false;
    }
  }

  // Verify OTP → authenticated or success (new account)
  Future<bool> verifyOtp(String otp) async {
    state = state.copyWith(flow: CustomerAuthFlow.loading);
    try {
      final result = await _api.verifyOtp(
        phoneCountry: state.phoneCountry,
        phoneNumber:  state.phoneNumber,
        otp:          otp,
      );
      await _persistSession(result);
      final nextFlow = state.isNewAccount
          ? CustomerAuthFlow.success
          : CustomerAuthFlow.authenticated;
      state = state.copyWith(flow: nextFlow, profile: result.profile);
      return true;
    } catch (e) {
      state = state.copyWith(flow: CustomerAuthFlow.otpPending, error: e.toString());
      return false;
    }
  }

  // Resend OTP helper
  Future<void> resendOtp() async {
    try {
      await _api.requestOtp(
        phoneCountry: state.phoneCountry,
        phoneNumber:  state.phoneNumber,
      );
    } catch (_) {}
  }

  // Proceed from success screen to home
  void proceedToHome() {
    state = state.copyWith(flow: CustomerAuthFlow.authenticated, error: null);
  }

  // Logout
  Future<void> logout() async {
    await _storage.clear();
    state = const CustomerAuthState(flow: CustomerAuthFlow.unauthenticated);
  }

  void clearError() => state = state.copyWith(error: null);

  Future<void> _persistSession(CustomerAuthResult result) async {
    await _storage.saveToken(result.token);
    await _storage.saveUser(jsonEncode(result.profile.toJson()));
  }
}

// ── Providers ──────────────────────────────────────────────────────────────────
final customerAuthProvider =
    StateNotifierProvider<CustomerAuthNotifier, CustomerAuthState>(
  (_) => CustomerAuthNotifier(),
);

final customerProfileProvider = Provider<CustomerProfile?>((ref) {
  return ref.watch(customerAuthProvider).profile;
});
