import type { ReactElement } from "react";
import { render } from "@react-email/components";
import ResetPassword, { resetPasswordDefaults, resetPasswordText } from "@/emails/ResetPassword";
import VerifyEmail, { verifyEmailDefaults, verifyEmailText } from "@/emails/VerifyEmail";
import WithdrawalReceived, { withdrawalReceivedDefaults, withdrawalReceivedText, type WithdrawalEmailProps } from "@/emails/WithdrawalReceived";
import OrderConfirmed, { orderConfirmedDefaults, orderConfirmedText, type OrderConfirmedProps } from "@/emails/OrderConfirmed";
import OrderShipped, { orderShippedDefaults, orderShippedText, type OrderShippedProps } from "@/emails/OrderShipped";
import OrderRefunded, { orderRefundedDefaults, orderRefundedText, type OrderRefundedProps } from "@/emails/OrderRefunded";
import MailClubStarted, { mailClubStartedDefaults, mailClubStartedText, type MailClubStartedProps } from "@/emails/MailClubStarted";
import MailClubCancelled, { mailClubCancelledDefaults, mailClubCancelledText, type MailClubCancelledProps } from "@/emails/MailClubCancelled";
import type { ActionEmailProps, BaseEmailProps } from "@/emails/_components/types";

/**
 * Typed list of the DOURYA e-mails.
 * - security / transactional: always sent (never blocked by a marketing unsubscribe).
 * - marketing: needs consent, honours suppressions, carries the unsubscribe headers.
 * Template 8 (newsletter) arrives with its own lot.
 */
export type EmailCategory = "security" | "transactional" | "marketing";

type Definition<P extends BaseEmailProps> = {
  category: EmailCategory;
  defaults: { subject: string; preheader: string };
  html: (props: P) => ReactElement;
  text: (props: P) => string;
};

export const EMAIL_TEMPLATES = {
  "auth-verify-email": {
    category: "security",
    defaults: verifyEmailDefaults,
    html: (p: ActionEmailProps) => <VerifyEmail {...p} />,
    text: verifyEmailText,
  },
  "auth-reset-password": {
    category: "security",
    defaults: resetPasswordDefaults,
    html: (p: ActionEmailProps) => <ResetPassword {...p} />,
    text: resetPasswordText,
  },
  "withdrawal-received": {
    category: "transactional",
    defaults: withdrawalReceivedDefaults,
    html: (p: WithdrawalEmailProps) => <WithdrawalReceived {...p} />,
    text: withdrawalReceivedText,
  },
  "order-confirmed": {
    category: "transactional",
    defaults: orderConfirmedDefaults,
    html: (p: OrderConfirmedProps) => <OrderConfirmed {...p} />,
    text: orderConfirmedText,
  },
  "order-shipped": {
    category: "transactional",
    defaults: orderShippedDefaults,
    html: (p: OrderShippedProps) => <OrderShipped {...p} />,
    text: orderShippedText,
  },
  "order-refunded": {
    category: "transactional",
    defaults: orderRefundedDefaults,
    html: (p: OrderRefundedProps) => <OrderRefunded {...p} />,
    text: orderRefundedText,
  },
  "mail-club-started": {
    category: "transactional",
    defaults: mailClubStartedDefaults,
    html: (p: MailClubStartedProps) => <MailClubStarted {...p} />,
    text: mailClubStartedText,
  },
  "mail-club-cancelled": {
    category: "transactional",
    defaults: mailClubCancelledDefaults,
    html: (p: MailClubCancelledProps) => <MailClubCancelled {...p} />,
    text: mailClubCancelledText,
  },
} satisfies Record<
  string,
  | Definition<ActionEmailProps>
  | Definition<WithdrawalEmailProps>
  | Definition<OrderConfirmedProps>
  | Definition<OrderShippedProps>
  | Definition<OrderRefundedProps>
  | Definition<MailClubStartedProps>
  | Definition<MailClubCancelledProps>
>;

export type EmailType = keyof typeof EMAIL_TEMPLATES;

/** Data a caller passes for a given e-mail (the base props are filled by the sender). */
export type EmailData<T extends EmailType> = Omit<Parameters<(typeof EMAIL_TEMPLATES)[T]["html"]>[0], keyof BaseEmailProps>;

/**
 * Admin-editable texts (prepared for a later lot): only the subject and the
 * preheader can be overridden from `emailTemplates/{type}`; the layout, the links
 * and the legal footer always stay in code.
 */
export type TemplateOverride = { subject?: string; preheader?: string };

const SAFE_TEXT = /^[^\u0000-\u001f\u007f<>]+$/;

export function sanitizeOverride(raw: unknown): TemplateOverride {
  if (!raw || typeof raw !== "object") return {};
  const data = raw as Record<string, unknown>;
  const out: TemplateOverride = {};
  if (typeof data.subject === "string" && data.subject.trim().length >= 3 && data.subject.length <= 120 && SAFE_TEXT.test(data.subject)) {
    out.subject = data.subject.trim();
  }
  if (typeof data.preheader === "string" && data.preheader.length <= 150 && SAFE_TEXT.test(data.preheader)) {
    out.preheader = data.preheader.trim();
  }
  return out;
}

export type RenderedEmail = { category: EmailCategory; subject: string; html: string; text: string };

export async function renderEmail<T extends EmailType>(
  type: T,
  data: EmailData<T>,
  base: Omit<BaseEmailProps, "preheader">,
  override: TemplateOverride = {},
): Promise<RenderedEmail> {
  const def = EMAIL_TEMPLATES[type] as Definition<BaseEmailProps & EmailData<T>>;
  const props = {
    ...data,
    ...base,
    unsubscribeUrl: def.category === "marketing" ? base.unsubscribeUrl : undefined,
    preheader: override.preheader ?? def.defaults.preheader,
  } as BaseEmailProps & EmailData<T>;
  const html = await render(def.html(props));
  return { category: def.category, subject: override.subject ?? def.defaults.subject, html, text: def.text(props) };
}
