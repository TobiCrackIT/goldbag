import { Link } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 justify-end px-6 pb-10">
        <Text className="text-primary text-5xl font-bold tracking-tight">Goldbag</Text>
        <Text className="text-primary text-3xl font-semibold mt-4">
          Own real assets.{"\n"}Keep your keys.
        </Text>
        <Text className="text-secondary text-base mt-4 leading-6">
          Buy tokenised US stocks and gold with the stablecoins you already hold. No bank, no
          paperwork.
        </Text>

        <Link
          href="/login"
          className="bg-accent text-on-accent text-center text-lg font-semibold rounded-2xl py-4 mt-10 overflow-hidden"
        >
          Get started
        </Link>
        <Link href="/(main)" className="text-secondary text-center text-base mt-5">
          Skip for now
        </Link>
      </View>
    </SafeAreaView>
  );
}
