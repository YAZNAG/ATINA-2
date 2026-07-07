import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_600SemiBold, Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ProfileService, Order } from '../../services/profile.service';
import PageHeader from '../../components/ui/PageHeader';
import { Alert } from 'react-native'; // déjà importé si tu l'as
import { CartService } from '../../services/cart.service';

const RED  = '#E10600';
const GRAY = '#9CA3AF';
const INK  = '#1A1A1A';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function deliveryLabel(code: string): string {
  if (code === 'pickup') return 'Retrait en magasin';
  return 'Livraison à domicile';
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionIconBox}>
        <Feather name={icon as any} size={14} color={RED} />
      </View>
      <Text style={styles.sectionTitleText}>{label}</Text>
    </View>
  );
}

// ── Ligne info ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Feather name="minus" size={12} color="#D1D5DB" style={{ marginTop: 3 }} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Produit ───────────────────────────────────────────────────────────────────

function ProductRow({ item }: { item: Order['items'][0] }) {
  return (
    <View style={styles.productRow}>
      <View style={styles.productImgWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.productImg} resizeMode="cover" />
        ) : (
          <Feather name="package" size={20} color="#D1D5DB" />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name_fr}</Text>
        <Text style={styles.productUnit}>
          {item.unit_price.toFixed(2)} MAD / unité
        </Text>
      </View>

      <View style={styles.productRight}>
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyText}>×{item.qty}</Text>
        </View>
        <Text style={styles.productTotal}>{item.total_ttc.toFixed(2)} MAD</Text>
      </View>
    </View>
  );
}

// ── Ligne résumé paiement ─────────────────────────────────────────────────────

