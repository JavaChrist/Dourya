import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutSwitch, firestoreDatabaseId, isTestPreviewCheckout } from "./test-preview";

// commerceConfig.checkoutEnabled is false in the real config: flipped here only, per test.
const config = vi.hoisted(() => ({ open: false }));
vi.mock("@/config/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/commerce")>();
  return {
    ...actual,
    commerceConfig: {
      ...actual.commerceConfig,
      get checkoutEnabled() {
        return config.open;
      },
    },
  };
});
afterEach(() => {
  config.open = false;
});

const preview = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "stripe-test", CHECKOUT_ENABLED: "true", FIRESTORE_DATABASE_ID: "dourya-test" };

describe("firestoreDatabaseId", () => {
  it("production always uses the default database", () => {
    expect(firestoreDatabaseId({ ...preview, VERCEL_ENV: "production" })).toBeUndefined();
  });
  it("only the test database name is accepted elsewhere", () => {
    expect(firestoreDatabaseId(preview)).toBe("dourya-test");
    expect(firestoreDatabaseId({ FIRESTORE_DATABASE_ID: "other" })).toBeUndefined();
    expect(firestoreDatabaseId({})).toBeUndefined();
  });
});

describe("isTestPreviewCheckout", () => {
  it("opens only when every condition holds", () => {
    expect(isTestPreviewCheckout(preview, "test")).toBe(true);
  });
  it("stays closed when any condition is missing", () => {
    expect(isTestPreviewCheckout(preview, "live")).toBe(false);
    expect(isTestPreviewCheckout(preview, null)).toBe(false);
    expect(isTestPreviewCheckout({ ...preview, VERCEL_ENV: "production" }, "test")).toBe(false);
    expect(isTestPreviewCheckout({ ...preview, VERCEL_ENV: undefined }, "test")).toBe(false);
    expect(isTestPreviewCheckout({ ...preview, VERCEL_GIT_COMMIT_REF: "main" }, "test")).toBe(false);
    expect(isTestPreviewCheckout({ ...preview, CHECKOUT_ENABLED: "1" }, "test")).toBe(false);
    expect(isTestPreviewCheckout({ ...preview, FIRESTORE_DATABASE_ID: undefined }, "test")).toBe(false);
    expect(isTestPreviewCheckout({ ...preview, FIRESTORE_DATABASE_ID: "(default)" }, "test")).toBe(false);
  });
});

describe("checkoutSwitch", () => {
  const closed = { checkoutEnabled: false, allowDemoCheckoutInTestMode: false };
  const production = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };

  it("opens checkout and demo products on the test preview", () => {
    expect(checkoutSwitch(preview, "test")).toEqual({ checkoutEnabled: true, allowDemoCheckoutInTestMode: true });
  });

  it("closed config: everything outside the test preview stays closed, live key included", () => {
    expect(checkoutSwitch(production, "live")).toEqual(closed);
    expect(checkoutSwitch(production, "test")).toEqual(closed);
    expect(checkoutSwitch(production, null)).toEqual(closed);
    expect(checkoutSwitch({ ...preview, VERCEL_ENV: "production" }, "test")).toEqual(closed);
  });

  it("open config: only production with a live key sells, never with demo products", () => {
    config.open = true;
    expect(checkoutSwitch(production, "live")).toEqual({ checkoutEnabled: true, allowDemoCheckoutInTestMode: false });
  });

  it("open config: other previews, local runs and test keys stay closed", () => {
    config.open = true;
    expect(checkoutSwitch(production, "test")).toEqual(closed);
    expect(checkoutSwitch(production, null)).toEqual(closed);
    expect(checkoutSwitch({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature-x" }, "live")).toEqual(closed);
    expect(checkoutSwitch({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature-x" }, "test")).toEqual(closed);
    expect(checkoutSwitch({ ...preview, FIRESTORE_DATABASE_ID: undefined }, "test")).toEqual(closed);
    expect(checkoutSwitch(preview, "live")).toEqual(closed);
    expect(checkoutSwitch({ VERCEL_ENV: "development" }, "live")).toEqual(closed);
    expect(checkoutSwitch({}, "live")).toEqual(closed);
  });
});
