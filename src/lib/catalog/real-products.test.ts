import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { realProducts } from "@/data/real-products";
import { photoGalleries } from "@/data/product-galleries.generated";
import { isDraftPreview } from "./draft-preview";
import { getListedProducts, getProductForPage, getShownProducts } from "./index";
import { isShown, isVariantPurchasable, productPageState, stockToValidate } from "./visibility";

const priceOf = (slug: string) => realProducts.find((p) => p.slug === slug)?.variants[0].priceCents;

describe("real product galleries (drafts)", () => {
  it("has the 29 galleries (145 photos) plus the Twilight print pack, each file present in public/", () => {
    expect(photoGalleries).toHaveLength(29);
    expect(photoGalleries.flatMap((g) => g.images)).toHaveLength(145);
    expect(realProducts).toHaveLength(30);
    expect(new Set(realProducts.map((p) => p.slug)).size).toBe(30);
    for (const img of realProducts.flatMap((p) => p.images)) {
      expect(existsSync(path.join(process.cwd(), "public", img.src)), img.src).toBe(true);
      expect(img.width).toBeGreaterThan(0);
      expect(img.alt).not.toBe("");
    }
  });

  it("applies the validated price grid, in cents", () => {
    expect(priceOf("sticker-fee")).toBe(195);
    expect(priceOf("sticker-pack-bookish")).toBe(695);
    expect(priceOf("sticker-pack-twilight")).toBe(695);
    expect(priceOf("print-chat-roi-1")).toBe(695);
    expect(priceOf("print-twilight")).toBe(695);
    expect(priceOf("pack-prints-twilight")).toBe(2995);
    expect(priceOf("porte-cles-nokio")).toBe(595);
    expect(priceOf("blindbox-lala")).toBe(650);
    expect(priceOf("blindbox-chaton-mystere")).toBe(195);
    expect(priceOf("headband-1")).toBe(995);
    expect(priceOf("dopamine-mailclub")).toBe(1195);
    for (const p of realProducts) for (const v of p.variants) expect(Number.isInteger(v.priceCents), p.slug).toBe(true);
  });

  it("keeps the blindbox galleries (possible models) and the Twilight pack on the print photos", () => {
    const lala = realProducts.find((p) => p.slug === "blindbox-lala");
    expect(lala?.images[0].src).toContain("/porte-cles-lala/");
    expect(lala?.images).toHaveLength(10);
    expect(realProducts.find((p) => p.slug === "blindbox-chaton-mystere")?.images).toHaveLength(9);
    const single = realProducts.find((p) => p.slug === "print-twilight");
    const pack = realProducts.find((p) => p.slug === "pack-prints-twilight");
    expect(pack?.images.map((i) => i.src)).toEqual(single?.images.map((i) => i.src));
  });

  it("keeps every one a draft, real (not demo), stock to validate, and never purchasable", () => {
    for (const p of realProducts) {
      expect(p.status).toBe("draft");
      expect(p.isDemo).toBe(false);
      for (const v of p.variants) {
        expect(v.stock ?? null).toBeNull();
        expect(stockToValidate(v)).toBe(true);
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
