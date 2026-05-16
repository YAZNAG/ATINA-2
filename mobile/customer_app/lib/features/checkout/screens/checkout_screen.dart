import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/dio_client.dart';
import '../../addresses/models/address_model.dart';
import '../../cart/providers/cart_provider.dart';
import '../../customer_auth/models/customer_auth_response.dart';
import '../../customer_auth/controllers/customer_auth_controller.dart';
import '../../profile/providers/profile_provider.dart';
import '../data/checkout_api.dart';
import '../providers/checkout_provider.dart';
import '../models/checkout_meta_model.dart';
import '../models/delivery_slot_model.dart';
import '../models/pickup_node_model.dart';
import '../models/create_order_payload.dart';
import '../widgets/delivery_type_selector.dart';
import '../widgets/date_selector.dart';
import '../widgets/delivery_slot_selector.dart';
import '../widgets/payment_method_selector.dart';
import '../widgets/checkout_summary_card.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _pageController = PageController();
  int _currentStep = 0;

  DeliveryTypeModel? _selectedDeliveryType;
  AddressModel? _selectedAddress;
  PickupNodeModel? _selectedPickupNode;
  DateTime _selectedDate = DateTime.now();
  DeliverySlotModel? _selectedSlot;
  PaymentMethodModel? _selectedPayment;
  double _walletUsed = 0;
  int _pointsUsed = 0;
  bool _creating = false;
  String? _stepError;

  List<DeliverySlotModel> _slots = [];
  bool _slotsLoading = false;
  PickupNodeModel? _detectedNode; // auto-detected for home delivery

  List<PickupNodeModel> _pickupNodes = [];
  bool _pickupNodesLoading = false;

  @override
  void initState() {
    super.initState();
    _checkEmptyCart();
  }

  void _checkEmptyCart() {
    final items = ref.read(cartProvider);
    if (items.isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _showError('Votre panier est vide');
          context.go('/cart');
        }
      });
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: const Color(0xFFEF4444),
      behavior: SnackBarBehavior.floating,
      margin: EdgeInsets.all(16.w),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
      duration: const Duration(seconds: 3),
    ));
  }

  Future<void> _loadSlots() async {
    if (_selectedDeliveryType == null) return;
    setState(() { _slotsLoading = true; _stepError = null; });

    try {
      final result = await CheckoutApi.instance.getDeliverySlots(
        addressId:        _selectedDeliveryType!.code == 'home' ? _selectedAddress?.id : null,
        deliveryTypeId:   _selectedDeliveryType!.id,
        nodeId:           _selectedDeliveryType!.code == 'pickup' ? _selectedPickupNode?.id : null,
        date:             _formatDate(_selectedDate),
      );
      _slots        = result.slots;
      _detectedNode = result.detectedNode;
      if (_slots.isEmpty) _stepError = result.message ?? 'Aucun créneau disponible pour cette date';
    } on ApiException catch (e) {
      _stepError = e.message;
      _slots = [];
    } catch (e) {
      _stepError = e.toString();
      _slots = [];
    }

    if (mounted) setState(() { _slotsLoading = false; });
  }

  Future<void> _loadPickupNodes() async {
    setState(() { _pickupNodesLoading = true; _stepError = null; });
    try {
      _pickupNodes = await CheckoutApi.instance.getPickupNodes();
      if (_pickupNodes.length == 1) {
        _selectedPickupNode = _pickupNodes.first;
      }
    } on ApiException catch (e) {
      _stepError = e.message;
    } catch (e) {
      _stepError = e.toString();
    }
    if (mounted) setState(() { _pickupNodesLoading = false; });
  }

  String _formatDate(DateTime dt) => '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';

  Future<void> _nextStep() async {
    setState(() => _stepError = null);

    if (_currentStep == 0) {
      if (_selectedDeliveryType == null) {
        setState(() => _stepError = 'Veuillez choisir un type de livraison');
        return;
      }
      if (_selectedDeliveryType!.code == 'home' && _selectedAddress == null) {
        setState(() => _stepError = 'Veuillez sélectionner une adresse');
        return;
      }
      if (_selectedDeliveryType!.code == 'pickup') {
        if (_pickupNodes.isEmpty) {
          await _loadPickupNodes();
        }
        if (_pickupNodes.length > 1 && _selectedPickupNode == null) {
          setState(() => _stepError = 'Veuillez choisir un magasin');
          return;
        }
        if (_pickupNodes.isEmpty) {
          setState(() => _stepError = 'Aucun magasin disponible');
          return;
        }
        if (_selectedPickupNode == null && _pickupNodes.length == 1) {
          _selectedPickupNode = _pickupNodes.first;
        }
      }
      await _loadSlots();
      if (_slots.isEmpty) {
        setState(() => _stepError ??= 'Aucun créneau disponible pour cette date');
        return;
      }
    } else if (_currentStep == 1) {
      if (_selectedSlot == null) {
        setState(() => _stepError = 'Veuillez choisir un créneau');
        return;
      }
    } else if (_currentStep == 2) {
      if (_selectedPayment == null) {
        setState(() => _stepError = 'Veuillez choisir une méthode de paiement');
        return;
      }
    }

    if (_currentStep < 3) {
      _pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      setState(() => _currentStep++);
    } else {
      await _createOrder();
    }
  }

  Future<void> _createOrder() async {
    setState(() => _creating = true);

    try {
      final profile = ref.read(customerProfileProvider);
      final items = ref.read(cartProvider);
      if (profile == null) { _showError('Session expirée'); return; }
      if (items.isEmpty) { _showError('Panier vide'); return; }

      final payload = CreateOrderPayload(
        customerId: profile.id,
        addressId: _selectedDeliveryType!.code == 'home' ? _selectedAddress?.id : null,
        deliveryTypeId: _selectedDeliveryType!.id,
        nodeId: _selectedDeliveryType!.code == 'pickup'
            ? _selectedPickupNode?.id
            : _detectedNode?.id, // null → backend auto-detects for home delivery
        selectedSlotId: _selectedSlot!.id,
        selectedDate: _formatDate(_selectedDate),
        paymentMethodId: _selectedPayment!.id,
        walletUsed: _walletUsed,
        pointsUsed: _pointsUsed,
        cartItems: items.map((i) => CartItemPayload.fromCartItem(i)).toList(),
      );

      final result = await CheckoutApi.instance.createOrder(payload);
      ref.read(cartProvider.notifier).clear();

      if (mounted) {
        context.go('/checkout/success/${result['id'] ?? result['order_id'] ?? ''}');
      }
    } on ApiException catch (e) {
      setState(() => _stepError = e.message);
    } catch (e) {
      setState(() => _stepError = 'Erreur lors de la création de la commande');
    }

    if (mounted) setState(() => _creating = false);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cartItems = ref.watch(cartProvider);
    final cartTotal = ref.watch(cartTotalProvider);
    final addressesAsync = ref.watch(addressesProvider);
    final profile = ref.watch(customerProfileProvider);

    final stepperLabels = ['Livraison', 'Créneau', 'Paiement', 'Récapitulatif'];

    if (cartItems.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF5F5F5),
        appBar: AppBar(
          backgroundColor: Colors.white, elevation: 0, surfaceTintColor: Colors.transparent,
          leading: IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
          title: Text('Checkout', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
          centerTitle: true,
        ),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.shopping_cart_outlined, size: 72.sp, color: const Color(0xFFD1D5DB)),
            SizedBox(height: 16.h),
            Text('Votre panier est vide', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF374151))),
            SizedBox(height: 24.h),
            GestureDetector(
              onTap: () => context.go('/home'),
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 28.w, vertical: 14.h),
                decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]), borderRadius: BorderRadius.circular(14.r)),
                child: Text('Continuer mes achats', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15.sp)),
              ),
            ),
          ]),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: _currentStep > 0
              ? () { _pageController.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut); setState(() => _currentStep--); }
              : () => context.pop(),
        ),
        title: Text('Checkout', style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
        centerTitle: true,
      ),
      body: Column(children: [
        _StepperBar(currentStep: _currentStep, labels: stepperLabels),
        Expanded(
          child: PageView(
            controller: _pageController,
            physics: const NeverScrollableScrollPhysics(),
            onPageChanged: (i) => setState(() => _currentStep = i),
            children: [
              _buildStep1(addressesAsync, profile),
              _buildStep2(),
              _buildStep3(profile),
              _buildStep4(cartTotal),
            ],
          ),
        ),
        _stepError != null
            ? Padding(
                padding: EdgeInsets.fromLTRB(16.w, 0, 16.w, 8.h),
                child: Text(_stepError!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFFEF4444), fontWeight: FontWeight.w600)),
              )
            : const SizedBox.shrink(),
        _buildBottom(cartTotal),
      ]),
    );
  }

  Widget _buildStep1(AsyncValue<List<AddressModel>> addressesAsync, CustomerProfile? profile) {
    final deliveryTypesAsync = ref.watch(checkoutMetaProvider);

    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        deliveryTypesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          error: (e, _) => Text('Erreur: $e', style: TextStyle(color: const Color(0xFFEF4444), fontSize: 13.sp)),
          data: (meta) => DeliveryTypeSelector(
            types: meta.deliveryTypes,
            selectedId: _selectedDeliveryType?.id,
            onSelected: (type) => setState(() {
              _selectedDeliveryType = type;
              _selectedSlot = null;
              _slots = [];
              if (type.code == 'pickup') _loadPickupNodes();
            }),
          ),
        ),
        SizedBox(height: 20.h),
        if (_selectedDeliveryType?.code == 'home') ...[
          Text('Adresse de livraison *', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
          SizedBox(height: 10.h),
          addressesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
            error: (e, _) => Text('Erreur chargement adresses', style: TextStyle(color: const Color(0xFFEF4444), fontSize: 13.sp)),
            data: (list) {
              if (list.isEmpty) {
                return Container(
                  padding: EdgeInsets.all(16.w),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14.r)),
                  child: Column(children: [
                    Icon(Icons.location_off_outlined, size: 32.sp, color: const Color(0xFFF59E0B)),
                    SizedBox(height: 8.h),
                    Text('Aucune adresse enregistrée', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF92400E))),
                    SizedBox(height: 8.h),
                    GestureDetector(
                      onTap: () async {
                        await context.push('/addresses/new');
                        ref.read(addressesProvider.notifier).load();
                      },
                      child: Container(
                        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                        decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(10.r)),
                        child: Text('Ajouter une adresse', style: TextStyle(color: Colors.white, fontSize: 12.sp, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ]),
                );
              }
              return Column(children: list.map((addr) {
                final sel = _selectedAddress?.id == addr.id;
                return Padding(
                  padding: EdgeInsets.only(bottom: 8.h),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedAddress = addr),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: EdgeInsets.all(14.w),
                      decoration: BoxDecoration(
                        color: sel ? AppTheme.primary.withValues(alpha: 0.06) : Colors.white,
                        borderRadius: BorderRadius.circular(14.r),
                        border: Border.all(color: sel ? AppTheme.primary : const Color(0xFFE5E7EB), width: sel ? 2 : 1),
                      ),
                      child: Row(children: [
                        Container(
                          width: 44.w, height: 44.w,
                          decoration: BoxDecoration(color: sel ? AppTheme.primary : const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12.r)),
                          child: Icon(Icons.location_on_rounded, size: 22.sp, color: sel ? Colors.white : const Color(0xFF6B7280)),
                        ),
                        SizedBox(width: 12.w),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(addr.displayLabel, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827))),
                            SizedBox(height: 2.h),
                            Text(addr.fullAddress, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280)), maxLines: 2, overflow: TextOverflow.ellipsis),
                          ]),
                        ),
                        if (addr.isDefault)
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                            decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8.r)),
                            child: Text('Def', style: TextStyle(fontSize: 9.sp, color: AppTheme.primary, fontWeight: FontWeight.w700)),
                          ),
                      ]),
                    ),
                  ),
                );
              }).toList());
            },
          ),
          SizedBox(height: 8.h),
          GestureDetector(
            onTap: () async {
              await context.push('/addresses/new');
              ref.read(addressesProvider.notifier).load();
            },
            child: Container(
              padding: EdgeInsets.symmetric(vertical: 12.h),
              decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE5E7EB)), borderRadius: BorderRadius.circular(14.r)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.add_rounded, size: 18.sp, color: AppTheme.primary),
                SizedBox(width: 6.w),
                Text('Nouvelle adresse', style: TextStyle(fontSize: 13.sp, color: AppTheme.primary, fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        ],
        if (_selectedDeliveryType?.code == 'pickup') ...[
          Text('Magasin de retrait *', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
          SizedBox(height: 10.h),
          if (_pickupNodesLoading)
            const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          else if (_pickupNodes.isEmpty)
            Container(
              padding: EdgeInsets.all(16.w),
              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(14.r)),
              child: Row(children: [
                Icon(Icons.info_outline_rounded, size: 20.sp, color: const Color(0xFFF59E0B)),
                SizedBox(width: 10.w),
                Expanded(child: Text('Aucun magasin disponible', style: TextStyle(fontSize: 13.sp, color: const Color(0xFF92400E)))),
              ]),
            )
          else if (_pickupNodes.length == 1)
            Container(
              padding: EdgeInsets.all(14.w),
              decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(14.r), border: Border.all(color: AppTheme.success)),
              child: Row(children: [
                Icon(Icons.check_circle_rounded, size: 20.sp, color: AppTheme.success),
                SizedBox(width: 10.w),
                Expanded(
                  child: Text('Magasin sélectionné automatiquement: ${_pickupNodes.first.nameFr}',
                      style: TextStyle(fontSize: 13.sp, color: const Color(0xFF065F46), fontWeight: FontWeight.w500)),
                ),
              ]),
            )
          else
            Column(children: _pickupNodes.map((node) {
              final sel = _selectedPickupNode?.id == node.id;
              return Padding(
                padding: EdgeInsets.only(bottom: 8.h),
                child: GestureDetector(
                  onTap: () => setState(() { _selectedPickupNode = node; _selectedSlot = null; _slots = []; }),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: EdgeInsets.all(14.w),
                    decoration: BoxDecoration(
                      color: sel ? AppTheme.primary.withValues(alpha: 0.06) : Colors.white,
                      borderRadius: BorderRadius.circular(14.r),
                      border: Border.all(color: sel ? AppTheme.primary : const Color(0xFFE5E7EB), width: sel ? 2 : 1),
                    ),
                    child: Row(children: [
                      Icon(Icons.store_rounded, size: 22.sp, color: sel ? AppTheme.primary : const Color(0xFF6B7280)),
                      SizedBox(width: 12.w),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(node.nameFr, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827))),
                          if (node.address != null) Text(node.address!, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280))),
                        ]),
                      ),
                    ]),
                  ),
                ),
              );
            }).toList()),
        ],
      ]),
    );
  }

  Widget _buildStep2() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DateSelector(
          selectedDate: _selectedDate,
          onSelected: (dt) {
            setState(() { _selectedDate = dt; _selectedSlot = null; _slots = []; });
            _loadSlots();
          },
        ),
        SizedBox(height: 20.h),
        DeliverySlotSelector(
          slots: _slots,
          selectedSlotId: _selectedSlot?.id,
          onSelected: (slot) => setState(() => _selectedSlot = slot),
          loading: _slotsLoading,
        ),
      ]),
    );
  }

  Widget _buildStep3(CustomerProfile? profile) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Consumer(builder: (context, ref, _) {
        final metaAsync = ref.watch(checkoutMetaProvider);
        return metaAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.primary)),
          error: (e, _) => Text('Erreur: $e', style: TextStyle(color: const Color(0xFFEF4444), fontSize: 13.sp)),
          data: (meta) {
            final total = ref.watch(cartTotalProvider);
            return PaymentMethodSelector(
              methods: meta.paymentMethods,
              selectedMethodId: _selectedPayment?.id,
              walletBalance: profile?.walletBalance,
              pointsBalance: profile?.pointsBalance,
              totalAmount: total,
              pointsConversionRate: 0.01,
              onSelected: (method) => setState(() => _selectedPayment = method),
            );
          },
        );
      }),
    );
  }

  Widget _buildStep4(double total) {
    final items = ref.watch(cartProvider);
    final subtotal = items.fold(0.0, (s, i) => s + i.product.price * i.qty);

    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CheckoutSummaryCard(
          subtotal: subtotal,
          total: total,
          paymentMethod: _selectedPayment?.nameFr,
          walletUsed: _walletUsed > 0 ? _walletUsed.toStringAsFixed(2) : null,
          pointsUsed: _pointsUsed > 0 ? _pointsUsed.toString() : null,
        ),
        SizedBox(height: 16.h),
        Container(
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16.r)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Récapitulatif', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
            SizedBox(height: 12.h),
            _RecapRow(icon: Icons.local_shipping_rounded, label: 'Livraison', value: _selectedDeliveryType?.nameFr ?? ''),
            if (_selectedDeliveryType?.code == 'home' && _selectedAddress != null)
              _RecapRow(icon: Icons.location_on_rounded, label: 'Adresse', value: _selectedAddress!.fullAddress),
            if (_selectedDeliveryType?.code == 'pickup' && _selectedPickupNode != null)
              _RecapRow(icon: Icons.store_rounded, label: 'Magasin', value: _selectedPickupNode!.nameFr),
            _RecapRow(icon: Icons.calendar_today_rounded, label: 'Date', value: _formatDate(_selectedDate)),
            if (_selectedSlot != null)
              _RecapRow(icon: Icons.schedule_rounded, label: 'Créneau', value: '${_selectedSlot!.nameFr} (${_selectedSlot!.startTime} - ${_selectedSlot!.endTime})'),
            _RecapRow(icon: Icons.payment_rounded, label: 'Paiement', value: _selectedPayment?.nameFr ?? ''),
          ]),
        ),
      ]),
    );
  }

  Widget _buildBottom(double total) {
    final isLastStep = _currentStep == 3;
    return Container(
      padding: EdgeInsets.fromLTRB(16.w, 12.h, 16.w, 28.h),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 16, offset: const Offset(0, -4))],
      ),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Total', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(0xFF6B7280))),
          Text('${total.toStringAsFixed(2)} MAD', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.w800, color: AppTheme.primary)),
        ]),
        SizedBox(height: 12.h),
        GestureDetector(
          onTap: _creating ? null : _nextStep,
          child: Container(
            width: double.infinity, height: 54.h,
            decoration: BoxDecoration(
              gradient: _creating ? null : const LinearGradient(colors: [AppTheme.primary, AppTheme.primaryDark]),
              color: _creating ? const Color(0xFFE5E7EB) : null,
              borderRadius: BorderRadius.circular(16.r),
              boxShadow: _creating ? null : const [BoxShadow(color: Color(0x44DC2626), blurRadius: 16, offset: Offset(0, 6))],
            ),
            child: Center(
              child: _creating
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2.5))
                  : Text(
                      isLastStep ? 'Confirmer la commande' : 'Suivant',
                      style: TextStyle(color: Colors.white, fontSize: 16.sp, fontWeight: FontWeight.w700),
                    ),
            ),
          ),
        ),
      ]),
    );
  }
}

