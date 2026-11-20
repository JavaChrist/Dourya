import { describe, expect, it } from "vitest";
import { product, variant } from "@/test/factories";
import type { ShippingRate } from "@/lib/shipping/types";
import { isReady, readinessChecks, type ReadinessInput } from "./readiness";

const rate = (over: Partial<ShippingRate> = {}): ShippingRate => ({
  id: "r1",
  enabled: true,
  zone: "FR",
  envelope: "standard",
  service: "tracked",
  label: "Lettre suivie",
  priceCents: 500,
  packagingWeightGrams: 20,
  maxWeightGrams: 500,
  maxThicknessMm: 30,
  maxLengthMm: 350,
  maxWidthMm: 250,
  freeShippingEligible: false,
  ...over,
});

const ready: ReadinessInput = {
  vercelEnv: "production",
  keyMode: "live",
  webhookSecretSet: true,
  email: { mode: "resend", missing: [] },
  allowLive: true,
  checkoutEnabled: true,
  mailClubLiveEnabled: false,
  taxConfirmed: true,
  shipping: { zones: [{ code: "FR", name: "France", enabled: true }, { code: "BE", name: "Belgique", enabled: false }], rates: [rate()] },
  listed: [product()],
  databaseId: undefined,
  siteOrigin: "https://dourya.fr",
  productionOrigin: "https://dourya.fr",
};

const check = (input: ReadinessInput, id: string) => readinessChecks(input).find((c) => c.id === id)!;

describe("readinessChecks", () => {
  it("is ready when every required check passes (the Mail Club is optional)", () => {
    const checks = readinessChecks(ready);
    expect(checks.filter((c) => c.required).every((c) => c.ok)).toBe(true);
    expect(check(ready, "mail_club").ok).toBe(false);
    expect(isReady(checks)).toBe(true);
  });

  it("matches today's state: test key, switches off, nothing for sale", () => {
    const today: ReadinessInput = {
      ...ready,
      keyMode: "test",
      allowLive: false,
      checkoutEnabled: false,
      taxConfirmed: false,
      shipping: { zones: ready.shipping.zones, rates: [] },
      listed: [product({ isDemo: true })],
    };
    const failed = readinessChecks(today).filter((c) => !c.ok).map((c) => c.id);
    expect(failed).toEqual(["stripe_key", "tax", "shipping", "products", "demo", "allow_live", "checkout", "mail_club"]);
    expect(isReady(readinessChecks(today))).toBe(false);
  });

  it("names the missing e-mail variables, never a value", () => {
    const c = check({ ...ready, email: { mode: "resend", missing: ["EMAIL_FROM", "RESEND_API_KEY"] } }, "email");
    expect(c.ok).toBe(false);
    expect(c.detail).toBe("Variables manquantes : EMAIL_FROM, RESEND_API_KEY.");
    expect(check({ ...ready, email: { mode: "firebase", missing: [] } }, "email").detail).toContain("firebase");
  });

  it("flags an open zone without a rate, and a disabled rate does not count", () => {
    const zones = [{ code: "FR", name: "France", enabled: true }, { code: "BE", name: "Belgique", enabled: true }];
    const c = check({ ...ready, shipping: { zones, rates: [rate(), rate({ id: "r2", zone: "BE", enabled: false })] } }, "shipping");
    expect(c.ok).toBe(false);
    expect(c.detail).toBe("Avec tarif : FR. Ouvertes sans tarif : BE.");
  });

  it("counts only real products with a price and stock (or made to order)", () => {
    const listed = [
      product({ id: "a", variants: [variant({ stockMode: "stocked", stock: 0 })] }),
      product({ id: "b", variants: [variant({ priceCents: null })] }),
      product({ id: "c", variants: [variant({ active: false })] }),
    ];
    expect(check({ ...ready, listed }, "products").ok).toBe(false);
    expect(check({ ...ready, listed: [...listed, product({ id: "d", variants: [variant({ stockMode: "stocked", stock: 3 })] })] }, "products").ok).toBe(true);
  });

  it("refuses a preview, the test database and another site address", () => {
    expect(check({ ...ready, vercelEnv: "preview" }, "deployment").ok).toBe(false);
    expect(check({ ...ready, vercelEnv: undefined }, "deployment").detail).toContain("absent");
    expect(check({ ...ready, databaseId: "dourya-test" }, "database").ok).toBe(false);
    expect(check({ ...ready, siteOrigin: "http://localhost:3000" }, "site").ok).toBe(false);
    expect(check({ ...ready, keyMode: null }, "stripe_key").detail).toBe("Aucune clé valide.");
    expect(check({ ...ready, keyMode: null, keyIssue: "publishable" }, "stripe_key").detail).toBe("Aucune clé valide : clé publiable (pk_) au lieu de la clé secrète (sk_).");
  });
});
