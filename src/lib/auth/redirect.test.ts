import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext (open redirect protection)", () => {
  it("keeps a same-site relative path", () => {
    expect(safeNext("/mon-compte/adresses")).toBe("/mon-compte/adresses");
    expect(safeNext("/mon-compte?onglet=1#x")).toBe("/mon-compte?onglet=1#x");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "\\\\evil", "javascript:alert(1)", "mon-compte", "", "/\u0000x", "/a\\b"])(
    "rejects %j",
    (value) => expect(safeNext(value)).toBe("/mon-compte"),
  );
  it("falls back on null and very long values", () => {
    expect(safeNext(null)).toBe("/mon-compte");
    expect(safeNext("/" + "a".repeat(600))).toBe("/mon-compte");
  });
});
