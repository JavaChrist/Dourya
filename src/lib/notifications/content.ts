import type { EmailData } from "@/lib/email/registry";
import { formatPrice } from "@/lib/format";
import type { OrderRecord } from "@/lib/orders/types";
import type { SubscriptionView } from "@/lib/payments/stripe-subscriptions";

/**
 * Data of the order and Mail Club e-mails, built from the stored order or the
 * subscription re-read at Stripe. Pure functions (no Firestore, no send), so
 * they are unit tested.
 */

const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
const regions = new Intl.DisplayNames(["fr"], { type: "region" });

export function formatDay(date: Date | string | number): string {
  return dateOnly.format(new Date(date));
}

export function countryLabel(code: string): string {
  try {
    return regions.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function addressLines(a: { name: string; line1: string; line2?: string; postalCode: string; city: string; country: string }): string[] {
  return [a.name, a.line1, ...(a.line2 ? [a.line2] : []), `${a.postalCode} ${a.city}`, countryLabel(a.country)];
}

const lineLabel = (l: OrderRecord["lines"][number]) =>
  `${l.productName}${l.variantName ? ` (${l.variantName})` : ""}${l.personalisation ? " (personnalisé)" : ""}`;

const orderUrl = (order: OrderRecord, origin: string) => (order.customerUid ? `${origin}/mon-compte/commandes/${encodeURIComponent(order.id)}` : null);

const firstName = (order: OrderRecord) => order.shippingAddress.fullName.trim() || "à vous";

export function orderConfirmedData(order: OrderRecord, origin: string): EmailData<"order-confirmed"> {
  return {
    name: firstName(order),
    orderId: order.id,
    orderDateLabel: formatDay(order.createdAt),
    lines: order.lines.map((l) => ({ label: lineLabel(l), quantity: l.quantity, totalLabel: formatPrice(l.lineTotalCents) })),
    subtotalLabel: formatPrice(order.subtotalCents),
    shippingLabel: order.shipping.label,
    shippingPriceLabel: order.shippingCents === 0 ? "offerte" : formatPrice(order.shippingCents),
    totalLabel: formatPrice(order.totalCents),
    address: addressLines({ ...order.shippingAddress, name: order.shippingAddress.fullName }),
    madeToOrder: order.lines.some((l) => l.stockMode === "made_to_order"),
    orderUrl: orderUrl(order, origin),
  };
}

export function orderShippedData(order: OrderRecord, origin: string): EmailData<"order-shipped"> {
  const url = order.tracking?.url;
  return {
    name: firstName(order),
    orderId: order.id,
    lines: order.lines.map((l) => ({ label: lineLabel(l), quantity: l.quantity })),
    address: addressLines({ ...order.shippingAddress, name: order.shippingAddress.fullName }),
    carrier: order.tracking?.carrier || null,
    trackingNumber: order.tracking?.number || null,
    // Only an https link is put in a button.
    trackingUrl: url && /^https:\/\//.test(url) ? url : null,
    orderUrl: orderUrl(order, origin),
  };
}

export function orderRefundedData(order: OrderRecord, amountCents: number): EmailData<"order-refunded"> {
  return {
    name: firstName(order),
    orderId: order.id,
    amountLabel: formatPrice(amountCents),
    totalRefundedLabel: formatPrice(order.refundedCents),
    full: order.refundedCents >= order.totalCents,
  };
}

export function mailClubStartedData(view: SubscriptionView, origin: string): EmailData<"mail-club-started"> {
  return {
    priceLabel: formatPrice(view.priceCents),
    nextChargeLabel: view.currentPeriodEnd ? formatDay(view.currentPeriodEnd * 1000) : null,
    address: view.shipping ? addressLines(view.shipping) : [],
    manageUrl: `${origin}/mon-compte/abonnement`,
  };
}

export function mailClubCancelledData(view: SubscriptionView, origin: string, now: Date): EmailData<"mail-club-cancelled"> {
  return {
    requestedAtLabel: formatDay(now),
    endLabel: view.currentPeriodEnd ? formatDay(view.currentPeriodEnd * 1000) : null,
    manageUrl: `${origin}/mon-compte/abonnement`,
  };
}
