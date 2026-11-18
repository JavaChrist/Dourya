import { describe, expect, it } from "vitest";
import { passwordProblem, validateAddress, validateDisplayName } from "./validation";

const address = { fullName: "Marie Dupont", line1: "1 rue de la Paix", postalCode: "75002", city: "Paris", country: "FR" };

describe("account validation", () => {
  it("accepts a valid French address and trims it", () => {
    const r = validateAddress({ ...address, city: "  Paris  ", line2: "" });
    expect(r).toEqual({ ok: true, value: { ...address } });
  });
  it("rejects missing fields, bad postal code and unknown country", () => {
    const r = validateAddress({ ...address, fullName: "", postalCode: "7500" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["fullName", "postalCode"]);
    const other = validateAddress({ ...address, country: "US" });
    expect(other.ok).toBe(false);
    if (!other.ok) expect(Object.keys(other.errors)).toContain("country");
  });
  it("rejects too long values instead of cutting them silently", () => {
    const r = validateAddress({ ...address, line1: "a".repeat(200) });
    expect(r.ok).toBe(false);
  });
  it("validates the display name", () => {
    expect(validateDisplayName("  Marie-Ève  O'Neil ")).toEqual({ ok: true, value: "Marie-Ève O'Neil" });
    expect(validateDisplayName("<script>").ok).toBe(false);
    expect(validateDisplayName("")).toEqual({ ok: true, value: "" });
  });
  it("checks the password length", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("assez-long")).toBeNull();
    expect(passwordProblem("a".repeat(129))).not.toBeNull();
  });
});
