import { describe, expect, it } from "vitest";
import { isOobCode, toSiteActionLink } from "./links";

const CODE = "AbCdEf123456_-xyz";

describe("toSiteActionLink", () => {
  it("rebuilds the link on the site and drops the continue URL", () => {
    const generated = `https://dourya.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${CODE}&apiKey=fictif&continueUrl=https%3A%2F%2Fevil.test&lang=fr`;
    expect(toSiteActionLink(generated, "https://dourya.fr", "verifyEmail")).toBe(`https://dourya.fr/auth/action?mode=verifyEmail&oobCode=${CODE}`);
  });
  it("refuses another mode, a bad code or a broken URL", () => {
    expect(toSiteActionLink(`https://x.test/?mode=resetPassword&oobCode=${CODE}`, "https://dourya.fr", "verifyEmail")).toBeNull();
    expect(toSiteActionLink("https://x.test/?mode=verifyEmail&oobCode=<script>", "https://dourya.fr", "verifyEmail")).toBeNull();
    expect(toSiteActionLink("pas une url", "https://dourya.fr", "verifyEmail")).toBeNull();
  });
  it("validates codes", () => {
    expect(isOobCode(CODE)).toBe(true);
    expect(isOobCode("court")).toBe(false);
    expect(isOobCode(null)).toBe(false);
  });
});
