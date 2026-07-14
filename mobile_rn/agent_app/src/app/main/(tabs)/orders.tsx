import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import OrderCard from "@/components/orders/OrderCard";

// ==================================================
// TYPES
// ==================================================

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type PaymentType = "cash" | "card" | "online";

export type DeliveryType = "delivery" | "pickup";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customer: string;
  createdAt: string;
  items: OrderItem[];
  total: number;
  payment: PaymentType;
  deliveryType: DeliveryType;
  address: string;
  status: OrderStatus;
}

const COLORS = {
  primary: "#D90404",
  background: "#F8F8F8",
  card: "#FFFFFF",
  border: "#ECECEC",
  text: "#111827",
  secondaryText: "#6B7280",
};

// Statuts visibles sur CETTE liste. "preparing" ne s'affiche que dans
// order_prepare.tsx (checklist), "delivered"/"cancelled" vont ailleurs
// (onglet Completed).
const VISIBLE_STATUSES: OrderStatus[] = ["pending", "ready"];

// ==================================================
// DONNEES MOCK
// ==================================================

const MOCK_ORDERS: Order[] = [
  {
    id: "CMD-1001",
    customer: "Youssef El Amrani",
    createdAt: "2026-07-09T08:12:00Z",
    items: [
      { id: "1", name: "Sandwich Poulet", quantity: 2, price: 35 },
      { id: "2", name: "Coca-Cola 33cl", quantity: 2, price: 10 },
    ],
    total: 90,
    payment: "cash",
    deliveryType: "delivery",
    address: "12 Rue Al Massira, Agadir",
    status: "pending",
  },
  {
    id: "CMD-1002",
    customer: "Sara Bennani",
    createdAt: "2026-07-09T08:45:00Z",
    items: [
      { id: "1", name: "Pizza Margherita", quantity: 1, price: 60 },
      { id: "2", name: "Tiramisu", quantity: 1, price: 25 },
    ],
    total: 85,
    payment: "card",
    deliveryType: "pickup",
    address: "Retrait en magasin",
    status: "preparing",
  },
  {
    id: "CMD-1003",
    customer: "Omar Chraibi",
    createdAt: "2026-07-09T09:03:00Z",
    items: [
      { id: "1", name: "Burger Boeuf", quantity: 3, price: 45 },
      { id: "2", name: "Frites", quantity: 3, price: 15 },
    ],
    total: 180,
    payment: "online",
    deliveryType: "delivery",
    address: "45 Avenue Hassan II, Agadir",
    status: "ready",
  },
  {
    id: "CMD-1004",
    customer: "Imane Fassi",
    createdAt: "2026-07-09T09:20:00Z",
    items: [{ id: "1", name: "Salade César", quantity: 1, price: 40 }],
    total: 40,
    payment: "cash",
    deliveryType: "pickup",
    address: "Retrait en magasin",
    status: "delivered",
  },
  {
    id: "CMD-1005",
    customer: "Karim Idrissi",
    createdAt: "2026-07-09T09:35:00Z",
    items: [
      { id: "1", name: "Tacos Poulet", quantity: 2, price: 30 },
      { id: "2", name: "Jus Orange", quantity: 2, price: 12 },
    ],
    total: 84,
    payment: "card",
    deliveryType: "delivery",
    address: "8 Rue Tarik Ibn Ziad, Agadir",
    status: "cancelled",
  },
  {
    id: "CMD-1006",
    customer: "Nadia Alaoui",
    createdAt: "2026-07-09T09:50:00Z",
    items: [
      { id: "1", name: "Pates Bolognaise", quantity: 1, price: 50 },
      { id: "2", name: "Eau Minerale", quantity: 1, price: 8 },
    ],
    total: 58,
    payment: "online",
    deliveryType: "delivery",
    address: "22 Boulevard Mohammed VI, Agadir",
    status: "pending",
  },
];

export default function OrdersScreen() {
  const router = useRouter();

  const [query, setQuery] = useState<string>("");
  const [orders] = useState<Order[]>(MOCK_ORDERS);
  const loading: boolean = false;

  // Filtre : uniquement pending + ready, puis recherche par nom/numéro
  const filteredOrders = useMemo<Order[]>(() => {
    const visibleOrders = orders.filter((order) =>
      VISIBLE_STATUSES.includes(order.status)
    );

    const trimmedQuery = query.trim().toLowerCase();

    if (trimmedQuery.length === 0) {
      return visibleOrders;
    }

    return visibleOrders.filter((order) => {
      const matchesCustomer = order.customer
        .toLowerCase()
        .includes(trimmedQuery);
      const matchesId = order.id.toLowerCase().includes(trimmedQuery);
      return matchesCustomer || matchesId;
    });
  }, [query, orders]);

  const handleGoBack = () => {
    router.back();
  };

  // "Préparer la commande" -> toujours vers la checklist (commande pending)
  const handlePrepare = (item: Order) => {
    router.push({ pathname: "/main/order_prepare", params: { id: item.id } });
  };

  // Icône œil / "Voir les détails" -> toujours vers l'écran détail
  const handleViewDetails = (item: Order) => {
    router.push({ pathname: "/main/order_detail", params: { id: item.id } });
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="clipboard-search-outline"
        size={72}
        color={COLORS.secondaryText}
      />
      <Text style={styles.emptyText}>Aucune commande trouvée</Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Les commandes</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={COLORS.secondaryText}
          style={styles.searchIcon}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher par client ou numéro"
          placeholderTextColor={COLORS.secondaryText}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.secondaryText}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Contenu principal */}
      {loading ? (
        renderLoadingState()
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPrepare={() => handlePrepare(item)}
              onViewDetails={() => handleViewDetails(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.secondaryText,
  },
});
