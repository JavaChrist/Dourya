/** Carriers the admin can pick when marking an order shipped (free text is never stored). */
export const CARRIERS = ["La Poste", "Colissimo", "Mondial Relay"] as const;
export type Carrier = (typeof CARRIERS)[number];
