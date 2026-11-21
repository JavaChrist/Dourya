import { describe, expect, it } from "vitest";
import { heroCarousel, manualCarousel } from "@/data/home";
import type { PhotoGallery } from "@/data/product-galleries.generated";
import type { Product } from "@/lib/types";
import {
  HOME_LIMITS,
  codeCarousels,
  imageChoices,
  isHomeImageSrc,
  parseStoredCarousels,
  toSlides,
  validateHomeInput,
  type HomeAllowed,
  type HomeSlideInput,
} from "./carousels";

const IMG = "/images/products/prints/print-gros-dodo/01.webp";
const UPLOADED = "/catalogue/photos/p-sticker-lune/abcdef1234.webp";

const allowed: HomeAllowed = {
  images: new Map([
    [IMG, { width: 780, height: 780 }],
    [UPLOADED, { width: 1200, height: 900 }],
  ]),
  categorySlugs: new Set(["prints", "stickers"]),
  productSlugs: new Set(["print-gros-dodo", "sticker-lune"]),
};

const slide = (patch: Partial<HomeSlideInput> = {}): HomeSlideInput => ({
  id: "s1",
  title: "Les prints",
  subtitle: "",
  imageSrc: IMG,
  alt: "Print Gros Dodo",
  href: "/categories/prints",
  linkLabel: "",
  active: true,
  ...patch,
});

describe("isHomeImageSrc", () => {
  it("accepts the shop's product photos and the public photo route only", () => {
    expect(isHomeImageSrc(IMG)).toBe(true);
    expect(isHomeImageSrc(UPLOADED)).toBe(true);
    expect(isHomeImageSrc("/admin/catalogue/photos/p-sticker-lune/abcdef1234.webp")).toBe(false);
    expect(isHomeImageSrc("https://example.com/a.webp")).toBe(false);
    expect(isHomeImageSrc("/images/products/../../secret.webp")).toBe(false);
    expect(isHomeImageSrc("/images/logo.svg")).toBe(false);
  });
});

describe("validateHomeInput", () => {
  it("returns the carousels with the real image size, trimmed text and no empty optional field", () => {
    const res = validateHomeInput(
      {
        hero: [slide({ title: "  Les prints ", linkLabel: "Voir les prints" })],
        selection: [slide({ id: "s2", href: "/produits/sticker-lune", imageSrc: UPLOADED, subtitle: "Nouveau", linkLabel: "ignoré", active: false })],
      },
      allowed,
    );
    expect(res).toEqual({
      ok: true,
      value: {
        hero: [{ id: "s1", title: "Les prints", image: { src: IMG, alt: "Print Gros Dodo", width: 780, height: 780 }, href: "/categories/prints", linkLabel: "Voir les prints", active: true }],
        selection: [{ id: "s2", title: "Les prints", subtitle: "Nouveau", image: { src: UPLOADED, alt: "Print Gros Dodo", width: 1200, height: 900 }, href: "/produits/sticker-lune", active: false }],
      },
    });
  });

  it("flags each wrong field by slide id", () => {
    const res = validateHomeInput(
      {
        hero: [slide({ title: "", imageSrc: "/images/products/prints/inconnu/01.webp", alt: "", href: "/produits/print-gros-dodo", active: "oui" as unknown as boolean })],
        selection: [slide({ id: "s2", imageSrc: "", href: "/produits/inconnu", title: "x".repeat(HOME_LIMITS.title + 1) })],
      },
      allowed,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.errors).sort()).toEqual(["s1.active", "s1.alt", "s1.href", "s1.image", "s1.title", "s2.href", "s2.image", "s2.title"]);
    expect(res.errors["s2.href"]).toBe("Ce produit n'existe pas.");
    expect(res.errors["s1.image"]).toMatch(/n'existe plus/);
  });

  it("refuses an unknown rubrique, a duplicate id, too many slides and an unreadable payload", () => {
    expect(validateHomeInput({ hero: [slide({ href: "/categories/inconnue" })], selection: [] }, allowed)).toMatchObject({ ok: false, errors: { "s1.href": "Cette rubrique n'existe pas." } });
    expect(validateHomeInput({ hero: [slide(), slide()], selection: [] }, allowed)).toMatchObject({ ok: false, errors: { hero: expect.any(String) } });
    expect(validateHomeInput({ hero: [], selection: [slide()] }, allowed)).toMatchObject({ ok: false, errors: { "s1.href": "Ce produit n'existe pas." } });
    const many = Array.from({ length: HOME_LIMITS.slides.hero + 1 }, (_, i) => slide({ id: `s${i}` }));
    expect(validateHomeInput({ hero: many, selection: [] }, allowed)).toMatchObject({ ok: false, errors: { hero: `${HOME_LIMITS.slides.hero} diapos au maximum.` } });
    expect(validateHomeInput(null, allowed)).toMatchObject({ ok: false, errors: { hero: expect.any(String), selection: expect.any(String) } });
    expect(validateHomeInput({ hero: [slide({ id: "Pas Un Id" })], selection: [] }, allowed).ok).toBe(false);
  });

  it("accepts empty carousels (the carousel is then hidden on the home)", () => {
    expect(validateHomeInput({ hero: [], selection: [] }, allowed)).toEqual({ ok: true, value: { hero: [], selection: [] } });
  });
});

