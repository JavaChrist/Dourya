import "server-only";
import type { WithdrawalEmailProps } from "@/emails/WithdrawalReceived";
import { sendEmail } from "@/lib/email/send";
import { errorCategory, errorCode, logEvent } from "@/lib/log";
import type { StripeAccess } from "@/lib/payments/stripe";
import { StripeError } from "@/lib/payments/stripe-client";
import { LIVE_STATUSES } from "@/lib/payments/stripe-subscriptions";
import { getUserSubscription, saveSubscription } from "@/lib/subscriptions/repository";
import { WITHDRAWAL_DAYS, addDays, type Requester, type WithdrawalRecord } from "./eligibility";
import { createMailClubWithdrawal, createOrderWithdrawal, markStripeCancelled, type CreateResult } from "./repository";

/**
 * Online withdrawal: records the request (proof of the notification, server
 * date), then sends the acknowledgement to the customer with a copy to DOURYA.
 * A failed e-mail never cancels the request: it is logged (type and status
 * only, never the address) and the admin sees the request in its list.
 */

export const WITHDRAWAL_COPY_TO = "contact@dourya.fr";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

export function emailDataFor(w: WithdrawalRecord, subscriptionStopped: boolean): Omit<WithdrawalEmailProps, "origin" | "legal" | "preheader" | "unsubscribeUrl"> {
  return {
    name: w.name,
    reference: w.kind === "order" ? `commande n° ${w.ref}` : "abonnement Dopamine Mail Club",
    receivedAtLabel: dateTime.format(new Date(w.receivedAt)),
    items: w.lines.map((l) => ({ label: `${l.productName}${l.variantName ? ` (${l.variantName})` : ""} × ${l.quantity}`, personalised: l.personalised })),
    returnGoods: w.kind === "order",
    returnByLabel: dateOnly.format(new Date(addDays(w.receivedAt, WITHDRAWAL_DAYS))),
    subscriptionStopped,
  };
}

async function acknowledge(w: WithdrawalRecord, subscriptionStopped: boolean): Promise<void> {
  const data = emailDataFor(w, subscriptionStopped);
  for (const [to, who] of [
    [w.email, "customer"],
    [WITHDRAWAL_COPY_TO, "dourya"],
  ] as const) {
    try {
      const outcome = await sendEmail("withdrawal-received", to, data, who === "customer" && w.customerUid ? { uid: w.customerUid } : {});
      logEvent("withdrawal_email", { to: who, status: outcome.status, ...(outcome.status === "failed" ? { error: outcome.error } : {}) });
    } catch (error) {
      logEvent("withdrawal_email", { to: who, status: "failed", error: errorCode(error), category: errorCategory(error) });
    }
  }
}

export type SubmitResult = Exclude<CreateResult, { kind: "created" | "already" }> | { kind: "created" | "already"; withdrawal: WithdrawalRecord };

/** Order withdrawal (public form or customer area). */
export async function submitOrderWithdrawal(input: { orderId: string; who: Requester; name: string; lineIndexes: unknown[]; now: Date }): Promise<SubmitResult> {
  const result = await createOrderWithdrawal(input);
  if (result.kind === "created") {
    logEvent("withdrawal_received", { kind: "order", test: !result.withdrawal.livemode, personalised: result.withdrawal.lines.some((l) => l.personalised) });
    await acknowledge(result.withdrawal, false);
  } else logEvent("withdrawal_refused", { kind: "order", reason: result.kind });
  return result;
}

export type MailClubWithdrawalResult = "ok" | "already" | "none" | "pending" | "error";

/**
 * Mail Club withdrawal from the customer area: recorded first (the
 * notification counts even if Stripe is down), then the subscription is
 * stopped at Stripe at once. The refund is made by DOURYA in Stripe.
 * "pending": recorded, but Stripe did not answer; the admin stops it by hand.
 */
export async function withdrawMailClub(user: { uid: string; name: string; email: string }, stripe: StripeAccess | null, now: Date): Promise<MailClubWithdrawalResult> {
  const sub = await getUserSubscription(user.uid);
  if (!sub || !LIVE_STATUSES.includes(sub.status)) return "none";
  let w: WithdrawalRecord;
  let isNew: boolean;
  try {
    const created = await createMailClubWithdrawal({
      subscriptionId: sub.id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      subscriptionCreatedAt: sub.createdAt,
      livemode: !sub.test,
      now,
    });
    if (created.kind === "already" && created.withdrawal.stripeCancelled) return "already";
    w = created.withdrawal;
    isNew = created.kind === "created";
    if (isNew) logEvent("withdrawal_received", { kind: "mail_club", test: sub.test });
  } catch (error) {
    logEvent("withdrawal_failed", { kind: "mail_club", error: errorCode(error), category: errorCategory(error) });
    return "error";
  }

  let stopped = false;
  try {
    const subs = stripe?.subscriptions;
    if (!subs) throw new StripeError("invalid_request", null);
    const view = await subs.cancelNow(sub.id);
    if (view.uid !== user.uid) throw new StripeError("bad_response", null);
    await saveSubscription(view, now);
    await markStripeCancelled(w.id);
    stopped = true;
    logEvent("mail_club_withdrawal_cancelled", { test: sub.test });
  } catch (error) {
    if (error instanceof StripeError) logEvent("mail_club_withdrawal_cancel_failed", { category: error.category, status: error.status ?? undefined, stripeCode: error.detail?.code });
    else logEvent("mail_club_withdrawal_cancel_failed", { error: errorCode(error), category: errorCategory(error) });
  }
  // One acknowledgement per request: a retry after a Stripe failure only stops the subscription.
  if (isNew) await acknowledge(w, stopped);
  return stopped ? "ok" : "pending";
}
