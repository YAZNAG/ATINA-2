import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../customer_auth/controllers/customer_auth_controller.dart';
import '../../../catalog/screens/categories_screen.dart';
import '../../../cart/screens/cart_screen.dart';
import '../../../cart/providers/cart_provider.dart';
import '../../../profile/screens/profile_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _navIndex = 0;

  @override
  Widget build(BuildContext context) {
    final cartCount = ref.watch(cartCountProvider);

    final pages = [
      const _HomeTab(),
      const CategoriesScreen(),
      const CartScreen(),
      const _FavoritesTab(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: IndexedStack(index: _navIndex, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex:        _navIndex,
        onTap:               _onNav,
        type:                BottomNavigationBarType.fixed,
        backgroundColor:     Colors.white,
        selectedItemColor:   AppTheme.primary,
        unselectedItemColor: const Color(0xFF9CA3AF),
        selectedFontSize:    10,
        unselectedFontSize:  10,
        iconSize:            22,
        elevation:           12,
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.home_outlined),          activeIcon: Icon(Icons.home_rounded),          label: 'Accueil'),
          const BottomNavigationBarItem(icon: Icon(Icons.grid_view_outlined),     activeIcon: Icon(Icons.grid_view_rounded),     label: 'Catégories'),
          BottomNavigationBarItem(
            label: 'Panier',
            icon: _CartIcon(count: cartCount, active: false),
            activeIcon: _CartIcon(count: cartCount, active: true),
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.favorite_border_rounded), activeIcon: Icon(Icons.favorite_rounded),     label: 'Favoris'),
          const BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded),  activeIcon: Icon(Icons.person_rounded),       label: 'Profil'),
        ],
      ),
    );
  }

  void _onNav(int idx) => setState(() => _navIndex = idx);
}

// ── Cart icon with badge ───────────────────────────────────────────────────────
class _CartIcon extends StatelessWidget {
  final int  count;
  final bool active;
  const _CartIcon({required this.count, required this.active});

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Icon(
        active ? Icons.shopping_cart_rounded : Icons.shopping_cart_outlined,
        size: 22,
        color: active ? AppTheme.primary : const Color(0xFF9CA3AF),
      ),
      if (count > 0)
        Positioned(
          right: -6, top: -4,
          child: Container(
            width: 15, height: 15,
            decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
            child: Center(
              child: Text(
                count > 9 ? '9+' : '$count',
                style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ),
    ],
  );
}

// ── Home tab ──────────────────────────────────────────────────────────────────
class _HomeTab extends ConsumerWidget {
  const _HomeTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(customerProfileProvider);

    return SafeArea(
      child: CustomScrollView(slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 0),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Bonjour 👋', style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
                Text(profile?.displayName ?? 'Client', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
              ])),
              GestureDetector(
                onTap: () => context.push('/cart'),
                child: Container(
                  width: 44.w, height: 44.w,
                  decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Icon(Icons.notifications_outlined, color: AppTheme.primary),
                ),
              ),
            ]),
          ),
        ),

        SliverToBoxAdapter(child: SizedBox(height: 20.h)),

        // Search bar → goes to categories
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 20.w),
            child: GestureDetector(
              onTap: () => context.push('/categories'),
              child: Container(
                height: 48.h,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14.r), border: Border.all(color: const Color(0xFFE5E7EB))),
                padding: EdgeInsets.symmetric(horizontal: 16.w),
                child: Row(children: [
                  Icon(Icons.search_rounded, color: const Color(0xFF9CA3AF), size: 20.sp),
                  SizedBox(width: 10.w),
                  Text('Rechercher des produits…', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF9CA3AF))),
                  const Spacer(),
                  Icon(Icons.tune_rounded, color: const Color(0xFF9CA3AF), size: 18.sp),
                ]),
              ),
            ),
          ),
        ),

        SliverToBoxAdapter(child: SizedBox(height: 24.h)),

        // Promo banner
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 20.w),
            child: Container(
              height: 150.h,
              decoration: BoxDecoration(
                gradient:     const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
                borderRadius: BorderRadius.circular(20.r),
              ),
              padding: EdgeInsets.all(20.w),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                Text('Livraison gratuite', style: TextStyle(color: Colors.white70, fontSize: 13.sp)),
                SizedBox(height: 4.h),
                Text('Dès 100 MAD\nd\'achat !', style: TextStyle(color: Colors.white, fontSize: 22.sp, fontWeight: FontWeight.w700)),
                SizedBox(height: 12.h),
                GestureDetector(
                  onTap: () => context.push('/categories'),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20.r)),
                    child: Text('Commander', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700, fontSize: 12.sp)),
                  ),
                ),
              ]),
            ),
          ),
        ),

        SliverToBoxAdapter(child: SizedBox(height: 28.h)),

        // Categories shortcut
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 20.w),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('Catégories populaires', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
              GestureDetector(
                onTap: () => context.push('/categories'),
                child: Text('Voir tout', style: TextStyle(fontSize: 13.sp, color: AppTheme.primary, fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
        ),

        SliverToBoxAdapter(child: SizedBox(height: 14.h)),

        SliverToBoxAdapter(
          child: SizedBox(
            height: 88.h,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding:         EdgeInsets.symmetric(horizontal: 20.w),
              children: _kShortcuts.map((s) => Padding(
                padding: EdgeInsets.only(right: 12.w),
                child: GestureDetector(
                  onTap: () => context.push('/categories'),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Container(
                      width: 54.w, height: 54.w,
                      decoration: BoxDecoration(color: (s.$3).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14.r)),
                      child: Icon(s.$2, color: s.$3, size: 26.sp),
                    ),
                    SizedBox(height: 6.h),
                    Text(s.$1, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w500, color: AppTheme.text)),
                  ]),
                ),
              )).toList(),
            ),
          ),
        ),

        SliverToBoxAdapter(child: SizedBox(height: 32.h)),
      ]),
    );
  }
}

const _kShortcuts = [
  ('Épicerie',  Icons.kitchen_outlined,      Color(0xFF10B981)),
  ('Boissons',  Icons.local_drink_outlined,  Color(0xFF3B82F6)),
  ('Hygiène',   Icons.sanitizer_outlined,    Color(0xFF8B5CF6)),
  ('Bébé',      Icons.child_care_outlined,   Color(0xFFF59E0B)),
  ('Snacks',    Icons.cookie_outlined,       Color(0xFFEF4444)),
  ('Huiles',    Icons.water_drop_outlined,   Color(0xFFF97316)),
];

// ── Favorites tab (placeholder) ───────────────────────────────────────────────
class _FavoritesTab extends StatelessWidget {
  const _FavoritesTab();
  @override
  Widget build(BuildContext context) => SafeArea(child: Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.favorite_border_rounded, size: 64.sp, color: const Color(0xFFD1D5DB)),
      SizedBox(height: 16.h),
      Text('Favoris', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
      SizedBox(height: 8.h),
      Text('Fonctionnalité bientôt disponible', style: TextStyle(fontSize: 14.sp, color: const Color(0xFF9CA3AF))),
    ]),
  ));
}

