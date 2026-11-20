import "server-only";
import { siteOrigin } from "@/config/site";
import { adminAuth } from "@/lib/firebase/admin-auth";
import { adminDb } from "@/lib/firebase/admin-db";
import type { EmailType } from "@/lib/email/registry";
import { sendEmail, type SendOutcome } from "@/lib/email/send";
import { errorCategory, errorCode, logEvent } from "@/lib/log";
import { getOrder } from "@/lib/orders/repository";
import type { OrderRecord, PaymentStatus } from "@/lib/orders/types";
import { LIVE_STATUSES, type SubscriptionView } from "@/lib/payments/stripe-subscriptions";
import { mailClubCancelledData, mailClubStartedData, orderConfirmedData, orderRefundedData, orderShippedData } from "./content";

/**
 * Order and Mail Club e-mails (templates 3 to 7), sent from the state stored
 * after a change re-read at Stripe (or made in the admin), never from what a
 * browser says. Each e-mail is claimed first in
 *   emailNotifications/{key}   server only (see firestore.rules)
 * so a repeated webhook, a return page and a webhook arriving together, or a
 * retry by Stripe never send it twice. A failed send can be retried by the
 * next event; a send left "pending" (crash) is retried after 10 minutes.
 * A failed e-mail never fails the caller: it is logged (type and status only,
 * never the address) and the admin sees the status on the order.
 */

const COLLECTION = "emailNotifications";
const STALE_PENDING_MS = 10 * 60_000;
/** An old subscription seen again (monthly invoice) never gets a welcome e-mail. */
const STARTED_MAX_AGE_S = 7 * 24 * 3600;

export type NotificationStatus = "pending" | "sent" | "failed" | "disabled";
export type NotificationRecord = { type: EmailType; ref: string; status: NotificationStatus; updatedAt: string; notifiedCents?: number };

const CONFIRMED_PAYMENT: readonly PaymentStatus[] = ["paid", "partially_refunded", "refunded"];

const col = () => adminDb().collection(COLLECTION);

type Claim = { previousCents: number } | null;

/**
 * Takes the right to send one e-mail. With `cents` (refunds), the e-mail is
 * due while more has been refunded than already notified.
 */
async function claim(key: string, type: EmailType, ref: string, now: Date, cents?: number): Promise<Claim> {
  const doc = col().doc(key);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(doc);
    const data = snap.exists ? (snap.data() as NotificationRecord & { pendingAt?: string }) : null;
    const previousCents = data?.notifiedCents ?? 0;
    if (data) {
      if (data.status === "disabled") return null;
      if (cents === undefined && data.status === "sent") return null;
      if (cents !== undefined && cents <= previousCents) return null;
      if (data.status === "pending" && now.getTime() - Date.parse(data.pendingAt ?? data.updatedAt) < STALE_PENDING_MS) return null;
    }
    tx.set(doc, { type, ref, status: "pending", notifiedCents: previousCents, pendingAt: now.toISOString(), updatedAt: now.toISOString() }, { merge: true });
    return { previousCents };
  });
}

async function finish(key: string, outcome: SendOutcome, now: Date, cents?: number): Promise<void> {
  const status: NotificationStatus = outcome.status === "sent" ? "sent" : outcome.status === "disabled" ? "disabled" : "failed";
  await col()
    .doc(key)
    .set({ status, updatedAt: now.toISOString(), ...(status === "sent" && cents !== undefined ? { notifiedCents: cents } : {}) }, { merge: true });
}

async function once(
  key: string,
  type: EmailType,
  ref: string,
  now: Date,
  send: (claimed: { previousCents: number }) => Promise<SendOutcome>,
  cents?: number,
): Promise<void> {
  const claimed = await claim(key, type, ref, now, cents);
  if (!claimed) return;
  let outcome: SendOutcome;
  try {
    outcome = await send(claimed);
  } catch (error) {
    logEvent("notification_send_failed", { type, error: errorCode(error), category: errorCategory(error) });
    outcome = { status: "failed", error: "unavailable" };
  }
  await finish(key, outcome, now, cents);
  logEvent("notification_email", { type, status: outcome.status });
}

