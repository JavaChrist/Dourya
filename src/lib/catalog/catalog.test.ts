import { describe, expect, it } from "vitest";
import { getListedProducts, getProductForPage, getVisibleCategories } from "./index";
import { parseShopParams, queryProducts, shopHref } from "./query";
import { productPageState, variantAvailability, visibleCategories } from "./visibility";
import type { Category } from "@/lib/types";
import { product, variant } from "@/test/factories";

describe("catalogue visibility (fixture repository)", () => {
  it("shows the Headbands category, never its demo draft", async () => {
    expect((await getVisibleCategories()).map((c) => c.slug)).toContain("headbands");
    expect((await getListedProducts()).map((p) => p.id)).not.toContain("demo-headband");
    expect(await getProductForPage("demo-headband")).toBeUndefined();
  });

  it("lists published products only, keeps archived pages, hides drafts", async () => {
    const listed = (await getListedProducts()).map((p) => p.id);
    expect(listed).not.toContain("demo-archive");
    expect(listed).not.toContain("demo-brouillon");
    expect((await getProductForPage("demo-archive"))?.status).toBe("archived");
    expect(await getProductForPage("demo-brouillon")).toBeUndefined();
  });

  it("sorts visible categories by order, then by name", () => {
    const cat = (name: string, order: number, visible = true): Category => ({ id: name, slug: name.toLowerCase(), name, icon: "heart", visible, order });
    const sorted = visibleCategories([cat("Zèbres", 100), cat("Avatars", 100), cat("Prints", 1), cat("Cachée", 0, false), cat("Écharpes", 100)]);
    expect(sorted.map((c) => c.name)).toEqual(["Prints", "Avatars", "Écharpes", "Zèbres"]);
  });

  it("gives each state its availability", () => {
    expect(variantAvailability(variant({ stockMode: "stocked", stock: 2, lowStockThreshold: 5 }))).toEqual({ kind: "in_stock", stock: 2, low: true });
    expect(variantAvailability(variant({ stockMode: "stocked", stock: 0 }))).toEqual({ kind: "out_of_stock" });
    expect(variantAvailability(variant({ priceCents: null }))).toEqual({ kind: "no_price" });
    expect(productPageState(product({ variants: [variant({ priceCents: null })] }))).toBe("unavailable");
    expect(productPageState(product({ status: "archived" }))).toBe("archived");
  });
});

describe("queryProducts", () => {
  const list = [
    product({ id: "a", name: "Chat étoilé", categorySlugs: ["prints"], collectionSlugs: ["noel"], createdAt: "2026-03-01", variants: [variant({ priceCents: 1500 })] }),
    product({ id: "b", name: "Bulle", categorySlugs: ["stickers"], createdAt: "2026-05-01", variants: [variant({ priceCents: 300 })] }),
    product({ id: "c", name: "Arc-en-ciel", categorySlugs: ["prints"], createdAt: "2026-01-01", variants: [variant({ priceCents: null })] }),
  ];
  const ids = (q: Parameters<typeof queryProducts>[1]) => queryProducts(list, q).items.map((p) => p.id);

  it("searches without accents or case", () => expect(ids({ q: "ETOILE" })).toEqual(["a"]));
  it("filters by category and collection", () => {
    expect(ids({ category: "prints" })).toEqual(["a", "c"]);
    expect(ids({ collection: "noel" })).toEqual(["a"]);
  });
  it("sorts, unpriced products last", () => {
    expect(ids({})).toEqual(["b", "a", "c"]);
    expect(ids({ sort: "prix-croissant" })).toEqual(["b", "a", "c"]);
    expect(ids({ sort: "prix-decroissant" })).toEqual(["a", "b", "c"]);
    expect(ids({ sort: "nom" })).toEqual(["c", "b", "a"]);
  });
  it("paginates and clamps the page", () => {
    expect(queryProducts(list, { pageSize: 2, page: 2 })).toMatchObject({ total: 3, page: 2, pageCount: 2 });
    expect(queryProducts(list, { pageSize: 2, page: 99 }).page).toBe(2);
  });
});

describe("parseShopParams / shopHref", () => {
  it("reads and cleans the URL parameters", () => {
    expect(parseShopParams({ q: ["  chat ", "x"], categorie: "prints", tri: "inconnu", page: "-2" })).toEqual({
      q: "chat",
      category: "prints",
      collection: undefined,
      sort: undefined,
      page: 1,
    });
    expect(parseShopParams({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
  it("builds clean URLs", () => {
    expect(shopHref("/boutique", { sort: "nouveautes", page: 1 })).toBe("/boutique");
    expect(shopHref("/boutique", { q: "chat", sort: "nom", page: 2 })).toBe("/boutique?q=chat&tri=nom&page=2");
  });
});
