import { describe, expect, it } from "vitest";
import { applyCovers } from "./gallery-covers.mjs";

const img = (n: number, original: string) => ({ src: `/images/products/prints/print-twilight/0${n}.webp`, width: 10, height: 10, original });
const galleries = [
  { slug: "print-twilight", folder: "TWILIGHT", rubrique: "PRINTS", category: "prints", kind: "print", images: [img(1, "IMG_6793.jpeg"), img(2, "IMG_6795.jpeg")] },
  { slug: "headband-1", folder: "HEADBAND 1", rubrique: "HEADBANDS", category: "headbands", kind: "headband", images: [img(1, "IMG_6856.jpeg")] },
  { slug: "sticker-fee", folder: "STICKER FEE", rubrique: "STICKERS UNITE", category: "stickers", kind: "sticker", images: [img(1, "IMG_6818.jpeg")] },
];

describe("applyCovers (galeries.json)", () => {
  it("moves the photo whose src is the cover first, found through its source file name", () => {
    const json = {
      galleries: [
        { folder: "TWILIGHT", cover: "twilight/b.jpg", images: [{ src: "twilight/a.jpg", source: "PRINTS/TWILIGHT/IMG_6793.JPG" }, { src: "twilight/b.jpg", source: "PRINTS\\TWILIGHT\\IMG_6795.HEIC" }] },
        { slug: "headband-1", cover: "h.jpg", images: [{ src: "h.jpg", source: "IMG_6856.jpeg" }] },
      ],
    };
    const { galleries: out, report } = applyCovers(galleries, json);
    expect(out[0].images.map((i: { original: string }) => i.original)).toEqual(["IMG_6795.jpeg", "IMG_6793.jpeg"]);
    expect(report).toEqual([
      { slug: "print-twilight", status: "ok", detail: "IMG_6795.jpeg" },
      { slug: "headband-1", status: "already-first", detail: "IMG_6856.jpeg" },
      { slug: "sticker-fee", status: "missing", detail: "galerie absente de galeries.json" },
    ]);
  });

  it("takes the most precise entry: sticker-nokio is not the nokio key ring", () => {
    const nokio = [
      { slug: "porte-cles-nokio", folder: "NOKIO", rubrique: "PORTECLES", category: "porte-cles", kind: "porte-cles", images: [img(1, "IMG_6772.jpeg")] },
      { slug: "sticker-nokio", folder: "STICKER NOKIO", rubrique: "STICKERS UNITE", category: "stickers", kind: "sticker", images: [img(1, "IMG_6753.jpeg"), img(2, "IMG_6754.jpeg")] },
    ];
    const json = [
      { folder: "PHOTOS/PORTECLES/NOKIO", slug: "nokio", cover: "a", images: [{ src: "a", source: "PHOTOS/PORTECLES/NOKIO/IMG_6772.jpeg" }] },
      { folder: "PHOTOS/STICKERS UNITE/STICKER NOKIO", slug: "sticker-nokio", cover: "b", images: [{ src: "b", source: "PHOTOS/STICKERS UNITE/STICKER NOKIO/IMG_6754.jpeg" }] },
    ];
    const { report } = applyCovers(nokio, json);
    expect(report).toEqual([
      { slug: "porte-cles-nokio", status: "already-first", detail: "IMG_6772.jpeg" },
      { slug: "sticker-nokio", status: "ok", detail: "IMG_6754.jpeg" },
    ]);
  });

  it("reports a cover with no matching src or an unknown source, and keeps the order", () => {
    const json = [
      { name: "Twilight", cover: "x.jpg", images: [{ src: "y.jpg", source: "IMG_6795.jpeg" }] },
      { folder: "HEADBAND 1", cover: "h.jpg", images: [{ src: "h.jpg", source: "IMG_9999.jpeg" }] },
    ];
    const { galleries: out, report } = applyCovers(galleries, json);
    expect(out[0].images[0].original).toBe("IMG_6793.jpeg");
    expect(report[0]).toMatchObject({ status: "missing", detail: "aucune image avec src = cover (x.jpg)" });
    expect(report[1]).toMatchObject({ status: "missing", detail: "source introuvable parmi les photos importées (IMG_9999.jpeg)" });
  });
});
