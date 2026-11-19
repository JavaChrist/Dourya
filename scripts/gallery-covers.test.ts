import { describe, expect, it } from "vitest";
import { applyCovers, applyMembership } from "./gallery-covers.mjs";

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

describe("applyMembership (galeries.json)", () => {
  const p = (dir: string, n: number, original: string) => ({ src: `/images/products/prints/${dir}/0${n}.webp`, width: 10, height: 10, original });
  const base = () => [
    { slug: "print-twilight", folder: "TWILIGHT", rubrique: "PRINTS", category: "prints", kind: "print", images: [p("print-twilight", 1, "IMG_6793.jpeg"), p("print-twilight", 2, "IMG_6827.jpeg"), p("print-twilight", 3, "IMG_6829.jpeg")] },
    { slug: "print-chat-roi-2", folder: "CHAT ROI 2", rubrique: "PRINTS", category: "prints", kind: "print", images: [p("print-chat-roi-2", 1, "IMG_6830.jpeg")] },
    { slug: "print-chat-roi-3", folder: "CHAT ROI 3", rubrique: "PRINTS", category: "prints", kind: "print", images: [p("print-chat-roi-3", 1, "IMG_6828.jpeg")] },
  ];
  const entry = (folder: string, cover: string, sources: string[]) => ({ folder, cover, images: sources.map((s) => ({ src: s.toLowerCase(), source: `PRINTS/${folder}/${s}` })) });

  it("moves a photo to its new gallery, keeps the file and the cover first", () => {
    const json = { galleries: [
      entry("TWILIGHT", "img_6793.jpeg", ["IMG_6793.jpeg"]),
      entry("CHAT ROI 2", "img_6830.jpeg", ["IMG_6829.jpeg", "IMG_6830.jpeg"]),
      entry("CHAT ROI 3", "img_6828.jpeg", ["IMG_6827.jpeg", "IMG_6828.jpeg"]),
    ] };
    const { ok, galleries: out, moved, dropped } = applyMembership(base(), json);
    expect(ok).toBe(true);
    expect(dropped).toEqual([]);
    const names = (slug: string) => out.find((g: { slug: string }) => g.slug === slug).images.map((i: { original: string }) => i.original);
    expect(names("print-twilight")).toEqual(["IMG_6793.jpeg"]);
    expect(names("print-chat-roi-2")).toEqual(["IMG_6830.jpeg", "IMG_6829.jpeg"]);
    expect(names("print-chat-roi-3")).toEqual(["IMG_6828.jpeg", "IMG_6827.jpeg"]);
    // The .webp keeps its path: only membership changes.
    expect(out.find((g: { slug: string }) => g.slug === "print-chat-roi-2").images[1].src).toBe("/images/products/prints/print-twilight/03.webp");
    expect(moved).toEqual([
      { original: "IMG_6829.jpeg", from: "print-twilight", to: "print-chat-roi-2" },
      { original: "IMG_6827.jpeg", from: "print-twilight", to: "print-chat-roi-3" },
    ]);
  });

  it("refuses an unknown photo, a photo claimed twice and reports a dropped one", () => {
    const unknown = applyMembership(base(), { galleries: [entry("TWILIGHT", "img_6793.jpeg", ["IMG_6793.jpeg", "IMG_9999.jpeg"]), entry("CHAT ROI 2", "img_6830.jpeg", ["IMG_6830.jpeg"]), entry("CHAT ROI 3", "img_6828.jpeg", ["IMG_6828.jpeg", "IMG_6830.jpeg"])] });
    expect(unknown.ok).toBe(false);
    expect(unknown.report.filter((r: { status: string }) => r.status === "missing").map((r: { detail: string }) => r.detail)).toEqual(["photo inconnue : IMG_9999.jpeg", "photo déjà dans print-chat-roi-2 : IMG_6830.jpeg"]);
    expect(unknown.dropped.map((d: { original: string }) => d.original).sort()).toEqual(["IMG_6827.jpeg", "IMG_6829.jpeg"]);
  });
});
