import "server-only";

/**
 * Server logs without secrets: only an event name and short technical fields
 * (error codes, ids). Never pass tokens, cookies, passwords or full e-mails.
 */
export function logEvent(event: string, fields: Record<string, string | number | boolean | undefined> = {}): void {
  console.warn(`[dourya] ${event}`, JSON.stringify(fields));
}

/** Firebase errors expose a `code` such as "auth/session-cookie-expired". */
export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.name : "unknown";
}
