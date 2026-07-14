import { View, Text } from "react-native";
import AppButton from "./AppButton";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorView({
  message = "Une erreur est survenue.",
  onRetry,
}: Props) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          marginBottom: 20,
          textAlign: "center",
          fontFamily: "Poppins_600SemiBold",
        }}
      >
        {message}
      </Text>

      {onRetry && (
        <AppButton
          title="Réessayer"
          onPress={onRetry}
        />
      )}
    </View>
  );
}