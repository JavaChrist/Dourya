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

describe("order and Mail Club e-mails (3 to 7)", () => {
  const ADDRESS = ["Client Exemple", "1 rue Fictive", "00000 Ville", "France"];
  const LINES = [{ label: "Carnet A5", quantity: 1, totalLabel: "9,90 €" }];
  const cases = [
    {
      type: "order-confirmed",
      data: {
        name: "Client Exemple", orderId: "EXEMPLE-FICTIF", orderDateLabel: "20 novembre 2026", lines: LINES,
        subtotalLabel: "9,90 €", shippingLabel: "Lettre suivie", shippingPriceLabel: "3,50 €", totalLabel: "13,40 €",
        address: ADDRESS, madeToOrder: false, orderUrl: "https://dourya.fr/mon-compte/commandes/EXEMPLE-FICTIF",
      },
      parts: ["EXEMPLE-FICTIF", "Carnet A5", "13,40 €", "3,50 €", "1 rue Fictive", "https://dourya.fr/infos/cgv", "https://dourya.fr/retractation", "14 jours"],
    },
    {
      type: "order-shipped",
      data: {
        name: "Client Exemple", orderId: "EXEMPLE-FICTIF", lines: [{ label: "Carnet A5", quantity: 1 }], address: ADDRESS,
        carrier: "La Poste", trackingNumber: "1A00000000000", trackingUrl: "https://www.laposte.fr/outils/suivre-vos-envois?code=1A00000000000", orderUrl: null,
      },
      parts: ["EXEMPLE-FICTIF", "1A00000000000", "La Poste", "1 rue Fictive"],
    },
    {
      type: "order-refunded",
      data: { name: "Client Exemple", orderId: "EXEMPLE-FICTIF", amountLabel: "9,90 €", totalRefundedLabel: "9,90 €", full: true },
      parts: ["EXEMPLE-FICTIF", "9,90 €"],
    },
    {
      type: "mail-club-started",
      data: { priceLabel: "11,95 €", nextChargeLabel: "20 décembre 2026", address: ADDRESS, manageUrl: "https://dourya.fr/mon-compte/abonnement" },
      parts: ["11,95 €", "20 décembre 2026", "https://dourya.fr/mon-compte/abonnement", "https://dourya.fr/infos/cgv", "14 jours"],
    },
    {
      type: "mail-club-cancelled",
      data: { requestedAtLabel: "20 novembre 2026", endLabel: "20 décembre 2026", manageUrl: "https://dourya.fr/mon-compte/abonnement" },
      parts: ["20 novembre 2026", "20 décembre 2026", "aucun nouveau prélèvement"],
    },
  ] as const;

  for (const c of cases) {
    it(`${c.type}: transactional, content present, no unsubscribe link, paddings on <td>`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mail = await renderEmail(c.type, c.data as any, BASE);
      expect(mail.category).toBe("transactional");
      for (const part of c.parts) {
        expect(mail.text).toContain(part);
        expect(mail.html).toContain(part);
      }
      expect(mail.html).not.toContain("ne-doit-pas-apparaitre");
      expect(mail.text).not.toContain("ne-doit-pas-apparaitre");
      const tables = mail.html.match(/<table[^>]*>/g) ?? [];
      expect(tables.filter((tag) => /padding:\s*(?!0(?:[;"]|px[;"]))/.test(tag))).toEqual([]);
    });
  }

  it("order-shipped without tracking says so and has no tracking button", async () => {
    const mail = await renderEmail(
      "order-shipped",
      { name: "Client Exemple", orderId: "EXEMPLE-FICTIF", lines: [{ label: "Carnet A5", quantity: 1 }], address: ADDRESS, carrier: null, trackingNumber: null, trackingUrl: null, orderUrl: null },
      BASE,
    );
    expect(mail.text).toContain("pas de numéro de suivi");
    expect(mail.html).not.toContain("Suivre mon colis");
  });
});
