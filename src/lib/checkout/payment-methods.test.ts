import { describe, expect, it } from "vitest";
import { paymentMethods } from "./payment-methods";

const preview = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "stripe-test", CHECKOUT_ENABLED: "true", FIRESTORE_DATABASE_ID: "dourya-test" };
const production = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
const hidden = { applePay: { shown: false, logo: null }, googlePay: { shown: false, logo: null } };
const ids = (list: { id: string }[]) => list.map((m) => m.id);

describe("paymentMethods", () => {
  it("public site with the real config: card only", () => {
    expect(ids(paymentMethods(production, "live"))).toEqual(["card"]);
    expect(ids(paymentMethods(production, null))).toEqual(["card"]);
  });

  it("wallets appear once validated, each on its own flag, with the official logo when given", () => {
    const apple = { ...hidden, applePay: { shown: true, logo: "/images/payments/apple-pay-mark.svg" } };
    expect(paymentMethods(production, "live", apple)).toEqual([
      { id: "card", label: "Carte bancaire", logo: null },
      { id: "apple_pay", label: "Apple Pay", logo: "/images/payments/apple-pay-mark.svg" },
    ]);
    expect(ids(paymentMethods(production, "live", { ...hidden, googlePay: { shown: true, logo: null } }))).toEqual(["card", "google_pay"]);
  });

  it("the stripe-test preview shows all three to check the layout, never another preview", () => {
    expect(ids(paymentMethods(preview, "test", hidden))).toEqual(["card", "apple_pay", "google_pay"]);
    expect(ids(paymentMethods({ ...preview, VERCEL_GIT_COMMIT_REF: "feature-x" }, "test", hidden))).toEqual(["card"]);
    expect(ids(paymentMethods(preview, "live", hidden))).toEqual(["card"]);
  });
});
