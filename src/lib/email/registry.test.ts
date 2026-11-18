import { describe, expect, it } from "vitest";
import { renderEmail, sanitizeOverride } from "./registry";

const BASE = {
  origin: "https://dourya.fr",
  legal: { name: "Société Exemple", address: "1 rue Fictive, 00000 Ville", registration: "" },
  unsubscribeUrl: "https://dourya.fr/desinscription?token=ne-doit-pas-apparaitre",
};
const LINK = "https://dourya.fr/auth/action?mode=verifyEmail&oobCode=EXEMPLE-FICTIF-123";

describe("renderEmail", () => {
  it("renders the verification e-mail with the link, the logo and the legal mentions", async () => {
    const mail = await renderEmail("auth-verify-email", { actionUrl: LINK }, BASE);
    expect(mail.category).toBe("security");
    expect(mail.subject).toBe("Confirmez votre adresse e-mail DOURYA");
    expect(mail.html).toContain(LINK.replace(/&/g, "&amp;"));
    expect(mail.html).toContain("/brand/logo-full.png");
    expect(mail.html).toContain('alt="DOURYA"');
    expect(mail.html).toContain("Société Exemple");
    expect(mail.text).toContain(LINK);
  });
  it("never adds an unsubscribe link to a security e-mail", async () => {
    for (const type of ["auth-verify-email", "auth-reset-password"] as const) {
      const mail = await renderEmail(type, { actionUrl: LINK }, BASE);
      expect(mail.html).not.toContain("ne-doit-pas-apparaitre");
      expect(mail.html).not.toContain("Se désinscrire");
      expect(mail.text).not.toContain("ne-doit-pas-apparaitre");
    }
  });
  it("shows a marker instead of inventing missing legal values", async () => {
    const mail = await renderEmail("auth-reset-password", { actionUrl: LINK }, { ...BASE, legal: { name: "", address: "", registration: "" } });
    expect(mail.text).toContain("EMAIL_LEGAL_NAME");
    expect(mail.text).toContain("EMAIL_LEGAL_ADDRESS");
  });
  it("applies a sanitised override", async () => {
    const mail = await renderEmail("auth-reset-password", { actionUrl: LINK }, BASE, { subject: "Votre nouveau mot de passe" });
    expect(mail.subject).toBe("Votre nouveau mot de passe");
  });
});

describe("sanitizeOverride", () => {
  it("keeps safe texts and drops the rest", () => {
    expect(sanitizeOverride({ subject: "  Bonjour  ", preheader: "Court" })).toEqual({ subject: "Bonjour", preheader: "Court" });
    expect(sanitizeOverride({ subject: "<b>x</b>" })).toEqual({});
    expect(sanitizeOverride({ subject: "ab" })).toEqual({});
    expect(sanitizeOverride({ subject: "a".repeat(121) })).toEqual({});
    expect(sanitizeOverride({ subject: "Ligne\nBcc" })).toEqual({});
    expect(sanitizeOverride(null)).toEqual({});
  });
});
