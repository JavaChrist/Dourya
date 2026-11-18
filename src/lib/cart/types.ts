import type { ImageAsset, SectionBackground } from "@/lib/types";

/**
 * What the browser stores and sends: identifiers and quantities only.
 * There is deliberately no price field: prices always come from the server.
 */
export type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
  /** Personalisation text, if the customer filled one. */
  personalisation?: string;
};

export type LineStatus =
  /** Accepted as requested. */
  | "ok"
  /** Accepted with a lower quantity (stock or per-line cap). */
  | "adjusted"
  /** Cannot be ordered: removed, unpublished, out of stock, no price... */
  | "unavailable"
  /** The personalisation is not accepted (closed, too long, quota reached). */
  | "invalid";

/** Snapshot of the personalisation, kept as-is in the future order. */
export type PersonalisationSnapshot = {
  label: string;
  text: string;
  surchargeCents: number;
};

export type PricedLine = {
  key: string;
  productId: string;
  variantId: string;
  requestedQuantity: number;
  /** Quantity accepted by the server (0 when not orderable). */
  quantity: number;
  /** Highest quantity the customer can choose for this line. */
  maxQuantity: number;
  status: LineStatus;
  message?: string;
  productSlug?: string;
  productName?: string;
  variantName?: string;
  /** Server price of one unit, personalisation included. null when not orderable. */
  unitPriceCents: number | null;
  lineTotalCents: number;
  personalisation?: PersonalisationSnapshot;
  isDemo: boolean;
  image?: ImageAsset;
  demoVisual?: SectionBackground;
};

export type PricedCart = {
  lines: PricedLine[];
  /** Sum of orderable lines, shipping excluded. */
  subtotalCents: number;
  /** Number of orderable units. */
  itemCount: number;
  hasDemo: boolean;
  hasBlockingIssue: boolean;
  /** True only when a real order could be placed (never with demo products). */
  checkoutAllowed: boolean;
};
