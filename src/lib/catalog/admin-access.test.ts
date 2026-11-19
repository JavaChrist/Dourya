import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Product } from "@/lib/types";

/**
 * Access to the catalogue admin on dourya.fr (VERCEL_ENV=production):
 * customers and visitors never reach the admin pages, the actions or the
 * private draft photos; only an admin publishes, through « Publier »; the
 * public shop, cart and sitemap show the new visible rubriques (even empty)
 * and the complete published products, never the drafts or their photos.
 * Firebase, the session and Next are mocked: no network, no real account.
 */
const session = vi.hoisted(() => ({ state: { status: "none" } as { status: string; user?: { uid: string; role: string } } }));
const storage = vi.hoisted(() => ({ readDraftPhoto: vi.fn(async () => Buffer.from("RIFF0000WEBP")) }));
const repo = vi.hoisted(() => ({ saveCategory: vi.fn(), saveProduct: vi.fn(), setProductStatus: vi.fn(), addPhoto: vi.fn(), editPhoto: vi.fn(), adminCatalog: vi.fn(async () => ({ categories: [{ slug: "stickers" }], products: [] })) }));
const stored = vi.hoisted(() => ({ cachedStoredCatalog: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (session.state.status === "none" ? undefined : { value: "cookie" }) }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
vi.mock("next/cache", () => ({ updateTag: vi.fn(), refresh: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/firebase/admin-auth", () => ({ adminAuth: () => ({}) }));
vi.mock("@/lib/auth/session-core", () => ({ resolveSession: async () => session.state }));
vi.mock("@/lib/log", () => ({ logEvent: vi.fn(), errorCode: () => "unknown" }));
vi.mock("@/lib/security/limit", () => ({ allowAction: async () => true }));
vi.mock("@/lib/catalog/admin-storage", () => storage);
vi.mock("@/lib/catalog/admin-repository", async () => {
  class CatalogRefusal extends Error {}
  return { ...repo, CatalogRefusal };
});
vi.mock("@/lib/catalog/stored-catalog", () => stored);

const PRODUCTION = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dourya-shop.firebasestorage.app" };
const customer = { status: "ok", user: { uid: "u-client", role: "customer" } };
const admin = { status: "ok", user: { uid: "u-admin", role: "admin" } };

beforeEach(() => {
  for (const [k, v] of Object.entries(PRODUCTION)) vi.stubEnv(k, v);
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

const photo = async () => {
  const { GET } = await import("@/app/admin/catalogue/photos/[productId]/[file]/route");
  return GET(new Request("https://dourya.fr/x"), { params: Promise.resolve({ productId: "p-sticker-lune", file: "abcdef1234.webp" }) });
};

describe("private draft photos on dourya.fr", () => {
  it("are a 404 for a visitor and for a customer, never read from Storage", async () => {
    for (const state of [{ status: "none" }, customer, { status: "invalid" }]) {
      session.state = state;
      const res = await photo();
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    }
    expect(storage.readDraftPhoto).not.toHaveBeenCalled();
  });

  it("are served to an admin, never cached publicly", async () => {
    session.state = admin;
    const res = await photo();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(storage.readDraftPhoto).toHaveBeenCalledWith("p-sticker-lune", "abcdef1234.webp");
  });
});

describe("admin pages and actions on dourya.fr", () => {
  it("send a visitor to the admin sign-in and give a customer a 404", async () => {
    const { requireAdmin } = await import("@/lib/auth/dal");
    session.state = { status: "none" };
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT /admin/connexion");
    session.state = customer;
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    session.state = admin;
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });

  it("refuse every write of a customer", async () => {
    const actions = await import("@/app/admin/catalogue/actions");
    session.state = customer;
    const form = new FormData();
    form.set("name", "Rubrique de travail");
    form.set("productId", "p-sticker-lune");
    await expect(actions.saveCategoryAction({ status: "idle" } as never, form)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(actions.saveProductAction({ status: "idle" } as never, form)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(actions.uploadPhotoAction(form)).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(actions.editPhotoAction({ status: "idle" } as never, form)).rejects.toThrow("NEXT_NOT_FOUND");
    form.set("status", "published");
    await expect(actions.setProductStatusAction({ status: "idle" } as never, form)).rejects.toThrow("NEXT_NOT_FOUND");
    for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
  });

  it("refuse publishing from the form, even for an admin", async () => {
    const actions = await import("@/app/admin/catalogue/actions");
    session.state = admin;
    const form = new FormData();
    for (const [k, v] of Object.entries({ name: "Sticker lune", categorySlugs: "stickers", status: "published", variantCount: "1", "variant.0.name": "À l'unité", "variant.0.price": "1,95", "variant.0.stockMode": "stocked", "variant.0.stock": "3", "variant.0.active": "on" })) form.set(k, v);
    const result = await actions.saveProductAction({ status: "idle" } as never, form);
    expect(result.status).toBe("error");
    expect(repo.saveProduct).not.toHaveBeenCalled();
  });

  it("let an admin publish through « Publier », with a valid status only", async () => {
    const actions = await import("@/app/admin/catalogue/actions");
    session.state = admin;
    const form = new FormData();
    form.set("productId", "p-sticker-lune");
    form.set("status", "en-ligne");
    expect((await actions.setProductStatusAction({ status: "idle" } as never, form)).status).toBe("error");
    expect(repo.setProductStatus).not.toHaveBeenCalled();
    form.set("status", "published");
    expect((await actions.setProductStatusAction({ status: "idle" } as never, form)).status).toBe("ok");
    expect(repo.setProductStatus).toHaveBeenCalledWith("p-sticker-lune", "published");
  });
});

describe("public shop of dourya.fr", () => {
  const working: Category = { id: "c-travail", slug: "rubrique-de-travail", name: "Rubrique de travail", description: "", icon: "sparkles", visible: true, order: 1 } as Category;

  it("shows the new visible rubriques but never the stored products (shop, cart, sitemap)", async () => {
    const { realProducts } = await import("@/data/real-products");
    const draft = { ...realProducts[0], status: "published", categorySlugs: ["rubrique-de-travail"] } as unknown as Product;
    const hidden = { ...working, id: "c-cachee", slug: "rubrique-cachee", visible: false } as Category;
    stored.cachedStoredCatalog.mockResolvedValue({ categories: [working, hidden], products: [draft] });
    const catalog = await import("@/lib/catalog");
    const categories = await catalog.getVisibleCategories();
    const listed = await catalog.getListedProducts();
    const shown = await catalog.getShownProducts();
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(categories.some((c) => c.slug === working.slug)).toBe(true);
    expect(categories.some((c) => c.slug === hidden.slug)).toBe(false);
    expect(await catalog.getCategory(working.slug)).toBeDefined();
    expect([...listed, ...shown].some((p) => p.id === draft.id || p.status === "draft")).toBe(false);
    expect(urls.some((u) => u.endsWith("/categories/rubrique-de-travail"))).toBe(true);
    expect(urls.some((u) => u.includes("rubrique-cachee") || u.includes(`/produits/${draft.slug}`))).toBe(false);
    expect(await catalog.getProductForPage(draft.slug)).toBeUndefined();
  });

  const src = "/admin/catalogue/photos/p-sticker-lune/abcdef1234.webp";
  const complete = async (over: Partial<Product> = {}) => {
    const { realProducts } = await import("@/data/real-products");
    return {
      ...realProducts[0],
      id: "p-sticker-lune",
      slug: "sticker-lune",
      status: "published",
      isDemo: false,
      description: "Un sticker.",
      categorySlugs: ["rubrique-de-travail"],
      images: [{ src, alt: "Sticker lune", width: 800, height: 800, storagePath: "catalog-drafts/p-sticker-lune/abcdef1234.webp" }],
      variants: [{ ...realProducts[0].variants[0], priceCents: 195, stockMode: "stocked", stock: 3, active: true }],
      ...over,
    } as Product;
  };
  const publicPhoto = async (file = "abcdef1234.webp") => {
    const { GET } = await import("@/app/catalogue/photos/[productId]/[file]/route");
    return GET(new Request("https://dourya.fr/x"), { params: Promise.resolve({ productId: "p-sticker-lune", file }) });
  };

  it("lists a complete published product, with its public photo, and keeps checkout closed", async () => {
    stored.cachedStoredCatalog.mockResolvedValue({ categories: [working], products: [await complete()] });
    const catalog = await import("@/lib/catalog");
    const listed = await catalog.getListedProducts();
    const product = listed.find((p) => p.id === "p-sticker-lune")!;
    expect(product.images[0]).toEqual({ src: "/catalogue/photos/p-sticker-lune/abcdef1234.webp", alt: "Sticker lune", width: 800, height: 800 });
    expect((await catalog.getProductForPage("sticker-lune"))?.id).toBe("p-sticker-lune");
    const { default: sitemap } = await import("@/app/sitemap");
    expect((await sitemap()).some((e) => e.url.endsWith("/produits/sticker-lune"))).toBe(true);
    const { commerceConfig } = await import("@/config/commerce");
    expect(commerceConfig.checkoutEnabled).toBe(false);

    session.state = { status: "none" };
    const res = await publicPhoto();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
    expect(storage.readDraftPhoto).toHaveBeenCalledWith("p-sticker-lune", "abcdef1234.webp");
    expect((await publicPhoto("autre12345.webp")).status).toBe(404);
  });

  it("never serves the photos of a draft, an archived or an incomplete product", async () => {
    session.state = { status: "none" };
    for (const over of [{ status: "draft" }, { status: "archived" }, { description: "" }, { categorySlugs: ["inconnue"] }] as Partial<Product>[]) {
      stored.cachedStoredCatalog.mockResolvedValue({ categories: [working], products: [await complete(over)] });
      expect((await publicPhoto()).status).toBe(404);
    }
    expect(storage.readDraftPhoto).not.toHaveBeenCalled();
  });
});
