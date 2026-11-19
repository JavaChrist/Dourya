import { describe, expect, it, vi } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { placeOrder } from "@/lib/checkout/service";
import { getOrder } from "@/lib/orders/repository";
import { createStripeClient, STRIPE_API, StripeError, stripeKeyMode, type StripeClient } from "@/lib/payments/stripe-client";
import { deps, fakeStripe, onlyOrderId, order, stock } from "./fixtures";

// Real Stripe TEST account, Firestore emulator: lost response then replay of
// the same idempotency key once its expires_at would be refused for a new
// session. Runs only with STRIPE_TEST_KEY (sk_test_/rk_test_) in the env:
//   npm run test:stripe-real
// Never prints the key, the session URL or any customer value: ids, statuses
// and counts only. The session is never paid and is expired at the end.

vi.mock("@/config/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/commerce")>();
  return { ...actual, commerceConfig: { ...actual.commerceConfig, checkoutEnabled: true } };
});

const KEY = process.env.STRIPE_TEST_KEY?.trim();
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
const report = (label: string, value: unknown) => console.log(`[stripe-real] ${label}: ${JSON.stringify(value)}`);

/** Raw call for what the shop client does not need (list, expire). Errors keep the status only. */
async function stripeRaw(key: string, path: string, method: "GET" | "POST" = "GET"): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, { method, headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`stripe_raw_${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

describe.skipIf(!KEY)("Stripe Test (real): lost response, replay with the same key", () => {
  it("returns the same cs_test_ session, one session at Stripe, one order, one hold", { timeout: 12 * 60_000 }, async () => {
    // Refuses anything but a Test key (the value itself is never shown).
    if (stripeKeyMode(KEY) !== "test") throw new Error("STRIPE_TEST_KEY refused: a Test key (sk_test_ / rk_test_) is required");
    const key = KEY!;
    await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });

    const real = createStripeClient(key);
    const startedSec = Math.floor(Date.now() / 1000) - 5;
    let hiddenId: string | null = null;
    const returnedIds: string[] = [];
    let calls = 0;
    // First creation really reaches Stripe, then its response is thrown away (network cut).
    const client: StripeClient = {
      ...real,
      async createCheckoutSession(input) {
        calls += 1;
        const session = await real.createCheckoutSession(input);
        if (hiddenId === null) {
          hiddenId = session.id;
          throw new StripeError("network", null);
        }
        returnedIds.push(session.id);
        return session;
      },
    };
    const base = deps(fakeStripe(), { stripe: { client, mode: "test" } });
    const input = order({ email: "client-test@example.com" });

    // 1. Session created at Stripe, response lost: draft kept with its stored request.
    const first = await placeOrder(input, { ...base, now: new Date() });
    expect(first).toMatchObject({ code: "payment_error" });
    expect(hiddenId).toMatch(/^cs_test_/);
    const id = await onlyOrderId();
    expect((await getOrder(id))?.paymentStatus).toBe("draft");
    const stored = (await adminDb().collection("orders").doc(id).get()).get("paymentRequest") as { idempotencyKey: string; expiresAt: number };
    expect(stored.idempotencyKey).toBe(`${input.attemptKey}-${id}`);
    report("step1", { order: id, hiddenSession: hiddenId, stripeCalls: calls });

    // 2. Wait until this expires_at is less than 30 min ahead (+ margin).
    const waitMs = Math.max(0, (stored.expiresAt - 1800 + 20) * 1000 - Date.now());
    report("wait_seconds", Math.round(waitMs / 1000));
    await new Promise((r) => setTimeout(r, waitMs));

    // 3. Control: the same expires_at under a NEW key is refused and creates nothing.
    const control = await real
      .createCheckoutSession({
        orderId: `control-${id}`,
        lines: [{ name: "Controle", unitAmountCents: 100, quantity: 1 }],
        shipping: { label: "Controle", amountCents: 0 },
        email: "client-test@example.com",
        successUrl: "https://shop.example.test/ok",
        cancelUrl: "https://shop.example.test/ko",
        expiresAt: stored.expiresAt,
        idempotencyKey: `control-${id}-${Date.now()}`,
      })
      .then(() => "created", (e: unknown) => (e instanceof StripeError ? { status: e.status, category: e.category, param: e.detail?.param } : "other_error"));
    report("control_new_key", control);
    expect(control).toEqual({ status: 400, category: "invalid_request", param: "expires_at" });

    // 4. Same attempt again: the stored request is replayed with the same key.
    const retry = await placeOrder(input, { ...base, now: new Date() });
    expect(retry.kind).toBe("redirect");
    expect(returnedIds).toEqual([hiddenId]);
    expect(await onlyOrderId()).toBe(id);
    const after = await getOrder(id);
    expect({ status: after?.paymentStatus, ref: after?.paymentRef }).toEqual({ status: "awaiting_payment", ref: hiddenId });
    expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });

    // 5. Stripe side: exactly one session carries this order.
    const list = await stripeRaw(key, `/checkout/sessions?created[gte]=${startedSec}&limit=100`);
    const mine = (list.data as { id: string; metadata?: { orderId?: string } }[]).filter((s) => s.metadata?.orderId === id).map((s) => s.id);
    expect(mine).toEqual([hiddenId]);
    report("result", { sameSession: returnedIds[0] === hiddenId, sessionsForOrder: mine.length, orders: 1, reserved: 1, stripeCalls: calls });

    // 6. Cleanup: the unpaid test session is expired.
    const expired = await stripeRaw(key, `/checkout/sessions/${hiddenId}/expire`, "POST");
    report("cleanup", { session: hiddenId, status: expired.status });
    expect(expired.status).toBe("expired");
  });
});
