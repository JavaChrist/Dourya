import { describe, expect, it } from "vitest";
import { googleSignInErrorMessage, signInErrorMessage } from "./auth-errors";

const err = (code: string) => Object.assign(new Error("x"), { code });

describe("googleSignInErrorMessage", () => {
  it("stays silent when the visitor closes the popup", () => {
    for (const code of ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]) {
      expect(googleSignInErrorMessage(err(code))).toBeNull();
    }
  });

  it("explains the cases the visitor can act on", () => {
    expect(googleSignInErrorMessage(err("auth/popup-blocked"))).toMatch(/bloquée/);
    expect(googleSignInErrorMessage(err("auth/account-exists-with-different-credential"))).toMatch(/mot de passe/);
    expect(googleSignInErrorMessage(err("auth/operation-not-allowed"))).toMatch(/pas encore disponible/);
    expect(googleSignInErrorMessage(err("auth/unauthorized-domain"))).toMatch(/pas encore disponible/);
  });

  it("falls back to a generic message", () => {
    expect(googleSignInErrorMessage(err("auth/internal-error"))).toMatch(/n'a pas abouti/);
    expect(googleSignInErrorMessage(null)).toMatch(/n'a pas abouti/);
  });
});

describe("signInErrorMessage", () => {
  it("never says which field was wrong", () => {
    expect(signInErrorMessage(err("auth/user-not-found"))).toBe("Adresse e-mail ou mot de passe incorrect.");
    expect(signInErrorMessage(err("auth/wrong-password"))).toBe("Adresse e-mail ou mot de passe incorrect.");
  });
});
