import * as LocalAuthentication from "expo-local-authentication";

export type BiometricResult = "success" | "cancelled" | "unavailable" | "failed";

/** What the device can actually do — drives the settings screen copy. */
export async function getBiometricCapability(): Promise<{
  available: boolean;
  label: string;
}> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  if (!hasHardware || !isEnrolled) return { available: false, label: "Device passcode" };

  const { FACIAL_RECOGNITION, FINGERPRINT, IRIS } = LocalAuthentication.AuthenticationType;
  if (types.includes(FACIAL_RECOGNITION)) return { available: true, label: "Face ID" };
  if (types.includes(FINGERPRINT)) return { available: true, label: "Fingerprint" };
  if (types.includes(IRIS)) return { available: true, label: "Iris" };
  return { available: true, label: "Biometrics" };
}

/**
 * Prompt for biometrics, falling back to the device passcode. Never
 * throws — the caller decides what a failure means, and for the app-lock
 * gate every non-success keeps the overlay up.
 */
export async function authenticate(reason: string): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // Falling back to the passcode keeps users who haven't enrolled
      // biometrics from being locked out of their own funds.
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });
    if (result.success) return "success";
    if (result.error === "user_cancel" || result.error === "app_cancel") return "cancelled";
    if (result.error === "not_available" || result.error === "not_enrolled") return "unavailable";
    return "failed";
  } catch {
    return "failed";
  }
}
