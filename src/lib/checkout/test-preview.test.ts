import { describe, expect, it } from "vitest";
import { checkoutSwitch, firestoreDatabaseId, isTestPreviewCheckout } from "./test-preview";

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
  it("keeps the config values outside the test preview", () => {
    expect(checkoutSwitch({ ...preview, VERCEL_ENV: "production" }, "test")).toEqual({ checkoutEnabled: false, allowDemoCheckoutInTestMode: false });
  });
  it("opens checkout and demo products on the test preview", () => {
    expect(checkoutSwitch(preview, "test")).toEqual({ checkoutEnabled: true, allowDemoCheckoutInTestMode: true });
  });
});
