import { isPlaceholder } from "@/lib/firebase/shared";

/**
 * E-mail configuration (server only, read from the environment).
 *
 * EMAIL_TRANSPORT chooses who sends the account e-mails:
 * - unset or "firebase" (default): the custom e-mails are off, Firebase sends its
 *   own e-mails from the browser as before. Nothing changes until it is switched.
 * - "test": e-mails are rendered and kept in memory, never sent (dev, emulators, tests).
 * - "resend": real sending through Resend. Set it only once the sending domain is
 *   verified in Resend. On the Firebase emulators it is always forced to "test".
 *
 * Sender, reply-to and legal mentions are required and never invented: with
 * "resend", nothing is sent while one of them is missing.
 */
export type EmailMode = "firebase" | "test" | "resend";

export type EmailLegal = {
  /** Legal name of the seller (EMAIL_LEGAL_NAME). */
  name: string;
  /** Postal address of the seller (EMAIL_LEGAL_ADDRESS). */
  address: string;
  /** Optional registration line, e.g. a SIRET number (EMAIL_LEGAL_REGISTRATION). */
  registration: string;
};

export type EmailConfig = {
  mode: EmailMode;
  from: string;
  replyTo: string;
  legal: EmailLegal;
  /** Names of the required variables that are missing or invalid (never their values). */
  missing: string[];
};

type Env = Record<string, string | undefined>;

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
/** "Name <address@domain>" or a bare address. */
const MAILBOX = /^(?:[^<>\r\n]{1,80} <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

function clean(value: string | undefined): string {
  const v = (value ?? "").trim();
  return isPlaceholder(v) || /[\r\n]/.test(v) ? "" : v;
}

export function emailMode(env: Env = process.env): EmailMode {
  const raw = (env.EMAIL_TRANSPORT ?? "").trim().toLowerCase();
  if (raw === "test") return "test";
  if (raw === "resend") {
    // Never send real e-mails from the emulators (fake accounts, fake links).
    if (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) return "test";
    return "resend";
  }
  return "firebase";
}

export function readEmailConfig(env: Env = process.env): EmailConfig {
  const mode = emailMode(env);
  const missing: string[] = [];
  const from = clean(env.EMAIL_FROM);
  const replyTo = clean(env.EMAIL_REPLY_TO);
  const legal: EmailLegal = {
    name: clean(env.EMAIL_LEGAL_NAME),
    address: clean(env.EMAIL_LEGAL_ADDRESS),
    registration: clean(env.EMAIL_LEGAL_REGISTRATION),
  };
  if (!MAILBOX.test(from)) missing.push("EMAIL_FROM");
  if (!ADDRESS.test(replyTo)) missing.push("EMAIL_REPLY_TO");
  if (!legal.name) missing.push("EMAIL_LEGAL_NAME");
  if (!legal.address) missing.push("EMAIL_LEGAL_ADDRESS");
  if (mode === "resend" && !clean(env.RESEND_API_KEY)) missing.push("RESEND_API_KEY");
  return { mode, from, replyTo, legal, missing };
}

/**
 * "test" always renders (missing values show as "to configure" markers, nothing is sent);
 * "resend" sends only with a complete configuration.
 */
export function canSend(config: EmailConfig): boolean {
  if (config.mode === "test") return true;
  return config.mode === "resend" && config.missing.length === 0;
}
