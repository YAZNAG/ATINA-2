import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Platform, Modal,
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
import { Alert } from 'react-native'; 
import { CartService } from '../../services/cart.service';

const RED  = '#E10600';
const GRAY = '#9CA3AF';
const INK  = '#1A1A1A';

//helpers
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function deliveryLabel(code: string): string {
  if (code === 'pickup') return 'Retrait en magasin';
  return 'Livraison à domicile';
}

//Section card 

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

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}>
        <Feather name={icon as any} size={13} color={GRAY} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}


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

// resume paiement

function PayRow({ label, value, bold, red }: { label: string; value: string; bold?: boolean; red?: boolean }) {
  return (
    <View style={styles.payRow}>
      <Text style={[styles.payLabel, bold && styles.payLabelBold]}>{label}</Text>
      <Text style={[styles.payValue, bold && styles.payValueBold, red && { color: RED }]}>{value}</Text>
    </View>
  );
}

// ── Modal de confirmation "panier non vide" (remplace Alert.alert) ──
function ReorderModal({
  visible, onMerge, onReplace, onCancel,
}: {
  visible:   boolean;
  onMerge:   () => void;
  onReplace: () => void;
  onCancel:  () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconBox}>
            <Feather name="shopping-cart" size={22} color={RED} />
          </View>
          <Text style={styles.modalTitle}>Panier non vide</Text>
          <Text style={styles.modalSubtitle}>
            Votre panier contient déjà des articles. Que voulez-vous faire avec cette commande ?
          </Text>

          <TouchableOpacity style={styles.btnMerge} onPress={onMerge} activeOpacity={0.85}>
            <Feather name="git-merge" size={16} color="#fff" />
            <Text style={styles.btnMergeText}>Fusionner avec le panier</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnReplaceModal} onPress={onReplace} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={16} color={RED} />
            <Text style={styles.btnReplaceModalText}>Remplacer le panier</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnCancelModal} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.btnCancelModalText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

//  Page 

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
  const [reorderModalVisible, setReorderModalVisible] = useState(false);

const performReorder = async (mode: 'merge' | 'replace') => {
  setReorderModalVisible(false);
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
      setReorderModalVisible(true);
    } else {
      performReorder('merge');
    }
  } catch (e: any) {
    Alert.alert('Erreur', e.message ?? 'Impossible de vérifier le panier');
  }
};

  const handleTrackOrder = () => {
    if (!order) return;
    router.push({ pathname: '/order/order_suivie' as any, params: { id: order.id } });
  };

  const handleViewSubstitutions = () => {
  if (!order) return;
  router.push({ pathname: '/order/substitution' as any, params: { order_id: order.id } });
};

  useEffect(() => {
  if (!id) return;
  ProfileService.getOrderById(id)
    .then(data => {
      setOrder(data);
      console.log(JSON.stringify(data, null, 2)); // log la vraie donnée reçue
    })
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
  const discount   = order.discount_amount ?? 0;
  const couponCode = order.coupon_code ?? null;

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
            <InfoRow icon="hash"     label="Numéro"          value={order.reference} />
            <InfoRow icon="calendar" label="Date"             value={formatDate(order.created_at)} />
            <InfoRow icon="truck"    label="Mode de livraison" value={deliveryLabel(order.delivery_type)} />
            {order.delivery_type === 'pickup' && order.node_name && (
              <InfoRow icon="map-pin" label="Magasin" value={order.node_name} />
              )}
              {order.delivery_type !== 'pickup' && order.address_full && (
                <InfoRow icon="map-pin" label="Adresse" value={order.address_full} />
                )}
          </View>
        </SectionCard>

        {/* ── Produits commandés ── */}
        <SectionCard>
          <View style={styles.productsTitleRow}>
            <Text style={styles.productsSectionTitle}>
              Produits commandés <Text style={styles.productsCount}>({order.items.length})</Text>
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
  <View style={styles.couponRow}>
    <View style={styles.couponBadge}>
      <Feather name="tag" size={11} color="#059669" />
      <Text style={styles.couponCode}>{couponCode ?? 'Code promo'}</Text>
    </View>
    <Text style={styles.couponAmount}>-{discount.toFixed(2)} MAD</Text>
  </View>
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
      <InfoRow icon="credit-card" label="Méthode"  value={order.payment_method_name} />
      <InfoRow icon="check-circle" label="Statut"   value={order.payment_status_label} />
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
            style={styles.btnTrack}
            onPress={handleTrackOrder}
            activeOpacity={0.85}
          >
            <Feather name="map-pin" size={16} color={RED} />
            <Text style={styles.btnTrackText}>Suivre ma commande</Text>
          </TouchableOpacity>
          
          {order.has_pending_substitution && (
  <TouchableOpacity onPress={handleViewSubstitutions}>
    <Text>Voir les substitutions</Text>
  </TouchableOpacity>
)}

          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => router.replace('/main/main_nav/home' as any)}
            activeOpacity={0.85}
          >
            <Feather name="home" size={16} color={INK} />
            <Text style={styles.btnOutlineText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <ReorderModal
        visible={reorderModalVisible}
        onMerge={() => performReorder('merge')}
        onReplace={() => performReorder('replace')}
        onCancel={() => setReorderModalVisible(false)}
      />
    </SafeAreaView>
  );
}

