import { View, Text } from "react-native";

export default function ActivityChart() {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 20,
        marginTop: 22,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          marginBottom: 16,
          fontFamily: "Poppins_600SemiBold",
        }}
      >
        Activité du jour
      </Text>

      <View
        style={{
          height: 220,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 12,
          backgroundColor: "#F3F4F6",
        }}
      >
        <Text
          style={{
            color: "#9CA3AF",
          }}
        >
          Graphique (API)
        </Text>
      </View>
    </View>
  );
}