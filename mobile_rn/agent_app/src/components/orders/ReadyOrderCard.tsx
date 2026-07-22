import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import type { Order } from "@/types/order";

interface ReadyOrderCardProps {
  order: Order;
  onViewDetails: () =>void;
}

const COLORS = {
  primary: "#D90404",

  text: "#1F2937",
  secondary: "#6B7280",

  border: "#F3F4F6",
  background: "#FFFFFF",

  badgeBg: "#ECFDF3",
  badgeText: "#16A34A",

  shadow: "#000000",
};

export default function ReadyOrderCard({
  order,
  onViewDetails,
}: ReadyOrderCardProps) {
  const itemsCount = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
//i should transform time to reel time modifying readysince function
  const readySince =
    order.readySince ?? "Prête depuis 5 minutes";

  return (
    <View style={styles.card}>
      {/* Header */}

      <View style={styles.header}>

        <View style={styles.titleContainer}>
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={22}
            color={COLORS.secondary}
          />

          <Text style={styles.title}>
            Commande #{order.id}
          </Text>
        </View>

        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>Prête</Text>
        </View>
      </View>

      {/* Client */}

      <View style={styles.infoRow}>
        <Ionicons
          name="person-outline"
          size={18}
          color={COLORS.secondary}
        />

        <Text style={styles.infoText}>
          {order.customer}
        </Text>

        <Text style={styles.separator}>•</Text>

        <MaterialCommunityIcons
          name="package-variant"
          size={18}
          color={COLORS.secondary}
        />

        <Text style={styles.infoText}>
          {itemsCount} produit{itemsCount > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Ready Since */}

      <View style={styles.infoRow}>
        <Ionicons
          name="time-outline"
          size={18}
          color={COLORS.secondary}
        />

        <Text style={styles.secondaryText}>
          {readySince}
        </Text>
      </View>

      {/* Delivery */}

      <View style={styles.infoRow}>
        <MaterialCommunityIcons
          name={
            order.deliveryType === "pickup"
              ? "storefront-outline"
              : "truck-delivery-outline"
          }
          size={18}
          color={COLORS.primary}
        />

        <Text style={styles.deliveryText}>
          {order.deliveryType === "pickup"
            ? "Retrait en magasin"
            : "Livraison"}
        </Text>
      </View>

      {/* Button */}

      <TouchableOpacity
        style={styles.button}
        onPress={onViewDetails}
      >
        <Text style={styles.buttonText}>
          Voir les détails
        </Text>
      </TouchableOpacity>
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
    alignItems: "center",

    marginBottom: 18,
  },

  titleContainer: {
    flexDirection: "row",
    alignItems: "center",

    gap: 8,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: COLORS.badgeBg,

    paddingHorizontal: 12,
    paddingVertical: 6,

    borderRadius: 999,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,

    backgroundColor: COLORS.badgeText,

    marginRight: 6,
  },

  badgeText: {
    color: COLORS.badgeText,
    fontWeight: "700",
    fontSize: 13,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 12,
  },

  infoText: {
    marginLeft: 8,

    fontSize: 16,
    color: COLORS.text,

    fontWeight: "500",
  },

  separator: {
    marginHorizontal: 10,

    color: "#D1D5DB",

    fontSize: 18,
  },

  secondaryText: {
    marginLeft: 8,

    color: COLORS.secondary,

    fontSize: 16,
  },

  deliveryText: {
    marginLeft: 8,

    color: COLORS.primary,

    fontWeight: "700",

    fontSize: 16,
  },

  button: {
    marginTop: 12,

    backgroundColor: COLORS.primary,

    height: 48,

    borderRadius: 12,

    justifyContent: "center",
    alignItems: "center",
  },

  buttonText: {
    color: "#FFF",

    fontWeight: "700",

    fontSize: 16,
  },
});