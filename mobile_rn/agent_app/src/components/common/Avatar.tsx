import { View, Text } from "react-native";

type Props = {
  name: string;
  size?: number;
};

export default function Avatar({
  name,
  size = 50,
}: Props) {
  const letter = name.charAt(0).toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#16A34A",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: size / 2.4,
          fontFamily: "Poppins_700Bold",
        }}
      >
        {letter}
      </Text>
    </View>
  );
}