class _StepperBar extends StatelessWidget {
  final int currentStep;
  final List<String> labels;

  const _StepperBar({required this.currentStep, required this.labels});

  @override
  Widget build(BuildContext context) => Container(
    color: Colors.white,
    padding: EdgeInsets.symmetric(vertical: 12.h),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(labels.length, (i) {
        final done = i < currentStep;
        final active = i == currentStep;
        return Row(mainAxisSize: MainAxisSize.min, children: [
          if (i > 0)
            Container(
              width: 24.w, height: 2,
              color: done || active ? AppTheme.primary : const Color(0xFFE5E7EB),
            ),
          SizedBox(width: 4.w),
          Container(
            width: 28.w, height: 28.w,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? AppTheme.primary : (active ? AppTheme.primary : const Color(0xFFF3F4F6)),
            ),
            child: Center(
              child: done
                  ? Icon(Icons.check_rounded, size: 14.sp, color: Colors.white)
                  : Text('${i + 1}', style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w700, color: active ? Colors.white : const Color(0xFF9CA3AF))),
            ),
          ),
          SizedBox(width: 4.w),
        ]);
      }),
    ),
  );
}

class _RecapRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _RecapRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 8.h),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 16.sp, color: const Color(0xFF6B7280)),
      SizedBox(width: 8.w),
      SizedBox(width: 80.w, child: Text(label, style: TextStyle(fontSize: 12.sp, color: const Color(0xFF6B7280)))),
      Expanded(child: Text(value, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600, color: const Color(0xFF111827)))),
    ]),
  );
}
