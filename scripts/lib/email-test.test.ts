import { describe, expect, it } from "vitest";
import { checkLegal, checkRendered, fictitiousActionUrl, isLocalOrigin, maskAddress, parseTestArgs, senderDomain } from "./email-test";

describe("parseTestArgs", () => {
  it("is a dry run by default, for both templates", () => {
    expect(parseTestArgs([])).toEqual({ send: false, to: null, only: ["verify", "reset"], errors: [] });
  });

  it("needs --send and --to together for a real send", () => {
    expect(parseTestArgs(["--send"]).errors).toContain("--send demande --to <adresse>");
    expect(parseTestArgs(["--to", "a@example.test"]).errors).toHaveLength(1);
    expect(parseTestArgs(["--send", "--to", "a@example.test", "--only", "reset"])).toMatchObject({ send: true, to: "a@example.test", only: ["reset"], errors: [] });
  });

  it("refuses an invalid address or an unknown option", () => {
    expect(parseTestArgs(["--send", "--to", "pas-une-adresse"]).errors).toContain("--to n'est pas une adresse e-mail valide");
    expect(parseTestArgs(["--force"]).errors).toEqual(["option inconnue : --force"]);
    expect(parseTestArgs(["--only", "welcome"]).errors).toEqual(["--only attend verify ou reset"]);
  });
});

describe("helpers", () => {
  it("masks the address and reads the sender domain", () => {
    expect(maskAddress("christian@example.test")).toBe("c•••@example.test");
    expect(senderDomain("DOURYA <notifications@mail.example.test>")).toBe("mail.example.test");
    expect(senderDomain("notifications@mail.example.test")).toBe("mail.example.test");
    expect(senderDomain("REPLACE_ME")).toBeNull();
  });

  it("builds a fictitious link and spots local origins", () => {
    expect(fictitiousActionUrl("https://dourya.fr", "reset")).toBe("https://dourya.fr/auth/action?mode=resetPassword&oobCode=LIEN-DE-TEST-FICTIF");
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("https://dourya.fr")).toBe(false);
  });

  it("checks the legal mentions", () => {
    const ok = (l: { name: string; address: string; registration: string }) => checkLegal(l).every((c) => c.ok);
    expect(ok({ name: "Exemple SAS", address: "1 rue de l'Exemple, 75001 Paris", registration: "" })).toBe(true);
    expect(ok({ name: "Exemple SAS", address: "1 rue de l'Exemple 75001 Paris", registration: "SIRET 123 456 789 00012" })).toBe(true);
    expect(ok({ name: "Exemple SAS", address: "1 rue de l'Exemple, 75001 Paris", registration: "RCS Paris 123 456 789" })).toBe(true);
    expect(ok({ name: "", address: "1 rue de l'Exemple, 75001 Paris", registration: "" })).toBe(false);
    expect(ok({ name: "Exemple SAS", address: "Paris", registration: "" })).toBe(false);
    expect(ok({ name: "Exemple SAS", address: "75001 Paris", registration: "" })).toBe(false);
    expect(ok({ name: "Exemple SAS", address: "1 rue de l'Exemple, 75001 Paris", registration: "SIRET 1234" })).toBe(false);
  });

  it("flags a missing legal mention or an unsubscribe link", () => {
    const origin = "https://dourya.fr";
    const actionUrl = fictitiousActionUrl(origin, "verify");
    const html = `<meta name="viewport"><img src="${origin}/brand/logo-full.png"><a href="${actionUrl.replace(/&/g, "&amp;")}">ok</a>`;
    expect(checkRendered({ html, text: actionUrl, actionUrl, origin }).every((c) => c.ok)).toBe(true);
    const bad = checkRendered({ html: `${html}[À configurer : EMAIL_LEGAL_NAME] Se désinscrire`, text: "", actionUrl, origin });
    expect(bad.filter((c) => !c.ok).map((c) => c.label)).toEqual([
      "lien d'action dans la version texte",
      "aucune mention à configurer",
      "pas de lien de désinscription (e-mail de sécurité)",
    ]);
  });
});
