import { Redirect } from "expo-router";

// Entry: once the session port lands (task 2.3) this branches on auth
// state. Until then it always starts onboarding.
export default function Index() {
  return <Redirect href="/welcome" />;
}
