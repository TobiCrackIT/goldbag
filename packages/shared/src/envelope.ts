import { z } from "zod";
import { ApiErrorSchema, type ErrorCode } from "./errors.js";

/**
 * Every API response is `{ data }` or `{ error: { code, message } }`
 * (architecture §4.6). Route schemas are built with `apiResponse(dataSchema)`.
 */
export const ErrorResponseSchema = z.object({ error: ApiErrorSchema });
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function apiResponse<T extends z.ZodType>(dataSchema: T) {
  return z.union([z.object({ data: dataSchema }), ErrorResponseSchema]);
}
export type ApiResponse<T> = { data: T } | ErrorResponse;

export function ok<T>(data: T): { data: T } {
  return { data };
}

export function err(code: ErrorCode, message: string): ErrorResponse {
  return { error: { code, message } };
}

export function isErr<T>(res: ApiResponse<T>): res is ErrorResponse {
  return "error" in res;
}
