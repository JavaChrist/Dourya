import { describe, expect, it } from "vitest";
import { parseSiteUrl } from "./site";

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
