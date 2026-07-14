import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
// Adapte cet import si ton type Order vit ailleurs (ex: "@/types/order")
import type { Order, OrderStatus } from "@/app/main/(tabs)/orders";

interface OrderCardProps {
  order: Order;
  onPrepare: () => void;
  onViewDetails: () => void;
}

const COLORS = {
  primary: "#D90404",
  card: "#FFFFFF",
  border: "#ECECEC",
  text: "#111827",
  secondaryText: "#6B7280",
  pendingBg: "#FFF4E5",
  pendingText: "#C2760C",
  readyBg: "#E6F7EE",
  readyText: "#1E9E5A",
};

// Seuls "pending" et "ready" sont censés atteindre cette carte
// ("preparing" ne vit que dans order_prepare.tsx)
const STATUS_CONFIG: Record<
  Extract<OrderStatus, "pending" | "ready">,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "En attente", bg: COLORS.pendingBg, color: COLORS.pendingText },
  ready: { label: "Prête", bg: COLORS.readyBg, color: COLORS.readyText },
};

export default function OrderCard({
  order,
  onPrepare,
  onViewDetails,
}: OrderCardProps) {
  const isReady = order.status === "ready";
  const statusConfig =
    STATUS_CONFIG[order.status as "pending" | "ready"] ?? STATUS_CONFIG.pending;

  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={styles.card}>
      {/* Ligne header : badge statut + numéro commande */}
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.badgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
        <Text style={styles.orderId}>{order.id}</Text>
      </View>

      {/* Infos client */}
      <Text style={styles.customerName}>{order.customer}</Text>
      <Text style={styles.metaText}>
        {itemsCount} produit{itemsCount > 1 ? "s" : ""} • {order.total} MAD
      </Text>
      <Text style={styles.addressText} numberOfLines={1}>
        {order.address}
      </Text>

      {/* Actions : dépendent du statut */}
      {isReady ? (
        <TouchableOpacity style={styles.primaryButton} onPress={onViewDetails}>
          <Ionicons name="document-text-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Voir les détails</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.prepareButton]}
            onPress={onPrepare}
          >
            <Ionicons name="cube-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Préparer la commande</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.eyeButton}
            onPress={onViewDetails}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="eye-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  orderId: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.secondaryText,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.secondaryText,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  prepareButton: {
    flex: 1,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  eyeButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
});
