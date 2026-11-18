import { describe, expect, it } from "vitest";
import { MemoryTransport, mapResendError } from "./transport";

describe("mapResendError", () => {
  it("retries rate limits, idempotency races and outages only", () => {
    expect(mapResendError({ statusCode: 429 })).toEqual({ error: "rate_limited", retryable: true });
    expect(mapResendError({ statusCode: 409, name: "concurrent_idempotent_requests" })).toEqual({ error: "unavailable", retryable: true });
    expect(mapResendError({ statusCode: 503 })).toEqual({ error: "unavailable", retryable: true });
    expect(mapResendError(null)).toEqual({ error: "unavailable", retryable: true });
    expect(mapResendError({ statusCode: 422, name: "validation_error" })).toEqual({ error: "rejected", retryable: false });
  });
});

describe("MemoryTransport", () => {
  const email = { from: "a@test.test", to: "b@test.test", subject: "S", html: "<p>h</p>", text: "t" };
  it("keeps e-mails in memory and honours the idempotency key", async () => {
    const t = new MemoryTransport(2);
    const first = await t.send({ ...email, idempotencyKey: "k1" });
    const again = await t.send({ ...email, idempotencyKey: "k1" });
    expect(again).toEqual(first);
    expect(t.sent).toHaveLength(1);
    await t.send(email);
    await t.send(email);
    expect(t.sent).toHaveLength(2);
    t.clear();
    expect(t.sent).toHaveLength(0);
  });
});
