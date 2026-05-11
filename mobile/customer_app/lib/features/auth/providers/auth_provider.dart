import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/auth_response.dart';
import '../data/services/auth_service.dart';

// ── Auth state ─────────────────────────────────────────────────────────────────
enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final UserProfile? user;
  final String?      errorMessage;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.errorMessage,
  });

  AuthState copyWith({AuthStatus? status, UserProfile? user, String? errorMessage}) =>
      AuthState(status: status ?? this.status, user: user ?? this.user, errorMessage: errorMessage ?? this.errorMessage);

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isLoading       => status == AuthStatus.loading;
}

// ── Auth notifier ──────────────────────────────────────────────────────────────
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) {
    _init();
  }

  final _svc = AuthService.instance;

  Future<void> _init() async {
    state = state.copyWith(status: AuthStatus.loading);
    final user = await _svc.restoreSession();
    state = user != null
        ? state.copyWith(status: AuthStatus.authenticated, user: user)
        : state.copyWith(status: AuthStatus.unauthenticated);
  }

  Future<bool> login({
    required String phoneCountry,
    required String phoneNumber,
    required String password,
  }) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final auth = await _svc.login(
        phoneCountry: phoneCountry,
        phoneNumber:  phoneNumber,
        password:     password,
      );
      state = state.copyWith(status: AuthStatus.authenticated, user: auth.user);
      return true;
    } catch (e) {
      state = state.copyWith(status: AuthStatus.unauthenticated, errorMessage: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(status: AuthStatus.loading);
    await _svc.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

// ── Providers ──────────────────────────────────────────────────────────────────
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (_) => AuthNotifier(),
);

final currentUserProvider = Provider<UserProfile?>((ref) {
  return ref.watch(authProvider).user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authProvider).isAuthenticated;
});