/** Sends the e-mails due for an order's current state. Never throws. */
export async function notifyOrder(orderId: string, now = new Date()): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order || !order.email) return;
    await notifyOrderRecord(order, now);
  } catch (error) {
    logEvent("notification_order_failed", { error: errorCode(error), category: errorCategory(error) });
  }
}

async function notifyOrderRecord(order: OrderRecord, now: Date): Promise<void> {
  const origin = siteOrigin();
  const uid = order.customerUid ?? undefined;
  if (CONFIRMED_PAYMENT.includes(order.paymentStatus)) {
    await once(`order_confirmed_${order.id}`, "order-confirmed", order.id, now, () =>
      sendEmail("order-confirmed", order.email, orderConfirmedData(order, origin), { uid }),
    );
  }
  if (order.fulfilmentStatus === "shipped" || order.fulfilmentStatus === "delivered") {
    await once(`order_shipped_${order.id}`, "order-shipped", order.id, now, () => sendEmail("order-shipped", order.email, orderShippedData(order, origin), { uid }));
  }
  if (order.refundedCents > 0) {
    await once(
      `order_refunded_${order.id}`,
      "order-refunded",
      order.id,
      now,
      ({ previousCents }) => sendEmail("order-refunded", order.email, orderRefundedData(order, order.refundedCents - previousCents), { uid }),
      order.refundedCents,
    );
  }
}

/**
 * Sends the Mail Club e-mails due for a subscription re-read at Stripe:
 * welcome once it is active, confirmation of a cancellation at period end
 * (CGV article 5). The withdrawal (immediate stop) has its own acknowledgement.
 * Never throws.
 */
export async function notifyMailClub(view: SubscriptionView, now = new Date()): Promise<void> {
  if (!view.uid) return;
  const started = (view.status === "active" || view.status === "trialing") && !view.cancelAtPeriodEnd;
  const recent = !view.startedAt || now.getTime() / 1000 - view.startedAt <= STARTED_MAX_AGE_S;
  const cancelled = view.cancelAtPeriodEnd && LIVE_STATUSES.includes(view.status);
  if (!(started && recent) && !cancelled) return;
  try {
    const email = (await adminAuth().getUser(view.uid)).email;
    if (!email) return;
    const origin = siteOrigin();
    if (started && recent) {
      await once(`mail_club_started_${view.id}`, "mail-club-started", view.id, now, () =>
        sendEmail("mail-club-started", email, mailClubStartedData(view, origin), { uid: view.uid ?? undefined }),
      );
    }
    if (cancelled) {
      await once(`mail_club_cancelled_${view.id}_${view.currentPeriodEnd ?? "x"}`, "mail-club-cancelled", view.id, now, () =>
        sendEmail("mail-club-cancelled", email, mailClubCancelledData(view, origin, now), { uid: view.uid ?? undefined }),
      );
    }
  } catch (error) {
    logEvent("notification_mail_club_failed", { error: errorCode(error), category: errorCategory(error) });
  }
}

/** E-mail statuses of an order, for the admin. */
export async function orderNotificationStatuses(orderId: string): Promise<Partial<Record<"confirmed" | "shipped" | "refunded", NotificationStatus>>> {
  const refs = (["confirmed", "shipped", "refunded"] as const).map((k) => col().doc(`order_${k}_${orderId}`));
  const snaps = await adminDb().getAll(...refs);
  const out: Partial<Record<"confirmed" | "shipped" | "refunded", NotificationStatus>> = {};
  snaps.forEach((s, i) => {
    if (s.exists) out[(["confirmed", "shipped", "refunded"] as const)[i]] = s.get("status") as NotificationStatus;
  });
  return out;
}
