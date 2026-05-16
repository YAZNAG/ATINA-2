import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/register_screen.dart';
import '../features/home/presentation/screens/home_screen.dart';
import '../features/customer_auth/screens/customer_splash_screen.dart';
import '../features/customer_auth/screens/customer_login_screen.dart';
import '../features/customer_auth/screens/customer_register_screen.dart';
import '../features/customer_auth/screens/customer_otp_screen.dart';
import '../features/customer_auth/screens/customer_success_screen.dart';
import '../features/catalog/screens/categories_screen.dart';
import '../features/catalog/screens/products_by_category_screen.dart';
import '../features/catalog/screens/product_details_screen.dart';
import '../features/cart/screens/cart_screen.dart';
import '../features/profile/screens/profile_screen.dart';
import '../features/profile/screens/edit_profile_screen.dart';
import '../features/profile/screens/account_settings_screen.dart';
import '../features/profile/screens/wallet_screen.dart';
import '../features/profile/screens/points_screen.dart';
import '../features/addresses/screens/addresses_screen.dart';
import '../features/addresses/screens/address_form_screen.dart';
import '../features/addresses/models/address_model.dart';
import '../features/orders/screens/orders_screen.dart';
import '../features/orders/screens/order_details_screen.dart';
import '../features/checkout/screens/checkout_screen.dart';
import '../features/checkout/screens/checkout_success_screen.dart';
import '../features/checkout/screens/stripe_payment_screen.dart';

final routerProvider = Provider<GoRouter>((_) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      // ── Splash ────────────────────────────────────────────────────────────
      GoRoute(path: '/', builder: (_, __) => const CustomerSplashScreen()),

      // ── Customer auth ─────────────────────────────────────────────────────
      GoRoute(path: '/customer/login',    builder: (_, __) => const CustomerLoginScreen()),
      GoRoute(path: '/customer/register', builder: (_, __) => const CustomerRegisterScreen()),
      GoRoute(
        path: '/customer/otp',
        builder: (_, state) => CustomerOtpScreen(channel: state.extra as String? ?? 'sms'),
      ),
      GoRoute(path: '/customer/success',  builder: (_, __) => const CustomerSuccessScreen()),

      // ── Main app ──────────────────────────────────────────────────────────
      GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),

      // ── Catalogue ─────────────────────────────────────────────────────────
      GoRoute(path: '/categories', builder: (_, __) => const CategoriesScreen()),
      GoRoute(
        path: '/categories/:categoryId/products',
        builder: (_, state) => ProductsByCategoryScreen(
          categoryId:   int.parse(state.pathParameters['categoryId']!),
          categoryName: state.extra as String? ?? 'Produits',
        ),
      ),
      GoRoute(
        path: '/products/:productId',
        builder: (_, state) => ProductDetailsScreen(
          productId: int.parse(state.pathParameters['productId']!),
        ),
      ),

      // ── Panier ────────────────────────────────────────────────────────────
      GoRoute(path: '/cart', builder: (_, __) => const CartScreen()),

      // ── Profil ────────────────────────────────────────────────────────────
      GoRoute(path: '/profile',          builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/profile/edit',     builder: (_, __) => const EditProfileScreen()),
      GoRoute(path: '/profile/settings', builder: (_, __) => const AccountSettingsScreen()),
      GoRoute(path: '/wallet',           builder: (_, __) => const WalletScreen()),
      GoRoute(path: '/points',           builder: (_, __) => const PointsScreen()),

      // ── Adresses ──────────────────────────────────────────────────────────
      GoRoute(path: '/addresses', builder: (_, __) => const AddressesScreen()),
      GoRoute(path: '/addresses/new', builder: (_, __) => const AddressFormScreen()),
      GoRoute(
        path: '/addresses/:id/edit',
        builder: (_, state) => AddressFormScreen(
          editAddress: state.extra as AddressModel?,
        ),
      ),

      // ── Commandes ─────────────────────────────────────────────────────────
      GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen()),
      GoRoute(
        path: '/orders/:id',
        builder: (_, state) => OrderDetailsScreen(
          orderId: state.pathParameters['id']!,
        ),
      ),

      // ── Checkout ──────────────────────────────────────────────────────────
      GoRoute(path: '/checkout', builder: (_, __) => const CheckoutScreen()),
      GoRoute(
        path: '/checkout/success/:orderId',
        builder: (_, state) => CheckoutSuccessScreen(
          orderId: state.pathParameters['orderId']!,
        ),
      ),
      GoRoute(
        path: '/checkout/stripe/:orderId',
        builder: (_, state) => StripePaymentScreen(
          orderId: state.pathParameters['orderId']!,
          amount: double.tryParse(state.uri.queryParameters['amount'] ?? '0') ?? 0,
        ),
      ),

      // ── Legacy admin ──────────────────────────────────────────────────────
      GoRoute(path: '/login',    builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
    ],
  );
});
