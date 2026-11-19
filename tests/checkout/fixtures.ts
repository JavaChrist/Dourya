import { createHmac } from "node:crypto";
import { expect } from "vitest";
import { adminDb } from "@/lib/firebase/admin-db";
import { handleStripeWebhook, type PlaceOrderDeps, type PlaceOrderInput } from "@/lib/checkout/service";
import type { StripeAccess } from "@/lib/payments/stripe";
import { StripeError, type CheckoutSession, type CreateSessionInput, type StripeClient } from "@/lib/payments/stripe-client";
import type { ShippingSettings } from "@/lib/shipping/types";
import type { Product } from "@/lib/types";

// Shared checkout fixtures for the integration tests. Fictitious data only,
// on the emulators: no real customer, product, price, rate, key or secret.

export const T0 = new Date("2026-01-10T10:00:00Z");
export const ORIGIN = "https://shop.example.test";

export const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "produit-test",
  name: "Produit test",
  description: "",
  status: "published",
  categorySlugs: [],
  collectionSlugs: [],
  images: [],
  variants: [
    { id: "v1", sku: "TEST-1", name: "A5", attributes: [], priceCents: 1000, weightGrams: 20, packedDimensionsMm: { length: 210, width: 148, height: 2 }, stockMode: "stocked", stock: 1, active: true },
  ],
  isDemo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

export const settings = (rates = true): ShippingSettings => ({
  zones: [{ code: "FR", name: "France", enabled: true }],
  rates: rates
    ? [{ id: "test-rate", enabled: true, zone: "FR", envelope: "standard", service: "letter", label: "Tarif test", priceCents: 200, packagingWeightGrams: 10, maxWeightGrams: 100, maxThicknessMm: 20, maxLengthMm: 300, maxWidthMm: 250, freeShippingEligible: false }]
    : [],
  freeShippingThresholdCents: null,
});

/** In-memory Stripe: one Checkout Session per idempotency key, states changed by the test. */
export function fakeStripe(mode: "test" | "live" = "test") {
  const sessions = new Map<string, CheckoutSession>();
  /** Like Stripe: a key already run answers with its ORIGINAL response, and only to the same parameters. */
  const byKey = new Map<string, { params: string; reply: CheckoutSession }>();
  const created: CreateSessionInput[] = [];
  let failNext: StripeError | null = null;
  /** The next session is created at Stripe but its response never reaches us (network cut). */
  let loseNext = false;
  /** Stripe's clock (unix s), once set: expires_at must then be at least 30 min ahead. */
  let clockSec: number | null = null;
  const takeFailure = () => {
    if (failNext) {
      const e = failNext;
      failNext = null;
      throw e;
    }
  };
  const client: StripeClient = {
    async createCheckoutSession(input) {
      takeFailure();
      const params = JSON.stringify(input);
      const existing = byKey.get(input.idempotencyKey);
      if (existing) {
        if (existing.params !== params) throw new StripeError("invalid_request", 400, { type: "idempotency_error" });
        return { ...existing.reply };
      }
      // Checked only for a new key, and not saved: a refused request leaves no result.
      if (clockSec !== null && input.expiresAt < clockSec + 1800) throw new StripeError("invalid_request", 400, { type: "invalid_request_error", param: "expires_at" });
      created.push(input);
      const id = `cs_test_fake${sessions.size + 1}`;
      const amountCents = input.lines.reduce((sum, l) => sum + l.unitAmountCents * l.quantity, 0) + input.shipping.amountCents;
      const session: CheckoutSession = { id, status: "open", amountCents, currency: "eur", refundedCents: 0, orderId: input.orderId, url: `https://checkout.stripe.com/c/pay/${id}` };
      sessions.set(id, session);
      byKey.set(input.idempotencyKey, { params, reply: { ...session } });
      if (loseNext) {
        loseNext = false;
        throw new StripeError("network", null);
      }
      return session;
    },
    async getCheckoutSession(id) {
      takeFailure();
      const s = sessions.get(id);
      if (!s) throw new StripeError("not_found", 404);
      return s;
    },
    async findSessionIdByPaymentIntent(pi) {
      takeFailure();
      return pi === "pi_fake1" && sessions.has("cs_test_fake1") ? "cs_test_fake1" : null;
    },
  };
  const set = (id: string, over: Partial<CheckoutSession>) => {
    const s = sessions.get(id)!;
    const next = { ...s, ...over };
    if (next.status !== "open") delete next.url;
    sessions.set(id, next);
  };
  return { access: { client, mode } satisfies StripeAccess, sessions, created, set, fail: (e: StripeError) => (failNext = e), loseNextResponse: () => (loseNext = true), setNow: (d: Date) => (clockSec = Math.floor(d.getTime() / 1000)) };
}

// Fictitious webhook secret and signed events, as Stripe would send them.
export const SECRET = `whsec_${"t".repeat(24)}`;
export const nowSec = Math.floor(T0.getTime() / 1000);
export function event(type: string, object: Record<string, unknown>, secret = SECRET) {
  const raw = JSON.stringify({ id: "evt_test", type, data: { object } });
  const sig = `t=${nowSec},v1=${createHmac("sha256", secret).update(`${nowSec}.${raw}`).digest("hex")}`;
  return { raw, sig };
}
export const webhook = (stripe: ReturnType<typeof fakeStripe> | null, e: { raw: string; sig: string }, secret: string | null = SECRET) =>
  handleStripeWebhook(e.raw, e.sig, stripe?.access ?? null, secret, T0);
export const completed = (id = "cs_test_fake1") => event("checkout.session.completed", { id });

export const order = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  attemptKey: "attempt-aaaaaaaaaaaa",
  items: [{ productId: "p1", variantId: "v1", quantity: 1 }],
  email: "client@example.test",
  address: { fullName: "Client Test", line1: "1 rue Test", postalCode: "75000", city: "Paris", country: "FR" },
  rateId: "test-rate",
  acceptTerms: true,
  expectedTotalCents: 1200,
  ...over,
});

export const deps = (stripe: ReturnType<typeof fakeStripe>, over: Partial<PlaceOrderDeps> = {}): PlaceOrderDeps => ({
  stripe: stripe.access,
  products: [product()],
  settings: settings(),
  customer: null,
  origin: ORIGIN,
  now: T0,
  ...over,
});

export const stock = async () => (await adminDb().collection("inventory").doc("p1__v1").get()).data();
export const onlyOrderId = async () => {
  const snap = await adminDb().collection("orders").get();
  expect(snap.size).toBe(1);
  return snap.docs[0].id;
};
