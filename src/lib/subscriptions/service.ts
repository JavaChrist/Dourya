import "server-only";
import { createHash } from "node:crypto";
import { mailClubConfig } from "@/config/commerce";
import { checkoutGate, type GateReason } from "@/lib/checkout/build";
import { errorCategory, errorCode, logEvent } from "@/lib/log";
import type { StripeAccess } from "@/lib/payments/stripe";
import { StripeError } from "@/lib/payments/stripe-client";
import { notifyMailClub } from "@/lib/notifications/service";
import { LIVE_STATUSES, type SubscriptionClient } from "@/lib/payments/stripe-subscriptions";
import type { StripeEventRef } from "@/lib/payments/stripe-webhook";
import { getUserSubscription, recordDelivery, saveSubscription } from "./repository";
import type { MailClubSwitch } from "./switch";

/**
 * Mail Club subscription flows: start (Stripe Checkout, mode subscription),
 * return page, cancellation at the end of the paid period, webhook. Every
 * state comes from Stripe, re-read with the secret key: never from the
 * browser or from the event body.
 */

function logStripe(event: string, error: unknown) {
  if (error instanceof StripeError)
    logEvent(event, { category: error.category, status: error.status ?? undefined, stripeType: error.detail?.type, stripeCode: error.detail?.code, stripeParam: error.detail?.param });
  else logEvent(event, { error: errorCode(error), category: errorCategory(error) });
}

/**
 * Why the Mail Club cannot be sold to this visitor, or null. `sw` comes from
 * mailClubSwitch (server side, with the signed-in uid). A TEST opening needs a
 * test key; a live key is still refused by the checkout gate (allowLive).
 */
export function mailClubGate(stripe: StripeAccess | null, sw: MailClubSwitch): GateReason | null {
  if (sw.test && stripe?.mode !== "test") return "checkout_closed";
  const reason = checkoutGate({ keyMode: stripe?.mode ?? null, hasDemo: false, checkoutEnabled: sw.checkoutEnabled });
  if (reason) return reason;
  return stripe?.subscriptions ? null : "payment_not_configured";
}

export type StartResult = { kind: "redirect"; url: string } | { kind: "closed"; reason: GateReason } | { kind: "already" } | { kind: "terms" } | { kind: "error" };

/** Same customer, same half hour: same Stripe page (double click, back button). */
const startKey = (uid: string, now: Date) => `mailclub_${createHash("sha256").update(uid).digest("hex").slice(0, 32)}_${Math.floor(now.getTime() / (30 * 60_000))}`;

export async function startMailClub(input: {
  user: { uid: string; email: string };
  acceptTerms: boolean;
  stripe: StripeAccess | null;
  sw: MailClubSwitch;
  origin: string;
  now: Date;
}): Promise<StartResult> {
  const reason = mailClubGate(input.stripe, input.sw);
  if (reason) return { kind: "closed", reason };
  if (!input.acceptTerms) return { kind: "terms" };
  const current = await getUserSubscription(input.user.uid);
  if (current && LIVE_STATUSES.includes(current.status)) return { kind: "already" };
  try {
    const session = await input.stripe!.subscriptions!.createSubscriptionCheckout({
      uid: input.user.uid,
      email: input.user.email,
      productName: mailClubConfig.productName,
      priceCents: mailClubConfig.priceCents,
      shippingCountries: mailClubConfig.shippingCountries,
      successUrl: `${input.origin}/mon-compte/abonnement?session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${input.origin}/infos/mail-club`,
      idempotencyKey: startKey(input.user.uid, input.now),
    });
    logEvent("mail_club_checkout_created");
    return { kind: "redirect", url: session.url };
  } catch (error) {
    logStripe("mail_club_checkout_failed", error);
    return { kind: "error" };
  }
}

/**
 * Return page: saves the new subscription at once, without waiting for the
 * webhook. Only a session started for this same customer is accepted.
 */
export async function confirmMailClubReturn(uid: string, sessionId: string, stripe: StripeAccess | null, now: Date): Promise<void> {
  const subs = stripe?.subscriptions;
  if (!subs) return;
  try {
    const session = await subs.getSubscriptionCheckout(sessionId);
    if (session.uid !== uid || !session.complete || !session.subscriptionId) return;
    const view = await subs.getSubscription(session.subscriptionId);
    if (view.uid === uid && (await saveSubscription(view, now))) await notifyMailClub(view, now);
  } catch (error) {
    // The webhook will save it anyway.
    logStripe("mail_club_return_failed", error);
  }
}

export type CancelResult = "ok" | "none" | "already" | "error";

/** Cancellation by the customer: no further payment, the period already paid is still sent. */
export async function cancelMailClub(uid: string, stripe: StripeAccess | null, now: Date): Promise<CancelResult> {
  const subs = stripe?.subscriptions;
  if (!subs) return "error";
  const current = await getUserSubscription(uid);
  if (!current || !LIVE_STATUSES.includes(current.status)) return "none";
  if (current.cancelAtPeriodEnd) return "already";
  try {
    const view = await subs.cancelAtPeriodEnd(current.id, `mailclub_cancel_${current.id}`);
    if (view.uid !== uid) return "error";
    await saveSubscription(view, now);
    logEvent("mail_club_cancelled");
    await notifyMailClub(view, now);
    return "ok";
  } catch (error) {
    logStripe("mail_club_cancel_failed", error);
    return "error";
  }
}

/**
 * Subscription and invoice events. The object is re-read at Stripe; a
 * subscription without the uid set by this server is ignored. A paid invoice
 * adds one pack to send (once per invoice, whatever the number of events).
 * The event, the invoice and the subscription must share one mode: a TEST
 * event only ever writes TEST data (and saveSubscription never changes the
 * mode of a stored subscription).
 * Returns the HTTP status for Stripe (500 makes it retry).
 */
export async function handleSubscriptionEvent(event: Extract<StripeEventRef, { kind: "subscription" | "invoice" }>, subs: SubscriptionClient, now: Date): Promise<number> {
  try {
    let subscriptionId: string;
    let invoice = null;
    if (event.kind === "invoice") {
      invoice = await subs.getInvoice(event.invoiceId);
      if (invoice.livemode !== event.livemode) {
        logEvent("stripe_webhook_ignored", { reason: "mode_mismatch" });
        return 200;
      }
      if (!invoice.subscriptionId) {
        logEvent("stripe_webhook_ignored", { reason: "no_subscription" });
        return 200;
      }
      subscriptionId = invoice.subscriptionId;
    } else subscriptionId = event.subscriptionId;

    const view = await subs.getSubscription(subscriptionId);
    if (view.livemode !== event.livemode) {
      logEvent("stripe_webhook_ignored", { reason: "mode_mismatch" });
      return 200;
    }
    if (!view.uid || !(await saveSubscription(view, now))) {
      logEvent("stripe_webhook_ignored", { reason: "not_mail_club" });
      return 200;
    }
    const delivery = invoice && event.type === "invoice.paid" && invoice.paid ? await recordDelivery(invoice, view, now) : undefined;
    await notifyMailClub(view, now);
    logEvent("stripe_webhook_subscription", { type: event.type, status: view.status, test: !view.livemode, ...(delivery ? { delivery } : {}) });
    return 200;
  } catch (error) {
    logStripe("stripe_webhook_subscription_failed", error);
    if (error instanceof StripeError && error.category === "not_found") return 200;
    return 500;
  }
}