describe("parseStoredCarousels", () => {
  const good = { id: "s1", title: "Prints", image: { src: IMG, alt: "Print", width: 780, height: 780 }, href: "/categories/prints", linkLabel: "Voir", active: true };

  it("reads a valid document and drops malformed slides", () => {
    const parsed = parseStoredCarousels({
      hero: [good, { ...good, id: "s2", href: "https://example.com" }, { ...good, id: "s3", image: { ...good.image, width: -1 } }, "junk"],
      selection: [{ ...good, id: "s4", href: "/produits/print-gros-dodo" }],
      updatedAt: "2026-11-21T10:00:00.000Z",
    });
    expect(parsed?.hero.map((s) => s.id)).toEqual(["s1"]);
    expect(parsed?.selection).toEqual([{ id: "s4", title: "Prints", image: good.image, href: "/produits/print-gros-dodo", active: true }]);
  });

  it("returns null when the document has no usable carousels (then home.ts is kept)", () => {
    expect(parseStoredCarousels(undefined)).toBeNull();
    expect(parseStoredCarousels({ hero: [] })).toBeNull();
    expect(parseStoredCarousels({ hero: "x", selection: [] })).toBeNull();
  });
});

describe("imageChoices", () => {
  const product = (patch: Partial<Product>): Product =>
    ({ id: "p1", slug: "sticker-lune", name: "Sticker Lune", status: "published", categorySlugs: ["stickers"], images: [], isDemo: false, ...patch }) as Product;
  const galleries = [
    { slug: "g", folder: "prints/print-gros-dodo", rubrique: "prints", category: "prints", kind: "product", images: [{ src: IMG, width: 780, height: 780, original: "x" }] },
  ] as unknown as PhotoGallery[];

  it("lists product photos (uploaded ones by their public URL) then the galleries, without demo products or duplicates", () => {
    const choices = imageChoices(
      [
        product({ images: [{ src: "/admin/catalogue/photos/p-sticker-lune/abcdef1234.webp", alt: "", width: 1200, height: 900 }, { src: IMG, alt: "Dodo", width: 780, height: 780 }] }),
        product({ id: "demo", name: "Démo", isDemo: true, images: [{ src: "/images/products/demo/x/01.webp", alt: "", width: 1, height: 1 }] }),
      ],
      galleries,
    );
    expect(choices).toEqual([
      { src: UPLOADED, preview: "/admin/catalogue/photos/p-sticker-lune/abcdef1234.webp", width: 1200, height: 900, alt: "Sticker Lune", group: "Sticker Lune" },
      { src: IMG, preview: IMG, width: 780, height: 780, alt: "Dodo", group: "Sticker Lune" },
    ]);
  });
});

describe("codeCarousels and toSlides", () => {
  it("start the admin from home.ts without the demo slides, all active", () => {
    const code = codeCarousels();
    expect(code.hero.map((s) => s.id)).toEqual(heroCarousel.slides.filter((s) => !s.isDemo).map((s) => s.id));
    expect(code.selection.map((s) => s.id)).toEqual(manualCarousel.slides.filter((s) => !s.isDemo && s.image).map((s) => s.id));
    expect([...code.hero, ...code.selection].every((s) => s.active && isHomeImageSrc(s.image.src))).toBe(true);
    expect(code.hero[0].linkLabel).toBe(heroCarousel.slides[0].link?.label);
  });

  it("the code carousels pass the validation against their own photos and links", () => {
    const code = codeCarousels();
    const all = [...code.hero, ...code.selection];
    const res = validateHomeInput(
      {
        hero: code.hero.map((s) => ({ ...s, imageSrc: s.image.src, alt: s.image.alt, subtitle: s.subtitle ?? "", linkLabel: s.linkLabel ?? "" })),
        selection: code.selection.map((s) => ({ ...s, imageSrc: s.image.src, alt: s.image.alt, subtitle: s.subtitle ?? "", linkLabel: "" })),
      },
      {
        images: new Map(all.map((s) => [s.image.src, { width: s.image.width, height: s.image.height }])),
        categorySlugs: new Set(code.hero.map((s) => s.href.split("/")[2])),
        productSlugs: new Set(code.selection.map((s) => s.href.split("/")[2])),
      },
    );
    expect(res).toEqual({ ok: true, value: code });
  });

  it("keep only the active slides, in order, in the shape of the home components", () => {
    const code = codeCarousels();
    const [a, b] = code.hero;
    const slides = toSlides([{ ...b, active: false }, a]);
    expect(slides).toEqual([{ id: a.id, title: a.title, ...(a.subtitle ? { subtitle: a.subtitle } : {}), image: a.image, link: { href: a.href, label: a.linkLabel } }]);
  });
});
