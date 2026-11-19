import { describe, expect, it } from "vitest";
import { realProducts } from "@/data/real-products";
import type { Product } from "@/lib/types";
import { firestoreDatabaseId, isTestPreviewCheckout } from "@/lib/checkout/test-preview";
import { commerceConfig } from "@/config/commerce";
import { catalogAdminState, catalogBucket, catalogCategoriesMerged, catalogStoreMerged, draftPhotoPath, isDraftPhotoUrl, PHOTO_FILE_PATTERN, PRODUCT_ID_PATTERN } from "./admin-gate";
import { fixtures } from "./fixtures";
import { planImport, PUBLIC_PHOTO_PREFIX, toStoredProductDoc } from "./import-plan";
import { addStoredCategories, mergeCategories, mergeProducts } from "./merge";
import { linkVariantImages, parseEuros, parseStoredProduct, slugify, sniffImage, validateCategoryForm, validateProductForm } from "./stored-schema";
import { isListed } from "./visibility";

const preview = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "stripe-test", FIRESTORE_DATABASE_ID: "dourya-test", FIREBASE_ADMIN_PROJECT_ID: "dourya-shop" };

describe("catalogue admin gate", () => {
  it("opens on dourya.fr in mode production, with the production database and bucket", () => {
    const production = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dourya-shop.firebasestorage.app", FIREBASE_ADMIN_PROJECT_ID: "dourya-shop" };
    expect(catalogAdminState(production)).toEqual({ enabled: true, bucket: "dourya-shop.firebasestorage.app", mode: "production" });
    // Never the test database in production, even if the variable were set there.
    expect(firestoreDatabaseId({ ...production, FIRESTORE_DATABASE_ID: "dourya-test" })).toBeUndefined();
    expect(catalogAdminState({ VERCEL_ENV: "production" })).toEqual({ enabled: false, reason: "bucket" });
    // The public shop of dourya.fr never merges the stored catalogue (working rubriques, drafts).
    expect(catalogStoreMerged(production)).toBe(false);
    expect(catalogStoreMerged(preview)).toBe(true);
    expect(catalogStoreMerged({})).toBe(false);
    // ...but its new visible rubriques are shown there (filters, category page, home, sitemap).
    expect(catalogCategoriesMerged(production)).toBe(true);
    expect(catalogCategoriesMerged(preview)).toBe(true);
    expect(catalogCategoriesMerged({})).toBe(false);
    expect(catalogCategoriesMerged({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" })).toBe(false);
    // Payment stays closed on dourya.fr.
    expect(commerceConfig.checkoutEnabled).toBe(false);
    expect(isTestPreviewCheckout({ ...production, CHECKOUT_ENABLED: "true" }, "test")).toBe(false);
  });

  it("opens on the stripe-test preview with dourya-test (mode test)", () => {
    expect(catalogAdminState(preview)).toEqual({ enabled: true, bucket: "dourya-shop.firebasestorage.app", mode: "test" });
    expect(catalogAdminState({ ...preview, VERCEL_GIT_COMMIT_REF: "main" })).toEqual({ enabled: false, reason: "not-test-preview" });
    expect(catalogAdminState({ ...preview, FIRESTORE_DATABASE_ID: "" })).toEqual({ enabled: false, reason: "database" });
    expect(catalogAdminState({ ...preview, FIRESTORE_DATABASE_ID: "(default)" })).toEqual({ enabled: false, reason: "database" });
    expect(catalogAdminState({ ...preview, FIREBASE_ADMIN_PROJECT_ID: "" })).toEqual({ enabled: false, reason: "bucket" });
    expect(catalogAdminState({ NODE_ENV: "production" })).toEqual({ enabled: false, reason: "not-test-preview" });
  });

  it("opens in local dev on the emulators only", () => {
    const local = { NODE_ENV: "development", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" };
    expect(catalogAdminState(local)).toEqual({ enabled: true, bucket: "demo-dourya.firebasestorage.app", mode: "test" });
    expect(catalogAdminState({ ...local, VERCEL_ENV: "development" }).enabled).toBe(false);
    expect(catalogAdminState({ ...local, FIREBASE_STORAGE_EMULATOR_HOST: undefined }).enabled).toBe(false);
  });

  it("keeps draft photos out of the public products path", () => {
    expect(draftPhotoPath("p-test", "abcdef1234.webp")).toBe("catalog-drafts/p-test/abcdef1234.webp");
    expect(isDraftPhotoUrl("/admin/catalogue/photos/p-test/abcdef1234.webp")).toBe(true);
    expect(isDraftPhotoUrl("/images/products/prints/x/01.webp")).toBe(false);
    expect(PHOTO_FILE_PATTERN.test("../secret.webp")).toBe(false);
    expect(PHOTO_FILE_PATTERN.test("abcdef1234.png")).toBe(false);
    expect(PRODUCT_ID_PATTERN.test("../x")).toBe(false);
    expect(catalogBucket({ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "b.firebasestorage.app" })).toBe("b.firebasestorage.app");
  });
});

const stored = (over: Partial<Product>): Product => ({ ...realProducts[0], id: "p-nouveau", slug: "nouveau", name: "Nouveau", ...over });

describe("merged catalogue", () => {
  it("keeps the demo sticker usable for the Stripe tests", () => {
    const hijack = stored({ id: "demo-sticker", slug: "demo-sticker", status: "published", isDemo: false });
    const sameSlug = stored({ id: "p-x", slug: "demo-sticker", status: "published" });
    const merged = mergeProducts(fixtures.products, [hijack, sameSlug]);
    const demo = merged.find((p) => p.id === "demo-sticker")!;
    expect(demo).toBe(fixtures.products.find((p) => p.id === "demo-sticker"));
    expect(demo.isDemo).toBe(true);
    expect(merged.some((p) => p.id === "p-x")).toBe(false);
    const cats = new Set(fixtures.categories.filter((c) => c.visible).map((c) => c.slug));
    expect(isListed(demo, cats)).toBe(true);
  });

  it("keeps new products out of the cart, the sitemap and the public shop", () => {
    const merged = mergeProducts(fixtures.products, [stored({ status: "published", isDemo: true }), stored({ id: "real-headband-1", slug: "headband-1", status: "published" })]);
    const cats = new Set(fixtures.categories.map((c) => c.slug));
    for (const id of ["p-nouveau", "real-headband-1"]) {
      const p = merged.find((x) => x.id === id)!;
      expect(p.status).toBe("draft");
      expect(p.isDemo).toBe(false);
      expect(isListed(p, cats)).toBe(false);
    }
  });

  it("adds stored categories without stealing a slug", () => {
    const base = fixtures.categories[0];
    const merged = mergeCategories(fixtures.categories, [
      { ...base, id: "cat-bijoux", slug: "bijoux", name: "Bijoux" },
      { ...base, id: "cat-copie", slug: base.slug },
    ]);
    expect(merged.some((c) => c.slug === "bijoux")).toBe(true);
    expect(merged.some((c) => c.id === "cat-copie")).toBe(false);
  });
});

function form(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

describe("rubriques on dourya.fr", () => {
  const base = fixtures.categories[0];
  it("adds new visible rubriques, even empty, after the fixtures", () => {
    const merged = addStoredCategories(fixtures.categories, [
      { ...base, id: "cat-bijoux", slug: "bijoux", name: "Bijoux", visible: true },
      { ...base, id: "cat-cachee", slug: "cachee", name: "Cachée", visible: false },
    ]);
    expect(merged.slice(0, fixtures.categories.length)).toEqual(fixtures.categories);
    expect(merged.map((c) => c.slug)).toContain("bijoux");
    expect(merged.some((c) => c.slug === "cachee")).toBe(false);
  });

  it("never replaces, hides or renames a fixture rubrique", () => {
    const merged = addStoredCategories(fixtures.categories, [
      { ...base, visible: false, name: "Renommée" },
      { ...base, id: "cat-copie", slug: base.slug, visible: true },
      { ...base, id: "cat-a", slug: "double", visible: true },
      { ...base, id: "cat-b", slug: "double", visible: true },
    ]);
    expect(merged.find((c) => c.id === base.id)).toBe(base);
    expect(merged.some((c) => c.id === "cat-copie")).toBe(false);
    expect(merged.filter((c) => c.slug === "double").map((c) => c.id)).toEqual(["cat-a"]);
  });
});

describe("one photo per model", () => {
  const p = realProducts.find((x) => x.images.length >= 2)!;
  const variant = { id: "m1", sku: "PC-M1", attributes: [] as Product["variants"][number]["attributes"], name: "Modèle 1", priceCents: 595, stockMode: "made_to_order" as const, active: true };

  it("keeps a photo of the product and drops an unknown one", () => {
    const linked = linkVariantImages([{ ...variant, imageSrc: p.images[1].src }, { ...variant, id: "m2", imageSrc: "/images/products/autre/01.webp" }], p.images);
    expect(linked[0].imageSrc).toBe(p.images[1].src);
    expect(linked[1]).not.toHaveProperty("imageSrc");
  });

  it("round-trips the model photo through the stored document", () => {
    const withModels: Product = { ...p, variants: [{ ...variant, imageSrc: p.images[0].src }, { ...variant, id: "m2", name: "Modèle 2", imageSrc: p.images[1].src }] };
    const back = parseStoredProduct(p.id, toStoredProductDoc(withModels, "2026-11-19T00:00:00.000Z"))!;
    expect(back.variants.map((v) => v.imageSrc)).toEqual([p.images[0].src, p.images[1].src]);
    // A tampered document pointing elsewhere loses the link.
    const doc = toStoredProductDoc(withModels, "2026-11-19T00:00:00.000Z") as Record<string, unknown>;
    const tampered = { ...doc, variants: (doc.variants as Record<string, unknown>[]).map((v) => ({ ...v, imageSrc: "//evil.example/x.webp" })) };
    expect(parseStoredProduct(p.id, tampered)!.variants.every((v) => !v.imageSrc)).toBe(true);
  });

  it("reads the model photo from the admin form", () => {
    const known = new Set(["porte-cles"]);
    const f = { name: "Porte-clés", categorySlugs: "porte-cles", variantCount: "2", "variant.0.name": "Modèle 1", "variant.0.price": "5,95", "variant.0.stockMode": "made_to_order", "variant.0.active": "on", "variant.0.image": p.images[0].src, "variant.1.name": "Modèle 2", "variant.1.price": "5,95", "variant.1.stockMode": "made_to_order", "variant.1.active": "on", "variant.1.image": "" };
    const ok = validateProductForm(form(f), known);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.variants.map((v) => v.imageSrc)).toEqual([p.images[0].src, null]);
    const bad = validateProductForm(form({ ...f, "variant.1.image": "javascript:alert(1)" }), known);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors["variant.1.image"]).toBe("Photo introuvable.");
  });
});

describe("admin forms", () => {
  it("validates a category", () => {
    const ok = validateCategoryForm(form({ name: "Bijoux d'été", icon: "sparkles", order: "50", visible: "on" }));
    expect(ok).toEqual({ ok: true, value: { id: null, slug: "bijoux-d-ete", name: "Bijoux d'été", description: "", icon: "sparkles", visible: true, order: 50 } });
    const bad = validateCategoryForm(form({ name: "x", icon: "nope", order: "-1" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["icon", "name", "order"]);
  });

  it("validates a product and never publishes it", () => {
    const known = new Set(["stickers"]);
    const base = { name: "Sticker lune", categorySlugs: "stickers", variantCount: "2", "variant.0.name": "À l'unité", "variant.0.price": "1,95", "variant.0.stockMode": "stocked", "variant.0.stock": "3", "variant.0.active": "on", "variant.1.name": "", "variant.1.price": "" };
    const ok = validateProductForm(form(base), known);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.status).toBe("draft");
      expect(ok.value.variants).toEqual([{ id: "a-l-unite", name: "À l'unité", priceCents: 195, stockMode: "stocked", stock: 3, active: true, imageSrc: null }]);
    }
    expect(validateProductForm(form({ ...base, status: "published" }), known).ok).toBe(false);
    expect(validateProductForm(form({ ...base, categorySlugs: "inconnue" }), known).ok).toBe(false);
    expect(validateProductForm(form({ ...base, variantCount: "0" }), known).ok).toBe(false);
  });

  it("parses prices, slugs and image types", () => {
    expect(parseEuros("6,95")).toBe(695);
    expect(parseEuros("29.95 €")).toBe(2995);
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("abc")).toBeNaN();
    expect(slugify("  Porte-clés Été !")).toBe("porte-cles-ete");
    expect(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("import of the real drafts", () => {
  it("plans the 30 drafts with their price, cover and existing WebP photos", () => {
    const plan = planImport(realProducts, new Set());
    expect(plan.lines).toHaveLength(30);
    expect(plan.create).toBe(30);
    expect(plan.problems).toEqual([]);
    expect(plan.lines.every((l) => l.priceCents !== null && l.cover?.startsWith(PUBLIC_PHOTO_PREFIX))).toBe(true);
    expect(plan.lines.find((l) => l.id === "real-pack-prints-twilight")?.priceCents).toBe(2995);
  });

  it("skips what is already stored and round-trips as a draft", () => {
    const plan = planImport(realProducts, new Set(["real-headband-1"]));
    expect(plan.skip).toBe(1);
    expect(plan.lines.find((l) => l.id === "real-headband-1")?.action).toBe("skip");
    const p = { ...realProducts[0], status: "published" as const };
    const doc = toStoredProductDoc(p, "2026-11-19T10:00:00.000Z");
    expect(doc.status).toBe("draft");
    const back = parseStoredProduct(p.id, doc);
    expect(back?.images).toEqual(p.images);
    expect(back?.isDemo).toBe(false);
  });
});
