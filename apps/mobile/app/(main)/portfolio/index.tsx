import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Portfolio() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-6 pt-4">
        <Text className="text-primary text-2xl font-semibold">Portfolio</Text>
      </View>
    </SafeAreaView>
  );
}
