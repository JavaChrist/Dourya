import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { realProducts } from "@/data/real-products";
import { isDraftPreview } from "./draft-preview";
import { getListedProducts, getProductForPage, getShownProducts } from "./index";
import { isShown, isVariantPurchasable, productPageState } from "./visibility";

describe("real product galleries (drafts)", () => {
  it("has the 29 galleries and 145 photos, each file present in public/", () => {
    expect(realProducts).toHaveLength(29);
    expect(realProducts.flatMap((p) => p.images)).toHaveLength(145);
    expect(new Set(realProducts.map((p) => p.slug)).size).toBe(29);
    for (const img of realProducts.flatMap((p) => p.images)) {
      expect(existsSync(path.join(process.cwd(), "public", img.src)), img.src).toBe(true);
      expect(img.width).toBeGreaterThan(0);
      expect(img.alt).not.toBe("");
    }
  });

  it("keeps every one a draft, real (not demo), with no invented price or stock", () => {
    for (const p of realProducts) {
      expect(p.status).toBe("draft");
      expect(p.isDemo).toBe(false);
      for (const v of p.variants) {
        expect(v.priceCents).toBeNull();
        expect(v.stock ?? null).toBeNull();
        expect(isVariantPurchasable(v)).toBe(false);
      }
      expect(productPageState(p)).toBe("unavailable");
    }
  });

  it("never lists them for sale or in the public pages (tests run as production)", async () => {
    const listed = new Set((await getListedProducts()).map((p) => p.id));
    const shown = new Set((await getShownProducts()).map((p) => p.id));
    for (const p of realProducts) {
      expect(listed.has(p.id)).toBe(false);
      expect(shown.has(p.id)).toBe(false);
    }
    expect(await getProductForPage("print-twilight")).toBeUndefined();
  });

  it("shows drafts with isShown only when the draft preview is on", () => {
    const draft = realProducts[0];
    expect(isShown(draft, new Set(["prints"]), false)).toBe(false);
    expect(isShown(draft, new Set(), true)).toBe(true);
  });
});

describe("isDraftPreview", () => {
  it("is on for the stripe-test preview and local next dev only", () => {
    expect(isDraftPreview({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "stripe-test" })).toBe(true);
    expect(isDraftPreview({ NODE_ENV: "development" })).toBe(true);
  });
  it("is off everywhere else", () => {
    expect(isDraftPreview({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "stripe-test" })).toBe(false);
    expect(isDraftPreview({ VERCEL_ENV: "production", NODE_ENV: "development" })).toBe(false);
    expect(isDraftPreview({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
    expect(isDraftPreview({ VERCEL_ENV: "development", NODE_ENV: "development" })).toBe(false);
    expect(isDraftPreview({ NODE_ENV: "production" })).toBe(false);
    expect(isDraftPreview({ NODE_ENV: "test" })).toBe(false);
    expect(isDraftPreview({})).toBe(false);
  });
});
