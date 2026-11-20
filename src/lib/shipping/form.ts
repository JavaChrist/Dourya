import { defaultShippingSettings } from "@/config/shipping";
import type { FieldErrors } from "@/lib/account/validation";
import { validateShippingRate } from "@/lib/shipping/quote";
import type { EnvelopeType, ShippingRate, ShippingService, ShippingSettings } from "@/lib/shipping/types";

/**
 * Reads the Admin → Expédition form. Prices are typed in euros ("4,50"),
 * weights in grams, dimensions in mm. Nothing is pre-filled or guessed: a
 * missing or invalid value is an error on its own field, in French.
 *
 * Field names: zone.<CODE> (checkbox), freeShippingThreshold (euros, empty =
 * no free shipping), one rateKey per rate block, then <rateKey>.<field>.
 * Zones are the fixed list of config/shipping.ts: only their switch is edited.
 */

export const MAX_RATES = 30;
const RATE_KEY = /^rate-[a-z0-9]{1,20}$/;

export const ENVELOPES: { value: EnvelopeType; label: string }[] = [
  { value: "standard", label: "Enveloppe standard" },
  { value: "cardboard", label: "Enveloppe cartonnée" },
  { value: "bubble", label: "Enveloppe à bulles" },
];
export const SERVICES: { value: ShippingService; label: string }[] = [
  { value: "letter", label: "Lettre (sans suivi)" },
  { value: "tracked", label: "Suivi" },
];

const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
};

/** "4,50" or "4.50" → 450. null when not a price (max 2 decimals, max 10 000 €). */
export function eurosToCents(input: string): number | null {
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents <= 1_000_000 ? cents : null;
}

/** 450 → "4,50", for the form. */
export function centsToEuros(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

function wholeNumber(input: string): number | null {
  if (!/^\d{1,6}$/.test(input)) return null;
  return Number(input);
}

const MESSAGES: Record<string, string> = {
  id: "Identifiant du tarif invalide. Supprimez ce bloc et ajoutez-le à nouveau.",
  zone: "Choisissez une zone.",
  envelope: "Choisissez un type d'enveloppe.",
  service: "Choisissez un service.",
  label: "Indiquez un libellé (60 caractères au plus).",
  priceCents: "Indiquez un prix en euros, par exemple 4,50.",
  packagingWeightGrams: "Indiquez le poids de l'emballage en grammes (0 ou plus).",
  maxWeightGrams: "Indiquez un poids maximal en grammes (plus de 0).",
  maxThicknessMm: "Indiquez une épaisseur maximale en mm (plus de 0).",
  maxLengthMm: "Indiquez une longueur maximale en mm (plus de 0).",
  maxWidthMm: "Indiquez une largeur maximale en mm (plus de 0).",
};

/** Rate key → form field suffix. */
const FIELD: Record<string, string> = {
  id: "id",
  zone: "zone",
  envelope: "envelope",
  service: "service",
  label: "label",
  priceCents: "price",
  packagingWeightGrams: "packagingWeight",
  maxWeightGrams: "maxWeight",
  maxThicknessMm: "maxThickness",
  maxLengthMm: "maxLength",
  maxWidthMm: "maxWidth",
};

export type ShippingFormResult = { ok: true; value: ShippingSettings } | { ok: false; errors: FieldErrors };

export function parseShippingForm(form: FormData): ShippingFormResult {
  const errors: FieldErrors = {};
  const zones = defaultShippingSettings.zones.map((z) => ({ ...z, enabled: form.get(`zone.${z.code}`) === "on" }));
  const zoneCodes = new Set(zones.map((z) => z.code));

  let freeShippingThresholdCents: number | null = null;
  const threshold = text(form, "freeShippingThreshold");
  if (threshold) {
    freeShippingThresholdCents = eurosToCents(threshold);
    if (freeShippingThresholdCents === null || freeShippingThresholdCents === 0) {
      errors.freeShippingThreshold = "Indiquez un montant en euros, par exemple 50, ou laissez vide pour ne pas offrir la livraison.";
      freeShippingThresholdCents = null;
    }
  }

  const keys = form.getAll("rateKey").filter((k): k is string => typeof k === "string");
  if (keys.length > MAX_RATES) errors.rates = `${MAX_RATES} tarifs au plus.`;
  if (new Set(keys).size !== keys.length || keys.some((k) => !RATE_KEY.test(k))) errors.rates = "Le formulaire est incomplet. Rechargez la page.";

  const rates: ShippingRate[] = [];
  const seenIds = new Set<string>();
  for (const k of keys.slice(0, MAX_RATES)) {
    if (!RATE_KEY.test(k)) continue;
    const price = eurosToCents(text(form, `${k}.price`));
    const carrier = text(form, `${k}.carrier`);
    const rate: ShippingRate = {
      id: text(form, `${k}.id`),
      enabled: form.get(`${k}.enabled`) === "on",
      zone: text(form, `${k}.zone`),
      envelope: text(form, `${k}.envelope`) as EnvelopeType,
      service: text(form, `${k}.service`) as ShippingService,
      label: text(form, `${k}.label`),
      ...(carrier ? { carrier: carrier.slice(0, 40) } : {}),
      priceCents: price ?? -1,
      packagingWeightGrams: wholeNumber(text(form, `${k}.packagingWeight`)) ?? -1,
      maxWeightGrams: wholeNumber(text(form, `${k}.maxWeight`)) ?? -1,
      maxThicknessMm: wholeNumber(text(form, `${k}.maxThickness`)) ?? -1,
      maxLengthMm: wholeNumber(text(form, `${k}.maxLength`)) ?? -1,
      maxWidthMm: wholeNumber(text(form, `${k}.maxWidth`)) ?? -1,
      freeShippingEligible: form.get(`${k}.free`) === "on",
    };
    const problems = validateShippingRate(rate);
    if (!problems.includes("zone") && !zoneCodes.has(rate.zone)) problems.push("zone");
    if (!problems.includes("id") && seenIds.has(rate.id)) problems.push("id");
    seenIds.add(rate.id);
    if (carrier.length > 40) errors[`${k}.carrier`] = "Transporteur : 40 caractères au plus.";
    for (const p of problems) errors[`${k}.${FIELD[p]}`] = MESSAGES[p];
    rates.push(rate);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { zones, rates, freeShippingThresholdCents } };
}
