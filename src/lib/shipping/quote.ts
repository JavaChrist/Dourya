import type { ShippingOption, ShippingQuote, ShippingRate, ShippingSettings } from "./types";

/** One cart line as seen by shipping: packed data of the variant and the quantity. */
export type ParcelItem = {
  quantity: number;
  weightGrams?: number;
  packedDimensionsMm?: { length: number; width: number; height: number };
};

export type Parcel = { weightGrams: number; thicknessMm: number; lengthMm: number; widthMm: number };

const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Packed size of the whole order. Items are stacked flat (prints, stickers,
 * key rings in their sleeve): thickness adds up, length and width are the
 * largest ones. null when an item has no weight or dimensions: no rate is
 * guessed for it.
 */
export function parcelFor(items: ParcelItem[]): Parcel | null {
  let weightGrams = 0;
  let thicknessMm = 0;
  let lengthMm = 0;
  let widthMm = 0;
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const d = item.packedDimensionsMm;
    if (!isPositive(item.weightGrams) || !d || !isPositive(d.length) || !isPositive(d.width) || !isPositive(d.height)) return null;
    // Orientation does not matter: the longer side is the length.
    const long = Math.max(d.length, d.width);
    const short = Math.min(d.length, d.width);
    weightGrams += item.weightGrams * item.quantity;
    thicknessMm += d.height * item.quantity;
    lengthMm = Math.max(lengthMm, long);
    widthMm = Math.max(widthMm, short);
  }
  return { weightGrams, thicknessMm, lengthMm, widthMm };
}

export function rateFits(rate: ShippingRate, parcel: Parcel): boolean {
  return (
    parcel.weightGrams + rate.packagingWeightGrams <= rate.maxWeightGrams &&
    parcel.thicknessMm <= rate.maxThicknessMm &&
    parcel.lengthMm <= rate.maxLengthMm &&
    parcel.widthMm <= rate.maxWidthMm
  );
}

/**
 * Shipping options for a cart, computed on the server only. For each
 * packaging + service pair, the cheapest band that fits is kept.
 */
export function quoteShipping(
  input: { country: string; subtotalCents: number; items: ParcelItem[] },
  settings: ShippingSettings,
): ShippingQuote {
  const zone = settings.zones.find((z) => z.code === input.country);
  if (!zone) return { available: false, reason: "zone_unknown" };
  if (!zone.enabled) return { available: false, reason: "zone_disabled" };
  if (!input.items.some((i) => i.quantity > 0)) return { available: false, reason: "empty_cart" };
  const parcel = parcelFor(input.items);
  if (!parcel) return { available: false, reason: "missing_parcel_data" };

  const threshold = settings.freeShippingThresholdCents;
  const freeApplies = threshold !== null && input.subtotalCents >= threshold;

  const best = new Map<string, ShippingRate>();
  for (const rate of settings.rates) {
    if (!rate.enabled || rate.zone !== zone.code || validateShippingRate(rate).length > 0 || !rateFits(rate, parcel)) continue;
    const key = `${rate.envelope}|${rate.service}`;
    const current = best.get(key);
    if (!current || rate.priceCents < current.priceCents) best.set(key, rate);
  }
  if (best.size === 0) return { available: false, reason: "no_matching_rate" };

  const options: ShippingOption[] = [...best.values()].map((rate) => {
    const free = freeApplies && rate.freeShippingEligible;
    return {
      rateId: rate.id,
      label: rate.label,
      carrier: rate.carrier,
      envelope: rate.envelope,
      service: rate.service,
      priceCents: free ? 0 : rate.priceCents,
      free,
    };
  });
  options.sort((a, b) => a.priceCents - b.priceCents || a.label.localeCompare(b.label, "fr"));
  return { available: true, options };
}

/** Problems in a rate entered by the admin. Empty array = valid. */
export function validateShippingRate(rate: ShippingRate): string[] {
  const errors: string[] = [];
  const nonNegativeInt = (n: number) => Number.isInteger(n) && n >= 0;
  if (!/^[a-z0-9_-]{1,40}$/.test(rate.id)) errors.push("id");
  if (!/^[A-Z]{2}$/.test(rate.zone)) errors.push("zone");
  if (!["standard", "cardboard", "bubble"].includes(rate.envelope)) errors.push("envelope");
  if (!["letter", "tracked"].includes(rate.service)) errors.push("service");
  if (!rate.label.trim() || rate.label.length > 60) errors.push("label");
  if (!nonNegativeInt(rate.priceCents)) errors.push("priceCents");
  if (!nonNegativeInt(rate.packagingWeightGrams)) errors.push("packagingWeightGrams");
  for (const key of ["maxWeightGrams", "maxThicknessMm", "maxLengthMm", "maxWidthMm"] as const) {
    if (!Number.isInteger(rate[key]) || rate[key] <= 0) errors.push(key);
  }
  return errors;
}
