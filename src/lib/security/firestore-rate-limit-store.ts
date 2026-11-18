import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin-db";
import type { RateLimitStore } from "./rate-limit";

/**
 * Counters in `rateLimits/{sha256(key)}`: the key (action + IP or uid) is hashed
 * so no IP address is stored in clear. Clients have no access (firestore.rules).
 * `expiresAt` can drive a Firestore TTL policy to purge old windows.
 */
export class FirestoreRateLimitStore implements RateLimitStore {
  async increment(key: string, windowStart: number, expiresAt: number): Promise<number> {
    const db = adminDb();
    const ref = db.collection("rateLimits").doc(createHash("sha256").update(key).digest("hex"));
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as { windowStart?: number; count?: number } | undefined;
      const count = data && data.windowStart === windowStart ? (data.count ?? 0) + 1 : 1;
      tx.set(ref, { windowStart, count, expiresAt: Timestamp.fromMillis(expiresAt) });
      return count;
    });
  }
}
