import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-6 pt-4">
        <Text className="text-secondary text-sm">Buying power</Text>
        <Text className="text-primary text-4xl font-bold mt-1">$0.00</Text>

        <View className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <Text className="text-primary text-base font-semibold">Fund your wallet</Text>
          <Text className="text-secondary text-sm mt-1 leading-5">
            Send USDC or USDT on Solana to start investing.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
