import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEmailLogin, useSession } from "../../src/features/auth/session/context";
import { useColors } from "../../src/theme/tokens";

export default function Login() {
  const session = useSession();
  const login = useEmailLogin();
  const router = useRouter();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // The wallet is provisioned on login; land on Home once it's ready.
  useEffect(() => {
    if (session.status === "ready") router.replace("/(main)");
  }, [session.status, router]);

  const busy = login.state.step === "sending" || login.state.step === "verifying";
  const awaitingCode =
    login.state.step === "awaiting_code" || login.state.step === "verifying";
  const errorMessage = login.state.step === "error" ? login.state.message : null;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-6 pt-8">
        <Text className="text-primary text-3xl font-bold">
          {awaitingCode ? "Check your email" : "Sign in"}
        </Text>
        <Text className="text-secondary text-base mt-3 leading-6">
          {awaitingCode
            ? "We sent you a 6-digit code. It expires in a few minutes."
            : "We'll email you a code. No password, no seed phrase."}
        </Text>

        {awaitingCode ? (
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="mt-8 rounded-2xl border border-border bg-surface px-4 py-4 text-primary text-2xl tracking-[8px]"
          />
        ) : (
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            className="mt-8 rounded-2xl border border-border bg-surface px-4 py-4 text-primary text-lg"
          />
        )}

        {errorMessage ? (
          <Text className="text-primary text-sm mt-3">{errorMessage}</Text>
        ) : null}

        <Pressable
          disabled={busy}
          accessibilityRole="button"
          onPress={() =>
            void (awaitingCode ? login.submitCode(code) : login.sendCode(email))
          }
          className={`mt-6 rounded-2xl bg-accent py-4 items-center ${busy ? "opacity-60" : "active:opacity-70"}`}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text className="text-on-accent text-lg font-semibold">
              {awaitingCode ? "Verify" : "Send code"}
            </Text>
          )}
        </Pressable>

        {awaitingCode ? (
          <Pressable
            onPress={() => {
              setCode("");
              login.reset();
            }}
            accessibilityRole="button"
            className="mt-5"
          >
            <Text className="text-secondary text-center text-base">Use a different email</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