function PayRow({ label, value, bold, red }: { label: string; value: string; bold?: boolean; red?: boolean }) {
  return (
    <View style={styles.payRow}>
      <Text style={[styles.payLabel, bold && styles.payLabelBold]}>{label}</Text>
      <Text style={[styles.payValue, bold && styles.payValueBold, red && { color: RED }]}>{value}</Text>
    </View>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  const [reordering, setReordering] = useState(false);

const performReorder = async (mode: 'merge' | 'replace') => {
  setReordering(true);
  try {
    await CartService.reorder(order!.id, mode);
    router.push('/main/cart' as any);
  } catch (e: any) {
    Alert.alert('Erreur', e.message ?? "Impossible d'ajouter les articles au panier");
  } finally {
    setReordering(false);
  }
};

const handleReorder = async () => {
  try {
    const currentCart = await CartService.getCart();
    if (currentCart.count > 0) {
      Alert.alert(
        'Panier non vide',
        'Votre panier contient déjà des articles. Que voulez-vous faire ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Fusionner', onPress: () => performReorder('merge') },
          { text: 'Remplacer', style: 'destructive', onPress: () => performReorder('replace') },
        ]
      );
    } else {
      performReorder('merge');
    }
  } catch (e: any) {
    Alert.alert('Erreur', e.message ?? 'Impossible de vérifier le panier');
  }
};

  useEffect(() => {
    if (!id) return;
    ProfileService.getOrderById(id)
      .then(setOrder)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={RED} /></View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color="#E0E0E0" />
          <Text style={styles.errorText}>{error ?? 'Commande introuvable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const subtotal  = order.items.reduce((s, i) => s + i.total_ttc, 0);
  const discount  = 0; // à adapter si tu as discount_amount dans Order

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <PageHeader title="Historique des commandes" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Titre commande */}
        <Text style={styles.orderRef}>Commande #{order.reference}</Text>

        {/* ── Informations de commande ── */}
        <SectionCard>
          <SectionTitle icon="file-text" label="INFORMATIONS DE COMMANDE" />
          <View style={styles.infoList}>
            <InfoRow label="Numéro"          value={order.reference} />
            <InfoRow label="Date"             value={formatDate(order.created_at)} />
            <InfoRow label="Mode de livraison" value={deliveryLabel(order.delivery_type)} />
            {order.delivery_type === 'pickup' && order.node_name && (
              <InfoRow label="Magasin" value={order.node_name} />
              )}
              {order.delivery_type !== 'pickup' && order.address_full && (
                <InfoRow label="Adresse" value={order.address_full} />
                )}
          </View>
        </SectionCard>

        {/* ── Produits commandés ── */}
        <SectionCard>
          <View style={styles.productsTitleRow}>
            <Text style={styles.productsSectionTitle}>
              Produits commandés ({order.items.length})
            </Text>
          </View>
          {order.items.map(item => (
            <ProductRow key={item.id} item={item} />
          ))}
        </SectionCard>

        {/* ── Résumé de paiement ── */}
        <SectionCard>
          <SectionTitle   icon="file-text" label="RÉSUMÉ DE PAIEMENT" />
          <View style={styles.payList}>
            <PayRow label="Sous-total"         value={`${subtotal.toFixed(2)} MAD`} />
            <PayRow label="Frais de livraison" value={order.delivery_fee > 0 ? `${order.delivery_fee.toFixed(2)} MAD` : 'Gratuit'} />
            {order.wallet_used > 0 && (
              <PayRow label="Wallet utilisé" value={`-${order.wallet_used.toFixed(2)} MAD`} />
            )}
            {discount > 0 && (
              <PayRow label="Réduction" value={`-${discount.toFixed(2)} MAD`} red />
            )}
            <View style={styles.payDivider} />
            <PayRow label="TOTAL" value={`${order.total_ttc.toFixed(2)} MAD`} bold red />
          </View>
        </SectionCard>

        {/* ── Paiement info ── */}
{order.payment_method_name && (
  <SectionCard>
    <SectionTitle icon="credit-card" label="PAIEMENT" />
    <View style={styles.infoList}>
      <InfoRow label="Méthode"  value={order.payment_method_name} />
      <InfoRow label="Statut"   value={order.payment_status_label} />
    </View>
  </SectionCard>
)}

        {/* ── Boutons ── */}
        <View style={styles.actions}>
          <TouchableOpacity
  style={[styles.btnRed, reordering && { opacity: 0.6 }]}
  onPress={handleReorder}
  disabled={reordering}
  activeOpacity={0.85}
>
  {reordering
    ? <ActivityIndicator color="#fff" />
    : <>
        <Feather name="refresh-cw" size={16} color="#fff" />
        <Text style={styles.btnRedText}>Commander à nouveau</Text>
      </>
  }
</TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => router.replace('/main/home' as any)}
            activeOpacity={0.85}
          >
            <Feather name="home" size={16} color={INK} />
            <Text style={styles.btnOutlineText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#ffffff' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: GRAY, marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 14 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  orderRef: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: INK , marginBottom: 14 },

  // Section card
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14},
  sectionIconBox:  { width: 26, height: 26, borderRadius: 8, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  sectionTitleText:{ fontSize: 12, fontFamily: 'Inter_700Bold', color: INK, letterSpacing: 0.5 },

  // Info rows
  infoList: { gap: 8 },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLabel:{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  infoValue:{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: INK, textAlign: 'right', maxWidth: '55%' },

  // Products
  productsTitleRow:    { marginBottom: 14 },
  productsSectionTitle:{ fontSize: 14, fontFamily: 'Inter_700Bold', color: INK },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  productImgWrap: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  productImg: { width: '100%', height: '100%', borderRadius: 12 },
  productInfo:  { flex: 1 },
  productName:  { fontSize: 13.5, fontFamily: 'Inter_600SemiBold', color: INK, lineHeight: 18, marginBottom: 3 },
  productUnit:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY },
  productRight: { alignItems: 'flex-end', gap: 6 },
  qtyBadge: {
    backgroundColor: '#FFF0F0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  qtyText:      { fontSize: 13, fontFamily: 'Inter_700Bold', color: RED },
  productTotal: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: INK },

  // Payment
  payList:   { gap: 10 },
  payRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  payLabelBold: { fontFamily: 'Inter_700Bold', color: INK, fontSize: 14 },
  payValue:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: INK },
  payValueBold: { fontSize: 16, fontFamily: 'Poppins_700Bold' },
  payDivider:{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },

  // Actions
  actions: { gap: 12, marginTop: 4 },
  btnRed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 14, paddingVertical: 16,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  btnRedText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 15,
    backgroundColor: '#fff',
  },
  btnOutlineText: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
});