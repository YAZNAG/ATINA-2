import { View, Text } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
};

export default function EmptyState({
  title,
  subtitle,
}: Props) {
  return (
    <View
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 50,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontFamily: "Poppins_600SemiBold",
        }}
      >
        {title}
      </Text>

      {subtitle && (
        <Text
          style={{
            marginTop: 8,
            textAlign: "center",
            color: "#6B7280",
            fontFamily: "Inter_400Regular",
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}