import { describe, expect, it } from "vitest";
import { MemoryRateLimitStore, checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  const rule = { limit: 3, windowMs: 60_000 };
  it("blocks after the limit and resets on the next window", async () => {
    const store = new MemoryRateLimitStore();
    const t = 1_000_000_000_000;
    for (let i = 0; i < 3; i++) expect((await checkRateLimit(store, "a", "ip:1", rule, t)).allowed).toBe(true);
    const blocked = await checkRateLimit(store, "a", "ip:1", rule, t + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect((await checkRateLimit(store, "a", "ip:2", rule, t)).allowed).toBe(true);
    expect((await checkRateLimit(store, "a", "ip:1", rule, t + 60_000)).allowed).toBe(true);
  });
});
