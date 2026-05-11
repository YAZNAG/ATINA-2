import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/providers/auth_provider.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _navIndex = 0;

  final _pages = const [_HomeTab(), _CatalogTab(), _CartTab(), _ProfileTab()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: _pages[_navIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _navIndex,
        onTap:        (i) => setState(() => _navIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined),       activeIcon: Icon(Icons.home),       label: 'Accueil'),
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_outlined),  activeIcon: Icon(Icons.grid_view),  label: 'Catalogue'),
          BottomNavigationBarItem(icon: Icon(Icons.shopping_cart_outlined), activeIcon: Icon(Icons.shopping_cart), label: 'Panier'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline),      activeIcon: Icon(Icons.person),     label: 'Profil'),
        ],
      ),
    );
  }
}

// ── Home tab ──────────────────────────────────────────────────────────────────
class _HomeTab extends ConsumerWidget {
  const _HomeTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          // Header
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 0),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Bonjour 👋', style: TextStyle(fontSize: 13.sp, color: AppTheme.textSub)),
                    Text(user?.name ?? 'Client', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
                  ]),
                ),
                Container(
                  width: 44.w, height: 44.w,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.notifications_outlined, color: AppTheme.primary),
                ),
              ]),
            ),
          ),

          SliverToBoxAdapter(child: SizedBox(height: 20.h)),

          // Search bar
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              child: TextField(
                readOnly: true,
                decoration: InputDecoration(
                  hintText: 'Rechercher des produits…',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: const Icon(Icons.tune_rounded),
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
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20.r)),
                    child: Text('Commander', style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700, fontSize: 12.sp)),
                  ),
                ]),
              ),
            ),
          ),

          SliverToBoxAdapter(child: SizedBox(height: 28.h)),

          // Categories
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('Catégories', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
                TextButton(onPressed: () {}, child: const Text('Voir tout')),
              ]),
            ),
          ),

          SliverToBoxAdapter(
            child: SizedBox(
              height: 100.h,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding:         EdgeInsets.symmetric(horizontal: 20.w),
                separatorBuilder: (_, __) => SizedBox(width: 12.w),
                itemCount: _mockCategories.length,
                itemBuilder: (_, i) => _CategoryChip(cat: _mockCategories[i]),
              ),
            ),
          ),

          SliverToBoxAdapter(child: SizedBox(height: 28.h)),

          // Products
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 20.w),
              child: Text('Produits populaires', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: AppTheme.text)),
            ),
          ),

          SliverToBoxAdapter(child: SizedBox(height: 16.h)),

          SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: 20.w),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _ProductCard(product: _mockProducts[i]),
                childCount: _mockProducts.length,
              ),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount:     2,
                crossAxisSpacing:   12.w,
                mainAxisSpacing:    12.h,
                childAspectRatio:   0.75,
              ),
            ),
          ),

          SliverToBoxAdapter(child: SizedBox(height: 24.h)),
        ],
      ),
    );
  }
}

// ── Category chip ──────────────────────────────────────────────────────────────
class _CategoryChip extends StatelessWidget {
  final Map<String, dynamic> cat;
  const _CategoryChip({required this.cat});

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
        width: 60.w, height: 60.w,
        decoration: BoxDecoration(
          color:        (cat['color'] as Color).withOpacity(0.12),
          borderRadius: BorderRadius.circular(16.r),
        ),
        child: Icon(cat['icon'] as IconData, color: cat['color'] as Color, size: 28.sp),
      ),
      SizedBox(height: 6.h),
      Text(cat['name'] as String, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w500, color: AppTheme.text)),
    ]);
  }
}

// ── Product card ──────────────────────────────────────────────────────────────
class _ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color:        Colors.white,
        borderRadius: BorderRadius.circular(16.r),
        border:       Border.all(color: AppTheme.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color:        const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16.r)),
            ),
            child: Center(child: Icon(Icons.inventory_2_outlined, size: 48.sp, color: AppTheme.textSub)),
          ),
        ),
        Padding(
          padding: EdgeInsets.all(12.w),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(product['name'] as String, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: AppTheme.text), maxLines: 2, overflow: TextOverflow.ellipsis),
            SizedBox(height: 4.h),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('${product['price']} MAD', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: AppTheme.primary)),
              Container(
                width: 30.w, height: 30.w,
                decoration: BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                child: Icon(Icons.add, color: Colors.white, size: 18.sp),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}

// ── Placeholder tabs ──────────────────────────────────────────────────────────
class _CatalogTab extends StatelessWidget {
  const _CatalogTab();
  @override
  Widget build(BuildContext context) => const Center(child: Text('Catalogue — En développement'));
}

class _CartTab extends StatelessWidget {
  const _CartTab();
  @override
  Widget build(BuildContext context) => const Center(child: Text('Panier — En développement'));
}

class _ProfileTab extends ConsumerWidget {
  const _ProfileTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.all(24.w),
        child: Column(children: [
          SizedBox(height: 20.h),
          CircleAvatar(radius: 40.r, backgroundColor: AppTheme.primary.withOpacity(0.12), child: Text(user?.initials ?? '?', style: TextStyle(fontSize: 28.sp, color: AppTheme.primary, fontWeight: FontWeight.w700))),
          SizedBox(height: 16.h),
          Text(user?.name ?? '', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w700)),
          Text(user?.displayPhone ?? '', style: TextStyle(fontSize: 14.sp, color: AppTheme.textSub)),
          SizedBox(height: 8.h),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _StatBadge(label: 'Wallet', value: '${user?.walletBalance.toStringAsFixed(2)} MAD', color: const Color(0xFF8B5CF6)),
            SizedBox(width: 12.w),
            _StatBadge(label: 'Points', value: '${user?.pointsBalance}', color: const Color(0xFFF59E0B)),
          ]),
          SizedBox(height: 40.h),
          ElevatedButton.icon(
            onPressed: () => ref.read(authProvider.notifier).logout(),
            icon:  const Icon(Icons.logout_rounded),
            label: const Text('Se déconnecter'),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
          ),
        ]),
      ),
    );
  }
}

class _StatBadge extends StatelessWidget {
  final String label, value;
  final Color  color;
  const _StatBadge({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12.r)),
    child: Column(children: [
      Text(value, style: TextStyle(fontWeight: FontWeight.w700, color: color, fontSize: 15.sp)),
      Text(label, style: TextStyle(fontSize: 11.sp, color: color.withOpacity(0.7))),
    ]),
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────
final _mockCategories = [
  {'name': 'Épicerie',    'icon': Icons.kitchen_outlined,      'color': const Color(0xFF10B981)},
  {'name': 'Boissons',    'icon': Icons.local_drink_outlined,  'color': const Color(0xFF3B82F6)},
  {'name': 'Hygiène',     'icon': Icons.sanitizer_outlined,    'color': const Color(0xFF8B5CF6)},
  {'name': 'Bébé',        'icon': Icons.child_care_outlined,   'color': const Color(0xFFF59E0B)},
  {'name': 'Snacks',      'icon': Icons.cookie_outlined,       'color': const Color(0xFFEF4444)},
];

final _mockProducts = [
  {'name': 'Huile de Tournesol Lesieur 1L', 'price': '25.90'},
  {'name': 'Lait Centrale 1L',             'price': '9.50'},
  {'name': 'Pain de mie Harry\'s',         'price': '14.50'},
  {'name': 'Sucre Cosumar 1kg',            'price': '8.50'},
  {'name': 'Café Nescafé 200g',            'price': '42.00'},
  {'name': 'Eau Sidi Ali 1.5L',            'price': '5.50'},
];
