import React from "react";
import { View, Text } from "react-native";

export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

type Props = {
  status: OrderStatus;
};

const STATUS = {
  PENDING: {
    label: "EN ATTENTE",
    background: "#ECFDF5",
    color: "#10B981",
  },

  PREPARING: {
    label: "EN PRÉPARATION",
    background: "#FEF3C7",
    color: "#D97706",
  },

  READY: {
    label: "PRÊTE",
    background: "#DCFCE7",
    color: "#16A34A",
  },

  DELIVERED: {
    label: "LIVRÉE",
    background: "#E0E7FF",
    color: "#4338CA",
  },

  CANCELLED: {
    label: "ANNULÉE",
    background: "#FEE2E2",
    color: "#DC2626",
  },
};

export default function StatusBadge({ status }: Props) {
  const current = STATUS[status];

  return (
    <View
      style={{
        backgroundColor: current.background,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: current.color,
          fontSize: 11,
          fontWeight: "700",
        }}
      >
        {current.label}
      </Text>
    </View>
  );
}