import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin → Accueil actions on dourya.fr: only an admin writes settings/home,
 * always after validation against the catalogue; a write expires the "home"
 * cache tag. Firebase, the session and Next are mocked: no network, no real account.
 */
const session = vi.hoisted(() => ({ state: { status: "none" } as { status: string; user?: { uid: string; role: string } } }));
const repo = vi.hoisted(() => ({ saveHomeCarousels: vi.fn(async () => {}), resetHomeCarousels: vi.fn(async () => {}), HOME_TAG: "home" }));
const cache = vi.hoisted(() => ({ updateTag: vi.fn(), refresh: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() }));
const IMG = "/images/products/prints/print-gros-dodo/01.webp";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (session.state.status === "none" ? undefined : { value: "cookie" }) }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => cache);
vi.mock("@/lib/firebase/admin-auth", () => ({ adminAuth: () => ({}) }));
vi.mock("@/lib/auth/session-core", () => ({ resolveSession: async () => session.state }));
vi.mock("@/lib/log", () => ({ logEvent: vi.fn(), errorCode: () => "unknown" }));
vi.mock("@/lib/security/limit", () => ({ allowAction: async () => true }));
vi.mock("@/lib/home/repository", () => repo);
vi.mock("@/lib/home/admin-options", () => ({
  homeAdminOptions: async () => ({}),
  allowedFrom: () => ({ images: new Map([[IMG, { width: 780, height: 780 }]]), categorySlugs: new Set(["prints"]), productSlugs: new Set(["print-gros-dodo"]) }),
}));

const PRODUCTION = { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dourya-shop.firebasestorage.app" };
const admin = { status: "ok", user: { uid: "u-admin", role: "admin" } };
const idle = { status: "idle" } as const;

const payload = (hero: unknown[]) => {
  const form = new FormData();
  form.set("payload", JSON.stringify({ hero, selection: [] }));
  return form;
};
const slide = { id: "s1", title: "Prints", subtitle: "", imageSrc: IMG, alt: "Print", href: "/categories/prints", linkLabel: "Voir", active: true };

beforeEach(() => {
  for (const [k, v] of Object.entries(PRODUCTION)) vi.stubEnv(k, v);
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe("Admin → Accueil actions", () => {
  it("send a visitor to the sign-in and give a customer a 404, nothing written", async () => {
    const { resetHomeAction, saveHomeAction } = await import("./actions");
    session.state = { status: "none" };
    await expect(saveHomeAction(idle, payload([slide]))).rejects.toThrow("NEXT_REDIRECT /admin/connexion");
    session.state = { status: "ok", user: { uid: "u-client", role: "customer" } };
    await expect(saveHomeAction(idle, payload([slide]))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(resetHomeAction()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(repo.saveHomeCarousels).not.toHaveBeenCalled();
    expect(repo.resetHomeCarousels).not.toHaveBeenCalled();
  });

  it("save the validated carousels for an admin and expire the home cache", async () => {
    const { saveHomeAction } = await import("./actions");
    session.state = admin;
    const res = await saveHomeAction(idle, payload([slide]));
    expect(res.status).toBe("ok");
    expect(repo.saveHomeCarousels).toHaveBeenCalledWith(
      { hero: [{ id: "s1", title: "Prints", image: { src: IMG, alt: "Print", width: 780, height: 780 }, href: "/categories/prints", linkLabel: "Voir", active: true }], selection: [] },
      "u-admin",
    );
    expect(cache.updateTag).toHaveBeenCalledWith("home");
  });

  it("refuse an invalid or unreadable form without writing", async () => {
    const { saveHomeAction } = await import("./actions");
    session.state = admin;
    const bad = await saveHomeAction(idle, payload([{ ...slide, href: "/categories/inconnue" }]));
    expect(bad).toMatchObject({ status: "error", errors: { "s1.href": "Cette rubrique n'existe pas." } });
    const form = new FormData();
    form.set("payload", "{pas du json");
    expect((await saveHomeAction(idle, form)).status).toBe("error");
    expect(repo.saveHomeCarousels).not.toHaveBeenCalled();
    expect(cache.updateTag).not.toHaveBeenCalled();
  });

  it("refuse to write where the admin is not open", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "some-branch");
    const { resetHomeAction } = await import("./actions");
    session.state = admin;
    expect((await resetHomeAction()).status).toBe("error");
    expect(repo.resetHomeCarousels).not.toHaveBeenCalled();
  });
});
