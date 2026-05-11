import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/picker_model.dart';
import '../data/services/auth_service.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated }

class AuthState {
  final AuthStatus   status;
  final PickerModel? picker;
  final String?      error;
  const AuthState({this.status = AuthStatus.initial, this.picker, this.error});
  AuthState copyWith({AuthStatus? status, PickerModel? picker, String? error}) =>
      AuthState(status: status ?? this.status, picker: picker ?? this.picker, error: error);
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
      final picker = await _svc.login(phoneCountry: phoneCountry, phoneNumber: phoneNumber, password: password);
      state = state.copyWith(status: AuthStatus.authenticated, picker: picker);
      return true;
    } catch (e) {
      state = state.copyWith(status: AuthStatus.unauthenticated, error: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await _svc.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((_) => AuthNotifier());