//=Styles 

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#ffffff' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: GRAY, marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 14 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  orderRef: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: INK , marginBottom: 16 },

  // Section card
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 18,
    padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16},
  sectionIconBox:  { width: 26, height: 26, borderRadius: 8, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  sectionTitleText:{ fontSize: 12, fontFamily: 'Inter_700Bold', color: RED, letterSpacing: 0.5 },

  // Info rows
  infoList: { gap: 14 },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIconBox: {
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
  },
  infoLabel:{ flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY },
  infoValue:{ fontSize: 14, fontFamily: 'Inter_700Bold', color: INK, textAlign: 'right', maxWidth: '55%' },

  // Products
  productsTitleRow:    { marginBottom: 16 },
  productsSectionTitle:{ fontSize: 15, fontFamily: 'Inter_700Bold', color: INK },
  productsCount:        { fontSize: 15, fontFamily: 'Inter_400Regular', color: GRAY },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  productImgWrap: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  productImg: { width: '100%', height: '100%' },
  productInfo:  { flex: 1 },
  productName:  { fontSize: 14, fontFamily: 'Inter_700Bold', color: INK, lineHeight: 19, marginBottom: 3 },
  productUnit:  { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: GRAY },
  productRight: { alignItems: 'flex-end', gap: 8 },
  qtyBadge: {
    backgroundColor: '#FFF0F0', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  qtyText:      { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: RED },
  productTotal: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: RED },

  // Payment
  payList:   { gap: 12 },
  payRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel:  { fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY },
  payLabelBold: { fontFamily: 'Inter_700Bold', color: INK, fontSize: 15 },
  payValue:  { fontSize: 14, fontFamily: 'Inter_700Bold', color: INK },
  payValueBold: { fontSize: 20, fontFamily: 'Poppins_700Bold' },
  payDivider:{
    borderTopWidth: 1.5, borderStyle: 'dashed', borderTopColor: '#E5E7EB',
    marginVertical: 6,
  },

  // Actions
  actions: { gap: 12, marginTop: 6 },
  btnRed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 12, paddingVertical: 17,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  btnRedText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },

  btnTrack: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: RED, borderRadius: 12, paddingVertical: 16,
    backgroundColor: '#fff',
  },
  btnTrackText: { color: RED, fontSize: 15, fontFamily: 'Inter_700Bold' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 16,
    backgroundColor: '#fff',
  },
  btnOutlineText: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },

  // ── Modal reorder ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40, alignItems: 'center',
  },
  modalIconBox: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF0F0',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  modalTitle:    { fontSize: 19, fontFamily: 'Poppins_700Bold', color: INK, marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 13.5, fontFamily: 'Inter_400Regular', color: GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  btnMerge: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 14, paddingVertical: 15, marginBottom: 10,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  btnMergeText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  btnReplaceModal: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: RED, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, marginBottom: 10,
  },
  btnReplaceModalText: { color: RED, fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  btnCancelModal: { paddingVertical: 10 },
  btnCancelModalText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: GRAY },

  couponRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
couponBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
couponCode:   { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#059669' },
couponAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#059669' },
});