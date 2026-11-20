import { describe, expect, it } from "vitest";
import { isPackAdminPhotoUrl, toPublicPackPhotoUrl } from "./pack-photo-url";
import { type MailClubPack, PACK_ID_PATTERN, isPublishedPackPhoto, packMonthLabel, packReadiness, splitPublished, validatePackText } from "./packs";

const img = (packId: string, file: string, alt = "Photo") => ({ src: `/admin/mail-club/photos/${packId}/${file}`, alt, width: 800, height: 600 });
const pack = (id: string, over: Partial<MailClubPack> = {}): MailClubPack => ({
  id,
  title: `Pack ${id}`,
  description: "Texte",
  images: [img(id, "abcdef123456.webp")],
  status: "published",
  publishedAt: null,
  updatedAt: null,
  ...over,
});
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("Mail Club packs", () => {
  it("accepts only YYYY-MM month ids", () => {
    expect(PACK_ID_PATTERN.test("2026-12")).toBe(true);
    expect(PACK_ID_PATTERN.test("2026-13")).toBe(false);
    expect(PACK_ID_PATTERN.test("2026-1")).toBe(false);
    expect(PACK_ID_PATTERN.test("../x")).toBe(false);
  });

  it("labels the month in French", () => {
    expect(packMonthLabel("2026-12")).toBe("Décembre 2026");
    expect(packMonthLabel("2027-01")).toBe("Janvier 2027");
  });

  it("shows the latest published month as current, other published ones as previous, never drafts", () => {
    const { current, previous } = splitPublished([pack("2026-10"), pack("2027-01", { status: "draft" }), pack("2026-12"), pack("2026-11")]);
    expect(current?.id).toBe("2026-12");
    expect(previous.map((p) => p.id)).toEqual(["2026-11", "2026-10"]);
    expect(splitPublished([pack("2026-12", { status: "draft" })])).toEqual({ current: null, previous: [] });
  });

  it("lists what is missing before publishing", () => {
    expect(packReadiness(pack("2026-12"))).toEqual([]);
    expect(packReadiness({ title: " ", description: "", images: [] })).toEqual(["title", "description", "photo"]);
    expect(packReadiness({ title: "T", description: "D", images: [img("2026-12", "abcdef123456.webp", " ")] })).toEqual(["alt"]);
  });

  it("serves publicly only photos of a published pack", () => {
    const packs = [pack("2026-12"), pack("2027-01", { status: "draft" })];
    expect(isPublishedPackPhoto(packs, "2026-12", "abcdef123456.webp")).toBe(true);
    expect(isPublishedPackPhoto(packs, "2026-12", "other1234567.webp")).toBe(false);
    expect(isPublishedPackPhoto(packs, "2027-01", "abcdef123456.webp")).toBe(false);
    expect(isPublishedPackPhoto(packs, "2026-11", "abcdef123456.webp")).toBe(false);
  });

  it("validates the text form", () => {
    expect(validatePackText(form({ title: " Noël ", description: " Douceurs " }))).toEqual({ ok: true, value: { title: "Noël", description: "Douceurs" } });
    expect(validatePackText(form({ title: "", description: "" })).ok).toBe(false);
    expect(validatePackText(form({ title: "T", description: "x".repeat(2001) })).ok).toBe(false);
  });

  it("maps admin photo URLs to the public route", () => {
    const src = "/admin/mail-club/photos/2026-12/abcdef123456.webp";
    expect(isPackAdminPhotoUrl(src)).toBe(true);
    expect(toPublicPackPhotoUrl(src)).toBe("/mail-club/photos/2026-12/abcdef123456.webp");
    expect(toPublicPackPhotoUrl("/images/x.webp")).toBe("/images/x.webp");
  });
});
