import { describe, expect, it } from "vitest";
import { PLACEHOLDER_SLUG, slugParams } from "./static-params";

describe("slugParams", () => {
  it("maps the slugs, or returns one placeholder when there are none", () => {
    expect(slugParams(["a", "b"])).toEqual([{ slug: "a" }, { slug: "b" }]);
    expect(slugParams([])).toEqual([{ slug: PLACEHOLDER_SLUG }]);
  });
});
