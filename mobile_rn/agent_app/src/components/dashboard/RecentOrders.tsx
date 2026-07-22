import { Pressable, Text, View } from "react-native";

type Order = {
  id: string;
  customer: string;
  items: number;
};

type Props = {
  orders: Order[];
  onSelect: (id: string) => void;
};

export default function RecentOrders({
  orders,
  onSelect,
}: Props) {
  return (
    <View style={{ marginTop: 28 }}>
      <Text
        style={{
          fontSize: 18,
          marginBottom: 16,
          fontFamily: "Poppins_600SemiBold",
        }}
      >
        Commandes prioritaires
      </Text>

      {orders.map((order) => (
        <Pressable
          key={order.id}
          onPress={() => onSelect(order.id)}
          style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 16,
            }}
          >
            {order.customer}
          </Text>

          <Text
            style={{
              marginTop: 4,
              color: "#6B7280",
            }}
          >
            {order.items} articles
          </Text>
        </Pressable>
      ))}
    </View>
  );
}