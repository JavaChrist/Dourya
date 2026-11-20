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
  it("puts every padding on a <td>, never on a <table> (ignored by Outlook and some webmails)", async () => {
    for (const type of ["auth-verify-email", "auth-reset-password"] as const) {
      const mail = await renderEmail(type, { actionUrl: LINK }, BASE);
      const tables = mail.html.match(/<table[^>]*>/g) ?? [];
      expect(tables.filter((tag) => /padding:\s*(?!0(?:[;"]|px[;"]))/.test(tag))).toEqual([]);
      expect(mail.html).toMatch(/<td[^>]*padding:32px 28px 8px/);
    }
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

describe("withdrawal-received", () => {
  const DATA = {
    name: "Client Exemple",
    reference: "commande n° EXEMPLE-FICTIF",
    receivedAtLabel: "20 novembre 2026 à 10:30",
    items: [
      { label: "Carnet A5 × 1", personalised: false },
      { label: "Headband × 1", personalised: true },
    ],
    returnGoods: true,
    returnByLabel: "4 décembre 2026",
    subscriptionStopped: false,
  };
  it("gives the date, the items, the return address and the deadline, without unsubscribe link", async () => {
    const mail = await renderEmail("withdrawal-received", DATA, BASE);
    expect(mail.category).toBe("transactional");
    for (const part of ["20 novembre 2026 à 10:30", "Carnet A5 × 1", "5, rue Maurice Fonvieille", "31120 Portet-sur-Garonne", "4 décembre 2026", "L. 221-28"]) {
      expect(mail.text).toContain(part);
      expect(mail.html).toContain(part);
    }
    expect(mail.html).not.toContain("ne-doit-pas-apparaitre");
    const tables = mail.html.match(/<table[^>]*>/g) ?? [];
    expect(tables.filter((tag) => /padding:\s*(?!0(?:[;"]|px[;"]))/.test(tag))).toEqual([]);
  });
  it("Mail Club: no return address, says the subscription is stopped", async () => {
    const mail = await renderEmail("withdrawal-received", { ...DATA, items: [{ label: "Dopamine Mail Club", personalised: false }], returnGoods: false, subscriptionStopped: true }, BASE);
    expect(mail.text).not.toContain("Maurice Fonvieille");
    expect(mail.text).toContain("abonnement est arrêté");
  });
});
