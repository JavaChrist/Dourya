import type { ShippingAddress } from "@/lib/commerce-types";
import type { PersonalisationSnapshot } from "@/lib/cart/types";
import type { StockMode } from "@/lib/types";
import type { EnvelopeType, ShippingService } from "@/lib/shipping/types";

/**
 * Lot 4 order model (Mollie). Payment and fulfilment are two separate
 * state machines: a paid order can be "to produce", and a refunded one can
 * still be "returned".
 */

/** Payment side. Only the server changes it, from a payment re-read at Mollie. */
export type PaymentStatus =
  /** Built from the cart, no payment created yet. */
  | "draft"
  /** Payment created at Mollie, the customer has not finished (open / pending / authorized). */
  | "awaiting_payment"
  | "paid"
  | "cancelled"
  | "expired"
  | "failed"
  | "partially_refunded"
  | "refunded";

/** Fulfilment side. null until the order is paid. */
export type FulfilmentStatus =
  | "to_produce"
  | "preparing"
  | "ready"
  | "shipped"
  /** Only with reliable proof (carrier tracking) or an explicit manual confirmation. */
  | "delivered"
  | "returned";

/** Who caused a change: every event of the journal says it. */
export type EventSource = "checkout" | "mollie_webhook" | "return_page" | "admin" | "system";

/** Snapshot taken at checkout: later catalogue changes never alter a placed order. */
export type OrderLineSnapshot = {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  stockMode: StockMode;
  personalisation?: PersonalisationSnapshot;
};

export type ShippingChoice = {
  rateId: string;
  label: string;
  zone: string;
  envelope: EnvelopeType;
  service: ShippingService;
  priceCents: number;
};

export type TrackingInfo = {
  carrier: string;
  number: string;
  url?: string;
};

export type DeliveryProof =
  | { kind: "tracking" }
  | { kind: "manual_confirmation"; adminUid: string };

/** Units held for one stock counter (a stocked variant or a personalisation quota). */
export type StockHold = {
  /** inventory document id, e.g. "prod-1__v-a4" or "prod-1__personalisation". */
  key: string;
  quantity: number;
};

/** held = reserved while the payment is awaited; committed = sold; released = given back. */
export type StockState = "held" | "committed" | "released";

export type OrderRecord = {
  id: string;
  /** null = guest checkout. */
  customerUid: string | null;
  email: string;
  lines: OrderLineSnapshot[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: "EUR";
  shipping: ShippingChoice;
  shippingAddress: ShippingAddress;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus | null;
  molliePaymentId?: string;
  refundedCents: number;
  tracking?: TrackingInfo;
  stockHolds: StockHold[];
  stockState: StockState;
  /** Stock is held at least until this date while the payment is awaited. */
  reservationExpiresAt?: string;
  /** Set when an event needs a human check (late payment, amount mismatch...). */
  needsReview?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderEvent = {
  type: "created" | "payment_status" | "fulfilment_status" | "refund" | "tracking" | "anomaly";
  source: EventSource;
  from?: string | null;
  to?: string | null;
  /** Mollie payment or refund id, when the event comes from Mollie. */
  mollieId?: string;
  amountCents?: number;
  actorUid?: string;
  /** Short known code, never a raw provider message. */
  code?: string;
  at: string;
};
