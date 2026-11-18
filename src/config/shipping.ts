import type { ShippingSettings } from "@/lib/shipping/types";

/**
 * Default shipping settings. No rate, price or delivery time is invented:
 * the rate list stays empty until the merchant enters her own grid (admin,
 * Lot 4.4). With no rate, no shipping option is offered and checkout stays
 * blocked.
 *
 * France comes first. The other zones are listed but disabled until their
 * rates are validated.
 */
export const defaultShippingSettings: ShippingSettings = {
  zones: [
    { code: "FR", name: "France", enabled: true },
    { code: "BE", name: "Belgique", enabled: false },
    { code: "LU", name: "Luxembourg", enabled: false },
    { code: "CH", name: "Suisse", enabled: false },
    { code: "CA", name: "Canada", enabled: false },
  ],
  rates: [],
  freeShippingThresholdCents: null,
};
