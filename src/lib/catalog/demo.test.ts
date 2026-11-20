import { afterEach, describe, expect, it, vi } from "vitest";
import { homeContent } from "@/data/home";
import { isDemoShown, withoutDemo } from "./demo";
import { getListedProducts, getProductForPage, getShownProducts, getVisibleCollections } from "./index";

describe("isDemoShown", () => {
  it("hides the demo on the production deployment only", () => {
    expect(isDemoShown({ VERCEL_ENV: "production" })).toBe(false);
    expect(isDemoShown({ VERCEL_ENV: "preview" })).toBe(true);
    expect(isDemoShown({ NODE_ENV: "development" })).toBe(true);
    expect(isDemoShown({})).toBe(true);
  });
});

describe("withoutDemo", () => {
  const items = [{ id: "a", isDemo: true }, { id: "b" }, { id: "c", isDemo: false }];
  it("keeps everything when shown, drops isDemo items when hidden", () => {
    expect(withoutDemo(items, true).map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(withoutDemo(items, false).map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("homeContent", () => {
  it("keeps the demo home content outside production", () => {
    const home = homeContent(true);
    expect(home.manualCarousel.slides.length).toBeGreaterThan(0);
    expect(home.mailClub.enabled).toBe(true);
  });
  it("removes demo slides, messages and the demo Mail Club text on dourya.fr", () => {
    const home = homeContent(false);
    for (const list of [home.heroCarousel.slides, home.manualCarousel.slides, home.promoBanner.messages]) {
      expect(list.some((i) => i.isDemo)).toBe(false);
    }
    expect(home.manualCarousel.slides.some((s) => s.link?.href.startsWith("/produits/demo-"))).toBe(false);
    expect(home.mailClub.enabled).toBe(false);
  });
});

describe("catalogue on the production deployment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists and shows no demo product, demo pages 404, no demo collection", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("FIREBASE_ADMIN_PROJECT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "");
    expect((await getListedProducts()).some((p) => p.isDemo)).toBe(false);
    expect((await getShownProducts()).some((p) => p.isDemo)).toBe(false);
    expect(await getProductForPage("demo-print-a5")).toBeUndefined();
    expect(await getProductForPage("demo-archive")).toBeUndefined();
    expect((await getVisibleCollections()).some((c) => c.isDemo)).toBe(false);
  });

  it("keeps the demo products locally and on previews", async () => {
    expect((await getListedProducts()).some((p) => p.isDemo)).toBe(true);
    expect(await getProductForPage("demo-print-a5")).toBeDefined();
  });
});
