import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Placeholder until task 2.3 wires the WalletSession port (Privy adapter).
export default function Login() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 justify-center px-6">
        <Text className="text-primary text-2xl font-semibold">Sign in</Text>
        <Text className="text-secondary text-base mt-3">
          Email, Google and Apple sign-in arrive with task 2.3.
        </Text>
      </View>
    </SafeAreaView>
  );
}
