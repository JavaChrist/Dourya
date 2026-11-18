import { describe, expect, it } from "vitest";
import { defaultShippingSettings } from "@/config/shipping";
import { parcelFor, quoteShipping, validateShippingRate } from "./quote";
import type { ShippingRate, ShippingSettings } from "./types";

// Test values only: they are not DOURYA's rates.
const rate = (over: Partial<ShippingRate> = {}): ShippingRate => ({
  id: "test-letter",
  enabled: true,
  zone: "FR",
  envelope: "standard",
  service: "letter",
  label: "Tarif de test",
  priceCents: 100,
  packagingWeightGrams: 10,
  maxWeightGrams: 100,
  maxThicknessMm: 5,
  maxLengthMm: 300,
  maxWidthMm: 220,
  freeShippingEligible: false,
  ...over,
});
const settings = (rates: ShippingRate[], freeShippingThresholdCents: number | null = null): ShippingSettings => ({
  ...defaultShippingSettings,
  rates,
  freeShippingThresholdCents,
});
const print = { quantity: 1, weightGrams: 20, packedDimensionsMm: { length: 210, width: 297, height: 1 } };

describe("parcelFor", () => {
  it("stacks items flat and keeps the largest footprint", () => {
    expect(parcelFor([{ ...print, quantity: 3 }, { quantity: 1, weightGrams: 5, packedDimensionsMm: { length: 80, width: 60, height: 2 } }])).toEqual({
      weightGrams: 65,
      thicknessMm: 5,
      lengthMm: 297,
      widthMm: 210,
    });
  });
  it("refuses to guess when data is missing", () => {
    expect(parcelFor([{ quantity: 1, weightGrams: 20 }])).toBeNull();
    expect(parcelFor([{ quantity: 1, packedDimensionsMm: { length: 1, width: 1, height: 1 } }])).toBeNull();
    expect(parcelFor([{ ...print, weightGrams: 0 }])).toBeNull();
  });
});

describe("quoteShipping", () => {
  const input = { country: "FR", subtotalCents: 2000, items: [print] };

  it("offers nothing with the default settings (no rate entered yet)", () => {
    expect(quoteShipping(input, defaultShippingSettings)).toEqual({ available: false, reason: "no_matching_rate" });
  });
  it("keeps the other countries closed until validated", () => {
    for (const country of ["BE", "LU", "CH", "CA"]) {
      expect(quoteShipping({ ...input, country }, settings([rate({ zone: country })]))).toEqual({ available: false, reason: "zone_disabled" });
    }
    expect(quoteShipping({ ...input, country: "DE" }, settings([rate()]))).toEqual({ available: false, reason: "zone_unknown" });
  });
  it("picks the cheapest fitting band per packaging and service", () => {
    const quote = quoteShipping(
      input,
      settings([
        rate({ id: "small", maxWeightGrams: 25, priceCents: 50 }), // 20 g + 10 g packaging: too heavy
        rate({ id: "mid", priceCents: 120 }),
        rate({ id: "mid-cheaper", priceCents: 110 }),
        rate({ id: "tracked", service: "tracked", priceCents: 400 }),
        rate({ id: "off", enabled: false, priceCents: 1 }),
      ]),
    );
    expect(quote).toEqual({
      available: true,
      options: [
        expect.objectContaining({ rateId: "mid-cheaper", priceCents: 110, free: false }),
        expect.objectContaining({ rateId: "tracked", priceCents: 400 }),
      ],
    });
  });
  it("checks thickness and footprint, not only weight", () => {
    expect(quoteShipping({ ...input, items: [{ ...print, quantity: 6 }] }, settings([rate({ maxWeightGrams: 1000 })]))).toMatchObject({ available: false });
    expect(quoteShipping(input, settings([rate({ maxLengthMm: 250 })]))).toMatchObject({ available: false });
  });
  it("applies the free-shipping threshold to eligible rates only", () => {
    const rates = [rate({ id: "free-ok", freeShippingEligible: true }), rate({ id: "paid", service: "tracked", priceCents: 400 })];
    const below = quoteShipping({ ...input, subtotalCents: 1999 }, settings(rates, 2000));
    const above = quoteShipping(input, settings(rates, 2000));
    expect(below).toMatchObject({ options: [{ rateId: "free-ok", priceCents: 100, free: false }, { rateId: "paid" }] });
    expect(above).toMatchObject({ options: [{ rateId: "free-ok", priceCents: 0, free: true }, { rateId: "paid", priceCents: 400 }] });
  });
  it("reports missing product data and empty carts", () => {
    expect(quoteShipping({ ...input, items: [{ quantity: 1 }] }, settings([rate()]))).toEqual({ available: false, reason: "missing_parcel_data" });
    expect(quoteShipping({ ...input, items: [] }, settings([rate()]))).toEqual({ available: false, reason: "empty_cart" });
  });
  it("ignores an invalid rate", () => {
    expect(quoteShipping(input, settings([rate({ priceCents: -1 })]))).toEqual({ available: false, reason: "no_matching_rate" });
  });
});

describe("validateShippingRate", () => {
  it("accepts a complete rate and lists every wrong field", () => {
    expect(validateShippingRate(rate())).toEqual([]);
    expect(validateShippingRate(rate({ id: "Bad id", priceCents: 1.5, maxThicknessMm: 0, label: " " }))).toEqual(["id", "label", "priceCents", "maxThicknessMm"]);
  });
});
