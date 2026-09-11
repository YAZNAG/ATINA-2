import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PageHeader from '../../components/ui/PageHeader';
import { PointsExchangeService, ExchangeCatalog, ExchangeCatalogItem } from '../../services/points_exchange.service';
import { RewardsCart, useRewardsCart } from '../../store/rewardsCartStore';

const RED = '#E10600';

/**
 * « Échanger mes points » (WF #19 A) : catalogue des produits échangeables du magasin.
 * L'ajout crée une ligne « Produits échangés » dans le panier ; rien n'est débité avant
 * la confirmation de la commande (solde projeté purement informatif).
 */
export default function PointsExchangeScreen() {
  const router = useRouter();
  const rewards = useRewardsCart();
  const [catalog, setCatalog]       = useState<ExchangeCatalog | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setCatalog(await PointsExchangeService.getCatalog());
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de charger le catalogue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const balance   = catalog?.points_balance ?? 0;
  const reserved  = rewards.exchange.reduce((s, l) => s + l.points_cost * l.qty, 0);
  const projected = balance - reserved;
  const inCart    = (skuId: string) => rewards.exchange.find((l) => l.sku_id === skuId)?.qty ?? 0;

  const handleAdd = (item: ExchangeCatalogItem) => {
    if (projected < item.points_cost) {
      Alert.alert('Points insuffisants', `Il vous manque ${item.points_cost - projected} point(s) pour ce produit.`);
      return;
    }
    if (inCart(item.sku_id) + 1 > item.max_orderable) {
      Alert.alert('Quantité maximale', item.max_qty_per_order != null && item.max_qty_per_order <= item.qty_available
        ? `Maximum ${item.max_qty_per_order} par commande pour ce produit.`
        : 'Stock disponible atteint pour ce produit.');
      return;
    }
    const msg = RewardsCart.addExchange({
      sku_id: item.sku_id,
      name_fr: item.name_fr,
      points_cost: item.points_cost,
      max_qty_per_order: item.max_qty_per_order,
      node_id: catalog?.node?.id ?? null,
    });
    if (msg) Alert.alert('Quantité maximale', msg);
  };

  const handleRemoveOne = (item: ExchangeCatalogItem) => {
    RewardsCart.setExchangeQty(item.sku_id, inCart(item.sku_id) - 1);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={RED} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Feather name="wifi-off" size={40} color="#9CA3AF" />
        <Text style={styles.errorTitle}>Catalogue indisponible</Text>
        <Text style={styles.errorDesc}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
          <Text style={styles.retryBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const header = (
    <View>
      <View style={styles.balanceCard}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="swap-horizontal" size={12} color="#fff" />
          <Text style={styles.badgeText}>ÉCHANGE DE POINTS</Text>
        </View>
        <Text style={styles.balanceLabel}>Points disponibles</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceValue}>{balance.toLocaleString('fr-FR')}</Text>
          <Text style={styles.balanceUnit}>pts</Text>
        </View>
        <View style={styles.projBox}>
          <View style={styles.projRow}>
            <Text style={styles.projLabel}>Produits échangés dans le panier</Text>
            <Text style={styles.projValue}>−{reserved.toLocaleString('fr-FR')} pts</Text>
          </View>
          <View style={styles.projRow}>
            <Text style={styles.projLabelBold}>Solde projeté</Text>
            <Text style={styles.projValueBold}>{projected.toLocaleString('fr-FR')} pts</Text>
          </View>
        </View>
        {!!catalog?.node && <Text style={styles.nodeText}>Magasin : {catalog.node.name_fr}</Text>}
      </View>

      <View style={styles.infoBox}>
        <Feather name="info" size={18} color="#2563EB" style={{ marginTop: 2 }} />
        <Text style={styles.infoDesc}>
          Vos points ne sont débités qu'à la confirmation de la commande. Les produits échangés ne comptent pas dans le montant minimum de commande.
        </Text>
      </View>
      <Text style={styles.sectionTitle}>Produits échangeables</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <PageHeader title="Échanger mes points" rightIcon="shopping-cart" onRightPress={() => router.push('/main/cart' as any)} />
      <FlatList
        data={catalog?.items ?? []}
        keyExtractor={(i) => i.rule_id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={RED} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="gift" size={36} color="#D1D5DB" />
            <Text style={styles.emptyText}>Aucun produit n'est échangeable contre des points sur votre magasin pour le moment.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const qty = inCart(item.sku_id);
          const canAdd = projected >= item.points_cost && qty < item.max_orderable;
          return (
            <View style={styles.itemCard}>
              <View style={styles.itemImageBox}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={styles.itemImage} contentFit="contain" />
                  : <Feather name="image" size={24} color="#E0E0E0" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name_fr}</Text>
                <Text style={styles.itemPoints}>{item.points_cost.toLocaleString('fr-FR')} pts</Text>
                <Text style={styles.itemSub}>
                  {item.max_qty_per_order != null ? `Max ${item.max_qty_per_order} par commande` : 'Sans limite par commande'}
                  {item.price_ttc != null ? ` • valeur ${item.price_ttc.toFixed(2)} MAD` : ''}
                </Text>
              </View>
              {qty > 0 ? (
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => handleRemoveOne(item)} activeOpacity={0.7}>
                    <Feather name="minus" size={14} color="#1a1a1a" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity style={[styles.qtyBtn, !canAdd && styles.disabled]} onPress={() => handleAdd(item)} activeOpacity={0.7}>
                    <Feather name="plus" size={14} color="#1a1a1a" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.addBtn, !canAdd && styles.disabled]} onPress={() => handleAdd(item)} activeOpacity={0.85}>
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.addBtnText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListFooterComponent={rewards.exchange.length > 0 ? (
          <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/main/cart' as any)} activeOpacity={0.85}>
            <Feather name="shopping-cart" size={18} color="#fff" />
            <Text style={styles.cartBtnText}>Voir mon panier ({reserved.toLocaleString('fr-FR')} pts)</Text>
          </TouchableOpacity>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  scroll:   { paddingHorizontal: 16, paddingBottom: 40 },

  balanceCard: {
    backgroundColor: RED, borderRadius: 24, padding: 20, marginTop: 8,
    shadowColor: RED, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  badge: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 14,
  },
  badgeText:    { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 2 },
  balanceRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 14 },
  balanceValue: { color: '#fff', fontSize: 38, fontWeight: '800' },
  balanceUnit:  { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginBottom: 6 },
  projBox:      { backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 14, padding: 12, gap: 6 },
  projRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  projLabel:    { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  projValue:    { color: '#fff', fontSize: 13 },
  projLabelBold: { color: '#fff', fontSize: 14, fontWeight: '700' },
  projValueBold: { color: '#fff', fontSize: 14, fontWeight: '800' },
  nodeText:     { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 10 },

  infoBox: {
    flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 14,
    padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#DBEAFE',
  },
  infoDesc: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 22, marginBottom: 12 },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0',
  },
  itemImageBox: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  itemImage:    { width: 56, height: 56 },
  itemName:     { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  itemPoints:   { fontSize: 15, fontWeight: '800', color: '#F59E0B', marginTop: 2 },
  itemSub:      { fontSize: 12, color: '#6B7280', marginTop: 2 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: RED, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabled:   { opacity: 0.4 },
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn:     { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  qtyText:    { fontSize: 15, fontWeight: '700', minWidth: 18, textAlign: 'center' },

  cartBtn:     { flexDirection: 'row', gap: 8, backgroundColor: '#1a1a1a', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  empty:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingHorizontal: 24 },

  errorTitle:   { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 16, textAlign: 'center' },
  errorDesc:    { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  retryBtn:     { marginTop: 20, backgroundColor: RED, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
