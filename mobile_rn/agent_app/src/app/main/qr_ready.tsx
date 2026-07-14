import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";

export default function QRReadyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontFamily: "Poppins_700Bold",
          }}
        >
          QR Ready
        </Text>

        <Text
          style={{
            marginTop: 8,
            color: "#6B7280",
            fontFamily: "Inter_400Regular",
          }}
        >
          QR Code de retrait.
        </Text>
      </View>
    </SafeAreaView>
  );
}