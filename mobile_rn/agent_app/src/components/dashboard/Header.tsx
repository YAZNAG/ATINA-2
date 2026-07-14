import { Feather } from "@expo/vector-icons";
import { View, Text, Pressable } from "react-native";

import Avatar from "../common/Avatar";

type Props = {
  name: string;
  onNotifications?: () => void;
  onCalendar?: () => void;
};

export default function Header({
  name,
  onNotifications,
  onCalendar,
}: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar name={name} size={54} />

        <View style={{ marginLeft: 14 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              color: "#7A7A7A",
              fontSize: 14,
            }}
          >
            Bonjour {name}!
          </Text>

          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 22,
              color: "#111827",
            }}
          >
            {name}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
        }}
      >
        <Pressable
          onPress={onCalendar}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: "#F4F5F7",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Feather name="calendar" size={20} color="#1D9E75" />
        </Pressable>

        <Pressable
          onPress={onNotifications}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: "#F4F5F7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="bell" size={20} color="#1D9E75" />
        </Pressable>
      </View>
    </View>
  );
}