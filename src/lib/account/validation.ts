import { accountConfig } from "@/config/commerce";
import type { ShippingAddress } from "@/lib/commerce-types";

export type FieldErrors = Partial<Record<string, string>>;
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

/** Trims, collapses spaces and removes control characters. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max + 1);
}

const NAME_PATTERN = /^[\p{L}\p{M}' .-]+$/u;

export function validateDisplayName(input: unknown): Validated<string> {
  const value = cleanText(input, 80);
  if (!value) return { ok: true, value: "" };
  if (value.length > 80) return { ok: false, errors: { displayName: "80 caractères maximum." } };
  if (!NAME_PATTERN.test(value)) return { ok: false, errors: { displayName: "Lettres, espaces, apostrophes et tirets uniquement." } };
  return { ok: true, value };
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Au moins ${PASSWORD_MIN} caractères.`;
  if (password.length > PASSWORD_MAX) return `${PASSWORD_MAX} caractères maximum.`;
  return null;
}

export type AddressInput = ShippingAddress & { label?: string };

const POSTAL: Record<string, RegExp> = { FR: /^\d{5}$/ };

/** Validates a shipping address sent by the browser (every field is re-checked on the server). */
export function validateAddress(input: Record<string, unknown>): Validated<AddressInput> {
  const errors: FieldErrors = {};
  const label = cleanText(input.label, 40);
  const fullName = cleanText(input.fullName, 80);
  const line1 = cleanText(input.line1, 120);
  const line2 = cleanText(input.line2, 120);
  const postalCode = cleanText(input.postalCode, 12).toUpperCase();
  const city = cleanText(input.city, 80);
  const country = cleanText(input.country, 2).toUpperCase();

  if (label.length > 40) errors.label = "40 caractères maximum.";
  if (!fullName) errors.fullName = "Indiquez le nom du destinataire.";
  else if (fullName.length > 80) errors.fullName = "80 caractères maximum.";
  if (!line1) errors.line1 = "Indiquez l'adresse.";
  else if (line1.length > 120) errors.line1 = "120 caractères maximum.";
  if (line2.length > 120) errors.line2 = "120 caractères maximum.";
  if (!city) errors.city = "Indiquez la ville.";
  else if (city.length > 80) errors.city = "80 caractères maximum.";
  if (!accountConfig.addressCountries.some((c) => c.code === country)) errors.country = "Pays non disponible.";
  const postalPattern = POSTAL[country] ?? /^[A-Z0-9 -]{2,10}$/;
  if (!postalPattern.test(postalCode)) errors.postalCode = "Code postal invalide.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { ...(label ? { label } : {}), fullName, line1, ...(line2 ? { line2 } : {}), postalCode, city, country },
  };
}
