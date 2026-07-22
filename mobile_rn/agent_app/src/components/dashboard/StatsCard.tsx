import { View, Text } from "react-native";

type Props = {
  title: string;
  value: number;
  color?: string;
};

export default function StatsCard({
  title,
  value,
  color = "#1D9E75",
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 18,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: {
          width: 0,
          height: 2,
        },
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          color: "#8E8E93",
          fontSize: 14,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 8,
          fontFamily: "Poppins_700Bold",
          fontSize: 34,
          color,
        }}
      >
        {value}
      </Text>
    </View>
  );
}