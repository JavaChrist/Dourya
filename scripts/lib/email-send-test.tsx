/**
 * Send test of the DOURYA security e-mails (verification, reset). Run with
 * `npm run email:test` (see scripts/email-send-test.mjs).
 *
 * - Default (dry run): checks the "resend" configuration (variable names and
 *   statuses only, never a value), renders both e-mails with a fictitious link
 *   and checks them. Nothing is sent.
 * - `--send --to <address>`: sends the rendered e-mails for real through Resend,
 *   after a typed confirmation. The link stays fictitious (no Firebase code is
 *   created): it opens the "link no longer valid" page.
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { PRODUCTION_SITE_URL, parseSiteUrl } from "@/config/site";
import { readEmailConfig } from "@/lib/email/config";
import { renderEmail, type EmailType } from "@/lib/email/registry";
import { ResendTransport } from "@/lib/email/transport";
import { checkRendered, fictitiousActionUrl, isLocalOrigin, maskAddress, parseTestArgs, senderDomain, type TestTemplate } from "./email-test";

const TYPES: Record<TestTemplate, EmailType> = { verify: "auth-verify-email", reset: "auth-reset-password" };
const status = (ok: boolean) => (ok ? "OK" : "ERREUR");

function present(name: string): boolean {
  const value = (process.env[name] ?? "").trim();
  return value !== "" && !value.includes("REPLACE_ME");
}

export async function main(argv: string[]): Promise<number> {
  const args = parseTestArgs(argv);
  if (args.errors.length) {
    for (const e of args.errors) console.error(`Argument : ${e}`);
    console.error("Usage : npm run email:test [-- --only verify|reset] [-- --send --to <adresse>]");
    return 2;
  }

  const onEmulators = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
  // Checked as if EMAIL_TRANSPORT were "resend", whatever its current value.
  const config = readEmailConfig({ ...process.env, EMAIL_TRANSPORT: "resend", FIREBASE_AUTH_EMULATOR_HOST: "", FIRESTORE_EMULATOR_HOST: "" });
  const origin = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? PRODUCTION_SITE_URL;

  console.log("Configuration (noms et statuts uniquement)");
  for (const name of ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO", "EMAIL_LEGAL_NAME", "EMAIL_LEGAL_ADDRESS"]) {
    console.log(`  ${name.padEnd(26)} ${config.missing.includes(name) ? "MANQUANT ou invalide" : "OK"}`);
  }
  console.log(`  ${"EMAIL_LEGAL_REGISTRATION".padEnd(26)} ${present("EMAIL_LEGAL_REGISTRATION") ? "OK" : "absent (facultatif)"}`);
  console.log(`  ${"RESEND_WEBHOOK_SECRET".padEnd(26)} ${present("RESEND_WEBHOOK_SECRET") ? "OK" : "absent (webhook en 503)"}`);
  console.log(`  ${"EMAIL_UNSUBSCRIBE_SECRET".padEnd(26)} ${(process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "").length >= 32 ? "OK" : "absent (marketing seulement)"}`);
  console.log(`  ${"EMAIL_TRANSPORT".padEnd(26)} actuel : ${(process.env.EMAIL_TRANSPORT ?? "").trim() || "firebase (défaut)"}`);
  console.log(`  Domaine d'envoi : ${senderDomain(config.from) ?? "inconnu"} · réponse : ${senderDomain(config.replyTo) ?? "inconnu"} · site : ${new URL(origin).host}`);
  if (isLocalOrigin(origin)) console.log("  Attention : le site est local, le logo et les liens ne s'afficheront pas dans une vraie boîte mail.");

  let renderOk = true;
  const rendered: { template: TestTemplate; type: EmailType; subject: string; html: string; text: string }[] = [];
  for (const template of args.only) {
    const type = TYPES[template];
    const actionUrl = fictitiousActionUrl(origin, template);
    const email = await renderEmail(type, { actionUrl }, { origin, legal: config.legal });
    const checks = checkRendered({ html: email.html, text: email.text, actionUrl, origin });
    console.log(`\n${type} : « ${email.subject} » · HTML ${(email.html.length / 1024).toFixed(1)} Ko · texte ${email.text.length} car.`);
    for (const c of checks) console.log(`  ${status(c.ok).padEnd(7)} ${c.label}`);
    renderOk &&= checks.every((c) => c.ok);
    rendered.push({ template, type, subject: email.subject, html: email.html, text: email.text });
  }

  const configOk = config.missing.length === 0;
  console.log(`\nConfiguration resend : ${status(configOk)} · Rendu : ${status(renderOk)}`);

  if (!args.send) {
    console.log("Mode simulation : aucun e-mail envoyé. Pour un envoi réel après validation : npm run email:test -- --send --to <adresse>");
    return configOk && renderOk ? 0 : 1;
  }

  if (onEmulators) return refuse("envoi réel interdit sur les émulateurs Firebase");
  if (!configOk) return refuse(`configuration incomplète (${config.missing.join(", ")})`);
  if (!renderOk) return refuse("le rendu contient une erreur");
  if (!process.stdin.isTTY) return refuse("confirmation interactive requise (terminal)");

  const to = args.to as string;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\nEnvoyer ${rendered.length} e-mail(s) de test à ${maskAddress(to)} via Resend ? Tapez « oui » : `)).trim().toLowerCase();
  rl.close();
  if (answer !== "oui") return refuse("non confirmé");

  const transport = new ResendTransport((process.env.RESEND_API_KEY ?? "").trim());
  let allSent = true;
  for (const email of rendered) {
    const result = await transport.send({
      from: config.from,
      to,
      replyTo: config.replyTo,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
      tags: [
        { name: "type", value: email.type },
        { name: "category", value: "security" },
        { name: "test", value: "true" },
      ],
      idempotencyKey: `send-test/${email.template}/${randomUUID()}`,
    });
    // The Resend id is not a secret: it finds the e-mail in the Resend dashboard (Emails).
    console.log(result.ok ? `  envoyé   ${email.type} · id Resend ${result.id}` : `  ERREUR   ${email.type} · ${result.error}`);
    allSent &&= result.ok;
  }
  return allSent ? 0 : 1;
}

function refuse(reason: string): number {
  console.error(`Envoi réel refusé : ${reason}. Aucun e-mail envoyé.`);
  return 1;
}
