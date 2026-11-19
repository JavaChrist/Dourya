// Sets each gallery's photos (membership) and cover from galeries.json in
// src/data/product-galleries.generated.ts, and reports what could not be matched.
// applyCovers (order only) is kept for the tests; main() applies applyMembership.
//
//   node scripts/gallery-covers.mjs "C:\path\to\galeries.json"
//
// For each gallery of galeries.json: the image whose `src` equals `cover` gives
// a `source`; its file name is looked up among the imported photos (`original`).
// That photo moves to the front (main photo). The .webp files are not touched,
// only the order in the generated file changes. Nothing else is modified.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const slugify = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** File name without folders or extension, lower case: "PRINTS/TWILIGHT/IMG_6793.JPG" -> "img_6793". */
const stem = (p) => path.basename(String(p).replace(/\\/g, "/")).replace(/\.[^.]+$/, "").toLowerCase();

/** galeries.json may be an array, { galleries: [...] }, { galeries: [...] } or an object keyed by gallery. */
function listGalleries(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["galleries", "galeries"]) if (Array.isArray(json?.[key])) return json[key];
  if (json && typeof json === "object") return Object.entries(json).map(([key, g]) => ({ key, ...g }));
  return [];
}

/** Every name a gallery entry may go by, as slugs (slug, id, folder, name...). */
function keysOf(g) {
  const keys = ["slug", "id", "key", "folder", "dossier", "name", "nom", "title", "titre"]
    .map((k) => g?.[k])
    .filter((v) => typeof v === "string" && v.trim());
  // A folder path "PHOTOS/STICKERS UNITE/STICKER NOKIO" also goes by "STICKERS UNITE/STICKER NOKIO".
  for (const k of ["folder", "dossier"]) {
    const v = typeof g?.[k] === "string" ? g[k].replace(/\\/g, "/") : "";
    if (v.includes("/")) keys.push(v.replace(/^PHOTOS\//i, ""));
  }
  return keys.map(slugify);
}

/**
 * Returns the galleries with each matched cover moved first, and a report line
 * per gallery: { slug, status: "ok" | "already-first" | "missing", detail }.
 */
/** The galeries.json entry of a gallery. Most precise name first: "sticker-nokio" must not take the "nokio" key ring's entry. */
function findEntry(gallery, keyed) {
  const names = [
    gallery.rubrique ? slugify(`${gallery.rubrique}/${gallery.folder}`) : null,
    gallery.slug,
    slugify(gallery.folder),
    gallery.slug.replace(/^[a-z]+-/, ""),
  ].filter(Boolean);
  for (const name of names) {
    const entry = keyed.find(({ keys }) => keys.includes(name))?.e;
    if (entry) return entry;
  }
  return undefined;
}

export function applyCovers(galleries, json) {
  const keyed = listGalleries(json).map((e) => ({ e, keys: keysOf(e) }));
  const report = [];
  const result = galleries.map((gallery) => {
    const entry = findEntry(gallery, keyed);
    const miss = (detail) => (report.push({ slug: gallery.slug, status: "missing", detail }), gallery);
    if (!entry) return miss("galerie absente de galeries.json");
    if (!entry.cover) return miss("pas de champ cover");
    const images = Array.isArray(entry.images) ? entry.images : [];
    const coverImage = images.find((img) => img?.src === entry.cover);
    if (!coverImage) return miss(`aucune image avec src = cover (${entry.cover})`);
    if (!coverImage.source) return miss("l'image de couverture n'a pas de champ source");
    const index = gallery.images.findIndex((img) => stem(img.original) === stem(coverImage.source));
    if (index === -1) return miss(`source introuvable parmi les photos importées (${path.basename(String(coverImage.source))})`);
    const original = gallery.images[index].original;
    report.push({ slug: gallery.slug, status: index === 0 ? "already-first" : "ok", detail: original });
    if (index === 0) return gallery;
    const reordered = [gallery.images[index], ...gallery.images.filter((_, i) => i !== index)];
    return { ...gallery, images: reordered };
  });
  return { galleries: result, report };
}

/**
 * Image membership from galeries.json: each gallery takes exactly the photos
 * its entry lists (matched by source file name, wherever the .webp is now),
 * the cover first, then the order of galeries.json. The .webp files are not
 * moved or renamed: a photo that changes gallery keeps its file.
 * Refuses (ok: false) when a gallery has no entry, a listed photo is unknown,
 * a photo is claimed by two galleries or the cover is not among the images.
 * Returns { ok, galleries, report, moved, dropped }.
 */
export function applyMembership(galleries, json) {
  const keyed = listGalleries(json).map((e) => ({ e, keys: keysOf(e) }));
  const byStem = new Map();
  for (const g of galleries) for (const img of g.images) byStem.set(stem(img.original), { img, from: g.slug });
  const report = [];
  const moved = [];
  const claimed = new Map();
  let ok = true;
  const fail = (slug, detail) => { ok = false; report.push({ slug, status: "missing", detail }); };
  const result = galleries.map((gallery) => {
    const entry = findEntry(gallery, keyed);
    if (!entry) return fail(gallery.slug, "galerie absente de galeries.json"), gallery;
    const listed = Array.isArray(entry.images) ? entry.images : [];
    const cover = listed.find((img) => img?.src === entry.cover);
    if (!cover?.source) return fail(gallery.slug, "couverture absente des images"), gallery;
    const ordered = [cover, ...listed.filter((img) => img !== cover)];
    const images = [];
    for (const img of ordered) {
      const key = stem(img?.source ?? "");
      const found = byStem.get(key);
      if (!found) { fail(gallery.slug, `photo inconnue : ${path.basename(String(img?.source))}`); continue; }
      if (claimed.has(key)) { fail(gallery.slug, `photo déjà dans ${claimed.get(key)} : ${found.img.original}`); continue; }
      claimed.set(key, gallery.slug);
      if (found.from !== gallery.slug) moved.push({ original: found.img.original, from: found.from, to: gallery.slug });
      images.push(found.img);
    }
    report.push({ slug: gallery.slug, status: "ok", detail: `${images.length} photo(s), couverture ${images[0]?.original ?? "aucune"}` });
    return { ...gallery, images };
  });
  const dropped = [...byStem.entries()].filter(([k]) => !claimed.has(k)).map(([, v]) => ({ original: v.img.original, from: v.from }));
  return { ok, galleries: result, report, moved, dropped };
}

const HEADER = `// GENERATED by scripts/import-product-photos.mjs: do not edit by hand.
// One entry per photo folder. images[0] is the main photo: the cover from
// galeries.json when scripts/gallery-covers.mjs found it, else the first file
// name (to validate with Lizzie). \`original\` = source file name, for review.

export type GalleryImage = { src: string; width: number; height: number; original: string };
export type PhotoGallery = { slug: string; folder: string; rubrique: string; category: string | null; kind: string; images: GalleryImage[] };

export const photoGalleries: PhotoGallery[] = `;

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("usage: node scripts/gallery-covers.mjs <galeries.json>");
    process.exit(2);
  }
  const ROOT = path.resolve(import.meta.dirname, "..");
  const target = path.join(ROOT, "src", "data", "product-galleries.generated.ts");
  const source = await readFile(target, "utf8");
  const start = source.indexOf("export const photoGalleries: PhotoGallery[] = ");
  const arrayText = source.slice(start).replace("export const photoGalleries: PhotoGallery[] = ", "").replace(/;\s*$/, "");
  const galleries = JSON.parse(arrayText);
  const json = JSON.parse(await readFile(jsonPath, "utf8"));
  const { ok, galleries: next, report, moved, dropped } = applyMembership(galleries, json);
  for (const r of report) console.log(`${r.status.padEnd(8)} ${r.slug.padEnd(28)} ${r.detail}`);
  for (const m of moved) console.log(`déplacée ${m.original} : ${m.from} -> ${m.to}`);
  for (const d of dropped) console.log(`retirée  ${d.original} (${d.from}) : absente de galeries.json`);
  if (!ok || dropped.length) {
    console.error("\nCorrespondances incomplètes : fichier généré inchangé.");
    process.exit(1);
  }
  await writeFile(target, `${HEADER}${JSON.stringify(next, null, 2)};\n`);
  console.log(`\n${next.length} galerie(s), ${next.reduce((n, g) => n + g.images.length, 0)} photo(s), ${moved.length} déplacée(s). Fichier généré mis à jour.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
