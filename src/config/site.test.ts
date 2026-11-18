import { describe, expect, it } from "vitest";
import { parseSiteUrl, resolveSiteUrl } from "./site";

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
