import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular, Poppins_500Medium,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import PageHeader from '../../components/ui/PageHeader';
import CheckoutStepper from '../../components/ui/CheckoutStepper';
import {
  getMeta, createOrder, calculateOrder,
  PaymentMethod, DeliveryType, CartItem, OrderCalculation,
} from '../../services/order.service';
import { ProfileService } from '../../services/profile.service';
import { CartService } from '../../services/cart.service';
import { CouponsService } from '../../services/coupons.service';
import { useCartActions } from '../../context/CartContext';

const RED = '#E10600';

const METHOD_ICON: Record<string, string> = {
  card:   'credit-card',
  cash:   'dollar-sign',
  cod:    'dollar-sign',
  wallet: 'pocket',
};

const METHOD_DESC: Record<string, string> = {
  card:   'Payez en ligne par carte',
  cash:   'Payez en espèces à la livraison',
  cod:    'Payez en espèces à la livraison',
  wallet: 'Utilisez votre solde Wallet',
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    delivery_type_code: string;
    node_id?:    string;
    node_name?:  string;
    address_id?: string;
    cart_items?: string;
    date?:       string;
    slot_id?:    string;
    slot_start?: string;
    slot_end?:   string;
  }>();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  const [methods,      setMethods]      = useState<PaymentMethod[]>([]);
  const [selected,     setSelected]     = useState<PaymentMethod | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [calculation,  setCalculation]  = useState<OrderCalculation | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet,    setUseWallet]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [confirming,   setConfirming]   = useState(false);
  const [calcError,    setCalcError]    = useState<string | null>(null);
  const [couponInput,  setCouponInput]  = useState('');
  const [appliedCode,  setAppliedCode]  = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg,    setCouponMsg]    = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { applyCart } = useCartActions();

  const cartItems: CartItem[] = params.cart_items ? JSON.parse(params.cart_items) : [];
  const total      = calculation?.total_ttc ?? 0;
  const isCard     = selected?.code.toLowerCase() === 'card';
  const walletUsed = (isCard && useWallet) ? Math.min(walletBalance, total) : 0;
  const cardAmount = total - walletUsed;

  // ── Calcul serveur — envoie toujours le wallet_used courant, pour que
  //    le total affiché (calculation.total_ttc / calculation.wallet_used)
  //    reste cohérent avec ce qui sera réellement envoyé à createOrder().
  const runCalculate = (promoCode?: string | null, walletAmount?: number) => {
    if (!params.node_id) return;
    calculateOrder({
      node_id:            params.node_id,
      delivery_type_code: params.delivery_type_code,
      cart_items:         cartItems,
      promo_code:         promoCode ?? undefined,
      wallet_used:        walletAmount && walletAmount > 0 ? walletAmount : undefined,
    })
      .then(c => {
      console.log('[runCalculate] réponse ←', JSON.stringify(c, null, 2));
      setCalculation(c);
      setCalcError(null);
    })
      .catch(e => setCalcError(e?.message ?? 'Erreur de calcul'));
  };

  const applyCoupon = async (code: string, subtotal?: number, deliveryFee?: number) => {
    if (!code || couponLoading) return;
    setCouponInput(code);
    setCouponLoading(true);
    setCouponMsg(null);
    try {
      const res = await CouponsService.validateCode(
        code,
        subtotal ?? calculation?.subtotal_ttc ?? 0,
        deliveryFee ?? calculation?.delivery_fee ?? 0,
      );
      setAppliedCode(res.code);
      setCouponMsg({ type: 'success', text: res.warning ?? res.message });
      runCalculate(res.code, walletUsed);
    } catch (e: any) {
      setCouponMsg({ type: 'error', text: e.message ?? 'Code promo invalide' });
    } finally {
      setCouponLoading(false);
    }
  };

  useEffect(() => {
    getMeta(params.node_id)
      .then(meta => {
        setMethods(meta.payment_methods ?? []);
        const dt = (meta.delivery_types ?? []).find(d => d.code === params.delivery_type_code);
        setDeliveryType(dt ?? null);
      })
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));

    if (params.node_id) {
      calculateOrder({
        node_id:            params.node_id,
        delivery_type_code: params.delivery_type_code,
        cart_items:         cartItems,
      })
        .then(async c => {
          setCalculation(c);
          setCalcError(null);
          const pending = await SecureStore.getItemAsync('pending_coupon_code');
          if (pending) {
            await SecureStore.deleteItemAsync('pending_coupon_code');
            applyCoupon(pending, c.subtotal_ttc, c.delivery_fee);
          }
        })
        .catch(e => setCalcError(e?.message ?? 'Erreur de calcul'));
    }

    ProfileService.getWallet()
      .then(w => setWalletBalance(Number(w.balance ?? 0)))
      .catch(() => {});
  }, []);

  // ── Reset du toggle wallet si la méthode sélectionnée n'est plus "carte"
  //    (évite un state useWallet=true "fantôme" pour une méthode qui n'affiche
  //    même plus le toggle à l'écran).
  useEffect(() => {
    if (!isCard && useWallet) {
      setUseWallet(false);
    }
  }, [isCard]);

  // ── Resynchronise le calcul serveur à chaque changement de méthode ou de
  //    toggle wallet, pour que le récap (et le total affiché) reflète
  //    toujours ce qui sera réellement envoyé à createOrder().
  useEffect(() => {
    if (!calculation) return; // pas encore de calcul initial disponible
    const nextWalletUsed = (isCard && useWallet) ? Math.min(walletBalance, calculation.total_ttc) : 0;
    runCalculate(appliedCode, nextWalletUsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, useWallet]);

  const handleApplyCoupon = () => applyCoupon(couponInput.trim().toUpperCase());

  const handleRemoveCoupon = () => {
    setAppliedCode(null);
    setCouponInput('');
    setCouponMsg(null);
    runCalculate(null, walletUsed);
  };

  if (!fontsLoaded) return null;

  const handleConfirm = async () => {
    if (!selected || confirming) return;

    if (isCard) {
      router.push({
        pathname: '/order/card_payment' as any,
        params: {
          ...params,
          payment_method_code: selected.code,
          card_amount:         String(cardAmount),
          wallet_amount:       String(walletUsed),
          promo_code:          appliedCode ?? '',
        },
      });
      return;
    }

    setConfirming(true);
    try {
      const order = await createOrder({
        cart_items:          cartItems,
        delivery_type_code:  params.delivery_type_code,
        node_id:             params.node_id,
        address_id:          params.address_id,
        slot_id:             params.slot_id,
        payment_method_code: selected.code,
        wallet_used:         walletUsed > 0 ? walletUsed : undefined,
        promo_code:          appliedCode ?? undefined,
      });
      const cart = await CartService.clearCart();
      applyCart(cart);
      router.replace({ pathname: '/order/confirmed' as any, params: { reference: order.reference } });
    } catch (e: any) {
      if ((e?.message ?? '').includes('Stock insuffisant')) return;
      Alert.alert('Erreur', e.message ?? 'Erreur lors de la confirmation');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>
        <PageHeader title="Paiement" />
        <CheckoutStepper currentStep={3} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

          {/* ── Erreur montant minimum ── */}
          {calcError && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorBannerText}>{calcError}</Text>
            </View>
          )}

          {/* ── Titre section ── */}
          <Text style={styles.pageTitle}>Paiement</Text>
          <Text style={styles.pageSubtitle}>
            Choisissez votre méthode de paiement préférée pour finaliser la commande.
          </Text>

          {/* ── Méthodes de paiement ── */}
          <Text style={styles.sectionTitle}>Méthodes de paiement</Text>
          {loading ? (
            <ActivityIndicator color={RED} style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.methodsCard}>
              {methods.map((method, index) => {
                const code   = method.code?.toLowerCase();
                const icon   = METHOD_ICON[code] ?? 'credit-card';
                const desc   = METHOD_DESC[code] ?? '';
                const active = selected?.id === method.id;
                const isLast = index === methods.length - 1;
                return (
                  <View key={method.id}>
                    <TouchableOpacity
                      style={[styles.methodRow, active && styles.methodRowActive]}
                      onPress={() => setSelected(method)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.methodIconWrap, active && styles.methodIconWrapActive]}>
                        <Feather name={icon as any} size={20} color={active ? '#fff' : '#6B7280'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodName, active && styles.methodNameActive]}>
                          {method.name_fr}
                        </Text>
                        {!!desc && <Text style={styles.methodSubtitle}>{desc}</Text>}
                      </View>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                    {!isLast && <View style={styles.divider} />}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Paiement mixte : toggle wallet ── */}
          {isCard && walletBalance > 0 && (
            <TouchableOpacity
              style={[styles.walletToggle, useWallet && styles.walletToggleActive]}
              onPress={() => setUseWallet(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.walletToggleIcon, useWallet && styles.walletToggleIconActive]}>
                <Feather name="pocket" size={18} color={useWallet ? '#fff' : '#6B7280'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.walletToggleTitle, useWallet && styles.walletToggleTitleActive]}>
                  Utiliser mon wallet
                </Text>
                <Text style={styles.walletToggleSub}>
                  Solde disponible : {walletBalance.toFixed(2)} DH
                </Text>
              </View>
              {useWallet && (
                <View style={styles.walletDeductBadge}>
                  <Text style={styles.walletDeductText}>−{walletUsed.toFixed(2)} DH</Text>
                </View>
              )}
              <View style={[styles.walletCheckbox, useWallet && styles.walletCheckboxActive]}>
                {useWallet && <Feather name="check" size={13} color="#fff" />}
              </View>
            </TouchableOpacity>
          )}

          {/* ── Code promo ── */}
          <Text style={styles.sectionTitle}>Code promo</Text>
          <View style={styles.couponCard}>
            {appliedCode ? (
              <View style={styles.couponAppliedRow}>
                <View style={styles.couponAppliedIcon}>
                  <Feather name="tag" size={16} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.couponAppliedCode}>{appliedCode}</Text>
                  <Text style={styles.couponAppliedSub}>Code promo appliqué</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveCoupon} hitSlop={8}>
                  <Feather name="x" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.couponInputRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Entrez votre code"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={couponInput}
                  onChangeText={(v) => { setCouponInput(v); setCouponMsg(null); }}
                  editable={!couponLoading}
                />
                <TouchableOpacity
                  style={[styles.couponApplyBtn, (!couponInput.trim() || couponLoading) && styles.couponApplyBtnDisabled]}
                  onPress={handleApplyCoupon}
                  disabled={!couponInput.trim() || couponLoading}
                  activeOpacity={0.85}
                >
                  {couponLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.couponApplyText}>Appliquer</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
            {couponMsg && (
              <Text style={[styles.couponMsg, couponMsg.type === 'error' && styles.couponMsgError]}>
                {couponMsg.text}
              </Text>
            )}
          </View>

          {/* ── Récapitulatif ── */}
          {calculation && (
            <>
              <Text style={styles.sectionTitle}>Récapitulatif</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Sous-total</Text>
                  <Text style={styles.summaryValue}>{calculation.subtotal_ttc.toFixed(2)} DH</Text>
                </View>
                {params.delivery_type_code !== 'pickup' && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Frais de livraison</Text>
                    <Text style={styles.summaryValue}>
                      {calculation.delivery_fee > 0 ? `${calculation.delivery_fee.toFixed(2)} DH` : 'Gratuit'}
                    </Text>
                  </View>
                )}
                {calculation.discount_amount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Réduction{appliedCode ? ` (${appliedCode})` : ''}</Text>
                    <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
                      -{calculation.discount_amount.toFixed(2)} DH
                    </Text>
                  </View>
                )}
                {calculation.wallet_used > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Wallet utilisé</Text>
                    <Text style={[styles.summaryValue, { color: '#22C55E' }]}>
                      -{calculation.wallet_used.toFixed(2)} DH
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {isCard && useWallet && walletUsed > 0 ? 'À payer par carte' : 'Total à payer'}
            </Text>
            <Text style={styles.totalAmount}>
              {calculation ? `${(isCard && useWallet ? cardAmount : total).toFixed(2)} DH` : '...'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.btnConfirm, (!selected || confirming || !!calcError) && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!selected || confirming || !!calcError}
            activeOpacity={0.85}
          >
            {confirming
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.btnText, (!selected || !!calcError) && styles.btnTextDisabled]}>
                  Confirmer le paiement
                </Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 12 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 16,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#DC2626', lineHeight: 18 },

  pageTitle:    { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#1a1a1a', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginBottom: 20, lineHeight: 20 },

  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 12, marginTop: 4 },

  methodsCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 18,
  },
  methodRowActive: { backgroundColor: '#FFF8F8' },
  methodIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  methodIconWrapActive: { backgroundColor: RED },
  methodName:       { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  methodNameActive: { color: RED },
  methodSubtitle:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },

  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: RED },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: RED },

  divider: { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 16 },

  // Code promo
  couponCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  couponInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  couponInput: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter_500Medium', color: '#1a1a1a',
    backgroundColor: '#FAFAFA',
  },
  couponApplyBtn: {
    height: 44, paddingHorizontal: 18, borderRadius: 12,
    backgroundColor: RED, alignItems: 'center', justifyContent: 'center',
  },
  couponApplyBtnDisabled: { backgroundColor: '#E5E7EB' },
  couponApplyText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  couponAppliedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  couponAppliedIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#DCFCE7',
    alignItems: 'center', justifyContent: 'center',
  },
  couponAppliedCode: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#1a1a1a', letterSpacing: 0.5 },
  couponAppliedSub:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 1 },
  couponMsg:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#16A34A', marginTop: 10 },
  couponMsgError: { color: '#DC2626' },

  // Récapitulatif
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#F0F0F0', gap: 10,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B7280' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },

  // Footer
  footer: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 20,
    left: 16, right: 16, gap: 12,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  totalLabel:  { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  totalAmount: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },

  // Wallet toggle
  walletToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  walletToggleActive: { borderColor: RED, backgroundColor: '#FFF8F8' },
  walletToggleIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  walletToggleIconActive: { backgroundColor: RED },
  walletToggleTitle:       { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1a1a1a' },
  walletToggleTitleActive: { color: RED },
  walletToggleSub:         { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  walletDeductBadge: {
    backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  walletDeductText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#16A34A' },
  walletCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  walletCheckboxActive: { backgroundColor: RED, borderColor: RED },

  btnConfirm: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5,
  },
  btnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowColor: 'transparent', elevation: 0,
  },
  btnText:         { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  btnTextDisabled: { color: '#9CA3AF' },
});