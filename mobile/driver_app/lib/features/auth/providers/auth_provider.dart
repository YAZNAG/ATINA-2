import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/driver_model.dart';
import '../data/services/auth_service.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated }

class AuthState {
  final AuthStatus   status;
  final DriverModel? driver;
  final String?      error;
  const AuthState({this.status = AuthStatus.initial, this.driver, this.error});
  AuthState copyWith({AuthStatus? status, DriverModel? driver, String? error}) =>
      AuthState(status: status ?? this.status, driver: driver ?? this.driver, error: error);
  bool get isAuthenticated => status == AuthStatus.authenticated;
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) { _init(); }
  final _svc = AuthService.instance;

  Future<void> _init() async {
    state = state.copyWith(status: AuthStatus.loading);
    final ok = await _svc.isLoggedIn();
    state = state.copyWith(status: ok ? AuthStatus.authenticated : AuthStatus.unauthenticated);
  }

  Future<bool> login({required String phoneCountry, required String phoneNumber, required String password}) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final driver = await _svc.login(phoneCountry: phoneCountry, phoneNumber: phoneNumber, password: password);
      state = state.copyWith(status: AuthStatus.authenticated, driver: driver);
      return true;
    } catch (e) {
      state = state.copyWith(status: AuthStatus.unauthenticated, error: e.toString());
      return false;
    }
  }

  Future<void> logout() async { await _svc.logout(); state = const AuthState(status: AuthStatus.unauthenticated); }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((_) => AuthNotifier());
