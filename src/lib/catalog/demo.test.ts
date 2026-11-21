import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { heroCarousel, homeContent, imageIsLive, linksToLivePage, manualCarousel } from "@/data/home";
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
  const everything = {
    categories: new Set(["prints", "stickers", "porte-cles", "headbands"]),
    products: new Set(manualCarousel.slides.map((s) => s.link!.href.replace("/produits/", ""))),
  };

  it("keeps the demo home content outside production", () => {
    const home = homeContent(true, everything);
    expect(home.manualCarousel.slides.some((s) => s.isDemo)).toBe(true);
    expect(home.mailClub.enabled).toBe(true);
  });

  it("removes demo slides, messages and the demo Mail Club text on dourya.fr", () => {
    const home = homeContent(false, everything);
    for (const list of [home.heroCarousel.slides, home.manualCarousel.slides, home.promoBanner.messages]) {
      expect(list.some((i) => i.isDemo)).toBe(false);
    }
    expect(home.manualCarousel.slides.some((s) => s.link?.href.startsWith("/produits/demo-"))).toBe(false);
    expect(home.mailClub.enabled).toBe(false);
  });

  it("shows on dourya.fr only the slides whose category or product is on sale", () => {
    const home = homeContent(false, { categories: new Set(["prints", "headbands"]), products: new Set(["blindbox-lala", "headband-1"]) });
    expect(home.heroCarousel.slides.map((s) => s.id)).toEqual(["hero-prints", "hero-headbands"]);
    expect(home.manualCarousel.slides.map((s) => s.link?.href)).toEqual(["/produits/blindbox-lala", "/produits/headband-1"]);
  });

  it("uses real illustrations for every non-demo slide", () => {
    for (const slide of [...heroCarousel.slides, ...manualCarousel.slides].filter((s) => !s.isDemo)) {
      expect(slide.image?.src).toMatch(/^\/images\/products\/[a-z-]+\/[a-z0-9-]+\/\d{2}\.webp$/);
      expect(existsSync(join(process.cwd(), "public", slide.image!.src))).toBe(true);
    }
  });
});

describe("homeContent with the carousels of Admin → Accueil", () => {
  const live = { categories: new Set(["prints"]), products: new Set(["sticker-lune"]), photos: new Set(["/catalogue/photos/p-sticker-lune/abcdef1234.webp"]) };
  const image = (src: string) => ({ src, alt: "Photo", width: 800, height: 800 });
  const stored = {
    hero: [
      { id: "a", title: "Prints", image: image("/images/products/prints/print-gros-dodo/01.webp"), link: { href: "/categories/prints", label: "Voir" } },
      { id: "b", title: "Rubrique masquée", image: image("/images/products/prints/print-gros-dodo/01.webp"), link: { href: "/categories/stickers" } },
    ],
    selection: [
      { id: "c", title: "Lune", image: image("/catalogue/photos/p-sticker-lune/abcdef1234.webp"), link: { href: "/produits/sticker-lune" } },
      { id: "d", title: "Photo d'un produit retiré", image: image("/catalogue/photos/p-retire/abcdef1234.webp"), link: { href: "/produits/sticker-lune" } },
    ],
  };

  it("replaces the slides of home.ts and keeps only those whose link and photo are live", () => {
    const home = homeContent(false, live, stored);
    expect(home.heroCarousel.slides.map((s) => s.id)).toEqual(["a"]);
    expect(home.manualCarousel.slides.map((s) => s.id)).toEqual(["c"]);
    expect(home.heroCarousel.title).toBe(heroCarousel.title);
  });

  it("keeps home.ts when nothing is stored", () => {
    expect(homeContent(false, live, null).heroCarousel.slides.map((s) => s.id)).toEqual(["hero-prints"]);
  });
});

describe("imageIsLive", () => {
  const live = { categories: new Set<string>(), products: new Set<string>(), photos: new Set(["/catalogue/photos/p1/abc.webp"]) };
  it("never shows a draft photo, shows an uploaded photo only while its product is listed", () => {
    expect(imageIsLive("/admin/catalogue/photos/p1/abc.webp", live)).toBe(false);
    expect(imageIsLive("/catalogue/photos/p1/abc.webp", live)).toBe(true);
    expect(imageIsLive("/catalogue/photos/p2/abc.webp", live)).toBe(false);
    expect(imageIsLive("/catalogue/photos/p1/abc.webp", { categories: new Set(), products: new Set() })).toBe(false);
    expect(imageIsLive("/images/products/prints/print-gros-dodo/01.webp", live)).toBe(true);
    expect(imageIsLive(undefined, live)).toBe(true);
  });
});

describe("linksToLivePage", () => {
  const live = { categories: new Set(["prints"]), products: new Set(["headband-1"]) };
  it("checks category and product links, lets other links through", () => {
    expect(linksToLivePage("/categories/prints", live)).toBe(true);
    expect(linksToLivePage("/categories/stickers", live)).toBe(false);
    expect(linksToLivePage("/produits/headband-1", live)).toBe(true);
    expect(linksToLivePage("/produits/headband-2", live)).toBe(false);
    expect(linksToLivePage("/infos/mail-club", live)).toBe(true);
    expect(linksToLivePage(undefined, live)).toBe(true);
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
