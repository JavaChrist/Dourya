/**
 * Shapes prepared for the next lots (no logic yet, nothing is wired).
 * Firestore collections will follow these types.
 *
 * Lot 3: auth (Firebase Auth), roles
 * Lot 4: orders, Stripe Checkout payments (card), webhooks, refunds, shipping.
 *        The Lot 4 order model lives in src/lib/orders/types.ts; `Order` below is the
 *        read model of the account pages until they move to it (Lot 4.4).
 * Lot 5: sales and audience dashboard
 * Lot 6: media library, theme, promotions
 */

export type UserRole = "customer" | "admin";

export type CustomerProfile = {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
};

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string; // ISO 3166-1 alpha-2
};

export type OrderStatus = "pending_payment" | "paid" | "preparing" | "shipped" | "delivered" | "cancelled" | "refunded";

export type OrderLine = {
  productSlug: string;
  variantId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  /** Temporary product personalisation (e.g. a name), if enabled for the product. */
  personalisation?: string;
};

export type Order = {
  id: string;
  customerUid?: string; // undefined = guest checkout (to confirm)
  email: string;
  lines: OrderLine[];
  shippingCents: number;
  totalCents: number;
  status: OrderStatus;
  shippingAddress: ShippingAddress;
  /** Payment provider reference (Stripe Checkout Session id), set by the server only (never trusted from the client). */
  paymentRef?: string;
  createdAt: string;
};

/** Theme settings editable from the back-office (Lot 6), mirrored on the CSS variables in globals.css. */
export type ThemeSettings = {
  colorPrimary: string;
  colorSecondary: string;
  colorButton: string;
  colorButtonText: string;
  colorText: string;
  colorSurface: string;
  radius: "sm" | "md" | "lg";
  fontDisplay: string;
  fontBody: string;
};
