import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/types";
import { buildNav, HEADER_CATEGORY_LIMIT, parseSiteUrl, resolveSiteUrl } from "./site";

const cat = (slug: string, name: string, visible = true) => ({ id: slug, slug, name, visible }) as Category;

describe("buildNav", () => {
  const categories = [cat("prints", "Prints"), cat("stickers", "Stickers"), cat("cachee", "Cachée", false), cat("porte-cles", "Porte-clés"), cat("headbands", "Headbands"), cat("test", "Test")];

  it("lists Boutique, every visible rubrique in the given order, then Mail Club", () => {
    expect(buildNav(categories).map((i) => i.href)).toEqual([
      "/boutique",
      "/categories/prints",
      "/categories/stickers",
      "/categories/porte-cles",
      "/categories/headbands",
      "/categories/test",
      "/infos/mail-club",
    ]);
  });

  it("caps the rubriques for the desktop header", () => {
    expect(buildNav(categories, 4).map((i) => i.label)).toEqual(["Boutique", "Prints", "Stickers", "Porte-clés", "Headbands", "Mail Club"]);
  });

  it("keeps only Boutique and Mail Club in the desktop header (rubriques in the menu)", () => {
    expect(buildNav(categories, HEADER_CATEGORY_LIMIT).map((i) => i.label)).toEqual(["Boutique", "Mail Club"]);
  });
});

describe("parseSiteUrl", () => {
  it("keeps only the origin of a valid URL", () => {
    expect(parseSiteUrl("https://dourya.fr")).toBe("https://dourya.fr");
    expect(parseSiteUrl(" https://dourya.fr/ ")).toBe("https://dourya.fr");
    expect(parseSiteUrl("https://dourya.fr/boutique?x=1")).toBe("https://dourya.fr");
    expect(parseSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("rejects empty, invalid or non-http values", () => {
    expect(parseSiteUrl(undefined)).toBeUndefined();
    expect(parseSiteUrl("")).toBeUndefined();
    expect(parseSiteUrl("dourya.fr")).toBeUndefined();
    expect(parseSiteUrl("javascript:alert(1)")).toBeUndefined();
    expect(parseSiteUrl("ftp://dourya.fr")).toBeUndefined();
  });
});

describe("resolveSiteUrl", () => {
  it("ignores a local origin in a production build", () => {
    for (const raw of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "http://shop.localhost"]) {
      expect(resolveSiteUrl(raw, true)).toBeUndefined();
    }
  });
  it("keeps a local origin in development", () => {
    expect(resolveSiteUrl("http://localhost:3000", false)).toBe("http://localhost:3000");
  });
  it("keeps the real domain in production", () => {
    expect(resolveSiteUrl("https://dourya.fr/", true)).toBe("https://dourya.fr");
    expect(resolveSiteUrl(undefined, true)).toBeUndefined();
  });
});
