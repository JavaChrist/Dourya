import "server-only";
import { headers } from "next/headers";
import { logEvent } from "@/lib/log";
import { FirestoreRateLimitStore } from "./firestore-rate-limit-store";
import { RATE_LIMITS, checkRateLimit, type RateLimitAction } from "./rate-limit";

const store = new FirestoreRateLimitStore();

/** Client IP as seen by the hosting proxy (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Returns true when the action is allowed for this IP (and this account when given).
 * If the limiter store fails, the action is refused (fail closed) for sensitive actions.
 */
export async function allowAction(action: RateLimitAction, uid?: string): Promise<boolean> {
  const ip = await clientIp();
  return allowAll([[action, `ip:${ip}`], ...(uid ? [[action, `uid:${uid}`] as [RateLimitAction, string]] : [])]);
}

/**
 * Same check with a different rule per subject, e.g. per IP and per hashed address.
 * The store hashes every key, so no IP or address is stored in clear. Fails closed.
 */
export async function allowAll(checks: [RateLimitAction, string][]): Promise<boolean> {
  const action = checks[0]?.[0] ?? "unknown";
  try {
    for (const [name, subject] of checks) {
      const result = await checkRateLimit(store, name, subject, RATE_LIMITS[name]);
      if (!result.allowed) {
        logEvent("rate_limited", { action: name });
        return false;
      }
    }
    return true;
  } catch (error) {
    logEvent("rate_limit_store_error", { action, error: error instanceof Error ? error.name : "unknown" });
    return false;
  }
}
