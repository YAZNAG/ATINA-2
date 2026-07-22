import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Order } from "@/types/order";

interface PendingOrderCardProps {
  order: Order;
  onPrepare: () => void;
  onViewDetails: () => void;
}

const COLORS = {
  primary: "#E30613",
  background: "#FFFFFF",
  border: "#F1F5F9",

  text: "#111827",
  secondary: "#6B7280",
  light: "#94A3B8",

  successBg: "#ECFDF3",
  success: "#16A34A",

  danger: "#DC2626",

  shadow: "#000",
};

export default function PendingOrderCard({
  order,
  onPrepare,
  onViewDetails,
}: PendingOrderCardProps) {
  const itemsCount = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{order.id}</Text>

          <Text style={styles.customer}>{order.customer}</Text>

          <Text style={styles.date}>
            {order.createdAt ?? "24 Oct 2023 • 14:10"}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>EN ATTENTE</Text>
        </View>
      </View>

      {/* Informations */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoTitle}>PRODUITS</Text>
          <Text style={styles.infoValue}>
            {itemsCount} article{itemsCount > 1 ? "s" : ""}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoTitle}>TOTAL</Text>
          <Text style={[styles.infoValue, styles.price]}>
            {order.total} DH
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoTitle}>PAIEMENT</Text>

          <View style={styles.paymentRow}>
            <Ionicons
              name="card-outline"
              size={16}
              color={COLORS.secondary}
            />

            <Text style={styles.infoValue}>
              {order.payment ?? "Carte"}
            </Text>
          </View>
        </View>
      </View>

      {/* Livraison */}
      <View style={styles.delivery}>
        <MaterialCommunityIcons
          name="shopping-outline"
          color={COLORS.primary}
          size={18}
        />

        <Text style={styles.deliveryText}>
          {order.deliveryType === "delivery"
            ? "Livraison"
            : "Retrait en magasin"}
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.prepareButton}
          onPress={onPrepare}
        >
          <Text style={styles.prepareText}>
            Préparer la commande
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.eyeButton}
          onPress={onViewDetails}
        >
          <Ionicons
            name="eye-outline"
            size={22}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 18,
    borderWidth: 0.8,
    borderColor: COLORS.border,

    padding: 16,
    marginBottom: 14,

    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 3,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  orderNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },

  customer: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },

  date: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.secondary,
  },

  statusBadge: {
    backgroundColor: COLORS.successBg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  statusText: {
    color: COLORS.success,
    fontWeight: "700",
    fontSize: 11,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },

  infoItem: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 11,
    color: COLORS.light,
    fontWeight: "700",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  price: {
    color: COLORS.primary,
  },

  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  delivery: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 22,
    gap: 8,
  },

  deliveryText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 15,
  },

  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  prepareButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },

  prepareText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  eyeButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#F1CACA",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
});