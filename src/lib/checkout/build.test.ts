import { describe, expect, it } from "vitest";
import type { ShippingSettings } from "@/lib/shipping/types";
import type { Product } from "@/lib/types";
import { buildCheckout, checkoutGate } from "./build";

// Fictitious product and rate: no real price or tariff.
const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "produit-test",
  name: "Produit test",
  description: "",
  status: "published",
  categorySlugs: [],
  collectionSlugs: [],
  images: [],
  variants: [
    { id: "v1", sku: "TEST-1", name: "A5", attributes: [], priceCents: 1000, weightGrams: 20, packedDimensionsMm: { length: 210, width: 148, height: 2 }, stockMode: "stocked", stock: 3, active: true },
  ],
  isDemo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const settings: ShippingSettings = {
  zones: [{ code: "FR", name: "France", enabled: true }],
  rates: [{ id: "test-rate", enabled: true, zone: "FR", envelope: "standard", service: "letter", label: "Tarif test", priceCents: 200, packagingWeightGrams: 10, maxWeightGrams: 100, maxThicknessMm: 20, maxLengthMm: 300, maxWidthMm: 250, freeShippingEligible: false }],
  freeShippingThresholdCents: null,
};

describe("checkoutGate", () => {
  const open = { checkoutEnabled: true, allowLive: false, allowDemoCheckoutInTestMode: false };

  it("is closed by default (real config)", () => {
    expect(checkoutGate({ keyMode: "test", hasDemo: false })).toBe("checkout_closed");
  });

  it("needs a key, refuses live unless allowed", () => {
    expect(checkoutGate({ ...open, keyMode: null, hasDemo: false })).toBe("payment_not_configured");
    expect(checkoutGate({ ...open, keyMode: "live", hasDemo: false })).toBe("live_refused");
    expect(checkoutGate({ ...open, allowLive: true, keyMode: "live", hasDemo: false })).toBeNull();
    expect(checkoutGate({ ...open, keyMode: "test", hasDemo: false })).toBeNull();
  });

  it("demo products: only in test mode and only when allowed, never live", () => {
    expect(checkoutGate({ ...open, keyMode: "test", hasDemo: true })).toBe("demo_products");
    expect(checkoutGate({ ...open, allowDemoCheckoutInTestMode: true, keyMode: "test", hasDemo: true })).toBeNull();
    expect(checkoutGate({ ...open, allowLive: true, allowDemoCheckoutInTestMode: true, keyMode: "live", hasDemo: true })).toBe("demo_products");
  });
});

describe("buildCheckout", () => {
  const items = [{ productId: "p1", variantId: "v1", quantity: 2 }];

  it("builds lines, holds and the total from the server catalogue", () => {
    const d = buildCheckout({ items, products: [product()], settings, country: "FR", rateId: "test-rate" });
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]).toMatchObject({ sku: "TEST-1", unitPriceCents: 1000, quantity: 2, lineTotalCents: 2000 });
    expect(d.holds).toEqual([{ key: "p1__v1", quantity: 2, initialStock: 3 }]);
    expect(d).toMatchObject({ subtotalCents: 2000, shippingCents: 200, totalCents: 2200, cartChanged: false });
    expect(d.shipping).toMatchObject({ rateId: "test-rate", zone: "FR" });
  });

  it("without a valid rate the total stays null", () => {
    expect(buildCheckout({ items, products: [product()], settings, country: "FR", rateId: "nope" }).totalCents).toBeNull();
    expect(buildCheckout({ items, products: [product()], settings, country: "FR" }).totalCents).toBeNull();
  });

  it("a quantity lowered by stock or a removed product marks the cart changed", () => {
    const low = product({ variants: [{ ...product().variants[0], stock: 1 }] });
    expect(buildCheckout({ items, products: [low], settings, country: "FR", rateId: "test-rate" }).cartChanged).toBe(true);
    const gone = buildCheckout({ items, products: [], settings, country: "FR", rateId: "test-rate" });
    expect(gone.cartChanged).toBe(true);
    expect(gone.lines).toHaveLength(0);
  });

  it("ignores prices sent by the browser", () => {
    const d = buildCheckout({ items: [{ ...items[0], priceCents: 1 }], products: [product()], settings, country: "FR", rateId: "test-rate" });
    expect(d.subtotalCents).toBe(2000);
  });
});
