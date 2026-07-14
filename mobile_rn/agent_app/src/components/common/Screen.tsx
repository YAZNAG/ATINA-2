import { ReactNode } from "react";
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

type Props = {
  children: ReactNode;
  scroll?: boolean;
};

export default function Screen({
  children,
  scroll = true,
}: Props) {
  const content = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 20,
        flexGrow: 1,
      }}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#F7F8FA",
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}