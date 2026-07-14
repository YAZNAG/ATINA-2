import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "@/api/client"; // adapte le chemin si besoin

// ---------- Types ----------

interface OrderDetailItem {
  id: string;
  name: string;
  category: string; 
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

interface OrderDetailData {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  date: string; 
  time: string; 
  items: OrderDetailItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

const COLORS = {
  primary: "#D90404",
  background: "#F7F8FA",
  card: "#FFFFFF",
  border: "#EFEFEF",
  text: "#111827",
  secondaryText: "#8B92A0",
  divider: "#F0F0F0",
};

// ---------- Composant principal ----------

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get(`/orders/${id}`);
      setOrder(data);
    } catch (error) {
      console.error("Erreur lors du chargement de la commande:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la commande</Text>
        <View style={{ width: 24 }} />
      </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Commande introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la commande</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte Informations Client */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations Client</Text>

          <InfoRow icon="person-outline" label="Nom" value={order.customerName} />
          <InfoRow icon="call-outline" label="Téléphone" value={order.phone} />
          <InfoRow icon="location-outline" label="Adresse" value={order.address} />
          <InfoRow icon="calendar-outline" label="Date" value={order.date} />
          <InfoRow icon="time-outline" label="Heure" value={order.time} last />
        </View>

        {/* Produits commandés */}
        <Text style={styles.sectionTitle}>Produits commandés</Text>

        {order.items.map((item) => (
          <View key={item.id} style={styles.productCard}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={22} color={COLORS.secondaryText} />
              </View>
            )}

            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productCategory}>{item.category}</Text>
              <Text style={styles.productQuantity}>
                x{item.quantity} • {item.unitPrice} MAD / unité
              </Text>
            </View>

            <View style={styles.productPriceBlock}>
              <Text style={styles.productPrice}>
                {item.quantity * item.unitPrice} MAD
              </Text>
              <Text style={styles.productSubtotalLabel}>Sous-total</Text>
            </View>
          </View>
        ))}

        {/* Résumé de la commande */}
        <Text style={styles.summaryTitle}>RÉSUMÉ DE LA COMMANDE</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>
              {order.subtotal.toFixed(2)} DH
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison</Text>
            <Text style={styles.summaryValue}>
              {order.deliveryFee.toFixed(2)} DH
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total à payer</Text>
            <Text style={styles.summaryTotalValue}>
              {order.total.toFixed(2)} DH
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Sous-composant ligne d'info ----------

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowSpacing]}>
      <Ionicons name={icon} size={17} color={COLORS.primary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label} : </Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: COLORS.secondaryText, fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 14,
  },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoRowSpacing: { marginBottom: 12 },
  infoIcon: { marginRight: 8, width: 18 },
  infoLabel: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  infoValue: { fontSize: 14, color: COLORS.text, flexShrink: 1 },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },

  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  productImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  productCategory: { fontSize: 12, color: COLORS.secondaryText, marginTop: 1 },
  productQuantity: { fontSize: 12, color: COLORS.secondaryText, marginTop: 2 },
  productPriceBlock: { alignItems: "flex-end" },
  productPrice: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  productSubtotalLabel: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },

  summaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 14, color: COLORS.secondaryText },
  summaryValue: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 6,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  summaryTotalValue: { fontSize: 17, fontWeight: "800", color: COLORS.primary },
});
