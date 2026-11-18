import "server-only";

/**
 * Server logs without secrets: only an event name and short technical fields
 * (error codes, ids). Never pass tokens, cookies, passwords or full e-mails.
 */
export function logEvent(event: string, fields: Record<string, string | number | boolean | undefined> = {}): void {
  console.warn(`[dourya] ${event}`, JSON.stringify(fields));
}

/** gRPC status names, indexed by their numeric code (Firestore over gRPC). */
const GRPC_STATUS = [
  "OK", "CANCELLED", "UNKNOWN", "INVALID_ARGUMENT", "DEADLINE_EXCEEDED", "NOT_FOUND", "ALREADY_EXISTS",
  "PERMISSION_DENIED", "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION", "ABORTED", "OUT_OF_RANGE",
  "UNIMPLEMENTED", "INTERNAL", "UNAVAILABLE", "DATA_LOSS", "UNAUTHENTICATED",
] as const;

function numericCode(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "number" && Number.isInteger(error.code) ? error.code : null;
}

/**
 * Firebase errors expose a string `code` such as "auth/session-cookie-expired".
 * gRPC errors (Firestore) expose a numeric one: logged as "grpc_16_UNAUTHENTICATED".
 */
export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  const code = numericCode(error);
  if (code !== null) return `grpc_${code}_${GRPC_STATUS[code] ?? "UNKNOWN_CODE"}`;
  return error instanceof Error ? error.name : "unknown";
}

/** Closed list of categories: the only thing logged about a provider error, never its message. */
export type ErrorCategory =
  | "auth_invalid_grant"
  | "auth_key_format"
  | "auth_credentials"
  | "permission_denied"
  | "api_disabled"
  | "database_not_found"
  | "unavailable"
  | "timeout"
  | "other";

/**
 * Sorts a Firestore / Google error into a known category. The raw message is matched
 * against fixed patterns here and never returned or logged (it may hold project details).
 */
export function errorCategory(error: unknown): ErrorCategory {
  const code = numericCode(error);
  const raw = error && typeof error === "object" ? [("details" in error ? error.details : ""), ("message" in error ? error.message : "")] : [];
  const text = raw.filter((part): part is string => typeof part === "string").join(" ").toLowerCase();
  if (text.includes("invalid_grant")) return "auth_invalid_grant";
  if (["decoder routines", "no start line", "bad base64", "asn1", "unsupported key", "pem"].some((part) => text.includes(part))) return "auth_key_format";
  if (code === 16 || text.includes("getting metadata from plugin failed") || text.includes("invalid jwt")) return "auth_credentials";
  if (code === 7) return text.includes("has not been used") || text.includes("service_disabled") || text.includes("is disabled") ? "api_disabled" : "permission_denied";
  if (code === 5 && text.includes("database")) return "database_not_found";
  if (code === 14) return "unavailable";
  if (code === 4) return "timeout";
  return "other";
}
