const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Formats a price in cents, or says it is not set yet (prices are never invented). */
export function formatPrice(cents: number | null): string {
  if (cents === null) return "Prix à venir";
  return eur.format(cents / 100);
}
