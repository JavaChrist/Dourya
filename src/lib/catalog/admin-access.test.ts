import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Product } from "@/lib/types";

/**
 * Access to the catalogue admin on dourya.fr (VERCEL_ENV=production):
 * customers and visitors never reach the admin pages, the actions or the
 * private draft photos; publishing stays refused; the public shop, cart and
 * sitemap never show working rubriques or drafts.
 * Firebase, the session and Next are mocked: no network, no real account.
 */
const session = vi.hoisted(() => ({ state: { status: "none" } as { status: string; user?: { uid: string; role: string } } }));
const storage = vi.hoisted(() => ({ readDraftPhoto: vi.fn(async () => Buffer.from("RIFF0000WEBP")) }));
const repo = vi.hoisted(() => ({ saveCategory: vi.fn(), saveProduct: vi.fn(), addPhoto: vi.fn(), editPhoto: vi.fn(), adminCatalog: vi.fn(async () => ({ categories: [{ slug: "stickers" }], products: [] })) }));
const stored = vi.hoisted(() => ({ cachedStoredCatalog: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (session.state.status === "none" ? undefined : { value: "cookie" }) }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
vi.mock("next/cache", () => ({ updateTag: vi.fn(), refresh: vi.fn() }));
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
    for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
  });

  it("refuse publishing, even for an admin", async () => {
    const actions = await import("@/app/admin/catalogue/actions");
    session.state = admin;
    const form = new FormData();
    for (const [k, v] of Object.entries({ name: "Sticker lune", categorySlugs: "stickers", status: "published", variantCount: "1", "variant.0.name": "À l'unité", "variant.0.price": "1,95", "variant.0.stockMode": "stocked", "variant.0.stock": "3", "variant.0.active": "on" })) form.set(k, v);
    const result = await actions.saveProductAction({ status: "idle" } as never, form);
    expect(result.status).toBe("error");
    expect(repo.saveProduct).not.toHaveBeenCalled();
  });
});

describe("public shop of dourya.fr", () => {
  const working: Category = { id: "c-travail", slug: "rubrique-de-travail", name: "Rubrique de travail", description: "", icon: "sparkles", visible: true, order: 1 } as Category;

  it("never reads nor shows the stored rubriques and drafts (shop, cart, sitemap)", async () => {
    const { realProducts } = await import("@/data/real-products");
    const draft = { ...realProducts[0], status: "published", categorySlugs: ["rubrique-de-travail"] } as unknown as Product;
    stored.cachedStoredCatalog.mockResolvedValue({ categories: [working], products: [draft] });
    const catalog = await import("@/lib/catalog");
    const categories = await catalog.getVisibleCategories();
    const listed = await catalog.getListedProducts();
    const shown = await catalog.getShownProducts();
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(stored.cachedStoredCatalog).not.toHaveBeenCalled();
    expect(categories.some((c) => c.slug === working.slug)).toBe(false);
    expect([...listed, ...shown].some((p) => p.id === draft.id || p.status === "draft")).toBe(false);
    expect(urls.some((u) => u.includes("rubrique-de-travail") || u.includes(draft.slug))).toBe(false);
    expect(await catalog.getProductForPage(draft.slug)).toBeUndefined();
  });
});
