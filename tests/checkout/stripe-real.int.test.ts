import { describe, expect, it, vi } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { placeOrder } from "@/lib/checkout/service";
import { getOrder } from "@/lib/orders/repository";
import { createStripeClient, encodeForm, STRIPE_API, StripeError, stripeKeyMode, type StripeClient } from "@/lib/payments/stripe-client";
import { deps, fakeStripe, onlyOrderId, order, stock } from "./fixtures";

// Real Stripe TEST account, Firestore emulator. Runs only with STRIPE_TEST_KEY
// (sk_test_/rk_test_) in the env:  .\scripts\stripe-test.ps1 -Task test
// Never prints the key, a session URL or any customer value: ids, statuses,
// UTC times and counts only. No session is ever paid; every session created
// here is expired in a finally block, even when an assertion fails.

vi.mock("@/config/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/commerce")>();
  return { ...actual, commerceConfig: { ...actual.commerceConfig, checkoutEnabled: true } };
});

const KEY = process.env.STRIPE_TEST_KEY?.trim();
const TEST_EMAIL = "client-test@example.com";
const host = () => process.env.FIRESTORE_EMULATOR_HOST;
const report = (label: string, value: unknown) => console.log(`[stripe-real] ${label}: ${JSON.stringify(value)}`);
const utc = (sec: number) => new Date(sec * 1000).toISOString();
const nowSec = () => Math.floor(Date.now() / 1000);

function testKey(): string {
  if (stripeKeyMode(KEY) !== "test") throw new Error("STRIPE_TEST_KEY refused: a Test key (sk_test_ / rk_test_) is required");
  return KEY!;
}

type RawSession = { id: string; status?: string; created?: number; expires_at?: number; metadata?: { orderId?: string } };

