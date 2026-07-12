import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { createOrder, CartItem } from '../../services/order.service';
import { CartService } from '../../services/cart.service';
import { useCartActions } from '../../context/CartContext';

const RED = '#E10600';

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trimEnd();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// Construit l'affichage masqué groupé par paquets de 4, en gardant
// les groupes déjà tapés en clair sauf si tu veux les masquer totalement.
// Ici on masque TOUT sauf qu'on garde le nombre de groupes tapés (style maquette : **** **** **** ****)
function maskedCardDisplay(digits: string): string {
  const groups = [];
  const totalGroups = 4;
  const typedGroups = Math.ceil(digits.length / 4) || 0;
  for (let i = 0; i < totalGroups; i++) {
    if (i < typedGroups) {
      const groupLen = Math.min(4, digits.length - i * 4);
      groups.push('*'.repeat(groupLen));
    } else {
      groups.push('••••');
    }
  }
  return groups.join('  ');
}

export default function CardPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    delivery_type_code:  string;
    node_id?:            string;
    address_id?:         string;
    cart_items?:         string;
    slot_id?:            string;
    payment_method_code: string;
    card_amount:         string;
    wallet_amount:       string;
    promo_code?:         string;
  }>();

  const cardAmount   = parseFloat(params.card_amount   ?? '0');
  const walletAmount = parseFloat(params.wallet_amount ?? '0');
  const cartItems: CartItem[] = params.cart_items ? JSON.parse(params.cart_items) : [];

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium,
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold,
  });

  const [cardNumber,  setCardNumber]  = useState('');
  const [holder,      setHolder]      = useState('');
  const [expiry,      setExpiry]      = useState('');
  const [cvv,         setCvv]         = useState('');
  const [cvvHidden,   setCvvHidden]   = useState(true);
  const [confirming,  setConfirming]  = useState(false);
  const { applyCart } = useCartActions();

  const digitsOnly    = cardNumber.replace(/\s/g, '');
  const isFormValid   = digitsOnly.length === 16 && holder.trim().length >= 2 && expiry.length === 5 && cvv.length >= 3;

  if (!fontsLoaded) return null;

  const handleConfirm = async () => {
    if (!isFormValid || confirming) return;
    setConfirming(true);
    try {
      const order = await createOrder({
        cart_items:          cartItems,
        delivery_type_code:  params.delivery_type_code,
        node_id:             params.node_id,
        address_id:          params.address_id,
        slot_id:             params.slot_id,
        payment_method_code: params.payment_method_code ?? 'card',
        wallet_amount:       walletAmount > 0 ? walletAmount : undefined,
        promo_code:          params.promo_code || undefined,
      });
      const cart = await CartService.clearCart();
      applyCart(cart);
      if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace({ pathname: '/order/confirmed' as any, params: { reference: order.reference } });
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Erreur lors du paiement');
    } finally {
      setConfirming(false);
    }
  };

  const displayedNumber = digitsOnly.length > 0 ? maskedCardDisplay(digitsOnly) : '••••  ••••  ••••  ••••';
  const displayedHolder = holder.trim().length > 0 ? holder.toUpperCase() : 'NOM PRENOM';
  const displayedExpiry = expiry.length > 0 ? expiry : 'MM/YY';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <PageHeader title="Paiement" />
          <CheckoutStepper currentStep={3} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>

            {/* ── Carte visuelle (100% code, sans image) ── */}
            <LinearGradient
              colors={['#FF3B30', '#B30000', '#5C0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardVisual}
            >
              {/* Puce dorée */}
              <LinearGradient
                colors={['#F5D88A', '#C9941F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chip}
              />

              {/* VISA logo en haut à droite */}
              <Text style={styles.visaLogo}>VISA</Text>

              {/* Numéro masqué live, centré verticalement */}
              <Text style={styles.cardNumberOverlay}>{displayedNumber}</Text>

              {/* Bas de carte : Titulaire à gauche, Expire à droite */}
              <View style={styles.cardBottomRow}>
                <View>
                  <Text style={styles.cardSmallLabel}>TITULAIRE</Text>
                  <Text style={styles.cardHolderValue}>{displayedHolder}</Text>
                </View>
                <View>
                  <Text style={styles.cardSmallLabel}>EXPIRE</Text>
                  <Text style={styles.cardHolderValue}>{displayedExpiry}</Text>
                </View>
              </View>
            </LinearGradient>

            {walletAmount > 0 && (
              <View style={styles.walletBadge}>
                <Feather name="pocket" size={13} color="#16A34A" />
                <Text style={styles.walletBadgeText}>
                  {walletAmount.toFixed(2)} DH déduits depuis votre wallet
                </Text>
              </View>
            )}

            {/* ── Formulaire carte ── */}

            {/* Nom sur la carte */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>NOM SUR LA CARTE</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="EX: MOHAMED ALAMI"
                  placeholderTextColor="#D1D5DB"
                  autoCapitalize="characters"
                  value={holder}
                  onChangeText={setHolder}
                />
              </View>
            </View>

            {/* Numéro de carte */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>NUMÉRO DE CARTE</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="numeric"
                  value={cardNumber}
                  onChangeText={t => setCardNumber(formatCardNumber(t))}
                  maxLength={19}
                />
                <Feather name="credit-card" size={18} color="#9CA3AF" />
              </View>
            </View>

            {/* Expiry + CVV */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>EXPIRE</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/AA"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                    value={expiry}
                    onChangeText={t => setExpiry(formatExpiry(t))}
                    maxLength={5}
                  />
                </View>
              </View>

              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>CVV</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="•••"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                    secureTextEntry={cvvHidden}
                    value={cvv}
                    onChangeText={t => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                  />
                  <TouchableOpacity onPress={() => setCvvHidden(v => !v)} style={styles.eyeBtn}>
                    <Feather name={cvvHidden ? 'eye' : 'eye-off'} size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Total à payer */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total à payer</Text>
              <Text style={styles.totalValue}>{cardAmount.toFixed(0)} DH</Text>
            </View>

            {/* Sécurité */}
            <View style={styles.secureRow}>
              <Feather name="shield" size={14} color="#9CA3AF" />
              <Text style={styles.secureText}>Paiement sécurisé — vos données sont chiffrées</Text>
            </View>

          </ScrollView>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btnConfirm, (!isFormValid || confirming) && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!isFormValid || confirming}
              activeOpacity={0.85}
            >
              {confirming ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.btnText, !isFormValid && styles.btnTextDisabled]}>
                  Payer maintenant
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12 },

  cardVisual: {
    borderRadius: 20, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
    height: 200, padding: 0,
  },

  chip: {
    position: 'absolute', top: 22, left: 24,
    width: 42, height: 32, borderRadius: 6,
  },

  visaLogo: {
    position: 'absolute', top: 20, right: 24,
    fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff',
    fontStyle: 'italic',
  },

  cardNumberOverlay: {
    position: 'absolute', left: 24, top: '48%',
    fontSize: 19, fontFamily: 'Inter_600SemiBold', color: '#fff',
    letterSpacing: 2,
  },

  cardBottomRow: {
    position: 'absolute', bottom: 18, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  cardSmallLabel: {
    fontSize: 9, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5, marginBottom: 2,
  },
  cardHolderValue: {
    fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff', letterSpacing: 0.5,
  },

  walletBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  walletBadgeText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#16A34A' },

  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#1a1a1a', marginBottom: 8, letterSpacing: 0.3 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, height: 52,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular',
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  eyeBtn: { padding: 4 },

  rowFields: { flexDirection: 'row', gap: 12 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, marginBottom: 16,
  },
  totalLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  totalValue: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#1a1a1a' },

  secureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, justifyContent: 'center',
  },
  secureText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },

  footer: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 20,
    left: 16, right: 16,
  },
  btnConfirm: {
    backgroundColor: RED, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5,
  },
  btnDisabled:     { backgroundColor: '#E5E7EB', shadowColor: 'transparent', elevation: 0 },
  btnText:         { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  btnTextDisabled: { color: '#9CA3AF' },
});