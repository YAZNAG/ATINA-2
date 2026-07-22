import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';
// ---------- Types ----------

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string; 
  imageUrl?: string;
  collected: boolean;
}

const COLORS = {
  primary: "#D90404",
  background: "#F8F8F8",
  card: "#FFFFFF",
  border: "#ECECEC",
  text: "#111827",
  secondaryText: "#6B7280",
};

interface OrderPrepareData {
  id: string;
  reference: string; 
  customerName: string; 
  status: 'pending' | 'preparing' | 'ready';
  items: OrderItem[];
}
const MOCK_ORDER: OrderPrepareData = {
  id: "CMD-1001",
  reference: "REF-1001",
  customerName: "Youssef El Amrani",
  status: "preparing",
  items: [
    {
      id: "1",
      productName: "Sandwich Poulet",
      quantity: 2,
      unit: "unité",
      imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=300",
      collected: false
    },
    {
      id: "2",
      productName: "Coca-Cola",
      quantity: 2,
      unit: "unité",
      imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300",
      collected: false
    }
  ]
};

export default function OrderPrepareScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<OrderPrepareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ---------- Chargement de la commande ----------

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
     // const { data } = await apiClient.get(`/orders/${id}/prepare`);
      //setOrder(data);
      //j'ai mis un mock pour simuler la récupération de la commande 
      await new Promise(resolve => setTimeout(resolve, 700));
      setOrder(MOCK_ORDER);
    } catch (error) {
      console.error('Erreur lors du chargement de la commande:', error);
      Alert.alert('Erreur', 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ---------- Actions ----------

  const toggleItemCollected = async (itemId: string) => {
    if (!order) return;

    // Mise à jour optimiste locale
    const updatedItems = order.items.map((item) =>
      item.id === itemId ? { ...item, collected: !item.collected } : item
    );
    setOrder({ ...order, items: updatedItems });

    try {
     /* await apiClient.patch(`/orders/${id}/items/${itemId}`, {
        collected: updatedItems.find((i) => i.id === itemId)?.collected,
      });*/
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Rollback en cas d'échec
      setOrder(order);
      Alert.alert('Erreur', "Impossible de mettre à jour l'article.");
    }
  };

  const collectedCount = order?.items.filter((i) => i.collected).length ?? 0;
  const totalCount = order?.items.length ?? 0;
  const allCollected = totalCount > 0 && collectedCount === totalCount;

  const handleValidatePreparation = async () => {
    if (!order) return;

    if (!allCollected) {
      Alert.alert(
        'Articles manquants',
        'Tous les articles ne sont pas encore collectés. Continuer quand même ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Continuer', onPress: () => submitPreparation() },
        ]
      );
      return;
    }
    submitPreparation();
  };

  const submitPreparation = async () => {
    try {
      setSubmitting(true);
     /* await apiClient.patch(`/orders/${id}/status`, {
        status: 'ready',
      });*/
      //j'ai mis un mock pour simuler la mise à jour du statut de la commande
        await new Promise((resolve) => setTimeout(resolve, 600));
    console.log('Mock: statut de la commande mis à jour ->', id, 'ready');
      router.push({
        pathname: '/main/order_placement',
        params: { id },
      } as any);
    } catch (error) {
      console.error('Erreur lors de la validation:', error);
      Alert.alert('Erreur', 'Impossible de valider la préparation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportMissingItem = () => {
    router.push({
      pathname: '/main/report_missing_item',
      params: { id },
    } as any);
  };
  const handleGoBack = () => {
    router.back();
  };

  // ---------- Rendu ----------

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

if (!order) {
  return (
    
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commande Préparer</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.centered}>
        <Text>Commande introuvable.</Text>
      </View>
    </View>
  );
}

  const progressRatio = totalCount > 0 ? collectedCount / totalCount : 0;

  return (
          <SafeAreaView style={styles.container} edges={["top"]}>
                   {/* Header */}
                  <View style={styles.header}>
                    <TouchableOpacity
                      onPress={handleGoBack}
                      style={styles.backButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="chevron-back" size={26} color={COLORS.text} />
                    </TouchableOpacity>
            
                    <Text style={styles.headerTitle}>Commande préparer</Text>
            
                    <View style={styles.headerSpacer} />
                  </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Badge + titre commande */}
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>ACTIVE ORDER</Text>
        </View>
        <Text style={styles.orderTitle}>
          {order.customerName} - {order.reference}
        </Text>

        {/* Barre de progression */}
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Preparation Progress</Text>
          <Text style={styles.progressCount}>
            {collectedCount} of {totalCount} items collected
          </Text>
        </View>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressRatio * 100}%` },
            ]}
          />
        </View>

        {/* Checklist */}
        <Text style={styles.sectionTitle}>CHECKLIST</Text>
        {order.items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.checklistItem}
            onPress={() => toggleItemCollected(item.id)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                item.collected && styles.checkboxChecked,
              ]}
            >
              {item.collected && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>

            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
            ) : (
              <View style={styles.itemImagePlaceholder} />
            )}

            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.itemDetail}>
                {item.quantity} Units • {item.unit}
              </Text>
            </View>

            <Text style={styles.itemQuantityBadge}>x{item.quantity}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Actions bas de page */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleValidatePreparation}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cube-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Commande Préparer</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleReportMissingItem}
        >
          <Ionicons name="warning-outline" size={18} color="#111" />
          <Text style={styles.secondaryButtonText}>
            Signaler un produit manquant
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  scrollContent: { padding: 16, paddingBottom: 24 },
  orderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDECEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
   headerSpacer: {
    width: 40,
  },
  orderBadgeText: { color: '#E53935', fontSize: 11, fontWeight: '700' },
  orderTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 16 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 13, color: '#666' },
  progressCount: { fontSize: 13, color: '#666', fontWeight: '600' },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#E53935' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: '#E53935', borderColor: '#E53935' },
  itemImage: { width: 40, height: 40, borderRadius: 6, marginRight: 12 },
  itemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111' },
  itemDetail: { fontSize: 12, color: '#999', marginTop: 2 },
  itemQuantityBadge: { fontSize: 13, fontWeight: '700', color: '#111' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#E53935',
    borderRadius: 10,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: { color: '#111', fontSize: 14, fontWeight: '600' },
});
