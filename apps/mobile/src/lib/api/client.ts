import Constants from "expo-constants";
import { Platform } from "react-native";
import type { z } from "zod";
import { ErrorCode } from "@goldbag/shared";
import { ApiError, NetworkError } from "./errors.js";

/**
 * Typed fetch client over the shared Zod contracts. Every response is
 * unwrapped from the `{data} | {error}` envelope and parsed against the
 * schema the API declares, so a contract drift fails loudly at the edge
 * rather than as `undefined` three screens later.
 */

function resolveBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "";
  // Android emulators can't see the host's localhost.
  if (Platform.OS === "android") {
    return configured.replace("localhost", "10.0.2.2").replace("127.0.0.1", "10.0.2.2");
  }
  return configured;
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Set by the session layer (task 2.3) so requests carry the wallet
 * vendor's access token. Kept as an injectable getter, not an import,
 * so the client never depends on the auth vendor.
 */
let accessTokenProvider: (() => Promise<string | null>) | null = null;
export function setAccessTokenProvider(provider: (() => Promise<string | null>) | null) {
  accessTokenProvider = provider;
}

export interface RequestOptions<TSchema extends z.ZodType> {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  schema: TSchema;
  signal?: AbortSignal;
  /** Skip the Authorization header for public endpoints. */
  anonymous?: boolean;
}

export async function request<TSchema extends z.ZodType>(
  path: string,
  options: RequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";

  if (!options.anonymous && accessTokenProvider) {
    const token = await accessTokenProvider();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    // No response at all: offline, DNS, TLS, timeout.
    throw new NetworkError(cause instanceof Error ? cause.message : undefined);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("INTERNAL", "Response was not valid JSON", response.status);
  }

  if (isErrorEnvelope(payload)) {
    const parsed = ErrorCode.safeParse(payload.error.code);
    throw new ApiError(
      parsed.success ? parsed.data : "INTERNAL",
      payload.error.message,
      response.status,
    );
  }

  if (!response.ok || !isDataEnvelope(payload)) {
    throw new ApiError("INTERNAL", `Unexpected response (${response.status})`, response.status);
  }

  const result = options.schema.safeParse(payload.data);
  if (!result.success) {
    throw new ApiError("INTERNAL", "Response did not match the expected shape", response.status);
  }
  return result.data;
}

function isErrorEnvelope(v: unknown): v is { error: { code: string; message: string } } {
  return typeof v === "object" && v !== null && "error" in v;
}

function isDataEnvelope(v: unknown): v is { data: unknown } {
  return typeof v === "object" && v !== null && "data" in v;
}
