import { describe, expect, it } from "vitest";
import { postSignInPath, safeNext } from "./redirect";

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

describe("postSignInPath (admin recognised by its role)", () => {
  it("customer: the safe next path, /mon-compte by default", () => {
    expect(postSignInPath("customer")).toBe("/mon-compte");
    expect(postSignInPath("customer", "/panier")).toBe("/panier");
    expect(postSignInPath("customer", "https://evil.test")).toBe("/mon-compte");
  });

  it("admin from the normal page: /admin, or the admin page asked for", () => {
    expect(postSignInPath("admin")).toBe("/admin");
    expect(postSignInPath("admin", "/mon-compte")).toBe("/admin");
    expect(postSignInPath("admin", "/admin/catalogue")).toBe("/admin/catalogue");
    expect(postSignInPath("admin", "/administrateur")).toBe("/admin");
    expect(postSignInPath("admin", "//evil.test")).toBe("/admin");
  });

  it("admin from the admin page: same rule", () => {
    expect(postSignInPath("admin")).toBe("/admin");
    expect(postSignInPath("admin", "/admin/catalogue")).toBe("/admin/catalogue");
  });
});
