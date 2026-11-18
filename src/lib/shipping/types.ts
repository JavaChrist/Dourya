/** Packaging used for the parcel. */
export type EnvelopeType = "standard" | "cardboard" | "bubble";

/** "letter" = plain mail, no tracking. "tracked" = tracking number given to the customer. */
export type ShippingService = "letter" | "tracked";

export type ShippingZone = {
  /** ISO 3166-1 alpha-2 country code. */
  code: string;
  name: string;
  /** Off until the merchant validates the zone and its rates. */
  enabled: boolean;
};

/**
 * One rate band, edited by the admin. A parcel fits when its packed weight
 * (items + packaging) and dimensions are all within the limits.
 */
export type ShippingRate = {
  id: string;
  enabled: boolean;
  zone: string;
  envelope: EnvelopeType;
  service: ShippingService;
  /** Customer-facing label, e.g. "Lettre suivie". */
  label: string;
  /** Carrier name, free text (no carrier is imposed). */
  carrier?: string;
  priceCents: number;
  /** Weight of the empty packaging, added to the items. */
  packagingWeightGrams: number;
  maxWeightGrams: number;
  maxThicknessMm: number;
  maxLengthMm: number;
  maxWidthMm: number;
  /** Becomes free above the free-shipping threshold, when one is set. */
  freeShippingEligible: boolean;
};

export type ShippingSettings = {
  zones: ShippingZone[];
  rates: ShippingRate[];
  /** Subtotal (cents) from which eligible rates are free. null = no free shipping. */
  freeShippingThresholdCents: number | null;
};

export type ShippingOption = {
  rateId: string;
  label: string;
  carrier?: string;
  envelope: EnvelopeType;
  service: ShippingService;
  priceCents: number;
  /** Shown when the threshold made this rate free. */
  free: boolean;
};

export type ShippingQuote =
  | { available: true; options: ShippingOption[] }
  | { available: false; reason: "zone_unknown" | "zone_disabled" | "missing_parcel_data" | "no_matching_rate" | "empty_cart" };
