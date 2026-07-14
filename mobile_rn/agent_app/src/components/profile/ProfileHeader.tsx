import React from "react";
import { View, Text } from "react-native";

type Props = {
  name?: string;
  email?: string;
};

export default function ProfileHeader({
  name = "Agent",
  email = "",
}: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 24,
      }}
    >
      <View
        style={{
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "#D90404",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#FFF",
            fontSize: 30,
            fontWeight: "700",
          }}
        >
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 22,
          fontWeight: "700",
        }}
      >
        {name}
      </Text>

      {!!email && (
        <Text
          style={{
            color: "#6B7280",
            marginTop: 4,
          }}
        >
          {email}
        </Text>
      )}
    </View>
  );
}