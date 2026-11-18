/**
 * Pure helpers of the e-mail send test (scripts/email-send-test.mjs).
 * They never print a value of the environment: only variable names and statuses.
 */
export type TestTemplate = "verify" | "reset";

export type TestArgs = {
  send: boolean;
  to: string | null;
  only: TestTemplate[];
  errors: string[];
};

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function parseTestArgs(argv: string[]): TestArgs {
  const errors: string[] = [];
  let send = false;
  let to: string | null = null;
  let only: TestTemplate[] = ["verify", "reset"];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--send") send = true;
    else if (arg === "--to") to = (argv[++i] ?? "").trim() || null;
    else if (arg === "--only") {
      const value = argv[++i];
      if (value === "verify" || value === "reset") only = [value];
      else errors.push("--only attend verify ou reset");
    } else errors.push(`option inconnue : ${arg}`);
  }
  if (to !== null && !ADDRESS.test(to)) errors.push("--to n'est pas une adresse e-mail valide");
  if (send && !to) errors.push("--send demande --to <adresse>");
  if (!send && to) errors.push("--to sans --send : ajoutez --send pour un envoi réel");
  return { send, to, only, errors };
}

/** "christian@example.fr" -> "c•••@example.fr": enough to recognise it, not to copy it. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${address[0]}•••${address.slice(at)}`;
}

/** Domain of "Name <a@b.c>" or "a@b.c" (public information, safe to print). */
export function senderDomain(mailbox: string): string | null {
  const match = /@([^\s@<>]+)>?$/.exec(mailbox.trim());
  return match ? match[1].toLowerCase() : null;
}

/** Fictitious one-time link: it opens the "link no longer valid" page, never a real action. */
export function fictitiousActionUrl(origin: string, template: TestTemplate): string {
  const mode = template === "verify" ? "verifyEmail" : "resetPassword";
  return `${origin}/auth/action?mode=${mode}&oobCode=LIEN-DE-TEST-FICTIF`;
}

export type RenderCheck = { label: string; ok: boolean };

/** Checks of a rendered security e-mail, before any real send. */
export function checkRendered(input: { html: string; text: string; actionUrl: string; origin: string }): RenderCheck[] {
  const { html, text, actionUrl, origin } = input;
  const escapedUrl = actionUrl.replace(/&/g, "&amp;");
  return [
    { label: "lien d'action dans le HTML", ok: html.includes(escapedUrl) || html.includes(actionUrl) },
    { label: "lien d'action dans la version texte", ok: text.includes(actionUrl) },
    { label: "logo officiel", ok: html.includes(`${origin}/brand/logo-full.png`) },
    { label: "viewport mobile", ok: html.includes('name="viewport"') },
    { label: "aucune mention à configurer", ok: !html.includes("[À configurer") && !text.includes("[À configurer") },
    { label: "pas de lien de désinscription (e-mail de sécurité)", ok: !/se d[ée]sinscrire/i.test(html) && !/desinscription/i.test(text) },
  ];
}

/**
 * Completeness of the legal mentions shown in every e-mail footer (LCEN art. 6 III / 19):
 * a name, a postal address with a French postal code and a city, an optional
 * SIREN (9 digits) or SIRET (14 digits) registration line.
 */
export function checkLegal(legal: { name: string; address: string; registration: string }): RenderCheck[] {
  const address = legal.address.trim();
  const postal = /\b\d{5}\b/.exec(address);
  const city = postal ? address.slice(postal.index + 5).replace(/[^\p{L}]/gu, "") : "";
  // "SIRET 123 456 789 00012", "RCS Paris 123 456 789"...: one 9- or 14-digit number once spaces are removed.
  const numbers = legal.registration.replace(/(\d)\s+(?=\d)/g, "$1").match(/\d+/g) ?? [];
  const checks: RenderCheck[] = [
    { label: "raison sociale ou nom renseigné", ok: legal.name.trim().length >= 2 },
    { label: "adresse avec voie, code postal et ville", ok: address.length >= 10 && Boolean(postal) && city.length >= 2 && /\p{L}/u.test(address.slice(0, postal?.index ?? 0)) },
  ];
  if (legal.registration.trim()) checks.push({ label: "immatriculation au format SIREN ou SIRET", ok: numbers.some((n) => n.length === 9 || n.length === 14) });
  return checks;
}

/** Origins that a mailbox cannot reach: the logo and the links would not load. */
export function isLocalOrigin(origin: string): boolean {
  const host = new URL(origin).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost") || host.endsWith(".test");
}
