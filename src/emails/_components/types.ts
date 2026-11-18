import type { EmailLegal } from "@/lib/email/config";

/** Props every DOURYA e-mail receives from the sender. */
export type BaseEmailProps = {
  /** Site origin used for the logo and links (https://dourya.fr in production). */
  origin: string;
  legal: EmailLegal;
  /** Short text shown after the subject in the inbox list. */
  preheader: string;
  /** Marketing e-mails only. Never set on transactional or security e-mails. */
  unsubscribeUrl?: string;
};

export type ActionEmailProps = BaseEmailProps & {
  /** One-time link to /auth/action. Never logged. */
  actionUrl: string;
};

/** Shown instead of a missing legal value (test transport only: real sending refuses a missing value). */
export function orMissing(value: string, variable: string): string {
  return value || `[À configurer : ${variable}]`;
}

export const previewLegal: EmailLegal = {
  name: "[Raison sociale]",
  address: "[Adresse postale]",
  registration: "[Immatriculation]",
};
