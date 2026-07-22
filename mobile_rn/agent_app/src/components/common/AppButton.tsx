import { ActivityIndicator, Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={{
        height: 54,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: disabled ? "#94A3B8" : "#16A34A",
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontFamily: "Poppins_600SemiBold",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}