import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppLockSettings } from "../../../src/features/auth/app-lock/AppLockSettings";

export default function Account() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="px-6 pt-2 pb-10">
        <Text className="text-primary text-3xl font-bold">Account</Text>
        <AppLockSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