/** Raw call for what the shop client does not expose. Errors keep the status and Stripe's param only. */
async function stripeRaw(key: string, path: string, init: { method?: "GET" | "POST"; body?: string; idempotencyKey?: string } = {}): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  if (init.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}`, { method: init.method ?? "GET", body: init.body, headers, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const param = (body.error as { param?: unknown } | undefined)?.param;
    throw Object.assign(new Error(`stripe_raw_${res.status}`), { status: res.status, param: typeof param === "string" ? param : undefined });
  }
  return body;
}

/** Expires each session still open; reports, never throws (cleanup must not hide the real failure). */
async function expireAll(key: string, ids: Iterable<string>) {
  for (const id of ids) {
    try {
      const s = (await stripeRaw(key, `/checkout/sessions/${id}`)) as RawSession;
      const status = s.status === "open" ? ((await stripeRaw(key, `/checkout/sessions/${id}/expire`, { method: "POST" })) as RawSession).status : s.status;
      report("cleanup", { session: id, status });
    } catch (e) {
      report("cleanup_failed", { session: id, error: (e as Error).message });
    }
  }
}

describe.skipIf(!KEY)("Stripe Test (real)", () => {
  it("lost response, replay with the same key after the wait: same cs_test_, one session, one order, one hold", { timeout: 12 * 60_000 }, async () => {
    const key = testKey();
    await fetch(`http://${host()}/emulator/v1/projects/demo-dourya/databases/(default)/documents`, { method: "DELETE" });

    const real = createStripeClient(key);
    const startedSec = nowSec() - 5;
    const toExpire = new Set<string>();
    let hiddenId: string | null = null;
    const returnedIds: string[] = [];
    let calls = 0;
    // First creation really reaches Stripe, then its response is thrown away (network cut).
    const client: StripeClient = {
      ...real,
      async createCheckoutSession(input) {
        calls += 1;
        const session = await real.createCheckoutSession(input);
        toExpire.add(session.id);
        if (hiddenId === null) {
          hiddenId = session.id;
          throw new StripeError("network", null);
        }
        returnedIds.push(session.id);
        return session;
      },
    };
    const base = deps(fakeStripe(), { stripe: { client, mode: "test" } });
    const input = order({ email: TEST_EMAIL });

    try {
      // 1. Session created at Stripe, response lost: draft kept with its stored request.
      const sentAt = nowSec();
      const first = await placeOrder(input, { ...base, now: new Date(sentAt * 1000) });
      expect(first).toMatchObject({ code: "payment_error" });
      expect(hiddenId).toMatch(/^cs_test_/);
      const id = await onlyOrderId();
      expect((await getOrder(id))?.paymentStatus).toBe("draft");
      const stored = (await adminDb().collection("orders").doc(id).get()).get("paymentRequest") as { idempotencyKey: string; expiresAt: number };
      expect(stored.idempotencyKey).toBe(`${input.attemptKey}-${id}`);
      const hidden = (await stripeRaw(key, `/checkout/sessions/${hiddenId}`)) as RawSession;
      report("step1", {
        order: id,
        hiddenSession: hiddenId,
        localSentUtc: utc(sentAt),
        stripeCreatedUtc: hidden.created ? utc(hidden.created) : null,
        clockSkewS: hidden.created ? hidden.created - sentAt : null,
        expiresAtUtc: utc(stored.expiresAt),
        stripeExpiresAtUtc: hidden.expires_at ? utc(hidden.expires_at) : null,
        gapAtCreationS: stored.expiresAt - sentAt,
      });

      // 2. Wait until expires_at is less than 30 min ahead (+ margin).
      const waitMs = Math.max(0, (stored.expiresAt - 1800 + 20) * 1000 - Date.now());
      report("wait_seconds", Math.round(waitMs / 1000));
      await new Promise((r) => setTimeout(r, waitMs));

      // 3. Same attempt again: the stored request is replayed with the same key, first.
      const replayAt = nowSec();
      report("replay", { localUtc: utc(replayAt), expiresAtUtc: utc(stored.expiresAt), gapS: stored.expiresAt - replayAt });
      const retry = await placeOrder(input, { ...base, now: new Date(replayAt * 1000) });
      expect(retry.kind).toBe("redirect");
      expect(returnedIds).toEqual([hiddenId]);
      expect(await onlyOrderId()).toBe(id);
      const after = await getOrder(id);
      expect({ status: after?.paymentStatus, ref: after?.paymentRef }).toEqual({ status: "awaiting_payment", ref: hiddenId });
      expect(await stock()).toMatchObject({ stock: 1, reserved: 1 });

      // 4. Stripe side: exactly one session carries this order.
      const list = await stripeRaw(key, `/checkout/sessions?created[gte]=${startedSec}&limit=100`);
      const mine = (list.data as RawSession[]).filter((s) => s.metadata?.orderId === id).map((s) => s.id);
      report("result", { sameSession: returnedIds[0] === hiddenId, sessionsForOrder: mine.length, orders: 1, reserved: 1, stripeCalls: calls });
      expect(mine).toEqual([hiddenId]);
    } finally {
      await expireAll(key, toExpire);
    }
  });

  // Informative, isolated: does Stripe refuse a NEW session whose expires_at is
  // under 30 min ahead? Logs Stripe's own clock for each gap; asserts nothing on
  // acceptance (the shop does not rely on it), and expires whatever it created.
  it("control: new key with expires_at under 30 min ahead (logged, cleaned up)", { timeout: 2 * 60_000 }, async () => {
    const key = testKey();
    const created: string[] = [];
    try {
      for (const gap of [1780, 1500, 900]) {
        const sentAt = nowSec();
        const expiresAt = sentAt + gap;
        const body = encodeForm({
          mode: "payment",
          customer_email: TEST_EMAIL,
          line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 100, product_data: { name: "Controle" } } }],
          metadata: { orderId: `control-${sentAt}-${gap}` },
          success_url: "https://shop.example.test/ok",
          cancel_url: "https://shop.example.test/ko",
          expires_at: expiresAt,
        });
        const outcome = await stripeRaw(key, "/checkout/sessions", { method: "POST", body, idempotencyKey: `control-${sentAt}-${gap}` }).then(
          (s) => {
            const session = s as RawSession;
            created.push(session.id);
            return { accepted: true, session: session.id, stripeCreatedUtc: session.created ? utc(session.created) : null, stripeGapS: session.created ? expiresAt - session.created : null };
          },
          (e: { status?: number; param?: string }) => ({ accepted: false, status: e.status ?? null, param: e.param ?? null }),
        );
        report("control", { localUtc: utc(sentAt), expiresAtUtc: utc(expiresAt), localGapS: gap, ...outcome });
      }
    } finally {
      await expireAll(key, created);
    }
  });
});
